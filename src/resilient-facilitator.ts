import type { FacilitatorClient } from "@okxweb3/x402-core/server";
import type {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  SettleStatusResponse,
  SupportedResponse,
  VerifyResponse,
} from "@okxweb3/x402-core/types";

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class ResilientFacilitatorClient implements FacilitatorClient {
  constructor(
    private readonly delegate: FacilitatorClient,
    private readonly attempts = 3,
  ) {}

  async getSupported(): Promise<SupportedResponse> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.attempts; attempt += 1) {
      try {
        return await this.delegate.getSupported();
      } catch (error) {
        lastError = error;
        if (attempt < this.attempts) await wait(250 * 2 ** (attempt - 1));
      }
    }
    throw lastError;
  }

  verify(paymentPayload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse> {
    return this.delegate.verify(paymentPayload, requirements);
  }

  settle(paymentPayload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse> {
    // Settlement is deliberately not retried here: ambiguous network failure must not
    // become an accidental second economic action.
    return this.delegate.settle(paymentPayload, requirements);
  }

  getSettleStatus(transactionHash: string): Promise<SettleStatusResponse> {
    if (!this.delegate.getSettleStatus) throw new Error("Facilitator does not expose settlement status.");
    return this.delegate.getSettleStatus(transactionHash);
  }
}
