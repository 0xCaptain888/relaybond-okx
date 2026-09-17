# RelayBond v0.4.0-rc.3

> **The reliability clearing layer for the Agent economy.**

**[Live Judge Demo + API](https://relaybond-okx.vercel.app/)** · **[GitHub Pages mirror](https://0xcaptain888.github.io/relaybond-okx/)** · **[Source](https://github.com/0xCaptain888/relaybond-okx)** · **[V2 X Layer contract](https://www.okx.com/web3/explorer/xlayer-test/address/0xBa15362E3B52eAD97bB5bD5ce849D73376b8b73f)** · **OKX.AI Agent `#13776` — review submitted**

RelayBond routes paid tasks to bonded Agent providers, verifies delivery and recovers failed work through an independent backup without charging the buyer twice. The deployed V1 proves real Testnet payment, breach verification and buyer rebate. V2 now proves the complete live path on X Layer Testnet: paid Primary breach, authenticated independent Backup delivery, verifier-signed `RECOVERED`, and a real bond-funded Backup settlement with the buyer balance unchanged.

The RelayBond ASP identity and free `RelayBond Recovery Proof` A2MCP service were registered as OKX.AI Agent `#13776` and submitted for Marketplace review on September 17, 2026. The public `GET /v1/official/settlement` endpoint returns the completed settlement, before/after balances and seven verification checks.

For the fastest review, open the public Demo and click **Run 60-second Judge Proof**. One read-only browser flow validates the live OKX x402 boundary, paid Primary `BREACH`, independent Backup `ACCEPTED`, EIP-712 recovery evidence and all seven completed X Layer settlement checks. It never creates a new payment or presents a replay as a new transaction.

## Official Build Delta — September 17, 2026 onward

The public pre-build baseline is frozen at [`v0.3.0`](https://github.com/0xCaptain888/relaybond-okx/tree/v0.3.0). Work on the [`official-build-2026`](https://github.com/0xCaptain888/relaybond-okx/tree/official-build-2026) branch is recorded separately and never relabels the earlier feasibility work as official-period development.

The first post-start feature is an automatic Continuity Coordinator that:

- ranks eligible bonded providers and selects independent Primary and Backup providers;
- verifies both signed deliveries instead of trusting orchestration success;
- transitions through an auditable monotonic state machine;
- emits a Solidity-compatible EIP-712 Recovery Attestation when the backup succeeds;
- ends in `FROZEN`, never false success, when both providers breach;
- exposes its Evidence Pack through the browser, API and TypeScript SDK;
- loads independent provider metadata from a strict secret-free configuration and executes bound HTTPS deliveries without automatic payment.

The official-period runtime passes an opt-in end-to-end test using two separate loopback HTTP services and two signing identities. Its production counterpart is deployed: the bonded Primary exposes a dedicated x402 endpoint and signed Service Promise, while the independent bonded Backup exposes a private authenticated HTTPS delivery endpoint. A real paid `BREACH → RECOVERED → SETTLED` run now backs the strongest claim; it is not inferred from deployment.

Current status: coordinator **TESTNET / LIVE RECOVERY / BROWSER VERIFIABLE**; `RecoveryBondVaultV2` **TESTNET / DEPLOYED / SOURCE VERIFIED / SETTLED**; independent Providers **TESTNET / REGISTERED / BONDED / PUBLIC RUNTIME DEPLOYED**. Transaction `0x12a5…9b3a` paid the bonded Primary exactly 0.01 USD₮0 and produced an objective freshness `BREACH`; the authenticated Backup returned an independently signed `ACCEPTED` delivery and the verifier issued `RECOVERED`. Settlement transaction [`0x4915…ea99`](https://www.okx.com/web3/explorer/xlayer-test/tx/0x49150b2ec1eafece6e8c11a03ecb70b3562725f8153a18f237b5dafb9ec5ea99) then transferred exactly 0.01 USD₮0 from the Primary bond to the Backup. The buyer balance remained unchanged, all seven post-settlement checks passed, and the Primary auto-paused at a 4.99 USD₮0 bond.

```bash
npm run demo:official-coordinator
npm run test:integration:http
npm run readiness:v2
npm run verify:contract:v2:status
npm run runtime:v2:configure # writes runtime metadata + private Backup auth only to gitignored .env
npm run coordinator:v2:live # replays paid Primary evidence through the bonded HTTPS Backup
npm run settlement:v2:plan # safely reports the finalized LIVE settlement; a fresh request still defaults to read-only planning
```

The settlement command is intentionally safe: it emits a structured read-only plan and never treats missing or invalid evidence as permission to fall back to the LOCAL coordinator fixture. A fresh request can broadcast only after exact, action-specific confirmation. If a receipt is returned before an RPC exposes the new state, the command preserves pending evidence, polls finality and can resume verification without rebroadcasting. The checked-in completed run reports `ready: true`, `broadcast: true` and seven passing post-settlement invariants.

Once both Providers are bonded, `coordinator:v2:live` closes the gap between payment and settlement without manufacturing a LIVE label. It re-queries the exact Primary USD₮0 transfer, rejects `LOCAL`/`DESIGN` Provider profiles, confirms both service identities and bonds onchain, replays only the recorded paid Primary delivery, calls the independent HTTPS Backup, re-verifies both signatures and publishes `v2-live-coordinator.json` only after a real `BREACH → ACCEPTED → RECOVERED` result. It signs no payment and broadcasts no settlement.

Open the Judge Demo and select **Run 60-second Judge Proof** for the complete live path. The deeper controls remain available: **Run official coordinator** demonstrates both `RECOVERED` and fail-closed `FROZEN`, while **Verify Official Build** independently recovers both verifier signatures and checks the Recovery Attestation digest, terminal states, canonical Keccak evidence hash and portable SHA-256 integrity.

## The five-second problem

```text
Payment: SUCCESS
Response: {}
```

x402 proves payment happened. It does not prove a useful service was delivered—or that the task eventually finished. RelayBond adds proof-ranked routing, measurable promises, provider-authenticated delivery evidence and a bond-funded recovery path.

## Judge flow

```text
Rank bonded providers
→ buyer pays primary once
→ verify primary DeliveryReceipt
→ BREACH routes bond budget to an independent backup
→ verify backup DeliveryReceipt
→ verifier signs one Continuity Receipt
→ RECOVERED without a second buyer charge
```

The public build exposes a live OKX payment boundary, browser-verifiable EIP-712 promises and the complete Testnet V1 warranty lifecycle. `QualityBondVault` is deployed and source-verified on X Layer Testnet at `0x15b18Fb8C1E29287B57EbBE30bd10ef165dc9eD5`. One real **0.01 Testnet USD₮0** Agentic Wallet delivery was independently verified `ACCEPTED`; a second was verified `BREACH` for stale data; transaction `0x21c3…03f` then returned **0.01 Testnet USD₮0** from the provider bond to the buyer.

The same demo keeps a deterministic LOCAL V2 Judge Run for repeatability, but it is no longer the strongest claim. The public Evidence Pack binds one real X Layer payment, the Primary's signed stale result, the Backup's authenticated fresh result, verifier signatures, buyer-paid-once economics and the completed bond-to-Backup settlement transaction.

## Why this is different

- Buyer policy products decide whether an Agent may pay.
- Escrow products decide when settlement is released.
- Orchestrators retry providers but usually make the buyer pay again.
- RelayBond ranks providers by verifiable history, makes the seller economically responsible and converts a breached bond into a recovery budget.

It is the reliability clearing layer above OKX settlement: one portable receipt binds payment, failure, backup delivery and who funded recovery.

## Run locally

Requirements: Node.js 20.18+.

```bash
npm install
npm run check
npm run serve
```

Run only the V2 continuity path:

```bash
npm run demo:continuity
```

The generated [`evidence/continuity-judge-run.json`](./evidence/continuity-judge-run.json) contains both provider identities, both signed deliveries, the verifier-signed Continuity Receipt, recovery economics, a canonical Keccak evidence hash and portable SHA-256 integrity.

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

The production endpoint is live at `https://relaybond-okx.vercel.app/v1/provider/quote`. An unauthenticated request returns HTTP `402` plus the official `PAYMENT-REQUIRED` header from the OKX x402 SDK. The complete paid-delivery artifacts are published and can be rechecked with `npm run verify:live-paid`; add `:onchain` to independently re-query the exact X Layer Transfer. `npm run evidence:refresh-live` performs a read-only, block-pinned reconstruction of the completed rebate and refreshes the buyer balance without signing or broadcasting.

Public read-only integration endpoints:

```text
GET  /health
GET  /v1/service/promise
GET  /v1/service/v2-primary/promise
GET  /v1/providers
GET  /v1/recovery/demo
GET  /v1/official/coordinator
GET  /v1/official/readiness
POST /v1/verify
POST /v1/provider/quote
POST /v1/provider/v2-primary
```

`/v1/providers` now publishes the exact two TESTNET bonded Provider profiles used by the production runtime, and `/v1/service/v2-primary/promise` returns the Primary's EIP-712 signed SLA. `/v1/recovery/demo` and `/v1/official/coordinator` remain explicitly labeled `LOCAL`; the API exposes them for judge inspection without claiming an onchain V2 recovery. The Backup delivery route is intentionally absent from the public list because it requires a private coordinator authorization header. `/v1/official/readiness` reports endpoint binding and runtime readiness while keeping every secret private.

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
npm run buyer:okx -- pay --payment-id <id> --selected-index <n> --symbol BTC-USDT --scenario accepted --expect accepted --yes
```

The quote command never signs. The pay command requires the operator's explicit `--yes`, requires a decoded final-success settlement receipt, then independently checks the returned Service Promise and Delivery Receipt before writing portable evidence. A merchant response without final settlement is rejected and cannot become live evidence.

The repository also contains a guarded breach path. It is disabled in production unless `ALLOW_PAID_BREACH_DEMO=true`; when enabled for a testnet judging run, `--scenario stale` or `--scenario empty` produces a provider-signed objective breach. A rebate can be submitted only from final-success paid evidence and only after a separate explicit `--confirm`:

```bash
npm run buyer:okx -- quote --symbol BTC-USDT --scenario stale
npm run buyer:okx -- pay --payment-id <id> --selected-index <n> --symbol BTC-USDT --scenario stale --expect breach --yes
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
- Scenario-mismatch settlement: `0.01 Testnet USD₮0`, transaction [`0x4386…5304`](https://www.okx.com/web3/explorer/xlayer-test/tx/0x438616931bfcca24e7da37a0f3683dbb8db360081a8fb249982d238851595304). The v0.2.2 runner omitted `stale` during paid replay, so this is deliberately recorded as settlement-only evidence and **not** claimed as `BREACH`.
- Complete paid breach: `0.01 Testnet USD₮0`, transaction [`0x53b8…449a`](https://www.okx.com/web3/explorer/xlayer-test/tx/0x53b813b9a86849bd7480b07eafab9bd17c01bea2c2b386a0a121baf6b70e449a), block `41022040`, evidence hash `0x49288a96c20698ea0efd44f7134a87edcd774d31c98aa110506b31ea17b82cb5`, independently verified `BREACH` because `freshnessMet=false`.
- Onchain buyer rebate: `0.01 Testnet USD₮0`, transaction [`0x21c3…03f`](https://www.okx.com/web3/explorer/xlayer-test/tx/0x21c3e459c868efdb35da90b2976a73738347e90a38a591cff49e219101b7c03f), block `41022400`. The receipt contains the exact `BreachRebated`, vault-to-buyer `Transfer` and `ServiceStatusChanged(false)` events; all claim hashes, addresses and amounts match the paid breach evidence.
- Quality Bond after rebate: `4.99 Testnet USD₮0`; service state is `active=false` because the remaining bond is below the 5.00 minimum.
- Agentic Wallet balance after four explicit calls and the rebate: `0.02 Testnet USD₮0` at block `41022760`.
- Verified source: `QualityBondVault`, Solidity `0.8.28`, optimizer `200`, EVM `paris`
- RecoveryBondVaultV2 deployment: [`0x4353…d9d0`](https://www.okx.com/web3/explorer/xlayer-test/tx/0x43531981582981657566ff26a25427f5313381487062f398719d2f4a096ad9d0), block `41168978`, contract [`0xBa15…b73f`](https://www.okx.com/web3/explorer/xlayer-test/address/0xBa15362E3B52eAD97bB5bD5ce849D73376b8b73f), zero token value transferred.
- RecoveryBondVaultV2 source: **VERIFIED** as `RecoveryBondVaultV2`, Solidity `0.8.28`, optimizer `200`, EVM `paris`; constructor getters independently match Testnet USD₮0 and the expected verifier.
- V2 Primary Provider: registration [`0x3243…ed3a`](https://www.okx.com/web3/explorer/xlayer-test/tx/0x3243c2b9d7e54d0f6e8ed0c05edc3ea5b8dbcf98e57f4fa82f7847a472cced3a), approval [`0xefd6…c5bc`](https://www.okx.com/web3/explorer/xlayer-test/tx/0xefd63abd709d3f33103122339263ceafcb6aabb3a7b4aa9cb74a57b86091c5bc), 5 USD₮0 deposit [`0xcc50…56bf`](https://www.okx.com/web3/explorer/xlayer-test/tx/0xcc50997e2614fabf9cdcbbdde1aec228a773c33b2705ca1aa65fd03dc3f956bf); active and identity-bound.
- V2 Backup Provider: registration [`0x0069…eaa0`](https://www.okx.com/web3/explorer/xlayer-test/tx/0x00692058206167eb896b5940c582c3b8d59f05a8b017ba04bdc05144e92ceaa0), approval [`0xb7f6…732e`](https://www.okx.com/web3/explorer/xlayer-test/tx/0xb7f64c7e69b96d557376c4180198601aba857f1f06aeefe8962723e796e9732e), 3 USD₮0 deposit [`0x1547…a32b`](https://www.okx.com/web3/explorer/xlayer-test/tx/0x15470010df05569c9d6eb5abe604511177b595e2f6bd7afe7265f10afdc0a32b); active and independent from Primary.
- V2 bonding evidence: [`v2-bonding.json`](./evidence/official-build/v2-bonding.json) independently rechecks all six successful receipts, both identities, exact bonds and active states.
- V2 paid Primary breach: `0.01 Testnet USD₮0`, transaction [`0x12a5…9b3a`](https://www.okx.com/web3/explorer/xlayer-test/tx/0x12a5976b3a0d82870644d87bca481ce99130a481bf39557437bbfd5af2ed9b3a), block `41180307`; all signature, binding, deadline, schema and count checks pass, with only `freshnessMet=false`.
- V2 live coordinator: Primary `BREACH` → authenticated independent Backup `ACCEPTED` → `RECOVERED`; buyer paid exactly once; evidence hash `0x5e70…ba26`.
- V2 bond-funded settlement: [`0x4915…ea99`](https://www.okx.com/web3/explorer/xlayer-test/tx/0x49150b2ec1eafece6e8c11a03ecb70b3562725f8153a18f237b5dafb9ec5ea99), block `41181054`; exactly 0.01 USD₮0 moved from the Primary bond to the Backup, the buyer stayed at 0.01 USD₮0, the Primary bond changed 5.00 → 4.99 USD₮0 and auto-paused, and all seven receipt/state/balance/event checks passed.
- V2 final settlement evidence: [`v2-live-settlement.json`](./evidence/official-build/v2-live-settlement.json), `ready=true`, `broadcast=true`; retry-safe verification resumes from a captured receipt and never rebroadcasts an already recovered request.
- Machine-readable evidence: [`service-promise.json`](./evidence/live/service-promise.json), [`bond.json`](./evidence/live/bond.json), [`agentic-wallet-funding.json`](./evidence/live/agentic-wallet-funding.json), [`agentic-wallet-paid-delivery.json`](./evidence/live/agentic-wallet-paid-delivery.json), [`agentic-wallet-paid-breach.json`](./evidence/live/agentic-wallet-paid-breach.json), [`rebate.json`](./evidence/live/rebate.json), [`agentic-wallet-scenario-mismatch-settlement.json`](./evidence/live/agentic-wallet-scenario-mismatch-settlement.json), [`agentic-wallet-balance.json`](./evidence/live/agentic-wallet-balance.json) and [`contract-verification.json`](./evidence/live/contract-verification.json)

## Repository map

- [`contracts/QualityBondVault.sol`](./contracts/QualityBondVault.sol) — seller-funded warranty vault, delayed withdrawals and replay-safe rebates.
- [`contracts/RecoveryBondVaultV2.sol`](./contracts/RecoveryBondVaultV2.sol) — tested V2 settlement that pays an independent backup from the failed provider bond without changing the buyer balance.
- [`src/registry.ts`](./src/registry.ts) — filters and ranks bonded providers by SLA, coverage and verified history.
- [`src/continuity.ts`](./src/continuity.ts) — Continuity Receipt construction and double-pay-free economic invariants.
- [`src/continuity-simulator.ts`](./src/continuity-simulator.ts) — deterministic primary-breach → backup-delivery → recovery evidence.
- [`src/coordinator.ts`](./src/coordinator.ts) — official-period automatic provider routing, verification, recovery authorization and fail-closed orchestration.
- [`src/task-store.ts`](./src/task-store.ts) — validated monotonic continuity-task transitions with defensive reads.
- [`src/official-build-simulator.ts`](./src/official-build-simulator.ts) — reproducible `RECOVERED` and double-failure `FROZEN` Evidence Pack.
- [`src/provider-config.ts`](./src/provider-config.ts) — strict, secret-free independent-provider configuration validation.
- [`src/http-provider-executor.ts`](./src/http-provider-executor.ts) — endpoint-bound HTTPS delivery transport that stops at payment boundaries.
- [`src/provider-service.ts`](./src/provider-service.ts) — isolated signed-delivery service used by independently configured Provider processes.
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
- [`docs/provider-runtime.md`](./docs/provider-runtime.md) — provider endpoint contract, safety boundary and production configuration.
- [`docs/v2-deployment-runbook.md`](./docs/v2-deployment-runbook.md) — guarded deployment, verification, bonding and settlement sequence.
- [`docs/v2-live-settlement.md`](./docs/v2-live-settlement.md) — fail-closed live Evidence Pack validation, simulation, broadcast guard and post-settlement invariants.
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
| Quality Bond | TESTNET / AUTO-PAUSED | 4.99 Testnet USDT0 remains after rebate; service paused below its 5.00 minimum |
| Browser portable integrity verification | LIVE | Vercel Judge Demo |
| Browser EIP-712 signer recovery | LIVE | recovers the provider and Promise digest without server trust |
| Agentic Wallet funding | TESTNET | 0.05 USD₮0, tx `0x2e83…2eaf` |
| Reliability Passport | TESTNET | 2 verified paid calls, 50% acceptance, 0.01 rebated and 499-call bond coverage |
| Real OKX AI A2MCP listing | REVIEW SUBMITTED | ASP Agent `#13776`; free `GET /v1/official/settlement` service passed listing QA and is under OKX.AI review |
| Real x402 settlement | TESTNET | one complete accepted delivery and one complete breached delivery, each paid 0.01 USD₮0 |
| Real paid delivery verification | TESTNET / ACCEPTED | request, OKX result, provider signatures, exact Transfer and 9/9 SLA checks |
| Real paid breach verification | TESTNET / BREACH | stale paid quote, exact Transfer, provider signatures and `freshnessMet=false` |
| Real X Layer breach rebate | TESTNET / REBATED | exact 0.01 USD₮0 vault-to-buyer transfer and `BreachRebated` event, tx `0x21c3…03f` |
| Bonded Provider Registry | LOCAL / TESTED | deterministic eligibility and ranking tests |
| Verifier-signed Continuity Receipt | LOCAL / TESTED | browser-recovers verifier and checks canonical evidence |
| Double-pay-free backup recovery | TESTNET / LIVE RECOVERED | real paid Primary `BREACH`, authenticated Backup `ACCEPTED`, verifier-signed `RECOVERED`, buyer charged once |
| RecoveryBondVaultV2 contract | LOCAL / TESTED | backup authorization, replay protection and balance invariants |
| RecoveryBondVaultV2 deployment | TESTNET / DEPLOYED | tx `0x4353…d9d0`, block `41168978`, zero token value |
| RecoveryBondVaultV2 source | VERIFIED | OKX verification API reports source + ABI present |
| V2 Provider registration and bonding | TESTNET / BONDED | Initial Primary 5.00 + Backup 3.00 USD₮0 bonds; all 6 registration receipts independently verified |
| Official Continuity Coordinator | LOCAL / TESTED | automatic Primary/Backup selection, independent receipt verification and monotonic state transitions |
| Recovery Attestation | LOCAL / BROWSER VERIFIED | EIP-712 signer recovery, Solidity-compatible digest and canonical Evidence Pack integrity |
| Double-provider failure | LOCAL / FROZEN | coordinator fails closed rather than presenting a failed backup as recovery |
| Independent provider runtime | TESTNET / LIVE ENDPOINTS | bonded Primary x402 + signed Promise; private authenticated Backup HTTPS delivery; identity and endpoint bindings verified in production |
| Two-process Provider recovery | LOCAL / TESTED | real HTTP Primary `BREACH` → independent Backup `ACCEPTED` → `RECOVERED`; buyer payment remains singular |
| Guarded V2 live settlement executor | TESTNET / EXECUTED | rejects LOCAL evidence; validates signatures/bindings/onchain state; simulates before exact confirmation; preserves receipt and resumes verification without rebroadcasting |
| V2 live settlement | TESTNET / SETTLED / VERIFIED | tx `0x4915…ea99`; 0.01 USD₮0 Primary bond → Backup; buyer unchanged; all 7 post-settlement checks pass |
| V2 deployment readiness | TESTNET / BONDED | runtime bytecode, constructor getters, source, six registration receipts and both active bonds independently checked |

See the detailed [prior-work and pre-build disclosure](./docs/prior-work-disclosure.md), the separate [official build-period record](./docs/official-build-period.md) and the [threat model](./docs/threat-model.md). The pre-build disclosure explains why feasibility work began early and lists every September 15 commit with exact UTC+8 timestamps; the official-period record contains only post-start functionality and evidence.
Production dependencies currently pass [`npm run security:audit`](./SECURITY.md) with zero known vulnerabilities; legacy Hardhat advisories are isolated to the local development toolchain.

## Competition track

OKX Dev Day 2026 · **Build a Company + Remote Build**.

MIT © 2026 0xCaptain888
