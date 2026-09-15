import {
  hashTypedData,
  recoverTypedDataAddress,
  type Address,
  type Hex,
  type LocalAccount,
} from "viem";
import type { DeliveryReceipt, ServicePromise, Signed } from "./types.js";

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

export async function hashPromise(promise: ServicePromise): Promise<Hex> {
  return hashTypedData({
    domain: domain(promise.chainId, promise.vault),
    types: promiseTypes,
    primaryType: "ServicePromise",
    message: await promiseMessage(promise),
  });
}
