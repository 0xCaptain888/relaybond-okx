const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("QualityBondVault", function () {
  async function fixture() {
    const [provider, verifier, buyer] = await ethers.getSigners();
    const token = await ethers.deployContract("MockUSDT0");
    const vault = await ethers.deployContract("QualityBondVault", [token.target, verifier.address]);
    const serviceId = ethers.id("market-data-v1");
    const promiseHash = ethers.id("promise-v1");
    await token.mint(provider.address, 5_000_000);
    await token.connect(provider).approve(vault.target, 5_000_000);
    await vault.connect(provider).registerService(serviceId, promiseHash, 1_000_000, 10_000);
    await vault.connect(provider).depositBond(serviceId, 5_000_000);
    return { provider, verifier, buyer, token, vault, serviceId };
  }

  it("activates a service only after its minimum bond is funded", async function () {
    const { vault, serviceId, provider } = await fixture();
    const service = await vault.services(serviceId);
    expect(service.provider).to.equal(provider.address);
    expect(service.active).to.equal(true);
    expect(service.bondBalance).to.equal(5_000_000);
  });

  it("pays a verifier-attested rebate and prevents replay", async function () {
    const { verifier, buyer, token, vault, serviceId } = await fixture();
    const promiseHash = ethers.id("promise-v1");
    const requestHash = ethers.id("request-1");
    const receiptHash = ethers.id("signed-empty-response");
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const nonce = 1;
    const domain = {
      name: "RelayBond",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: vault.target,
    };
    const types = {
      BreachAttestation: [
        { name: "serviceId", type: "bytes32" },
        { name: "promiseHash", type: "bytes32" },
        { name: "requestHash", type: "bytes32" },
        { name: "receiptHash", type: "bytes32" },
        { name: "buyer", type: "address" },
        { name: "rebateAmount", type: "uint256" },
        { name: "deadline", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    };
    const value = { serviceId, promiseHash, requestHash, receiptHash, buyer: buyer.address, rebateAmount: 10_000, deadline, nonce };
    const signature = await verifier.signTypedData(domain, types, value);

    await expect(vault.claimBreach(serviceId, promiseHash, requestHash, receiptHash, buyer.address, 10_000, deadline, nonce, signature))
      .to.emit(vault, "BreachRebated")
      .withArgs(serviceId, requestHash, receiptHash, await vault.services(serviceId).then((x) => x.provider), buyer.address, 10_000, 4_990_000);
    expect(await token.balanceOf(buyer.address)).to.equal(10_000);
    await expect(vault.claimBreach(serviceId, promiseHash, requestHash, receiptHash, buyer.address, 10_000, deadline, nonce, signature))
      .to.be.revertedWithCustomError(vault, "AlreadySettled");
  });

  it("rejects an attestation signed by anyone except the verifier", async function () {
    const { provider, buyer, vault, serviceId } = await fixture();
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const value = {
      serviceId,
      promiseHash: ethers.id("promise-v1"),
      requestHash: ethers.id("request-2"),
      receiptHash: ethers.id("receipt-2"),
      buyer: buyer.address,
      rebateAmount: 10_000,
      deadline,
      nonce: 2,
    };
    const signature = await provider.signTypedData(
      { name: "RelayBond", version: "1", chainId: (await ethers.provider.getNetwork()).chainId, verifyingContract: vault.target },
      { BreachAttestation: [
        { name: "serviceId", type: "bytes32" }, { name: "promiseHash", type: "bytes32" },
        { name: "requestHash", type: "bytes32" },
        { name: "receiptHash", type: "bytes32" }, { name: "buyer", type: "address" },
        { name: "rebateAmount", type: "uint256" }, { name: "deadline", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ] },
      value,
    );
    await expect(vault.claimBreach(serviceId, value.promiseHash, value.requestHash, value.receiptHash, buyer.address, 10_000, deadline, 2, signature))
      .to.be.revertedWithCustomError(vault, "InvalidSignature");
  });

  it("rejects a valid verifier signature bound to an obsolete promise", async function () {
    const { verifier, buyer, vault, serviceId } = await fixture();
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const value = {
      serviceId,
      promiseHash: ethers.id("obsolete-promise"),
      requestHash: ethers.id("request-3"),
      receiptHash: ethers.id("receipt-3"),
      buyer: buyer.address,
      rebateAmount: 10_000,
      deadline,
      nonce: 3,
    };
    const signature = await verifier.signTypedData(
      { name: "RelayBond", version: "1", chainId: (await ethers.provider.getNetwork()).chainId, verifyingContract: vault.target },
      { BreachAttestation: [
        { name: "serviceId", type: "bytes32" }, { name: "promiseHash", type: "bytes32" },
        { name: "requestHash", type: "bytes32" }, { name: "receiptHash", type: "bytes32" },
        { name: "buyer", type: "address" }, { name: "rebateAmount", type: "uint256" },
        { name: "deadline", type: "uint256" }, { name: "nonce", type: "uint256" },
      ] },
      value,
    );
    await expect(vault.claimBreach(serviceId, value.promiseHash, value.requestHash, value.receiptHash, buyer.address, 10_000, deadline, 3, signature))
      .to.be.revertedWithCustomError(vault, "InvalidState");
  });
});
