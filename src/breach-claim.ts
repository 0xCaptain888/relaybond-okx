import { keccak256, stringToHex } from "viem";
import { hashCanonical } from "./canonical.js";
import { hashPromise } from "./signing.js";
import type { DeliveryReceipt, ServicePromise, ServiceRequest, Signed, VerificationResult } from "./types.js";

export type PaidBreachEvidence = {
  payment: {
    status: unknown;
    transactionHash: unknown;
    facilitatorReceipt?: Record<string, unknown>;
    onchainSettlement: { status: unknown };
  };
  delivery: {
    request: ServiceRequest;
    result: unknown;
    servicePromise: Signed<ServicePromise>;
    deliveryReceipt: Signed<DeliveryReceipt>;
  };
  verification: VerificationResult;
};

export async function buildBreachClaim(evidence: PaidBreachEvidence) {
  if (evidence.payment.status !== "success" || evidence.payment.onchainSettlement?.status !== "success") {
    throw new Error("A rebate requires a final-success paid settlement.");
  }
  if (evidence.verification.status !== "BREACH") throw new Error("Delivery is not classified as BREACH.");
  const attributionChecks = ["promiseSignature", "receiptSignature", "promiseBound", "requestBound", "responseBound"] as const;
  const failedAttribution = attributionChecks.filter((check) => !evidence.verification.checks[check]);
  if (failedAttribution.length > 0) {
    throw new Error(`Provider-attribution checks failed: ${failedAttribution.join(", ")}`);
  }
  const promise = evidence.delivery.servicePromise.payload;
  const request = evidence.delivery.request;
  if (request.buyer === "0x0000000000000000000000000000000000000000") {
    throw new Error("A rebate cannot target the zero address.");
  }
  const objectiveBreaches = ["deadlineMet", "freshnessMet", "schemaMet", "recordCountMet"] as const;
  if (!objectiveBreaches.some((check) => !evidence.verification.checks[check])) {
    throw new Error("No objective SLA delivery breach is present.");
  }
  return {
    serviceId: keccak256(stringToHex(promise.serviceId)),
    promiseHash: await hashPromise(promise),
    requestHash: hashCanonical(request),
    receiptHash: hashCanonical(evidence.delivery.deliveryReceipt),
    buyer: request.buyer,
    rebateAmount: BigInt(promise.rebateAtomic),
  };
}
