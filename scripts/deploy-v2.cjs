const hre = require("hardhat");
const { mkdir, writeFile } = require("node:fs/promises");

const EXPECTED_CHAIN_ID = 1952n;
const CONFIRMATION = "DEPLOY_RECOVERY_BOND_V2_XLAYER_TESTNET";

async function main() {
  const settlementToken = process.env.USDT0_ADDRESS;
  const verifier = process.env.VERIFIER_ADDRESS;
  if (!settlementToken || !hre.ethers.isAddress(settlementToken)) throw new Error("USDT0_ADDRESS is required and must be an address.");
  if (!verifier || !hre.ethers.isAddress(verifier)) throw new Error("VERIFIER_ADDRESS is required and must be an address.");
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== EXPECTED_CHAIN_ID) throw new Error(`Refusing V2 deployment on chain ${network.chainId}; expected X Layer Testnet 1952.`);
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error("XLAYER_PRIVATE_KEY is required to build the deployment plan.");
  const [tokenCode, nativeBalance] = await Promise.all([
    hre.ethers.provider.getCode(settlementToken),
    hre.ethers.provider.getBalance(deployer.address),
  ]);
  if (tokenCode === "0x") throw new Error("USDT0_ADDRESS has no contract code on X Layer Testnet.");
  const factory = await hre.ethers.getContractFactory("RecoveryBondVaultV2", deployer);
  const transaction = await factory.getDeployTransaction(settlementToken, verifier);
  const nonce = await hre.ethers.provider.getTransactionCount(deployer.address, "pending");
  const predictedAddress = hre.ethers.getCreateAddress({ from: deployer.address, nonce });
  const gasEstimate = await hre.ethers.provider.estimateGas({ ...transaction, from: deployer.address });
  const feeData = await hre.ethers.provider.getFeeData();
  const estimatedGasCost = feeData.gasPrice ? gasEstimate * feeData.gasPrice : null;
  const existingCode = await hre.ethers.provider.getCode(predictedAddress);
  const unsignedPlan = {
    evidenceVersion: "official-v2-plan-1",
    mode: "XLAYER_TESTNET_READ_ONLY_PLAN",
    chainId: Number(network.chainId),
    contract: "RecoveryBondVaultV2",
    settlementToken,
    verifier,
    deployer: deployer.address,
    deployerNativeBalanceAtomic: nativeBalance.toString(),
    constructorArguments: [settlementToken, verifier],
    bytecodeHash: hre.ethers.keccak256(factory.bytecode),
    gasEstimate: gasEstimate.toString(),
    gasPriceAtomic: feeData.gasPrice?.toString() ?? null,
    estimatedGasCostAtomic: estimatedGasCost?.toString() ?? null,
    nonce,
    predictedAddress,
    predictedAddressUnused: existingCode === "0x",
    broadcast: false,
    requiredConfirmation: CONFIRMATION,
    generatedAt: new Date().toISOString(),
  };
  await mkdir("evidence/official-build", { recursive: true });
  await writeFile("evidence/official-build/v2-deployment-plan.json", `${JSON.stringify(unsignedPlan, null, 2)}\n`);
  if (process.env.V2_DEPLOY_CONFIRMATION !== CONFIRMATION) {
    console.log(JSON.stringify({
      ...unsignedPlan,
      next: `Set V2_DEPLOY_CONFIRMATION=${CONFIRMATION} only after reviewing network, token, verifier, deployer, predicted address and gas.`,
    }, null, 2));
    return;
  }
  if (nativeBalance === 0n) throw new Error("Deployer has no native gas balance.");
  if (existingCode !== "0x") throw new Error("Predicted deployment address already contains code; rebuild and review a fresh plan.");
  const vault = await factory.deploy(settlementToken, verifier);
  const deploymentTransaction = vault.deploymentTransaction();
  if (!deploymentTransaction) throw new Error("Deployment transaction was not created.");
  const receipt = await deploymentTransaction.wait();
  if (!receipt || receipt.status !== 1) throw new Error("V2 deployment did not reach a successful receipt.");
  const address = await vault.getAddress();
  const [deployedCode, onchainToken, onchainVerifier] = await Promise.all([
    hre.ethers.provider.getCode(address),
    vault.settlementToken(),
    vault.verifier(),
  ]);
  if (deployedCode === "0x") throw new Error("V2 deployment address has no runtime bytecode.");
  if (onchainToken.toLowerCase() !== settlementToken.toLowerCase()) throw new Error("V2 settlement token mismatch.");
  if (onchainVerifier.toLowerCase() !== verifier.toLowerCase()) throw new Error("V2 verifier mismatch.");
  const evidence = {
    ...unsignedPlan,
    mode: "XLAYER_TESTNET",
    address,
    transactionHash: deploymentTransaction.hash,
    blockNumber: receipt.blockNumber,
    broadcast: true,
    confirmedConstructor: { settlementToken: onchainToken, verifier: onchainVerifier },
    deployedAt: new Date().toISOString(),
  };
  await writeFile("evidence/official-build/v2-deployment.json", `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
