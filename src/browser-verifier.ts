import { keccak256, stringToHex, type Hex } from "viem";
import {
  hashPromise,
  hashRecoveryAttestation,
  recoverPromiseSigner,
  recoverReceiptSigner,
  recoverContinuitySigner,
  recoverRecoveryAttestationSigner,
} from "./signing.js";
import type { OfficialCoordinatorEvidence } from "./official-build-simulator.js";
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

async function verifyOfficialCoordinatorEvidence(evidence: OfficialCoordinatorEvidence) {
  if (!evidence.recovered.recoveryAttestation || !evidence.recovered.continuityReceipt) {
    throw new Error("Official coordinator evidence is missing signed recovery artifacts.");
  }
  const context = { chainId: evidence.chainId, vault: evidence.vault };
  const [recoverySigner, continuitySigner] = await Promise.all([
    recoverRecoveryAttestationSigner(context, evidence.recovered.recoveryAttestation),
    recoverContinuitySigner(context, evidence.recovered.continuityReceipt),
  ]);
  const calculatedAttestationDigest = hashRecoveryAttestation(
    context,
    evidence.recovered.recoveryAttestation.payload,
  );
  const recoveredTrail = evidence.recovered.task.events.map((event) => event.state);
  const frozenTrail = evidence.frozen.task.events.map((event) => event.state);
  const checks = {
    recoverySigner: recoverySigner.toLowerCase() === evidence.verifier.toLowerCase(),
    continuitySigner: continuitySigner.toLowerCase() === evidence.verifier.toLowerCase(),
    attestationDigest: calculatedAttestationDigest === evidence.recoveryAttestationDigest,
    recoveredTerminal: evidence.recovered.task.state === "RECOVERED" && recoveredTrail.at(-1) === "RECOVERED",
    frozenTerminal: evidence.frozen.task.state === "FROZEN" && frozenTrail.at(-1) === "FROZEN",
    buyerPaidPrimary: evidence.recovered.recoveryAttestation.payload.buyer === evidence.buyer,
    settlementHonesty: evidence.claims.onchainSettlement === false,
  };
  const { evidenceHash, portableIntegrity, ...unsigned } = evidence;
  const evidenceHashPassed = hashCanonicalBrowser(unsigned) === evidenceHash;
  return {
    passed: Object.values(checks).every(Boolean) && evidenceHashPassed,
    checks,
    recoverySigner,
    continuitySigner,
    expectedVerifier: evidence.verifier,
    calculatedAttestationDigest,
    expectedAttestationDigest: evidence.recoveryAttestationDigest,
    evidenceHashPassed,
    portableHash: portableIntegrity.hash,
  };
}

async function verifyLiveCoordinatorEvidence(evidence: {
  mode: string;
  chainId: number;
  vault: `0x${string}`;
  buyer: `0x${string}`;
  verifier: `0x${string}`;
  primaryPayment: { status: string; payer: `0x${string}`; amountAtomic: string };
  recovered: {
    task: { state: string; events: Array<{ state: string }> };
    primary: { verification: { status: string } };
    backup?: { verification: { status: string } };
    continuityReceipt?: ContinuityEvidence["continuityReceipt"];
    recoveryAttestation?: OfficialCoordinatorEvidence["recovered"]["recoveryAttestation"];
  };
  evidenceHash: Hex;
  portableIntegrity: { hash: Hex };
}) {
  if (!evidence.recovered.recoveryAttestation || !evidence.recovered.continuityReceipt || !evidence.recovered.backup) {
    throw new Error("LIVE coordinator evidence is missing recovery artifacts.");
  }
  const context = { chainId: evidence.chainId, vault: evidence.vault };
  const [recoverySigner, continuitySigner] = await Promise.all([
    recoverRecoveryAttestationSigner(context, evidence.recovered.recoveryAttestation),
    recoverContinuitySigner(context, evidence.recovered.continuityReceipt),
  ]);
  const receipt = evidence.recovered.continuityReceipt.payload;
  const trail = evidence.recovered.task.events.map((event) => event.state);
  const checks = {
    liveMode: evidence.mode === "XLAYER_TESTNET_LIVE_COORDINATOR",
    recoverySigner: recoverySigner.toLowerCase() === evidence.verifier.toLowerCase(),
    continuitySigner: continuitySigner.toLowerCase() === evidence.verifier.toLowerCase(),
    recoveredTerminal: evidence.recovered.task.state === "RECOVERED" && trail.at(-1) === "RECOVERED",
    primaryBreached: evidence.recovered.primary.verification.status === "BREACH",
    backupAccepted: evidence.recovered.backup.verification.status === "ACCEPTED",
    buyerPaymentBound: evidence.primaryPayment.status === "success"
      && evidence.primaryPayment.payer.toLowerCase() === evidence.buyer.toLowerCase()
      && evidence.recovered.recoveryAttestation.payload.buyer.toLowerCase() === evidence.buyer.toLowerCase(),
    buyerPaidOnce: receipt.buyerPaidAtomic === evidence.primaryPayment.amountAtomic
      && receipt.primaryPaymentAtomic === evidence.primaryPayment.amountAtomic,
    recoveryCoveredByBond: BigInt(receipt.recoveryPaidFromBondAtomic) <= BigInt(receipt.primaryPaymentAtomic),
    independentProviders: receipt.primaryProvider.toLowerCase() !== receipt.backupProvider.toLowerCase(),
  };
  const { evidenceHash, portableIntegrity, ...unsigned } = evidence;
  const evidenceHashPassed = hashCanonicalBrowser(unsigned) === evidenceHash;
  return {
    passed: Object.values(checks).every(Boolean) && evidenceHashPassed,
    checks,
    recoverySigner,
    continuitySigner,
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
      verifyOfficialCoordinatorEvidence: typeof verifyOfficialCoordinatorEvidence;
      verifyLiveCoordinatorEvidence: typeof verifyLiveCoordinatorEvidence;
    };
  }
}

window.RelayBondVerifier = {
  verifyPromiseEvidence,
  verifyPaidDelivery,
  verifyPaidEvidenceHash,
  verifyContinuityEvidence,
  verifyOfficialCoordinatorEvidence,
  verifyLiveCoordinatorEvidence,
};
