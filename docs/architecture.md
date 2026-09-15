# RelayBond architecture

```text
Buyer Agent
  │ 1. discovers signed ServicePromise through OKX AI / A2MCP
  │ 2. receives x402 HTTP 402 challenge
  │ 3. authorizes exact USD₮0 payment through Agentic Wallet
  ▼
OKX facilitator verifies payer + terms and replays the request
  ▼
Provider Agent ── binds verified payer and signs DeliveryReceipt ──► Independent SLA Verifier
  │                                              │
  │ valid delivery                               │ objective breach attestation
  ▼                                              ▼
ACCEPTED                               QualityBondVault on X Layer
                                                │
                                                └── USDT0 rebate to buyer
```

## Trust boundaries

- Payment settlement proves that value moved; it does not prove that useful output arrived.
- The route derives the buyer from the facilitator-verified EIP-3009 authorization; a caller-supplied buyer header has no authority.
- Token, amount, recipient and network are checked again before the provider signs the Delivery Receipt.
- The provider signs the delivery receipt, preventing a buyer from substituting a bad response after delivery.
- A merchant response is not recorded as LIVE unless the decoded facilitator receipt reports final-success settlement.
- The deterministic verifier evaluates only objective, pre-declared checks.
- The onchain vault caps each rebate and prevents request-hash replay.
- A 24-hour withdrawal delay keeps a provider from removing its bond immediately after a disputed call.

## One memorable mechanism

Every listed service carries a visible Quality Bond. A seller can advertise a stronger promise only by putting more capital behind it.
