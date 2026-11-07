# Date-scoped Market Opening and Eligible Universe Repair — paired A/B v1

**Status:** Owner-approved, frozen for documentation-only registration on remote `main`; not executable until the registration commit is verified.  
**Project:** `daily-gainers-market-opening-end-to-end`  
**Goal:** `goal-v3/MVP-10DAY-v1`  
**Phase / round:** `MVP10-OPENING-ELIGIBILITY-REPAIR-v1` / `R1`  
**Change proposal:** `data_research/m5/change-proposals/DATE-OPENING-ELIGIBILITY-CHANGE-PROPOSAL-v1.md`  
**Target date:** `20261104`  
**Predecessor:** none; this phase is the prerequisite to unchanged `MVP10-A`.  
**Render / publication:** out of scope. YouTube upload, scheduling, public release and release-lock changes are forbidden.

## Frozen contract shared by A and B

1. Read repository-root `AGENTS.md`, `docs/agent-prompts/goal-anchored-handoff-v3.md`, `docs/agent-prompts/task-routing.json`, the canonical handoff, project philosophy/current phase, the editorial policy, the original `data_research/m5/change-proposals/DAILY-VIDEO-MVP-10DAY-PAIR-v1.md`, this CHANGE_PROPOSAL and this pair. Always verify latest remote `main` first.
2. Do not change the active project, goal, global editorial policy, raw 5% source list, original MVP10-A/B file or acceptance, original release locks, or YouTube settings. This pair adds a prerequisite phase only. Do not run Render-only.
3. Reuse 20261104 official numeric receipt, MI_INDEX, Facts, News, AI v3 research, Summary and candidate only while their source identity/blob/SHA remains identical. Do not rerun verified research to reset state.
4. Keep both breadth contracts as separate v2 snapshot fields:
   - `snapshot.breadth.scope = "TWSE_COMMON_STOCK"`: date-effective classified ordinary-stock universe; preserve `advancers`, `decliners`, `unchanged`, `eligible_count`, `gainers_5pct_count`, `no_trade_count`, `no_comparison_count`, `excluded_non_common_count`, `identities`, and its source manifest. Its denominator is `advancers + decliners + unchanged + no_trade_count + no_comparison_count = eligible_count`.
   - `snapshot.market_opening_breadth.scope = "TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN"`: official MI_INDEX stock-column counts (`advancers`, `decliners`, `unchanged`, `limit_up`, `limit_down`, `no_trade`, `no_comparison`), target `source_date`, and independent source manifest.
   - The opening validator validates both fields separately. The dual-track materializer reads only `market_opening_breadth` for the deterministic opening. Do not rename, merge, or substitute scopes.
5. A complete snapshot uses `schema_version: 2`; schema-v1 snapshots remain historical evidence and cannot pass the new complete-opening gate. The validator CLI command is `node scripts/validate_daily_gainers_market_opening.js 20261104`; A must implement deterministic path resolution for `data_daily_gain_over_5/market-opening-video/20261104.json` and fail closed on invalid dates, missing files, stale source dates, invalid hashes, partial status, missing fields, scope mismatch, unverified identities, arithmetic mismatch, or duplicate codes.
6. Run the fixed regression command:

   ```sh
   node --test tests/daily_gainers_market_opening.test.js tests/daily_gainers_dual_track.test.js tests/build_twse_common_stock_breadth.test.js tests/merge_daily_gainers_market_opening_breadth.test.js
   ```

   Required cases: both breadth scopes independently pass; either scope swapped/relabelled fails; missing or stale source manifest fails; date mismatch fails; common-stock `no_comparison_count` is counted exactly once; no-trade and no-comparison are distinct; non-common and unresolved identity handling fails closed; incomplete/partial opening cannot pass; duplicate identities fail; date/5% arithmetic and source hashes are checked.
7. When all required inputs exist, run the downstream gates with exact date:

   ```sh
   node scripts/materialize_daily_gainers_dual_track.js 20261104
   node scripts/validate_daily_gainers_video_script.js 20261104
   node scripts/validate_daily_gainers_news_narration.js 20261104
   ```

   A missing input or validator failure remains a blocker; never skip or lower it. These gates do not authorize rendering.
8. Persist only the approved paths. Verify the resulting commit and every required file/blob on current remote `main`, then independently fetch the file contents and check date, schema, source identities and validator results. A local write or workflow green is not durable completion.

## Prompt A — implementation

You are implementing only `MVP10-OPENING-ELIGIBILITY-REPAIR-v1`, round `R1`.

1. Confirm the current remote `main` contains this immutable pair, the owner-approved CHANGE_PROPOSAL, the canonical handoff update and task state. Confirm this phase is active/promoted and `MVP10-A` is pending behind it. If any registration artifact is absent/stale or the original MVP10 pair changed, stop before implementation.
2. Reverify 20261104 inputs by exact remote blobs and embedded source SHA. Reuse matching evidence. Locate the first invalid/missing dependency in the approved data flow; do not re-fetch unchanged sources or repeat the 44 verified stock studies.
3. Verify the date-effective TWSE security-classification source and archive provenance for every 20261104 source-list code. Preserve the original list. If history cannot be proven for a symbol, mark that symbol unresolved and keep only dependent eligibility/coverage gates blocked; do not invent a master, infer from ticker/name, or mark it verified.
4. Make the smallest authorized changes to the breadth schema, opening validator, deterministic materializer and existing regression tests so the exact dual-field v2 contract above is implemented. Verify on latest remote blobs before editing. Correct the demonstrated no-comparison denominator defect without removing or recoding rows.
5. Build a deterministic complete 20261104 opening from verified same-date MI_INDEX, market-chart/FMTQIK, institutional and five-day-turnover evidence. Preserve source receipt/hash identity. Generate both breadth fields through their correct independent procedures. Never edit the raw 5% list or hand-set status.
6. Produce `data_daily_gain_over_5/verification/video-eligible-universe/20261104.json`, covering every code in the immutable input list with date-effective type, evidence reference, archive SHA256, eligibility result and reason. Keep unresolved identities unresolved. Do not state that this derived record changes the source list.
7. Write `data_daily_gain_over_5/market-opening-video/20261104.json` using schema v2 only after every required source gate passes. Run the snapshot validator CLI and fixed regression command. Record exact output and source identities.
8. Run the fixed downstream materializer/script/news commands only if all inputs they require are present. Do not render. Do not run a YouTube workflow or change any publication setting.
9. Add `.github/workflows/build-daily-gainers-market-opening-video.yml`; no complete date-scoped opening builder/persistence workflow exists at baseline. It accepts only a validated `target_date` via `workflow_dispatch`, runs the frozen builders/validators, and commits only validated date-scoped artifacts with minimal `contents: write`, concurrency `cancel-in-progress: false`, idempotent behavior, and final remote path/blob verification. Include failure diagnostics as a run artifact without committing invalid official outputs. No cron/push trigger, Render, YouTube/upload secrets, schedule, or public-release action. Do not dispatch any workflow during the documentation-registration turn.
10. Commit the bounded authorized change and required outputs using the approved remote write method. Fetch latest `main` again; verify commit ancestry, paths, blob SHAs, content, source manifest and logs. Update the canonical handoff and task state with exact results, blockers and next action. Do not promote `MVP10-A` or automatically continue.

**Prompt A completion:** all repair outputs and regression/downstream gates required by this contract are durable and verified on remote `main`, or the phase is checkpointed as blocked with exact evidence/dependency and remains incomplete. Render and all YouTube actions remain unperformed.

## Prompt B — independent closeout

Prompt B is frozen before A starts. It independently verifies the original criteria above; do not rely on A's summary.

1. Re-read latest remote `main`, AGENTS, handoff, state file, proposal, this pair, original MVP10 pair, relevant changed files, all run/job/log evidence and remote blobs. Confirm this is still the single active project and repair phase; no later concurrent change invalidates evidence.
2. Verify the A/B registration preceded A and that owner-approved fields/scope match the immutable proposal. Compare the original MVP10 pair and global editorial policy against their preregistered blobs; they must be unchanged.
3. Audit the complete changed-file set against the authorized write set. Verify each required 20261104 output exists on current `main`, exact target date/schema, source hashes/URLs/units, per-field breadth scope, archive provenance, manifest references and commit identity.
4. Independently verify the 5% input list has not changed. For every code, validate date-effective security type, evidence and archive SHA. Ensure unknown is not coerced to common stock, non-common instruments are not silently deleted from source data, and the MVP eligible featured set includes only evidence-qualified ordinary stocks.
5. Re-run the snapshot CLI and exact regression command from the frozen pair; check captured output and negative cases. Re-run downstream materialization/script/news gates if their inputs exist. Confirm `breadth` and `market_opening_breadth` are separate and no-comparison accounting is correct. A partial opening, one passing validator, or green workflow is not a complete phase PASS.
6. Inspect any new workflow's triggers, permissions, environment, job steps and side effects. It must be manual date-input only, least privilege, no Render/upload/schedule/publish. Verify no such prohibited action was triggered in this phase.
7. If all criteria pass, mark only this repair phase A/B complete and promote the already-approved unchanged `MVP10-A` as the next phase; stop and wait for a fresh owner `promptA`. Never run MVP10-A or B automatically. If any criterion fails or evidence is absent, mark repair incomplete/blocked, make no promotion, and prescribe only a bounded correction under this same frozen pair.

**Prompt B PASS:** closes only this prerequisite repair phase. It does not complete the ultimate video goal, pass MVP10-A/B, authorize Render/YouTube, or change release locks.

## Stop conditions

Stop affected work when date-effective official classification/source provenance cannot be established, an official receipt or SHA mismatches, the chosen field design conflicts with frozen policy, an unauthorized write/permission is required, or any safety side effect is uncertain. Record precise evidence and continue only independent work allowed by the original frozen Prompt A. No self-triggered next turn.
