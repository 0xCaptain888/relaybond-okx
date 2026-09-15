const hre = require("hardhat");
const { mkdir, writeFile } = require("node:fs/promises");

async function main() {
  const required = ["QUALITY_BOND_VAULT_ADDRESS", "VERIFIER_PRIVATE_KEY", "SERVICE_PROMISE_HASH", "REQUEST_HASH", "RECEIPT_HASH", "BUYER_ADDRESS"];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Missing: ${missing.join(", ")}`);

  const [submitter] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  const vault = await hre.ethers.getContractAt("QualityBondVault", process.env.QUALITY_BOND_VAULT_ADDRESS, submitter);
  const verifier = new hre.ethers.Wallet(process.env.VERIFIER_PRIVATE_KEY);
  const serviceId = hre.ethers.id(process.env.SERVICE_ID || "market-data-v1");
  const rebateAmount = BigInt(process.env.REBATE_ATOMIC || "10000");
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const nonce = BigInt(process.env.ATTESTATION_NONCE || Date.now().toString());
  const value = {
    serviceId,
    promiseHash: process.env.SERVICE_PROMISE_HASH,
    requestHash: process.env.REQUEST_HASH,
    receiptHash: process.env.RECEIPT_HASH,
    buyer: process.env.BUYER_ADDRESS,
    rebateAmount,
    deadline,
    nonce,
  };
  const signature = await verifier.signTypedData(
    { name: "RelayBond", version: "1", chainId: network.chainId, verifyingContract: process.env.QUALITY_BOND_VAULT_ADDRESS },
    { BreachAttestation: [
      { name: "serviceId", type: "bytes32" }, { name: "promiseHash", type: "bytes32" },
      { name: "requestHash", type: "bytes32" }, { name: "receiptHash", type: "bytes32" },
      { name: "buyer", type: "address" }, { name: "rebateAmount", type: "uint256" },
      { name: "deadline", type: "uint256" }, { name: "nonce", type: "uint256" },
    ] },
    value,
  );
  const before = await vault.services(serviceId);
  const transaction = await vault.claimBreach(
    value.serviceId, value.promiseHash, value.requestHash, value.receiptHash,
    value.buyer, value.rebateAmount, value.deadline, value.nonce, signature,
  );
  const receipt = await transaction.wait();
  const after = await vault.services(serviceId);
  const evidence = {
    evidenceVersion: "1",
    mode: Number(network.chainId) === 196 ? "XLAYER_MAINNET" : "XLAYER_TESTNET",
    attestation: { ...value, rebateAmount: rebateAmount.toString(), nonce: nonce.toString(), signature, verifier: verifier.address },
    transactionHash: transaction.hash,
    blockNumber: receipt.blockNumber,
    bondBeforeAtomic: before.bondBalance.toString(),
    bondAfterAtomic: after.bondBalance.toString(),
    generatedAt: new Date().toISOString(),
  };
  await mkdir("evidence/live", { recursive: true });
  await writeFile("evidence/live/rebate.json", `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
