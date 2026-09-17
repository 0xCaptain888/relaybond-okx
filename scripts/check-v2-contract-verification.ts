import { createHmac } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { ProxyAgent, request } from "undici";

const deployment = JSON.parse(await readFile("evidence/official-build/v2-deployment.json", "utf8")) as { address?: string };
if (!deployment.address || !/^0x[0-9a-fA-F]{40}$/.test(deployment.address)) throw new Error("Valid V2 deployment evidence is required.");
const path = `/api/v5/xlayer/contract/verify-contract-info?chainShortName=XLAYER_TESTNET&contractAddress=${deployment.address}`;
const timestamp = new Date().toISOString();
const required = ["OKX_API_KEY", "OKX_SECRET_KEY", "OKX_PASSPHRASE"] as const;
for (const name of required) if (!process.env[name]) throw new Error(`${name} is required.`);
const signature = createHmac("sha256", process.env.OKX_SECRET_KEY!).update(`${timestamp}GET${path}`).digest("base64");
const dispatcher = process.env.HTTPS_PROXY ? new ProxyAgent(process.env.HTTPS_PROXY) : undefined;
const response = await request(`https://web3.okx.com${path}`, {
  method: "GET",
  headers: {
    "OK-ACCESS-KEY": process.env.OKX_API_KEY!,
    "OK-ACCESS-SIGN": signature,
    "OK-ACCESS-PASSPHRASE": process.env.OKX_PASSPHRASE!,
    "OK-ACCESS-TIMESTAMP": timestamp,
  },
  dispatcher,
});
const payload = await response.body.json() as { code?: string; data?: Array<Record<string, unknown>> };
const contract = payload.data?.[0];
const verified = response.statusCode === 200 && payload.code === "0" && Boolean(contract?.sourceCode);
const evidence = {
  evidenceVersion: "official-v2-verification-1",
  mode: "XLAYER_TESTNET",
  verified,
  contractAddress: deployment.address,
  expectedContractName: "RecoveryBondVaultV2",
  contractName: contract?.contractName,
  compilerVersion: contract?.compilerVersion,
  optimization: contract?.optimization,
  optimizationRuns: contract?.optimizationRuns,
  evmVersion: contract?.evmVersion,
  sourcePresent: Boolean(contract?.sourceCode),
  abiPresent: Boolean(contract?.contractAbi),
  checkedAt: timestamp,
  source: "OKX_ONCHAIN_OS_VERIFY_CONTRACT_INFO",
};
await mkdir("evidence/official-build", { recursive: true });
await writeFile("evidence/official-build/v2-contract-verification.json", `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
if (!verified || contract?.contractName !== "RecoveryBondVaultV2") process.exitCode = 1;
