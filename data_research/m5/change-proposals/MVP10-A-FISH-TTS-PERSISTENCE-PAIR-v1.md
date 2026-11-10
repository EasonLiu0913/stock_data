# MVP10-A Fish TTS Cross-Run Persistence — Frozen Prompt A/B Pair v1

Phase ID: `MVP10-A-FISH-TTS-PERSISTENCE-R1`
Change proposal: `data_research/m5/change-proposals/MVP10-A-FISH-TTS-PERSISTENCE-CHANGE-PROPOSAL-v1.md`
Canonical handoff: `docs/handoffs/daily-gainers-market-opening-end-to-end.md`
Owner-selected objective: 2026-11-10 (Asia/Taipei)
Status: pre-registered with the approved objective and frozen criteria; Prompt A has not started. Never execute A automatically on registration.

This new phase follows Fish timestamp migration R2 PASS. It does not reopen or rewrite the failed Edge TTS persistence R1, Fish migration R2, prior A/B criteria, or any historical result. It preserves all non-TTS MVP10-A acceptance criteria and the YouTube publication lock.

## Prompt A — implement and produce durable evidence

Continue `daily-gainers-market-opening-end-to-end` in `EasonLiu0913/stock_data`.

Before any work:
1. Read repository-root `AGENTS.md`, `docs/agent-prompts/goal-anchored-handoff-v3.md`, `docs/agent-prompts/task-routing.json`, and canonical handoff `docs/handoffs/daily-gainers-market-opening-end-to-end.md`.
2. Verify current remote `main`, active project/goal, phase state, this exact proposal/pair, prior Fish R2 PASS, provider migration R1 failures, and current workflow definitions. Do not rely on chat history.
3. Read `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, `docs/architecture/github-actions.md`, `docs/policies/daily-gainers-video-editorial-verification-delivery-v1.md`, applicable ADRs, and relevant Fish/TTS research before substantial changes.
4. Preserve the original Edge failure IDs and R1/R2 evidence. Do not rerun any unchanged failed request and do not dispatch the old Edge-based `[08 TTS]` recovery workflow.

Objective: implement the frozen acceptance in `MVP10-A-FISH-TTS-PERSISTENCE-CHANGE-PROPOSAL-v1.md` so verified Fish MP3/WordBoundary scenes persist across Actions runs, only missing/invalid scenes are requested, and date-scoped Render-only consumes the exact checkpoint.

Ordered work:
1. **Fresh-main FIFO preflight.** Determine the earliest valid TWSE date whose official source, script, news, editorial, and other frozen TTS input gates are actually PASS. Reuse durable same-identity evidence. Do not infer holidays/source-empty or skip an earlier unresolved date. If no date is eligible, record the exact first failing gate and stop `WAITING_SOURCE`; do not call Fish.
2. **Bounded implementation.** Adapt the verified Fish timestamp path into the date-scoped scene synthesis/recovery interface. Pin `fish.audio`, `/v1/tts/stream/with-timestamp`, model `s2.1-pro-free`, reference `e7af89da8abc4fbdacd9a10ab9881933`, speed `1.15`, MP3, timestamp schema, and pipeline version. Keep one request per scene attempt and preserve the R2 diagnostic distinctions and SRT precision guard.
3. **Durability and idempotency.** Implement the exact scene fingerprint and date branch `tts-audio-pending-YYYYMMDD`; write a successful scene's MP3, WordBoundary, hashes, manifest and run identity before runner exit. Re-plan from latest main/checkpoint. Cap each invocation at 3 missing/invalid scenes; one fresh runner per scene; max-parallel 1; deterministic order; conservative pacing; non-canceling write concurrency. Never regenerate a fingerprint-matching success.
4. **Render-only.** Update `.github/workflows/daily-gainers-date-render-only.yml` to restore the exact date checkpoint and validate full coverage/identity/hashes before any render action. Fail closed on mismatch. Remove any TTS synthesis fallback from the Render-only path.
5. **Focused regressions.** Test Fish request identity, chunk concatenation/latest-wins timestamp snapshots, all timestamp failure classes and zero-duration preservation; fingerprint invalidation; partial checkpoint resume; matching-success reuse without API calls; maximum-three queue; fresh-runner/max-parallel workflow contract; corrupt/missing/hash-mismatch fail-closed; no Fish/Edge call in Render-only; and SRT positive monotonic serialization.
6. **Review and merge.** Open a PR containing only the registered scope, preserve main-base failures separately, run all relevant required checks, fix in-scope defects, then merge only when all required checks pass. Never lower any gate.
7. **Single bounded live recovery.** Only after changed code is merged and the exact eligible date gates pass, use the registered Fish TTS-only `workflow_dispatch` path. Each invocation is capped as above. Inspect run/job/log and remote checkpoint branch commit/blob per scene. Successful scenes are durable immediately. If a known error recurs on unchanged code/input, diagnose it; do not blind-rerun.
8. **Prove cross-run reuse.** On a later separate invocation for the same date/script identity, verify matching successes are reused without Fish requests. Continue only for distinct missing scenes, up to the same per-invocation cap. When exact coverage is complete, run the registered date-scoped Render-only once only if all existing MVP10-A gates pass. Verify actual MP4, SRT, QA, subtitle coverage, thumbnail, provenance, and durable artifacts.
9. **Checkpoint before closeout.** Update the canonical handoff and Task State with before/after SHA, PR/merge commit, all relevant run/job IDs, per-scene hashes/fingerprints, artifact IDs/expiry, Render evidence and remaining phases. Stop and report `Prompt A complete — ready for Prompt B` only if its full contract passes. Do not run B in the same turn.

Hard stops: no YouTube, upload orchestrator, publication scheduling, public release, Pages, release-lock changes, audio cleanup, force push, acceptance change, changed-date speculation, or production dispatch before the gates above pass. A private test artifact is not a production deliverable.

## Prompt B — independent closeout, pre-registered before A

Run only after Prompt A reports complete. Re-fetch current main and independently verify:

1. Proposal/pair identity, active phase and latest main; all historic Edge R1 and Fish R2 records remain unchanged; no frozen A/B criterion outside this prospective proposal was weakened.
2. Frozen date/script source gates passed before each live request. Exact model/reference/speed/endpoint/format and fingerprint match the frozen plan.
3. Every scene request count obeyed max three per invocation, one request per scene attempt, fresh runner per scene, max-parallel one and pacing; a failure did not discard earlier successful checkpoints.
4. Durable date checkpoint branch/commit and every MP3/WordBoundary/hash/manifest have exact scene coverage/order and matching text/provider fingerprints; successful scenes are reused in a later run with zero Fish requests for those scenes. Only still-missing/invalid scenes were requested.
5. Complete-audio validator passes and exact Render-only input is the same frozen date/script/checkpoint. Render-only validates and consumes these files without any Fish/Edge synthesis call or fallback.
6. Actual Render-only MP4, SRT, subtitle coverage/alignment, QA, thumbnail, provenance and durable artifacts meet the unchanged MVP10-A criteria. Do not substitute a PRIVATE-only preview for the formal output.
7. Required focused tests, PR checks and workflow trigger/permission safety pass. No YouTube, Pages, upload, schedule, release-lock, cleanup, or unrelated workflow side effect occurred.
8. Verify durable handoff and Task State on current main identify the exact phase, PR/merge SHA, run/job/artifact/blob identities and next stop. Overall video delivery may be declared complete only if the full frozen goal is actually satisfied.

If any item fails, preserve original runs and boundedly repair only within this proposal and these same criteria. Revalidate changed code/input once; for a new failure, diagnose its new logs before any further run. Never rewrite historical FAIL or auto-promote a new phase.

After PASS, update the canonical handoff/Task State in the same development cycle and stop. Do not create or start another phase unless it is separately preregistered and owner-promoted.