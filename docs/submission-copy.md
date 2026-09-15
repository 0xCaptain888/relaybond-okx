# Submission copy

## One sentence

RelayBond makes paid AI Agent providers put USDT0 behind signed service promises, automatically rebating buyers when independently verified delivery breaches occur.

## Short pitch

x402 proves that an Agent paid; it does not prove the purchased service worked. RelayBond adds a service-warranty layer above settlement: providers sign machine-readable SLAs, fund a Quality Bond on X Layer and sign every Delivery Receipt. An independent deterministic verifier checks latency, freshness, schema and record count. A valid breach triggers an onchain rebate from the seller bond to the buyer.

## Why OKX

OKX AI supplies the Agent-to-Agent discovery surface, A2MCP and x402 supply the paid call, OKX Market API supplies the real delivery, Agentic Wallet supplies the buyer and X Layer turns the SLA into an enforceable USDT0 warranty.

## Current live proof

The X Layer Testnet vault is deployed and source-verified, the provider locked 5 Testnet USD₮0, and the public API returns the official payment challenge. One real 0.01 Testnet USD₮0 Agentic Wallet purchase returned an OKX market quote and passed all 9 SLA checks as `ACCEPTED`. A second paid call returned provider-signed stale data and was independently verified `BREACH`. Transaction `0x21c3…03f` then emitted the matching `BreachRebated` event and transferred exactly 0.01 USD₮0 from the vault to the buyer. The remaining bond is 4.99 USD₮0 and the service auto-paused below its minimum.

## Demo opening

```text
Payment: SUCCESS
Response: {}
```

“The payment worked. The service didn’t. RelayBond makes that failure economically accountable.”
