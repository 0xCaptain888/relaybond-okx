import assert from "node:assert/strict";
import test from "node:test";
import { buildPaymentReplayArguments, extractMerchantDelivery, paidEvidencePath, requireFinalSettlement, safeEvidenceOutputPath } from "../src/onchainos-buyer.js";
import { settlementTransaction } from "../src/settlement.js";

test("OnchainOS result extraction rejects a missing merchant delivery", () => {
  assert.throws(() => extractMerchantDelivery({ result: "not-an-object" }), /does not contain/);
});

test("OnchainOS result extraction accepts a structured merchant response", () => {
  const delivery = { request: {}, result: {}, servicePromise: {}, deliveryReceipt: {} };
  assert.equal(extractMerchantDelivery({ result: delivery }), delivery);
});

test("requires an independently decoded final-success settlement receipt", () => {
  const transaction = `0x${"11".repeat(32)}`;
  assert.deepEqual(requireFinalSettlement({
    status: "success",
    txHash: transaction,
    decodedReceipt: { status: "success", transaction },
  }), {
    transactionHash: transaction,
    receipt: { status: "success", transaction },
  });
});

test("rejects a merchant response when the later settlement failed", () => {
  assert.throws(() => requireFinalSettlement({
    status: "success",
    txHash: `0x${"22".repeat(32)}`,
    decodedReceipt: { status: "failed", errorReason: "on_chain_failed" },
  }), /not final-success/);
});

test("continues a pending facilitator response using its onchain transaction", () => {
  const transaction = `0x${"33".repeat(32)}`;
  assert.equal(settlementTransaction({
    status: "success",
    decodedReceipt: { status: "pending", transaction },
  }), transaction);
});

test("paid replay carries the exact reviewed business parameters", () => {
  assert.deepEqual(buildPaymentReplayArguments({
    paymentId: "pay_test",
    selectedIndex: "0",
    symbol: "BTC-USDT",
    scenario: "stale",
  }), [
    "payment", "pay", "--payment-id", "pay_test", "--selected-index", "0",
    "--param", "symbol=BTC-USDT", "--param", "scenario=stale", "--yes",
  ]);
});

test("unexpected paid results are preserved instead of discarded", () => {
  assert.equal(paidEvidencePath("BREACH", "ACCEPTED"), "evidence/live/agentic-wallet-unexpected-accepted.json");
  assert.equal(paidEvidencePath("BREACH", "BREACH"), "evidence/live/agentic-wallet-paid-breach.json");
});

test("custom paid evidence paths stay inside the evidence directory", () => {
  assert.equal(
    safeEvidenceOutputPath("evidence/official-build/v2-primary-paid-breach.json", "fallback.json"),
    "evidence/official-build/v2-primary-paid-breach.json",
  );
  assert.throws(() => safeEvidenceOutputPath("../secrets.json", "fallback.json"), /inside the evidence/);
  assert.throws(() => safeEvidenceOutputPath("outside.json", "fallback.json"), /inside the evidence/);
});
