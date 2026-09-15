import { hashCanonical } from "./canonical.js";
import type { JudgeEvidence, VerificationStatus } from "./types.js";

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

export type LiveReliabilityPassport = {
  passportVersion: "1";
  scope: "VERIFIED_XLAYER_TESTNET_DELIVERIES";
  serviceId: string;
  provider: `0x${string}`;
  calls: number;
  acceptedCalls: number;
  breachedCalls: number;
  acceptanceRateBps: number;
  bondBalanceAtomic: string;
  rebateAtomic: string;
  bondCoverageCalls: number;
  totalPaidAtomic: string;
  totalRebatedAtomic: string;
  latestEvidenceHash: `0x${string}`;
  latestSettlementTx: `0x${string}`;
  generatedAt: string;
  passportHash: `0x${string}`;
};

export function buildLiveReliabilityPassport(input: {
  serviceId: string;
  provider: `0x${string}`;
  status: VerificationStatus;
  bondBalanceAtomic: string;
  rebateAtomic: string;
  paidAtomic: string;
  rebatedAtomic?: string;
  evidenceHash: `0x${string}`;
  settlementTx: `0x${string}`;
  generatedAt: string;
}): LiveReliabilityPassport {
  const acceptedCalls = input.status === "ACCEPTED" ? 1 : 0;
  const breachedCalls = input.status === "BREACH" ? 1 : 0;
  const rebate = BigInt(input.rebateAtomic);
  const unsigned = {
    passportVersion: "1" as const,
    scope: "VERIFIED_XLAYER_TESTNET_DELIVERIES" as const,
    serviceId: input.serviceId,
    provider: input.provider,
    calls: 1,
    acceptedCalls,
    breachedCalls,
    acceptanceRateBps: acceptedCalls * 10_000,
    bondBalanceAtomic: input.bondBalanceAtomic,
    rebateAtomic: input.rebateAtomic,
    bondCoverageCalls: rebate === 0n ? 0 : Number(BigInt(input.bondBalanceAtomic) / rebate),
    totalPaidAtomic: input.paidAtomic,
    totalRebatedAtomic: input.rebatedAtomic || "0",
    latestEvidenceHash: input.evidenceHash,
    latestSettlementTx: input.settlementTx,
    generatedAt: input.generatedAt,
  };
  return { ...unsigned, passportHash: hashCanonical(unsigned) };
}
