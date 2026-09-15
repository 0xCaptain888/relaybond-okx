# RelayBond

> **Economic accountability for paid Agent services.**

**[Launch Public Judge Demo](https://0xcaptain888.github.io/relaybond-okx/)** · **[Source](https://github.com/0xCaptain888/relaybond-okx)** · **[X Layer deployment](https://www.okx.com/web3/explorer/xlayer-test/tx/0x763f8b602f024d97281546f43bd7b3190a581a1d854d4dc5744d402547a9f484)** · **Video:** pending

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

The foundation demonstrates signed promises, signed delivery receipts, deterministic verification, `ACCEPTED`, two objective `BREACH` cases and portable evidence. `QualityBondVault` is deployed on X Layer Testnet at `0x15b18Fb8C1E29287B57EbBE30bd10ef165dc9eD5`. It does **not** claim a live OKX payment, funded bond or X Layer rebate yet.

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

Run the API separately:

```bash
npm run api
curl http://localhost:8787/health
curl -i -X POST http://localhost:8787/v1/provider/quote \
  -H 'content-type: application/json' \
  -d '{"symbol":"BTC-USDT"}'
```

The provider route returns a standards-shaped HTTP `402` challenge. If a payment header is supplied in this foundation build, it returns `501 LIVE_PAYMENT_VERIFIER_NOT_CONFIGURED` rather than pretending the payment was verified.

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
| Signed SLA and delivery receipt | LOCAL | unit tests + generated JSON |
| Independent deterministic verifier | LOCAL | `npm run test:unit` |
| QualityBondVault tests | LOCAL | Hardhat contract tests |
| QualityBondVault deployment | TESTNET | block `41008617`, tx `0x763f…f484` |
| Browser integrity verification | LOCAL | Judge Demo |
| Reliability Passport | LOCAL | derived from signed evidence, not user reviews |
| Real OKX AI A2MCP listing | PENDING | must be completed before submission |
| Real x402 payment | PENDING | must be completed before submission |
| Real X Layer bond and rebate | PENDING | must be completed before submission |

See the [prior-work disclosure](./docs/prior-work-disclosure.md) and [threat model](./docs/threat-model.md).
Production dependencies currently pass [`npm run security:audit`](./SECURITY.md) with zero known vulnerabilities; legacy Hardhat advisories are isolated to the local development toolchain.

## Competition track

OKX Dev Day 2026 · **Build a Company + Remote Build**.

MIT © 2026 0xCaptain888
