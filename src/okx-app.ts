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
  app.use(express.json({ limit: "32kb" }));
  app.get("/health", (_request, response) => {
    response.json({ status: "ok", mode: "OKX_OFFICIAL_X402", network, serviceId: promise.serviceId, provider: provider.address, vault: promise.vault });
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
      const serviceRequest: ServiceRequest = {
        serviceId: promise.serviceId,
        requestedAt: now,
        input: request.body,
        buyer: (request.header("x-relaybond-buyer") || "0x0000000000000000000000000000000000000000") as `0x${string}`,
      };
      const symbol = typeof request.body?.symbol === "string" ? request.body.symbol.toUpperCase() : "BTC-USDT";
      const serviceResponse = await fetchOkxTicker(symbol);
      const signedPromise = await signPromise(provider, promise);
      const deliveryReceipt = await signReceipt(provider, promise, {
        version: "1",
        serviceId: promise.serviceId,
        requestHash: hashCanonical(serviceRequest),
        responseHash: hashCanonical(serviceResponse),
        paymentId: hashCanonical({ paymentSignature: request.header("payment-signature") || request.header("x-payment") || "missing" }),
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
