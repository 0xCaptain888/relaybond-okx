const { readFileSync, writeFileSync } = require("node:fs");
const { createServer } = require("node:http");
const { spawn } = require("node:child_process");
const { ProxyAgent, request } = require("undici");

const deployment = JSON.parse(readFileSync("evidence/official-build/v2-deployment.json", "utf8"));
if (!deployment.address || !deployment.settlementToken || !deployment.verifier) {
  throw new Error("Complete evidence/official-build/v2-deployment.json is required.");
}
const pluginVersionFile = "node_modules/@okxweb3/hardhat-explorer-verify/dist/solc/version.js";
const source = readFileSync(pluginVersionFile, "utf8");
const compatible = source.replace("https://solc-bin.ethereum.org/bin/list.json", "https://binaries.soliditylang.org/bin/list.json");
if (compatible !== source) writeFileSync(pluginVersionFile, compatible);
if (!process.env.http_proxy && process.env.HTTPS_PROXY) process.env.http_proxy = process.env.HTTPS_PROXY;

async function startRpcBridge() {
  const upstream = process.env.XLAYER_TESTNET_RPC_URL;
  const proxy = process.env.HTTPS_PROXY;
  if (!upstream || !proxy || upstream.startsWith("http://127.0.0.1") || upstream.startsWith("http://localhost")) {
    return undefined;
  }
  const dispatcher = new ProxyAgent(proxy);
  const server = createServer(async (incoming, outgoing) => {
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of incoming) {
        size += chunk.length;
        if (size > 1_000_000) throw new Error("RPC request body exceeds 1 MB.");
        chunks.push(chunk);
      }
      const response = await request(upstream, {
        method: incoming.method,
        headers: { "content-type": incoming.headers["content-type"] || "application/json" },
        body: Buffer.concat(chunks),
        dispatcher,
      });
      outgoing.writeHead(response.statusCode, { "content-type": response.headers["content-type"] || "application/json" });
      outgoing.end(Buffer.from(await response.body.arrayBuffer()));
    } catch (error) {
      outgoing.writeHead(502, { "content-type": "application/json" });
      outgoing.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Upstream RPC unavailable through local proxy bridge." }, id: null }));
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start the local RPC proxy bridge.");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

function runCommand(commandArgs, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, commandArgs, { stdio: "inherit", env });
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

const args = [
  "./node_modules/hardhat/internal/cli/bootstrap.js",
  "okverify",
  "--network",
  "xLayerTestnet",
  deployment.address,
  deployment.settlementToken,
  deployment.verifier,
];

async function main() {
  const bridge = await startRpcBridge();
  const env = { ...process.env };
  if (bridge) env.XLAYER_TESTNET_RPC_URL = bridge.url;
  let status = 1;
  try {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      status = await runCommand(args, env);
      if (status === 0) break;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
    if (status !== 0) {
      console.log("Hardhat verification transport did not complete; checking the independent OKX verification API.");
      status = await runCommand([
        "--env-file-if-exists=.env",
        "--import",
        "tsx",
        "scripts/check-v2-contract-verification.ts",
      ], process.env);
    }
  } finally {
    if (bridge) await new Promise((resolve) => bridge.server.close(resolve));
  }
  process.exitCode = status;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
