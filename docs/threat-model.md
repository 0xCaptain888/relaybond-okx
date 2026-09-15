# Threat model

## Buyer fabricates a bad response

Rejected because the response hash is inside the provider-signed DeliveryReceipt.

## Provider returns an empty or stale response after payment

The verifier evaluates the signed response against the signed ServicePromise. A valid breach attestation can release a capped rebate from the provider bond.

## Attestation replay

The vault records each request hash and settles it at most once.

## Malicious verifier

The first release uses a named verifier for a crisp, demoable trust model. Production evolution is threshold verification, verifier staking and a challenge window. Subjective quality remains out of scope.

## Provider drains bond before a claim

Withdrawals require a delay. A service automatically becomes inactive if its bond falls below the published minimum.

## Malformed token behavior

The competition deployment must use the documented USDT0 contract. Arbitrary fee-on-transfer and callback tokens are out of scope.

## Non-goals

- judging subjective writing quality;
- replacing OKX escrow or payment settlement;
- guaranteeing market accuracy beyond machine-readable criteria;
- pretending that a local simulation is a live transaction.
