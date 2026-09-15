require("@nomicfoundation/hardhat-toolbox");

const privateKey = process.env.XLAYER_PRIVATE_KEY || "";

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    xLayerTestnet: {
      url: process.env.XLAYER_TESTNET_RPC_URL || "https://testrpc.xlayer.tech/terigon",
      chainId: 1952,
      accounts: privateKey ? [privateKey] : [],
    },
    xLayer: {
      url: process.env.XLAYER_RPC_URL || "https://rpc.xlayer.tech",
      chainId: 196,
      accounts: privateKey ? [privateKey] : [],
    },
  },
};
