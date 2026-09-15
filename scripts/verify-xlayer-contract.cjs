const { readFileSync, writeFileSync } = require("node:fs");
const { spawnSync } = require("node:child_process");

const pluginVersionFile = "node_modules/@okxweb3/hardhat-explorer-verify/dist/solc/version.js";
const source = readFileSync(pluginVersionFile, "utf8");
const compatible = source.replace(
  "https://solc-bin.ethereum.org/bin/list.json",
  "https://binaries.soliditylang.org/bin/list.json",
);
if (compatible !== source) writeFileSync(pluginVersionFile, compatible);

if (!process.env.http_proxy && process.env.HTTPS_PROXY) {
  process.env.http_proxy = process.env.HTTPS_PROXY;
}

const args = [
  "./node_modules/hardhat/internal/cli/bootstrap.js",
  "okverify",
  "--network",
  "xLayerTestnet",
  "0x15b18Fb8C1E29287B57EbBE30bd10ef165dc9eD5",
  "0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c",
  "0xB2bD8F1dcC734b428152f0eD7a962DD04309E5AE",
];
const result = spawnSync(process.execPath, args, { stdio: "inherit", env: process.env });
process.exitCode = result.status ?? 1;
