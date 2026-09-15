import { privateKeyToAccount } from "viem/accounts";
import { hashCanonical, sha256Canonical } from "./canonical.js";
import { buildContinuityReceipt } from "./continuity.js";
import { selectPrimaryAndBackup } from "./registry.js";
import { hashPromise, signContinuityReceipt, signPromise, signReceipt } from "./signing.js";
import type {
  BondedProviderProfile,
  ContinuityEvidence,
  DeliveryReceipt,
  ServicePromise,
  ServiceRequest,
} from "./types.js";
import { verifyDelivery } from "./verifier.js";

const PRIMARY_KEY = `0x${"11".repeat(32)}` as const;
const BACKUP_KEY = `0x${"22".repeat(32)}` as const;
const BUYER_KEY = `0x${"33".repeat(32)}` as const;
const VERIFIER_KEY = `0x${"44".repeat(32)}` as const;

export async function createContinuityEvidence(): Promise<ContinuityEvidence> {
  const primaryAccount = privateKeyToAccount(PRIMARY_KEY);
  const backupAccount = privateKeyToAccount(BACKUP_KEY);
  const buyer = privateKeyToAccount(BUYER_KEY);
  const verifier = privateKeyToAccount(VERIFIER_KEY);
  const chainId = 1952;
  const vault = "0x2222222222222222222222222222222222220295" as const;
  // Fixed to the pre-build prototype date; deterministic evidence must never
  // look like it was generated in the future or during the official period.
  const baseTime = 1_789_430_400;
  const providers: BondedProviderProfile[] = [
    {
      providerId: "relaybond-market-primary",
      name: "Atlas Market Agent",
      serviceId: "market-data-primary-v2",
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
      reliability: { verifiedCalls: 20, acceptedCalls: 19, recoveredCalls: 0 },
    },
    {
      providerId: "relaybond-market-backup",
      name: "Harbor Quote Agent",
      serviceId: "market-data-backup-v2",
      endpoint: "https://backup.relaybond.local/v1/quote",
      provider: backupAccount.address,
      mode: "LOCAL",
      active: true,
      priceAtomic: "10000",
      bondAtomic: "3000000",
      minimumBondAtomic: "2000000",
      maximumLatencyMs: 1_800,
      maximumDataAgeSeconds: 25,
      supportedSchemas: ["market-quote-v1"],
      reliability: { verifiedCalls: 15, acceptedCalls: 14, recoveredCalls: 3 },
    },
  ];
  const selection = selectPrimaryAndBackup(providers, {
    schema: "market-quote-v1",
    maximumPriceAtomic: "10000",
    maximumLatencyMs: 2_000,
  });
  const taskId = hashCanonical({ buyer: buyer.address, input: { symbol: "BTC-USDT" }, requestedAt: baseTime });
  const task = { taskId, input: { symbol: "BTC-USDT" }, requestedAt: baseTime };

  async function makePromise(provider: typeof selection.primary, maxAge: number): Promise<ServicePromise> {
    return {
      version: "1",
      chainId,
      vault,
      serviceId: provider.serviceId,
      endpoint: provider.endpoint,
      responseTimeMs: provider.maximumLatencyMs,
      maxDataAgeSeconds: maxAge,
      requiredSchema: "market-quote-v1",
      minimumRecords: 1,
      priceAtomic: provider.priceAtomic,
      bondAmountAtomic: provider.bondAtomic,
      rebateAtomic: provider.priceAtomic,
      refundOnBreach: true,
      validUntil: baseTime + 86_400,
      provider: provider.provider,
    };
  }

  async function makeDelivery(input: {
    provider: typeof selection.primary;
    account: typeof primaryAccount;
    promise: ServicePromise;
    request: ServiceRequest;
    response: unknown;
    deliveredAt: number;
    paymentSource: "BUYER" | "PRIMARY_BOND";
  }) {
    const signedPromise = await signPromise(input.account, input.promise);
    const receipt: DeliveryReceipt = {
      version: "1",
      serviceId: input.promise.serviceId,
      requestHash: hashCanonical(input.request),
      responseHash: hashCanonical(input.response),
      paymentId: hashCanonical({ taskId, provider: input.provider.providerId, source: input.paymentSource }),
      deliveredAt: input.deliveredAt,
      servicePromiseHash: await hashPromise(input.promise),
      provider: input.provider.provider,
    };
    const deliveryReceipt = await signReceipt(input.account, input.promise, receipt);
    const verification = await verifyDelivery({
      promise: signedPromise,
      request: input.request,
      response: input.response,
      receipt: deliveryReceipt,
      checkedAt: input.deliveredAt,
    });
    return { request: input.request, response: input.response, servicePromise: signedPromise, deliveryReceipt, verification };
  }

  const primaryPromise = await makePromise(selection.primary, 20);
  const primaryRequest: ServiceRequest = {
    serviceId: selection.primary.serviceId,
    requestedAt: baseTime,
    input: task.input,
    buyer: buyer.address,
  };
  const primary = await makeDelivery({
    provider: selection.primary,
    account: primaryAccount,
    promise: primaryPromise,
    request: primaryRequest,
    response: { symbol: "BTC-USDT", price: 62_450.25, observedAt: baseTime - 120 },
    deliveredAt: baseTime + 1,
    paymentSource: "BUYER",
  });

  const backupPromise = await makePromise(selection.backup, 25);
  const recoveryRequest: ServiceRequest = {
    serviceId: selection.backup.serviceId,
    requestedAt: baseTime + 2,
    input: { ...task.input, continuityTaskId: taskId },
    buyer: buyer.address,
  };
  const recovery = await makeDelivery({
    provider: selection.backup,
    account: backupAccount,
    promise: backupPromise,
    request: recoveryRequest,
    response: { symbol: "BTC-USDT", price: 62_451.1, observedAt: baseTime + 2 },
    deliveredAt: baseTime + 3,
    paymentSource: "PRIMARY_BOND",
  });
  const continuityPayload = buildContinuityReceipt({
    taskId,
    requestHash: hashCanonical(task),
    primaryProvider: selection.primary.provider,
    backupProvider: selection.backup.provider,
    primaryPriceAtomic: selection.primary.priceAtomic,
    backupPriceAtomic: selection.backup.priceAtomic,
    primaryVerification: primary.verification,
    backupVerification: recovery.verification,
    completedAt: baseTime + 3,
    verifier: verifier.address,
  });
  const continuityReceipt = await signContinuityReceipt(verifier, { chainId, vault }, continuityPayload);
  const unsigned = {
    evidenceVersion: "2" as const,
    mode: "DETERMINISTIC_LOCAL_RECOVERY" as const,
    generatedAt: new Date(baseTime * 1000).toISOString(),
    chainId,
    vault,
    buyer: buyer.address,
    verifier: verifier.address,
    providers,
    task,
    primary,
    recovery,
    continuityReceipt,
    stages: [
      { state: "PAID" as const, description: "Buyer pays the primary provider exactly once." },
      { state: "BREACH" as const, description: "Primary delivery fails the signed freshness promise." },
      { state: "REBATED_TO_RECOVERY" as const, description: "Verifier allocates the primary Quality Bond to recovery." },
      { state: "BACKUP_DELIVERED" as const, description: "Independent backup provider returns a valid signed quote." },
      { state: "RECOVERED" as const, description: "Backup is paid from the primary bond; buyer is not charged again." },
    ],
    economics: {
      buyerPaidAtomic: selection.primary.priceAtomic,
      primaryProviderRevenueAtomic: selection.primary.priceAtomic,
      backupProviderRevenueAtomic: selection.backup.priceAtomic,
      fundedFromPrimaryBondAtomic: selection.backup.priceAtomic,
      buyerDoubleCharged: false,
      primaryBondBeforeAtomic: selection.primary.bondAtomic,
      primaryBondAfterAtomic: (BigInt(selection.primary.bondAtomic) - BigInt(selection.backup.priceAtomic)).toString(),
    },
  };
  const evidenceHash = hashCanonical(unsigned);
  return {
    ...unsigned,
    evidenceHash,
    portableIntegrity: { algorithm: "SHA-256", hash: sha256Canonical({ ...unsigned, evidenceHash }) },
  };
}
