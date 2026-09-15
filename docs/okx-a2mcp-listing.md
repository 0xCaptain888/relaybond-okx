# OKX AI A2MCP listing package

## Name

RelayBond Market Data Warranty

## Short description

Purchase a fresh OKX market quote protected by a provider-funded USDT0 Quality Bond and receive a signed Delivery Receipt.

## Agent instruction

Use this service when an autonomous workflow needs a fresh OKX instrument quote plus machine-verifiable delivery evidence. Send an OKX instrument ID such as `BTC-USDT`. On success, independently verify the returned ServicePromise and DeliveryReceipt. If the signed response is empty, stale, late or malformed, submit it to the RelayBond verifier for a rebate attestation.

## Endpoint

`POST https://relaybond-okx.vercel.app/v1/provider/quote`

## Request

```json
{ "symbol": "BTC-USDT" }
```

## Response

```json
{
  "result": {
    "symbol": "BTC-USDT",
    "price": 62450.25,
    "observedAt": 1789430400,
    "source": "OKX_MARKET_API"
  },
  "servicePromise": { "payload": {}, "signature": "0x..." },
  "deliveryReceipt": { "payload": {}, "signature": "0x..." }
}
```

## Before listing

- [x] Deploy the public endpoint over HTTPS.
- [x] Confirm an unauthenticated request returns HTTP 402 with a valid `PAYMENT-REQUIRED` header.
- [x] Publish the signed Service Promise at `GET /v1/service/promise`.
- [x] Keep the service price at 0.01 Testnet USD₮0 for judging.
- [x] Confirm one Agentic Wallet paid retry settles, returns the delivery body and verifies `ACCEPTED`.
- [ ] Publish the service in OKX AI / A2MCP after the paid proof exists.
