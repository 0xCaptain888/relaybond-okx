import { readFile, writeFile } from "node:fs/promises";
import { createPublicClient, getAddress, http, keccak256, parseAbi, stringToHex, type Hex } from "viem";

const evidencePath = "evidence/official-build/v2-bonding.json";
const evidence = JSON.parse(await readFile(evidencePath, "utf8")) as Record<string, unknown>;
const vaultAddress = getAddress(String(evidence.vaultAddress));
const transactions = evidence.transactions as Record<string, Record<string, { hash: Hex; blockNumber: number }>>;
const providers = evidence.providers as Array<{
  role: "primary" | "backup";
  serviceName: string;
  provider: string;
  depositAmountAtomic: string;
}>;
const client = createPublicClient({ transport: http(process.env.XLAYER_TESTNET_RPC_URL || "https://testrpc.xlayer.tech/terigon") });
const vaultAbi = parseAbi([
  "function services(bytes32) view returns (address provider, uint128 bondBalance, uint128 minimumBond, uint128 maximumRecovery, bool active)",
]);

const receiptVerification: Record<string, Record<string, unknown>> = {};
for (const [role, actions] of Object.entries(transactions)) {
  receiptVerification[role] = {};
  for (const [action, transaction] of Object.entries(actions)) {
    const receipt = await client.getTransactionReceipt({ hash: transaction.hash });
    receiptVerification[role]![action] = {
      hash: transaction.hash,
      status: receipt.status,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
    };
  }
}

const final: Record<string, unknown> = {};
const stateChecks: Record<string, boolean> = {};
for (const provider of providers) {
  const serviceId = keccak256(stringToHex(provider.serviceName));
  const service = await client.readContract({ address: vaultAddress, abi: vaultAbi, functionName: "services", args: [serviceId] });
  final[provider.role] = {
    serviceId,
    provider: service[0],
    bondBalanceAtomic: service[1].toString(),
    minimumBondAtomic: service[2].toString(),
    maximumRecoveryAtomic: service[3].toString(),
    active: service[4],
  };
  stateChecks[`${provider.role}ProviderBound`] = service[0].toLowerCase() === provider.provider.toLowerCase();
  stateChecks[`${provider.role}BondExact`] = service[1] === BigInt(provider.depositAmountAtomic);
  stateChecks[`${provider.role}Active`] = service[4];
}

const receiptChecks = Object.fromEntries(Object.entries(receiptVerification).flatMap(([role, actions]) =>
  Object.entries(actions).map(([action, receipt]) => [`${role}${action[0]!.toUpperCase()}${action.slice(1)}Succeeded`, (receipt as { status: string }).status === "success"]),
));
const checks = {
  correctChain: await client.getChainId() === 1952,
  ...receiptChecks,
  ...stateChecks,
  independentProviders: providers[0]?.provider.toLowerCase() !== providers[1]?.provider.toLowerCase(),
};
const verificationPassed = Object.values(checks).every(Boolean);
if (!verificationPassed) throw new Error(`V2 bonding evidence verification failed: ${JSON.stringify(checks)}`);

const verified = {
  ...evidence,
  final,
  receiptVerification,
  checks,
  verificationPassed,
  verifiedAt: new Date().toISOString(),
};
await writeFile(evidencePath, `${JSON.stringify(verified, null, 2)}\n`);
console.log(JSON.stringify({ status: "V2_BONDING_VERIFIED", evidencePath, checks, final }, null, 2));
