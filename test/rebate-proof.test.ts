import assert from "node:assert/strict";
import test from "node:test";
import { encodeEventTopics, encodeAbiParameters, parseAbiParameters, type Address, type Hex } from "viem";
import { rebateVaultAbi, verifyRebateReceiptLogs } from "../src/rebate-proof.js";

const vault = "0x15b18Fb8C1E29287B57EbBE30bd10ef165dc9eD5" as Address;
const token = "0x9e29b3AaDa05Bf2D2c827Af80Bd28Dc0b9b4FB0c" as Address;
const provider = "0x917b04d30478E9405445CfF208eaA9d61e2EC44d" as Address;
const buyer = "0xcb83AF485c066add3eca9041a78Ea7c14e3F15F4" as Address;
const serviceId = `0x${"11".repeat(32)}` as Hex;
const requestHash = `0x${"22".repeat(32)}` as Hex;
const receiptHash = `0x${"33".repeat(32)}` as Hex;

test("extracts and binds the rebate event, token transfer and inactive status", () => {
  const rebateTopics = encodeEventTopics({ abi: rebateVaultAbi, eventName: "BreachRebated", args: { serviceId, requestHash, receiptHash } });
  const statusTopics = encodeEventTopics({ abi: rebateVaultAbi, eventName: "ServiceStatusChanged", args: { serviceId } });
  const transferTopics = encodeEventTopics({
    abi: [{ type: "event", name: "Transfer", inputs: [{ indexed: true, name: "from", type: "address" }, { indexed: true, name: "to", type: "address" }, { indexed: false, name: "value", type: "uint256" }] }],
    eventName: "Transfer",
    args: { from: vault, to: buyer },
  });
  const result = verifyRebateReceiptLogs({
    vault,
    token,
    expected: { serviceId, requestHash, receiptHash, provider, buyer, amount: 10_000n },
    logs: [
      { address: vault, topics: statusTopics as [Hex, ...Hex[]], data: encodeAbiParameters(parseAbiParameters("bool"), [false]), logIndex: 3 },
      { address: token, topics: transferTopics as [Hex, ...Hex[]], data: encodeAbiParameters(parseAbiParameters("uint256"), [10_000n]), logIndex: 4 },
      { address: vault, topics: rebateTopics as [Hex, ...Hex[]], data: encodeAbiParameters(parseAbiParameters("address, address, uint256, uint256"), [provider, buyer, 10_000n, 4_990_000n]), logIndex: 5 },
    ],
  });
  assert.equal(result.rebateEvent.remainingBondAtomic, "4990000");
  assert.equal(result.transfer.amountAtomic, "10000");
  assert.equal(result.serviceInactiveEventFound, true);
});

test("rejects a receipt whose token transfer does not repay the buyer", () => {
  const rebateTopics = encodeEventTopics({ abi: rebateVaultAbi, eventName: "BreachRebated", args: { serviceId, requestHash, receiptHash } });
  assert.throws(() => verifyRebateReceiptLogs({
    vault,
    token,
    expected: { serviceId, requestHash, receiptHash, provider, buyer, amount: 10_000n },
    logs: [{ address: vault, topics: rebateTopics as [Hex, ...Hex[]], data: encodeAbiParameters(parseAbiParameters("address, address, uint256, uint256"), [provider, buyer, 10_000n, 4_990_000n]) }],
  }), /matching rebate token Transfer/);
});
