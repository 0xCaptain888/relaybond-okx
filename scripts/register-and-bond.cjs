const hre = require("hardhat");
const { mkdir, writeFile } = require("node:fs/promises");

async function main() {
  const vaultAddress = process.env.QUALITY_BOND_VAULT_ADDRESS;
  const tokenAddress = process.env.USDT0_ADDRESS;
  const promiseHash = process.env.SERVICE_PROMISE_HASH;
  const serviceName = process.env.SERVICE_ID || "market-data-v1";
  const minimumBond = BigInt(process.env.MINIMUM_BOND_ATOMIC || "5000000");
  const maximumRebate = BigInt(process.env.REBATE_ATOMIC || "10000");
  const depositAmount = BigInt(process.env.BOND_DEPOSIT_ATOMIC || "5000000");
  if (!vaultAddress || !tokenAddress || !promiseHash) {
    throw new Error("QUALITY_BOND_VAULT_ADDRESS, USDT0_ADDRESS and SERVICE_PROMISE_HASH are required");
  }

  const [provider] = await hre.ethers.getSigners();
  const serviceId = hre.ethers.id(serviceName);
  const vault = await hre.ethers.getContractAt("QualityBondVault", vaultAddress, provider);
  const token = new hre.ethers.Contract(
    tokenAddress,
    ["function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"],
    provider,
  );
  const balance = await token.balanceOf(provider.address);
  if (balance < depositAmount) throw new Error(`Insufficient USDT0: have ${balance}, need ${depositAmount}`);

  const register = await vault.registerService(serviceId, promiseHash, minimumBond, maximumRebate);
  const registerReceipt = await register.wait();
  const approve = await token.approve(vaultAddress, depositAmount);
  const approveReceipt = await approve.wait();
  const deposit = await vault.depositBond(serviceId, depositAmount);
  const depositReceipt = await deposit.wait();
  const service = await vault.services(serviceId);
  const evidence = {
    evidenceVersion: "1",
    mode: Number((await hre.ethers.provider.getNetwork()).chainId) === 196 ? "XLAYER_MAINNET" : "XLAYER_TESTNET",
    serviceName,
    serviceId,
    promiseHash,
    provider: provider.address,
    vaultAddress,
    tokenAddress,
    bondBalanceAtomic: service.bondBalance.toString(),
    active: service.active,
    transactions: {
      register: { hash: register.hash, blockNumber: registerReceipt.blockNumber },
      approve: { hash: approve.hash, blockNumber: approveReceipt.blockNumber },
      deposit: { hash: deposit.hash, blockNumber: depositReceipt.blockNumber },
    },
    generatedAt: new Date().toISOString(),
  };
  await mkdir("evidence/live", { recursive: true });
  await writeFile("evidence/live/bond.json", `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
