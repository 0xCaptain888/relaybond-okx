const { readFileSync, writeFileSync } = require("node:fs");
const { spawnSync } = require("node:child_process");

const deployment = JSON.parse(readFileSync("evidence/official-build/v2-deployment.json", "utf8"));
if (!deployment.address || !deployment.settlementToken || !deployment.verifier) {
  throw new Error("Complete evidence/official-build/v2-deployment.json is required.");
}
const pluginVersionFile = "node_modules/@okxweb3/hardhat-explorer-verify/dist/solc/version.js";
const source = readFileSync(pluginVersionFile, "utf8");
const compatible = source.replace("https://solc-bin.ethereum.org/bin/list.json", "https://binaries.soliditylang.org/bin/list.json");
if (compatible !== source) writeFileSync(pluginVersionFile, compatible);
if (!process.env.http_proxy && process.env.HTTPS_PROXY) process.env.http_proxy = process.env.HTTPS_PROXY;
const args = [
  "./node_modules/hardhat/internal/cli/bootstrap.js",
  "okverify",
  "--network",
  "xLayerTestnet",
  deployment.address,
  deployment.settlementToken,
  deployment.verifier,
];
const result = spawnSync(process.execPath, args, { stdio: "inherit", env: process.env });
process.exitCode = result.status ?? 1;
