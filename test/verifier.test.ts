import assert from "node:assert/strict";
import test from "node:test";
import { createJudgeEvidence } from "../src/simulator.js";

test("valid signed delivery is accepted", async () => {
  const evidence = await createJudgeEvidence();
  const scenario = evidence.scenarios.find((item) => item.name === "good-delivery");
  assert.equal(scenario?.verification.status, "ACCEPTED");
  assert.deepEqual(scenario?.verification.violations, []);
  assert.equal(scenario?.settlement.state, "NOT_REQUIRED");
});

test("empty paid response breaches schema and record promise", async () => {
  const evidence = await createJudgeEvidence();
  const scenario = evidence.scenarios.find((item) => item.name === "empty-paid-response");
  assert.equal(scenario?.verification.status, "BREACH");
  assert.ok(scenario?.verification.violations.includes("schemaMet"));
  assert.ok(scenario?.verification.violations.includes("recordCountMet"));
  assert.equal(scenario?.settlement.state, "REBATED");
});

test("stale quote breaches freshness promise", async () => {
  const evidence = await createJudgeEvidence();
  const scenario = evidence.scenarios.find((item) => item.name === "stale-quote");
  assert.equal(scenario?.verification.status, "BREACH");
  assert.ok(scenario?.verification.violations.includes("freshnessMet"));
});

test("two objective breaches reduce provider bond by two rebates", async () => {
  const evidence = await createJudgeEvidence();
  assert.equal(evidence.scenarios.at(-1)?.settlement.bondAfterAtomic, "4980000");
});
