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

The public build exposes a live OKX payment boundary, a browser-verifiable EIP-712 Service Promise and deterministic `ACCEPTED` / `BREACH` evidence. `QualityBondVault` is deployed and source-verified on X Layer Testnet at `0x15b18Fb8C1E29287B57EbBE30bd10ef165dc9eD5`. The provider has registered the endpoint-bound Promise and deposited a real **5 Testnet USD₮0** Quality Bond. A second explicit **0.01 Testnet USD₮0** Agentic Wallet payment completed the full delivery path and was independently verified as `ACCEPTED`; the paid breach and onchain rebate remain explicitly pending.

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

The production endpoint is live at `https://relaybond-okx.vercel.app/v1/provider/quote`. An unauthenticated request returns HTTP `402` plus the official `PAYMENT-REQUIRED` header from the OKX x402 SDK. The complete paid-delivery artifact is published and can be rechecked with `npm run verify:live-paid`; add `:onchain` to independently re-query the exact X Layer Transfer.

Public read-only integration endpoints:

```text
GET  /health
GET  /v1/service/promise
POST /v1/verify
POST /v1/provider/quote
```

The provider route never trusts a caller-supplied buyer address. After the facilitator accepts the payment authorization, RelayBond derives the payer from that verified authorization, checks its token, amount and recipient against the advertised terms, and binds the payer plus normalized request input into the signed Delivery Receipt. The buyer runner independently confirms the exact USD₮0 `Transfer` event on X Layer even when the facilitator's first receipt is still pending.

Safely inspect the exact payment terms without signing or moving funds:

```bash
npm run buyer:live -- --symbol BTC-USDT
```

The runner validates the network, token, payee and atomic amount ceiling. A payment is impossible unless the operator explicitly adds `--pay` and supplies a dedicated `BUYER_PRIVATE_KEY`; it never falls back to the deployer, provider or verifier key. This local-key signer is retained only as a transparent testnet fallback.

The preferred two-phase Agentic Wallet path delegates custody, signing, request replay and settlement to the official OnchainOS TEE wallet:

```bash
npm run buyer:okx -- quote --symbol BTC-USDT
# review network, token, amount, balance and payee
npm run buyer:okx -- pay --payment-id <id> --selected-index <n> --expect accepted --yes
```

The quote command never signs. The pay command requires the operator's explicit `--yes`, requires a decoded final-success settlement receipt, then independently checks the returned Service Promise and Delivery Receipt before writing portable evidence. A merchant response without final settlement is rejected and cannot become live evidence.

The repository also contains a guarded breach path. It is disabled in production unless `ALLOW_PAID_BREACH_DEMO=true`; when enabled for a testnet judging run, `--scenario stale` or `--scenario empty` produces a provider-signed objective breach. A rebate can be submitted only from final-success paid evidence and only after a separate explicit `--confirm`:

```bash
npm run buyer:okx -- quote --symbol BTC-USDT --scenario stale
npm run buyer:okx -- pay --payment-id <id> --selected-index <n> --expect breach --yes
npm run rebate:live-breach -- --confirm
```

## Live X Layer evidence

- Service Promise: `0xca605c666adb1e0d9239634c6131509bbc66ec06e2333af49f1c5afccdeaa73c`
- Endpoint bound by the Promise: `https://relaybond-okx.vercel.app/v1/provider/quote`
- Registered service: [`0x07fd…1c14`](https://www.okx.com/web3/explorer/xlayer-test/tx/0x07fd2a4f7782d2ba9ea951d4e18656ac4b965f54bf7e1c3503ca926ade6f1c14)
- USDT0 approval: [`0x324f…2395`](https://www.okx.com/web3/explorer/xlayer-test/tx/0x324f21c98650608e46b317dfcfa7175fe5227c7a618fdb8c56bb733dc64e2395)
- 5 Testnet USDT0 bond deposit: [`0xa423…6694`](https://www.okx.com/web3/explorer/xlayer-test/tx/0xa4231e43f171c43da45a9b3412af1a2992ea23d4fd7c1e4fe13da68136d36694)
- Agentic Wallet funding: `0.05 Testnet USD₮0`, transaction `0x2e83c5fd8e19bc5f813c662ca9dd2dea30abafacba968341b7080300b6352eaf`
- First Agentic Wallet settlement: `0.01 Testnet USD₮0`, transaction `0x2a9b32e353a93179f6f811b687051382ce9de782c9fd4f3bc3058b0c9d2bd125`. Settlement is independently confirmed; the merchant delivery body was not persisted by the previous runner, so this is deliberately **not** labeled `ACCEPTED`.
- Complete Agentic Wallet paid delivery: `0.01 Testnet USD₮0`, transaction [`0xfd1e…e4bf`](https://www.okx.com/web3/explorer/xlayer-test/tx/0xfd1e25e2415a79eff8e8d981d9e5f97efe8f9136ce026b1cf1e5ac872c8ee4bf), block `41018044`, evidence hash `0x39a67bcde940b07e429aee35fbef6fe260dcc2e0aecae6e3013f124cfa57dde8`, independently verified `ACCEPTED` with all 9 SLA checks passing.
- Agentic Wallet balance after both calls: `0.03 Testnet USD₮0` at block `41018376`.
- Verified source: `QualityBondVault`, Solidity `0.8.28`, optimizer `200`, EVM `paris`
- Machine-readable evidence: [`service-promise.json`](./evidence/live/service-promise.json), [`bond.json`](./evidence/live/bond.json), [`agentic-wallet-funding.json`](./evidence/live/agentic-wallet-funding.json), [`agentic-wallet-paid-delivery.json`](./evidence/live/agentic-wallet-paid-delivery.json), [`agentic-wallet-balance.json`](./evidence/live/agentic-wallet-balance.json) and [`contract-verification.json`](./evidence/live/contract-verification.json)

## Repository map

- [`contracts/QualityBondVault.sol`](./contracts/QualityBondVault.sol) — seller-funded warranty vault, delayed withdrawals and replay-safe rebates.
- [`src/signing.ts`](./src/signing.ts) — EIP-712 ServicePromise and DeliveryReceipt signatures.
- [`src/verifier.ts`](./src/verifier.ts) — independent objective SLA verifier.
- [`src/payment.ts`](./src/payment.ts) — x402 `exact` payment challenge.
- [`src/okx-server.ts`](./src/okx-server.ts) — official OKX Payment SDK resource server.
- [`src/okx-app.ts`](./src/okx-app.ts) — deployment-neutral Express app used locally and by Vercel.
- [`src/paid-request.ts`](./src/paid-request.ts) — verified payer extraction, payment-term binding and normalized service input.
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
| Signed delivery receipt | TESTNET | Agentic Wallet paid delivery + provider EIP-712 receipt |
| Independent deterministic verifier | LOCAL | `npm run test:unit` |
| QualityBondVault tests | LOCAL | Hardhat contract tests |
| QualityBondVault deployment | TESTNET | block `41008617`, tx `0x763f…f484` |
| QualityBondVault source | VERIFIED | OKX Onchain OS reports source + ABI present |
| Public Judge Demo + API | LIVE | Vercel production deployment |
| Official OKX x402 challenge | LIVE | unauthenticated quote returns HTTP `402` + `PAYMENT-REQUIRED` |
| Quality Bond | TESTNET | active service backed by 5 Testnet USDT0, deposit tx `0xa423…6694` |
| Browser portable integrity verification | LIVE | Vercel Judge Demo |
| Browser EIP-712 signer recovery | LIVE | recovers the provider and Promise digest without server trust |
| Agentic Wallet funding | TESTNET | 0.05 USD₮0, tx `0x2e83…2eaf` |
| Reliability Passport | TESTNET | 1 verified paid call, 100% live acceptance, 500-call bond coverage |
| Real OKX AI A2MCP listing | PENDING | must be completed before submission |
| Real x402 settlement | TESTNET | two 0.01 USD₮0 Agentic Wallet settlements; latest tx `0xfd1e…e4bf` |
| Real paid delivery verification | TESTNET / ACCEPTED | request, OKX result, provider signatures, exact Transfer and 9/9 SLA checks |
| Real X Layer breach rebate | PENDING | requires a paid bad delivery + verifier attestation |

See the [prior-work disclosure](./docs/prior-work-disclosure.md) and [threat model](./docs/threat-model.md).
Production dependencies currently pass [`npm run security:audit`](./SECURITY.md) with zero known vulnerabilities; legacy Hardhat advisories are isolated to the local development toolchain.

## Competition track

OKX Dev Day 2026 · **Build a Company + Remote Build**.

MIT © 2026 0xCaptain888
