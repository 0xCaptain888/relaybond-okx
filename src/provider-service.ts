import express from "express";
import { isAddress, isHex, type LocalAccount } from "viem";
import { hashCanonical } from "./canonical.js";
import { hashPromise, signPromise, signReceipt } from "./signing.js";
import type { BondedProviderProfile, ServicePromise, ServiceRequest } from "./types.js";

type ProviderScenario = "accepted" | "stale" | "empty";

function requestEnvelope(value: unknown): {
  taskId: `0x${string}`;
  request: ServiceRequest;
  paymentSource: "BUYER" | "PRIMARY_BOND";
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Request body must be an object.");
  const input = value as Record<string, unknown>;
  if (!isHex(input.taskId as string) || !/^0x[0-9a-fA-F]{64}$/.test(String(input.taskId))) {
    throw new Error("taskId must be bytes32.");
  }
  if (input.paymentSource !== "BUYER" && input.paymentSource !== "PRIMARY_BOND") {
    throw new Error("paymentSource must be BUYER or PRIMARY_BOND.");
  }
  if (!input.request || typeof input.request !== "object" || Array.isArray(input.request)) {
    throw new Error("request must be an object.");
  }
  const request = input.request as Record<string, unknown>;
  if (typeof request.serviceId !== "string" || request.serviceId.length === 0) throw new Error("request.serviceId is required.");
  if (!Number.isSafeInteger(request.requestedAt) || Number(request.requestedAt) <= 0) throw new Error("request.requestedAt is invalid.");
  if (!request.input || typeof request.input !== "object" || Array.isArray(request.input)) throw new Error("request.input must be an object.");
  if (!isAddress(request.buyer as string, { strict: false })) throw new Error("request.buyer must be an address.");
  return {
    taskId: input.taskId as `0x${string}`,
    paymentSource: input.paymentSource,
    request: request as ServiceRequest,
  };
}

export function createProviderService(options: {
  profile: BondedProviderProfile;
  account: LocalAccount;
  chainId: number;
  vault: `0x${string}`;
  scenario?: ProviderScenario | ((request: ServiceRequest) => ProviderScenario);
  quotePrice?: number;
  now?: () => number;
}) {
  if (options.account.address.toLowerCase() !== options.profile.provider.toLowerCase()) {
    throw new Error("Provider signing account does not match the configured Provider Profile.");
  }
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.get("/health", (_request, response) => {
    response.json({
      status: "ok",
      mode: options.profile.mode,
      providerId: options.profile.providerId,
      serviceId: options.profile.serviceId,
      signer: options.account.address,
    });
  });
  app.post("/deliver", async (request, response) => {
    try {
      const envelope = requestEnvelope(request.body);
      if (envelope.request.serviceId !== options.profile.serviceId) {
        response.status(409).json({ error: "SERVICE_ID_MISMATCH" });
        return;
      }
      const now = options.now?.() ?? Math.floor(Date.now() / 1_000);
      const scenario = typeof options.scenario === "function"
        ? options.scenario(envelope.request)
        : options.scenario ?? "accepted";
      const promise: ServicePromise = {
        version: "1",
        chainId: options.chainId,
        vault: options.vault,
        serviceId: options.profile.serviceId,
        endpoint: options.profile.endpoint,
        responseTimeMs: options.profile.maximumLatencyMs,
        maxDataAgeSeconds: options.profile.maximumDataAgeSeconds,
        requiredSchema: options.profile.supportedSchemas[0]!,
        minimumRecords: 1,
        priceAtomic: options.profile.priceAtomic,
        bondAmountAtomic: options.profile.bondAtomic,
        rebateAtomic: options.profile.priceAtomic,
        refundOnBreach: true,
        validUntil: now + 3_600,
        provider: options.profile.provider,
      };
      const symbol = typeof envelope.request.input.symbol === "string" ? envelope.request.input.symbol : "BTC-USDT";
      const serviceResponse = scenario === "empty" ? {} : {
        symbol,
        price: options.quotePrice ?? 62_500,
        observedAt: scenario === "stale" ? now - options.profile.maximumDataAgeSeconds - 60 : now,
        source: options.profile.name,
      };
      const receipt = {
        version: "1" as const,
        serviceId: promise.serviceId,
        requestHash: hashCanonical(envelope.request),
        responseHash: hashCanonical(serviceResponse),
        paymentId: hashCanonical({
          taskId: envelope.taskId,
          paymentSource: envelope.paymentSource,
          providerId: options.profile.providerId,
        }),
        deliveredAt: now,
        servicePromiseHash: await hashPromise(promise),
        provider: options.account.address,
      };
      response.json({
        request: envelope.request,
        response: serviceResponse,
        servicePromise: await signPromise(options.account, promise),
        deliveryReceipt: await signReceipt(options.account, promise, receipt),
      });
    } catch (error) {
      response.status(400).json({ error: "INVALID_PROVIDER_REQUEST", message: error instanceof Error ? error.message : "Invalid request." });
    }
  });
  return app;
}
