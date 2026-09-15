import assert from "node:assert/strict";
import test from "node:test";
import { extractMerchantDelivery } from "../src/onchainos-buyer.js";

test("OnchainOS result extraction rejects a missing merchant delivery", () => {
  assert.throws(() => extractMerchantDelivery({ result: "not-an-object" }), /does not contain/);
});

test("OnchainOS result extraction accepts a structured merchant response", () => {
  const delivery = { request: {}, result: {}, servicePromise: {}, deliveryReceipt: {} };
  assert.equal(extractMerchantDelivery({ result: delivery }), delivery);
});
