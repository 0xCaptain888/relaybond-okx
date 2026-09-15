import { decodePaymentSignatureHeader } from "@okxweb3/x402-core/http";
import { getAddress, isAddress, type Address, type Hex } from "viem";
import { hashCanonical } from "./canonical.js";

export type DeliveryScenario = "accepted" | "empty" | "stale";

type ExpectedPayment = {
  network: string;
  asset: Address;
  amount: string;
  payTo: Address;
};

type VerifiedPaymentContext = {
  buyer: Address;
  paymentId: Hex;
};

function scalar(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

function sameAddress(left: unknown, right: Address): boolean {
  return typeof left === "string" && isAddress(left) && getAddress(left) === getAddress(right);
}

export function normalizeServiceInput(
  body: unknown,
  query: Record<string, unknown> = {},
): { symbol: string; scenario: DeliveryScenario; input: Record<string, unknown> } {
  const object = body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
  const symbol = (scalar(object.symbol) || scalar(query.symbol) || "BTC-USDT").toUpperCase();
  if (!/^[A-Z0-9]+-[A-Z0-9]+$/.test(symbol)) throw new Error("invalid OKX instrument id");
  const requestedScenario = (scalar(object.scenario) || scalar(query.scenario) || "accepted").toLowerCase();
  if (!(["accepted", "empty", "stale"] as string[]).includes(requestedScenario)) {
    throw new Error("scenario must be accepted, empty or stale");
  }
  const scenario = requestedScenario as DeliveryScenario;
  return {
    symbol,
    scenario,
    input: scenario === "accepted" ? { symbol } : { symbol, scenario },
  };
}

/**
 * This function must only be called after the x402 middleware has accepted the
 * request. It decodes the exact payload that the facilitator verified and
 * refuses any mismatch with the protected route's configured terms.
 */
export function paymentContextFromVerifiedHeader(
  header: string | undefined,
  expected: ExpectedPayment,
): VerifiedPaymentContext {
  if (!header) throw new Error("verified payment header is missing");
  const decoded = decodePaymentSignatureHeader(header);
  const accepted = decoded.accepted;
  const payload = decoded.payload as Record<string, unknown>;
  const authorization = payload.authorization;
  if (!authorization || typeof authorization !== "object" || Array.isArray(authorization)) {
    throw new Error("verified payment payload does not contain an EIP-3009 authorization");
  }
  const auth = authorization as Record<string, unknown>;
  if (
    accepted.network !== expected.network ||
    accepted.amount !== expected.amount ||
    !sameAddress(accepted.asset, expected.asset) ||
    !sameAddress(accepted.payTo, expected.payTo) ||
    auth.value !== expected.amount ||
    !sameAddress(auth.to, expected.payTo)
  ) {
    throw new Error("verified payment payload does not match the RelayBond service terms");
  }
  if (typeof auth.from !== "string" || !isAddress(auth.from)) {
    throw new Error("verified payment payload does not contain a valid payer");
  }
  return {
    buyer: getAddress(auth.from),
    paymentId: hashCanonical({ paymentSignature: header }),
  };
}

export function buildScenarioResponse<T extends { observedAt: number }>(
  response: T,
  scenario: DeliveryScenario,
  maxDataAgeSeconds: number,
): T | Record<string, never> {
  if (scenario === "empty") return {};
  if (scenario === "stale") {
    return { ...response, observedAt: Math.max(1, response.observedAt - maxDataAgeSeconds - 60) };
  }
  return response;
}
