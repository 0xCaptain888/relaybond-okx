import { readFile, writeFile } from "node:fs/promises";
import { createPublicClient, getAddress, http, type Address, type Hex } from "viem";
import { buildBreachClaim, type PaidBreachEvidence } from "../src/breach-claim.js";
import { rebateVaultAbi, verifyRebateReceiptLogs } from "../src/rebate-proof.js";

const rpcUrl = process.env.XLAYER_TESTNET_RPC_URL;
const vault = process.env.QUALITY_BOND_VAULT_ADDRESS as Address | undefined;
if (!rpcUrl || !vault) throw new Error("XLAYER_TESTNET_RPC_URL and QUALITY_BOND_VAULT_ADDRESS are required.");

const chain = {
  id: 1952,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
} as const;
const client = createPublicClient({ chain, transport: http(rpcUrl) });
const [rebateEvidence, breachEvidence] = await Promise.all([
  readFile("evidence/live/rebate.json", "utf8").then(JSON.parse),
  readFile("evidence/live/agentic-wallet-paid-breach.json", "utf8").then(JSON.parse) as Promise<PaidBreachEvidence>,
]);
const claim = await buildBreachClaim(breachEvidence);
const transactionHash = rebateEvidence.transactionHash as Hex;
const receipt = await client.getTransactionReceipt({ hash: transactionHash });
if (receipt.status !== "success") throw new Error(`Rebate transaction is not successful: ${transactionHash}`);
const [token, state, block] = await Promise.all([
  client.readContract({ address: vault, abi: rebateVaultAbi, functionName: "settlementToken" }),
  client.readContract({ address: vault, abi: rebateVaultAbi, functionName: "services", args: [claim.serviceId], blockNumber: receipt.blockNumber }),
  client.getBlock({ blockNumber: receipt.blockNumber }),
]);
const proof = verifyRebateReceiptLogs({
  logs: receipt.logs,
  vault,
  token,
  expected: {
    serviceId: claim.serviceId,
    requestHash: claim.requestHash,
    receiptHash: claim.receiptHash,
    provider: state[0],
    buyer: claim.buyer,
    amount: claim.rebateAmount,
  },
});
if (state[2].toString() !== proof.rebateEvent.remainingBondAtomic) throw new Error("Block-pinned state disagrees with BreachRebated remainingBond.");
if (state[5] === false && !proof.serviceInactiveEventFound) throw new Error("Missing ServiceStatusChanged(false) event.");

const corrected = {
  ...rebateEvidence,
  evidenceVersion: "2",
  settlementToken: getAddress(token),
  blockNumber: receipt.blockNumber.toString(),
  blockTimestamp: block.timestamp.toString(),
  bondAfterAtomic: proof.rebateEvent.remainingBondAtomic,
  serviceActiveAfter: state[5],
  verification: {
    receiptStatus: receipt.status,
    blockPinnedStateMatched: true,
    bondDeltaMatched: BigInt(rebateEvidence.bondBeforeAtomic) - BigInt(proof.rebateEvent.remainingBondAtomic) === claim.rebateAmount,
    breachEventMatched: true,
    transferMatched: true,
    serviceStatusEventMatched: state[5] ? null : proof.serviceInactiveEventFound,
    rebateEvent: proof.rebateEvent,
    transfer: proof.transfer,
  },
  generatedAt: new Date().toISOString(),
};
if (!corrected.verification.bondDeltaMatched) throw new Error("Bond delta does not equal the rebate amount.");
await writeFile("evidence/live/rebate.json", `${JSON.stringify(corrected, null, 2)}\n`);

const latestBlock = await client.getBlockNumber();
const balance = await client.readContract({
  address: token,
  abi: [{ type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] }],
  functionName: "balanceOf",
  args: [claim.buyer],
  blockNumber: latestBlock,
});
const walletEvidence = {
  evidenceVersion: "1",
  mode: "XLAYER_TESTNET_READ_ONLY",
  address: getAddress(claim.buyer),
  token: getAddress(token),
  balanceAtomic: balance.toString(),
  balanceDisplay: `${(Number(balance) / 1_000_000).toFixed(2)} USD₮0`,
  blockNumber: latestBlock.toString(),
  capturedAt: new Date().toISOString(),
};
await writeFile("evidence/live/agentic-wallet-balance.json", `${JSON.stringify(walletEvidence, null, 2)}\n`);
console.log(JSON.stringify({ rebate: corrected, wallet: walletEvidence }, null, 2));
