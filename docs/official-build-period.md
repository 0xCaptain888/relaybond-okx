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
| 2026-09-17 14:27:00 UTC+8 | `64a9310` | Two independent HTTP Provider processes; signed Primary breach and Backup delivery; guarded V2 readiness/deployment/bonding/source-verification workflow; independent Backup identity | opt-in HTTP integration test; `v2-readiness.json`; `v2-deployment-plan.json` | LOCAL / TESTED + TESTNET / READ-ONLY |
| 2026-09-17 14:31:32 UTC+8 | `cfdd686` | Unified Vercel and GitHub Pages artifact; CI runs the real two-process HTTP recovery test and production dependency audit | `public/` contains pre-build, live and official-period evidence | CI / VERIFIED |
| 2026-09-17 14:50:15 UTC+8 | `df954e9` | Deployed `RecoveryBondVaultV2` with zero token value; confirmed runtime bytecode and constructor getters; independently verified source and ABI | tx `0x4353…d9d0`; block `41168978`; `v2-deployment.json`; `v2-contract-verification.json` | TESTNET / DEPLOYED / VERIFIED |
| 2026-09-17 15:56:07 UTC+8 | `2b4f7ad` | Guarded live V2 settlement executor; strict LIVE Evidence Pack binding; LOCAL-evidence rejection; onchain replay/bond checks; simulation and post-settlement buyer-balance invariants; exact six-transaction Provider registration plan | 47 unit tests; 8 contract tests; HTTP integration; `v2-bond-plan.json`; `v2-settlement-plan.json` | LOCAL / TESTED + TESTNET / READ-ONLY |
| 2026-09-17 16:05 UTC+8 | `13ae6f0` | Fail-closed missing-evidence readiness: `settlement:v2:plan` now returns structured `ready: false` output instead of a filesystem exception and never broadcasts | 48 unit tests; CLI rehearsal with LIVE Evidence Pack absent | LOCAL / TESTED |
| 2026-09-17 16:29 UTC+8 | `3ac31f0` | LIVE coordinator bridge between a real paid Primary breach and guarded V2 settlement; rejects LOCAL profiles, rechecks payment and Provider bonds onchain, calls the HTTPS Backup and emits evidence only after verified recovery | 50 unit tests; 8 contract tests; two-process HTTP integration; production build | LOCAL / TESTED + TESTNET / READ-ONLY |
| 2026-09-17 16:41 UTC+8 | `77b90ae` | Registered two independent V2 Provider services, approved exact USD₮0 amounts and activated 5 + 3 USD₮0 bonds; added receipt-by-receipt independent verification and RPC-consistency retry | six successful receipts; `v2-bonding.json`; both services active and identity-bound | TESTNET / BONDED / VERIFIED |
| 2026-09-17 17:13:56 UTC+8 | `9b19096` | Deployed a dedicated paid V2 Primary endpoint plus a separately signed authenticated Backup endpoint; added exact runtime identity/endpoint binding, constant-time Backup authorization, guarded evidence output and secure Vercel environment provisioning | 53 passing unit tests + 1 intentional skip; 8 contract tests; HTTP integration; Production Primary Promise signed by bonded address; unauthenticated Backup `401`; authorized Backup signed by bonded address | TESTNET / PUBLIC RUNTIME DEPLOYED |
| 2026-09-17 18:04:03 UTC+8 | `b3f2044` | Executed a real 0.01 USD₮0 V2 Primary payment, independently verified its signed stale delivery as `BREACH`, dispatched to the authenticated bonded Backup, verified `ACCEPTED`, emitted verifier-signed `RECOVERED`, and produced a fail-closed settlement-ready plan; fixed live dispatch time so elapsed operator delay cannot be misreported as Backup latency | payment tx `0x12a5…9b3a`; `v2-primary-paid-breach.json`; `v2-live-coordinator.json`; evidence hash `0x5e70…ba26`; all evidence/onchain settlement-plan checks true; `broadcast=false`; 54 passing unit tests + 1 intentional skip; 8 contract tests; HTTP integration | TESTNET / LIVE RECOVERED / SETTLEMENT READY |
| 2026-09-17 18:15:37 UTC+8 | `d295f3f` | Broadcast the separately confirmed V2 recovery settlement; hardened the executor against receipt/state RPC races with retry-safe pending-evidence recovery; published settlement through the Demo, API and TypeScript SDK | tx `0x4915…ea99`; block `41181054`; 0.01 USD₮0 Primary bond → Backup; buyer balance unchanged; Primary 5.00 → 4.99 USD₮0 and inactive; 7/7 post-settlement checks; 55 passing unit tests + 1 intentional skip; 8 contract tests; two-process HTTP integration; production audit 0 | TESTNET / SETTLED / VERIFIED |
| 2026-09-17 18:30:59 UTC+8 | `10e7c70` | Reconciled the public Provider Registry with the post-settlement chain state and fail-closed the paid V2 Primary route after its automatic pause | public registry reports 2 registered / 1 active; Primary bond 4.99 USD₮0 and `active=false`; completed V2 route returns `410 V2_PRIMARY_AUTO_PAUSED`; 56 passing unit tests + 1 intentional skip; 8 contract tests; HTTP integration; production build | LIVE / FAIL-CLOSED |
| 2026-09-17 19:51:17 UTC+8 | `ec922e7` | Registered RelayBond as OKX.AI ASP Agent `#13776`; published the free `RelayBond Recovery Proof` A2MCP configuration; added the Failover Switch identity across the Demo, favicon and social preview; synchronized runtime and package version `v0.4.0-rc.2` | A2MCP endpoint HTTP 200 with `SETTLED_AND_VERIFIED`; Listing QA passed with zero findings; Marketplace review submitted; 56 passing unit tests + 1 intentional skip; 8 contract tests; two-process HTTP integration; production audit 0; Vercel build | OKX.AI / REVIEW SUBMITTED |
| 2026-09-17 20:20:50 UTC+8 | `493b876` | Added the one-click 60-second Judge Proof; cross-origin GitHub Pages API fallback; live x402, paid breach, Backup signature, portable integrity and final settlement verification; complete submission copy and timed video script | Judge flow requires `HTTP 402 → BREACH → ACCEPTED → 7/7 SETTLED → PASS`; 56 passing unit tests + 1 intentional skip; 8 contract tests; two-process HTTP integration; production audit 0; Vercel build | LIVE PROOF / READ-ONLY / FAIL-CLOSED |
| 2026-09-17 20:28:39 UTC+8 | `736f789` | Unified browser and Node canonical ordering after the live browser correctly failed closed on a portable SHA-256 mismatch; added direct regression coverage for all four public Evidence Packs | real browser reproduced the mismatch; 60 passing unit tests + 1 intentional skip; 8 contract tests; Vercel build | BROWSER / PORTABLE INTEGRITY FIXED |

## Target official-period delta

- [x] Deploy and source-verify `RecoveryBondVaultV2` after the official start.
- [x] Register and bond independent primary and backup providers.
- [x] Deploy the bonded Primary and authenticated Backup HTTPS Provider services.
- [x] Register RelayBond as OKX.AI ASP Agent `#13776` with a validated free A2MCP Recovery Proof service and submit it for Marketplace review.
- [x] Execute a paid primary delivery and independently verify `BREACH`.
- [x] Automatically dispatch the same task to the backup provider.
- [x] Settle backup compensation from the primary bond.
- [x] Prove the buyer paid only once.
- [x] Publish a real `RECOVERED` Continuity Receipt.
- [x] Add the official-period LOCAL coordinator flow to the judge demo, API and SDK.
- [x] Implement the configuration and fail-closed HTTP runtime required to replace LOCAL provider fixtures.
- [x] Execute the coordinator against two independent local HTTP Provider processes and signing identities.
- [x] Generate a post-start read-only V2 deployment plan and guarded registration workflow.
- [x] Implement a guarded live settlement executor that rejects LOCAL evidence and verifies post-transaction economic invariants.
- [x] Configure and operate two independent Testnet service endpoints.
- [x] Add the live official-period settlement flow to the judge demo, API and SDK.

## Evidence directory

Official-period machine-readable evidence is stored under:

```text
evidence/official-build/
```

The first artifact, [`coordinator-v1.json`](../evidence/official-build/coordinator-v1.json), deliberately records `onchainSettlement: false`. It proves the post-start LOCAL coordinator, signatures and fail-closed state machine. The later [`v2-deployment.json`](../evidence/official-build/v2-deployment.json) separately proves contract deployment, while [`v2-live-coordinator.json`](../evidence/official-build/v2-live-coordinator.json) and [`v2-live-settlement.json`](../evidence/official-build/v2-live-settlement.json) prove the distinct real Testnet recovery and completed bond-funded settlement.
