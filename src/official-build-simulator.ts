import { privateKeyToAccount } from "viem/accounts";
import { hashCanonical, sha256Canonical } from "./canonical.js";
import { ContinuityCoordinator, type ProviderExecution, type ProviderExecutor } from "./coordinator.js";
import { hashPromise, hashRecoveryAttestation, recoverRecoveryAttestationSigner, signPromise, signReceipt } from "./signing.js";
import { MemoryContinuityTaskStore } from "./task-store.js";
import type { BondedProviderProfile, ServicePromise } from "./types.js";

const PRIMARY_KEY = `0x${"51".repeat(32)}` as const;
const BACKUP_KEY = `0x${"52".repeat(32)}` as const;
const BUYER_KEY = `0x${"53".repeat(32)}` as const;
const VERIFIER_KEY = `0x${"54".repeat(32)}` as const;

const primaryAccount = privateKeyToAccount(PRIMARY_KEY);
const backupAccount = privateKeyToAccount(BACKUP_KEY);
const buyer = privateKeyToAccount(BUYER_KEY);
const verifier = privateKeyToAccount(VERIFIER_KEY);
const chainId = 1952;
const vault = "0x4444444444444444444444444444444444440404" as const;
const officialStart = 1_789_603_200;

const providers: BondedProviderProfile[] = [
  {
    providerId: "official-atlas-primary",
    name: "Atlas Market Agent",
    serviceId: "official-market-primary-v1",
    endpoint: "https://relaybond-okx.vercel.app/v1/provider/quote",
    provider: primaryAccount.address,
    mode: "LOCAL",
    active: true,
    priceAtomic: "10000",
    bondAtomic: "5000000",
    minimumBondAtomic: "5000000",
    maximumLatencyMs: 1_500,
    maximumDataAgeSeconds: 20,
    supportedSchemas: ["market-quote-v1"],
    reliability: { verifiedCalls: 21, acceptedCalls: 20, recoveredCalls: 0 },
  },
  {
    providerId: "official-harbor-backup",
    name: "Harbor Recovery Agent",
    serviceId: "official-market-backup-v1",
    endpoint: "https://relaybond-okx.vercel.app/v1/continuity/backup",
    provider: backupAccount.address,
    mode: "LOCAL",
    active: true,
    priceAtomic: "10000",
    bondAtomic: "3000000",
    minimumBondAtomic: "2000000",
    maximumLatencyMs: 1_800,
    maximumDataAgeSeconds: 25,
    supportedSchemas: ["market-quote-v1"],
    reliability: { verifiedCalls: 16, acceptedCalls: 15, recoveredCalls: 4 },
  },
];

class OfficialBuildExecutor implements ProviderExecutor {
  constructor(private readonly outcomes: Record<string, "accepted" | "stale">) {}

  async execute(input: ProviderExecution) {
    const account = input.provider.providerId === providers[0]?.providerId ? primaryAccount : backupAccount;
    const deliveredAt = input.request.requestedAt + 1;
    const promise: ServicePromise = {
      version: "1",
      chainId,
      vault,
      serviceId: input.provider.serviceId,
      endpoint: input.provider.endpoint,
      responseTimeMs: input.provider.maximumLatencyMs,
      maxDataAgeSeconds: input.provider.maximumDataAgeSeconds,
      requiredSchema: "market-quote-v1",
      minimumRecords: 1,
      priceAtomic: input.provider.priceAtomic,
      bondAmountAtomic: input.provider.bondAtomic,
      rebateAtomic: input.provider.priceAtomic,
      refundOnBreach: true,
      validUntil: officialStart + 86_400,
      provider: input.provider.provider,
    };
    const response = {
      symbol: "BTC-USDT",
      price: input.provider.providerId === providers[0]?.providerId ? 62_500.25 : 62_501.1,
      observedAt: this.outcomes[input.provider.providerId] === "stale" ? deliveredAt - 120 : deliveredAt,
      source: input.provider.name,
    };
    const receipt = {
      version: "1" as const,
      serviceId: input.provider.serviceId,
      requestHash: hashCanonical(input.request),
      responseHash: hashCanonical(response),
      paymentId: hashCanonical({ taskId: input.taskId, source: input.paymentSource, provider: input.provider.providerId }),
      deliveredAt,
      servicePromiseHash: await hashPromise(promise),
      provider: input.provider.provider,
    };
    return {
      request: input.request,
      response,
      servicePromise: await signPromise(account, promise),
      deliveryReceipt: await signReceipt(account, promise, receipt),
    };
  }
}

async function runScenario(outcomes: Record<string, "accepted" | "stale">, requestedAt: number) {
  let clock = requestedAt;
  const coordinator = new ContinuityCoordinator({
    chainId,
    vault,
    verifier,
    providers,
    executor: new OfficialBuildExecutor(outcomes),
    store: new MemoryContinuityTaskStore(),
    now: () => ++clock,
  });
  return coordinator.execute({
    buyer: buyer.address,
    requestInput: { symbol: "BTC-USDT", officialBuild: true },
    requirement: { schema: "market-quote-v1", maximumPriceAtomic: "10000", maximumLatencyMs: 2_000 },
    requestedAt,
  });
}

export async function createOfficialCoordinatorEvidence() {
  const recovered = await runScenario({
    "official-atlas-primary": "stale",
    "official-harbor-backup": "accepted",
  }, officialStart + 3_600);
  const frozen = await runScenario({
    "official-atlas-primary": "stale",
    "official-harbor-backup": "stale",
  }, officialStart + 7_200);
  if (!recovered.recoveryAttestation || !recovered.continuityReceipt) {
    throw new Error("Official coordinator recovery evidence is incomplete.");
  }
  const recoveredSigner = await recoverRecoveryAttestationSigner(
    { chainId, vault },
    recovered.recoveryAttestation,
  );
  if (recoveredSigner.toLowerCase() !== verifier.address.toLowerCase()) {
    throw new Error("Recovery Attestation signer mismatch.");
  }
  if (recovered.task.state !== "RECOVERED" || frozen.task.state !== "FROZEN") {
    throw new Error("Official coordinator terminal states are inconsistent.");
  }
  const unsigned = {
    evidenceVersion: "official-build-1" as const,
    mode: "OFFICIAL_PERIOD_LOCAL_COORDINATOR" as const,
    generatedAt: new Date(officialStart * 1000).toISOString(),
    buildPeriod: {
      officialStart: new Date(officialStart * 1000).toISOString(),
      baselineTag: "v0.3.0",
      baselineCommit: "aa4bc8d508d690bc2599be88e6c49011fb589e69",
      status: "POST_START_LOCAL_IMPLEMENTATION" as const,
    },
    chainId,
    vault,
    buyer: buyer.address,
    verifier: verifier.address,
    providers,
    recovered,
    frozen,
    recoveryAttestationDigest: hashRecoveryAttestation(
      { chainId, vault },
      recovered.recoveryAttestation.payload,
    ),
    claims: {
      automaticPrimarySelection: true,
      automaticBackupSelection: true,
      primaryPaidByBuyer: true,
      backupAuthorizedFromPrimaryBond: true,
      doubleFailureFreezes: true,
      onchainSettlement: false,
    },
  };
  const evidenceHash = hashCanonical(unsigned);
  return {
    ...unsigned,
    evidenceHash,
    portableIntegrity: { algorithm: "SHA-256" as const, hash: sha256Canonical({ ...unsigned, evidenceHash }) },
  };
}

export type OfficialCoordinatorEvidence = Awaited<ReturnType<typeof createOfficialCoordinatorEvidence>>;
