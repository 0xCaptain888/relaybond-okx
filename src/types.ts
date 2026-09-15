import type { Address, Hex } from "viem";

export type ServicePromise = {
  version: "1";
  chainId: number;
  vault: Address;
  serviceId: string;
  endpoint: string;
  responseTimeMs: number;
  maxDataAgeSeconds: number;
  requiredSchema: "market-quote-v1" | "generic-records-v1";
  minimumRecords: number;
  priceAtomic: string;
  bondAmountAtomic: string;
  rebateAtomic: string;
  refundOnBreach: boolean;
  validUntil: number;
  provider: Address;
};

export type ServiceRequest = {
  serviceId: string;
  requestedAt: number;
  input: Record<string, unknown>;
  buyer: Address;
};

export type DeliveryReceipt = {
  version: "1";
  serviceId: string;
  requestHash: Hex;
  responseHash: Hex;
  paymentId: Hex;
  deliveredAt: number;
  servicePromiseHash: Hex;
  provider: Address;
};

export type Signed<T> = {
  payload: T;
  signature: Hex;
};

export type VerificationStatus = "ACCEPTED" | "BREACH";

export type VerificationResult = {
  status: VerificationStatus;
  checkedAt: number;
  violations: string[];
  checks: {
    promiseSignature: boolean;
    receiptSignature: boolean;
    promiseBound: boolean;
    requestBound: boolean;
    responseBound: boolean;
    deadlineMet: boolean;
    freshnessMet: boolean;
    schemaMet: boolean;
    recordCountMet: boolean;
  };
  evidenceHash: Hex;
};

export type JudgeEvidence = {
  evidenceVersion: "1";
  mode: "DETERMINISTIC_LOCAL_SIMULATION" | "XLAYER_TESTNET" | "XLAYER_MAINNET";
  generatedAt: string;
  provider: Address;
  buyer: Address;
  verifier: Address;
  servicePromise: Signed<ServicePromise>;
  scenarios: Array<{
    name: string;
    request: ServiceRequest;
    response: unknown;
    deliveryReceipt: Signed<DeliveryReceipt>;
    verification: VerificationResult;
    settlement: {
      state: "NOT_REQUIRED" | "REBATED" | "PENDING_LIVE_TRANSACTION";
      rebateAtomic: string;
      bondBeforeAtomic: string;
      bondAfterAtomic: string;
      transactionHash?: Hex;
    };
  }>;
  evidenceHash: Hex;
  portableIntegrity: {
    algorithm: "SHA-256";
    hash: Hex;
  };
};
