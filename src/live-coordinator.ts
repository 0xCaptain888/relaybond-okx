import type { Address, LocalAccount } from "viem";
import { hashCanonical, sha256Canonical } from "./canonical.js";
import {
  ContinuityCoordinator,
  type ContinuityCoordinatorResult,
  type ProviderDelivery,
  type ProviderExecution,
  type ProviderExecutor,
} from "./coordinator.js";
import { selectPrimaryAndBackup, type ProviderRequirement } from "./registry.js";
import { MemoryContinuityTaskStore } from "./task-store.js";
import type { VerifiedOnchainSettlement } from "./settlement.js";
import type { BondedProviderProfile } from "./types.js";
import { validateLiveRecoveryEvidence } from "./v2-settlement.js";

export function assertLiveProviderProfiles(providers: BondedProviderProfile[]): void {
  const active = providers.filter((provider) => provider.active);
  if (active.length < 2) throw new Error("LIVE coordinator requires at least two active Providers.");
  const invalid = active.filter((provider) => provider.mode !== "TESTNET" && provider.mode !== "LIVE");
  if (invalid.length > 0) {
    throw new Error(`LIVE coordinator rejects non-live Provider modes: ${invalid.map((provider) => `${provider.providerId}:${provider.mode}`).join(", ")}.`);
  }
}

export function validatePaidPrimaryBinding(input: {
  primary: BondedProviderProfile;
  delivery: ProviderDelivery;
  settlement: VerifiedOnchainSettlement;
}): void {
  const { primary, delivery, settlement } = input;
  if (settlement.status !== "success") throw new Error("Primary payment settlement is not successful.");
  if (settlement.payer.toLowerCase() !== delivery.request.buyer.toLowerCase()) {
    throw new Error("Primary payment payer does not match the recorded buyer.");
  }
  if (settlement.payTo.toLowerCase() !== primary.provider.toLowerCase()) {
    throw new Error("Primary payment recipient does not match the selected Provider.");
  }
  if (settlement.amountAtomic !== primary.priceAtomic) {
    throw new Error("Primary payment amount does not match the selected Provider price.");
  }
  if (delivery.request.serviceId !== primary.serviceId) {
    throw new Error("Paid primary delivery service does not match the selected Provider.");
  }
}

class RecordedPrimaryExecutor implements ProviderExecutor {
  constructor(
    private readonly primaryProviderId: string,
    private readonly primaryDelivery: ProviderDelivery,
    private readonly backupExecutor: ProviderExecutor,
  ) {}

  async execute(input: ProviderExecution): Promise<ProviderDelivery> {
    if (input.provider.providerId !== this.primaryProviderId) return this.backupExecutor.execute(input);
    if (hashCanonical(input.request) !== hashCanonical(this.primaryDelivery.request)) {
      throw new Error("Recorded paid primary delivery is not bound to the coordinator request.");
    }
    return structuredClone(this.primaryDelivery);
  }
}

export async function createLiveCoordinatorEvidence(input: {
  chainId: number;
  vault: Address;
  verifier: LocalAccount;
  providers: BondedProviderProfile[];
  primaryDelivery: ProviderDelivery;
  primarySettlement: VerifiedOnchainSettlement;
  backupExecutor: ProviderExecutor;
  requirement: ProviderRequirement;
  generatedAt?: Date;
}): Promise<{
  evidenceVersion: "official-v2-live-coordinator-1";
  mode: "XLAYER_TESTNET_LIVE_COORDINATOR";
  generatedAt: string;
  chainId: number;
  vault: Address;
  buyer: Address;
  verifier: Address;
  primaryPayment: VerifiedOnchainSettlement;
  recovered: ContinuityCoordinatorResult;
  evidenceHash: `0x${string}`;
  portableIntegrity: { algorithm: "SHA-256"; hash: `0x${string}` };
}> {
  assertLiveProviderProfiles(input.providers);
  const selection = selectPrimaryAndBackup(input.providers, input.requirement);
  validatePaidPrimaryBinding({
    primary: selection.primary,
    delivery: input.primaryDelivery,
    settlement: input.primarySettlement,
  });
  const request = input.primaryDelivery.request;
  let clock = Math.max(request.requestedAt, input.primaryDelivery.deliveryReceipt.payload.deliveredAt);
  const coordinator = new ContinuityCoordinator({
    chainId: input.chainId,
    vault: input.vault,
    verifier: input.verifier,
    providers: input.providers,
    executor: new RecordedPrimaryExecutor(selection.primary.providerId, input.primaryDelivery, input.backupExecutor),
    store: new MemoryContinuityTaskStore(),
    now: () => ++clock,
  });
  const recovered = await coordinator.execute({
    buyer: request.buyer,
    requestInput: request.input,
    requirement: input.requirement,
    requestedAt: request.requestedAt,
  });
  if (recovered.task.state !== "RECOVERED" || recovered.primary.verification.status !== "BREACH" || recovered.backup?.verification.status !== "ACCEPTED") {
    throw new Error("LIVE coordinator did not reach BREACH → ACCEPTED → RECOVERED; no evidence was published.");
  }
  const generatedAt = input.generatedAt ?? new Date();
  const unsigned = {
    evidenceVersion: "official-v2-live-coordinator-1" as const,
    mode: "XLAYER_TESTNET_LIVE_COORDINATOR" as const,
    generatedAt: generatedAt.toISOString(),
    chainId: input.chainId,
    vault: input.vault,
    buyer: request.buyer,
    verifier: input.verifier.address,
    primaryPayment: input.primarySettlement,
    recovered,
  };
  const validation = await validateLiveRecoveryEvidence(unsigned, {
    chainId: input.chainId,
    vault: input.vault,
    verifier: input.verifier.address,
    checkedAt: Math.floor(generatedAt.getTime() / 1_000),
  });
  if (!validation.passed) throw new Error(`Generated LIVE coordinator evidence failed validation: ${JSON.stringify(validation.checks)}`);
  const evidenceHash = hashCanonical(unsigned);
  return {
    ...unsigned,
    evidenceHash,
    portableIntegrity: { algorithm: "SHA-256", hash: sha256Canonical({ ...unsigned, evidenceHash }) },
  };
}
