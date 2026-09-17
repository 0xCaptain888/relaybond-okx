# Submission copy

Prepared for the OKX Dev Day 2026 Remote Build submission. Last updated: September 17, 2026.

## Project name

RelayBond

## Tagline

The reliability clearing layer for paid AI Agents.

## One sentence

RelayBond is the reliability clearing layer for paid AI Agents: it routes tasks to bonded providers and funds an independent backup from a failed provider's bond so the buyer pays only once.

## 280-character description

RelayBond makes paid AI Agent services finish even when the provider fails. Providers bond USD₮0 and sign every delivery. A verified breach routes the same task to an independent Backup, funded from the failed provider's bond—without charging the buyer twice.

## Short pitch

x402 proves that an Agent paid; it does not prove the purchased service worked or eventually finished. RelayBond adds a reliability layer above settlement: providers sign machine-readable SLAs, fund Quality Bonds and sign every Delivery Receipt. Providers are ranked by verifiable performance. If the Primary breaches, an independent Backup completes the task and is paid from the failed provider's bond—not from a second buyer charge. One Continuity Receipt binds the entire recovery.

## Full project description

Agent payments solve only half of the transaction. A successful x402 settlement proves that the buyer paid, but it does not prove the Agent returned a useful, fresh or even non-empty result. Existing retry systems commonly ask the buyer to pay again, while refunds still leave the original task unfinished.

RelayBond turns provider reliability into verifiable, enforceable capital. Each provider publishes an EIP-712 Service Promise, locks a Quality Bond and signs every Delivery Receipt. RelayBond ranks eligible providers, verifies the Primary result against the signed SLA and fails closed when evidence is incomplete. If the Primary breaches, an independent bonded Backup receives the exact same task. The Backup is paid from the failed Primary's bond, so the buyer pays only once.

The live X Layer Testnet proof is complete. An OKX Agentic Wallet paid the Primary 0.01 USD₮0. The signed result objectively breached freshness. RelayBond authenticated and verified a separate Backup, issued a verifier-signed `RECOVERED` Continuity Receipt, and settled 0.01 USD₮0 from the Primary bond to the Backup. The buyer balance did not change during recovery and all seven post-settlement checks passed.

RelayBond is also registered as OKX.AI ASP Agent `#13776` with a free `RelayBond Recovery Proof` A2MCP service. The service returns the completed settlement, balance changes and independent verification checks through a public endpoint. Marketplace approval was submitted on September 17, 2026 and remains under external review.

## Why OKX

OKX.AI supplies Agent discovery, A2MCP and x402 supply the paid call, Agentic Wallet supplies programmable buyer authorization, and X Layer turns service reliability into enforceable USD₮0 capital. RelayBond makes those pieces compose into an Agent market where a failed task can still finish.

## Meaningful OKX integrations

- **OKX x402:** the public Provider endpoint returns the official `exact` payment challenge.
- **OKX Agentic Wallet:** executed the real buyer payment on X Layer Testnet.
- **X Layer:** holds Provider bonds and settles Backup compensation without another buyer charge.
- **OKX.AI / A2MCP:** RelayBond ASP Agent `#13776` exposes the free Recovery Proof service.
- **OKX explorer evidence:** deployment, bonding, payment, rebate and V2 settlement transactions are public and independently inspectable.

## Current live proof

The X Layer Testnet V1 vault is deployed and source-verified, the provider locked 5 Testnet USD₮0, and the public API returns the official payment challenge. One real paid call was verified `ACCEPTED`; a second was verified `BREACH`; transaction `0x21c3…03f` transferred exactly 0.01 USD₮0 from the provider bond back to the buyer.

The official-period `RecoveryBondVaultV2` deployment is source-verified on X Layer Testnet. Independent Primary and Backup services were registered with 5 and 3 Testnet USD₮0 bonds. A new real 0.01 USD₮0 V2 Primary payment was independently verified `BREACH`, the authenticated Backup was independently verified `ACCEPTED`, and the verifier issued `RECOVERED` without a second buyer charge. Settlement transaction `0x4915…ea99` then paid exactly 0.01 USD₮0 from the Primary bond to the Backup: the buyer stayed at 0.01 USD₮0, the Backup wallet increased from 7.00 to 7.01 USD₮0, the Primary bond decreased from 5.00 to 4.99 USD₮0 and auto-paused, and all seven post-settlement checks passed.

## What was built during the official period

After the September 17, 2026 official start, RelayBond added the automatic Continuity Coordinator, independent Primary/Backup HTTPS runtimes, `RecoveryBondVaultV2`, Provider registration and bonding, guarded live settlement, public API and SDK access, OKX.AI/A2MCP registration, and the one-click browser Judge Proof. The complete earlier feasibility baseline remains frozen at tag `v0.3.0` and is not represented as official-period work.

## Judge instructions

1. Open `https://relaybond-okx.vercel.app/`.
2. Click **Run 60-second Judge Proof**.
3. Watch the browser verify `HTTP 402 → paid BREACH → Backup ACCEPTED → 7/7 SETTLED → JUDGE PASS`.
4. Inspect the final transaction and buyer-balance invariant in the evidence console.
5. Optionally call `GET https://relaybond-okx.vercel.app/v1/official/settlement` or use OKX.AI Agent `#13776`.

The Judge Run is intentionally read-only. It replays and independently verifies a completed live recovery; it does not manufacture a new payment or pretend to broadcast a transaction.

## Submission links

- Demo: `https://relaybond-okx.vercel.app/`
- Source: `https://github.com/0xCaptain888/relaybond-okx`
- GitHub Pages mirror: `https://0xcaptain888.github.io/relaybond-okx/`
- V2 contract: `https://www.okx.com/web3/explorer/xlayer-test/address/0xBa15362E3B52eAD97bB5bD5ce849D73376b8b73f`
- Final settlement: `https://www.okx.com/web3/explorer/xlayer-test/tx/0x49150b2ec1eafece6e8c11a03ecb70b3562725f8153a18f237b5dafb9ec5ea99`
- Public Recovery Proof: `https://relaybond-okx.vercel.app/v1/official/settlement`
- OKX.AI Agent: `13776` — review submitted

## Demo opening

```text
Payment: SUCCESS
Response: {}
```

“The payment worked. The provider failed. RelayBond uses its bond to make sure the task still finishes.”

## Closing line

Payments make Agent commerce possible. RelayBond makes it dependable.

## Development-period disclosure

RelayBond began as a feasibility prototype on September 15, 2026, before the listed September 17 Remote Build start. That pre-build phase validated the compatibility of OKX x402, Agentic Wallet, signed delivery evidence and X Layer Quality Bonds. The complete baseline is preserved publicly at tag `v0.3.0` (`aa4bc8d`) and is not claimed as official-period work. The event-period submission identifies only post-start commits and evidence as judged development, focusing on live multi-provider routing, OKX.AI/A2MCP integration and deployed bond-funded Backup recovery.
