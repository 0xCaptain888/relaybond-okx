import { readFile, writeFile } from "node:fs/promises";
import { createPublicClient, createWalletClient, getAddress, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { buildBreachClaim, type PaidBreachEvidence } from "../src/breach-claim.js";
import { rebateVaultAbi, verifyRebateReceiptLogs } from "../src/rebate-proof.js";

if (!process.argv.includes("--confirm")) {
  throw new Error("Refusing to submit a rebate without explicit --confirm.");
}

const evidenceIndex = process.argv.indexOf("--evidence");
const evidencePath = evidenceIndex >= 0
  ? process.argv[evidenceIndex + 1]
  : "evidence/live/agentic-wallet-paid-breach.json";
const required = ["XLAYER_TESTNET_RPC_URL", "XLAYER_PRIVATE_KEY", "VERIFIER_PRIVATE_KEY", "QUALITY_BOND_VAULT_ADDRESS"] as const;
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) throw new Error(`Missing live rebate configuration: ${missing.join(", ")}`);

const evidence = JSON.parse(await readFile(evidencePath, "utf8")) as PaidBreachEvidence;
const claim = await buildBreachClaim(evidence);
const submitter = privateKeyToAccount(process.env.XLAYER_PRIVATE_KEY as `0x${string}`);
const verifier = privateKeyToAccount(process.env.VERIFIER_PRIVATE_KEY as `0x${string}`);
const vault = process.env.QUALITY_BOND_VAULT_ADDRESS as `0x${string}`;
const chain = {
  id: 1952,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: [process.env.XLAYER_TESTNET_RPC_URL!] } },
} as const;
const publicClient = createPublicClient({ chain, transport: http(process.env.XLAYER_TESTNET_RPC_URL!) });
const walletClient = createWalletClient({ account: submitter, chain, transport: http(process.env.XLAYER_TESTNET_RPC_URL!) });
const configuredVerifier = await publicClient.readContract({ address: vault, abi: rebateVaultAbi, functionName: "verifier" });
if (configuredVerifier.toLowerCase() !== verifier.address.toLowerCase()) {
  throw new Error("VERIFIER_PRIVATE_KEY does not match the deployed vault verifier.");
}
const [before, token] = await Promise.all([
  publicClient.readContract({ address: vault, abi: rebateVaultAbi, functionName: "services", args: [claim.serviceId] }),
  publicClient.readContract({ address: vault, abi: rebateVaultAbi, functionName: "settlementToken" }),
]);
if (before[1] !== claim.promiseHash || !before[5]) throw new Error("Onchain service promise is not active or does not match the paid delivery.");

const deadline = BigInt(Math.floor(Date.now() / 1000) + 3_600);
const nonce = BigInt(Date.now());
const attestation = { ...claim, deadline, nonce };
const signature = await verifier.signTypedData({
  domain: { name: "RelayBond", version: "1", chainId: 1952, verifyingContract: vault },
  types: { BreachAttestation: [
    { name: "serviceId", type: "bytes32" },
    { name: "promiseHash", type: "bytes32" },
    { name: "requestHash", type: "bytes32" },
    { name: "receiptHash", type: "bytes32" },
    { name: "buyer", type: "address" },
    { name: "rebateAmount", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ] },
  primaryType: "BreachAttestation",
  message: attestation,
});
const simulation = await publicClient.simulateContract({
  account: submitter,
  address: vault,
  abi: rebateVaultAbi,
  functionName: "claimBreach",
  args: [claim.serviceId, claim.promiseHash, claim.requestHash, claim.receiptHash, claim.buyer, claim.rebateAmount, deadline, nonce, signature],
});
const transactionHash = await walletClient.writeContract(simulation.request);
const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
if (receipt.status !== "success") throw new Error(`Rebate transaction reverted: ${transactionHash}`);
const proof = verifyRebateReceiptLogs({
  logs: receipt.logs,
  vault,
  token,
  expected: {
    serviceId: claim.serviceId,
    requestHash: claim.requestHash,
    receiptHash: claim.receiptHash,
    provider: before[0],
    buyer: claim.buyer,
    amount: claim.rebateAmount,
  },
});
const after = await publicClient.readContract({
  address: vault,
  abi: rebateVaultAbi,
  functionName: "services",
  args: [claim.serviceId],
  blockNumber: receipt.blockNumber,
});
if (after[2].toString() !== proof.rebateEvent.remainingBondAtomic) {
  throw new Error("Receipt event and block-pinned contract state disagree on the remaining bond.");
}
if (before[2] - after[2] !== claim.rebateAmount) throw new Error("Bond delta does not equal the rebate amount.");
if (after[5] === false && !proof.serviceInactiveEventFound) throw new Error("Service became inactive without a matching ServiceStatusChanged event.");
const publicEvidence = {
  evidenceVersion: "1",
  mode: "XLAYER_TESTNET",
  sourceEvidence: evidencePath,
  attestation: {
    ...attestation,
    rebateAmount: claim.rebateAmount.toString(),
    deadline: deadline.toString(),
    nonce: nonce.toString(),
    signature,
    verifier: verifier.address,
  },
  transactionHash,
  blockNumber: receipt.blockNumber.toString(),
  settlementToken: getAddress(token),
  bondBeforeAtomic: before[2].toString(),
  bondAfterAtomic: proof.rebateEvent.remainingBondAtomic,
  serviceActiveAfter: after[5],
  verification: {
    receiptStatus: receipt.status,
    blockPinnedStateMatched: true,
    bondDeltaMatched: true,
    breachEventMatched: true,
    transferMatched: true,
    serviceStatusEventMatched: after[5] ? null : proof.serviceInactiveEventFound,
    rebateEvent: proof.rebateEvent,
    transfer: proof.transfer,
  },
  generatedAt: new Date().toISOString(),
};
await writeFile("evidence/live/rebate.json", `${JSON.stringify(publicEvidence, null, 2)}\n`);
console.log(JSON.stringify(publicEvidence, null, 2));
