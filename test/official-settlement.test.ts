import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { applyOfficialSettlementProviderState, officialV2Settlement } from "../src/official-settlement.js";

test("published V2 settlement summary matches the machine-readable final evidence", async () => {
  const evidence = JSON.parse(await readFile("evidence/official-build/v2-live-settlement.json", "utf8"));
  assert.equal(officialV2Settlement.status, "SETTLED_AND_VERIFIED");
  assert.equal(officialV2Settlement.transactionHash, evidence.transactionHash);
  assert.equal(officialV2Settlement.blockNumber, evidence.blockNumber);
  assert.deepEqual(officialV2Settlement.balancesBefore, evidence.balancesBefore);
  assert.deepEqual(officialV2Settlement.balancesAfter, evidence.balancesAfter);
  assert.deepEqual(officialV2Settlement.checks, evidence.settlementChecks);
  assert.equal(Object.values(officialV2Settlement.checks).length, 7);
  assert.equal(Object.values(officialV2Settlement.checks).every(Boolean), true);
  assert.equal(BigInt(officialV2Settlement.balancesAfter.buyerAtomic), BigInt(officialV2Settlement.balancesBefore.buyerAtomic));
  assert.equal(
    BigInt(officialV2Settlement.balancesAfter.backupAtomic) - BigInt(officialV2Settlement.balancesBefore.backupAtomic),
    BigInt(officialV2Settlement.recoveryAmountAtomic),
  );
  assert.equal(
    BigInt(officialV2Settlement.balancesBefore.primaryBondAtomic) - BigInt(officialV2Settlement.balancesAfter.primaryBondAtomic),
    BigInt(officialV2Settlement.recoveryAmountAtomic),
  );
});

test("official provider registry reflects the Primary auto-pause after settlement", () => {
  const providers = applyOfficialSettlementProviderState([
    { provider: officialV2Settlement.primaryProvider, bondAtomic: "5000000", active: true, id: "primary" },
    { provider: officialV2Settlement.backupProvider, bondAtomic: "3000000", active: true, id: "backup" },
  ]);
  assert.deepEqual(providers[0], {
    provider: officialV2Settlement.primaryProvider,
    bondAtomic: "4990000",
    active: false,
    id: "primary",
  });
  assert.equal(providers[1].active, true);
  assert.equal(providers[1].bondAtomic, "3000000");
});
