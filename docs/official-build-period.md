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

| Date and time | Commit | New functionality | Evidence | Status |
|---|---|---|---|---|
| 2026-09-17 10:09:47 UTC+8 | `c8beae9` | Automatic Continuity Coordinator; deterministic Primary/Backup selection; fail-closed `FROZEN`; Solidity-compatible EIP-712 Recovery Attestation; validated monotonic task store; public API and SDK access | `evidence/official-build/coordinator-v1.json`; 34 unit tests; 8 contract tests | LOCAL / TESTED |
| 2026-09-17 10:20:45 UTC+8 | `82bf8c1` | Judge-facing coordinator run plus independent browser verification of both verifier signatures, terminal states, evidence Keccak and portable SHA-256 | Local browser run: `RECOVERED + FROZEN VERIFIED` followed by `BROWSER VERIFIED`; no console errors | LOCAL / VERIFIED |
| 2026-09-17 10:35:53 UTC+8 | `6821ea4` | Strict secret-free Provider configuration; endpoint-bound HTTP executor; no redirects; response/time limits; explicit 402 stop; coordinator request and Provider Profile binding | 42 unit tests; 8 contract tests; Vercel build; repeated browser verification | LOCAL / TESTED |

## Target official-period delta

- [ ] Deploy `RecoveryBondVaultV2` after the official start.
- [ ] Register and bond independent primary and backup providers.
- [ ] Publish or integrate live OKX AI/A2MCP provider services.
- [ ] Execute a paid primary delivery and independently verify `BREACH`.
- [ ] Automatically dispatch the same task to the backup provider.
- [ ] Settle backup compensation from the primary bond.
- [ ] Prove the buyer paid only once.
- [ ] Publish a real `RECOVERED` Continuity Receipt.
- [x] Add the official-period LOCAL coordinator flow to the judge demo, API and SDK.
- [x] Implement the configuration and fail-closed HTTP runtime required to replace LOCAL provider fixtures.
- [ ] Configure and operate two independent Testnet service endpoints.
- [ ] Add the live official-period settlement flow to the judge demo and SDK.

## Evidence directory

Official-period machine-readable evidence is stored under:

```text
evidence/official-build/
```

The first artifact, [`coordinator-v1.json`](../evidence/official-build/coordinator-v1.json), deliberately records `onchainSettlement: false`. It proves the post-start coordinator, signatures and fail-closed state machine without claiming the pending V2 Testnet broadcast.
