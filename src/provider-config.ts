import { isAddress, type Address } from "viem";
import type { BondedProviderProfile, ProviderMode, ServicePromise } from "./types.js";

const providerKeys = new Set([
  "providerId",
  "name",
  "serviceId",
  "endpoint",
  "provider",
  "mode",
  "active",
  "priceAtomic",
  "bondAtomic",
  "minimumBondAtomic",
  "maximumLatencyMs",
  "maximumDataAgeSeconds",
  "supportedSchemas",
  "reliability",
]);
const reliabilityKeys = new Set(["verifiedCalls", "acceptedCalls", "recoveredCalls"]);
const modes = new Set<ProviderMode>(["LIVE", "TESTNET", "LOCAL", "DESIGN"]);
const schemas = new Set<ServicePromise["requiredSchema"]>(["market-quote-v1", "generic-records-v1"]);

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path} must be an object.`);
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${path} must be a non-empty string.`);
  return value;
}

function integer(value: unknown, path: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum) throw new Error(`${path} must be an integer >= ${minimum}.`);
  return Number(value);
}

function atomic(value: unknown, path: string, allowZero = false): string {
  const parsed = string(value, path);
  if (!/^(0|[1-9][0-9]*)$/.test(parsed) || (!allowZero && BigInt(parsed) === 0n)) {
    throw new Error(`${path} must be a ${allowZero ? "non-negative" : "positive"} atomic-unit integer string.`);
  }
  return parsed;
}

function endpoint(value: unknown, mode: ProviderMode, path: string): string {
  const parsed = new URL(string(value, path));
  if (parsed.username || parsed.password || parsed.hash) throw new Error(`${path} cannot contain credentials or a fragment.`);
  const localHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]";
  if (parsed.protocol !== "https:" && !(mode === "LOCAL" && parsed.protocol === "http:" && localHost)) {
    throw new Error(`${path} must use HTTPS; LOCAL providers may use loopback HTTP.`);
  }
  return parsed.toString();
}

function exactKeys(value: Record<string, unknown>, allowed: Set<string>, path: string): void {
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (unexpected.length > 0) throw new Error(`${path} contains unsupported fields: ${unexpected.join(", ")}.`);
}

function parseProvider(value: unknown, index: number): BondedProviderProfile {
  const path = `providers[${index}]`;
  const input = record(value, path);
  exactKeys(input, providerKeys, path);
  const mode = string(input.mode, `${path}.mode`) as ProviderMode;
  if (!modes.has(mode)) throw new Error(`${path}.mode is invalid.`);
  const provider = string(input.provider, `${path}.provider`);
  if (!isAddress(provider, { strict: false })) throw new Error(`${path}.provider must be an EVM address.`);
  if (typeof input.active !== "boolean") throw new Error(`${path}.active must be a boolean.`);
  if (!Array.isArray(input.supportedSchemas) || input.supportedSchemas.length === 0) {
    throw new Error(`${path}.supportedSchemas must contain at least one schema.`);
  }
  const supportedSchemas = input.supportedSchemas.map((value, schemaIndex) => {
    const schema = string(value, `${path}.supportedSchemas[${schemaIndex}]`) as ServicePromise["requiredSchema"];
    if (!schemas.has(schema)) throw new Error(`${path}.supportedSchemas[${schemaIndex}] is unsupported.`);
    return schema;
  });
  const reliability = record(input.reliability, `${path}.reliability`);
  exactKeys(reliability, reliabilityKeys, `${path}.reliability`);
  const verifiedCalls = integer(reliability.verifiedCalls, `${path}.reliability.verifiedCalls`);
  const acceptedCalls = integer(reliability.acceptedCalls, `${path}.reliability.acceptedCalls`);
  if (acceptedCalls > verifiedCalls) throw new Error(`${path}.reliability.acceptedCalls cannot exceed verifiedCalls.`);
  return {
    providerId: string(input.providerId, `${path}.providerId`),
    name: string(input.name, `${path}.name`),
    serviceId: string(input.serviceId, `${path}.serviceId`),
    endpoint: endpoint(input.endpoint, mode, `${path}.endpoint`),
    provider: provider as Address,
    mode,
    active: input.active,
    priceAtomic: atomic(input.priceAtomic, `${path}.priceAtomic`),
    bondAtomic: atomic(input.bondAtomic, `${path}.bondAtomic`, true),
    minimumBondAtomic: atomic(input.minimumBondAtomic, `${path}.minimumBondAtomic`, true),
    maximumLatencyMs: integer(input.maximumLatencyMs, `${path}.maximumLatencyMs`, 1),
    maximumDataAgeSeconds: integer(input.maximumDataAgeSeconds, `${path}.maximumDataAgeSeconds`, 1),
    supportedSchemas: [...new Set(supportedSchemas)],
    reliability: {
      verifiedCalls,
      acceptedCalls,
      recoveredCalls: integer(reliability.recoveredCalls, `${path}.reliability.recoveredCalls`),
    },
  };
}

export function parseProviderConfiguration(raw: string | unknown): BondedProviderProfile[] {
  const decoded = typeof raw === "string" ? JSON.parse(raw) as unknown : raw;
  const providersValue = Array.isArray(decoded) ? decoded : record(decoded, "provider configuration").providers;
  if (!Array.isArray(providersValue)) throw new Error("provider configuration must be an array or an object with providers[].");
  const providers = providersValue.map(parseProvider);
  const active = providers.filter((provider) => provider.active);
  if (active.length < 2) throw new Error("Continuity execution requires at least two active providers.");
  for (const field of ["providerId", "serviceId"] as const) {
    const values = providers.map((provider) => provider[field]);
    if (new Set(values).size !== values.length) throw new Error(`Provider ${field} values must be unique.`);
  }
  const identities = active.map((provider) => provider.provider.toLowerCase());
  if (new Set(identities).size < 2) throw new Error("Active Primary and Backup providers must use independent signing identities.");
  return providers;
}

export type ProviderConfigurationStatus = {
  configured: boolean;
  source: "CONTINUITY_PROVIDERS_JSON";
  providerCount: number;
  activeProviderCount: number;
  modes: ProviderMode[];
  error?: string;
};

export function providerConfigurationStatus(raw = process.env.CONTINUITY_PROVIDERS_JSON): ProviderConfigurationStatus {
  if (!raw) {
    return {
      configured: false,
      source: "CONTINUITY_PROVIDERS_JSON",
      providerCount: 0,
      activeProviderCount: 0,
      modes: [],
      error: "CONTINUITY_PROVIDERS_JSON is not configured.",
    };
  }
  try {
    const providers = parseProviderConfiguration(raw);
    return {
      configured: true,
      source: "CONTINUITY_PROVIDERS_JSON",
      providerCount: providers.length,
      activeProviderCount: providers.filter((provider) => provider.active).length,
      modes: [...new Set(providers.map((provider) => provider.mode))],
    };
  } catch (error) {
    return {
      configured: false,
      source: "CONTINUITY_PROVIDERS_JSON",
      providerCount: 0,
      activeProviderCount: 0,
      modes: [],
      error: error instanceof Error ? error.message : "Invalid provider configuration.",
    };
  }
}
