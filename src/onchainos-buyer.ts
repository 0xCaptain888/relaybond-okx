import { execFile as execFileCallback } from "node:child_process";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export type OnchainOsEnvelope = {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: unknown;
};

export async function runOnchainOs(arguments_: string[]): Promise<OnchainOsEnvelope> {
  let executable = process.env.ONCHAINOS_BIN || "onchainos";
  if (!process.env.ONCHAINOS_BIN) {
    const localExecutable = join(homedir(), ".local", "bin", "onchainos");
    try {
      await access(localExecutable);
      executable = localExecutable;
    } catch {
      // Keep the PATH lookup for standard installations.
    }
  }
  let stdout: string;
  try {
    ({ stdout } = await execFile(executable, arguments_, {
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
      env: process.env,
    }));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error("OKX OnchainOS CLI is not installed. Install it before using the Agentic Wallet runner.");
    }
    const stdoutFromError = (error as { stdout?: string }).stdout;
    if (stdoutFromError) stdout = stdoutFromError;
    else throw error;
  }

  const envelope = JSON.parse(stdout.trim()) as OnchainOsEnvelope;
  if (!envelope.ok) throw new Error(`OnchainOS command failed: ${JSON.stringify(envelope.error)}`);
  return envelope;
}

export function extractMerchantDelivery(data: Record<string, unknown>): Record<string, unknown> {
  const result = data.result;
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("Paid OnchainOS result does not contain a RelayBond delivery object.");
  }
  return result as Record<string, unknown>;
}

export function requireFinalSettlement(data: Record<string, unknown>): {
  transactionHash: string;
  receipt: Record<string, unknown>;
} {
  if (data.status !== "success") {
    throw new Error(`Payment request did not succeed: ${JSON.stringify(data.error || data.status)}`);
  }
  const receipt = data.decodedReceipt;
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    throw new Error("Payment response is missing the facilitator settlement receipt.");
  }
  const decoded = receipt as Record<string, unknown>;
  if (decoded.status !== "success") {
    throw new Error(`Settlement is not final-success: ${JSON.stringify(decoded.status || decoded.errorReason || "unknown")}`);
  }
  const transactionHash = typeof decoded.transaction === "string"
    ? decoded.transaction
    : typeof data.txHash === "string"
      ? data.txHash
      : "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) {
    throw new Error("Settlement receipt is missing a valid transaction hash.");
  }
  return { transactionHash, receipt: decoded };
}
