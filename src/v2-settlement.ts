import { keccak256, stringToHex, type Address } from "viem";
import { hashCanonical } from "./canonical.js";
import { verifyContinuityEconomics } from "./continuity.js";
import type { ContinuityCoordinatorResult } from "./coordinator.js";
import { recoverContinuitySigner, recoverRecoveryAttestationSigner } from "./signing.js";

export type LiveRecoveryEvidence = {
  evidenceVersion: string;
  mode: "XLAYER_TESTNET_LIVE_COORDINATOR";
  generatedAt: string;
  chainId: number;
  vault: Address;
  buyer: Address;
  verifier: Address;
  recovered: ContinuityCoordinatorResult;
};

export type LiveRecoveryValidationContext = {
  chainId: number;
  vault: Address;
  verifier: Address;
  checkedAt: number;
};

function sameAddress(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

export async function validateLiveRecoveryEvidence(
  evidence: LiveRecoveryEvidence,
  context: LiveRecoveryValidationContext,
) {
  const result = evidence.recovered;
  const backup = result.backup;
  const continuityReceipt = result.continuityReceipt;
  const recoveryAttestation = result.recoveryAttestation;
  if (!backup || !continuityReceipt || !recoveryAttestation) {
    throw new Error("Live recovery evidence must contain backup delivery, Continuity Receipt and Recovery Attestation.");
  }

  const attestation = recoveryAttestation.payload;
  const continuity = continuityReceipt.payload;
  const [continuitySigner, recoverySigner] = await Promise.all([
    recoverContinuitySigner({ chainId: evidence.chainId, vault: evidence.vault }, continuityReceipt),
    recoverRecoveryAttestationSigner({ chainId: evidence.chainId, vault: evidence.vault }, recoveryAttestation),
  ]);
  const economics = verifyContinuityEconomics(continuity);
  const expectedPrimaryServiceId = keccak256(stringToHex(result.primary.servicePromise.payload.serviceId));
  const expectedBackupServiceId = keccak256(stringToHex(backup.servicePromise.payload.serviceId));
  const checks = {
    liveMode: evidence.mode === "XLAYER_TESTNET_LIVE_COORDINATOR",
    expectedChain: evidence.chainId === context.chainId,
    expectedVault: sameAddress(evidence.vault, context.vault),
    expectedVerifier: sameAddress(evidence.verifier, context.verifier),
    recoveredTerminal: result.task.state === "RECOVERED",
    primaryBreached: result.primary.verification.status === "BREACH",
    backupAccepted: backup.verification.status === "ACCEPTED",
    independentProviders: !sameAddress(
      result.primary.deliveryReceipt.payload.provider,
      backup.deliveryReceipt.payload.provider,
    ),
    taskIdBound: continuity.taskId === result.task.taskId,
    requestHashBound:
      continuity.requestHash === result.task.requestHash
      && attestation.requestHash === result.task.requestHash,
    buyerBound:
      sameAddress(evidence.buyer, result.task.buyer)
      && sameAddress(attestation.buyer, evidence.buyer),
    serviceIdsBound:
      attestation.primaryServiceId === expectedPrimaryServiceId
      && attestation.backupServiceId === expectedBackupServiceId,
    deliveryEvidenceBound:
      attestation.failedReceiptHash === hashCanonical(result.primary.deliveryReceipt)
      && attestation.recoveredReceiptHash === hashCanonical(backup.deliveryReceipt),
    providersBound:
      sameAddress(continuity.primaryProvider, result.primary.deliveryReceipt.payload.provider)
      && sameAddress(continuity.backupProvider, backup.deliveryReceipt.payload.provider),
    recoveryAmountBound:
      attestation.recoveryAmount === continuity.recoveryPaidFromBondAtomic
      && BigInt(attestation.recoveryAmount) > 0n
      && BigInt(attestation.recoveryAmount) <= BigInt(continuity.primaryPaymentAtomic),
    attestationNotExpired: BigInt(attestation.deadline) >= BigInt(context.checkedAt),
    continuitySigner: sameAddress(continuitySigner, context.verifier),
    recoverySigner: sameAddress(recoverySigner, context.verifier),
    economics: economics.passed,
  };
  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    continuitySigner,
    recoverySigner,
    primaryServiceId: expectedPrimaryServiceId,
    backupServiceId: expectedBackupServiceId,
    requestHash: attestation.requestHash,
    recoveryAmountAtomic: attestation.recoveryAmount,
  };
}
