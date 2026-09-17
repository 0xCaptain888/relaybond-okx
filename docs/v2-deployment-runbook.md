# RecoveryBondVaultV2 deployment runbook

Status: **PENDING BROADCAST**. The read-only deployment plan was generated on September 17, 2026 after the official build start. No transaction was sent.

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

The plan binds chain ID `1952`, Testnet USD₮0, verifier, deployer, constructor arguments, bytecode hash, estimated Gas, nonce and predicted address. It cannot broadcast without the exact `V2_DEPLOY_CONFIRMATION` value printed by the script after review.

## Provider identities

Primary and Backup use separate signing keys. `npm run wallets:backup-provider` creates or preserves the Backup key only in gitignored `.env` with mode `600`; it prints only the public address.

After deployment, set `RECOVERY_BOND_VAULT_V2_ADDRESS` to the verified address, fund both Provider addresses on X Layer Testnet, then run:

```bash
npm run readiness:v2
npm run bond:v2:plan
```

The bonding script defaults to read-only inspection and refuses duplicate Provider identities, wrong chain, wrong token, absent contract bytecode, insufficient balances and mismatched existing registrations.

## Source verification

After deployment:

```bash
npm run verify:contract:v2:xlayer-testnet
npm run verify:contract:v2:status
```

The second command independently queries the OKX verification API and requires the explorer to report `RecoveryBondVaultV2` with source and ABI present.
