# RecoveryBondVaultV2 deployment runbook

Status: **TESTNET / DEPLOYED / SOURCE VERIFIED / RECOVERY SETTLED**. `RecoveryBondVaultV2` was deployed after the official build start on September 17, 2026 at `0xBa15362E3B52eAD97bB5bD5ce849D73376b8b73f`. Transaction `0x43531981582981657566ff26a25427f5313381487062f398719d2f4a096ad9d0` transferred zero token value. The independent Primary and Backup were registered with active 5 and 3 Testnet USD₮0 bonds. After the real recovery, settlement transaction `0x49150b2ec1eafece6e8c11a03ecb70b3562725f8153a18f237b5dafb9ec5ea99` moved exactly 0.01 USD₮0 from the Primary bond to the Backup; the Primary auto-paused at 4.99 USD₮0 and the buyer balance did not change.

## Safety sequence

```text
read-only readiness
→ deterministic deployment plan
→ human review and fresh confirmation
→ contract deployment
→ source verification
→ independent Provider funding
→ registration and bonding plan
→ second human review and fresh confirmation
→ register and bond both Providers
→ paid Primary breach
→ paid Backup delivery
→ verifier-authorized bond settlement
→ public RECOVERED evidence
```

The deployment and bonding confirmations are intentionally different. Approving a contract deployment cannot authorize token approval, token deposits or recovery settlement.

## Read-only checks

```bash
npm run readiness:v2
npm run deploy:v2:plan
```

The checked-in artifacts are:

- [`v2-readiness.json`](../evidence/official-build/v2-readiness.json)
- [`v2-deployment-plan.json`](../evidence/official-build/v2-deployment-plan.json)
- [`v2-deployment.json`](../evidence/official-build/v2-deployment.json)
- [`v2-contract-verification.json`](../evidence/official-build/v2-contract-verification.json)

The plan binds chain ID `1952`, Testnet USD₮0, verifier, deployer, constructor arguments, bytecode hash, estimated Gas, nonce and predicted address. It cannot broadcast without the exact `V2_DEPLOY_CONFIRMATION` value printed by the script after review.

## Provider identities

Primary and Backup use separate signing keys. `npm run wallets:backup-provider` creates or preserves the Backup key only in gitignored `.env` with mode `600`; it prints only the public address.

The deployed address can be copied into the local gitignored configuration without exposing any key:

```bash
npm run deployment:v2:configure
```

Fund both Provider addresses on X Layer Testnet, then run:

```bash
npm run readiness:v2
npm run bond:v2:plan
```

The bonding script defaults to read-only inspection and refuses duplicate Provider identities, wrong chain, wrong token, absent contract bytecode, insufficient balances and mismatched existing registrations.

The six registration, approval and deposit receipts are independently rechecked with:

```bash
npm run verify:bonding:v2
```

Evidence: [`v2-bonding.json`](../evidence/official-build/v2-bonding.json). Both Provider identities, exact bond balances, active states and every receipt status must pass before the artifact is accepted.

## Completed recovery settlement

The finalized artifact is [`v2-live-settlement.json`](../evidence/official-build/v2-live-settlement.json). It records the reviewed pre-state, successful receipt, block `41181054`, exact balance deltas, replay marker, Primary activity state and bound `BreachRecovered` event. The executor preserves a successful receipt before post-state checks and can resume verification after RPC lag without sending a second transaction.

## Source verification

The source was submitted and independently confirmed through the OKX verification API with source and ABI present:

```bash
npm run verify:contract:v2:xlayer-testnet
npm run verify:contract:v2:status
```

The second command independently queries the OKX verification API and requires the explorer to report `RecoveryBondVaultV2` with source and ABI present.
