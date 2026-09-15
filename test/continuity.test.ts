import assert from "node:assert/strict";
import test from "node:test";
import { createContinuityEvidence } from "../src/continuity-simulator.js";
import { buildContinuityReceipt, verifyContinuityEconomics } from "../src/continuity.js";
import { recoverContinuitySigner } from "../src/signing.js";

const acceptedChecks = {
  promiseSignature: true,
  receiptSignature: true,
  promiseBound: true,
  requestBound: true,
  responseBound: true,
  deadlineMet: true,
  freshnessMet: true,
  schemaMet: true,
  recordCountMet: true,
};

test("recovers a breached task without charging the buyer twice", async () => {
  const evidence = await createContinuityEvidence();
  assert.equal(evidence.primary.verification.status, "BREACH");
  assert.equal(evidence.recovery.verification.status, "ACCEPTED");
  assert.equal(evidence.continuityReceipt.payload.finalStatus, "RECOVERED");
  assert.equal(evidence.economics.buyerDoubleCharged, false);
  assert.equal(evidence.economics.buyerPaidAtomic, "10000");
  assert.equal(evidence.economics.fundedFromPrimaryBondAtomic, "10000");
  assert.equal(verifyContinuityEconomics(evidence.continuityReceipt.payload).passed, true);
  const signer = await recoverContinuitySigner({ chainId: evidence.chainId, vault: evidence.vault }, evidence.continuityReceipt);
  assert.equal(signer.toLowerCase(), evidence.verifier.toLowerCase());
});

test("rejects a backup that costs more than the buyer's original payment", () => {
  assert.throws(() => buildContinuityReceipt({
    taskId: `0x${"11".repeat(32)}`,
    requestHash: `0x${"22".repeat(32)}`,
    primaryProvider: "0x1111111111111111111111111111111111111111",
    backupProvider: "0x2222222222222222222222222222222222222222",
    primaryPriceAtomic: "10000",
    backupPriceAtomic: "10001",
    primaryVerification: { status: "BREACH", checks: { ...acceptedChecks, freshnessMet: false }, violations: ["freshnessMet"], checkedAt: 1, evidenceHash: `0x${"33".repeat(32)}` },
    backupVerification: { status: "ACCEPTED", checks: acceptedChecks, violations: [], checkedAt: 1, evidenceHash: `0x${"44".repeat(32)}` },
    completedAt: 1,
    verifier: "0x3333333333333333333333333333333333333333",
  }), /exceeds the buyer's original payment/);
});

test("rejects a primary provider masquerading as its own backup", () => {
  assert.throws(() => buildContinuityReceipt({
    taskId: `0x${"11".repeat(32)}`,
    requestHash: `0x${"22".repeat(32)}`,
    primaryProvider: "0x1111111111111111111111111111111111111111",
    backupProvider: "0x1111111111111111111111111111111111111111",
    primaryPriceAtomic: "10000",
    backupPriceAtomic: "10000",
    primaryVerification: { status: "BREACH", checks: { ...acceptedChecks, freshnessMet: false }, violations: ["freshnessMet"], checkedAt: 1, evidenceHash: `0x${"33".repeat(32)}` },
    backupVerification: { status: "ACCEPTED", checks: acceptedChecks, violations: [], checkedAt: 1, evidenceHash: `0x${"44".repeat(32)}` },
    completedAt: 1,
    verifier: "0x3333333333333333333333333333333333333333",
  }), /independent identities/);
});
