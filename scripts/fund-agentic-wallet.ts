import { mkdir, writeFile } from "node:fs/promises";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || "" : "";
}

if (!process.argv.includes("--confirm")) {
  throw new Error("Refusing to transfer without explicit --confirm.");
}

const rpcUrl = process.env.XLAYER_TESTNET_RPC_URL;
const privateKey = process.env.PROVIDER_SIGNING_KEY;
const configuredProvider = process.env.PROVIDER_ADDRESS;
const token = process.env.USDT0_ADDRESS as `0x${string}` | undefined;
const recipient = argument("--to") as `0x${string}`;
const amountAtomic = argument("--amount-atomic");

if (!rpcUrl || !privateKey || !configuredProvider || !token) {
  throw new Error("Missing X Layer RPC, provider signer/address or USD₮0 address.");
}
if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) throw new Error("Invalid recipient address.");
if (!/^\d+$/.test(amountAtomic) || BigInt(amountAtomic) <= 0n) throw new Error("Invalid transfer amount.");
if (BigInt(amountAtomic) > 1_000_000n) throw new Error("Funding helper is capped at 1 USD₮0 per invocation.");

const account = privateKeyToAccount(privateKey as `0x${string}`);
if (account.address.toLowerCase() !== configuredProvider.toLowerCase()) {
  throw new Error("PROVIDER_SIGNING_KEY does not match PROVIDER_ADDRESS.");
}

const chain = {
  id: 1952,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
} as const;
const abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);
const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });
const [balanceBefore, recipientBalanceBefore] = await Promise.all([
  publicClient.readContract({ address: token, abi, functionName: "balanceOf", args: [account.address] }),
  publicClient.readContract({ address: token, abi, functionName: "balanceOf", args: [recipient] }),
]);
if (balanceBefore < BigInt(amountAtomic)) {
  throw new Error(`Insufficient provider USD₮0 balance: ${balanceBefore} atomic.`);
}

const simulation = await publicClient.simulateContract({
  account,
  address: token,
  abi,
  functionName: "transfer",
  args: [recipient, BigInt(amountAtomic)],
});
if (simulation.result !== true) throw new Error("USD₮0 transfer simulation did not return true.");
const transactionHash = await walletClient.writeContract(simulation.request);
const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
if (receipt.status !== "success") throw new Error(`Funding transaction reverted: ${transactionHash}`);

const expectedProviderBalance = balanceBefore - BigInt(amountAtomic);
const expectedRecipientBalance = recipientBalanceBefore + BigInt(amountAtomic);
let balanceAfter = balanceBefore;
let recipientBalance = recipientBalanceBefore;
for (let attempt = 0; attempt < 10; attempt += 1) {
  [balanceAfter, recipientBalance] = await Promise.all([
    publicClient.readContract({ address: token, abi, functionName: "balanceOf", args: [account.address] }),
    publicClient.readContract({ address: token, abi, functionName: "balanceOf", args: [recipient] }),
  ]);
  if (balanceAfter === expectedProviderBalance && recipientBalance === expectedRecipientBalance) break;
  await new Promise((resolve) => setTimeout(resolve, 1_500));
}
if (balanceAfter !== expectedProviderBalance || recipientBalance !== expectedRecipientBalance) {
  throw new Error(`Transaction confirmed but RPC balance state did not converge: ${transactionHash}`);
}
const evidence = {
  evidenceVersion: "1",
  mode: "XLAYER_TESTNET",
  purpose: "Fund OKX Agentic Wallet for RelayBond x402 test",
  network: "eip155:1952",
  token,
  from: account.address,
  to: recipient,
  amountAtomic,
  transactionHash,
  blockNumber: receipt.blockNumber.toString(),
  providerBalanceBeforeAtomic: balanceBefore.toString(),
  providerBalanceAfterAtomic: balanceAfter.toString(),
  recipientBalanceBeforeAtomic: recipientBalanceBefore.toString(),
  recipientBalanceAfterAtomic: recipientBalance.toString(),
  recordedAt: new Date().toISOString(),
};
await mkdir("evidence/live", { recursive: true });
await writeFile("evidence/live/agentic-wallet-funding.json", `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
