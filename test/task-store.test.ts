import assert from "node:assert/strict";
import test from "node:test";
import { MemoryContinuityTaskStore } from "../src/task-store.js";

const taskId = `0x${"11".repeat(32)}` as const;

test("enforces the continuity state machine and returns defensive copies", async () => {
  const store = new MemoryContinuityTaskStore();
  await store.create({
    taskId,
    buyer: "0x1111111111111111111111111111111111111111",
    requestHash: `0x${"22".repeat(32)}`,
    input: { symbol: "BTC-USDT" },
    state: "QUEUED",
    createdAt: 1,
    updatedAt: 1,
    events: [{ state: "QUEUED", at: 1, description: "queued" }],
  });
  await assert.rejects(
    store.transition(taskId, { state: "RECOVERED", at: 2, description: "invalid jump" }),
    /Invalid continuity transition/,
  );
  const selected = await store.transition(taskId, { state: "PRIMARY_SELECTED", at: 2, providerId: "primary", description: "selected" });
  selected.events.push({ state: "FROZEN", at: 3, description: "external mutation" });
  const stored = await store.get(taskId);
  assert.equal(stored?.events.length, 2);
  assert.equal(stored?.primaryProviderId, "primary");
});
