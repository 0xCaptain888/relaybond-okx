import assert from "node:assert/strict";
import test from "node:test";
import { buildBreachClaim } from "../src/breach-claim.js";
import { createJudgeEvidence } from "../src/simulator.js";

test("builds a replay-safe rebate claim only from paid attributable breach evidence", async () => {
  const judge = await createJudgeEvidence();
  const scenario = judge.scenarios.find((item) => item.name === "empty-paid-response")!;
  const claim = await buildBreachClaim({
    payment: { status: "success", transactionHash: `0x${"11".repeat(32)}`, receipt: { status: "success" } },
    delivery: {
      request: scenario.request,
      result: scenario.response,
      servicePromise: judge.servicePromise,
      deliveryReceipt: scenario.deliveryReceipt,
    },
    verification: scenario.verification,
  });
  assert.equal(claim.buyer, judge.buyer);
  assert.equal(claim.rebateAmount, 10_000n);
  assert.equal(claim.requestHash, scenario.deliveryReceipt.payload.requestHash);
});

test("refuses a rebate when provider attribution is broken", async () => {
  const judge = await createJudgeEvidence();
  const scenario = judge.scenarios.find((item) => item.name === "empty-paid-response")!;
  await assert.rejects(() => buildBreachClaim({
    payment: { status: "success", transactionHash: `0x${"11".repeat(32)}`, receipt: { status: "success" } },
    delivery: {
      request: scenario.request,
      result: scenario.response,
      servicePromise: judge.servicePromise,
      deliveryReceipt: scenario.deliveryReceipt,
    },
    verification: { ...scenario.verification, checks: { ...scenario.verification.checks, receiptSignature: false } },
  }), /attribution/);
});
