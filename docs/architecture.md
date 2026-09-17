# RelayBond architecture v0.3.0

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
ACCEPTED                               QualityBondVault V1 on X Layer
                                                │
                                                └── USDT0 rebate to buyer
```

The deployed V1 proves the warranty boundary. The source-verified V2 settlement contract is deployed on X Layer Testnet; the coordinator and Provider flow below remain LOCAL / TESTED until funded Providers execute a real settlement:

```text
Bonded Provider Registry
  │ rank by SLA + bond coverage + verified history
  ▼
Primary Provider ── BREACH ──► Independent Verifier
                                  │ signs RecoveryAttestation
                                  ▼
                          RecoveryBondVaultV2
                                  │ primary bond funds backup
                                  ▼
Backup Provider ── ACCEPTED ──► Continuity Receipt ──► RECOVERED

Buyer debit count: 1
```

## Trust boundaries

- Payment settlement proves that value moved; it does not prove that useful output arrived.
- The route derives the buyer from the facilitator-verified EIP-3009 authorization; a caller-supplied buyer header has no authority.
- Token, amount, recipient and network are checked again before the provider signs the Delivery Receipt.
- The provider signs the delivery receipt, preventing a buyer from substituting a bad response after delivery.
- A merchant response is not recorded as LIVE unless the decoded facilitator receipt reports final-success settlement.
- The deterministic verifier evaluates only objective, pre-declared checks.
- The onchain vault caps each rebate and prevents request-hash replay.
- V2 requires different primary and backup identities and prevents recovery-attestation replay.
- The V2 contract pays the backup from primary bond principal; it does not debit or approve the buyer.
- A Continuity Receipt binds the original request, primary breach evidence, backup delivery evidence, recovery amount and final state.
- A 24-hour withdrawal delay keeps a provider from removing its bond immediately after a disputed call.

## One memorable mechanism

Every listed service carries a visible Quality Bond. A failed seller does not merely refund a fee: its capital becomes the budget that finishes the buyer's task.

## Deployment honesty

- `QualityBondVault`: TESTNET / SOURCE VERIFIED.
- x402 paid calls and V1 rebate: TESTNET.
- registry, Continuity Receipt and coordinator execution: LOCAL / TESTED.
- `RecoveryBondVaultV2`: TESTNET / DEPLOYED / SOURCE VERIFIED.
- Provider registration, bonding and live backup settlement: PENDING.
