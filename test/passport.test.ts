import assert from "node:assert/strict";
import test from "node:test";
import { createJudgeEvidence } from "../src/simulator.js";
import { buildLiveReliabilityPassport, buildReliabilityPassport } from "../src/passport.js";

test("reliability passport derives coverage and breach reasons from evidence", async () => {
  const passport = buildReliabilityPassport(await createJudgeEvidence());
  assert.equal(passport.calls, 3);
  assert.equal(passport.acceptedCalls, 1);
  assert.equal(passport.breachedCalls, 2);
  assert.equal(passport.acceptanceRateBps, 3333);
  assert.equal(passport.bondCoverageCalls, 498);
  assert.equal(passport.breachReasons.freshnessMet, 2);
  assert.match(passport.passportHash, /^0x[0-9a-f]{64}$/);
});

test("live reliability passport separates verified testnet history from the breach lab", () => {
  const passport = buildLiveReliabilityPassport({
    serviceId: "market-data-v1",
    provider: "0x917b04d30478E9405445CfF208eaA9d61e2EC44d",
    bondBalanceAtomic: "4990000",
    rebateAtomic: "10000",
    currentServiceActive: false,
    deliveries: [
      {
        status: "ACCEPTED",
        paidAtomic: "10000",
        evidenceHash: "0x39a67bcde940b07e429aee35fbef6fe260dcc2e0aecae6e3013f124cfa57dde8",
        settlementTx: "0xfd1e25e2415a79eff8e8d981d9e5f97efe8f9136ce026b1cf1e5ac872c8ee4bf",
        violations: [],
      },
      {
        status: "BREACH",
        paidAtomic: "10000",
        evidenceHash: "0x49288a96c20698ea0efd44f7134a87edcd774d31c98aa110506b31ea17b82cb5",
        settlementTx: "0x53b813b9a86849bd7480b07eafab9bd17c01bea2c2b386a0a121baf6b70e449a",
        violations: ["freshnessMet"],
      },
    ],
    rebatedAtomic: "10000",
    rebateTx: "0x21c3e459c868efdb35da90b2976a73738347e90a38a591cff49e219101b7c03f",
    generatedAt: "2026-09-15T12:54:40.224Z",
  });
  assert.equal(passport.scope, "VERIFIED_XLAYER_TESTNET_DELIVERIES");
  assert.equal(passport.calls, 2);
  assert.equal(passport.acceptedCalls, 1);
  assert.equal(passport.breachedCalls, 1);
  assert.equal(passport.acceptanceRateBps, 5_000);
  assert.equal(passport.bondCoverageCalls, 499);
  assert.equal(passport.totalPaidAtomic, "20000");
  assert.equal(passport.totalRebatedAtomic, "10000");
  assert.equal(passport.breachReasons.freshnessMet, 1);
  assert.equal(passport.currentServiceActive, false);
  assert.match(passport.passportHash, /^0x[0-9a-f]{64}$/);
});
