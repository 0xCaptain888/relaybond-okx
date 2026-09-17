import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import { ContinuityCoordinator } from "../src/coordinator.js";
import { HttpProviderExecutor } from "../src/http-provider-executor.js";
import { createProviderService } from "../src/provider-service.js";
import { MemoryContinuityTaskStore } from "../src/task-store.js";
import type { BondedProviderProfile } from "../src/types.js";

const primaryAccount = privateKeyToAccount(`0x${"81".repeat(32)}`);
const backupAccount = privateKeyToAccount(`0x${"82".repeat(32)}`);
const verifier = privateKeyToAccount(`0x${"83".repeat(32)}`);
const buyer = privateKeyToAccount(`0x${"84".repeat(32)}`);
const vault = "0x4444444444444444444444444444444444440404" as const;
const baseTime = 1_789_603_200;

async function bind(appFactory: (endpoint: string) => ReturnType<typeof createProviderService>) {
  let handler: ReturnType<typeof createProviderService> | undefined;
  const server = createServer((request, response) => handler!(request, response));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to bind provider server.");
  const endpoint = `http://127.0.0.1:${address.port}/deliver`;
  handler = appFactory(endpoint);
  return { server, endpoint };
}

function close(server: Server) {
  return new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function profile(input: { providerId: string; serviceId: string; endpoint: string; provider: `0x${string}`; reliability: number }): BondedProviderProfile {
  return {
    providerId: input.providerId,
    name: input.providerId,
    serviceId: input.serviceId,
    endpoint: input.endpoint,
    provider: input.provider,
    mode: "LOCAL",
    active: true,
    priceAtomic: "10000",
    bondAtomic: input.providerId === "primary" ? "5000000" : "3000000",
    minimumBondAtomic: "1000000",
    maximumLatencyMs: 2_000,
    maximumDataAgeSeconds: 30,
    supportedSchemas: ["market-quote-v1"],
    reliability: { verifiedCalls: 20, acceptedCalls: input.reliability, recoveredCalls: input.providerId === "backup" ? 3 : 0 },
  };
}

test("recovers through two independent HTTP provider processes and keeps the buyer payment singular", {
  skip: process.env.RELAYBOND_SOCKET_TEST !== "true" ? "Run npm run test:integration:http to allow loopback sockets." : false,
}, async () => {
  let primaryProfile!: BondedProviderProfile;
  let backupProfile!: BondedProviderProfile;
  const primaryServer = await bind((endpoint) => {
    primaryProfile = profile({ providerId: "primary", serviceId: "http-primary-v1", endpoint, provider: primaryAccount.address, reliability: 20 });
    return createProviderService({ profile: primaryProfile, account: primaryAccount, chainId: 1952, vault, scenario: "stale", now: () => baseTime + 1 });
  });
  const backupServer = await bind((endpoint) => {
    backupProfile = profile({ providerId: "backup", serviceId: "http-backup-v1", endpoint, provider: backupAccount.address, reliability: 18 });
    return createProviderService({ profile: backupProfile, account: backupAccount, chainId: 1952, vault, scenario: "accepted", now: () => baseTime + 5 });
  });
  try {
    const providers = [primaryProfile, backupProfile];
    let clock = baseTime;
    const coordinator = new ContinuityCoordinator({
      chainId: 1952,
      vault,
      verifier,
      providers,
      executor: new HttpProviderExecutor({ providers, timeoutMs: 2_000 }),
      store: new MemoryContinuityTaskStore(),
      now: () => ++clock,
    });
    const result = await coordinator.execute({
      buyer: buyer.address,
      requestInput: { symbol: "BTC-USDT", transport: "HTTP" },
      requirement: { schema: "market-quote-v1", maximumPriceAtomic: "10000", maximumLatencyMs: 2_000 },
      requestedAt: baseTime,
    });
    assert.equal(result.primary.verification.status, "BREACH");
    assert.equal(result.backup?.verification.status, "ACCEPTED");
    assert.equal(result.task.state, "RECOVERED");
    assert.equal(result.continuityReceipt?.payload.buyerPaidAtomic, "10000");
    assert.equal(result.continuityReceipt?.payload.recoveryPaidFromBondAtomic, "10000");
    assert.notEqual(result.continuityReceipt?.payload.primaryProvider, result.continuityReceipt?.payload.backupProvider);
  } finally {
    await Promise.all([close(primaryServer.server), close(backupServer.server)]);
  }
});
