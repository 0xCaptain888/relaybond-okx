import { readFile } from "node:fs/promises";
import { hashCanonical, sha256Canonical } from "../src/canonical.js";
import { verifyOnchainSettlement } from "../src/settlement.js";
import type { DeliveryReceipt, ServicePromise, ServiceRequest, Signed, VerificationResult } from "../src/types.js";
import { verifyDelivery } from "../src/verifier.js";

type LivePaidEvidence = {
  evidenceVersion: "1";
  mode: "OKX_AGENTIC_WALLET_XLAYER_TESTNET";
  capturedAt: string;
  payment: {
    status: "success";
    transactionHash: `0x${string}`;
    facilitatorReceipt: Record<string, unknown>;
    onchainSettlement: {
      status: "success";
      transactionHash: `0x${string}`;
      blockNumber: string;
      token: `0x${string}`;
      payer: `0x${string}`;
      payTo: `0x${string}`;
      amountAtomic: string;
    };
  };
  delivery: {
    request: ServiceRequest;
    result: unknown;
    servicePromise: Signed<ServicePromise>;
    deliveryReceipt: Signed<DeliveryReceipt>;
  };
  verification: VerificationResult;
  evidenceHash: `0x${string}`;
  portableIntegrity: { algorithm: "SHA-256"; hash: `0x${string}` };
};

const path = process.argv.find((argument) => argument.endsWith(".json")) || "evidence/live/agentic-wallet-paid-delivery.json";
const evidence = JSON.parse(await readFile(path, "utf8")) as LivePaidEvidence;
const { evidenceHash, portableIntegrity, ...unsigned } = evidence;
const calculatedEvidenceHash = hashCanonical(unsigned);
const calculatedPortableHash = sha256Canonical(unsigned);
const verification = await verifyDelivery({
  promise: evidence.delivery.servicePromise,
  request: evidence.delivery.request,
  response: evidence.delivery.result,
  receipt: evidence.delivery.deliveryReceipt,
  checkedAt: evidence.verification.checkedAt,
});
const failedChecks = Object.entries(verification.checks).filter(([, passed]) => !passed).map(([name]) => name).sort();
const reportedViolations = [...verification.violations].sort();
const decisionConsistent = verification.status === "ACCEPTED"
  ? failedChecks.length === 0 && reportedViolations.length === 0
  : failedChecks.length > 0 && JSON.stringify(failedChecks) === JSON.stringify(reportedViolations);
const promise = evidence.delivery.servicePromise.payload;
const settlement = evidence.payment.onchainSettlement;
const localChecks = {
  evidenceHash: calculatedEvidenceHash === evidenceHash,
  portableHash: calculatedPortableHash === portableIntegrity.hash,
  verificationResult: hashCanonical(verification) === hashCanonical(evidence.verification),
  decisionConsistent,
  transactionBound: evidence.payment.transactionHash.toLowerCase() === settlement.transactionHash.toLowerCase(),
  payerBound: settlement.payer.toLowerCase() === evidence.delivery.request.buyer.toLowerCase(),
  providerBound: settlement.payTo.toLowerCase() === promise.provider.toLowerCase(),
  priceBound: settlement.amountAtomic === promise.priceAtomic,
};

if (!Object.values(localChecks).every(Boolean)) {
  console.error(JSON.stringify({ verified: false, path, localChecks }, null, 2));
  process.exitCode = 1;
} else {
  let onchain = null;
  if (process.argv.includes("--onchain")) {
    onchain = await verifyOnchainSettlement({
      rpcUrl: process.env.XLAYER_TESTNET_RPC_URL || "https://testrpc.xlayer.tech/terigon",
      transactionHash: settlement.transactionHash,
      token: settlement.token,
      payer: settlement.payer,
      payTo: settlement.payTo,
      amountAtomic: settlement.amountAtomic,
    });
  }
  console.log(JSON.stringify({
    verified: true,
    mode: evidence.mode,
    status: verification.status,
    transactionHash: evidence.payment.transactionHash,
    evidenceHash,
    portableHash: portableIntegrity.hash,
    localChecks,
    onchain,
  }, null, 2));
}
