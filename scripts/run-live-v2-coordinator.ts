import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  isHex,
  keccak256,
  parseAbi,
  stringToHex,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { ProviderDelivery } from "../src/coordinator.js";
import { HttpProviderExecutor } from "../src/http-provider-executor.js";
import { createLiveCoordinatorEvidence } from "../src/live-coordinator.js";
import { parseProviderConfiguration } from "../src/provider-config.js";
import { verifyOnchainSettlement } from "../src/settlement.js";

const chainId = 1952;
const evidencePath = process.env.V2_PRIMARY_PAID_EVIDENCE_PATH || "evidence/official-build/v2-primary-paid-breach.json";
const outputPath = process.env.V2_LIVE_EVIDENCE_PATH || "evidence/official-build/v2-live-coordinator.json";
const vault = process.env.RECOVERY_BOND_VAULT_V2_ADDRESS;
const token = process.env.USDT0_ADDRESS;
const verifierKey = process.env.VERIFIER_PRIVATE_KEY;
const providersRaw = process.env.CONTINUITY_PROVIDERS_JSON;
const backupAuthorizationToken = process.env.BACKUP_PROVIDER_AUTH_TOKEN;
if (!vault || !isAddress(vault)) throw new Error("RECOVERY_BOND_VAULT_V2_ADDRESS is required.");
if (!token || !isAddress(token)) throw new Error("USDT0_ADDRESS is required.");
if (!verifierKey || !/^0x[0-9a-fA-F]{64}$/.test(verifierKey)) throw new Error("VERIFIER_PRIVATE_KEY is required.");
if (!providersRaw) throw new Error("CONTINUITY_PROVIDERS_JSON is required.");
if (!backupAuthorizationToken || backupAuthorizationToken.length < 32) {
  throw new Error("BACKUP_PROVIDER_AUTH_TOKEN must be configured with at least 32 characters.");
}

const raw = JSON.parse(await readFile(evidencePath, "utf8")) as Record<string, unknown>;
const payment = raw.payment as Record<string, unknown> | undefined;
const settlement = payment?.onchainSettlement as Record<string, unknown> | undefined;
const deliveryRaw = raw.delivery as Record<string, unknown> | undefined;
if (!settlement || !deliveryRaw) throw new Error("Paid primary evidence must contain payment.onchainSettlement and delivery.");
const transactionHash = settlement.transactionHash;
if (typeof transactionHash !== "string" || !isHex(transactionHash) || transactionHash.length !== 66) {
  throw new Error("Paid primary evidence is missing a valid transaction hash.");
}
const request = deliveryRaw.request as ProviderDelivery["request"];
const servicePromise = deliveryRaw.servicePromise as ProviderDelivery["servicePromise"];
const deliveryReceipt = deliveryRaw.deliveryReceipt as ProviderDelivery["deliveryReceipt"];
if (!request || !servicePromise || !deliveryReceipt) throw new Error("Paid primary delivery is incomplete.");
const primaryDelivery: ProviderDelivery = {
  request,
  response: deliveryRaw.result ?? deliveryRaw.response,
  servicePromise,
  deliveryReceipt,
};
const providers = parseProviderConfiguration(providersRaw);
const backupServiceId = process.env.V2_BACKUP_SERVICE_ID || "official-market-backup-v1";
const backupProvider = providers.find((provider) => provider.serviceId === backupServiceId);
if (!backupProvider) throw new Error(`Configured Backup service ${backupServiceId} was not found.`);
const verifier = privateKeyToAccount(verifierKey as Hex);
const rpcUrl = process.env.XLAYER_TESTNET_RPC_URL || "https://testrpc.xlayer.tech/terigon";
const publicClient = createPublicClient({ transport: http(rpcUrl) });
const vaultAbi = parseAbi([
  "function verifier() view returns (address)",
  "function settlementToken() view returns (address)",
  "function services(bytes32) view returns (address provider, uint128 bondBalance, uint128 minimumBond, uint128 maximumRecovery, bool active)",
]);
const [currentChainId, onchainVerifier, onchainToken] = await Promise.all([
  publicClient.getChainId(),
  publicClient.readContract({ address: getAddress(vault), abi: vaultAbi, functionName: "verifier" }),
  publicClient.readContract({ address: getAddress(vault), abi: vaultAbi, functionName: "settlementToken" }),
]);
if (currentChainId !== chainId) throw new Error(`Wrong chain ${currentChainId}; expected ${chainId}.`);
if (onchainVerifier.toLowerCase() !== verifier.address.toLowerCase()) throw new Error("VERIFIER_PRIVATE_KEY does not match RecoveryBondVaultV2.");
if (onchainToken.toLowerCase() !== token.toLowerCase()) throw new Error("USDT0_ADDRESS does not match RecoveryBondVaultV2.");

for (const provider of providers.filter((candidate) => candidate.active)) {
  const serviceId = keccak256(stringToHex(provider.serviceId));
  const service = await publicClient.readContract({ address: getAddress(vault), abi: vaultAbi, functionName: "services", args: [serviceId] });
  if (service[0].toLowerCase() !== provider.provider.toLowerCase()) throw new Error(`${provider.providerId} is not registered to its configured identity.`);
  if (!service[4]) throw new Error(`${provider.providerId} is not active on RecoveryBondVaultV2.`);
  if (service[1] < service[2] || service[1] !== BigInt(provider.bondAtomic)) throw new Error(`${provider.providerId} bond metadata does not match onchain state.`);
  if (service[3] < BigInt(provider.priceAtomic)) throw new Error(`${provider.providerId} maximum recovery does not cover its price.`);
}

const primarySettlement = await verifyOnchainSettlement({
  rpcUrl,
  transactionHash: transactionHash as Hex,
  token: getAddress(token),
  payer: getAddress(request.buyer),
  payTo: getAddress(servicePromise.payload.provider),
  amountAtomic: servicePromise.payload.priceAtomic,
});
const evidence = await createLiveCoordinatorEvidence({
  chainId,
  vault: getAddress(vault),
  verifier,
  providers,
  primaryDelivery,
  primarySettlement,
  backupExecutor: new HttpProviderExecutor({
    providers,
    authorizationHeaders: {
      [backupProvider.providerId]: {
        "x-relaybond-backup-authorization": backupAuthorizationToken,
      },
    },
  }),
  requirement: {
    schema: servicePromise.payload.requiredSchema,
    maximumPriceAtomic: servicePromise.payload.priceAtomic,
    maximumLatencyMs: servicePromise.payload.responseTimeMs,
  },
});
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({
  status: "LIVE_COORDINATOR_EVIDENCE_CREATED",
  source: evidencePath,
  output: outputPath,
  transactionHash: primarySettlement.transactionHash,
  taskId: evidence.recovered.task.taskId,
  state: evidence.recovered.task.state,
  evidenceHash: evidence.evidenceHash,
  settlementBroadcast: false,
}, null, 2));
