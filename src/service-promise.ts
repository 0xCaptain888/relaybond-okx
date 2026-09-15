import { privateKeyToAccount } from "viem/accounts";
import type { ServicePromise } from "./types.js";

export function configuredServicePromise(): ServicePromise {
  const providerKey = process.env.PROVIDER_SIGNING_KEY as `0x${string}` | undefined;
  const vault = process.env.QUALITY_BOND_VAULT_ADDRESS as `0x${string}` | undefined;
  const baseUrl = process.env.PUBLIC_BASE_URL;
  if (!providerKey || !vault || !baseUrl) {
    throw new Error("PROVIDER_SIGNING_KEY, QUALITY_BOND_VAULT_ADDRESS and PUBLIC_BASE_URL are required");
  }
  const provider = privateKeyToAccount(providerKey);
  const validUntil = Number(process.env.SERVICE_PROMISE_VALID_UNTIL || 1_798_761_599);
  if (!Number.isSafeInteger(validUntil) || validUntil <= Math.floor(Date.now() / 1000)) {
    throw new Error("SERVICE_PROMISE_VALID_UNTIL must be a future unix timestamp");
  }
  return {
    version: "1",
    chainId: (process.env.X402_NETWORK || "eip155:1952") === "eip155:196" ? 196 : 1952,
    vault,
    serviceId: process.env.SERVICE_ID || "market-data-v1",
    endpoint: `${baseUrl.replace(/\/$/, "")}/v1/provider/quote`,
    responseTimeMs: 2_000,
    maxDataAgeSeconds: 30,
    requiredSchema: "market-quote-v1",
    minimumRecords: 1,
    priceAtomic: process.env.X402_PRICE_ATOMIC || "10000",
    bondAmountAtomic: process.env.MINIMUM_BOND_ATOMIC || "5000000",
    rebateAtomic: process.env.REBATE_ATOMIC || "10000",
    refundOnBreach: true,
    validUntil,
    provider: provider.address,
  };
}
