import { chmod, mkdir, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const envPath = ".env";
if (existsSync(envPath) && !process.argv.includes("--force")) {
  throw new Error(".env already exists. Refusing to overwrite secrets without --force.");
}

const deployerKey = generatePrivateKey();
const providerKey = generatePrivateKey();
const verifierKey = generatePrivateKey();
const deployer = privateKeyToAccount(deployerKey);
const provider = privateKeyToAccount(providerKey);
const verifier = privateKeyToAccount(verifierKey);
const temporaryPath = `.env.bootstrap-${process.pid}`;

const env = [
  "# RelayBond local secrets. Never commit or paste this file into chat.",
  "XLAYER_TESTNET_RPC_URL=https://testrpc.xlayer.tech/terigon",
  "X402_NETWORK=eip155:1952",
  "USDT0_ADDRESS=0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c",
  `XLAYER_PRIVATE_KEY=${deployerKey}`,
  `XLAYER_DEPLOYER_ADDRESS=${deployer.address}`,
  `PROVIDER_SIGNING_KEY=${providerKey}`,
  `PROVIDER_ADDRESS=${provider.address}`,
  `VERIFIER_PRIVATE_KEY=${verifierKey}`,
  `VERIFIER_ADDRESS=${verifier.address}`,
  "SERVICE_ID=market-data-v1",
  "MINIMUM_BOND_ATOMIC=5000000",
  "BOND_DEPOSIT_ATOMIC=5000000",
  "REBATE_ATOMIC=10000",
  "PORT=8787",
  "PUBLIC_BASE_URL=http://localhost:8787",
  "HTTPS_PROXY=http://127.0.0.1:7897",
  "OKX_API_KEY=",
  "OKX_SECRET_KEY=",
  "OKX_PASSPHRASE=",
  "X402_PAY_TO=",
  "QUALITY_BOND_VAULT_ADDRESS=",
  "SERVICE_PROMISE_HASH=",
  "",
].join("\n");

await writeFile(temporaryPath, env, { mode: 0o600 });
await rename(temporaryPath, envPath);
await chmod(envPath, 0o600);

const publicAddresses = {
  evidenceVersion: "1",
  network: "X Layer Testnet",
  chainId: 1952,
  deployer: deployer.address,
  provider: provider.address,
  verifier: verifier.address,
  generatedAt: new Date().toISOString(),
  note: "Public addresses only. No private key is present in this file.",
};
await mkdir("evidence/setup", { recursive: true });
await writeFile("evidence/setup/wallet-addresses.json", `${JSON.stringify(publicAddresses, null, 2)}\n`);

console.log(JSON.stringify({
  status: "CREATED",
  secretFile: ".env (mode 600, gitignored)",
  publicEvidence: "evidence/setup/wallet-addresses.json",
  addresses: publicAddresses,
}, null, 2));
