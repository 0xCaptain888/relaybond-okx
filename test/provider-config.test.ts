import assert from "node:assert/strict";
import test from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import { parseProviderConfiguration, providerConfigurationStatus } from "../src/provider-config.js";

const primary = privateKeyToAccount(`0x${"71".repeat(32)}`);
const backup = privateKeyToAccount(`0x${"72".repeat(32)}`);

function profile(providerId: string, provider: string, endpoint: string) {
  return {
    providerId,
    name: providerId,
    serviceId: `${providerId}-service`,
    endpoint,
    provider,
    mode: "LOCAL",
    active: true,
    priceAtomic: "10000",
    bondAtomic: "1000000",
    minimumBondAtomic: "500000",
    maximumLatencyMs: 2_000,
    maximumDataAgeSeconds: 30,
    supportedSchemas: ["market-quote-v1"],
    reliability: { verifiedCalls: 10, acceptedCalls: 9, recoveredCalls: 1 },
  };
}

test("loads two independent providers from a secret-free audited configuration", () => {
  const providers = parseProviderConfiguration({
    version: "1",
    providers: [
      profile("primary", primary.address, "http://127.0.0.1:4101/deliver"),
      profile("backup", backup.address, "http://localhost:4102/deliver"),
    ],
  });
  assert.equal(providers.length, 2);
  assert.equal(providers[0]?.provider, primary.address);
  assert.equal(providerConfigurationStatus(JSON.stringify({ providers })).configured, true);
});

test("rejects duplicate provider identities and accidental secret fields", () => {
  assert.throws(() => parseProviderConfiguration({
    providers: [
      profile("primary", primary.address, "http://127.0.0.1:4101/deliver"),
      profile("backup", primary.address, "http://127.0.0.1:4102/deliver"),
    ],
  }), /independent signing identities/);

  assert.throws(() => parseProviderConfiguration({
    providers: [
      { ...profile("primary", primary.address, "http://127.0.0.1:4101/deliver"), apiKey: "must-not-be-here" },
      profile("backup", backup.address, "http://127.0.0.1:4102/deliver"),
    ],
  }), /unsupported fields: apiKey/);
});

test("requires HTTPS outside loopback LOCAL development", () => {
  assert.throws(() => parseProviderConfiguration({
    providers: [
      { ...profile("primary", primary.address, "http://provider.example/deliver"), mode: "TESTNET" },
      { ...profile("backup", backup.address, "https://backup.example/deliver"), mode: "TESTNET" },
    ],
  }), /must use HTTPS/);
});
