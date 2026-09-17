# V2 live recovery settlement

Status: **IMPLEMENTED / GUARDED / NOT YET BROADCAST**.

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

The generated transaction sends zero native value. Broadcast is impossible without the separate exact confirmation `SETTLE_V2_RECOVERY_XLAYER_TESTNET` and a valid relayer key. After confirmation it still performs `eth_call` simulation before broadcast, then checks the receipt, `BreachRecovered` event, primary bond debit, exact Backup token credit, replay marker and unchanged buyer token balance.

```bash
V2_LIVE_EVIDENCE_PATH=evidence/official-build/v2-live-coordinator.json npm run settlement:v2:plan
```

The current repository does not contain that live Evidence Pack. The deterministic coordinator artifact is deliberately rejected and cannot be used to trigger the Testnet contract.
