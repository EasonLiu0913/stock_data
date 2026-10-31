# MVP10-A | Exact GitHub-committed source validator executed against pinned source (2026-10-31)

## Scope and goal
Project `daily-gainers-market-opening-end-to-end`, goal `goal-v3/MVP-10DAY-v1`. One isolated **research** source adapter for frozen `20261008` scene1. Production and publication unchanged. The owner explicitly approved qualitative isolated scene1 preview, not full production A/B acceptance.

## Eliminated previous parity gap

Previous Handoff: 12/12 local tests ran a local **reference** implementation, while the actual GitHub-committed validator had **not** been independently executed. This time **the committed GitHub code itself** was reproduced byte-for-byte from the connector-fetched branch files, and verified using the exact **Git Blob SHA-1** (this commits the byte-exact source, not merely an equivalent reimplementation):

- `scripts/research_verify_20261008_scene1_source.py`, GitHub content blob SHA-1 **`698dfb8f62732781775562d4fbdc84f9015630fb`**; local reconstructed Git Blob SHA-1 **same**; research branch commit `bf04ebdfe712d044bba8cc7c8f8832e6b89911fd`.
- `scripts/test_research_verify_20261008_scene1_source.py`, GitHub content blob SHA-1 **`734235ee5f17f82551105ca5c530768ff97e7285`**; local reconstructed Git Blob SHA-1 **same**; research branch commit `3468a54b1380fa0957db154ca32d722e7b0f7c00`.
- The true 20261008 scene1 research input from `mvp10_scene1_integration_RESEARCH_ONLY.zip`, with pinned `plan.json`, `tts-manifest.json`, `integration-receipt.json`, real `audio/01.mp3` and 14-cue SRT; and the pinned actual 24kHz/mono source WAV SHA-256 **`fc5598fcb5a4def1a3a0f1bf5d17609c12a7f065589c27109e8d50ce3ce06bc7`**.
- Direct invocation of the committed validator: **PASS**; output `research_only=true`, `publishable=false`, `date=20261008`, `word_events=128`, `srt_cues=14`, `source_wav_seconds=43.562`, `mp3_measured_seconds=43.632`, `frozen_ab_complete=false`.
- Executed **the committed opt-in Python unittest suite**, with explicit `MVP10_RESEARCH_SCENE1_FIXTURE` and `MVP10_RESEARCH_SCENE1_WAV` pointing to source real fixtures. **10/10 PASS**, 0 errors, 0 failures, 0 skips: baseline + wrong date, publication flag, forged fresh edge engine, removed word event, wrong voice/rate, altered MP3, altered SRT, owner approval removed and extra scene.

Evidence saved **locally** in `/mnt/data/mvp10_committed_validation/`: byte-identical verifier and tests, and `committed_source_verifier_local_receipt_20261031.json`, SHA-256 **`a85fc5c9804d4795b05f927f827b831b02b005ffc96be6d8a144dcc200f20259`**.

## Remote CI limits

**This is an actual execution of the GitHub-committed source, but in an isolated local runtime, NOT GitHub Actions.** No new GitHub Actions run was triggered. Actual remote CI remains **NOT_RUN**, not PASS. The research-only workflow in the branch presently calls fresh Edge TTS and has no reliable pinned PCM fixture input through sparse checkout. Do not falsely report that regular nine-scene render pipeline was exercised. No automatic main changes, secret use or publishing.

## Minimum next action

If GitHub Actions CI evidence is required under original frozen Phase A/B, construct and validate a **dedicated read-only research-fixture CI** that retrieves the pinned original source Artifact through an authorized owner-controlled read-only mechanism, reconstructs/extracts the exact known SHA PCM and the derived single-scene input, executes this same exact committed validator and its 10 negative tests, and refuses if any artifact or SHA mismatch occurs. Do **not** dispatch the full original Render-only workflow (fresh line4 TTS still at risk of `NoAudioReceived`). The CI must have `contents:read`, `actions:read`, no YouTube, no secrets logging and no release actions; if expired artifact or unverified source, fail closed.

Separate unresolved production issues: 14-cue SRT binds to preview only; the user accepted preview globally; actual external player subtitle/footer collision and fourth-line presenter frame-hold remain unapproved as formal final criteria. 43.632s MP3 encoder padding is not identical to 43.562s PCM. The existing source verifier is not currently wired into a trusted render path. Source-adapter verification does not authorize changing original A/B.

Final: research `PROGRESS`; MVP10-A `INCOMPLETE`; B `NOT_ELIGIBLE`; plan_changed `NO`; main unchanged; YouTube/upload inactive; publication locks closed.
