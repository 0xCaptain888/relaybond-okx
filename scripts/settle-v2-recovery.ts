import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  defineChain,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  keccak256,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { validateLiveRecoveryEvidence, type LiveRecoveryEvidence } from "../src/v2-settlement.js";

const EXPECTED_CHAIN_ID = 1952;
const CONFIRMATION = "SETTLE_V2_RECOVERY_XLAYER_TESTNET";
const evidencePath = process.env.V2_LIVE_EVIDENCE_PATH || "evidence/official-build/v2-live-coordinator.json";
const planPath = process.env.V2_SETTLEMENT_PLAN_PATH || "evidence/official-build/v2-settlement-plan.json";
const provisionalEvidencePath = "evidence/official-build/v2-live-settlement-pending-verification.json";
const finalEvidencePath = "evidence/official-build/v2-live-settlement.json";
const vaultAddress = process.env.RECOVERY_BOND_VAULT_V2_ADDRESS;
const tokenAddress = process.env.USDT0_ADDRESS;
const verifierAddress = process.env.VERIFIER_ADDRESS;
if (!vaultAddress || !isAddress(vaultAddress)) throw new Error("RECOVERY_BOND_VAULT_V2_ADDRESS is required.");
if (!tokenAddress || !isAddress(tokenAddress)) throw new Error("USDT0_ADDRESS is required.");
if (!verifierAddress || !isAddress(verifierAddress)) throw new Error("VERIFIER_ADDRESS is required.");

async function readJsonIfExists<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

type SettlementPlanSnapshot = {
  requestHash?: string;
  balancesBefore?: {
    buyerAtomic: string;
    backupAtomic: string;
    primaryBondAtomic: string;
  };
  [key: string]: unknown;
};

type PendingSettlementEvidence = {
  requestHash: string;
  transactionHash: `0x${string}`;
  blockNumber: string;
  receiptStatus: string;
};

type FinalSettlementEvidence = SettlementPlanSnapshot & {
  broadcast?: boolean;
  transactionHash?: `0x${string}`;
};

const previousPlan = await readJsonIfExists<SettlementPlanSnapshot>(planPath);
const pendingSettlement = await readJsonIfExists<PendingSettlementEvidence>(provisionalEvidencePath);
const existingFinalSettlement = await readJsonIfExists<FinalSettlementEvidence>(finalEvidencePath);

let evidence: LiveRecoveryEvidence;
try {
  evidence = JSON.parse(await readFile(evidencePath, "utf8")) as LiveRecoveryEvidence;
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  const unavailablePlan = {
    evidenceVersion: "official-v2-settlement-plan-1",
    mode: "XLAYER_TESTNET_READ_ONLY_PLAN",
    generatedAt: new Date().toISOString(),
    sourceEvidence: evidencePath,
    sourceEvidenceAvailable: false,
    chainId: EXPECTED_CHAIN_ID,
    vaultAddress: getAddress(vaultAddress),
    tokenAddress: getAddress(tokenAddress),
    verifier: getAddress(verifierAddress),
    evidenceValidation: {
      passed: false,
      checks: { liveMode: false },
      reason: "A fresh XLAYER_TESTNET_LIVE_COORDINATOR Evidence Pack has not been created yet.",
    },
    onchainChecks: {},
    ready: false,
    broadcast: false,
    requiredConfirmation: CONFIRMATION,
    next: "Register and bond both Providers, execute a real paid Primary breach and Backup acceptance, then generate the LIVE coordinator Evidence Pack. No transaction was sent.",
  };
  await mkdir(dirname(planPath), { recursive: true });
  await writeFile(planPath, `${JSON.stringify(unavailablePlan, null, 2)}\n`);
  console.log(JSON.stringify(unavailablePlan, null, 2));
  process.exit(0);
}
const chain = defineChain({
  id: EXPECTED_CHAIN_ID,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: [process.env.XLAYER_TESTNET_RPC_URL || "https://testrpc.xlayer.tech/terigon"] } },
});
const publicClient = createPublicClient({ chain, transport: http() });
const vaultAbi = parseAbi([
  "function settlementToken() view returns (address)",
  "function verifier() view returns (address)",
  "function recoveredRequests(bytes32) view returns (bool)",
  "function services(bytes32) view returns (address provider, uint128 bondBalance, uint128 minimumBond, uint128 maximumRecovery, bool active)",
  "function settleRecovery((bytes32 primaryServiceId, bytes32 backupServiceId, bytes32 requestHash, bytes32 failedReceiptHash, bytes32 recoveredReceiptHash, address buyer, uint256 recoveryAmount, uint256 deadline, uint256 nonce) claim, bytes signature)",
  "event BreachRecovered(bytes32 indexed primaryServiceId, bytes32 indexed backupServiceId, bytes32 indexed requestHash, bytes32 failedReceiptHash, bytes32 recoveredReceiptHash, address buyer, address backupProvider, uint256 amount, uint256 remainingPrimaryBond)",
]);
const tokenAbi = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const checkedAt = Math.floor(Date.now() / 1000);
const validation = await validateLiveRecoveryEvidence(evidence, {
  chainId: EXPECTED_CHAIN_ID,
  vault: getAddress(vaultAddress),
  verifier: getAddress(verifierAddress),
  checkedAt,
});
const claim = evidence.recovered.recoveryAttestation!.payload;
const signature = evidence.recovered.recoveryAttestation!.signature;
const continuity = evidence.recovered.continuityReceipt!.payload;
const [chainId, onchainToken, onchainVerifier, alreadyRecovered, primary, backup, buyerBalance, backupBalance] = await Promise.all([
  publicClient.getChainId(),
  publicClient.readContract({ address: getAddress(vaultAddress), abi: vaultAbi, functionName: "settlementToken" }),
  publicClient.readContract({ address: getAddress(vaultAddress), abi: vaultAbi, functionName: "verifier" }),
  publicClient.readContract({ address: getAddress(vaultAddress), abi: vaultAbi, functionName: "recoveredRequests", args: [claim.requestHash] }),
  publicClient.readContract({ address: getAddress(vaultAddress), abi: vaultAbi, functionName: "services", args: [claim.primaryServiceId] }),
  publicClient.readContract({ address: getAddress(vaultAddress), abi: vaultAbi, functionName: "services", args: [claim.backupServiceId] }),
  publicClient.readContract({ address: getAddress(tokenAddress), abi: tokenAbi, functionName: "balanceOf", args: [claim.buyer] }),
  publicClient.readContract({ address: getAddress(tokenAddress), abi: tokenAbi, functionName: "balanceOf", args: [continuity.backupProvider] }),
]);
const onchainChecks = {
  correctChain: chainId === EXPECTED_CHAIN_ID,
  tokenBound: onchainToken.toLowerCase() === tokenAddress.toLowerCase(),
  verifierBound: onchainVerifier.toLowerCase() === verifierAddress.toLowerCase(),
  requestUnused: !alreadyRecovered,
  primaryRegistered: primary[0].toLowerCase() === continuity.primaryProvider.toLowerCase(),
  backupRegistered: backup[0].toLowerCase() === continuity.backupProvider.toLowerCase(),
  primaryActive: primary[4],
  backupActive: backup[4],
  primaryBondCoversRecovery: primary[1] >= BigInt(claim.recoveryAmount),
  maximumRecoveryCoversAmount: primary[3] >= BigInt(claim.recoveryAmount),
};
const callData = encodeFunctionData({
  abi: vaultAbi,
  functionName: "settleRecovery",
  args: [{
    primaryServiceId: claim.primaryServiceId,
    backupServiceId: claim.backupServiceId,
    requestHash: claim.requestHash,
    failedReceiptHash: claim.failedReceiptHash,
    recoveredReceiptHash: claim.recoveredReceiptHash,
    buyer: claim.buyer,
    recoveryAmount: BigInt(claim.recoveryAmount),
    deadline: BigInt(claim.deadline),
    nonce: BigInt(claim.nonce),
  }, signature],
});
const ready = validation.passed && Object.values(onchainChecks).every(Boolean);
const plan = {
  evidenceVersion: "official-v2-settlement-plan-1",
  mode: "XLAYER_TESTNET_READ_ONLY_PLAN",
  generatedAt: new Date().toISOString(),
  sourceEvidence: evidencePath,
  chainId,
  vaultAddress: getAddress(vaultAddress),
  tokenAddress: getAddress(tokenAddress),
  verifier: getAddress(verifierAddress),
  requestHash: claim.requestHash,
  buyer: claim.buyer,
  primaryProvider: continuity.primaryProvider,
  backupProvider: continuity.backupProvider,
  recoveryAmountAtomic: claim.recoveryAmount,
  transaction: { to: getAddress(vaultAddress), valueAtomic: "0", callDataHash: keccak256(callData) },
  balancesBefore: { buyerAtomic: buyerBalance.toString(), backupAtomic: backupBalance.toString(), primaryBondAtomic: primary[1].toString() },
  evidenceValidation: validation,
  onchainChecks,
  ready,
  broadcast: false,
  requiredConfirmation: CONFIRMATION,
};
const confirmed = process.env.V2_SETTLEMENT_CONFIRMATION === CONFIRMATION;
const canRecoverPendingSettlement = Boolean(
  alreadyRecovered
  && pendingSettlement
  && pendingSettlement.requestHash.toLowerCase() === claim.requestHash.toLowerCase()
  && previousPlan?.requestHash?.toLowerCase() === claim.requestHash.toLowerCase()
  && previousPlan.balancesBefore,
);
const alreadyFinalized = Boolean(
  alreadyRecovered
  && existingFinalSettlement?.broadcast
  && existingFinalSettlement.requestHash?.toLowerCase() === claim.requestHash.toLowerCase()
  && existingFinalSettlement.transactionHash,
);
await mkdir(dirname(planPath), { recursive: true });
if (alreadyFinalized && existingFinalSettlement) {
  await writeFile(planPath, `${JSON.stringify(existingFinalSettlement, null, 2)}\n`);
  console.log(JSON.stringify(existingFinalSettlement, null, 2));
  process.exit(0);
}
if (!canRecoverPendingSettlement) await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`);
if (!confirmed) {
  console.log(JSON.stringify({ ...plan, next: `Review this plan, then set V2_SETTLEMENT_CONFIRMATION=${CONFIRMATION}.` }, null, 2));
  process.exit(0);
}

const readSettlementState = async () => {
  const [recoveredAfter, primaryAfter, buyerAfter, backupAfter] = await Promise.all([
    publicClient.readContract({ address: getAddress(vaultAddress), abi: vaultAbi, functionName: "recoveredRequests", args: [claim.requestHash] }),
    publicClient.readContract({ address: getAddress(vaultAddress), abi: vaultAbi, functionName: "services", args: [claim.primaryServiceId] }),
    publicClient.readContract({ address: getAddress(tokenAddress), abi: tokenAbi, functionName: "balanceOf", args: [claim.buyer] }),
    publicClient.readContract({ address: getAddress(tokenAddress), abi: tokenAbi, functionName: "balanceOf", args: [continuity.backupProvider] }),
  ]);
  return { recoveredAfter, primaryAfter, buyerAfter, backupAfter };
};

const verifySettlementReceipt = async (
  receipt: Awaited<ReturnType<typeof publicClient.getTransactionReceipt>>,
  baseline: { buyerAtomic: bigint; backupAtomic: bigint; primaryBondAtomic: bigint },
) => {
  const recoveredEvent = receipt.logs.flatMap((log) => {
    try {
      const decoded = decodeEventLog({ abi: vaultAbi, data: log.data, topics: log.topics });
      return decoded.eventName === "BreachRecovered" ? [decoded.args] : [];
    } catch {
      return [];
    }
  })[0];
  const amount = BigInt(claim.recoveryAmount);
  let latest = await readSettlementState();
  let settlementChecks = {
    receiptSucceeded: false,
    requestMarkedRecovered: false,
    buyerBalanceUnchanged: false,
    backupPaidExactly: false,
    primaryBondDebitedExactly: false,
    primaryActivityMatchesMinimum: false,
    recoveryEventBound: false,
  };
  for (let attempt = 0; attempt < 12; attempt += 1) {
    settlementChecks = {
      receiptSucceeded: receipt.status === "success",
      requestMarkedRecovered: latest.recoveredAfter,
      buyerBalanceUnchanged: latest.buyerAfter === baseline.buyerAtomic,
      backupPaidExactly: latest.backupAfter - baseline.backupAtomic === amount,
      primaryBondDebitedExactly: baseline.primaryBondAtomic - latest.primaryAfter[1] === amount,
      primaryActivityMatchesMinimum: latest.primaryAfter[4] === (latest.primaryAfter[1] >= latest.primaryAfter[2]),
      recoveryEventBound: Boolean(
        recoveredEvent
        && recoveredEvent.requestHash === claim.requestHash
        && recoveredEvent.primaryServiceId === claim.primaryServiceId
        && recoveredEvent.backupServiceId === claim.backupServiceId
        && recoveredEvent.backupProvider.toLowerCase() === continuity.backupProvider.toLowerCase()
        && recoveredEvent.amount === amount
        && recoveredEvent.remainingPrimaryBond === latest.primaryAfter[1]
      ),
    };
    if (Object.values(settlementChecks).every(Boolean)) return { ...latest, recoveredEvent, settlementChecks };
    if (attempt < 11) {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      latest = await readSettlementState();
    }
  }
  return { ...latest, recoveredEvent, settlementChecks };
};

if (canRecoverPendingSettlement && pendingSettlement && previousPlan?.balancesBefore) {
  const receipt = await publicClient.getTransactionReceipt({ hash: pendingSettlement.transactionHash });
  const verified = await verifySettlementReceipt(receipt, {
    buyerAtomic: BigInt(previousPlan.balancesBefore.buyerAtomic),
    backupAtomic: BigInt(previousPlan.balancesBefore.backupAtomic),
    primaryBondAtomic: BigInt(previousPlan.balancesBefore.primaryBondAtomic),
  });
  if (!Object.values(verified.settlementChecks).every(Boolean)) {
    throw new Error("Pending settlement exists, but post-settlement invariants still fail; do not rebroadcast.");
  }
  const recoveredEvidence = {
    ...previousPlan,
    evidenceVersion: "official-v2-live-settlement-1",
    mode: "XLAYER_TESTNET",
    broadcast: true,
    recoveredFromPendingEvidence: true,
    relayer: receipt.from,
    transactionHash: pendingSettlement.transactionHash,
    explorer: `https://www.okx.com/web3/explorer/xlayer-test/tx/${pendingSettlement.transactionHash}`,
    blockNumber: receipt.blockNumber.toString(),
    gasUsed: receipt.gasUsed.toString(),
    balancesAfter: {
      buyerAtomic: verified.buyerAfter.toString(),
      backupAtomic: verified.backupAfter.toString(),
      primaryBondAtomic: verified.primaryAfter[1].toString(),
    },
    primaryActiveAfter: verified.primaryAfter[4],
    settlementChecks: verified.settlementChecks,
    completedAt: new Date().toISOString(),
  };
  await writeFile(finalEvidencePath, `${JSON.stringify(recoveredEvidence, null, 2)}\n`);
  await writeFile(planPath, `${JSON.stringify(recoveredEvidence, null, 2)}\n`);
  await unlink(provisionalEvidencePath).catch(() => {});
  console.log(JSON.stringify(recoveredEvidence, null, 2));
  process.exit(0);
}

if (!ready) throw new Error("V2 recovery settlement is not ready; no transaction was sent.");
const privateKey = process.env.XLAYER_PRIVATE_KEY;
if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error("XLAYER_PRIVATE_KEY is required for settlement broadcast.");
const account = privateKeyToAccount(privateKey as `0x${string}`);
const walletClient = createWalletClient({ account, chain, transport: http() });
const simulation = await publicClient.simulateContract({
  account,
  address: getAddress(vaultAddress),
  abi: vaultAbi,
  functionName: "settleRecovery",
  args: [{
    primaryServiceId: claim.primaryServiceId,
    backupServiceId: claim.backupServiceId,
    requestHash: claim.requestHash,
    failedReceiptHash: claim.failedReceiptHash,
    recoveredReceiptHash: claim.recoveredReceiptHash,
    buyer: claim.buyer,
    recoveryAmount: BigInt(claim.recoveryAmount),
    deadline: BigInt(claim.deadline),
    nonce: BigInt(claim.nonce),
  }, signature],
});
const transactionHash = await walletClient.writeContract(simulation.request);
const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
await writeFile(provisionalEvidencePath, `${JSON.stringify({
  evidenceVersion: "official-v2-live-settlement-pending-verification-1",
  mode: "XLAYER_TESTNET",
  requestHash: claim.requestHash,
  transactionHash,
  blockNumber: receipt.blockNumber.toString(),
  receiptStatus: receipt.status,
  note: "Receipt captured. Balance, event and replay invariants still require post-transaction verification.",
  recordedAt: new Date().toISOString(),
}, null, 2)}\n`);
const verified = await verifySettlementReceipt(receipt, {
  buyerAtomic: buyerBalance,
  backupAtomic: backupBalance,
  primaryBondAtomic: primary[1],
});
if (!Object.values(verified.settlementChecks).every(Boolean)) throw new Error("Post-settlement invariants failed; preserve the transaction for investigation.");
const finalEvidence = {
  ...plan,
  evidenceVersion: "official-v2-live-settlement-1",
  mode: "XLAYER_TESTNET",
  broadcast: true,
  relayer: account.address,
  transactionHash,
  explorer: `https://www.okx.com/web3/explorer/xlayer-test/tx/${transactionHash}`,
  blockNumber: receipt.blockNumber.toString(),
  gasUsed: receipt.gasUsed.toString(),
  balancesAfter: {
    buyerAtomic: verified.buyerAfter.toString(),
    backupAtomic: verified.backupAfter.toString(),
    primaryBondAtomic: verified.primaryAfter[1].toString(),
  },
  primaryActiveAfter: verified.primaryAfter[4],
  settlementChecks: verified.settlementChecks,
  completedAt: new Date().toISOString(),
};
await writeFile(finalEvidencePath, `${JSON.stringify(finalEvidence, null, 2)}\n`);
await writeFile(planPath, `${JSON.stringify(finalEvidence, null, 2)}\n`);
await unlink(provisionalEvidencePath).catch(() => {});
console.log(JSON.stringify(finalEvidence, null, 2));
