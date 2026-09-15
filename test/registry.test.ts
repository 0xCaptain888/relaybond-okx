import assert from "node:assert/strict";
import test from "node:test";
import type { BondedProviderProfile } from "../src/types.js";
import { rankBondedProviders, selectPrimaryAndBackup } from "../src/registry.js";

const base: BondedProviderProfile = {
  providerId: "primary",
  name: "Primary",
  serviceId: "market-primary",
  endpoint: "https://example.com/primary",
  provider: "0x1111111111111111111111111111111111111111",
  mode: "TESTNET",
  active: true,
  priceAtomic: "10000",
  bondAtomic: "5000000",
  minimumBondAtomic: "1000000",
  maximumLatencyMs: 1_000,
  maximumDataAgeSeconds: 30,
  supportedSchemas: ["market-quote-v1"],
  reliability: { verifiedCalls: 10, acceptedCalls: 10, recoveredCalls: 1 },
};

test("ranks only active bonded providers that satisfy the task policy", () => {
  const backup = { ...base, providerId: "backup", name: "Backup", provider: "0x2222222222222222222222222222222222222222" as const, reliability: { verifiedCalls: 10, acceptedCalls: 9, recoveredCalls: 3 } };
  const inactive = { ...base, providerId: "inactive", name: "Inactive", provider: "0x3333333333333333333333333333333333333333" as const, active: false };
  const ranked = rankBondedProviders([inactive, backup, base], { schema: "market-quote-v1", maximumPriceAtomic: "10000", maximumLatencyMs: 2_000 });
  assert.equal(ranked[0].providerId, "primary");
  assert.equal(ranked.at(-1)?.eligible, false);
  const selection = selectPrimaryAndBackup([inactive, backup, base], { schema: "market-quote-v1", maximumPriceAtomic: "10000", maximumLatencyMs: 2_000 });
  assert.equal(selection.primary.providerId, "primary");
  assert.equal(selection.backup.providerId, "backup");
});
