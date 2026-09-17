import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256Canonical } from "../web/canonical.js";

for (const path of [
  "evidence/judge-run.json",
  "evidence/continuity-judge-run.json",
  "evidence/official-build/coordinator-v1.json",
  "evidence/official-build/v2-live-coordinator.json",
]) {
  test(`browser canonical SHA-256 matches ${path}`, async () => {
    const evidence = JSON.parse(await readFile(path, "utf8")) as {
      portableIntegrity: { hash: `0x${string}` };
      [key: string]: unknown;
    };
    const { portableIntegrity, ...payload } = evidence;
    assert.equal(await sha256Canonical(payload), portableIntegrity.hash);
  });
}
