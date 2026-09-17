# Threat model

## Buyer fabricates a bad response

Rejected because the response hash is inside the provider-signed DeliveryReceipt.

## Buyer substitutes the rebate address

Rejected because the service route ignores self-declared buyer headers. The payer is extracted only from the authorization already accepted by the OKX facilitator, then bound into the provider-signed request hash.

## Merchant response arrives but payment later fails

No LIVE evidence is emitted. The buyer runner requires the decoded settlement receipt itself to be final-success; a successful HTTP response alone is insufficient.

## Provider returns an empty or stale response after payment

The verifier evaluates the signed response against the signed ServicePromise. A valid breach attestation can release a capped rebate from the provider bond.

## Attestation replay

The vault records each request hash and settles it at most once.

## Primary and backup collude

V2 rejects identical provider identities and exposes both signed delivery histories in the Continuity Receipt. Identity separation is necessary but not sufficient against Sybil collusion; production evolution includes stake-weighted provider admission and correlated-failure scoring.

## Backup inflates its recovery price

The recovery amount cannot exceed the buyer's original service payment. Provider selection also filters backups above the buyer's declared budget before execution.

## Buyer is charged again during failover

The V2 recovery contract has no buyer debit path. It transfers the verifier-authorized recovery amount from the primary provider's bond to the backup. Unit and contract tests assert that buyer balance does not change.

## Verifier binds unrelated deliveries

The Continuity Receipt binds the original request hash, task ID, primary evidence hash, backup evidence hash, provider identities, amounts and terminal states. Browser verification recovers the EIP-712 signer and rechecks canonical evidence integrity.

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
- claiming that the bonded V2 contract has already executed a live recovery before paid Primary breach, Backup delivery and settlement transaction evidence exist.
