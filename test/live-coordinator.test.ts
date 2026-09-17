import assert from "node:assert/strict";
import test from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import type { ProviderDelivery } from "../src/coordinator.js";
import { assertLiveProviderProfiles, validatePaidPrimaryBinding } from "../src/live-coordinator.js";
import type { BondedProviderProfile } from "../src/types.js";

const primaryAccount = privateKeyToAccount(`0x${"91".repeat(32)}`);
const backupAccount = privateKeyToAccount(`0x${"92".repeat(32)}`);
const buyer = privateKeyToAccount(`0x${"93".repeat(32)}`);

function profile(providerId: string, provider: `0x${string}`, mode: "TESTNET" | "LOCAL"): BondedProviderProfile {
  return {
    providerId,
    name: providerId,
    serviceId: `${providerId}-service`,
    endpoint: mode === "LOCAL" ? `http://127.0.0.1/${providerId}` : `https://${providerId}.example/deliver`,
    provider,
    mode,
    active: true,
    priceAtomic: "10000",
    bondAtomic: "3000000",
    minimumBondAtomic: "3000000",
    maximumLatencyMs: 2_000,
    maximumDataAgeSeconds: 30,
    supportedSchemas: ["market-quote-v1"],
    reliability: { verifiedCalls: 10, acceptedCalls: 9, recoveredCalls: 1 },
  };
}

test("LIVE coordinator rejects LOCAL provider profiles", () => {
  assert.throws(() => assertLiveProviderProfiles([
    profile("primary", primaryAccount.address, "TESTNET"),
    profile("backup", backupAccount.address, "LOCAL"),
  ]), /rejects non-live Provider modes/);
});

test("paid primary binding requires exact buyer, provider, service and price", () => {
  const primary = profile("primary", primaryAccount.address, "TESTNET");
  const delivery = {
    request: { serviceId: primary.serviceId, requestedAt: 1, input: { symbol: "BTC-USDT" }, buyer: buyer.address },
    response: {},
    servicePromise: { payload: {} as never, signature: "0x01" as const },
    deliveryReceipt: { payload: { deliveredAt: 2 } as never, signature: "0x01" as const },
  } satisfies ProviderDelivery;
  assert.doesNotThrow(() => validatePaidPrimaryBinding({
    primary,
    delivery,
    settlement: {
      status: "success",
      transactionHash: `0x${"11".repeat(32)}`,
      blockNumber: "1",
      token: "0x0000000000000000000000000000000000000001",
      payer: buyer.address,
      payTo: primary.provider,
      amountAtomic: primary.priceAtomic,
    },
  }));
  assert.throws(() => validatePaidPrimaryBinding({
    primary,
    delivery,
    settlement: {
      status: "success",
      transactionHash: `0x${"11".repeat(32)}`,
      blockNumber: "1",
      token: "0x0000000000000000000000000000000000000001",
      payer: buyer.address,
      payTo: backupAccount.address,
      amountAtomic: primary.priceAtomic,
    },
  }), /recipient/);
});
