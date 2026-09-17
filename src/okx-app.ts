import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@okxweb3/x402-express";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";
import { OKXFacilitatorClient } from "@okxweb3/x402-core";
import { privateKeyToAccount } from "viem/accounts";
import { hashCanonical } from "./canonical.js";
import { hashPromise, signPromise, signReceipt } from "./signing.js";
import type { ServiceRequest } from "./types.js";
import { fetchOkxTicker } from "./okx-market.js";
import { configuredServicePromise } from "./service-promise.js";
import { ResilientFacilitatorClient } from "./resilient-facilitator.js";
import { buildScenarioResponse, normalizeServiceInput, paymentContextFromVerifiedHeader } from "./paid-request.js";
import { verifyDelivery, type VerificationInput } from "./verifier.js";
import { APP_VERSION } from "./version.js";
import { createContinuityEvidence } from "./continuity-simulator.js";
import { createOfficialCoordinatorEvidence } from "./official-build-simulator.js";
import { providerConfigurationStatus } from "./provider-config.js";

export function createOkxApp() {
  const required = ["OKX_API_KEY", "OKX_SECRET_KEY", "OKX_PASSPHRASE", "X402_PAY_TO", "PROVIDER_SIGNING_KEY"] as const;
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) throw new Error(`Missing live OKX configuration: ${missing.join(", ")}`);

  const network = (process.env.X402_NETWORK || "eip155:1952") as `${string}:${string}`;
  const payTo = process.env.X402_PAY_TO!;
  const provider = privateKeyToAccount(process.env.PROVIDER_SIGNING_KEY as `0x${string}`);
  const promise = configuredServicePromise();
  const facilitatorClient = new ResilientFacilitatorClient(new OKXFacilitatorClient({
    apiKey: process.env.OKX_API_KEY!,
    secretKey: process.env.OKX_SECRET_KEY!,
    passphrase: process.env.OKX_PASSPHRASE!,
  }));
  const resourceServer = new x402ResourceServer(facilitatorClient);
  resourceServer.register(network, new ExactEvmScheme());

  const app = express();
  app.set("trust proxy", true);
  app.use((_request, response, next) => {
    response.setHeader("access-control-allow-origin", "*");
    response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
    response.setHeader("access-control-allow-headers", "content-type,payment-signature,x-payment");
    next();
  });
  app.options(/.*/, (_request, response) => response.status(204).end());
  app.use(express.json({ limit: "32kb" }));
  app.get("/health", (_request, response) => {
    response.json({ status: "ok", version: APP_VERSION, mode: "OKX_OFFICIAL_X402", network, serviceId: promise.serviceId, provider: provider.address, vault: promise.vault });
  });
  app.get("/v1/service/promise", async (_request, response, next) => {
    try {
      response.json({ servicePromise: await signPromise(provider, promise), promiseHash: await hashPromise(promise) });
    } catch (error) {
      next(error);
    }
  });
  app.get("/v1/providers", async (_request, response, next) => {
    try {
      const evidence = await createContinuityEvidence();
      response.json({
        mode: evidence.mode,
        notice: "LOCAL V2 recovery registry. Live provider publication remains separately labeled.",
        providers: evidence.providers,
      });
    } catch (error) {
      next(error);
    }
  });
  app.get("/v1/recovery/demo", async (_request, response, next) => {
    try {
      response.json(await createContinuityEvidence());
    } catch (error) {
      next(error);
    }
  });
  app.get("/v1/official/coordinator", async (_request, response, next) => {
    try {
      response.json(await createOfficialCoordinatorEvidence());
    } catch (error) {
      next(error);
    }
  });
  app.get("/v1/official/readiness", (_request, response) => {
    response.json({
      mode: "OFFICIAL_PERIOD_PROVIDER_RUNTIME",
      configuration: providerConfigurationStatus(),
      transport: {
        executor: "HttpProviderExecutor",
        endpointBinding: true,
        redirectsAllowed: false,
        timeoutMs: 10_000,
        maximumResponseBytes: 1_000_000,
      },
      paymentBoundary: {
        automaticPayment: false,
        behavior: "HTTP 402 stops execution and requires a separately reviewed authorization.",
      },
      settlement: {
        v2Broadcast: true,
        status: "TESTNET",
        contract: "0xBa15362E3B52eAD97bB5bD5ce849D73376b8b73f",
        sourceVerified: true,
        providerRegistration: "TESTNET",
        backupSettlement: "PENDING",
        guard: {
          rejectsLocalEvidence: true,
          liveCoordinatorBridge: true,
          rechecksPrimaryPaymentOnchain: true,
          rechecksProviderBondsOnchain: true,
          simulationRequired: true,
          separateConfirmationRequired: true,
          buyerBalanceInvariantChecked: true,
        },
      },
    });
  });
  app.post("/v1/verify", async (request, response, next) => {
    try {
      response.json(await verifyDelivery(request.body as VerificationInput));
    } catch (error) {
      next(error);
    }
  });
  app.use("/v1/provider/quote", (request, response, next) => {
    try {
      const { scenario } = normalizeServiceInput(request.body, request.query);
      if (scenario !== "accepted" && process.env.ALLOW_PAID_BREACH_DEMO !== "true") {
        response.status(403).json({ error: "BREACH_DEMO_DISABLED" });
        return;
      }
      next();
    } catch (error) {
      response.status(400).json({ error: "INVALID_SERVICE_REQUEST", message: error instanceof Error ? error.message : "Invalid request" });
    }
  });
  app.use((request, _response, next) => {
    // Vercel rewrites may expose the captured wildcard as an internal `path`
    // query parameter. It must not become part of the buyer-signed resource URL.
    if (request.path === "/v1/provider/quote" && Object.hasOwn(request.query, "path")) {
      request.originalUrl = request.path;
    }
    next();
  });
  app.use(paymentMiddleware({
    "POST /v1/provider/quote": {
      accepts: [{ scheme: "exact", network, payTo, price: "$0.01" }],
      description: "Bond-backed fresh OKX market quote with a provider-signed Delivery Receipt",
      mimeType: "application/json",
    },
  }, resourceServer));

  app.post("/v1/provider/quote", async (request, response, next) => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const normalized = normalizeServiceInput(request.body, request.query);
      const paymentHeader = request.header("payment-signature") || request.header("x-payment");
      const payment = paymentContextFromVerifiedHeader(paymentHeader, {
        network,
        asset: (process.env.USDT0_ADDRESS || "0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c") as `0x${string}`,
        amount: promise.priceAtomic,
        payTo: payTo as `0x${string}`,
      });
      const serviceRequest: ServiceRequest = {
        serviceId: promise.serviceId,
        requestedAt: now,
        input: normalized.input,
        buyer: payment.buyer,
      };
      const quote = await fetchOkxTicker(normalized.symbol);
      const serviceResponse = buildScenarioResponse(quote, normalized.scenario, promise.maxDataAgeSeconds);
      const signedPromise = await signPromise(provider, promise);
      const deliveryReceipt = await signReceipt(provider, promise, {
        version: "1",
        serviceId: promise.serviceId,
        requestHash: hashCanonical(serviceRequest),
        responseHash: hashCanonical(serviceResponse),
        paymentId: payment.paymentId,
        deliveredAt: now,
        servicePromiseHash: await hashPromise(promise),
        provider: provider.address,
      });
      response.json({ request: serviceRequest, result: serviceResponse, servicePromise: signedPromise, deliveryReceipt });
    } catch (error) {
      next(error);
    }
  });
  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    response.status(502).json({ error: "SERVICE_DELIVERY_FAILED", message: error instanceof Error ? error.message : "Unknown delivery failure" });
  });
  return app;
}
