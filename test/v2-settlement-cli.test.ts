import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("missing LIVE evidence produces a successful fail-closed settlement plan", async () => {
  const directory = await mkdtemp(join(tmpdir(), "relaybond-settlement-"));
  const evidencePath = join(directory, "missing-live-evidence.json");
  const planPath = join(directory, "settlement-plan.json");

  try {
    const { stdout } = await execFileAsync(process.execPath, [
      "--import",
      "tsx",
      "scripts/settle-v2-recovery.ts",
    ], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        V2_LIVE_EVIDENCE_PATH: evidencePath,
        V2_SETTLEMENT_PLAN_PATH: planPath,
        RECOVERY_BOND_VAULT_V2_ADDRESS: "0x0000000000000000000000000000000000000001",
        USDT0_ADDRESS: "0x0000000000000000000000000000000000000002",
        VERIFIER_ADDRESS: "0x0000000000000000000000000000000000000003",
      },
    });

    const printed = JSON.parse(stdout);
    const saved = JSON.parse(await readFile(planPath, "utf8"));
    assert.equal(printed.sourceEvidenceAvailable, false);
    assert.equal(printed.ready, false);
    assert.equal(printed.broadcast, false);
    assert.equal(printed.evidenceValidation.checks.liveMode, false);
    assert.deepEqual(saved, printed);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
