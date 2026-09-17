import { isAddress, isHex } from "viem";
import type { ProviderDelivery, ProviderExecution, ProviderExecutor } from "./coordinator.js";
import type { BondedProviderProfile, DeliveryReceipt, ServicePromise, ServiceRequest, Signed } from "./types.js";

type Fetch = typeof fetch;

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path} must be an object.`);
  return value as Record<string, unknown>;
}

function signed<T>(value: unknown, path: string): Signed<T> {
  const input = record(value, path);
  if (!isHex(input.signature as string)) throw new Error(`${path}.signature must be hex.`);
  return { payload: record(input.payload, `${path}.payload`) as T, signature: input.signature as `0x${string}` };
}

function delivery(value: unknown): ProviderDelivery {
  const envelope = record(value, "provider response");
  const input = "delivery" in envelope ? record(envelope.delivery, "provider response.delivery") : envelope;
  const request = record(input.request, "provider response.request") as ServiceRequest;
  const servicePromise = signed<ServicePromise>(input.servicePromise, "provider response.servicePromise");
  const deliveryReceipt = signed<DeliveryReceipt>(input.deliveryReceipt, "provider response.deliveryReceipt");
  if (!isAddress(request.buyer, { strict: false })) throw new Error("provider response.request.buyer must be an address.");
  if (!isAddress(servicePromise.payload.provider, { strict: false })) throw new Error("provider Service Promise identity is invalid.");
  if (!isAddress(deliveryReceipt.payload.provider, { strict: false })) throw new Error("provider Delivery Receipt identity is invalid.");
  return { request, response: input.response ?? input.result, servicePromise, deliveryReceipt };
}

export class ProviderPaymentRequiredError extends Error {
  readonly code = "PROVIDER_PAYMENT_REQUIRED";

  constructor(
    readonly providerId: string,
    readonly paymentRequired: string | null,
  ) {
    super(`Provider ${providerId} requires a separately authorized payment.`);
    this.name = "ProviderPaymentRequiredError";
  }
}

export class ProviderTransportError extends Error {
  readonly code = "PROVIDER_TRANSPORT_FAILED";

  constructor(message: string, readonly providerId: string, readonly status?: number) {
    super(message);
    this.name = "ProviderTransportError";
  }
}

export class HttpProviderExecutor implements ProviderExecutor {
  private readonly profiles: Map<string, BondedProviderProfile>;
  private readonly fetchFn: Fetch;
  private readonly timeoutMs: number;
  private readonly maximumResponseBytes: number;
  private readonly authorizationHeaders: Map<string, Record<string, string>>;

  constructor(options: {
    providers: BondedProviderProfile[];
    fetchFn?: Fetch;
    timeoutMs?: number;
    maximumResponseBytes?: number;
    authorizationHeaders?: Record<string, Record<string, string>>;
  }) {
    this.profiles = new Map(options.providers.map((provider) => [provider.providerId, structuredClone(provider)]));
    this.fetchFn = options.fetchFn ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.maximumResponseBytes = options.maximumResponseBytes ?? 1_000_000;
    this.authorizationHeaders = new Map(Object.entries(options.authorizationHeaders ?? {}).map(([providerId, headers]) => [providerId, { ...headers }]));
    if (this.profiles.size !== options.providers.length) throw new Error("HTTP executor provider IDs must be unique.");
    if (this.timeoutMs <= 0 || this.maximumResponseBytes <= 0) throw new Error("HTTP executor limits must be positive.");
    for (const [providerId, headers] of this.authorizationHeaders) {
      if (!this.profiles.has(providerId)) throw new Error(`Authorization headers reference unknown Provider ${providerId}.`);
      const reserved = Object.keys(headers).find((name) => ["accept", "content-type", "x-relaybond-task-id", "x-relaybond-payment-source"].includes(name.toLowerCase()));
      if (reserved) throw new Error(`Authorization headers cannot override reserved header ${reserved}.`);
    }
  }

  async execute(input: ProviderExecution): Promise<ProviderDelivery> {
    const configured = this.profiles.get(input.provider.providerId);
    if (!configured) throw new ProviderTransportError("Provider is not registered with this executor.", input.provider.providerId);
    if (
      configured.endpoint !== input.provider.endpoint
      || configured.serviceId !== input.provider.serviceId
      || configured.provider.toLowerCase() !== input.provider.provider.toLowerCase()
    ) {
      throw new ProviderTransportError("Runtime provider profile does not match the audited configuration.", input.provider.providerId);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchFn(configured.endpoint, {
        method: "POST",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-relaybond-task-id": input.taskId,
          "x-relaybond-payment-source": input.paymentSource,
          ...this.authorizationHeaders.get(configured.providerId),
        },
        body: JSON.stringify({ taskId: input.taskId, request: input.request, paymentSource: input.paymentSource }),
      });
      if (response.status === 402) {
        throw new ProviderPaymentRequiredError(
          configured.providerId,
          response.headers.get("payment-required") ?? response.headers.get("www-authenticate"),
        );
      }
      if (response.status >= 300 && response.status < 400) {
        throw new ProviderTransportError("Provider redirects are rejected to preserve endpoint binding.", configured.providerId, response.status);
      }
      if (!response.ok) {
        throw new ProviderTransportError(`Provider returned HTTP ${response.status}.`, configured.providerId, response.status);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > this.maximumResponseBytes) {
        throw new ProviderTransportError("Provider response exceeded the configured size limit.", configured.providerId, response.status);
      }
      try {
        return delivery(JSON.parse(new TextDecoder().decode(bytes)) as unknown);
      } catch (error) {
        if (error instanceof ProviderTransportError) throw error;
        throw new ProviderTransportError(
          `Provider returned invalid delivery JSON: ${error instanceof Error ? error.message : "unknown error"}`,
          configured.providerId,
          response.status,
        );
      }
    } catch (error) {
      if (error instanceof ProviderPaymentRequiredError || error instanceof ProviderTransportError) throw error;
      if (controller.signal.aborted) throw new ProviderTransportError("Provider request timed out.", configured.providerId);
      throw new ProviderTransportError(
        `Provider request failed: ${error instanceof Error ? error.message : "unknown error"}`,
        configured.providerId,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
