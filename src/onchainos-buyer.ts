import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export type OnchainOsEnvelope = {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: unknown;
};

export async function runOnchainOs(arguments_: string[]): Promise<OnchainOsEnvelope> {
  let stdout: string;
  try {
    ({ stdout } = await execFile("onchainos", arguments_, {
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
