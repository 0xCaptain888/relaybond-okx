import { hashCanonical } from "./canonical.js";
import { hashPromise, recoverPromiseSigner, recoverReceiptSigner } from "./signing.js";
import type {
  DeliveryReceipt,
  ServicePromise,
  ServiceRequest,
  Signed,
  VerificationResult,
} from "./types.js";

export type VerificationInput = {
  promise: Signed<ServicePromise>;
  request: ServiceRequest;
  response: unknown;
  receipt: Signed<DeliveryReceipt>;
  checkedAt: number;
};

function schemaAndCount(
  schema: ServicePromise["requiredSchema"],
  response: unknown,
): { schemaMet: boolean; recordCount: number } {
  if (!response || typeof response !== "object") return { schemaMet: false, recordCount: 0 };
  const object = response as Record<string, unknown>;
  if (schema === "market-quote-v1") {
    const schemaMet =
      typeof object.symbol === "string" &&
      typeof object.price === "number" &&
      Number.isFinite(object.price) &&
      typeof object.observedAt === "number";
    return { schemaMet, recordCount: schemaMet ? 1 : 0 };
  }
  const records = object.records;
  return {
    schemaMet: Array.isArray(records),
    recordCount: Array.isArray(records) ? records.length : 0,
  };
}

export async function verifyDelivery(input: VerificationInput): Promise<VerificationResult> {
  const { promise: signedPromise, request, response, receipt: signedReceipt, checkedAt } = input;
  const promise = signedPromise.payload;
  const receipt = signedReceipt.payload;
  const recoveredPromiseSigner = await recoverPromiseSigner(signedPromise);
  const recoveredReceiptSigner = await recoverReceiptSigner(promise, signedReceipt);
  const promiseDigest = await hashPromise(promise);
  const requestHash = hashCanonical(request);
  const responseHash = hashCanonical(response);
  const responseObject =
    response && typeof response === "object" ? (response as Record<string, unknown>) : {};
  const observedAt = typeof responseObject.observedAt === "number" ? responseObject.observedAt : 0;
  const shape = schemaAndCount(promise.requiredSchema, response);

  const checks = {
    promiseSignature: recoveredPromiseSigner.toLowerCase() === promise.provider.toLowerCase(),
    receiptSignature: recoveredReceiptSigner.toLowerCase() === promise.provider.toLowerCase(),
    promiseBound: receipt.servicePromiseHash === promiseDigest,
    requestBound: receipt.requestHash === requestHash && receipt.serviceId === request.serviceId,
    responseBound: receipt.responseHash === responseHash,
    deadlineMet:
      receipt.deliveredAt >= request.requestedAt &&
      receipt.deliveredAt <= checkedAt &&
      receipt.deliveredAt * 1000 - request.requestedAt * 1000 <= promise.responseTimeMs &&
      request.requestedAt <= promise.validUntil,
    freshnessMet:
      observedAt > 0 && receipt.deliveredAt - observedAt <= promise.maxDataAgeSeconds && observedAt <= checkedAt,
    schemaMet: shape.schemaMet,
    recordCountMet: shape.recordCount >= promise.minimumRecords,
  };

  const violations = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  const unsignedResult = {
    status: violations.length === 0 ? ("ACCEPTED" as const) : ("BREACH" as const),
    checkedAt,
    violations,
    checks,
  };

  return { ...unsignedResult, evidenceHash: hashCanonical(unsignedResult) };
}
