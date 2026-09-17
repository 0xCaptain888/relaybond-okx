import assert from "node:assert/strict";
import test from "node:test";
import { createOfficialCoordinatorEvidence } from "../src/official-build-simulator.js";
import { validateLiveRecoveryEvidence, type LiveRecoveryEvidence } from "../src/v2-settlement.js";

async function fixture() {
  const local = await createOfficialCoordinatorEvidence();
  const evidence = { ...local, mode: "XLAYER_TESTNET_LIVE_COORDINATOR" } as unknown as LiveRecoveryEvidence;
  const checkedAt = evidence.recovered.recoveryAttestation!.payload.deadline - 1;
  const context = { chainId: evidence.chainId, vault: evidence.vault, verifier: evidence.verifier, checkedAt };
  return { evidence, context };
}

test("accepts a fully bound live recovery evidence pack for read-only settlement planning", async () => {
  const { evidence, context } = await fixture();
  const result = await validateLiveRecoveryEvidence(evidence, context);
  assert.equal(result.passed, true);
  assert.equal(Object.values(result.checks).every(Boolean), true);
});

test("refuses LOCAL coordinator evidence for an onchain settlement", async () => {
  const { evidence, context } = await fixture();
  const result = await validateLiveRecoveryEvidence({ ...evidence, mode: "OFFICIAL_PERIOD_LOCAL_COORDINATOR" } as unknown as LiveRecoveryEvidence, context);
  assert.equal(result.passed, false);
  assert.equal(result.checks.liveMode, false);
});

test("detects delivery-evidence substitution before settlement", async () => {
  const { evidence, context } = await fixture();
  evidence.recovered.recoveryAttestation!.payload.failedReceiptHash = `0x${"00".repeat(32)}`;
  const result = await validateLiveRecoveryEvidence(evidence, context);
  assert.equal(result.passed, false);
  assert.equal(result.checks.deliveryEvidenceBound, false);
});

test("rejects an expired recovery attestation", async () => {
  const { evidence, context } = await fixture();
  const result = await validateLiveRecoveryEvidence(evidence, {
    ...context,
    checkedAt: evidence.recovered.recoveryAttestation!.payload.deadline + 1,
  });
  assert.equal(result.passed, false);
  assert.equal(result.checks.attestationNotExpired, false);
});
