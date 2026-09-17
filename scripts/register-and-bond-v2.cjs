const hre = require("hardhat");
const { mkdir, writeFile } = require("node:fs/promises");

const EXPECTED_CHAIN_ID = 1952n;
const CONFIRMATION = "REGISTER_AND_BOND_V2_PROVIDERS_XLAYER_TESTNET";

function configuration() {
  return {
    primary: {
      label: "primary",
      serviceName: process.env.V2_PRIMARY_SERVICE_ID || "official-market-primary-v1",
      key: process.env.PROVIDER_SIGNING_KEY,
      address: process.env.PRIMARY_PROVIDER_ADDRESS || process.env.PROVIDER_ADDRESS,
      minimumBond: BigInt(process.env.V2_PRIMARY_MINIMUM_BOND_ATOMIC || "5000000"),
      maximumRecovery: BigInt(process.env.V2_PRIMARY_MAXIMUM_RECOVERY_ATOMIC || "10000"),
      depositAmount: BigInt(process.env.V2_PRIMARY_BOND_ATOMIC || "5000000"),
    },
    backup: {
      label: "backup",
      serviceName: process.env.V2_BACKUP_SERVICE_ID || "official-market-backup-v1",
      key: process.env.BACKUP_PROVIDER_SIGNING_KEY,
      address: process.env.BACKUP_PROVIDER_ADDRESS,
      minimumBond: BigInt(process.env.V2_BACKUP_MINIMUM_BOND_ATOMIC || "3000000"),
      maximumRecovery: BigInt(process.env.V2_BACKUP_MAXIMUM_RECOVERY_ATOMIC || "10000"),
      depositAmount: BigInt(process.env.V2_BACKUP_BOND_ATOMIC || "3000000"),
    },
  };
}

async function main() {
  const vaultAddress = process.env.RECOVERY_BOND_VAULT_V2_ADDRESS;
  const tokenAddress = process.env.USDT0_ADDRESS;
  if (!vaultAddress || !hre.ethers.isAddress(vaultAddress)) throw new Error("RECOVERY_BOND_VAULT_V2_ADDRESS is required.");
  if (!tokenAddress || !hre.ethers.isAddress(tokenAddress)) throw new Error("USDT0_ADDRESS is required.");
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== EXPECTED_CHAIN_ID) throw new Error(`Refusing V2 registration on chain ${network.chainId}; expected 1952.`);
  const vaultCode = await hre.ethers.provider.getCode(vaultAddress);
  if (vaultCode === "0x") throw new Error("RecoveryBondVaultV2 address has no contract code.");
  const vault = await hre.ethers.getContractAt("RecoveryBondVaultV2", vaultAddress);
  const [onchainToken, verifier] = await Promise.all([vault.settlementToken(), vault.verifier()]);
  if (onchainToken.toLowerCase() !== tokenAddress.toLowerCase()) throw new Error("V2 settlement token does not match USDT0_ADDRESS.");
  const config = configuration();
  for (const item of Object.values(config)) {
    if (!item.address || !hre.ethers.isAddress(item.address)) throw new Error(`${item.label} provider address is required.`);
    if (item.maximumRecovery === 0n || item.minimumBond === 0n || item.maximumRecovery > item.minimumBond) {
      throw new Error(`${item.label} bond limits are invalid.`);
    }
    if (item.depositAmount < item.minimumBond) throw new Error(`${item.label} deposit must activate the service.`);
  }
  if (config.primary.address.toLowerCase() === config.backup.address.toLowerCase()) {
    throw new Error("Primary and Backup must use independent addresses.");
  }
  const token = new hre.ethers.Contract(tokenAddress, [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
  ], hre.ethers.provider);
  const planItems = [];
  for (const item of Object.values(config)) {
    const serviceId = hre.ethers.id(item.serviceName);
    const [service, tokenBalance, allowance, nativeBalance] = await Promise.all([
      vault.services(serviceId),
      token.balanceOf(item.address),
      token.allowance(item.address, vaultAddress),
      hre.ethers.provider.getBalance(item.address),
    ]);
    const missingDeposit = item.depositAmount > service.bondBalance ? item.depositAmount - service.bondBalance : 0n;
    const tokenFundingGap = missingDeposit > tokenBalance ? missingDeposit - tokenBalance : 0n;
    const plannedTransactions = [];
    if (service.provider === hre.ethers.ZeroAddress) {
      plannedTransactions.push({ action: "REGISTER_SERVICE", to: vaultAddress, valueAtomic: "0" });
    }
    if (missingDeposit > 0n && allowance < item.depositAmount) {
      plannedTransactions.push({ action: "APPROVE_USDT0", to: tokenAddress, valueAtomic: "0", approvalAtomic: item.depositAmount.toString() });
    }
    if (missingDeposit > 0n) {
      plannedTransactions.push({ action: "DEPOSIT_BOND", to: vaultAddress, valueAtomic: "0", depositAtomic: missingDeposit.toString() });
    }
    const registrationMatches = service.provider === hre.ethers.ZeroAddress
      || service.provider.toLowerCase() === item.address.toLowerCase();
    planItems.push({
      role: item.label,
      serviceName: item.serviceName,
      serviceId,
      provider: item.address,
      minimumBondAtomic: item.minimumBond.toString(),
      maximumRecoveryAtomic: item.maximumRecovery.toString(),
      depositAmountAtomic: item.depositAmount.toString(),
      tokenBalanceAtomic: tokenBalance.toString(),
      nativeBalanceAtomic: nativeBalance.toString(),
      allowanceAtomic: allowance.toString(),
      alreadyRegistered: service.provider !== hre.ethers.ZeroAddress,
      currentProvider: service.provider,
      currentBondAtomic: service.bondBalance.toString(),
      missingDepositAtomic: missingDeposit.toString(),
      tokenFundingGapAtomic: tokenFundingGap.toString(),
      active: service.active,
      plannedTransactions,
      transactionCount: plannedTransactions.length,
      registrationMatches,
      ready: registrationMatches && tokenFundingGap === 0n && (plannedTransactions.length === 0 || nativeBalance > 0n),
    });
  }
  const plan = {
    evidenceVersion: "official-v2-bond-plan-1",
    mode: "XLAYER_TESTNET_READ_ONLY_PLAN",
    chainId: Number(network.chainId),
    vaultAddress,
    tokenAddress,
    verifier,
    providers: planItems,
    totalTransactionCount: planItems.reduce((total, item) => total + item.transactionCount, 0),
    fundingRequired: planItems.map((item) => ({
      role: item.role,
      provider: item.provider,
      tokenFundingGapAtomic: item.tokenFundingGapAtomic,
      nativeGasRequired: item.transactionCount > 0 && item.nativeBalanceAtomic === "0",
    })),
    independentProviders: config.primary.address.toLowerCase() !== config.backup.address.toLowerCase(),
    ready: planItems.every((item) => item.ready),
    broadcast: false,
    requiredConfirmation: CONFIRMATION,
    generatedAt: new Date().toISOString(),
  };
  await mkdir("evidence/official-build", { recursive: true });
  await writeFile("evidence/official-build/v2-bond-plan.json", `${JSON.stringify(plan, null, 2)}\n`);
  if (process.env.V2_BOND_CONFIRMATION !== CONFIRMATION) {
    console.log(JSON.stringify({ ...plan, next: `Fund both provider addresses, review this plan, then set V2_BOND_CONFIRMATION=${CONFIRMATION}.` }, null, 2));
    return;
  }
  if (!plan.ready) throw new Error("V2 Provider registration plan is not ready; no transaction was sent.");
  const transactions = {};
  for (const item of Object.values(config)) {
    if (!item.key || !/^0x[0-9a-fA-F]{64}$/.test(item.key)) throw new Error(`${item.label} signing key is required for broadcast.`);
    const signer = new hre.ethers.Wallet(item.key, hre.ethers.provider);
    if (signer.address.toLowerCase() !== item.address.toLowerCase()) throw new Error(`${item.label} signing key does not match its reviewed address.`);
    const serviceId = hre.ethers.id(item.serviceName);
    const connectedVault = vault.connect(signer);
    const connectedToken = token.connect(signer);
    const service = await connectedVault.services(serviceId);
    transactions[item.label] = {};
    if (service.provider === hre.ethers.ZeroAddress) {
      const register = await connectedVault.registerService(serviceId, item.minimumBond, item.maximumRecovery);
      const receipt = await register.wait();
      transactions[item.label].register = { hash: register.hash, blockNumber: receipt.blockNumber };
    }
    const allowance = await connectedToken.allowance(signer.address, vaultAddress);
    if (allowance < item.depositAmount) {
      const approve = await connectedToken.approve(vaultAddress, item.depositAmount);
      const receipt = await approve.wait();
      transactions[item.label].approve = { hash: approve.hash, blockNumber: receipt.blockNumber };
    }
    const latest = await connectedVault.services(serviceId);
    const missing = item.depositAmount > latest.bondBalance ? item.depositAmount - latest.bondBalance : 0n;
    if (missing > 0n) {
      const deposit = await connectedVault.depositBond(serviceId, missing);
      const receipt = await deposit.wait();
      transactions[item.label].deposit = { hash: deposit.hash, blockNumber: receipt.blockNumber };
    }
  }
  const final = {};
  for (const item of Object.values(config)) {
    const serviceId = hre.ethers.id(item.serviceName);
    const service = await vault.services(serviceId);
    final[item.label] = { serviceId, provider: service.provider, bondBalanceAtomic: service.bondBalance.toString(), active: service.active };
  }
  const evidence = { ...plan, mode: "XLAYER_TESTNET", broadcast: true, transactions, final, completedAt: new Date().toISOString() };
  await writeFile("evidence/official-build/v2-bonding.json", `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
