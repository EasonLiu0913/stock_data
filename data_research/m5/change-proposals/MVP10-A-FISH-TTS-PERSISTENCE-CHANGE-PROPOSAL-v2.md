# CHANGE PROPOSAL — Fish TTS Cross-Run Persistence v2: All Missing Scenes Per Invocation

Status: OWNER-AUTHORIZED VERSIONED CHANGE; this proposal and its paired criteria are preregistered on this branch. Prompt A has not started under v2 and requires a separate explicit `promptA` turn after this registration is merged.
Project: `daily-gainers-market-opening-end-to-end`
Goal version: `goal-v3/MVP-10DAY-v1`
Phase revision: `MVP10-A-FISH-TTS-PERSISTENCE-R1-ALL-SCENES-V2`
Supersedes prospectively: only the per-invocation maximum-three-scenes clause in proposal/pair v1.
Preserves: proposal/pair v1 blobs, all prior A/B results, the in-progress FIFO-selector repair, Fish migration R2 PASS, Edge persistence R1 FAILED, and all non-TTS MVP10-A gates.
Base main: `28fb0f8084199d15ba846d04045c16032db92532`
Owner decision date: 2026-11-10 (Asia/Taipei)

## Owner-selected change

For each eligible target date, one [08 TTS] recovery invocation must enqueue **every missing or identity/hash-invalid scene** from that date's frozen plan. Remove the application-level three-scene-per-invocation cap. Keep deterministic scene order, `max-parallel: 1`, one fresh runner per scene, one Fish request per scene attempt, conservative 15–35 second cooldown, and durable per-scene checkpoint commits. Matching successful scenes remain excluded and must never be synthesized again.

“All scenes” means all currently missing or invalid scene IDs in the selected frozen date, not all scenes unconditionally. The workflow must not truncate the queue. If a queue exceeds a GitHub platform limit, fail visibly before synthesis with the exact queue size; do not silently split, drop IDs, or introduce a lower local cap.

## Evidence and reason

- Run [#19 / 42836332036](https://github.com/EasonLiu0913/stock_data/actions/runs/42836332036) completed `success` on `workflow_dispatch`, head `234b46f1f66924a081a8b5c62bc3793e9f265d2a`.
- It started for target date `20261104` and ran exactly three synthesis jobs (scenes 1–3).
- Remote checkpoint branch `tts-audio-pending-20261104`, commit `17e69d0a5d96b6a831f50e28bf4284a505909b7e`, contains manifest blob `67ba38b7b3b607524e9bb053e66b22e190dd064c`: 17 ordered scenes, 1–3 successful, 4–17 pending. Thus 14 missing scenes remain after this successful run.
- This change is based on the observed queue cap, not an inference that the workflow malfunctioned. Run #19 remains a dispatch event; it is not evidence of a natural schedule event.

## Frozen v2 acceptance

All v1 acceptance remains in force except the explicit maximum-three-scenes-per-invocation requirement, which is replaced by:

1. The planner returns the complete deterministic list of all missing or identity/hash-invalid scene IDs for the selected date. It excludes every matching successful checkpoint and applies no per-invocation numeric cap.
2. The single recovery invocation enqueues the full returned list. The workflow fails visibly before any Fish call if platform constraints cannot represent the complete queue; it never truncates the list.
3. The matrix remains `max-parallel: 1`, `fail-fast: false`, and one fresh runner per scene. Each scene has at most one Fish request per attempt, the existing conservative cooldown, and commits its MP3, WordBoundary, hashes, identity and manifest before its runner exits. A failing scene does not cancel other queued scenes or discard earlier successful checkpoints.
4. Matching scenes are not requested again. Replanning/checkpoint writes remain race-safe and preserve already-valid scene data.
5. Existing source/date/script gates, FIFO selection, Fish model/endpoint/reference/rate/output identity, timeline/WordBoundary rules, complete-audio validator, read-only Render-only contract, Render QA/artifacts, and publication lock are unchanged.
6. Cross-run proof still requires a later invocation for the same frozen date/script to reuse matching successes with zero Fish requests for those scenes and work only on remaining missing/invalid scenes. Existing frozen natural-schedule evidence, where required, cannot be replaced by dispatch or job rerun.
7. No YouTube, upload, publication scheduling, Pages, release-lock change, checkpoint deletion, or unapproved Render action.

The current date `20261104` has 14 pending scenes in the recorded checkpoint. It is eligible for more synthesis only after the current formal source/script gates and the merged v2 implementation are rechecked. Do not rerun scenes 1–3.

## Version boundary

This is an owner-approved acceptance revision, not a retroactive edit to v1. Keep v1 proposal/pair bytes and all historic results unchanged. Carry forward the unfinished v1 FIFO-selector repair from branch `codex/fix-fish-tts-fifo-completed-date` only after independently verifying its diff and current remote state; do not overwrite or lose that work. The first v2 Prompt A must start from fresh main after registration merge, use the exact paired v2 criteria, and reuse valid checkpoint successes.

Canonical paired prompts: `data_research/m5/change-proposals/MVP10-A-FISH-TTS-PERSISTENCE-PAIR-v2.md`.

Owner authorization: “登記一下版本化變更，改成全部場景。” This authorizes this versioned prospective criterion and its registration; it does not authorize skipping required checks or starting Prompt A in the same registration turn.
