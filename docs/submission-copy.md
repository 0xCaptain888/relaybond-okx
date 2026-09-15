# Submission copy

## One sentence

RelayBond is the reliability clearing layer for paid AI Agents: it routes tasks to bonded providers and funds an independent backup from a failed provider's bond so the buyer pays only once.

## Short pitch

x402 proves that an Agent paid; it does not prove the purchased service worked or eventually finished. RelayBond adds a reliability layer above settlement: providers sign machine-readable SLAs, fund Quality Bonds and sign every Delivery Receipt. Providers are ranked by verifiable performance. If the primary breaches, an independent backup completes the task and is paid from the failed provider's bond—not from a second buyer charge. One Continuity Receipt binds the entire recovery.

## Why OKX

OKX AI supplies Agent discovery, A2MCP and x402 supply the paid call, Agentic Wallet supplies programmable buyer authorization, and X Layer turns service reliability into enforceable USD₮0 capital. RelayBond makes those pieces compose into an Agent market where a failed task can still finish.

## Current live proof

The X Layer Testnet V1 vault is deployed and source-verified, the provider locked 5 Testnet USD₮0, and the public API returns the official payment challenge. One real paid call was verified `ACCEPTED`; a second was verified `BREACH`; transaction `0x21c3…03f` transferred exactly 0.01 USD₮0 from the provider bond back to the buyer. The LOCAL / TESTED V2 demonstrates the stronger terminal state: `BREACH → BACKUP_DELIVERED → RECOVERED`, with a verifier-signed Continuity Receipt and no second buyer charge. V2 is not yet deployed.

## Demo opening

```text
Payment: SUCCESS
Response: {}
```

“The payment worked. The provider failed. RelayBond uses its bond to make sure the task still finishes.”
