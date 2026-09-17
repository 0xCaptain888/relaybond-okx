import type { VerificationInput } from "./verifier.js";
import type { VerificationResult } from "./types.js";
import type { ServicePromise, Signed } from "./types.js";
import type { BondedProviderProfile, ContinuityEvidence } from "./types.js";
import type { OfficialCoordinatorEvidence } from "./official-build-simulator.js";
import type { ProviderConfigurationStatus } from "./provider-config.js";

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

  async officialCoordinator(): Promise<OfficialCoordinatorEvidence> {
    const response = await fetch(`${this.baseUrl}/v1/official/coordinator`);
    if (!response.ok) throw new Error(`RelayBond official coordinator lookup failed: ${response.status}`);
    return response.json() as Promise<OfficialCoordinatorEvidence>;
  }

  async officialReadiness(): Promise<{
    mode: "OFFICIAL_PERIOD_PROVIDER_RUNTIME";
    configuration: ProviderConfigurationStatus;
    transport: { executor: string; endpointBinding: boolean; redirectsAllowed: boolean; timeoutMs: number; maximumResponseBytes: number };
    paymentBoundary: { automaticPayment: boolean; behavior: string };
    settlement: {
      v2Broadcast: boolean;
      status: "PENDING" | "TESTNET" | "LIVE";
      contract?: `0x${string}`;
      sourceVerified?: boolean;
      providerRegistration?: "PENDING" | "TESTNET" | "LIVE";
      backupSettlement?: "PENDING" | "TESTNET" | "LIVE";
    };
  }> {
    const response = await fetch(`${this.baseUrl}/v1/official/readiness`);
    if (!response.ok) throw new Error(`RelayBond official runtime readiness failed: ${response.status}`);
    return response.json();
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
