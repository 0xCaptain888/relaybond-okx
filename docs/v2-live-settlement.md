# V2 live recovery settlement

Status: **XLAYER TESTNET / SETTLED / VERIFIED**.

`settlement:v2:plan` is the final safety boundary between a verified live Provider recovery and `RecoveryBondVaultV2.settleRecovery`. It refuses deterministic LOCAL evidence and requires a future Evidence Pack explicitly labeled `XLAYER_TESTNET_LIVE_COORDINATOR`.

If that Evidence Pack does not exist yet, the command returns a machine-readable fail-closed plan with `sourceEvidenceAvailable: false`, `ready: false` and `broadcast: false`. This is an expected readiness state, not a runtime crash. Read-only planning also exits normally when checks fail; only an operator who supplies the exact broadcast confirmation can enter the transaction path.

Before producing a transaction plan it independently checks:

- the chain, vault and verifier;
- both EIP-712 verifier signatures;
- `RECOVERED`, primary `BREACH` and backup `ACCEPTED` states;
- task, request, buyer, service ID and Provider identity binding;
- hashes of both signed Delivery Receipts;
- recovery amount and buyer-paid-once economics;
- attestation expiry;
- onchain Provider registration, active bonds and maximum recovery;
- replay state, settlement token and verifier getters.

The generated transaction sends zero native value. Broadcast is impossible without the separate exact confirmation `SETTLE_V2_RECOVERY_XLAYER_TESTNET` and a valid relayer key. After confirmation it still performs `eth_call` simulation before broadcast, then checks the receipt, bound `BreachRecovered` event, primary bond debit, exact Backup token credit, replay marker, activity state and unchanged buyer token balance. RPC finality is polled, and a captured successful receipt can be resumed from pending evidence without rebroadcasting.

## Generate the LIVE coordinator evidence

After both Provider services are registered and bonded, capture a real paid Primary breach through the guarded OKX Agentic Wallet buyer path. Configure `CONTINUITY_PROVIDERS_JSON` with two active `TESTNET` or `LIVE` HTTPS Providers, point `V2_PRIMARY_PAID_EVIDENCE_PATH` at that paid breach artifact, then run:

```bash
npm run coordinator:v2:live
```

The command re-queries the exact USD₮0 payment transaction, confirms both Provider registrations and bonds on `RecoveryBondVaultV2`, rejects LOCAL profiles, independently calls the Backup and publishes the required `XLAYER_TESTNET_LIVE_COORDINATOR` Evidence Pack only if the verified trail ends in `RECOVERED`. It never signs a payment or invokes `settleRecovery`.

```bash
V2_LIVE_EVIDENCE_PATH=evidence/official-build/v2-live-coordinator.json npm run settlement:v2:plan
```

The repository contains the real [`v2-primary-paid-breach.json`](../evidence/official-build/v2-primary-paid-breach.json), [`v2-live-coordinator.json`](../evidence/official-build/v2-live-coordinator.json) and [`v2-live-settlement.json`](../evidence/official-build/v2-live-settlement.json) Evidence Packs. Settlement transaction [`0x4915…ea99`](https://www.okx.com/web3/explorer/xlayer-test/tx/0x49150b2ec1eafece6e8c11a03ecb70b3562725f8153a18f237b5dafb9ec5ea99) paid exactly 0.01 USD₮0 from the Primary bond to the Backup at block `41181054`. The buyer balance remained unchanged, the Primary bond changed 5.00 → 4.99 USD₮0 and auto-paused, and all seven post-settlement checks passed. The deterministic coordinator artifact remains deliberately rejected and cannot trigger the Testnet contract.
