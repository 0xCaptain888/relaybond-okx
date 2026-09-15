import assert from "node:assert/strict";
import test from "node:test";
import type { PaymentRequired } from "@okxweb3/x402-core/types";
import { selectGuardedRequirement } from "../src/buyer.js";

const challenge: PaymentRequired = {
  x402Version: 2,
  resource: { url: "https://relaybond.example/v1/provider/quote", description: "test", mimeType: "application/json" },
  accepts: [
    {
      scheme: "exact",
      network: "eip155:1952",
      asset: "0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c",
      amount: "10000",
      payTo: "0x917b04d30478E9405445CfF208eaA9d61e2EC44d",
      maxTimeoutSeconds: 300,
      extra: { name: "USD₮0", version: "1" },
    },
  ],
};

test("buyer guardrails accept the exact expected testnet payment", () => {
  const selected = selectGuardedRequirement(challenge, {
    network: "eip155:1952",
    asset: "0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c",
    payTo: "0x917b04d30478E9405445CfF208eaA9d61e2EC44d",
    maxAmountAtomic: "10000",
  });
  assert.equal(selected.plan.amountDisplay, "0.01");
  assert.equal(selected.plan.assetName, "USD₮0");
});

test("buyer guardrails reject an amount above the configured ceiling", () => {
  assert.throws(
    () => selectGuardedRequirement(challenge, {
      network: "eip155:1952",
      asset: "0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c",
      maxAmountAtomic: "9999",
    }),
    /exceeds configured maximum/,
  );
});

test("buyer guardrails reject a substituted payee", () => {
  assert.throws(
    () => selectGuardedRequirement(challenge, {
      network: "eip155:1952",
      asset: "0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c",
      payTo: "0x0000000000000000000000000000000000000001",
      maxAmountAtomic: "10000",
    }),
    /No payment requirement matches/,
  );
});
