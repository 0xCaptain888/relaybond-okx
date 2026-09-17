# Demo video delivery

Rendered and verified on September 17, 2026 for the OKX Dev Day 2026 Remote Build submission.

## Final local files

- Video: `artifacts/demo-video/relaybond-okx-dev-day-demo-ryan-final.mp4`
- English captions: `artifacts/demo-video/relaybond-okx-dev-day-demo-ryan-final.srt`
- Source script: `docs/demo-video-script.md`
- Source evidence commit: `0a01daf`

The `artifacts/` directory is intentionally gitignored. Generated media and the local TTS environment are not committed to the source repository.

## Verified media properties

- Duration: `00:03:25.967`
- Resolution: `1280 × 720`
- Frame rate: `30 fps`
- Video codec: `H.264`
- Audio codec: `AAC`, mono, `22.05 kHz`
- Voice model: `mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-8bit`
- Voice preset: `Ryan`, speed `0.9×`
- Integrated loudness: `-16.76 LUFS`
- True peak: `-1.40 dBTP`
- File size: `3,537,091 bytes`
- SHA-256: `ee3fe943bd3ddfd3e0dd6efb75dbff9f2f1d3e41440e61e403080085e93eb051`

The narration is locally generated neural speech, not a human recording. Its direction is calm, warm, conversational and deliberately avoids an advertisement or trailer cadence.

## Content verification

- Opens for four seconds with `Payment: SUCCESS` and `Response: {}`.
- Uses captures from the real public deployment at `https://relaybond-okx.vercel.app/`.
- Demonstrates the read-only Judge Proof and says that it does not create a new payment or transaction.
- Shows `HTTP 402 VERIFIED → PAID BREACH → ACCEPTED + SIGNED → 7/7 ONCHAIN → JUDGE PASS`.
- Explains that the buyer paid once and the failed Primary bond funded the independent Backup.
- Shows the fail-closed `FROZEN` path without presenting it as successful recovery.
- Names the OKX payment boundary, Agentic Wallet authorization, X Layer settlement and OKX.AI/A2MCP integration.
- Ends with the public Demo and GitHub project context.

Opening, middle and closing frames were inspected after the final encode. The file has valid H.264 video, audible AAC audio and no clipped peaks.

## External publication step

Upload the MP4 to YouTube as **Unlisted** or **Public**, upload the SRT as English captions, and add the public URL to the submission form. Private visibility is unsuitable for judging.
