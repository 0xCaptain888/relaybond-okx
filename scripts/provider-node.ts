import { createServer } from "node:http";
import { privateKeyToAccount } from "viem/accounts";
import { createProviderService } from "../src/provider-service.js";
import { parseProviderConfiguration } from "../src/provider-config.js";

const required = ["CONTINUITY_PROVIDERS_JSON", "PROVIDER_ID", "PROVIDER_SIGNING_KEY", "RECOVERY_BOND_VAULT_V2_ADDRESS"] as const;
for (const name of required) if (!process.env[name]) throw new Error(`${name} is required.`);
const providers = parseProviderConfiguration(process.env.CONTINUITY_PROVIDERS_JSON!);
const profile = providers.find((candidate) => candidate.providerId === process.env.PROVIDER_ID);
if (!profile) throw new Error(`Unknown PROVIDER_ID ${process.env.PROVIDER_ID}.`);
const account = privateKeyToAccount(process.env.PROVIDER_SIGNING_KEY as `0x${string}`);
const scenario = process.env.PROVIDER_SCENARIO ?? "accepted";
if (scenario !== "accepted" && scenario !== "stale" && scenario !== "empty") {
  throw new Error("PROVIDER_SCENARIO must be accepted, stale or empty.");
}
const port = Number(process.env.PROVIDER_PORT || 4101);
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) throw new Error("PROVIDER_PORT is invalid.");
const app = createProviderService({
  profile,
  account,
  chainId: Number(process.env.XLAYER_CHAIN_ID || 1952),
  vault: process.env.RECOVERY_BOND_VAULT_V2_ADDRESS as `0x${string}`,
  scenario,
});
createServer(app).listen(port, "127.0.0.1", () => {
  console.log(JSON.stringify({
    status: "READY",
    mode: profile.mode,
    providerId: profile.providerId,
    serviceId: profile.serviceId,
    signer: account.address,
    endpoint: `http://127.0.0.1:${port}/deliver`,
    scenario,
    note: "The signing key is intentionally never printed.",
  }, null, 2));
});
