# Security

## Runtime dependency policy

The public API and SDK production dependency graph is checked with:

```bash
npm run security:audit
```

At foundation release time this reports zero production vulnerabilities.

Hardhat 2 and its test toolbox are development-only dependencies. Their legacy transitive graph currently produces npm audit advisories even though those packages are not installed in the production deployment (`npm ci --omit=dev`). Migrating the compiler toolchain is intentionally lower priority than producing the live OKX x402 and X Layer evidence before the competition deadline. This distinction is documented rather than hidden.

## Reporting

Do not open a public issue for an exploitable vulnerability. Contact the repository owner privately with the affected version, reproduction steps and impact.

## Contract assumptions

- Deploy only with the documented USD₮0 token.
- Keep provider signing and verifier keys separate.
- Verify the deployed source and constructor arguments.
- Start with a small Testnet bond, then a deliberately limited Mainnet bond if required by the competition.
- A named verifier is a v1 trust assumption; threshold verification is the planned production evolution.
