import { keccak256, stringToHex, type Address, type Hex, type LocalAccount } from "viem";
import { hashCanonical } from "./canonical.js";
import { buildContinuityReceipt } from "./continuity.js";
import { selectPrimaryAndBackup, type ProviderRequirement, type RankedProvider } from "./registry.js";
import { signContinuityReceipt, signRecoveryAttestation } from "./signing.js";
import type { ContinuityTaskStore } from "./task-store.js";
import type {
  BondedProviderProfile,
  ContinuityReceipt,
  ContinuityTaskRecord,
  DeliveryReceipt,
  RecoveryAttestation,
  ServicePromise,
  ServiceRequest,
  Signed,
  VerificationResult,
} from "./types.js";
import { verifyDelivery } from "./verifier.js";

export type ProviderDelivery = {
  request: ServiceRequest;
  response: unknown;
  servicePromise: Signed<ServicePromise>;
  deliveryReceipt: Signed<DeliveryReceipt>;
};

export type ProviderExecution = {
  provider: RankedProvider;
  taskId: Hex;
  request: ServiceRequest;
  paymentSource: "BUYER" | "PRIMARY_BOND";
};

export interface ProviderExecutor {
  execute(input: ProviderExecution): Promise<ProviderDelivery>;
}

export type ContinuityCoordinatorResult = {
  task: ContinuityTaskRecord;
  primary: ProviderDelivery & { verification: VerificationResult };
  backup?: ProviderDelivery & { verification: VerificationResult };
  continuityReceipt?: Signed<ContinuityReceipt>;
  recoveryAttestation?: Signed<RecoveryAttestation>;
};

export class ContinuityCoordinator {
  constructor(private readonly dependencies: {
    chainId: number;
    vault: Address;
    verifier: LocalAccount;
    providers: BondedProviderProfile[];
    executor: ProviderExecutor;
    store: ContinuityTaskStore;
    now?: () => number;
    recoveryWindowSeconds?: number;
  }) {}

  async execute(input: {
    buyer: Address;
    requestInput: Record<string, unknown>;
    requirement: ProviderRequirement;
    requestedAt?: number;
  }): Promise<ContinuityCoordinatorResult> {
    const now = this.dependencies.now ?? (() => Math.floor(Date.now() / 1000));
    const requestedAt = input.requestedAt ?? now();
    const taskId = hashCanonical({ buyer: input.buyer, input: input.requestInput, requestedAt });
    const requestHash = hashCanonical({ taskId, buyer: input.buyer, input: input.requestInput, requestedAt });
    await this.dependencies.store.create({
      taskId,
      buyer: input.buyer,
      requestHash,
      input: input.requestInput,
      state: "QUEUED",
      createdAt: requestedAt,
      updatedAt: requestedAt,
      events: [{ state: "QUEUED", at: requestedAt, description: "Continuity task accepted by the coordinator." }],
    });

    const selection = selectPrimaryAndBackup(this.dependencies.providers, input.requirement);
    await this.dependencies.store.transition(taskId, {
      state: "PRIMARY_SELECTED",
      at: now(),
      providerId: selection.primary.providerId,
      description: `Primary selected with score ${selection.primary.score}.`,
    });

    const primaryRequest: ServiceRequest = {
      serviceId: selection.primary.serviceId,
      requestedAt,
      input: input.requestInput,
      buyer: input.buyer,
    };
    let primaryDelivery: ProviderDelivery;
    try {
      primaryDelivery = await this.dependencies.executor.execute({
        provider: selection.primary,
        taskId,
        request: primaryRequest,
        paymentSource: "BUYER",
      });
    } catch (error) {
      const task = await this.dependencies.store.transition(taskId, {
        state: "FROZEN",
        at: now(),
        providerId: selection.primary.providerId,
        description: `Primary execution failed before verifiable delivery: ${error instanceof Error ? error.message : "unknown error"}`,
      });
      throw new ContinuityExecutionError("PRIMARY_EXECUTION_FAILED", task, error);
    }
    const primaryVerification = await verifyDelivery({
      promise: primaryDelivery.servicePromise,
      request: primaryDelivery.request,
      response: primaryDelivery.response,
      receipt: primaryDelivery.deliveryReceipt,
      checkedAt: primaryDelivery.deliveryReceipt.payload.deliveredAt,
    });
    const primary = { ...primaryDelivery, verification: primaryVerification };
    if (primaryVerification.status === "ACCEPTED") {
      const task = await this.dependencies.store.transition(taskId, {
        state: "ACCEPTED",
        at: now(),
        providerId: selection.primary.providerId,
        evidenceHash: primaryVerification.evidenceHash,
        description: "Primary delivery satisfied the signed service promise; backup was not required.",
      });
      return { task, primary };
    }

    await this.dependencies.store.transition(taskId, {
      state: "PRIMARY_BREACH",
      at: now(),
      providerId: selection.primary.providerId,
      evidenceHash: primaryVerification.evidenceHash,
      description: `Primary delivery breached: ${primaryVerification.violations.join(", ")}.`,
    });
    await this.dependencies.store.transition(taskId, {
      state: "BACKUP_SELECTED",
      at: now(),
      providerId: selection.backup.providerId,
      description: `Independent backup selected with score ${selection.backup.score}.`,
    });

    const backupRequest: ServiceRequest = {
      serviceId: selection.backup.serviceId,
      requestedAt: now(),
      input: { ...input.requestInput, continuityTaskId: taskId },
      buyer: input.buyer,
    };
    let backupDelivery: ProviderDelivery;
    try {
      backupDelivery = await this.dependencies.executor.execute({
        provider: selection.backup,
        taskId,
        request: backupRequest,
        paymentSource: "PRIMARY_BOND",
      });
    } catch (error) {
      const task = await this.dependencies.store.transition(taskId, {
        state: "FROZEN",
        at: now(),
        providerId: selection.backup.providerId,
        description: `Backup execution failed: ${error instanceof Error ? error.message : "unknown error"}`,
      });
      throw new ContinuityExecutionError("BACKUP_EXECUTION_FAILED", task, error);
    }
    const backupVerification = await verifyDelivery({
      promise: backupDelivery.servicePromise,
      request: backupDelivery.request,
      response: backupDelivery.response,
      receipt: backupDelivery.deliveryReceipt,
      checkedAt: backupDelivery.deliveryReceipt.payload.deliveredAt,
    });
    const backup = { ...backupDelivery, verification: backupVerification };
    if (backupVerification.status !== "ACCEPTED") {
      const task = await this.dependencies.store.transition(taskId, {
        state: "FROZEN",
        at: now(),
        providerId: selection.backup.providerId,
        evidenceHash: backupVerification.evidenceHash,
        description: `Backup delivery also breached: ${backupVerification.violations.join(", ")}.`,
      });
      return { task, primary, backup };
    }

    const completedAt = now();
    const continuityPayload = buildContinuityReceipt({
      taskId,
      requestHash,
      primaryProvider: selection.primary.provider,
      backupProvider: selection.backup.provider,
      primaryPriceAtomic: selection.primary.priceAtomic,
      backupPriceAtomic: selection.backup.priceAtomic,
      primaryVerification,
      backupVerification,
      completedAt,
      verifier: this.dependencies.verifier.address,
    });
    const continuityReceipt = await signContinuityReceipt(
      this.dependencies.verifier,
      { chainId: this.dependencies.chainId, vault: this.dependencies.vault },
      continuityPayload,
    );
    const attestation: RecoveryAttestation = {
      primaryServiceId: keccak256(stringToHex(selection.primary.serviceId)),
      backupServiceId: keccak256(stringToHex(selection.backup.serviceId)),
      requestHash,
      failedReceiptHash: hashCanonical(primaryDelivery.deliveryReceipt),
      recoveredReceiptHash: hashCanonical(backupDelivery.deliveryReceipt),
      buyer: input.buyer,
      recoveryAmount: selection.backup.priceAtomic,
      deadline: completedAt + (this.dependencies.recoveryWindowSeconds ?? 3_600),
      nonce: BigInt(taskId).toString(),
    };
    const recoveryAttestation = await signRecoveryAttestation(
      this.dependencies.verifier,
      { chainId: this.dependencies.chainId, vault: this.dependencies.vault },
      attestation,
    );
    const task = await this.dependencies.store.transition(taskId, {
      state: "RECOVERED",
      at: completedAt,
      providerId: selection.backup.providerId,
      evidenceHash: hashCanonical({ continuityReceipt, recoveryAttestation }),
      description: "Backup delivery accepted; verifier authorized bond-funded settlement.",
    });
    return { task, primary, backup, continuityReceipt, recoveryAttestation };
  }
}

export class ContinuityExecutionError extends Error {
  constructor(
    readonly code: "PRIMARY_EXECUTION_FAILED" | "BACKUP_EXECUTION_FAILED",
    readonly task: ContinuityTaskRecord,
    readonly cause?: unknown,
  ) {
    super(code);
    this.name = "ContinuityExecutionError";
  }
}
