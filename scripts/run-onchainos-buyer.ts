import { mkdir, writeFile } from "node:fs/promises";
import { hashCanonical, sha256Canonical } from "../src/canonical.js";
import { extractMerchantDelivery, runOnchainOs } from "../src/onchainos-buyer.js";
import { settlementTransaction, verifyOnchainSettlement } from "../src/settlement.js";
import { verifyDelivery } from "../src/verifier.js";
import type { DeliveryReceipt, ServicePromise, ServiceRequest, Signed } from "../src/types.js";

type Delivery = {
  request: ServiceRequest;
  result: unknown;
  servicePromise: Signed<ServicePromise>;
  deliveryReceipt: Signed<DeliveryReceipt>;
};

function value(name: string, fallback = ""): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

const command = process.argv[2];
const endpoint = value("--url", `${(process.env.PUBLIC_BASE_URL || "https://relaybond-okx.vercel.app").replace(/\/$/, "")}/v1/provider/quote`);

if (command === "quote") {
  const symbol = value("--symbol", "BTC-USDT").toUpperCase();
  const scenario = value("--scenario", "accepted").toLowerCase();
  const quote = await runOnchainOs([
    "payment",
    "quote",
    endpoint,
    "--method",
    "POST",
    "--param",
    `symbol=${symbol}`,
    "--param",
    `scenario=${scenario}`,
  ]);
  console.log(JSON.stringify(quote, null, 2));
  process.exit(0);
}

if (command === "pay") {
  const paymentId = value("--payment-id");
  const selectedIndex = value("--selected-index", "0");
  const expectedStatus = value("--expect", "accepted").toUpperCase();
  if (!["ACCEPTED", "BREACH"].includes(expectedStatus)) throw new Error("--expect must be accepted or breach.");
  if (!paymentId) throw new Error("pay requires --payment-id from a prior quote.");
  if (!process.argv.includes("--yes")) {
    throw new Error("Refusing payment without explicit --yes after the operator reviews the OnchainOS quote.");
  }

  const paid = await runOnchainOs([
    "payment",
    "pay",
    "--payment-id",
    paymentId,
    "--selected-index",
    selectedIndex,
    "--yes",
  ]);
  const data = paid.data || {};
  if (data.status !== "success") throw new Error(`Payment request did not succeed: ${JSON.stringify(data.error || data.status)}`);
  const delivery = extractMerchantDelivery(data) as Delivery;
  const transactionHash = settlementTransaction(data);
  const promise = delivery.servicePromise.payload;
  const settlement = await verifyOnchainSettlement({
    rpcUrl: process.env.XLAYER_TESTNET_RPC_URL || "https://testrpc.xlayer.tech/terigon",
    transactionHash,
    token: (process.env.USDT0_ADDRESS || "0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c") as `0x${string}`,
    payer: delivery.request.buyer,
    payTo: (process.env.X402_PAY_TO || "0x917b04d30478E9405445CfF208eaA9d61e2EC44d") as `0x${string}`,
    amountAtomic: promise.priceAtomic,
  });
  const verification = await verifyDelivery({
    promise: delivery.servicePromise,
    request: delivery.request,
    response: delivery.result,
    receipt: delivery.deliveryReceipt,
    checkedAt: Math.max(Math.floor(Date.now() / 1000), delivery.deliveryReceipt.payload.deliveredAt),
  });
  if (verification.status !== expectedStatus) {
    throw new Error(`Expected ${expectedStatus}, received ${verification.status}: ${verification.violations.join(", ")}`);
  }

  const unsignedEvidence = {
    evidenceVersion: "1",
    mode: "OKX_AGENTIC_WALLET_XLAYER_TESTNET",
    capturedAt: new Date().toISOString(),
    payment: {
      status: data.status,
      transactionHash: settlement.transactionHash,
      facilitatorReceipt: data.decodedReceipt,
      onchainSettlement: settlement,
    },
    delivery,
    verification,
  };
  const evidence = {
    ...unsignedEvidence,
    evidenceHash: hashCanonical(unsignedEvidence),
    portableIntegrity: { algorithm: "SHA-256", hash: sha256Canonical(unsignedEvidence) },
  };
  await mkdir("evidence/live", { recursive: true });
  const evidencePath = verification.status === "ACCEPTED"
    ? "evidence/live/agentic-wallet-paid-delivery.json"
    : "evidence/live/agentic-wallet-paid-breach.json";
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ status: verification.status, transactionHash: settlement.transactionHash, evidence: evidencePath, evidenceHash: evidence.evidenceHash }, null, 2));
  process.exit(0);
}

console.log(`Preferred OKX Agentic Wallet runner

1. Quote only (never signs):
   npm run buyer:okx -- quote --symbol BTC-USDT --scenario accepted

2. After reviewing and explicitly approving the displayed terms:
   npm run buyer:okx -- pay --payment-id <id> --selected-index <n> --expect accepted --yes

The second command delegates signing, replay and settlement to the logged-in OnchainOS TEE wallet, then independently verifies the provider-signed RelayBond delivery.`);
