import type { BondedProviderProfile, ServicePromise } from "./types.js";

export type ProviderRequirement = {
  schema: ServicePromise["requiredSchema"];
  maximumPriceAtomic: string;
  maximumLatencyMs: number;
};

export type RankedProvider = BondedProviderProfile & {
  score: number;
  bondCoverageCalls: number;
  acceptanceRateBps: number;
  eligible: boolean;
  reasons: string[];
};

export function rankBondedProviders(
  providers: BondedProviderProfile[],
  requirement: ProviderRequirement,
): RankedProvider[] {
  return providers.map((provider) => {
    const calls = provider.reliability.verifiedCalls;
    const acceptanceRateBps = calls === 0
      ? 0
      : Math.round((provider.reliability.acceptedCalls / calls) * 10_000);
    const bondCoverageCalls = BigInt(provider.priceAtomic) === 0n
      ? 0
      : Number(BigInt(provider.bondAtomic) / BigInt(provider.priceAtomic));
    const reasons: string[] = [];
    if (!provider.active) reasons.push("providerInactive");
    if (!provider.supportedSchemas.includes(requirement.schema)) reasons.push("schemaUnsupported");
    if (BigInt(provider.priceAtomic) > BigInt(requirement.maximumPriceAtomic)) reasons.push("priceAboveBudget");
    if (provider.maximumLatencyMs > requirement.maximumLatencyMs) reasons.push("latencyAboveRequirement");
    if (BigInt(provider.bondAtomic) < BigInt(provider.minimumBondAtomic)) reasons.push("bondBelowMinimum");
    const eligible = reasons.length === 0;
    const reliabilityPoints = Math.round((acceptanceRateBps / 10_000) * 35);
    const bondPoints = Math.min(25, Math.floor(bondCoverageCalls / 20));
    const latencyPoints = Math.max(0, 20 - Math.floor(provider.maximumLatencyMs / 250));
    const recoveryPoints = Math.min(5, provider.reliability.recoveredCalls * 0.5);
    const livePoints = provider.mode === "LIVE" || provider.mode === "TESTNET" ? 10 : 0;
    return {
      ...provider,
      score: eligible ? reliabilityPoints + bondPoints + latencyPoints + recoveryPoints + livePoints : 0,
      bondCoverageCalls,
      acceptanceRateBps,
      eligible,
      reasons,
    };
  }).sort((left, right) => right.score - left.score || left.priceAtomic.localeCompare(right.priceAtomic));
}

export function selectPrimaryAndBackup(
  providers: BondedProviderProfile[],
  requirement: ProviderRequirement,
) {
  const eligible = rankBondedProviders(providers, requirement).filter((provider) => provider.eligible);
  if (eligible.length < 2) throw new Error("Continuity recovery requires at least two eligible bonded providers.");
  const primary = eligible[0]!;
  const backup = eligible.slice(1).find((provider) => BigInt(provider.priceAtomic) <= BigInt(primary.priceAtomic));
  if (!backup) throw new Error("No independent backup fits within the buyer's primary payment.");
  return { primary, backup, ranked: eligible };
}
