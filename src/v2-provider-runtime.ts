import { timingSafeEqual } from "node:crypto";
import { privateKeyToAccount } from "viem/accounts";
import { assertLiveProviderProfiles } from "./live-coordinator.js";
import { parseProviderConfiguration } from "./provider-config.js";
import type { ServicePromise } from "./types.js";

export function backupAuthorizationMatches(provided: string | undefined, expected: string): boolean {
  if (!provided || expected.length < 32) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function configuredV2ProviderRuntime() {
  const required = [
    "PUBLIC_BASE_URL",
    "RECOVERY_BOND_VAULT_V2_ADDRESS",
    "PROVIDER_SIGNING_KEY",
    "BACKUP_PROVIDER_SIGNING_KEY",
    "BACKUP_PROVIDER_AUTH_TOKEN",
    "CONTINUITY_PROVIDERS_JSON",
  ] as const;
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) throw new Error(`Missing V2 Provider runtime configuration: ${missing.join(", ")}`);
  const providers = parseProviderConfiguration(process.env.CONTINUITY_PROVIDERS_JSON!);
  assertLiveProviderProfiles(providers);
  const primaryServiceId = process.env.V2_PRIMARY_SERVICE_ID || "official-market-primary-v1";
  const backupServiceId = process.env.V2_BACKUP_SERVICE_ID || "official-market-backup-v1";
  const primary = providers.find((provider) => provider.serviceId === primaryServiceId);
  const backup = providers.find((provider) => provider.serviceId === backupServiceId);
  if (!primary || !backup) throw new Error("V2 Provider configuration must contain the official Primary and Backup service IDs.");
  const primaryAccount = privateKeyToAccount(process.env.PROVIDER_SIGNING_KEY as `0x${string}`);
  const backupAccount = privateKeyToAccount(process.env.BACKUP_PROVIDER_SIGNING_KEY as `0x${string}`);
  if (primaryAccount.address.toLowerCase() !== primary.provider.toLowerCase()) throw new Error("Primary signing key does not match the configured V2 Provider.");
  if (backupAccount.address.toLowerCase() !== backup.provider.toLowerCase()) throw new Error("Backup signing key does not match the configured V2 Provider.");
  const baseUrl = process.env.PUBLIC_BASE_URL!.replace(/\/$/, "");
  const primaryEndpoint = `${baseUrl}/v1/provider/v2-primary`;
  const backupEndpoint = `${baseUrl}/v1/provider/v2-backup/deliver`;
  if (primary.endpoint !== primaryEndpoint) throw new Error("V2 Primary endpoint does not match PUBLIC_BASE_URL.");
  if (backup.endpoint !== backupEndpoint) throw new Error("V2 Backup endpoint does not match PUBLIC_BASE_URL.");
  const validUntil = Number(process.env.SERVICE_PROMISE_VALID_UNTIL || 1_798_761_599);
  if (!Number.isSafeInteger(validUntil) || validUntil <= Math.floor(Date.now() / 1_000)) {
    throw new Error("SERVICE_PROMISE_VALID_UNTIL must be a future unix timestamp.");
  }
  const primaryPromise: ServicePromise = {
    version: "1",
    chainId: 1952,
    vault: process.env.RECOVERY_BOND_VAULT_V2_ADDRESS as `0x${string}`,
    serviceId: primary.serviceId,
    endpoint: primary.endpoint,
    responseTimeMs: primary.maximumLatencyMs,
    maxDataAgeSeconds: primary.maximumDataAgeSeconds,
    requiredSchema: "market-quote-v1",
    minimumRecords: 1,
    priceAtomic: primary.priceAtomic,
    bondAmountAtomic: primary.bondAtomic,
    rebateAtomic: primary.priceAtomic,
    refundOnBreach: true,
    validUntil,
    provider: primary.provider,
  };
  return {
    providers,
    primary,
    backup,
    primaryAccount,
    backupAccount,
    primaryPromise,
    backupAuthorizationToken: process.env.BACKUP_PROVIDER_AUTH_TOKEN!,
  };
}
