# RelayBond

> **Economic accountability for paid Agent services.**

**[Live Judge Demo + API](https://relaybond-okx.vercel.app/)** · **[GitHub Pages mirror](https://0xcaptain888.github.io/relaybond-okx/)** · **[Source](https://github.com/0xCaptain888/relaybond-okx)** · **[X Layer contract](https://www.okx.com/web3/explorer/xlayer-test/address/0x15b18Fb8C1E29287B57EbBE30bd10ef165dc9eD5)** · **Video:** pending

RelayBond is the service-warranty layer for paid AI agents. Providers publish a signed, machine-readable SLA and deposit a USDT0 Quality Bond on X Layer. If a provider-signed response violates objective delivery terms, an independent verifier can trigger an automatic buyer rebate.

## The five-second problem

```text
Payment: SUCCESS
Response: {}
```

x402 proves payment happened. It does not prove a useful service was delivered. RelayBond adds measurable promises, provider-authenticated delivery evidence and a financial consequence for breach.

## Judge flow

```text
Signed ServicePromise
→ USDT0 Quality Bond
→ x402 exact paid A2MCP call
→ signed DeliveryReceipt
→ deterministic SLA verification
→ ACCEPTED or BREACH
→ X Layer buyer rebate
```

The live build demonstrates signed promises, signed delivery receipts, deterministic verification, `ACCEPTED`, two objective `BREACH` cases and portable evidence. `QualityBondVault` is deployed on X Layer Testnet at `0x15b18Fb8C1E29287B57EbBE30bd10ef165dc9eD5`. The provider has registered the public Service Promise and deposited a real **5 Testnet USDT0** Quality Bond. A paid OKX Agentic Wallet call and real breach rebate remain explicitly pending.

## Why this is different

- Buyer-side policy products decide whether an Agent may pay.
- Escrow products decide when settlement is released.
- Orchestration products choose or retry providers.
- RelayBond makes the **seller economically responsible after an immediate paid service call**.

It is the evidence, SLA and quality-guarantee layer above settlement—not a replacement for OKX payment infrastructure.

## Run locally

Requirements: Node.js 20.18+.

```bash
npm install
npm run check
npm run serve
```

Create isolated Testnet identities without exposing private keys:

```bash
npm run wallets:bootstrap
npm run wallets:status
```

The command stores secrets only in gitignored `.env` with mode `600` and writes public addresses separately to `evidence/setup/wallet-addresses.json`.

Save OKX seller credentials without putting them in shell history or chat:

```bash
npm run secrets:okx
npm run secrets:status
```

Open the printed localhost URL. Values stay in the local `.env` file and are never echoed back.

Open `http://localhost:4173`. The judge flow writes [evidence/judge-run.json](./evidence/judge-run.json) and the browser independently verifies its portable SHA-256 integrity.

Run the local API separately:

```bash
npm run api
curl http://localhost:8787/health
curl -i -X POST http://localhost:8787/v1/provider/quote \
  -H 'content-type: application/json' \
  -d '{"symbol":"BTC-USDT"}'
```

The production endpoint is live at `https://relaybond-okx.vercel.app/v1/provider/quote`. An unauthenticated request returns HTTP `402` plus the official `PAYMENT-REQUIRED` header from the OKX x402 SDK. No paid call is claimed until an OKX Agentic Wallet payment is completed and captured.

Safely inspect the exact payment terms without signing or moving funds:

```bash
npm run buyer:live -- --symbol BTC-USDT
```

The runner validates the network, token, payee and atomic amount ceiling. A payment is impossible unless the operator explicitly adds `--pay` and supplies a dedicated `BUYER_PRIVATE_KEY`; it never falls back to the deployer, provider or verifier key. The local-key signer is a testnet fallback while the preferred OKX Agentic Wallet adapter is completed.

## Live X Layer evidence

- Service Promise: `0xca605c666adb1e0d9239634c6131509bbc66ec06e2333af49f1c5afccdeaa73c`
- Endpoint bound by the Promise: `https://relaybond-okx.vercel.app/v1/provider/quote`
- Registered service: [`0x07fd…1c14`](https://www.okx.com/web3/explorer/xlayer-test/tx/0x07fd2a4f7782d2ba9ea951d4e18656ac4b965f54bf7e1c3503ca926ade6f1c14)
- USDT0 approval: [`0x324f…2395`](https://www.okx.com/web3/explorer/xlayer-test/tx/0x324f21c98650608e46b317dfcfa7175fe5227c7a618fdb8c56bb733dc64e2395)
- 5 Testnet USDT0 bond deposit: [`0xa423…6694`](https://www.okx.com/web3/explorer/xlayer-test/tx/0xa4231e43f171c43da45a9b3412af1a2992ea23d4fd7c1e4fe13da68136d36694)
- Verified source: `QualityBondVault`, Solidity `0.8.28`, optimizer `200`, EVM `paris`
- Machine-readable evidence: [`service-promise.json`](./evidence/live/service-promise.json), [`bond.json`](./evidence/live/bond.json) and [`contract-verification.json`](./evidence/live/contract-verification.json)

## Repository map

- [`contracts/QualityBondVault.sol`](./contracts/QualityBondVault.sol) — seller-funded warranty vault, delayed withdrawals and replay-safe rebates.
- [`src/signing.ts`](./src/signing.ts) — EIP-712 ServicePromise and DeliveryReceipt signatures.
- [`src/verifier.ts`](./src/verifier.ts) — independent objective SLA verifier.
- [`src/payment.ts`](./src/payment.ts) — x402 `exact` payment challenge.
- [`src/okx-server.ts`](./src/okx-server.ts) — official OKX Payment SDK resource server.
- [`src/okx-app.ts`](./src/okx-app.ts) — deployment-neutral Express app used locally and by Vercel.
- [`src/sdk.ts`](./src/sdk.ts) — integration client for other Agent projects.
- [`src/passport.ts`](./src/passport.ts) — evidence-derived provider Reliability Passport.
- [`openapi.yaml`](./openapi.yaml) — machine-readable integration surface.
- [`docs/okx-a2mcp-listing.md`](./docs/okx-a2mcp-listing.md) — copy-ready OKX AI listing package.
- [`web/`](./web) — judge-facing interactive proof narrative.
- [`docs/architecture.md`](./docs/architecture.md) — system and trust boundaries.
- [`docs/live-checklist.md`](./docs/live-checklist.md) — honest path from local foundation to live submission.

## Service Promise

```json
{
  "serviceId": "market-data-v1",
  "responseTimeMs": 2000,
  "maxDataAgeSeconds": 30,
  "requiredSchema": "market-quote-v1",
  "minimumRecords": 1,
  "priceAtomic": "10000",
  "bondAmountAtomic": "5000000",
  "rebateAtomic": "10000",
  "refundOnBreach": true
}
```

## Current evidence status

| Capability | Status | Evidence |
|---|---|---|
| Signed Service Promise | TESTNET | public endpoint-bound EIP-712 Promise + onchain Promise hash |
| Signed delivery receipt | LOCAL | unit tests + generated JSON; paid live receipt pending |
| Independent deterministic verifier | LOCAL | `npm run test:unit` |
| QualityBondVault tests | LOCAL | Hardhat contract tests |
| QualityBondVault deployment | TESTNET | block `41008617`, tx `0x763f…f484` |
| QualityBondVault source | VERIFIED | OKX Onchain OS reports source + ABI present |
| Public Judge Demo + API | LIVE | Vercel production deployment |
| Official OKX x402 challenge | LIVE | unauthenticated quote returns HTTP `402` + `PAYMENT-REQUIRED` |
| Quality Bond | TESTNET | active service backed by 5 Testnet USDT0, deposit tx `0xa423…6694` |
| Browser integrity verification | LIVE | Vercel Judge Demo |
| Reliability Passport | LOCAL | derived from signed evidence, not user reviews |
| Real OKX AI A2MCP listing | PENDING | must be completed before submission |
| Real x402 payment | PENDING | must be completed before submission |
| Real X Layer breach rebate | PENDING | requires a paid bad delivery + verifier attestation |

See the [prior-work disclosure](./docs/prior-work-disclosure.md) and [threat model](./docs/threat-model.md).
Production dependencies currently pass [`npm run security:audit`](./SECURITY.md) with zero known vulnerabilities; legacy Hardhat advisories are isolated to the local development toolchain.

## Competition track

OKX Dev Day 2026 · **Build a Company + Remote Build**.

MIT © 2026 0xCaptain888
