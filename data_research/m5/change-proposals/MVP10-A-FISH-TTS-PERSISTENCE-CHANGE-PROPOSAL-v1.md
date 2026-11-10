# CHANGE PROPOSAL — Fish TTS Cross-Run Persistence v1

Status: OWNER-AUTHORIZED OBJECTIVE; phase acceptance is defined prospectively here. Prompt A is not started until an explicit `promptA` turn.
Project: `daily-gainers-market-opening-end-to-end`
Goal version: `goal-v3/MVP-10DAY-v1`
Phase ID: `MVP10-A-FISH-TTS-PERSISTENCE-R1`
Predecessor closeout: `MVP10-A-FISH-AUDIO-TIMESTAMP-MIGRATION-R2` (PASS)
Parent history: `MVP10-A-TTS-PERSISTENCE-R1` remains incomplete and preserved; its Edge-specific execution is superseded prospectively for provider selection only.
Base main: `d37736422578da1f933a3e44419ad34e37172498`
Date: 2026-11-10 (Asia/Taipei)

## Owner-selected objective

Persist successful Fish Audio scene MP3 and WordBoundary outputs across separate GitHub Actions runs, request only missing or invalid scenes, then have the date-scoped Render-only workflow validate and consume that same frozen plan and checkpoint. Preserve every other formal daily-video gate and all historical results.

This phase reuses the existing, verified Fish timestamp adapter and its owner-approved R2 identity: provider `fish.audio`, timestamped endpoint `https://api.fish.audio/v1/tts/stream/with-timestamp`, model `s2.1-pro-free`, reference ID `e7af89da8abc4fbdacd9a10ab9881933`, `prosody.speed=1.15`, and MP3 output. Existing live evidence proves one scene synthesis/timestamp path only; it does not prove cross-run persistence or Render-only consumption.

## Evidence and rationale

- The Edge-based `MVP10-A-TTS-PERSISTENCE-R1` recovery work remained incomplete after repeated `NoAudioReceived` failures. Its history and failed run IDs remain immutable.
- Fish migration R2 independently passed with one live request, 60.970 seconds, complete alignment coverage, exact timestamp handling, and a retained short-lived artifact. R2 is closed PASS but made no production checkpoint or Render-only change.
- R2 closeout found and repaired SRT millisecond-precision collapse; that repair is on main at `eb7325f4f737fae18956f888b7bc404c5ec7ca91`.
- The existing Edge cross-run proposal v1 and pair v1 remain historical. This version replaces only the prospective provider-specific implementation contract; it does not rewrite MVP10-A, R1 failures, R2 evidence, or editorial facts.

## Frozen acceptance for this phase

1. **Frozen identity.** Bind each scene to target date; source main commit; final narration script SHA-256; scene ID/order; normalized spoken-text SHA-256; provider and exact endpoint; Fish model; reference ID; prosody speed; output format; timestamp schema; and pipeline version. A provider/configuration/script mismatch invalidates only affected scenes and is recorded.
2. **Fish request contract.** Use the Fish timestamped streaming endpoint and the exact approved model/reference/speed above. One API request per scene attempt; never retry within that attempt. Preserve every audio chunk and the latest cumulative alignment snapshot per chunk according to the verified adapter contract. Keep timestamp classifications distinct, preserve equal finite intervals as zero-duration WordBoundary points, and fail closed on invalid time data. The generated spoken-segment audio must be at least 50 seconds; there is no upper cap for this Fish acceptance. Existing editorial text and all other content/source gates remain in force.
3. **Durable scene checkpoints.** Store each successful nonempty MP3 plus WordBoundary and a manifest with content hashes, scene fingerprint, byte size, and producing run on `tts-audio-pending-YYYYMMDD`. Commit each scene before the runner exits. Do not put MP3s on `main`, force-push, rewrite history, or store credentials/transcripts in diagnostics.
4. **Bounded recovery.** Each invocation may request no more than three missing/invalid scenes, deterministic scene order, `max-parallel: 1`, one fresh runner per scene, and conservative cooldown/pacing. Re-plan from the newest main manifest and date checkpoint before each scene. Reuse matching successful scenes without making Fish requests for them. Do not blindly retry a known failed request on unchanged code/input; diagnose first and only make a bounded reattempt after a relevant input/code/configuration change or an explicitly evidenced safe recovery condition.
5. **Complete-audio gate.** PASS requires exact scene coverage/order, valid nonempty MP3s, matching MP3/WordBoundary hashes and fingerprints, expected Fish provider/model/reference/speed/output/pipeline identity, text coverage, and valid timestamp structure. A mismatch fails closed.
6. **Render-only consumer.** `.github/workflows/daily-gainers-date-render-only.yml` must restore the exact target date checkpoint and compare it with the same frozen narration plan. Validate date, scene coverage/order, hashes, fingerprint, and WordBoundary schema before any rendering step. On any mismatch, fail before rendering. Render-only must not call Fish or Edge TTS and must not synthesize replacements.
7. **End-to-end acceptance.** After all pre-existing date/script/news/editorial gates pass and the complete-audio gate passes, one date-scoped Render-only run must consume the checkpoint. Verify the actual MP4, SRT, subtitle alignment/coverage, QA report, thumbnail, provenance, and durable artifacts against the existing frozen MVP10-A criteria. A TTS PASS alone is not video completion.
8. **Cross-run proof.** On the same eligible date/script identity, the first TTS-only invocation checkpoints successful scenes. A later separate invocation must prove those exact matching scenes were reused with zero Fish requests for them while processing only still-missing scenes (or a no-op queue if complete). Verify remote branch commit and blobs, not just workflow output.
9. **Safety.** No YouTube upload, upload scheduling, public release, Pages, release-lock change, checkpoint deletion, or unrelated workflow dispatch. Audio cleanup is out of scope; the release lock stays closed.

## Scope boundary and stop rules

This is a versioned provider migration and persistence phase, not a relaxation of source, factual, editorial, Render, QA, or publishing gates. The only explicit duration change for this Fish acceptance is the already owner-directed `>=50s` floor with no upper cap. Do not alter other frozen MVP10-A/B criteria. Preserve old Edge/R1/R2 conclusions. Do not trigger an API call until the exact-date frozen plan and all formal TTS input gates are verified. If no date is eligible, stop as `WAITING_SOURCE` with the exact missing gate.

Canonical paired prompts: `data_research/m5/change-proposals/MVP10-A-FISH-TTS-PERSISTENCE-PAIR-v1.md`.

Owner authorization: the owner selected this exact Fish cross-Actions persistence and Render-only objective after previously authorizing Fish migration and Fish-specific acceptance redefinition. Registration does not start Prompt A; the owner must invoke `promptA` in a separate turn.