import assert from "node:assert/strict";
import test from "node:test";
import type { FacilitatorClient } from "@okxweb3/x402-core/server";
import { ResilientFacilitatorClient } from "../src/resilient-facilitator.js";

test("facilitator support discovery retries transient failures", async () => {
  let calls = 0;
  const delegate = {
    async verify() {
      throw new Error("not used");
    },
    async settle() {
      throw new Error("not used");
    },
    async getSupported() {
      calls += 1;
      if (calls < 3) throw new Error("temporary fetch failure");
      return { kinds: [], extensions: [], signers: {} };
    },
  } satisfies FacilitatorClient;
  const client = new ResilientFacilitatorClient(delegate);
  assert.deepEqual(await client.getSupported(), { kinds: [], extensions: [], signers: {} });
  assert.equal(calls, 3);
});
