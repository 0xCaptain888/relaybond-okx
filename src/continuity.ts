import { hashCanonical } from "./canonical.js";
import type { Address, Hex } from "viem";
import type { ContinuityReceipt, Signed, VerificationResult } from "./types.js";

export function buildContinuityReceipt(input: {
  taskId: Hex;
  requestHash: Hex;
  primaryProvider: Address;
  backupProvider: Address;
  primaryPriceAtomic: string;
  backupPriceAtomic: string;
  primaryVerification: VerificationResult;
  backupVerification: VerificationResult;
  completedAt: number;
  verifier: Address;
}): ContinuityReceipt {
  if (input.primaryVerification.status !== "BREACH") {
    throw new Error("Recovery requires an objectively verified primary breach.");
  }
  if (input.backupVerification.status !== "ACCEPTED") {
    throw new Error("A recovered task requires an accepted backup delivery.");
  }
  if (BigInt(input.backupPriceAtomic) > BigInt(input.primaryPriceAtomic)) {
    throw new Error("Backup recovery price exceeds the buyer's original payment.");
  }
  if (input.primaryProvider.toLowerCase() === input.backupProvider.toLowerCase()) {
    throw new Error("Primary and backup providers must be independent identities.");
  }
  return {
    version: "2",
    taskId: input.taskId,
    requestHash: input.requestHash,
    primaryProvider: input.primaryProvider,
    backupProvider: input.backupProvider,
    primaryPaymentAtomic: input.primaryPriceAtomic,
    buyerPaidAtomic: input.primaryPriceAtomic,
    recoveryPaidFromBondAtomic: input.backupPriceAtomic,
    primaryStatus: "BREACH",
    backupStatus: "ACCEPTED",
    finalStatus: "RECOVERED",
    breachReason: input.primaryVerification.violations.join(","),
    primaryEvidenceHash: input.primaryVerification.evidenceHash,
    recoveryEvidenceHash: input.backupVerification.evidenceHash,
    completedAt: input.completedAt,
    verifier: input.verifier,
  };
}

export function verifyContinuityEconomics(receipt: ContinuityReceipt) {
  const buyerPaidOnce = receipt.buyerPaidAtomic === receipt.primaryPaymentAtomic;
  const recoveryCoveredByBond = BigInt(receipt.recoveryPaidFromBondAtomic) <= BigInt(receipt.primaryPaymentAtomic);
  const independentProviders = receipt.primaryProvider.toLowerCase() !== receipt.backupProvider.toLowerCase();
  const statusesBound = receipt.primaryStatus === "BREACH"
    && receipt.backupStatus === "ACCEPTED"
    && receipt.finalStatus === "RECOVERED";
  return {
    passed: buyerPaidOnce && recoveryCoveredByBond && independentProviders && statusesBound,
    checks: { buyerPaidOnce, recoveryCoveredByBond, independentProviders, statusesBound },
    receiptHash: hashCanonical(receipt),
  };
}

export function continuityEvidenceHash(receipt: Signed<ContinuityReceipt>) {
  return hashCanonical(receipt);
}
