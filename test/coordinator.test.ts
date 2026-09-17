import assert from "node:assert/strict";
import test from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import { hashCanonical } from "../src/canonical.js";
import { ContinuityCoordinator, type ProviderExecution, type ProviderExecutor } from "../src/coordinator.js";
import { recoverContinuitySigner, recoverRecoveryAttestationSigner, signPromise, signReceipt, hashPromise } from "../src/signing.js";
import { MemoryContinuityTaskStore } from "../src/task-store.js";
import type { BondedProviderProfile, ServicePromise } from "../src/types.js";

const primaryAccount = privateKeyToAccount(`0x${"11".repeat(32)}`);
const backupAccount = privateKeyToAccount(`0x${"22".repeat(32)}`);
const verifier = privateKeyToAccount(`0x${"44".repeat(32)}`);
const buyer = privateKeyToAccount(`0x${"33".repeat(32)}`);
const vault = "0x2222222222222222222222222222222222220295" as const;
const chainId = 1952;
const baseTime = 1_789_603_200;

const providers: BondedProviderProfile[] = [
  {
    providerId: "primary",
    name: "Atlas",
    serviceId: "market-primary-official",
    endpoint: "https://primary.example/quote",
    provider: primaryAccount.address,
    mode: "TESTNET",
    active: true,
    priceAtomic: "10000",
    bondAtomic: "5000000",
    minimumBondAtomic: "1000000",
    maximumLatencyMs: 1_500,
    maximumDataAgeSeconds: 20,
    supportedSchemas: ["market-quote-v1"],
    reliability: { verifiedCalls: 20, acceptedCalls: 19, recoveredCalls: 0 },
  },
  {
    providerId: "backup",
    name: "Harbor",
    serviceId: "market-backup-official",
    endpoint: "https://backup.example/quote",
    provider: backupAccount.address,
    mode: "TESTNET",
    active: true,
    priceAtomic: "10000",
    bondAtomic: "3000000",
    minimumBondAtomic: "1000000",
    maximumLatencyMs: 1_800,
    maximumDataAgeSeconds: 25,
    supportedSchemas: ["market-quote-v1"],
    reliability: { verifiedCalls: 20, acceptedCalls: 18, recoveredCalls: 4 },
  },
];

class DeterministicExecutor implements ProviderExecutor {
  calls: ProviderExecution[] = [];

  constructor(private readonly outcomes: Record<string, "accepted" | "stale">) {}

  async execute(input: ProviderExecution) {
    this.calls.push(input);
    const account = input.provider.providerId === "primary" ? primaryAccount : backupAccount;
    const deliveredAt = input.request.requestedAt + 1;
    const promise: ServicePromise = {
      version: "1",
      chainId,
      vault,
      serviceId: input.provider.serviceId,
      endpoint: input.provider.endpoint,
      responseTimeMs: input.provider.maximumLatencyMs,
      maxDataAgeSeconds: input.provider.maximumDataAgeSeconds,
      requiredSchema: "market-quote-v1",
      minimumRecords: 1,
      priceAtomic: input.provider.priceAtomic,
      bondAmountAtomic: input.provider.bondAtomic,
      rebateAtomic: input.provider.priceAtomic,
      refundOnBreach: true,
      validUntil: baseTime + 86_400,
      provider: input.provider.provider,
    };
    const response = {
      symbol: "BTC-USDT",
      price: input.provider.providerId === "primary" ? 62_450.25 : 62_451.1,
      observedAt: this.outcomes[input.provider.providerId] === "stale" ? deliveredAt - 120 : deliveredAt,
    };
    const receipt = {
      version: "1" as const,
      serviceId: promise.serviceId,
      requestHash: hashCanonical(input.request),
      responseHash: hashCanonical(response),
      paymentId: hashCanonical({ taskId: input.taskId, source: input.paymentSource }),
      deliveredAt,
      servicePromiseHash: await hashPromise(promise),
      provider: account.address,
    };
    return {
      request: input.request,
      response,
      servicePromise: await signPromise(account, promise),
      deliveryReceipt: await signReceipt(account, promise, receipt),
    };
  }
}

function coordinator(outcomes: Record<string, "accepted" | "stale">) {
  let clock = baseTime;
  const store = new MemoryContinuityTaskStore();
  const executor = new DeterministicExecutor(outcomes);
  return {
    store,
    executor,
    coordinator: new ContinuityCoordinator({
      chainId,
      vault,
      verifier,
      providers,
      executor,
      store,
      now: () => ++clock,
    }),
  };
}

const requirement = { schema: "market-quote-v1" as const, maximumPriceAtomic: "10000", maximumLatencyMs: 2_000 };

test("accepts a valid primary delivery without invoking the backup", async () => {
  const fixture = coordinator({ primary: "accepted", backup: "accepted" });
  const result = await fixture.coordinator.execute({ buyer: buyer.address, requestInput: { symbol: "BTC-USDT" }, requirement, requestedAt: baseTime });
  assert.equal(result.task.state, "ACCEPTED");
  assert.equal(result.backup, undefined);
  assert.equal(result.recoveryAttestation, undefined);
  assert.equal(fixture.executor.calls.length, 1);
  assert.deepEqual(result.task.events.map((event) => event.state), ["QUEUED", "PRIMARY_SELECTED", "ACCEPTED"]);
});

test("recovers a primary breach and produces a contract-compatible verifier attestation", async () => {
  const fixture = coordinator({ primary: "stale", backup: "accepted" });
  const result = await fixture.coordinator.execute({ buyer: buyer.address, requestInput: { symbol: "BTC-USDT" }, requirement, requestedAt: baseTime });
  assert.equal(result.task.state, "RECOVERED");
  assert.equal(result.primary.verification.status, "BREACH");
  assert.equal(result.backup?.verification.status, "ACCEPTED");
  assert.equal(fixture.executor.calls[0]?.paymentSource, "BUYER");
  assert.equal(fixture.executor.calls[1]?.paymentSource, "PRIMARY_BOND");
  assert.ok(result.continuityReceipt);
  assert.ok(result.recoveryAttestation);
  const continuitySigner = await recoverContinuitySigner({ chainId, vault }, result.continuityReceipt);
  const recoverySigner = await recoverRecoveryAttestationSigner({ chainId, vault }, result.recoveryAttestation);
  assert.equal(continuitySigner.toLowerCase(), verifier.address.toLowerCase());
  assert.equal(recoverySigner.toLowerCase(), verifier.address.toLowerCase());
  assert.equal(result.recoveryAttestation.payload.buyer, buyer.address);
  assert.equal(result.recoveryAttestation.payload.recoveryAmount, "10000");
  assert.deepEqual(result.task.events.map((event) => event.state), [
    "QUEUED",
    "PRIMARY_SELECTED",
    "PRIMARY_BREACH",
    "BACKUP_SELECTED",
    "RECOVERED",
  ]);
});

test("freezes the task when both independent providers breach", async () => {
  const fixture = coordinator({ primary: "stale", backup: "stale" });
  const result = await fixture.coordinator.execute({ buyer: buyer.address, requestInput: { symbol: "BTC-USDT" }, requirement, requestedAt: baseTime });
  assert.equal(result.task.state, "FROZEN");
  assert.equal(result.backup?.verification.status, "BREACH");
  assert.equal(result.continuityReceipt, undefined);
  assert.equal(result.recoveryAttestation, undefined);
  assert.match(result.task.events.at(-1)?.description ?? "", /Backup delivery also breached/);
});
