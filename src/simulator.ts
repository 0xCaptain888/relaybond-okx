import { privateKeyToAccount } from "viem/accounts";
import { hashCanonical, sha256Canonical } from "./canonical.js";
import { hashPromise, signPromise, signReceipt } from "./signing.js";
import type { JudgeEvidence, ServicePromise, ServiceRequest } from "./types.js";
import { verifyDelivery } from "./verifier.js";

const PROVIDER_KEY = "0x59c6995e998f97a5a0044976f7d3cf6e5a981f9b2d5b44b8f8790f442568b95d";
const BUYER_KEY = "0x8b3a350cf5c34c9194ca3a545d2af2e09b8c8f3e32f3d7b8f8c7f8f0d1e2a3b4";
const VERIFIER_KEY = "0x0f4b09f194c494c0b7a9d64b06a85f58f4f13bc43edbdcad9b55ed5084fae2c1";

export async function createJudgeEvidence(): Promise<JudgeEvidence> {
  const provider = privateKeyToAccount(PROVIDER_KEY);
  const buyer = privateKeyToAccount(BUYER_KEY);
  const verifier = privateKeyToAccount(VERIFIER_KEY);
  const baseTime = 1_789_430_400;
  const promise: ServicePromise = {
    version: "1",
    chainId: 1952,
    vault: "0x1111111111111111111111111111111111110195",
    serviceId: "market-data-v1",
    endpoint: "https://relaybond.example/v1/provider/quote",
    responseTimeMs: 2_000,
    maxDataAgeSeconds: 30,
    requiredSchema: "market-quote-v1",
    minimumRecords: 1,
    priceAtomic: "10000",
    bondAmountAtomic: "5000000",
    rebateAtomic: "10000",
    refundOnBreach: true,
    validUntil: baseTime + 86_400,
    provider: provider.address,
  };
  const signedPromise = await signPromise(provider, promise);
  const promiseHash = await hashPromise(promise);

  const inputs = [
    {
      name: "good-delivery",
      request: {
        serviceId: promise.serviceId,
        requestedAt: baseTime,
        input: { symbol: "BTC-USDT" },
        buyer: buyer.address,
      } satisfies ServiceRequest,
      response: { symbol: "BTC-USDT", price: 62_450.25, observedAt: baseTime },
      deliveredAt: baseTime + 1,
    },
    {
      name: "empty-paid-response",
      request: {
        serviceId: promise.serviceId,
        requestedAt: baseTime + 10,
        input: { symbol: "ETH-USDT" },
        buyer: buyer.address,
      } satisfies ServiceRequest,
      response: {},
      deliveredAt: baseTime + 11,
    },
    {
      name: "stale-quote",
      request: {
        serviceId: promise.serviceId,
        requestedAt: baseTime + 20,
        input: { symbol: "OKB-USDT" },
        buyer: buyer.address,
      } satisfies ServiceRequest,
      response: { symbol: "OKB-USDT", price: 190.5, observedAt: baseTime - 300 },
      deliveredAt: baseTime + 21,
    },
  ];

  let bond = 5_000_000n;
  const scenarios: JudgeEvidence["scenarios"] = [];
  for (let index = 0; index < inputs.length; index += 1) {
    const scenario = inputs[index];
    const receipt = {
      version: "1" as const,
      serviceId: promise.serviceId,
      requestHash: hashCanonical(scenario.request),
      responseHash: hashCanonical(scenario.response),
      paymentId: hashCanonical({ scenario: scenario.name, payment: "x402-exact", index }),
      deliveredAt: scenario.deliveredAt,
      servicePromiseHash: promiseHash,
      provider: provider.address,
    };
    const signedReceipt = await signReceipt(provider, promise, receipt);
    const verification = await verifyDelivery({
      promise: signedPromise,
      request: scenario.request,
      response: scenario.response,
      receipt: signedReceipt,
      checkedAt: scenario.deliveredAt,
    });
    const bondBefore = bond;
    const rebate = verification.status === "BREACH" ? BigInt(promise.rebateAtomic) : 0n;
    bond -= rebate;
    scenarios.push({
      name: scenario.name,
      request: scenario.request,
      response: scenario.response,
      deliveryReceipt: signedReceipt,
      verification,
      settlement: {
        state: rebate > 0n ? "REBATED" : "NOT_REQUIRED",
        rebateAtomic: rebate.toString(),
        bondBeforeAtomic: bondBefore.toString(),
        bondAfterAtomic: bond.toString(),
      },
    });
  }

  const unsigned = {
    evidenceVersion: "1" as const,
    mode: "DETERMINISTIC_LOCAL_SIMULATION" as const,
    generatedAt: new Date(baseTime * 1000).toISOString(),
    provider: provider.address,
    buyer: buyer.address,
    verifier: verifier.address,
    servicePromise: signedPromise,
    scenarios,
  };
  const evidenceHash = hashCanonical(unsigned);
  return {
    ...unsigned,
    evidenceHash,
    portableIntegrity: {
      algorithm: "SHA-256",
      hash: sha256Canonical({ ...unsigned, evidenceHash }),
    },
  };
}
