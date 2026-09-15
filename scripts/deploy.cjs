const hre = require("hardhat");
const { mkdir, writeFile } = require("node:fs/promises");

async function main() {
  const settlementToken = process.env.USDT0_ADDRESS;
  const verifier = process.env.VERIFIER_ADDRESS;
  if (!settlementToken || !verifier) throw new Error("USDT0_ADDRESS and VERIFIER_ADDRESS are required");

  const network = await hre.ethers.provider.getNetwork();
  const vault = await hre.ethers.deployContract("QualityBondVault", [settlementToken, verifier]);
  await vault.waitForDeployment();
  const transaction = vault.deploymentTransaction();
  if (!transaction) throw new Error("Missing deployment transaction");
  const receipt = await transaction.wait();
  const evidence = {
    evidenceVersion: "1",
    chainId: Number(network.chainId),
    mode: Number(network.chainId) === 196 ? "XLAYER_MAINNET" : "XLAYER_TESTNET",
    contract: "QualityBondVault",
    address: await vault.getAddress(),
    settlementToken,
    verifier,
    deployer: transaction.from,
    transactionHash: transaction.hash,
    blockNumber: receipt?.blockNumber,
    deployedAt: new Date().toISOString(),
  };
  await mkdir("evidence/live", { recursive: true });
  await writeFile("evidence/live/deployment.json", `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
