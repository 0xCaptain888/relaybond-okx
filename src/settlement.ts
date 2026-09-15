import { createPublicClient, decodeEventLog, getAddress, http, parseAbiItem, type Address, type Hex } from "viem";

const transferEvent = parseAbiItem("event Transfer(address indexed from,address indexed to,uint256 value)");

export type VerifiedOnchainSettlement = {
  status: "success";
  transactionHash: Hex;
  blockNumber: string;
  token: Address;
  payer: Address;
  payTo: Address;
  amountAtomic: string;
};

export function settlementTransaction(data: Record<string, unknown>): Hex {
  const decoded = data.decodedReceipt;
  const receiptTransaction = decoded && typeof decoded === "object" && !Array.isArray(decoded)
    ? (decoded as Record<string, unknown>).transaction
    : undefined;
  const transaction = typeof receiptTransaction === "string"
    ? receiptTransaction
    : typeof data.txHash === "string"
      ? data.txHash
      : "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(transaction)) {
    throw new Error("Payment response is missing a valid settlement transaction hash.");
  }
  return transaction as Hex;
}

export async function verifyOnchainSettlement(input: {
  rpcUrl: string;
  transactionHash: Hex;
  token: Address;
  payer: Address;
  payTo: Address;
  amountAtomic: string;
}): Promise<VerifiedOnchainSettlement> {
  const client = createPublicClient({ transport: http(input.rpcUrl) });
  const receipt = await client.waitForTransactionReceipt({
    hash: input.transactionHash,
    confirmations: 1,
    timeout: 60_000,
  });
  if (receipt.status !== "success") throw new Error(`Settlement transaction reverted: ${input.transactionHash}`);
  const matched = receipt.logs.some((log) => {
    if (log.address.toLowerCase() !== input.token.toLowerCase()) return false;
    try {
      const decoded = decodeEventLog({ abi: [transferEvent], data: log.data, topics: log.topics });
      return decoded.eventName === "Transfer" &&
        getAddress(decoded.args.from) === getAddress(input.payer) &&
        getAddress(decoded.args.to) === getAddress(input.payTo) &&
        decoded.args.value === BigInt(input.amountAtomic);
    } catch {
      return false;
    }
  });
  if (!matched) throw new Error("Settlement transaction does not contain the exact expected USD₮0 transfer.");
  return {
    status: "success",
    transactionHash: input.transactionHash,
    blockNumber: receipt.blockNumber.toString(),
    token: getAddress(input.token),
    payer: getAddress(input.payer),
    payTo: getAddress(input.payTo),
    amountAtomic: input.amountAtomic,
  };
}
