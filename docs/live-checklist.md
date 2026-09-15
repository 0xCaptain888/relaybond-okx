# Live integration checklist

## P0 — must be real before submission

- [ ] Confirm X Layer Testnet/Mainnet eligibility with OKX Dev Day organizers. Testnet chain ID is `1952`.
- [ ] Use official Testnet USD₮0 `0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c` and test OKB from the X Layer faucet.
- [ ] Fund only the public deployer address in `evidence/setup/wallet-addresses.json`; `.env` remains local and gitignored.
- [ ] Deploy `QualityBondVault` and record verified source plus deployment transaction.
- [ ] Deposit a real USDT0 Quality Bond.
- [ ] Publish the provider as an OKX AI A2MCP service.
- [ ] Return the official x402 `exact` payment challenge.
- [ ] Pay once from an OKX Agentic Wallet and capture the payment identifier.
- [ ] Return one correct signed response and verify `ACCEPTED`.
- [ ] Return one signed empty/stale response and verify `BREACH`.
- [ ] Submit verifier attestation and show the real onchain `BreachRebated` event.
- [ ] Deploy the public judge demo and API.

## P1 — prize-strengthening

- [x] Reliability Passport with acceptance rate, breach reasons and bond coverage. Live history remains pending.
- [ ] Provider SDK and OpenAPI integration example.
- [ ] Backup-provider recovery without double-charging the buyer.
- [ ] Browser-side EIP-712 signer recovery, not only portable SHA-256 integrity.
- [ ] Two to three outside builders test the integration.

## Submission hygiene

- [ ] README links first: demo, video, live evidence, contracts.
- [ ] 2–4 minute video starts with `Payment: SUCCESS / Response: {}`.
- [ ] Prior-work disclosure is linked.
- [ ] Every claim is labeled LOCAL, TESTNET, MAINNET or DESIGN.
- [ ] Submission is frozen and checked before 2026-09-25 23:59 UTC.
