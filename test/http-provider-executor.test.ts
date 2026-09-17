import assert from "node:assert/strict";
import test from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import { hashCanonical } from "../src/canonical.js";
import { HttpProviderExecutor, ProviderPaymentRequiredError, ProviderTransportError } from "../src/http-provider-executor.js";
import { hashPromise, signPromise, signReceipt } from "../src/signing.js";
import type { BondedProviderProfile, ServicePromise, ServiceRequest } from "../src/types.js";

const account = privateKeyToAccount(`0x${"73".repeat(32)}`);
const buyer = privateKeyToAccount(`0x${"74".repeat(32)}`);
const taskId = `0x${"75".repeat(32)}` as const;
const vault = "0x4444444444444444444444444444444444440404" as const;
const profile: BondedProviderProfile = {
  providerId: "http-primary",
  name: "HTTP Primary",
  serviceId: "http-market-v1",
  endpoint: "https://provider.example/deliver",
  provider: account.address,
  mode: "TESTNET",
  active: true,
  priceAtomic: "10000",
  bondAtomic: "1000000",
  minimumBondAtomic: "500000",
  maximumLatencyMs: 2_000,
  maximumDataAgeSeconds: 30,
  supportedSchemas: ["market-quote-v1"],
  reliability: { verifiedCalls: 10, acceptedCalls: 9, recoveredCalls: 0 },
};
const request: ServiceRequest = {
  serviceId: profile.serviceId,
  requestedAt: 1_789_603_200,
  input: { symbol: "BTC-USDT" },
  buyer: buyer.address,
};

async function signedDelivery() {
  const promise: ServicePromise = {
    version: "1",
    chainId: 1952,
    vault,
    serviceId: profile.serviceId,
    endpoint: profile.endpoint,
    responseTimeMs: profile.maximumLatencyMs,
    maxDataAgeSeconds: profile.maximumDataAgeSeconds,
    requiredSchema: "market-quote-v1",
    minimumRecords: 1,
    priceAtomic: profile.priceAtomic,
    bondAmountAtomic: profile.bondAtomic,
    rebateAtomic: profile.priceAtomic,
    refundOnBreach: true,
    validUntil: request.requestedAt + 3_600,
    provider: account.address,
  };
  const response = { symbol: "BTC-USDT", price: 62_500, observedAt: request.requestedAt + 1 };
  const receipt = {
    version: "1" as const,
    serviceId: promise.serviceId,
    requestHash: hashCanonical(request),
    responseHash: hashCanonical(response),
    paymentId: hashCanonical({ taskId }),
    deliveredAt: request.requestedAt + 1,
    servicePromiseHash: await hashPromise(promise),
    provider: account.address,
  };
  return {
    request,
    response,
    servicePromise: await signPromise(account, promise),
    deliveryReceipt: await signReceipt(account, promise, receipt),
  };
}

test("posts the exact coordinator task and returns a signed provider delivery", async () => {
  const expected = await signedDelivery();
  let observedBody: unknown;
  let observedAuthorization: string | null = null;
  const fetchFn = (async (_url: string | URL | Request, init?: RequestInit) => {
    observedBody = JSON.parse(String(init?.body));
    observedAuthorization = new Headers(init?.headers).get("x-relaybond-backup-authorization");
    return Response.json(expected);
  }) as typeof fetch;
  const executor = new HttpProviderExecutor({
    providers: [profile],
    fetchFn,
    authorizationHeaders: { [profile.providerId]: { "x-relaybond-backup-authorization": "test-only-token" } },
  });
  const actual = await executor.execute({ provider: { ...profile, score: 1, bondCoverageCalls: 100, acceptanceRateBps: 9_000, eligible: true, reasons: [] }, taskId, request, paymentSource: "BUYER" });
  assert.deepEqual(actual, expected);
  assert.deepEqual(observedBody, { taskId, request, paymentSource: "BUYER" });
  assert.equal(observedAuthorization, "test-only-token");
});

test("rejects authorization headers that override coordinator bindings", () => {
  assert.throws(() => new HttpProviderExecutor({
    providers: [profile],
    authorizationHeaders: { [profile.providerId]: { "x-relaybond-task-id": "substituted" } },
  }), /cannot override reserved header/);
});

test("stops at a provider payment boundary instead of signing or replaying", async () => {
  const fetchFn = (async () => new Response(JSON.stringify({ error: "payment required" }), {
    status: 402,
    headers: { "payment-required": "challenge" },
  })) as typeof fetch;
  const executor = new HttpProviderExecutor({ providers: [profile], fetchFn });
  await assert.rejects(
    executor.execute({ provider: { ...profile, score: 1, bondCoverageCalls: 100, acceptanceRateBps: 9_000, eligible: true, reasons: [] }, taskId, request, paymentSource: "PRIMARY_BOND" }),
    (error: unknown) => error instanceof ProviderPaymentRequiredError && error.paymentRequired === "challenge",
  );
});

test("rejects runtime endpoint substitution before making a request", async () => {
  let called = false;
  const fetchFn = (async () => {
    called = true;
    return Response.json({});
  }) as typeof fetch;
  const executor = new HttpProviderExecutor({ providers: [profile], fetchFn });
  await assert.rejects(
    executor.execute({ provider: { ...profile, endpoint: "https://attacker.example/deliver", score: 1, bondCoverageCalls: 100, acceptanceRateBps: 9_000, eligible: true, reasons: [] }, taskId, request, paymentSource: "BUYER" }),
    (error: unknown) => error instanceof ProviderTransportError && /audited configuration/.test(error.message),
  );
  assert.equal(called, false);
});
