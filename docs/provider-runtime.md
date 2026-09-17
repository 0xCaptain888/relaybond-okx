# Independent provider runtime

Status: **LOCAL / TESTED**. This runtime was implemented after the official OKX Dev Day build start. The V2 contract is deployed and source-verified, but this runtime does not claim that two independent Testnet services are registered or that a V2 recovery has settled.

## Why this layer exists

The Continuity Coordinator must be able to replace deterministic fixtures with independently operated Primary and Backup services without weakening its verification boundary. The runtime therefore separates four concerns:

1. `CONTINUITY_PROVIDERS_JSON` contains public routing metadata only.
2. `HttpProviderExecutor` sends the exact coordinator request to the selected audited endpoint.
3. The coordinator independently verifies the returned signatures, request, profile, SLA and response.
4. A provider `402` stops execution. No wallet signs, pays or replays automatically.

## Configuration

The environment value accepts an array or `{ "providers": [...] }`. It rejects unknown provider fields so API keys, passphrases and private keys cannot accidentally become provider metadata.

```json
{
  "providers": [
    {
      "providerId": "primary-agent",
      "name": "Primary Agent",
      "serviceId": "market-primary-v1",
      "endpoint": "https://primary.example/deliver",
      "provider": "0x0000000000000000000000000000000000000001",
      "mode": "TESTNET",
      "active": true,
      "priceAtomic": "10000",
      "bondAtomic": "5000000",
      "minimumBondAtomic": "1000000",
      "maximumLatencyMs": 1500,
      "maximumDataAgeSeconds": 20,
      "supportedSchemas": ["market-quote-v1"],
      "reliability": { "verifiedCalls": 20, "acceptedCalls": 19, "recoveredCalls": 0 }
    }
  ]
}
```

A valid continuity configuration requires at least two active providers with unique IDs, service IDs and signing identities. Non-local endpoints must use HTTPS. Runtime endpoint substitution and redirects are rejected.

## Provider request

```json
{
  "taskId": "0x…",
  "request": {
    "serviceId": "market-primary-v1",
    "requestedAt": 1789603200,
    "input": { "symbol": "BTC-USDT" },
    "buyer": "0x…"
  },
  "paymentSource": "BUYER"
}
```

The response must contain `request`, `response` (or `result`), `servicePromise` and `deliveryReceipt`. A self-consistent provider response is not enough: RelayBond rebinds it to the expected coordinator request and the audited Provider Profile.

## Readiness endpoint

```text
GET /v1/official/readiness
```

The endpoint exposes configuration count, modes, transport limits, automatic-payment status and V2 broadcast status. It never returns the environment JSON or any secret.
