import assert from "node:assert/strict";
import test from "node:test";
import { encodePaymentSignatureHeader } from "@okxweb3/x402-core/http";
import type { PaymentPayload } from "@okxweb3/x402-core/types";
import {
  buildScenarioResponse,
  normalizeServiceInput,
  paymentContextFromVerifiedHeader,
} from "../src/paid-request.js";

const buyer = "0xcb83af485c066add3eca9041a78ea7c14e3f15f4";
const payTo = "0x917b04d30478E9405445CfF208eaA9d61e2EC44d";
const asset = "0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c";
const expected = { network: "eip155:1952", amount: "10000", asset, payTo } as const;

function paymentHeader(overrides: Record<string, unknown> = {}) {
  const payload: PaymentPayload = {
    x402Version: 2,
    resource: { url: "https://relaybond.example/v1/provider/quote" },
    accepted: {
      scheme: "exact",
      network: "eip155:1952",
      asset,
      amount: "10000",
      payTo,
      maxTimeoutSeconds: 300,
      extra: { name: "USD₮0", version: "1" },
    },
    payload: {
      authorization: {
        from: buyer,
        to: payTo,
        value: "10000",
        validAfter: "1",
        validBefore: "2",
        nonce: `0x${"11".repeat(32)}`,
        ...overrides,
      },
      signature: `0x${"22".repeat(65)}`,
    },
  };
  return encodePaymentSignatureHeader(payload);
}

test("extracts the buyer from facilitator-verified payment authorization", () => {
  const context = paymentContextFromVerifiedHeader(paymentHeader(), expected);
  assert.equal(context.buyer.toLowerCase(), buyer.toLowerCase());
  assert.match(context.paymentId, /^0x[0-9a-f]{64}$/);
});

test("rejects a payment payload whose transfer recipient differs from the service", () => {
  assert.throws(
    () => paymentContextFromVerifiedHeader(paymentHeader({ to: "0x0000000000000000000000000000000000000001" }), expected),
    /does not match/,
  );
});

test("normalizes accepted requests to a stable symbol-only input", () => {
  assert.deepEqual(normalizeServiceInput({}, { symbol: "btc-usdt" }), {
    symbol: "BTC-USDT",
    scenario: "accepted",
    input: { symbol: "BTC-USDT" },
  });
});

test("creates objective empty and stale breach responses", () => {
  const quote = { symbol: "BTC-USDT", price: 60_000, observedAt: 1_000, source: "OKX_MARKET_API" as const };
  assert.deepEqual(buildScenarioResponse(quote, "empty", 30), {});
  assert.equal(buildScenarioResponse(quote, "stale", 30).observedAt, 910);
});
