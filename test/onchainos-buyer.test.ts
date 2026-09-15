import assert from "node:assert/strict";
import test from "node:test";
import { extractMerchantDelivery, requireFinalSettlement } from "../src/onchainos-buyer.js";

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
