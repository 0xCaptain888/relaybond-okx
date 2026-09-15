import type { PaymentRequired, PaymentRequirements } from "@okxweb3/x402-core/types";

export type BuyerGuardrails = {
  network: string;
  asset: string;
  maxAmountAtomic: string;
  payTo?: string;
  scheme?: string;
  assetDecimals?: number;
};

export type PaymentPlan = {
  x402Version: number;
  scheme: string;
  network: string;
  asset: string;
  assetName: string;
  amountAtomic: string;
  amountDisplay: string;
  payTo: string;
  maxTimeoutSeconds: number;
  resourceUrl: string;
};

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function formatAtomic(amount: string, decimals: number): string {
  const value = BigInt(amount);
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = (value % divisor).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function selectGuardedRequirement(
  paymentRequired: PaymentRequired,
  guardrails: BuyerGuardrails,
): { requirement: PaymentRequirements; plan: PaymentPlan } {
  const scheme = guardrails.scheme || "exact";
  const matching = paymentRequired.accepts.filter(
    (candidate) =>
      candidate.scheme === scheme &&
      candidate.network === guardrails.network &&
      sameAddress(candidate.asset, guardrails.asset) &&
      (!guardrails.payTo || sameAddress(candidate.payTo, guardrails.payTo)),
  );

  if (matching.length === 0) {
    throw new Error("No payment requirement matches the configured network, asset, payee and scheme guardrails.");
  }

  const requirement = matching.reduce((cheapest, candidate) =>
    BigInt(candidate.amount) < BigInt(cheapest.amount) ? candidate : cheapest,
  );
  if (BigInt(requirement.amount) > BigInt(guardrails.maxAmountAtomic)) {
    throw new Error(
      `Payment amount ${requirement.amount} exceeds configured maximum ${guardrails.maxAmountAtomic}.`,
    );
  }
  if (/^0x0{40}$/i.test(requirement.asset) || /^0x0{40}$/i.test(requirement.payTo)) {
    throw new Error("Refusing a payment requirement with a zero token or payee address.");
  }

  const extra = requirement.extra as Record<string, unknown> | undefined;
  const decimals =
    typeof extra?.decimals === "number" ? extra.decimals : guardrails.assetDecimals ?? 6;
  const assetName = typeof extra?.name === "string" ? extra.name : "token";

  return {
    requirement,
    plan: {
      x402Version: paymentRequired.x402Version,
      scheme: requirement.scheme,
      network: requirement.network,
      asset: requirement.asset,
      assetName,
      amountAtomic: requirement.amount,
      amountDisplay: formatAtomic(requirement.amount, decimals),
      payTo: requirement.payTo,
      maxTimeoutSeconds: requirement.maxTimeoutSeconds,
      resourceUrl: paymentRequired.resource.url,
    },
  };
}
