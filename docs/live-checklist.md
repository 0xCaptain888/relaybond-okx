# Live integration checklist

## P0 — must be real before submission

- [ ] Confirm X Layer Testnet/Mainnet eligibility with OKX Dev Day organizers. Testnet chain ID is `1952`.
- [x] Use official Testnet USD₮0 `0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c` and test OKB from the X Layer faucet.
- [x] Fund only the public role addresses in `evidence/setup/wallet-addresses.json`; `.env` remains local and gitignored.
- [x] Deploy `QualityBondVault` and record the public deployment transaction.
- [ ] Verify the deployed contract source on the X Layer explorer.
- [x] Register the endpoint-bound Service Promise and deposit a real 5 Testnet USDT0 Quality Bond.
- [ ] Publish the provider as an OKX AI A2MCP service.
- [x] Return the official x402 `exact` payment challenge from the public Vercel API.
- [ ] Pay once from an OKX Agentic Wallet and capture the payment identifier.
- [ ] Return one correct signed response and verify `ACCEPTED`.
- [ ] Return one signed empty/stale response and verify `BREACH`.
- [ ] Submit verifier attestation and show the real onchain `BreachRebated` event.
- [x] Deploy the public judge demo and API at `https://relaybond-okx.vercel.app`.

## P1 — prize-strengthening

- [x] Reliability Passport with acceptance rate, breach reasons and bond coverage. Live history remains pending.
- [x] Provider SDK and OpenAPI integration surface.
- [ ] Backup-provider recovery without double-charging the buyer.
- [ ] Browser-side EIP-712 signer recovery, not only portable SHA-256 integrity.
- [ ] Two to three outside builders test the integration.

## Submission hygiene

- [x] README links first: demo, live API, source and contract.
- [ ] 2–4 minute video starts with `Payment: SUCCESS / Response: {}`.
- [x] Prior-work disclosure is linked.
- [x] Every claim is labeled LOCAL, TESTNET, LIVE, MAINNET or DESIGN.
- [ ] Submission is frozen and checked before 2026-09-25 23:59 UTC.
