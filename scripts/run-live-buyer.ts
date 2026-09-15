import { mkdir, writeFile } from "node:fs/promises";
import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";
import { x402Client, x402HTTPClient } from "@okxweb3/x402-core/client";
import { ExactEvmScheme, toClientEvmSigner } from "@okxweb3/x402-evm";
import { privateKeyToAccount } from "viem/accounts";
import { hashCanonical, sha256Canonical } from "../src/canonical.js";
import { selectGuardedRequirement } from "../src/buyer.js";
import { verifyDelivery } from "../src/verifier.js";
import type { Signed, DeliveryReceipt, ServicePromise, ServiceRequest } from "../src/types.js";

type PaidDelivery = {
  request: ServiceRequest;
  result: unknown;
  servicePromise: Signed<ServicePromise>;
  deliveryReceipt: Signed<DeliveryReceipt>;
};

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function showHelp(): never {
  console.log(`RelayBond live buyer

Probe only (safe default):
  npm run buyer:live -- --symbol BTC-USDT

Pay exactly once using a dedicated testnet buyer key:
  BUYER_PRIVATE_KEY=0x... npm run buyer:live -- --symbol BTC-USDT --pay

Options:
  --base-url URL             Provider base URL
  --symbol ID                OKX instrument ID
  --network CAIP2            Required network
  --asset ADDRESS            Required settlement token
  --pay-to ADDRESS           Optional exact payee allowlist
  --max-amount-atomic N      Hard payment ceiling
  --pay                      Explicitly authorize one payment attempt

The runner never falls back to a deployer/provider key and never stores a payment signature.`);
  process.exit(0);
}

if (process.argv.includes("--help")) showHelp();
if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy) {
  setGlobalDispatcher(new EnvHttpProxyAgent());
}

const shouldPay = process.argv.includes("--pay");
const baseUrl = argument("--base-url", process.env.PUBLIC_BASE_URL || "https://relaybond-okx.vercel.app").replace(/\/$/, "");
const symbol = argument("--symbol", "BTC-USDT").toUpperCase();
const network = argument("--network", process.env.X402_NETWORK || "eip155:1952");
const asset = argument(
  "--asset",
  process.env.USDT0_ADDRESS || "0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c",
);
const payTo = argument("--pay-to", process.env.X402_PAY_TO || "");
const maxAmountAtomic = argument("--max-amount-atomic", process.env.X402_MAX_PAYMENT_ATOMIC || "10000");
const endpoint = `${baseUrl}/v1/provider/quote`;
const requestBody = { symbol };

const probeResponse = await fetch(endpoint, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(requestBody),
});
if (probeResponse.status !== 402) {
  throw new Error(`Expected HTTP 402 from ${endpoint}; received ${probeResponse.status}: ${await probeResponse.text()}`);
}

const probeHttp = new x402HTTPClient(new x402Client());
const paymentRequired = probeHttp.getPaymentRequiredResponse((name) => probeResponse.headers.get(name));
const { requirement, plan } = selectGuardedRequirement(paymentRequired, {
  network,
  asset,
  maxAmountAtomic,
  payTo: payTo || undefined,
});

const probeEvidence = {
  evidenceVersion: "1",
  mode: shouldPay ? "PAYMENT_AUTHORIZED" : "PROBE_ONLY",
  observedAt: new Date().toISOString(),
  endpoint,
  symbol,
  plan,
};
console.log(JSON.stringify(probeEvidence, null, 2));

if (!shouldPay) {
  console.log("\nNo payment was signed or submitted. Re-run with --pay only after reviewing the plan above.");
  process.exit(0);
}

const buyerKey = process.env.BUYER_PRIVATE_KEY;
if (!buyerKey || !/^0x[0-9a-fA-F]{64}$/.test(buyerKey)) {
  throw new Error("--pay requires a dedicated BUYER_PRIVATE_KEY in the process environment.");
}
const buyer = privateKeyToAccount(buyerKey as `0x${string}`);
if (process.env.BUYER_ADDRESS && buyer.address.toLowerCase() !== process.env.BUYER_ADDRESS.toLowerCase()) {
  throw new Error("BUYER_PRIVATE_KEY does not match the allowlisted BUYER_ADDRESS.");
}

console.log(`\nPAYMENT AUTHORIZED BY --pay\nBuyer: ${buyer.address}\nAmount: ${plan.amountDisplay} ${plan.assetName} (${plan.amountAtomic} atomic)\nPayee: ${plan.payTo}\nToken: ${plan.asset}\nChain: ${plan.network}\n`);

const coreClient = new x402Client();
coreClient.register(network as `${string}:${string}`, new ExactEvmScheme(toClientEvmSigner(buyer)));
coreClient.registerPolicy((_version, candidates) =>
  candidates.filter(
    (candidate) =>
      candidate.scheme === requirement.scheme &&
      candidate.network === requirement.network &&
      candidate.asset.toLowerCase() === requirement.asset.toLowerCase() &&
      candidate.payTo.toLowerCase() === requirement.payTo.toLowerCase() &&
      candidate.amount === requirement.amount,
  ),
);
const paidHttp = new x402HTTPClient(coreClient);
const paymentPayload = await paidHttp.createPaymentPayload(paymentRequired);
const paidResponse = await fetch(endpoint, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-relaybond-buyer": buyer.address,
    ...paidHttp.encodePaymentSignatureHeader(paymentPayload),
  },
  body: JSON.stringify(requestBody),
});
const responseText = await paidResponse.text();
if (!paidResponse.ok) {
  throw new Error(`Paid request failed with HTTP ${paidResponse.status}: ${responseText}`);
}

const delivery = JSON.parse(responseText) as PaidDelivery;
const settlement = paidHttp.getPaymentSettleResponse((name) => paidResponse.headers.get(name));
const verification = await verifyDelivery({
  promise: delivery.servicePromise,
  request: delivery.request,
  response: delivery.result,
  receipt: delivery.deliveryReceipt,
  checkedAt: Math.max(Math.floor(Date.now() / 1000), delivery.deliveryReceipt.payload.deliveredAt),
});
if (verification.status !== "ACCEPTED") {
  throw new Error(`Paid delivery failed independent verification: ${verification.violations.join(", ")}`);
}

const unsignedEvidence = {
  evidenceVersion: "1",
  mode: "XLAYER_TESTNET_PAID_DELIVERY",
  capturedAt: new Date().toISOString(),
  buyer: buyer.address,
  plan,
  settlement,
  delivery,
  verification,
};
const evidence = {
  ...unsignedEvidence,
  evidenceHash: hashCanonical(unsignedEvidence),
  portableIntegrity: { algorithm: "SHA-256", hash: sha256Canonical(unsignedEvidence) },
};
await mkdir("evidence/live", { recursive: true });
await writeFile("evidence/live/paid-delivery.json", `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ status: "ACCEPTED", transaction: settlement.transaction, evidence: "evidence/live/paid-delivery.json", evidenceHash: evidence.evidenceHash }, null, 2));
