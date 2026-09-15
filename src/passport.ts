import { hashCanonical } from "./canonical.js";
import type { JudgeEvidence } from "./types.js";

export type ReliabilityPassport = {
  passportVersion: "1";
  serviceId: string;
  provider: `0x${string}`;
  calls: number;
  acceptedCalls: number;
  breachedCalls: number;
  acceptanceRateBps: number;
  bondCoverageCalls: number;
  totalRebatedAtomic: string;
  breachReasons: Record<string, number>;
  latestEvidenceHash: `0x${string}`;
  generatedAt: string;
  passportHash: `0x${string}`;
};

export function buildReliabilityPassport(evidence: JudgeEvidence): ReliabilityPassport {
  const calls = evidence.scenarios.length;
  const acceptedCalls = evidence.scenarios.filter((scenario) => scenario.verification.status === "ACCEPTED").length;
  const breachedCalls = calls - acceptedCalls;
  const promise = evidence.servicePromise.payload;
  const remainingBond = BigInt(evidence.scenarios.at(-1)?.settlement.bondAfterAtomic || promise.bondAmountAtomic);
  const rebate = BigInt(promise.rebateAtomic);
  const breachReasons: Record<string, number> = {};
  for (const scenario of evidence.scenarios) {
    for (const violation of scenario.verification.violations) {
      breachReasons[violation] = (breachReasons[violation] || 0) + 1;
    }
  }
  const unsigned = {
    passportVersion: "1" as const,
    serviceId: promise.serviceId,
    provider: evidence.provider,
    calls,
    acceptedCalls,
    breachedCalls,
    acceptanceRateBps: calls === 0 ? 0 : Math.round((acceptedCalls / calls) * 10_000),
    bondCoverageCalls: rebate === 0n ? 0 : Number(remainingBond / rebate),
    totalRebatedAtomic: evidence.scenarios
      .reduce((sum, scenario) => sum + BigInt(scenario.settlement.rebateAtomic), 0n)
      .toString(),
    breachReasons,
    latestEvidenceHash: evidence.evidenceHash,
    generatedAt: evidence.generatedAt,
  };
  return { ...unsigned, passportHash: hashCanonical(unsigned) };
}
