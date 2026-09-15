# RelayBond

> **Economic accountability for paid Agent services.**

**Public Judge Demo:** deployment pending · **Video:** pending · **X Layer evidence:** pending

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

The local foundation already demonstrates signed promises, signed delivery receipts, deterministic verification, `ACCEPTED`, two objective `BREACH` cases, portable evidence and simulated bond accounting. It does **not** claim a live OKX payment or X Layer rebate yet.

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
- [`src/sdk.ts`](./src/sdk.ts) — integration client for other Agent projects.
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
| QualityBondVault | LOCAL | Hardhat contract tests |
| Browser integrity verification | LOCAL | Judge Demo |
| Real OKX AI A2MCP listing | PENDING | must be completed before submission |
| Real x402 payment | PENDING | must be completed before submission |
| Real X Layer bond and rebate | PENDING | must be completed before submission |

See the [prior-work disclosure](./docs/prior-work-disclosure.md) and [threat model](./docs/threat-model.md).

## Competition track

OKX Dev Day 2026 · **Build a Company + Remote Build**.

MIT © 2026 0xCaptain888
