import {
  hashTypedData,
  recoverTypedDataAddress,
  type Address,
  type Hex,
  type LocalAccount,
} from "viem";
import type { ContinuityReceipt, DeliveryReceipt, ServicePromise, Signed } from "./types.js";

export const promiseTypes = {
  ServicePromise: [
    { name: "serviceIdHash", type: "bytes32" },
    { name: "endpointHash", type: "bytes32" },
    { name: "responseTimeMs", type: "uint256" },
    { name: "maxDataAgeSeconds", type: "uint256" },
    { name: "schemaHash", type: "bytes32" },
    { name: "minimumRecords", type: "uint256" },
    { name: "priceAtomic", type: "uint256" },
    { name: "bondAmountAtomic", type: "uint256" },
    { name: "rebateAtomic", type: "uint256" },
    { name: "refundOnBreach", type: "bool" },
    { name: "validUntil", type: "uint256" },
    { name: "provider", type: "address" },
  ],
} as const;

export const receiptTypes = {
  DeliveryReceipt: [
    { name: "serviceIdHash", type: "bytes32" },
    { name: "requestHash", type: "bytes32" },
    { name: "responseHash", type: "bytes32" },
    { name: "paymentId", type: "bytes32" },
    { name: "deliveredAt", type: "uint256" },
    { name: "servicePromiseHash", type: "bytes32" },
    { name: "provider", type: "address" },
  ],
} as const;

export const continuityTypes = {
  ContinuityReceipt: [
    { name: "taskId", type: "bytes32" },
    { name: "requestHash", type: "bytes32" },
    { name: "primaryProvider", type: "address" },
    { name: "backupProvider", type: "address" },
    { name: "primaryPaymentAtomic", type: "uint256" },
    { name: "buyerPaidAtomic", type: "uint256" },
    { name: "recoveryPaidFromBondAtomic", type: "uint256" },
    { name: "primaryStatusHash", type: "bytes32" },
    { name: "backupStatusHash", type: "bytes32" },
    { name: "finalStatusHash", type: "bytes32" },
    { name: "breachReasonHash", type: "bytes32" },
    { name: "primaryEvidenceHash", type: "bytes32" },
    { name: "recoveryEvidenceHash", type: "bytes32" },
    { name: "completedAt", type: "uint256" },
    { name: "verifier", type: "address" },
  ],
} as const;

function domain(chainId: number, vault: Address) {
  return {
    name: "RelayBond",
    version: "1",
    chainId,
    verifyingContract: vault,
  } as const;
}

async function sha(value: string): Promise<Hex> {
  const { keccak256, stringToHex } = await import("viem");
  return keccak256(stringToHex(value));
}

export async function promiseMessage(promise: ServicePromise) {
  return {
    serviceIdHash: await sha(promise.serviceId),
    endpointHash: await sha(promise.endpoint),
    responseTimeMs: BigInt(promise.responseTimeMs),
    maxDataAgeSeconds: BigInt(promise.maxDataAgeSeconds),
    schemaHash: await sha(promise.requiredSchema),
    minimumRecords: BigInt(promise.minimumRecords),
    priceAtomic: BigInt(promise.priceAtomic),
    bondAmountAtomic: BigInt(promise.bondAmountAtomic),
    rebateAtomic: BigInt(promise.rebateAtomic),
    refundOnBreach: promise.refundOnBreach,
    validUntil: BigInt(promise.validUntil),
    provider: promise.provider,
  } as const;
}

export async function receiptMessage(receipt: DeliveryReceipt) {
  return {
    serviceIdHash: await sha(receipt.serviceId),
    requestHash: receipt.requestHash,
    responseHash: receipt.responseHash,
    paymentId: receipt.paymentId,
    deliveredAt: BigInt(receipt.deliveredAt),
    servicePromiseHash: receipt.servicePromiseHash,
    provider: receipt.provider,
  } as const;
}

export async function continuityMessage(receipt: ContinuityReceipt) {
  return {
    taskId: receipt.taskId,
    requestHash: receipt.requestHash,
    primaryProvider: receipt.primaryProvider,
    backupProvider: receipt.backupProvider,
    primaryPaymentAtomic: BigInt(receipt.primaryPaymentAtomic),
    buyerPaidAtomic: BigInt(receipt.buyerPaidAtomic),
    recoveryPaidFromBondAtomic: BigInt(receipt.recoveryPaidFromBondAtomic),
    primaryStatusHash: await sha(receipt.primaryStatus),
    backupStatusHash: await sha(receipt.backupStatus),
    finalStatusHash: await sha(receipt.finalStatus),
    breachReasonHash: await sha(receipt.breachReason),
    primaryEvidenceHash: receipt.primaryEvidenceHash,
    recoveryEvidenceHash: receipt.recoveryEvidenceHash,
    completedAt: BigInt(receipt.completedAt),
    verifier: receipt.verifier,
  } as const;
}

export async function signPromise(
  account: LocalAccount,
  promise: ServicePromise,
): Promise<Signed<ServicePromise>> {
  return {
    payload: promise,
    signature: await account.signTypedData({
      domain: domain(promise.chainId, promise.vault),
      types: promiseTypes,
      primaryType: "ServicePromise",
      message: await promiseMessage(promise),
    }),
  };
}

export async function signReceipt(
  account: LocalAccount,
  promise: ServicePromise,
  receipt: DeliveryReceipt,
): Promise<Signed<DeliveryReceipt>> {
  return {
    payload: receipt,
    signature: await account.signTypedData({
      domain: domain(promise.chainId, promise.vault),
      types: receiptTypes,
      primaryType: "DeliveryReceipt",
      message: await receiptMessage(receipt),
    }),
  };
}

export async function signContinuityReceipt(
  account: LocalAccount,
  context: { chainId: number; vault: Address },
  receipt: ContinuityReceipt,
): Promise<Signed<ContinuityReceipt>> {
  return {
    payload: receipt,
    signature: await account.signTypedData({
      domain: domain(context.chainId, context.vault),
      types: continuityTypes,
      primaryType: "ContinuityReceipt",
      message: await continuityMessage(receipt),
    }),
  };
}

export async function recoverPromiseSigner(signed: Signed<ServicePromise>): Promise<Address> {
  const promise = signed.payload;
  return recoverTypedDataAddress({
    domain: domain(promise.chainId, promise.vault),
    types: promiseTypes,
    primaryType: "ServicePromise",
    message: await promiseMessage(promise),
    signature: signed.signature,
  });
}

export async function recoverReceiptSigner(
  promise: ServicePromise,
  signed: Signed<DeliveryReceipt>,
): Promise<Address> {
  return recoverTypedDataAddress({
    domain: domain(promise.chainId, promise.vault),
    types: receiptTypes,
    primaryType: "DeliveryReceipt",
    message: await receiptMessage(signed.payload),
    signature: signed.signature,
  });
}

export async function recoverContinuitySigner(
  context: { chainId: number; vault: Address },
  signed: Signed<ContinuityReceipt>,
): Promise<Address> {
  return recoverTypedDataAddress({
    domain: domain(context.chainId, context.vault),
    types: continuityTypes,
    primaryType: "ContinuityReceipt",
    message: await continuityMessage(signed.payload),
    signature: signed.signature,
  });
}

export async function hashPromise(promise: ServicePromise): Promise<Hex> {
  return hashTypedData({
    domain: domain(promise.chainId, promise.vault),
    types: promiseTypes,
    primaryType: "ServicePromise",
    message: await promiseMessage(promise),
  });
}
