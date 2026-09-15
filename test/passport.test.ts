import assert from "node:assert/strict";
import test from "node:test";
import { createJudgeEvidence } from "../src/simulator.js";
import { buildReliabilityPassport } from "../src/passport.js";

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
