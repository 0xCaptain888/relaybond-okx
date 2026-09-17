# RelayBond 3:50 submission video

Rendered length: **3 minutes 50 seconds**. Language: English with a natural American male voice. Format: 16:9, 720p.

The video must show the real public Demo and real evidence. Do not imply that the read-only Judge Run creates a new transaction.

## 0:00–0:04 — Required cold open

### Screen

```text
Payment: SUCCESS
Response: {}
```

## 0:04–0:24 — The unfinished task

### Screen

RelayBond hero and Failover Switch logo.

### Voiceover

> An AI agent paid for a service. The payment went through, but the provider failed. A refund might return the money, but it still leaves the job unfinished. RelayBond closes that gap. The agent can fail, the task still finishes, and the buyer is never charged twice.

### Caption

`The agent failed. The task still finishes.`

## 0:24–0:46 — The missing reliability layer

### Screen

Show the live deployment cards: HTTP 402, Quality Bond, Agentic Wallet, Primary and Backup, OKX.AI Agent `#13776`.

### Voiceover

> RelayBond is the reliability clearing layer for paid AI agents. Providers publish clear service promises, lock USD₮0 quality bonds, and sign every delivery. Buyers can route work using verified performance and real financial coverage, instead of trusting a promise that nobody can measure.

## 0:46–1:54 — One-click Judge Proof

### Screen

Click **Run 60-second Judge Proof**. Keep the five verification stages visible.

### Voiceover

> Here is the one-click Judge Proof. It is a read-only verification of a completed, live recovery. It does not ask for a wallet signature, and it does not pretend to create a new transaction. First, the browser checks the production OKX x402 payment boundary on X Layer Testnet.

> The OKX Agentic Wallet payment succeeded. But the bonded Primary returned stale market data and broke its signed freshness promise. Before recovery can continue, RelayBond verifies the payment, the original request, the provider identity, the delivery signature, and the exact reason for the breach.

> RelayBond sends the same task to a different, bonded provider through an authenticated Backup endpoint. The Backup returns a fresh, signed result. Right here in the browser, RelayBond recovers both signers and verifies the EIP-712 evidence and the portable SHA-256 integrity hash.

### Captions

- `HTTP 402 VERIFIED`
- `PAID PRIMARY: BREACH`
- `INDEPENDENT BACKUP: ACCEPTED`
- `EIP-712 SIGNERS RECOVERED IN BROWSER`

## 1:54–2:18 — Real X Layer settlement

### Screen

Show the final Judge Proof console and the settlement transaction hash. Briefly open the explorer link if recording manually.

### Voiceover

> The buyer did not pay for recovery. The X Layer contract transferred exactly 0.01 USD₮0 from the failed Primary bond to the Backup. The buyer balance stayed unchanged. The Backup balance increased, the Primary bond dropped from 5.00 to 4.99, and all seven settlement checks passed.

### Caption

`Buyer paid once · Primary bond funded recovery · 7/7 checks passed`

## 2:18–2:43 — Portable evidence

### Screen

Show the final evidence console and public verification paths.

### Voiceover

> The final console ties everything together: the live payment, the Primary breach, the independent Backup delivery, both signatures, the settlement transaction, and proof that the buyer paid once. Anyone can pause the video, inspect the hashes, call the public evidence endpoint, or repeat the same verification in their own browser.

## 2:43–3:06 — Fail closed, never false success

### Screen

Show the Official Coordinator and the `RECOVERED` and `FROZEN` paths.

### Voiceover

> RelayBond also fails closed. If the independent Backup fails, the task becomes FROZEN instead of being shown as recovered. Every state change is permanent and tied to evidence. That is the difference between honest orchestration and a retry system that quietly turns a second failure into a fake success screen.

## 3:06–3:31 — Why OKX

### Screen

Show the X Layer contract, OKX.AI Agent card and public A2MCP Recovery Proof endpoint.

### Voiceover

> OKX x402 provides the payment boundary. Agentic Wallet provides programmable buyer authorization. X Layer turns provider reliability into enforceable capital. And OKX.AI Agent thirteen-seven-seven-six exposes the completed Recovery Proof as a free A2MCP service for other agents and applications.

## 3:31–3:50 — Close

### Screen

Return to the hero and logo. Display the Demo and GitHub URLs.

### Voiceover

> Payments make agent commerce possible. RelayBond makes it dependable. One buyer payment, one completed task, an independent recovery provider, and evidence anyone can verify. RelayBond is the reliability clearing layer for the agent economy.

### Final caption

`RelayBond · Reliability clearing for the Agent economy`

## Recording checklist

- Use `https://relaybond-okx.vercel.app/`.
- Browser zoom: 90–100%.
- Record at 1920×1080 or 1280×720.
- Hide bookmarks and personal browser data.
- Keep the transaction hash visible long enough to pause and inspect.
- Do not show local secrets, `.env`, wallets or API credentials.
- Upload as unlisted or public; do not use private visibility.
