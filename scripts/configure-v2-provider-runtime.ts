import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { privateKeyToAccount } from "viem/accounts";

const envPath = ".env";
const primaryServiceId = "official-market-primary-v1";
const backupServiceId = "official-market-backup-v1";
const managedNames = new Set([
  "ALLOW_V2_PAID_BREACH",
  "BACKUP_PROVIDER_ADDRESS",
  "BACKUP_PROVIDER_AUTH_TOKEN",
  "CONTINUITY_PROVIDERS_JSON",
  "PRIMARY_PROVIDER_ADDRESS",
  "SERVICE_PROMISE_VALID_UNTIL",
  "V2_BACKUP_SERVICE_ID",
  "V2_PRIMARY_SERVICE_ID",
]);

const source = await readFile(envPath, "utf8");
const primaryKey = process.env.PROVIDER_SIGNING_KEY;
const backupKey = process.env.BACKUP_PROVIDER_SIGNING_KEY;
if (!primaryKey || !/^0x[0-9a-fA-F]{64}$/.test(primaryKey)) throw new Error("PROVIDER_SIGNING_KEY is missing or invalid.");
if (!backupKey || !/^0x[0-9a-fA-F]{64}$/.test(backupKey)) throw new Error("BACKUP_PROVIDER_SIGNING_KEY is missing or invalid.");
const primary = privateKeyToAccount(primaryKey as `0x${string}`);
const backup = privateKeyToAccount(backupKey as `0x${string}`);
if (primary.address.toLowerCase() === backup.address.toLowerCase()) throw new Error("Primary and Backup signing identities must be independent.");

const baseUrl = new URL(process.env.PUBLIC_BASE_URL || "");
if (baseUrl.protocol !== "https:" || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
  throw new Error("PUBLIC_BASE_URL must be a credential-free HTTPS origin.");
}
baseUrl.pathname = baseUrl.pathname.replace(/\/$/, "");
const publicBaseUrl = baseUrl.toString().replace(/\/$/, "");

const bonding = JSON.parse(await readFile("evidence/official-build/v2-bonding.json", "utf8")) as {
  verificationPassed?: boolean;
  final?: {
    primary?: { provider?: string; bondBalanceAtomic?: string; minimumBondAtomic?: string };
    backup?: { provider?: string; bondBalanceAtomic?: string; minimumBondAtomic?: string };
  };
};
if (!bonding.verificationPassed || !bonding.final?.primary || !bonding.final.backup) {
  throw new Error("Verified V2 bonding evidence is required before configuring the runtime.");
}
if (bonding.final.primary.provider?.toLowerCase() !== primary.address.toLowerCase()) {
  throw new Error("PROVIDER_SIGNING_KEY does not match the bonded Primary Provider.");
}
if (bonding.final.backup.provider?.toLowerCase() !== backup.address.toLowerCase()) {
  throw new Error("BACKUP_PROVIDER_SIGNING_KEY does not match the bonded Backup Provider.");
}
if (process.env.X402_PAY_TO?.toLowerCase() !== primary.address.toLowerCase()) {
  throw new Error("X402_PAY_TO does not match the bonded Primary Provider.");
}

const providers = [
  {
    providerId: "official-xlayer-primary",
    name: "RelayBond OKX Market Primary",
    serviceId: primaryServiceId,
    endpoint: `${publicBaseUrl}/v1/provider/v2-primary`,
    provider: primary.address,
    mode: "TESTNET",
    active: true,
    priceAtomic: "10000",
    bondAtomic: bonding.final.primary.bondBalanceAtomic,
    minimumBondAtomic: bonding.final.primary.minimumBondAtomic,
    maximumLatencyMs: 2_000,
    maximumDataAgeSeconds: 30,
    supportedSchemas: ["market-quote-v1"],
    reliability: { verifiedCalls: 0, acceptedCalls: 0, recoveredCalls: 0 },
  },
  {
    providerId: "official-xlayer-backup",
    name: "RelayBond OKX Market Backup",
    serviceId: backupServiceId,
    endpoint: `${publicBaseUrl}/v1/provider/v2-backup/deliver`,
    provider: backup.address,
    mode: "TESTNET",
    active: true,
    priceAtomic: "10000",
    bondAtomic: bonding.final.backup.bondBalanceAtomic,
    minimumBondAtomic: bonding.final.backup.minimumBondAtomic,
    maximumLatencyMs: 2_000,
    maximumDataAgeSeconds: 30,
    supportedSchemas: ["market-quote-v1"],
    reliability: { verifiedCalls: 0, acceptedCalls: 0, recoveredCalls: 0 },
  },
];
const existingToken = process.env.BACKUP_PROVIDER_AUTH_TOKEN;
const backupAuthorizationToken = existingToken && existingToken.length >= 32
  ? existingToken
  : randomBytes(48).toString("base64url");
const managedValues = new Map<string, string>([
  ["ALLOW_V2_PAID_BREACH", "true"],
  ["BACKUP_PROVIDER_ADDRESS", backup.address],
  ["BACKUP_PROVIDER_AUTH_TOKEN", backupAuthorizationToken],
  ["CONTINUITY_PROVIDERS_JSON", JSON.stringify({ providers })],
  ["PRIMARY_PROVIDER_ADDRESS", primary.address],
  ["SERVICE_PROMISE_VALID_UNTIL", process.env.SERVICE_PROMISE_VALID_UNTIL || "1798761599"],
  ["V2_BACKUP_SERVICE_ID", backupServiceId],
  ["V2_PRIMARY_SERVICE_ID", primaryServiceId],
]);
const preserved = source.split(/\r?\n/).filter((line) => {
  const match = /^([A-Z0-9_]+)=/.exec(line);
  return line && (!match || !managedNames.has(match[1]!));
});
const temporary = `.env.v2-runtime-${process.pid}`;
await writeFile(
  temporary,
  `${preserved.join("\n")}\n${[...managedValues].map(([name, value]) => `${name}=${value}`).join("\n")}\n`,
  { mode: 0o600 },
);
await rename(temporary, envPath);
await chmod(envPath, 0o600);

const publicEvidence = {
  evidenceVersion: "official-v2-provider-runtime-1",
  mode: "XLAYER_TESTNET_BONDED_PROVIDERS",
  configuredAt: new Date().toISOString(),
  publicBaseUrl,
  providers,
  controls: {
    primaryPaidBreachRequiresExplicitPayment: true,
    backupRequiresPrivateAuthorization: true,
    backupAuthorizationTokenStoredLocally: true,
    secretsPrinted: false,
  },
};
await mkdir("evidence/official-build", { recursive: true });
await writeFile("evidence/official-build/v2-provider-runtime.json", `${JSON.stringify(publicEvidence, null, 2)}\n`);
console.log(JSON.stringify({
  configured: true,
  file: envPath,
  permissions: "600",
  primary: { address: primary.address, endpoint: providers[0]!.endpoint },
  backup: { address: backup.address, endpoint: providers[1]!.endpoint },
  backupAuthorization: "configured but not displayed",
  evidence: "evidence/official-build/v2-provider-runtime.json",
}, null, 2));
