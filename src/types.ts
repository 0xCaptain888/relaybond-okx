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

export type ProviderMode = "LIVE" | "TESTNET" | "LOCAL" | "DESIGN";

export type BondedProviderProfile = {
  providerId: string;
  name: string;
  serviceId: string;
  endpoint: string;
  provider: Address;
  mode: ProviderMode;
  active: boolean;
  priceAtomic: string;
  bondAtomic: string;
  minimumBondAtomic: string;
  maximumLatencyMs: number;
  maximumDataAgeSeconds: number;
  supportedSchemas: ServicePromise["requiredSchema"][];
  reliability: {
    verifiedCalls: number;
    acceptedCalls: number;
    recoveredCalls: number;
  };
};

export type ContinuityStatus = "ACCEPTED" | "RECOVERED" | "FROZEN";

export type ContinuityReceipt = {
  version: "2";
  taskId: Hex;
  requestHash: Hex;
  primaryProvider: Address;
  backupProvider: Address;
  primaryPaymentAtomic: string;
  buyerPaidAtomic: string;
  recoveryPaidFromBondAtomic: string;
  primaryStatus: VerificationStatus;
  backupStatus: VerificationStatus | "NOT_REQUIRED";
  finalStatus: ContinuityStatus;
  breachReason: string;
  primaryEvidenceHash: Hex;
  recoveryEvidenceHash: Hex;
  completedAt: number;
  verifier: Address;
};

export type ContinuityEvidence = {
  evidenceVersion: "2";
  mode: "DETERMINISTIC_LOCAL_RECOVERY";
  generatedAt: string;
  chainId: number;
  vault: Address;
  buyer: Address;
  verifier: Address;
  providers: BondedProviderProfile[];
  task: {
    taskId: Hex;
    input: Record<string, unknown>;
    requestedAt: number;
  };
  primary: {
    request: ServiceRequest;
    response: unknown;
    servicePromise: Signed<ServicePromise>;
    deliveryReceipt: Signed<DeliveryReceipt>;
    verification: VerificationResult;
  };
  recovery: {
    request: ServiceRequest;
    response: unknown;
    servicePromise: Signed<ServicePromise>;
    deliveryReceipt: Signed<DeliveryReceipt>;
    verification: VerificationResult;
  };
  continuityReceipt: Signed<ContinuityReceipt>;
  stages: Array<{
    state: "PAID" | "BREACH" | "REBATED_TO_RECOVERY" | "BACKUP_DELIVERED" | "RECOVERED";
    description: string;
  }>;
  economics: {
    buyerPaidAtomic: string;
    primaryProviderRevenueAtomic: string;
    backupProviderRevenueAtomic: string;
    fundedFromPrimaryBondAtomic: string;
    buyerDoubleCharged: boolean;
    primaryBondBeforeAtomic: string;
    primaryBondAfterAtomic: string;
  };
  evidenceHash: Hex;
  portableIntegrity: {
    algorithm: "SHA-256";
    hash: Hex;
  };
};

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
