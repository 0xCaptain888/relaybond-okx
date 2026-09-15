const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RecoveryBondVaultV2", function () {
  const recoveryTypes = { RecoveryAttestation: [
    { name: "primaryServiceId", type: "bytes32" }, { name: "backupServiceId", type: "bytes32" },
    { name: "requestHash", type: "bytes32" }, { name: "failedReceiptHash", type: "bytes32" },
    { name: "recoveredReceiptHash", type: "bytes32" }, { name: "buyer", type: "address" },
    { name: "recoveryAmount", type: "uint256" }, { name: "deadline", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ] };

  async function signRecovery(signer, vault, value) {
    return signer.signTypedData(
      { name: "RelayBond Recovery", version: "2", chainId: (await ethers.provider.getNetwork()).chainId, verifyingContract: vault.target },
      recoveryTypes,
      value,
    );
  }

  async function fixture() {
    const [primary, backup, verifier, buyer] = await ethers.getSigners();
    const token = await ethers.deployContract("MockUSDT0");
    const vault = await ethers.deployContract("RecoveryBondVaultV2", [token.target, verifier.address]);
    const primaryServiceId = ethers.id("primary-market-v2");
    const backupServiceId = ethers.id("backup-market-v2");
    await token.mint(primary.address, 5_000_000);
    await token.mint(backup.address, 2_000_000);
    await vault.connect(primary).registerService(primaryServiceId, 5_000_000, 10_000);
    await vault.connect(backup).registerService(backupServiceId, 2_000_000, 10_000);
    await token.connect(primary).approve(vault.target, 5_000_000);
    await token.connect(backup).approve(vault.target, 2_000_000);
    await vault.connect(primary).depositBond(primaryServiceId, 5_000_000);
    await vault.connect(backup).depositBond(backupServiceId, 2_000_000);
    return { primary, backup, verifier, buyer, token, vault, primaryServiceId, backupServiceId };
  }

  it("pays an accepted backup from the failed provider bond without charging the buyer again", async function () {
    const { primary, backup, verifier, buyer, token, vault, primaryServiceId, backupServiceId } = await fixture();
    const requestHash = ethers.id("continuity-task-1");
    const failedReceiptHash = ethers.id("stale-primary-receipt");
    const recoveredReceiptHash = ethers.id("accepted-backup-receipt");
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const nonce = 1;
    const value = { primaryServiceId, backupServiceId, requestHash, failedReceiptHash, recoveredReceiptHash, buyer: buyer.address, recoveryAmount: 10_000, deadline, nonce };
    const signature = await signRecovery(verifier, vault, value);
    const buyerBefore = await token.balanceOf(buyer.address);
    await expect(vault.settleRecovery(value, signature))
      .to.emit(vault, "BreachRecovered")
      .withArgs(primaryServiceId, backupServiceId, requestHash, failedReceiptHash, recoveredReceiptHash, buyer.address, backup.address, 10_000, 4_990_000);
    expect(await token.balanceOf(backup.address)).to.equal(10_000);
    expect(await token.balanceOf(buyer.address)).to.equal(buyerBefore);
    expect((await vault.services(primaryServiceId)).active).to.equal(false);
    await expect(vault.settleRecovery(value, signature))
      .to.be.revertedWithCustomError(vault, "AlreadyRecovered");
  });

  it("rejects recovery when the backup is not independently bonded", async function () {
    const [primary, backup, verifier, buyer] = await ethers.getSigners();
    const token = await ethers.deployContract("MockUSDT0");
    const vault = await ethers.deployContract("RecoveryBondVaultV2", [token.target, verifier.address]);
    const primaryServiceId = ethers.id("primary");
    const backupServiceId = ethers.id("backup");
    await token.mint(primary.address, 5_000_000);
    await vault.connect(primary).registerService(primaryServiceId, 5_000_000, 10_000);
    await vault.connect(backup).registerService(backupServiceId, 2_000_000, 10_000);
    await token.connect(primary).approve(vault.target, 5_000_000);
    await vault.connect(primary).depositBond(primaryServiceId, 5_000_000);
    const claim = { primaryServiceId, backupServiceId, requestHash: ethers.id("r"), failedReceiptHash: ethers.id("f"), recoveredReceiptHash: ethers.id("ok"), buyer: buyer.address, recoveryAmount: 10_000, deadline: 9999999999, nonce: 1 };
    await expect(vault.settleRecovery(claim, "0x"))
      .to.be.revertedWithCustomError(vault, "InvalidState");
  });

  it("rejects a recovery signed by anyone except the configured verifier", async function () {
    const { primary, buyer, vault, primaryServiceId, backupServiceId } = await fixture();
    const claim = { primaryServiceId, backupServiceId, requestHash: ethers.id("wrong-verifier"), failedReceiptHash: ethers.id("failed"), recoveredReceiptHash: ethers.id("recovered"), buyer: buyer.address, recoveryAmount: 10_000, deadline: 9_999_999_999, nonce: 2 };
    const signature = await signRecovery(primary, vault, claim);
    await expect(vault.settleRecovery(claim, signature))
      .to.be.revertedWithCustomError(vault, "InvalidSignature");
  });

  it("rejects an expired recovery attestation", async function () {
    const { verifier, buyer, vault, primaryServiceId, backupServiceId } = await fixture();
    const claim = { primaryServiceId, backupServiceId, requestHash: ethers.id("expired"), failedReceiptHash: ethers.id("failed"), recoveredReceiptHash: ethers.id("recovered"), buyer: buyer.address, recoveryAmount: 10_000, deadline: 1, nonce: 3 };
    const signature = await signRecovery(verifier, vault, claim);
    await expect(vault.settleRecovery(claim, signature))
      .to.be.revertedWithCustomError(vault, "ExpiredAttestation");
  });
});
