import { createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { ProxyAgent, request } from "undici";

const contractAddress = "0x15b18Fb8C1E29287B57EbBE30bd10ef165dc9eD5";
const path = `/api/v5/xlayer/contract/verify-contract-info?chainShortName=XLAYER_TESTNET&contractAddress=${contractAddress}`;
const timestamp = new Date().toISOString();
const required = ["OKX_API_KEY", "OKX_SECRET_KEY", "OKX_PASSPHRASE"] as const;
for (const name of required) if (!process.env[name]) throw new Error(`${name} is required`);

const signature = createHmac("sha256", process.env.OKX_SECRET_KEY!)
  .update(`${timestamp}GET${path}`)
  .digest("base64");
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
const payload = await response.body.json() as {
  code?: string;
  msg?: string;
  data?: Array<Record<string, unknown>>;
};
const contract = payload.data?.[0];
const verified = response.statusCode === 200 && payload.code === "0" && Boolean(contract?.sourceCode);
const evidence = {
  evidenceVersion: "1",
  mode: "XLAYER_TESTNET",
  verified,
  contractAddress,
  contractName: contract?.contractName,
  compilerVersion: contract?.compilerVersion,
  compilerType: contract?.compilerType,
  optimization: contract?.optimization,
  optimizationRuns: contract?.optimizationRuns,
  evmVersion: contract?.evmVersion,
  licenseType: contract?.licenseType,
  sourcePresent: Boolean(contract?.sourceCode),
  abiPresent: Boolean(contract?.contractAbi),
  checkedAt: timestamp,
  source: "OKX_ONCHAIN_OS_VERIFY_CONTRACT_INFO",
};

await mkdir("evidence/live", { recursive: true });
await writeFile("evidence/live/contract-verification.json", `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
if (!verified) process.exitCode = 1;
