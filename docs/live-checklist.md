# Live integration checklist

## P0 — must be real before submission

- [ ] Confirm X Layer Testnet/Mainnet eligibility with OKX Dev Day organizers. Testnet chain ID is `1952`.
- [x] Use official Testnet USD₮0 `0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c` and test OKB from the X Layer faucet.
- [x] Fund only the public role addresses in `evidence/setup/wallet-addresses.json`; `.env` remains local and gitignored.
- [x] Deploy `QualityBondVault` and record the public deployment transaction.
- [x] Verify the deployed `QualityBondVault` source on the X Layer explorer.
- [x] Register the endpoint-bound Service Promise and deposit a real 5 Testnet USDT0 Quality Bond.
- [x] Register RelayBond as OKX.AI ASP Agent `#13776` with the free `RelayBond Recovery Proof` A2MCP service.
- [x] Submit Agent `#13776` for OKX.AI Marketplace review on September 17, 2026.
- [ ] Receive OKX.AI Marketplace approval; this is now an external review dependency.
- [x] Return the official x402 `exact` payment challenge from the public Vercel API.
- [x] Ship a guarded Buyer Runner whose default mode only inspects the 402 challenge.
- [x] Add a two-phase OKX Agentic Wallet adapter (`quote` first, explicit `pay` second).
- [x] Fund the OKX Agentic Wallet with 0.05 Testnet USD₮0 and publish the transaction evidence.
- [x] Derive the buyer from the facilitator-verified authorization instead of a caller-supplied header.
- [x] Reject merchant output unless the decoded settlement receipt is final-success.
- [x] Prepare a fail-closed paid breach runner and evidence-derived rebate executor.
- [x] Pay once from an OKX Agentic Wallet and independently confirm the 0.01 USD₮0 settlement transaction.
- [x] Capture a complete Agentic Wallet paid delivery body and independently verify it as `ACCEPTED`.
- [x] Return one correct provider-signed response and verify all 9 SLA checks.
- [x] Return one provider-signed stale paid response and independently verify `BREACH`.
- [x] Submit verifier attestation and show the real onchain `BreachRebated` event, exact token `Transfer` and automatic service pause.
- [x] Deploy the public judge demo and API at `https://relaybond-okx.vercel.app`.

## P1 — prize-strengthening

- [x] Reliability Passport with 2 verified Testnet deliveries, 50% acceptance, 0.01 rebated and 499-call bond coverage.
- [x] Provider SDK and OpenAPI integration surface.
- [x] Deterministic backup-provider recovery without double-charging the buyer (`LOCAL / TESTED`).
- [x] Verifier-signed Continuity Receipt binds primary breach, backup delivery and recovery economics.
- [x] RecoveryBondVaultV2 contract tests cover authorization, replay protection and buyer balance invariance.
- [x] Deploy and source-verify RecoveryBondVaultV2 on X Layer Testnet.
- [x] Register and bond independent Providers with six independently verified Testnet receipts.
- [x] Execute one real paid V2 breach and backup settlement.
- [x] Browser-side EIP-712 signer recovery, not only portable SHA-256 integrity.
- [x] Guarded V2 settlement executor rejects LOCAL evidence, simulates before broadcast and verifies buyer balance invariance.
- [x] LIVE coordinator bridge re-verifies paid Primary settlement, onchain Provider bonds and HTTPS Backup delivery before emitting settlement evidence.
- [ ] Two to three outside builders test the integration.

## Submission hygiene

- [x] README links first: demo, live API, source and contract.
- [x] Local 3:50 submission video uses a natural male voice, starts with `Payment: SUCCESS / Response: {}` and passed media/content QA.
- [ ] Upload the final MP4 as an Unlisted or Public video and add its URL to the submission.
- [x] Prior-work disclosure is linked.
- [x] Every claim is labeled LOCAL, TESTNET, LIVE, MAINNET or DESIGN.
- [ ] Submission is frozen and checked before 2026-09-25 23:59 UTC.
- [x] Pre-period work is explicitly disclosed; no September 15 work is represented as official build-period work.
