import { keccak256, stringToHex, type Hex } from "viem";
import { hashPromise, recoverPromiseSigner, recoverReceiptSigner } from "./signing.js";
import { recoverContinuitySigner } from "./signing.js";
import type { ContinuityEvidence, DeliveryReceipt, ServicePromise, ServiceRequest, Signed } from "./types.js";

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalize(child)]),
    );
  }
  return value;
}

function hashCanonicalBrowser(value: unknown): Hex {
  return keccak256(stringToHex(JSON.stringify(normalize(value))));
}

async function verifyPromiseEvidence(evidence: {
  promiseHash: Hex;
  signedPromise: Signed<ServicePromise>;
}) {
  const recovered = await recoverPromiseSigner(evidence.signedPromise);
  const calculatedHash = await hashPromise(evidence.signedPromise.payload);
  return {
    passed:
      recovered.toLowerCase() === evidence.signedPromise.payload.provider.toLowerCase() &&
      calculatedHash === evidence.promiseHash,
    recovered,
    expectedProvider: evidence.signedPromise.payload.provider,
    calculatedHash,
    expectedHash: evidence.promiseHash,
  };
}

async function verifyPaidDelivery(delivery: {
  request: ServiceRequest;
  result: unknown;
  servicePromise: Signed<ServicePromise>;
  deliveryReceipt: Signed<DeliveryReceipt>;
}) {
  const promise = delivery.servicePromise.payload;
  const receipt = delivery.deliveryReceipt.payload;
  const [promiseSigner, receiptSigner, promiseHash] = await Promise.all([
    recoverPromiseSigner(delivery.servicePromise),
    recoverReceiptSigner(promise, delivery.deliveryReceipt),
    hashPromise(promise),
  ]);
  const checks = {
    promiseSignature: promiseSigner.toLowerCase() === promise.provider.toLowerCase(),
    receiptSignature: receiptSigner.toLowerCase() === promise.provider.toLowerCase(),
    promiseBound: receipt.servicePromiseHash === promiseHash,
    requestBound: receipt.requestHash === hashCanonicalBrowser(delivery.request),
    responseBound: receipt.responseHash === hashCanonicalBrowser(delivery.result),
    buyerBound: delivery.request.buyer !== "0x0000000000000000000000000000000000000000",
  };
  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    promiseSigner,
    receiptSigner,
  };
}

function verifyPaidEvidenceHash(evidence: {
  evidenceHash: Hex;
  portableIntegrity: { hash: Hex };
  [key: string]: unknown;
}) {
  const { evidenceHash, portableIntegrity, ...unsigned } = evidence;
  return {
    passed: hashCanonicalBrowser(unsigned) === evidenceHash,
    calculatedHash: hashCanonicalBrowser(unsigned),
    expectedHash: evidenceHash,
    portableHash: portableIntegrity.hash,
  };
}

async function verifyContinuityEvidence(evidence: ContinuityEvidence) {
  const signer = await recoverContinuitySigner(
    { chainId: evidence.chainId, vault: evidence.vault },
    evidence.continuityReceipt,
  );
  const receipt = evidence.continuityReceipt.payload;
  const economics = {
    buyerPaidOnce: receipt.buyerPaidAtomic === receipt.primaryPaymentAtomic,
    recoveryCoveredByBond: BigInt(receipt.recoveryPaidFromBondAtomic) <= BigInt(receipt.primaryPaymentAtomic),
    independentProviders: receipt.primaryProvider.toLowerCase() !== receipt.backupProvider.toLowerCase(),
    statusesBound: receipt.primaryStatus === "BREACH"
      && receipt.backupStatus === "ACCEPTED"
      && receipt.finalStatus === "RECOVERED",
  };
  const { evidenceHash, portableIntegrity, ...unsigned } = evidence;
  const evidenceHashPassed = hashCanonicalBrowser(unsigned) === evidenceHash;
  return {
    passed:
      signer.toLowerCase() === evidence.verifier.toLowerCase()
      && Object.values(economics).every(Boolean)
      && evidenceHashPassed,
    signer,
    expectedVerifier: evidence.verifier,
    economics,
    evidenceHashPassed,
    portableHash: portableIntegrity.hash,
  };
}

declare global {
  interface Window {
    RelayBondVerifier: {
      verifyPromiseEvidence: typeof verifyPromiseEvidence;
      verifyPaidDelivery: typeof verifyPaidDelivery;
      verifyPaidEvidenceHash: typeof verifyPaidEvidenceHash;
      verifyContinuityEvidence: typeof verifyContinuityEvidence;
    };
  }
}

window.RelayBondVerifier = { verifyPromiseEvidence, verifyPaidDelivery, verifyPaidEvidenceHash, verifyContinuityEvidence };
