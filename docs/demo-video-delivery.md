# Demo video delivery

Rendered and verified on September 17, 2026 for the OKX Dev Day 2026 Remote Build submission.

## Final local files

- Video: `artifacts/demo-video/relaybond-okx-dev-day-demo-male-final.mp4`
- English captions: `artifacts/demo-video/relaybond-okx-dev-day-demo-male-final.srt`
- Source script: `docs/demo-video-script.md`
- Source evidence commit: `a885496`

The `artifacts/` directory is intentionally gitignored so a generated binary is not committed to the source repository.

## Verified media properties

- Duration: `00:03:49.732`
- Resolution: `1280 × 720`
- Frame rate: `30 fps`
- Video codec: `H.264`
- Audio codec: `AAC`, mono, `22.05 kHz`
- Voice: natural American English male voice, paced for a judge walkthrough
- Audio mean: `-16.5 dB`
- Audio peak: `-1.3 dB`
- File size: `3,937,640 bytes`
- SHA-256: `30beaf2eba7fb31171a72d8aa8a913c6cb0d4d546709b4db2297bc2bdd0362a7`

## Content verification

- Opens for four seconds with `Payment: SUCCESS` and `Response: {}`.
- Uses captures from the real public deployment at `https://relaybond-okx.vercel.app/`.
- Demonstrates the read-only one-click Judge Proof and clearly says it does not create a new payment or transaction.
- Shows `HTTP 402 VERIFIED → PAID BREACH → ACCEPTED + SIGNED → 7/7 ONCHAIN → JUDGE PASS`.
- Explains that the buyer paid once and the failed Primary bond funded the independent Backup.
- Shows the fail-closed `FROZEN` path without representing it as a successful recovery.
- Names the OKX x402, Agentic Wallet, X Layer and OKX.AI/A2MCP integrations.
- Ends with the public Demo and GitHub project context.

QA frames were inspected at the opening, middle and closing timestamps. The final encode has a valid video stream and a non-silent audio stream.

## External publication step

Upload the MP4 to YouTube as **Unlisted** or **Public**, upload the SRT as English captions, and add the resulting public URL to the submission form. A private video is not suitable for judging.
