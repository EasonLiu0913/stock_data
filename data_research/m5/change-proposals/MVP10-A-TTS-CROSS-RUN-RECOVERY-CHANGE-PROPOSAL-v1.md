# MVP10-A TTS Cross-Run Recovery — Change Proposal v1

Status: OWNER-AUTHORIZED PLAN / PREREGISTERED IMPLEMENTATION ROUND
Owner decision: 2026-11-08 — stop retrying MVP10-A-R2 Prompt A as the current execution path and start a versioned TTS recovery plan.
Canonical project handoff: docs/handoffs/daily-gainers-market-opening-end-to-end.md
Phase ID: MVP10-A-TTS-PERSISTENCE-R1

## Why this change is needed

MVP10-A-R2 is still WAITING_TTS. Its Render-only run 42472929875 reached the real YunJhe +15% TTS step, then failed with NoAudioReceived; rendering, SRT, MP4, QA, and thumbnail steps did not run.

The request-shape diagnostics 42481331662 and 42488724106 show intermittent provider success, not a reliable request-count threshold or complete production recovery. One experiment produced a combined audio file; the other did not. Both ten-output variants had failures. Those experiment results must not be treated as production audio.

The current production script writes per-scene MP3 and WordBoundary checkpoints on the Runner. The Render-only workflow does not restore those files on a later workflow run. Its end-of-run artifact is temporary and is not a durable scene checkpoint. A failed run therefore cannot reliably resume from previously successful scenes.

## Owner-approved objective

Replace the repeated whole-render TTS attempt with an idempotent, scene-level recovery path that preserves each verified successful MP3 and WordBoundary across workflow runs, retries only missing or invalid scenes, and lets Render-only consume the completed checkpoint. Preserve all non-TTS MVP10-A gates and acceptance criteria.

The 20261104 script must be stored durably in a non-upload-monitored repository path before TTS begins. Do not write it to video_scripts/daily-gainers/, whose push trigger belongs to the upload orchestrator.

## Bounded design

1. Store the validated, date-specific final narration JSON and text manifest on main under research_pending/daily-gainers-render-scripts/ and research_pending/daily-gainers-tts/. Bind them to the source main commit, final script SHA-256, scene IDs/order, normalized text SHA-256 per scene, voice, rate, pinned TTS client version, and pipeline version.
2. Store MP3 and WordBoundary checkpoints on a date-scoped branch named tts-audio-pending-YYYYMMDD. Each successful scene is validated and committed immediately with its audio SHA-256, byte size, scene fingerprint, generation run, and boundary data. Never store audio on main.
3. Run a scheduled and manually dispatchable TTS-only recovery workflow. Process a deterministic queue of missing scenes, with at most three scenes per invocation and one scene per fresh Runner job. Use max-parallel 1, randomized request/batch pacing, non-canceling date-level concurrency, bounded attempts, and a checkpoint after each success. A failure does not discard earlier scene checkpoints.
4. At the next invocation, re-read the current source and checkpoint branch. Reuse only scenes whose text, voice, rate, TTS version, audio hash, and WordBoundary validate. Retry only missing, failed, corrupt, expired-by-contract, or fingerprint-mismatched scenes. Any script/voice/rate/pipeline change invalidates only the affected scene fingerprints; source drift must be explicit.
5. The complete-audio validator must require exact scene coverage and order, valid nonempty MP3s, matching hashes, and valid WordBoundary data before returning PASS.
6. Update the date-scoped Render-only workflow to require and restore the complete checkpoint branch and verify it against the frozen script. It must fail closed before rendering if any scene is missing or mismatched. It must not call Edge TTS or synthesize replacements.
7. Keep an auditable text-only status/manifest on main after upload. Audio cleanup is allowed only after a verified upload receipt matches the date, final script SHA, and completed audio manifest. This phase must not trigger YouTube, alter upload scheduling, or change the release lock; cleanup code may be tested with a fixture but must not be invoked against a real upload.
8. Use no external storage credentials. The checkpoint branch is public repository storage for MP3s that are intended for the public video. Delete the date checkpoint branch after a verified upload receipt. Document that deleting a branch removes its live ref but does not rewrite Git history or promise immediate platform garbage collection. Do not force-push or rewrite history.
9. Preserve the existing TWSE source, opening, stock eligibility, news, narration, subtitle, Dashboard, VTuber, thumbnail, visual QA, and delivery gates. Do not re-research verified inputs. Do not promote MVP10-A-R2 or alter its historical evidence.

## Scope boundary

This is a versioned blocker-repair phase for TTS persistence and its Render-only consumer. It is not a TTS request-count experiment, not a new editorial policy, not permission to upload or publish, and not a replacement for the original MVP10-A quality requirements. The parent MVP10-A-R2 remains NOT PASS and is preserved as WAITING_TTS / OWNER-SUPERSEDED for execution history.

## Frozen Prompt A / Prompt B

The exact paired acceptance contract is in:
data_research/m5/change-proposals/MVP10-A-TTS-CROSS-RUN-RECOVERY-PAIR-v1.md

Prompt A must be executed only after this proposal and pair are committed. Prompt B is a separate owner-invoked closeout. Neither phase may trigger YouTube actions or claim the project complete without all frozen visual and render gates.
