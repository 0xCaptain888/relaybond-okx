import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { privateKeyToAccount } from "viem/accounts";
import { configuredServicePromise } from "../src/service-promise.js";
import { hashPromise, signPromise } from "../src/signing.js";

async function setEnv(name: string, value: string) {
  const source = await readFile(".env", "utf8");
  const lines = source.split("\n").filter((line) => !line.startsWith(`${name}=`));
  const temporary = `.env.promise-${process.pid}`;
  await writeFile(temporary, `${lines.filter(Boolean).join("\n")}\n${name}=${value}\n`, { mode: 0o600 });
  await rename(temporary, ".env");
  await chmod(".env", 0o600);
}

const promise = configuredServicePromise();
const account = privateKeyToAccount(process.env.PROVIDER_SIGNING_KEY as `0x${string}`);
const signedPromise = await signPromise(account, promise);
const promiseHash = await hashPromise(promise);
const evidence = { evidenceVersion: "1", mode: promise.chainId === 196 ? "XLAYER_MAINNET" : "XLAYER_TESTNET", promiseHash, signedPromise, generatedAt: new Date().toISOString() };
await setEnv("SERVICE_PROMISE_HASH", promiseHash);
await mkdir("evidence/live", { recursive: true });
await writeFile("evidence/live/service-promise.json", `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ status: "SIGNED_SERVICE_PROMISE_CREATED", promiseHash, provider: promise.provider, endpoint: promise.endpoint, validUntil: promise.validUntil, evidence: "evidence/live/service-promise.json" }, null, 2));
