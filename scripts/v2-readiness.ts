import { mkdir, readFile, writeFile } from "node:fs/promises";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, formatEther, formatUnits, getAddress, http, isAddress, parseAbi } from "viem";
import { defineChain } from "viem";

const chain = defineChain({
  id: 1952,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: [process.env.XLAYER_TESTNET_RPC_URL || "https://testrpc.xlayer.tech/terigon"] } },
});
const client = createPublicClient({ chain, transport: http() });
const token = (process.env.USDT0_ADDRESS || "0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c") as `0x${string}`;
const erc20 = parseAbi(["function balanceOf(address) view returns (uint256)"]);

function publicAddress(name: string, keyName?: string): `0x${string}` | undefined {
  const value = process.env[name];
  if (value && isAddress(value, { strict: false })) return getAddress(value);
  const key = keyName ? process.env[keyName] : undefined;
  if (key && /^0x[0-9a-fA-F]{64}$/.test(key)) return privateKeyToAccount(key as `0x${string}`).address;
  return undefined;
}

async function evidenceAddress(): Promise<`0x${string}` | undefined> {
  try {
    const evidence = JSON.parse(await readFile("evidence/official-build/v2-deployment.json", "utf8")) as { address?: string };
    return evidence.address && isAddress(evidence.address, { strict: false }) ? getAddress(evidence.address) : undefined;
  } catch {
    return undefined;
  }
}

const deployer = publicAddress("XLAYER_DEPLOYER_ADDRESS", "XLAYER_PRIVATE_KEY");
const primary = publicAddress("PRIMARY_PROVIDER_ADDRESS", "PROVIDER_SIGNING_KEY") ?? publicAddress("PROVIDER_ADDRESS", "PROVIDER_SIGNING_KEY");
const backup = publicAddress("BACKUP_PROVIDER_ADDRESS", "BACKUP_PROVIDER_SIGNING_KEY");
const verifier = publicAddress("VERIFIER_ADDRESS", "VERIFIER_PRIVATE_KEY");
const vault = publicAddress("RECOVERY_BOND_VAULT_V2_ADDRESS") ?? await evidenceAddress();
const primaryBondRequired = BigInt(process.env.V2_PRIMARY_BOND_ATOMIC || "5000000");
const backupBondRequired = BigInt(process.env.V2_BACKUP_BOND_ATOMIC || "3000000");
const [chainId, tokenCode, deployerNative, primaryNative, backupNative, primaryToken, backupToken, vaultCode] = await Promise.all([
  client.getChainId(),
  client.getCode({ address: token }),
  deployer ? client.getBalance({ address: deployer }) : 0n,
  primary ? client.getBalance({ address: primary }) : 0n,
  backup ? client.getBalance({ address: backup }) : 0n,
  primary ? client.readContract({ address: token, abi: erc20, functionName: "balanceOf", args: [primary] }) : 0n,
  backup ? client.readContract({ address: token, abi: erc20, functionName: "balanceOf", args: [backup] }) : 0n,
  vault ? client.getCode({ address: vault }) : undefined,
]);
const independentProviders = Boolean(primary && backup && primary.toLowerCase() !== backup.toLowerCase());
const checks = {
  correctChain: chainId === 1952,
  settlementTokenHasCode: Boolean(tokenCode && tokenCode !== "0x"),
  deployerConfigured: Boolean(deployer),
  deployerHasGas: deployerNative > 0n,
  verifierConfigured: Boolean(verifier),
  primaryConfigured: Boolean(primary),
  backupConfigured: Boolean(backup),
  independentProviders,
  v2Deployed: Boolean(vault && vaultCode && vaultCode !== "0x"),
  primaryBondFunded: primaryToken >= primaryBondRequired,
  backupBondFunded: backupToken >= backupBondRequired,
};
const evidence = {
  evidenceVersion: "official-v2-readiness-1",
  mode: "XLAYER_TESTNET_READ_ONLY",
  generatedAt: new Date().toISOString(),
  chainId,
  settlementToken: token,
  vault: vault ?? null,
  roles: {
    deployer: deployer ? { address: deployer, nativeBalance: formatEther(deployerNative) } : null,
    primary: primary ? { address: primary, nativeBalance: formatEther(primaryNative), tokenBalance: formatUnits(primaryToken, 6), requiredTokenBalance: formatUnits(primaryBondRequired, 6) } : null,
    backup: backup ? { address: backup, nativeBalance: formatEther(backupNative), tokenBalance: formatUnits(backupToken, 6), requiredTokenBalance: formatUnits(backupBondRequired, 6) } : null,
    verifier: verifier ? { address: verifier, gasRequired: false } : null,
  },
  checks,
  readyForDeployment: checks.correctChain && checks.settlementTokenHasCode && checks.deployerConfigured && checks.deployerHasGas && checks.verifierConfigured,
  readyForRegistration: checks.v2Deployed && checks.independentProviders && checks.primaryBondFunded && checks.backupBondFunded,
  broadcastPerformed: false,
};
await mkdir("evidence/official-build", { recursive: true });
await writeFile("evidence/official-build/v2-readiness.json", `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
