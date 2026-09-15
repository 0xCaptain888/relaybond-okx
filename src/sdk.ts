import type { VerificationInput } from "./verifier.js";
import type { VerificationResult } from "./types.js";
import type { ServicePromise, Signed } from "./types.js";
import type { BondedProviderProfile, ContinuityEvidence } from "./types.js";

export class RelayBondClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async servicePromise(): Promise<{ servicePromise: Signed<ServicePromise>; promiseHash: `0x${string}` }> {
    const response = await fetch(`${this.baseUrl}/v1/service/promise`);
    if (!response.ok) throw new Error(`RelayBond promise lookup failed: ${response.status}`);
    return response.json() as Promise<{ servicePromise: Signed<ServicePromise>; promiseHash: `0x${string}` }>;
  }

  async verify(input: VerificationInput): Promise<VerificationResult> {
    const response = await fetch(`${this.baseUrl}/v1/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error(`RelayBond verify failed: ${response.status}`);
    return response.json() as Promise<VerificationResult>;
  }

  async providers(): Promise<{ mode: string; notice: string; providers: BondedProviderProfile[] }> {
    const response = await fetch(`${this.baseUrl}/v1/providers`);
    if (!response.ok) throw new Error(`RelayBond provider registry lookup failed: ${response.status}`);
    return response.json() as Promise<{ mode: string; notice: string; providers: BondedProviderProfile[] }>;
  }

  async recoveryDemo(): Promise<ContinuityEvidence> {
    const response = await fetch(`${this.baseUrl}/v1/recovery/demo`);
    if (!response.ok) throw new Error(`RelayBond recovery demo failed: ${response.status}`);
    return response.json() as Promise<ContinuityEvidence>;
  }

  async paymentChallenge(input: { symbol: string; scenario?: "accepted" | "empty" | "stale" }) {
    const response = await fetch(`${this.baseUrl}/v1/provider/quote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (response.status !== 402) throw new Error(`Expected HTTP 402, received ${response.status}`);
    return {
      challenge: await response.json(),
      paymentRequired: response.headers.get("payment-required"),
    };
  }
}
