# Prior-work and pre-build disclosure

RelayBond is an independent repository and project created for OKX Dev Day 2026.

The author previously built policy gates, verifiable receipts and agent-control prototypes in unrelated hackathon repositories. Those repositories informed general engineering experience, but their code, transactions, deployments and evidence are not presented as RelayBond competition-period work.

All RelayBond-specific code, the Quality Bond mechanism, signed service promises, signed delivery receipts, deterministic SLA verification, OKX integration adapters, X Layer deployments and competition evidence are tracked in this repository from its first commit.

## September 15, 2026 pre-build disclosure

The Remote Build terms list **September 17, 2026** as the start of the official build period. RelayBond v0.1–v0.3, including the Testnet V1 warranty evidence and the LOCAL / TESTED V2 continuity prototype, existed before that date. None of this work will be represented as official-period development. Any judging claim about work completed during the official period must be supported by commits and evidence dated September 17, 2026 or later.

## Why development began before the official build period

RelayBond began as a feasibility and application-preparation prototype on September 15, 2026. The purpose of starting early was not to disguise prior work as hackathon-period output. It was to answer several go/no-go questions before committing the project to the event:

1. **Validate sponsor fit.** We needed to confirm that OKX x402, Agentic Wallet, OKX market delivery and X Layer contracts could form one coherent product instead of a superficial collection of sponsor logos.
2. **Validate the problem technically.** The initial experiment tested whether a paid Agent response could be cryptographically attributed to a provider, objectively judged against a signed SLA and connected to an economic consequence.
3. **Resolve external setup risk.** Wallet authorization, Testnet funding, contract verification, public API deployment and payment-facilitator behavior depend on external systems. Testing them early established what was actually possible and what must remain honestly labeled `PENDING`.
4. **Establish a transparent baseline.** Publishing the pre-build repository, Release, transactions and evidence before September 17 creates a verifiable boundary. Judges can compare the baseline directly with official-period commits instead of relying on an unsupported claim about what was new.
5. **Reserve the official period for meaningful advancement.** The intended official-period work is not routine setup or a redeployment. It is the substantial transition from a LOCAL recovery prototype to a real multi-provider OKX AI workflow with X Layer bond-to-backup settlement.

The pre-build work is therefore disclosed as the project's starting point, not submitted as official-period development.

## Detailed pre-build development timeline

All times below are **China Standard Time (UTC+8)** and come directly from the Git commit history. The entire recorded pre-build implementation occurred on **September 15, 2026**.

| Time | Commit | Verifiable milestone | Competition status |
|---|---|---|---|
| 17:50 | `a069453` | Created the RelayBond foundation: signed service promises, signed delivery receipts, deterministic SLA verification, Quality Bond contract, SDK/API foundation and judge demo. | PRE-BUILD |
| 17:53 | `9331e18` | Added modern GitHub Pages deployment. | PRE-BUILD |
| 17:54 | `affe6ca` | Fixed subpath-safe static demo publishing. | PRE-BUILD |
| 18:01 | `ac7fce3` | Added live-integration checklist, threat model and security handoff documentation. | PRE-BUILD |
| 18:16 | `901a0db` | Separated buyer/provider/verifier roles and added the evidence-derived Reliability Passport. | PRE-BUILD |
| 18:26 | `572d4dd` | Added the X Layer vault deployment record and prepared the serverless live API. | PRE-BUILD |
| 19:18 | `2996885` | Launched the bonded OKX x402 service on Vercel. | PRE-BUILD / LIVE API |
| 19:33 | `965cdb7` | Verified the deployed X Layer contract source. | PRE-BUILD / TESTNET |
| 19:47 | `c2a2747` | Added a guarded buyer runner whose default mode inspects payment terms without signing. | PRE-BUILD |
| 19:52 | `93c7b52` | Integrated the two-phase OKX Agentic Wallet buyer flow. | PRE-BUILD |
| 20:39 | `51b96b8` | Bound the facilitator-verified payer to delivery evidence and hardened live evidence handling. | PRE-BUILD |
| 20:51 | `76dbc7d` | Added onchain verification for initially pending x402 settlements. | PRE-BUILD |
| 21:03 | `fddc575` | Published the first complete Agentic Wallet delivery verified as `ACCEPTED`. | PRE-BUILD / TESTNET |
| 21:58 | `697b0e3` | Fixed exact paid-request replay so reviewed parameters survive the payment retry. | PRE-BUILD |
| 22:05 | `782aec2` | Published a real paid stale delivery independently verified as `BREACH`. | PRE-BUILD / TESTNET |
| 22:18 | `cd12051` | Published the real X Layer breach rebate and automatic provider pause. | PRE-BUILD / TESTNET |
| 22:22 | `a2dbebd` | Aligned the public production health version with the verified release. | PRE-BUILD |
| 22:49 | `03c374a` | Added the LOCAL / TESTED double-pay-free recovery prototype, Provider Registry, Continuity Receipt and `RecoveryBondVaultV2`. | PRE-BUILD / LOCAL |
| 22:55 | `aa4bc8d` | Pinned deterministic evidence to the disclosure date and published tag `v0.3.0`. | PRE-BUILD BASELINE |

The canonical pre-build boundary is:

```text
Tag:       v0.3.0
Commit:    aa4bc8d508d690bc2599be88e6c49011fb589e69
Completed: 2026-09-15 22:55:14 UTC+8
```

On September 16, only disclosure and competition-period recordkeeping documents were added. Those documentation commits remain pre-build administrative work; they do not change the product baseline or create functionality claimed for judging.

## What existed at the baseline

The following capabilities existed before the official period and will not be claimed as event-period work:

- deployed and source-verified `QualityBondVault` V1 on X Layer Testnet;
- live OKX x402 payment boundary;
- real Agentic Wallet paid `ACCEPTED` delivery;
- real Agentic Wallet paid `BREACH` delivery;
- real X Layer buyer rebate and automatic provider pause;
- signed Service Promise and Delivery Receipt formats;
- browser EIP-712 verification and Reliability Passport;
- LOCAL Bonded Provider Registry;
- LOCAL verifier-signed Continuity Receipt;
- LOCAL / TESTED `RecoveryBondVaultV2` and deterministic `RECOVERED` flow.

## Official build-period target and current progress

The project will count only genuinely new post-start work as official-period development. The intended delta is:

- [x] deploy and source-verify `RecoveryBondVaultV2` after the official start;
- [x] register and bond two independent live providers;
- [ ] publish or integrate the provider services through OKX AI/A2MCP;
- [x] execute a real paid primary delivery that produces an objective `BREACH`;
- [x] automatically route the same task to an independent backup;
- [x] settle the backup from the primary provider bond on X Layer;
- [x] prove the buyer was not charged a second time;
- [x] publish a real `RECOVERED` Continuity Receipt and transaction evidence;
- [x] expose the official-period coordinator workflow through the public judge demo and SDK.

New commits, evidence and transactions will be recorded separately in `docs/official-build-period.md` and `evidence/official-build/` after the official start.

## Copy-ready submission disclosure

> RelayBond began as a feasibility prototype on September 15, 2026, before the listed September 17 Remote Build start. We used that pre-build phase to validate OKX x402 settlement, Agentic Wallet payment, signed delivery evidence and the X Layer Quality Bond model. The complete pre-build baseline is publicly preserved at tag `v0.3.0` (`aa4bc8d`) and is not claimed as event-period work. During the official build period, judging should focus only on the documented post-start delta: live multi-provider routing, OKX AI/A2MCP integration, the deployed V2 recovery contract, real backup delivery and proof that a breached provider's bond completed the task without charging the buyer twice.

The repository will distinguish these statuses without ambiguity:

- `LOCAL`: deterministic local execution only.
- `TESTNET`: backed by a public X Layer Testnet transaction.
- `MAINNET`: backed by a public X Layer Mainnet transaction.
- `DESIGN`: documented but not implemented.
- `PENDING`: planned or awaiting an external deployment/listing step.
