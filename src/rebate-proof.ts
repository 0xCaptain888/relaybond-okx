import {
  decodeEventLog,
  getAddress,
  isAddressEqual,
  parseAbi,
  type Address,
  type Hex,
} from "viem";

export const rebateVaultAbi = parseAbi([
  "function verifier() view returns (address)",
  "function settlementToken() view returns (address)",
  "function services(bytes32) view returns (address provider, bytes32 promiseHash, uint128 bondBalance, uint128 minimumBond, uint128 maximumRebate, bool active, uint64 withdrawalAvailableAt, uint128 pendingWithdrawal)",
  "function claimBreach(bytes32 serviceId, bytes32 promiseHash, bytes32 requestHash, bytes32 receiptHash, address buyer, uint256 rebateAmount, uint256 deadline, uint256 nonce, bytes signature)",
  "event ServiceStatusChanged(bytes32 indexed serviceId, bool active)",
  "event BreachRebated(bytes32 indexed serviceId, bytes32 indexed requestHash, bytes32 indexed receiptHash, address provider, address buyer, uint256 amount, uint256 remainingBond)",
]);

const transferAbi = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

type ReceiptLog = {
  address: Address;
  data: Hex;
  topics: [] | [Hex, ...Hex[]];
  logIndex?: number | null;
};

export type ExpectedRebate = {
  serviceId: Hex;
  requestHash: Hex;
  receiptHash: Hex;
  provider: Address;
  buyer: Address;
  amount: bigint;
};

export function verifyRebateReceiptLogs(input: {
  logs: readonly ReceiptLog[];
  vault: Address;
  token: Address;
  expected: ExpectedRebate;
}) {
  const vaultEvents = input.logs.flatMap((log) => {
    if (!isAddressEqual(log.address, input.vault)) return [];
    try {
      return [{ log, decoded: decodeEventLog({ abi: rebateVaultAbi, data: log.data, topics: log.topics, strict: true }) }];
    } catch {
      return [];
    }
  });
  const rebateEvents = vaultEvents.filter(({ decoded }) => decoded.eventName === "BreachRebated");
  if (rebateEvents.length !== 1) throw new Error(`Expected exactly one BreachRebated event, found ${rebateEvents.length}.`);
  const rebate = rebateEvents[0];
  const rebateArgs = rebate.decoded.args as unknown as {
    serviceId: Hex;
    requestHash: Hex;
    receiptHash: Hex;
    provider: Address;
    buyer: Address;
    amount: bigint;
    remainingBond: bigint;
  };
  if (rebateArgs.serviceId !== input.expected.serviceId) throw new Error("BreachRebated service ID does not match the claim.");
  if (rebateArgs.requestHash !== input.expected.requestHash) throw new Error("BreachRebated request hash does not match the claim.");
  if (rebateArgs.receiptHash !== input.expected.receiptHash) throw new Error("BreachRebated receipt hash does not match the claim.");
  if (!isAddressEqual(rebateArgs.provider, input.expected.provider)) throw new Error("BreachRebated provider does not match the registered service.");
  if (!isAddressEqual(rebateArgs.buyer, input.expected.buyer)) throw new Error("BreachRebated buyer does not match the paid delivery.");
  if (rebateArgs.amount !== input.expected.amount) throw new Error("BreachRebated amount does not match the promised rebate.");

  const transfers = input.logs.flatMap((log) => {
    if (!isAddressEqual(log.address, input.token)) return [];
    try {
      const decoded = decodeEventLog({ abi: transferAbi, data: log.data, topics: log.topics, strict: true });
      if (decoded.eventName !== "Transfer") return [];
      return [{ log, args: decoded.args as { from: Address; to: Address; value: bigint } }];
    } catch {
      return [];
    }
  }).filter(({ args }) =>
    isAddressEqual(args.from, input.vault)
    && isAddressEqual(args.to, input.expected.buyer)
    && args.value === input.expected.amount
  );
  if (transfers.length !== 1) throw new Error(`Expected exactly one matching rebate token Transfer, found ${transfers.length}.`);

  const inactiveEvent = vaultEvents.find(({ decoded }) => {
    if (decoded.eventName !== "ServiceStatusChanged") return false;
    const args = decoded.args as unknown as { serviceId: Hex; active: boolean };
    return args.serviceId === input.expected.serviceId && args.active === false;
  });

  return {
    rebateEvent: {
      logIndex: rebate.log.logIndex ?? null,
      serviceId: rebateArgs.serviceId,
      requestHash: rebateArgs.requestHash,
      receiptHash: rebateArgs.receiptHash,
      provider: getAddress(rebateArgs.provider),
      buyer: getAddress(rebateArgs.buyer),
      amountAtomic: rebateArgs.amount.toString(),
      remainingBondAtomic: rebateArgs.remainingBond.toString(),
    },
    transfer: {
      logIndex: transfers[0].log.logIndex ?? null,
      token: getAddress(input.token),
      from: getAddress(transfers[0].args.from),
      to: getAddress(transfers[0].args.to),
      amountAtomic: transfers[0].args.value.toString(),
    },
    serviceInactiveEventFound: Boolean(inactiveEvent),
  };
}
