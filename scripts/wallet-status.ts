import { createPublicClient, formatEther, formatUnits, http, parseAbi } from "viem";
import { defineChain } from "viem";

const deployer = process.env.XLAYER_DEPLOYER_ADDRESS as `0x${string}` | undefined;
const provider = process.env.PROVIDER_ADDRESS as `0x${string}` | undefined;
const verifier = process.env.VERIFIER_ADDRESS as `0x${string}` | undefined;
if (!deployer || !provider || !verifier) throw new Error("Run npm run wallets:bootstrap first");

const xLayerTestnet = defineChain({
  id: 1952,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: [process.env.XLAYER_TESTNET_RPC_URL || "https://testrpc.xlayer.tech/terigon"] } },
});
const client = createPublicClient({ chain: xLayerTestnet, transport: http() });
const token = (process.env.USDT0_ADDRESS || "0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c") as `0x${string}`;
const erc20 = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const [deployerOkb, providerOkb, verifierOkb, providerUsdt0] = await Promise.all([
  client.getBalance({ address: deployer }),
  client.getBalance({ address: provider }),
  client.getBalance({ address: verifier }),
  client.readContract({ address: token, abi: erc20, functionName: "balanceOf", args: [provider] }),
]);

console.log(JSON.stringify({
  network: xLayerTestnet.name,
  chainId: xLayerTestnet.id,
  roles: {
    deployer: { address: deployer, okb: formatEther(deployerOkb), ready: deployerOkb > 0n },
    provider: {
      address: provider,
      okb: formatEther(providerOkb),
      usdt0: formatUnits(providerUsdt0, 6),
      ready: providerOkb > 0n && providerUsdt0 >= 5_000_000n,
    },
    verifier: { address: verifier, okb: formatEther(verifierOkb), ready: true, note: "offchain signer; gas not required" },
  },
  readyForDeployment: deployerOkb > 0n && providerOkb > 0n && providerUsdt0 >= 5_000_000n,
}, null, 2));
