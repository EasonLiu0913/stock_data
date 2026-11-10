# MVP10-A Fish TTS Cross-Run Persistence — Frozen Prompt A/B Pair v2 (All Missing Scenes)

Phase revision: `MVP10-A-FISH-TTS-PERSISTENCE-R1-ALL-SCENES-V2`
Change proposal: `data_research/m5/change-proposals/MVP10-A-FISH-TTS-PERSISTENCE-CHANGE-PROPOSAL-v2.md`
Supersedes prospectively: only v1's maximum-three-scenes-per-invocation clause. Do not edit v1.
Canonical handoff: `docs/handoffs/daily-gainers-market-opening-end-to-end.md`
Owner decision: 2026-11-10 (Asia/Taipei)
Status: immutable pair preregistered in this change; Prompt A has not started. Do not execute A during registration. A requires a separate explicit `promptA` turn after merge.

This revision carries forward unfinished implementation work from v1 after independent verification. It does not reopen completed Fish timestamp migration R2 PASS, change Edge TTS persistence R1 FAILED, rewrite historic run outcomes, alter any non-TTS MVP10-A gate, or open the YouTube publication lock.

## Prompt A — implement all-missing-scenes recovery and complete the registered persistence work

Continue `daily-gainers-market-opening-end-to-end` in `EasonLiu0913/stock_data`.

Before work:
1. Read repository-root `AGENTS.md`, `docs/agent-prompts/goal-anchored-handoff-v3.md`, `docs/agent-prompts/task-routing.json`, and `docs/handoffs/daily-gainers-market-opening-end-to-end.md`.
2. Fetch and verify current remote `main`, active project/goal, this exact v2 proposal and pair, and the current v1/v2 phase state. Confirm v1 proposal/pair remain unchanged and v2 is merged before implementation. Do not rely on chat history.
3. Read `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, `docs/architecture/github-actions.md`, `docs/policies/daily-gainers-video-editorial-verification-delivery-v1.md`, applicable ADRs, and the exact TTS/Fish/Render scripts and validators.
4. Inspect run #19 / `42836332036`, the frozen plan, source gates, and remote checkpoint branch/blob recorded in this proposal. Reuse matching scenes 1–3; never synthesize them again. Recheck all date eligibility gates before any API request.
5. Preserve historical Edge run #11 / `42582831651` and its `NoAudioReceived` failure, Fish timestamp R2 PASS, and all prior A/B evidence.

Ordered work:
1. **Carry forward FIFO-selector repair.** Independently inspect branch `codex/fix-fish-tts-fifo-completed-date` against current main. Retain its completed-date validation behavior only if it satisfies the original v1 A/B criteria and current workflow contracts; otherwise diagnose the exact delta and make a minimal in-scope repair. Preserve date-pinned explicit dispatch behavior and fail closed for missing/invalid source gates.
2. **Remove the scene cap.** In `scripts/daily_gainers_tts_checkpoint.py`, make the plan command return all missing/invalid scenes in deterministic order, with no hard-coded/default limit or truncating slice. Update `.github/workflows/daily-gainers-tts-scene-recovery.yml` to enqueue that entire list. Do not change scene identity, Fish request semantics, date selection, or formal gates.
3. **Keep physical-runner safeguards.** Retain one matrix job per scene, `max-parallel: 1`, `fail-fast: false`, fresh runner, existing 15–35 second cooldown, one Fish request per scene attempt, and durable scene checkpoint before runner exit. If GitHub cannot represent the entire planned queue, fail before synthesis and report the precise count; never truncate or partially enqueue it.
4. **Durable reuse.** Re-plan from the frozen script and remote date checkpoint. Keep valid matching successes out of the queue; record/checkpoint each scene independently so a later scene failure cannot erase prior successful scenes. Keep all writes race-safe.
5. **Focused regression coverage.** Update `tests/test_daily_gainers_tts_checkpoint.py` to cover more than three missing scenes, complete deterministic queue enumeration, exclusion of valid matching successes, unchanged one-scene runner contract, serialized fresh runners, fail-fast false, and no truncation. Preserve existing identity/hash/fail-closed coverage. Do not weaken tests.
6. **Review/merge.** Open a scope-limited PR with the proposal/pair/handoff registration and implementation, preserve base/main failures separately, run required checks, fix in-scope defects, and merge only after required checks pass under repository policy. Do not lower gates.
7. **One bounded live recovery.** Only after the code is on main and the exact date's source/script/Fish gates pass, use the registered TTS-only dispatch path if authorized and available. For date `20261104`, expect the 14 currently missing scenes (4–17) only if the remote plan/checkpoint is still identical; re-resolve from evidence immediately before dispatch. Verify run event/head SHA/date, every scene job/log/result, and date-branch commit/blob. Never call Fish for matching successes.
8. **Natural schedule acceptance.** If the carried-forward original v1 closeout requires a natural `schedule` event for FIFO selector proof, wait for and inspect that event; a manual dispatch, job rerun, or Codex Automation turn cannot substitute. Do not infer that missed cron ticks ran.
9. **Complete-audio and Render-only.** Require the unchanged complete-audio validator to pass on exact date/script/checkpoint. Only then, and only with the registered date-scoped Render authorization, run Render-only once. Verify it consumes the same frozen plan/checkpoint with no TTS call/fallback; inspect real MP4, SRT, burned subtitle proof, QA, thumbnail, provenance and durable artifacts against existing MVP10-A gates.
10. **Checkpoint.** Update this canonical handoff with before/after main SHA, proposal/pair/PR/merge identity, selector evidence, run/job IDs, scene outcomes and checkpoint blob/commit, Render artifact evidence and remaining goal phases. Report Prompt A complete only when its full criteria pass. Stop for a separate Prompt B turn.

Hard stops: no YouTube upload/scheduling/public release, Pages, unrelated workflow dispatch, release-lock change, checkpoint deletion, force push, changed-date speculation, or Fish call before formal gates pass. A PRIVATE artifact cannot replace formal Render evidence.

## Prompt B — independent closeout, preregistered before A

Run only after Prompt A reports complete. Fetch current main and independently verify:

1. Project/goal and v2 phase/pair identity are current; v1 proposal/pair bytes are unchanged; v2 changes only the invocation queue cap. Edge R1 failure, Fish R2 PASS, prior run IDs and earlier frozen acceptance remain intact.
2. Selector repair is on current main and satisfies its carried-forward v1 criteria: completed dates are skipped only with a valid exact-date frozen plan/checkpoint; earliest incomplete valid date is selected; explicit requested date stays pinned. Verify at least one required natural schedule event if the original frozen criteria require it.
3. The planner and workflow enumerate **all** missing/invalid scene IDs for the selected date in deterministic order, without a three-scene or other local numeric cap, and without including any matching success. Queue count equals the independently derived missing/invalid set.
4. The complete queue is enqueued in one invocation; `max-parallel: 1`, `fail-fast: false`, one fresh runner per scene, cooldown and one request per attempt are intact. A job failure does not cancel siblings or lose previously committed scenes. If a GitHub platform queue limit is reached, it fails before any synthesis rather than truncating.
5. Run/job/log evidence identifies the target date, source/script/Fish identity, exact queue, each result and run head SHA. Remote checkpoint branch/commit and manifest/blob provide exact ordered coverage; MP3 and WordBoundary hashes/fingerprints validate. Matching successes (including scenes 1–3 when still identical) have zero Fish requests.
6. A later separate invocation proves cross-run reuse for exact same date/script identity and touches only still missing/invalid scenes. Do not call matching successes.
7. Complete-audio validator passes; the Render-only run validates and consumes the same plan/checkpoint before rendering, with no Fish/Edge API or fallback. Actual MP4, SRT, subtitle coverage/alignment, burned-caption proof, QA, thumbnail, provenance, hashes and durable artifacts meet unchanged MVP10-A acceptance.
8. Required regression/CI checks pass; changed-file scope is limited to this versioned queue change and carried-forward selector repair. Base/main failures are documented separately, never relabeled. No YouTube/Pages/upload/release-lock/checkpoint deletion/unapproved Render side effect occurred.
9. Canonical handoff and Task State on current main report exact evidence, completed/remaining phases, ultimate goal still incomplete unless every formal gate is actually satisfied.

If any criterion fails, preserve original results and repair only under this same v2 acceptance, then perform one bounded validation on changed code/input. Diagnose any new failure from its own logs. Never rewrite a historical FAIL, retroactively weaken v1, or auto-promote a phase.

After PASS, update the canonical handoff/Task State on main with exact evidence and stop. Do not start another phase without a separately preregistered owner-promoted pair.
