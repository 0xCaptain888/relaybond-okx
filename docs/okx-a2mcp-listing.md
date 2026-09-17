# OKX.AI A2MCP listing

Status: **REGISTERED / REVIEW SUBMITTED** on September 17, 2026.

- ASP name: `RelayBond`
- Agent ID: `13776`
- Service type: `A2MCP`
- Fee: `Free`
- Review language: `zh-CN`

## Agent description

RelayBond is the reliability clearing layer for paid AI Agents: it routes tasks to bonded providers and funds an independent backup from a failed provider's bond so the buyer pays only once.

## Service

### Name

`RelayBond Recovery Proof`

### Description

```text
1. [Service Description] Returns RelayBond's completed X Layer Testnet recovery settlement, balance changes, and seven independent verification checks.
2. [Parameter Spec] No parameters required.
3. [Request Method] GET
4. [Request Example] curl "https://relaybond-okx.vercel.app/v1/official/settlement"
```

### Endpoint

`GET https://relaybond-okx.vercel.app/v1/official/settlement`

## Listing checklist

- [x] Upload the RelayBond Failover Switch avatar.
- [x] Create the RelayBond ASP identity.
- [x] Pass Listing QA with zero findings.
- [x] Validate that the public endpoint returns HTTP 200 and the completed `SETTLED_AND_VERIFIED` evidence.
- [x] Create OKX.AI Agent `#13776` with the free A2MCP service.
- [x] Submit Agent `#13776` for Marketplace review on September 17, 2026.
- [ ] Receive OKX.AI Marketplace approval. This is an external review dependency and must not be represented as complete before OKX approves it.
