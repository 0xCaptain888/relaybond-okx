# Submission copy

## One sentence

RelayBond is the reliability clearing layer for paid AI Agents: it routes tasks to bonded providers and funds an independent backup from a failed provider's bond so the buyer pays only once.

## Short pitch

x402 proves that an Agent paid; it does not prove the purchased service worked or eventually finished. RelayBond adds a reliability layer above settlement: providers sign machine-readable SLAs, fund Quality Bonds and sign every Delivery Receipt. Providers are ranked by verifiable performance. If the primary breaches, an independent backup completes the task and is paid from the failed provider's bond—not from a second buyer charge. One Continuity Receipt binds the entire recovery.

## Why OKX

OKX AI supplies Agent discovery, A2MCP and x402 supply the paid call, Agentic Wallet supplies programmable buyer authorization, and X Layer turns service reliability into enforceable USD₮0 capital. RelayBond makes those pieces compose into an Agent market where a failed task can still finish.

## Current live proof

The X Layer Testnet V1 vault is deployed and source-verified, the provider locked 5 Testnet USD₮0, and the public API returns the official payment challenge. One real paid call was verified `ACCEPTED`; a second was verified `BREACH`; transaction `0x21c3…03f` transferred exactly 0.01 USD₮0 from the provider bond back to the buyer. The official-period `RecoveryBondVaultV2` deployment is source-verified on X Layer Testnet. Independent Primary and Backup services were registered with 5 and 3 Testnet USD₮0 bonds. A new real 0.01 USD₮0 V2 Primary payment was independently verified `BREACH`, the authenticated Backup was independently verified `ACCEPTED`, and the verifier issued `RECOVERED` without a second buyer charge. Settlement transaction `0x4915…ea99` then paid exactly 0.01 USD₮0 from the Primary bond to the Backup: the buyer stayed at 0.01 USD₮0, the Backup wallet increased from 7.00 to 7.01 USD₮0, the Primary bond decreased from 5.00 to 4.99 USD₮0 and auto-paused, and all seven post-settlement checks passed.

## Demo opening

```text
Payment: SUCCESS
Response: {}
```

“The payment worked. The provider failed. RelayBond uses its bond to make sure the task still finishes.”

## Development-period disclosure

RelayBond began as a feasibility prototype on September 15, 2026, before the listed September 17 Remote Build start. That pre-build phase validated the compatibility of OKX x402, Agentic Wallet, signed delivery evidence and X Layer Quality Bonds. The complete baseline is preserved publicly at tag `v0.3.0` (`aa4bc8d`) and is not claimed as official-period work. The event-period submission will identify only post-start commits and evidence as judged development, focusing on live multi-provider routing, OKX AI/A2MCP integration and deployed bond-funded backup recovery.
