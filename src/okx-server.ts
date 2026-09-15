import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@okxweb3/x402-express";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";
import { OKXFacilitatorClient } from "@okxweb3/x402-core";
import { privateKeyToAccount } from "viem/accounts";
import { hashCanonical } from "./canonical.js";
import { hashPromise, signPromise, signReceipt } from "./signing.js";
import type { ServicePromise, ServiceRequest } from "./types.js";
import { fetchOkxTicker } from "./okx-market.js";

const required = ["OKX_API_KEY", "OKX_SECRET_KEY", "OKX_PASSPHRASE", "X402_PAY_TO", "PROVIDER_SIGNING_KEY"] as const;
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(`Missing live OKX configuration: ${missing.join(", ")}`);
}

const network = (process.env.X402_NETWORK || "eip155:1952") as `${string}:${string}`;
const port = Number(process.env.PORT || 8787);
const payTo = process.env.X402_PAY_TO!;
const provider = privateKeyToAccount(process.env.PROVIDER_SIGNING_KEY as `0x${string}`);
const vault = (process.env.QUALITY_BOND_VAULT_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;

const facilitatorClient = new OKXFacilitatorClient({
  apiKey: process.env.OKX_API_KEY!,
  secretKey: process.env.OKX_SECRET_KEY!,
  passphrase: process.env.OKX_PASSPHRASE!,
});
const resourceServer = new x402ResourceServer(facilitatorClient);
resourceServer.register(network, new ExactEvmScheme());

const app = express();
app.use(express.json());
app.get("/health", (_request, response) => {
  response.json({ status: "ok", mode: "OKX_OFFICIAL_X402", network });
});
app.use(
  paymentMiddleware(
    {
      "POST /v1/provider/quote": {
        accepts: [{ scheme: "exact", network, payTo, price: "$0.01" }],
        description: "Bond-backed fresh market quote with a provider-signed delivery receipt",
        mimeType: "application/json",
      },
    },
    resourceServer,
  ),
);

app.post("/v1/provider/quote", async (request, response) => {
  const now = Math.floor(Date.now() / 1000);
  const promise: ServicePromise = {
    version: "1",
    chainId: network === "eip155:196" ? 196 : 1952,
    vault,
    serviceId: "market-data-v1",
    endpoint: `${process.env.PUBLIC_BASE_URL}/v1/provider/quote`,
    responseTimeMs: 2_000,
    maxDataAgeSeconds: 30,
    requiredSchema: "market-quote-v1",
    minimumRecords: 1,
    priceAtomic: "10000",
    bondAmountAtomic: "5000000",
    rebateAtomic: "10000",
    refundOnBreach: true,
    validUntil: now + 86_400,
    provider: provider.address,
  };
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
    paymentId: hashCanonical({
      paymentSignature: request.header("payment-signature") || request.header("x-payment") || "missing",
    }),
    deliveredAt: now,
    servicePromiseHash: await hashPromise(promise),
    provider: provider.address,
  });
  response.json({ result: serviceResponse, servicePromise: signedPromise, deliveryReceipt });
});

app.listen(port, () => {
  console.log(`RelayBond official OKX x402 endpoint listening on ${port} (${network})`);
});
