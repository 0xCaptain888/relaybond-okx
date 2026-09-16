# Official build-period record

This file separates RelayBond's official OKX Dev Day development from its publicly disclosed pre-build baseline.

## Boundary

- Official build start listed by the event: **September 17, 2026**.
- Conservative working start: **September 17, 2026 at 00:00 UTC / 08:00 UTC+8**.
- Pre-build baseline: tag `v0.3.0`, commit `aa4bc8d508d690bc2599be88e6c49011fb589e69`.
- Detailed pre-build history: [`prior-work-disclosure.md`](./prior-work-disclosure.md).

## Recording rules

Every item claimed as official-period work must include:

1. a post-start Git commit;
2. the implementation or configuration changed;
3. test or build evidence;
4. a public transaction, deployment, service URL or reproducible local artifact where applicable;
5. an explicit `LOCAL`, `TESTNET`, `LIVE`, `MAINNET`, `DESIGN` or `PENDING` label.

Routine redeployment of pre-build code will not be presented as a new feature.

## Official-period change log

No official-period work has been recorded yet.

| Date and time | Commit | New functionality | Evidence | Status |
|---|---|---|---|---|
| — | — | Official build period has not started. | — | PENDING |

## Target official-period delta

- [ ] Deploy `RecoveryBondVaultV2` after the official start.
- [ ] Register and bond independent primary and backup providers.
- [ ] Publish or integrate live OKX AI/A2MCP provider services.
- [ ] Execute a paid primary delivery and independently verify `BREACH`.
- [ ] Automatically dispatch the same task to the backup provider.
- [ ] Settle backup compensation from the primary bond.
- [ ] Prove the buyer paid only once.
- [ ] Publish a real `RECOVERED` Continuity Receipt.
- [ ] Add the live official-period flow to the judge demo and SDK.

## Evidence directory

Official-period machine-readable evidence will be stored under:

```text
evidence/official-build/
```

The directory will be created only when the first valid post-start artifact exists.
