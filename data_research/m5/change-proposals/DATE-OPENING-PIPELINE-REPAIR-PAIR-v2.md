# Date-scoped Official Market Opening Pipeline — paired A/B v2

**Status:** Owner-approved, frozen for versioned registration on remote `main`; Prompt A is not started in this documentation-registration turn.
**Project:** `daily-gainers-market-opening-end-to-end`
**Goal:** `goal-v3/MVP-10DAY-v1`
**Phase / round:** `MVP10-OPENING-PIPELINE-REPAIR-v2` / `R1`
**Proposal:** `data_research/m5/change-proposals/DATE-OPENING-PIPELINE-CHANGE-PROPOSAL-v2.md`
**Target date:** `20261104`
**Supersedes prospectively:** repair phase v1 Prompt A direction only. Phase v1's blocked history remains unchanged; original MVP10-A/B acceptance remains frozen and unchanged.
**Render / publication:** out of scope. No Render dispatch, YouTube upload, scheduling, publication, or release-lock changes.

## Frozen v2 contract shared by A and B

1. Before work, read repository-root `AGENTS.md`, `docs/agent-prompts/goal-anchored-handoff-v3.md`, `docs/agent-prompts/task-routing.json`, canonical handoff, task state, project philosophy/current phase, editorial policy, original `data_research/m5/change-proposals/DAILY-VIDEO-MVP-10DAY-PAIR-v1.md`, this proposal and this pair. Verify current remote `main` first. This is a new versioned phase; do not rewrite repair v1 or original MVP10 acceptance.
2. Reuse unchanged 20261104 official numeric Receipt, MI_INDEX, FMTQIK/market-chart, BFI82U/institutional data, five-day turnover inputs, Facts/News/AI/Summary and candidate by exact remote blob and embedded source SHA. Do not re-fetch or re-verify an unchanged PASS.
3. The opening completeness gate requires only the owner-approved official opening contract:
   - `market_opening_breadth.scope = "TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN"`, `source_date = target_date`, with independently traceable official MI_INDEX source manifest and SHA-256.
   - Same-date verified index close, prior close, change points and percentage; whole-market turnover; prior five trading sessions' turnover and arithmetic comparison; foreign, investment-trust and dealer net TWD values and their computed/verified total.
   - Top-level and per-field provenance records must include the exact source date, source name, official URL or repository path, unit/scope, SHA-256 and Receipt/run identity where applicable. SHA strings must be validated and must correspond to the actual source bytes/remote blobs under the existing receipt contract.
   - A `TWSE_COMMON_STOCK` breadth or historical security-master archive is **not required** for opening schema, opening PASS, or opening workflow. It may be stored separately as optional research only when already available. Do not spend this round locating or reconstructing a historical ordinary-stock archive.
4. Do not rename official MI_INDEX breadth as ordinary-stock breadth. Preserve the official scope name throughout schema, materializer, narration and QA.
5. Implement the date CLI `node scripts/validate_daily_gainers_market_opening.js 20261104` to resolve `data_daily_gain_over_5/market-opening-video/20261104.json` deterministically and fail closed for invalid/missing date, stale sources, hash or receipt mismatch, partial status, missing required value, bad units/scope, arithmetic mismatch, duplicate provenance, or incorrect target date. Opening completeness must not depend on a common-stock identity field.
6. Use `schema_version: 3` for the revised complete-opening contract. V1 and v2 snapshots remain historical and cannot PASS the v3 gate. The status is derived by the validator; never hand-set PASS.
7. Make the smallest aligned changes to the existing entry points:
   - `scripts/build_daily_gainers_market_opening_phase1.js`: official index/trading/institutional input assembly.
   - `scripts/merge_daily_gainers_market_opening_breadth.js`: merge the MI_INDEX official breadth without recoding its scope.
   - `scripts/validate_daily_gainers_market_opening.js`: v3 complete-opening contract and exact-date CLI.
   - `scripts/materialize_daily_gainers_dual_track.js`: consume only `market_opening_breadth` for official opening narration.
   - Related existing tests in `tests/daily_gainers_market_opening.test.js`, `tests/daily_gainers_dual_track.test.js`, `tests/merge_daily_gainers_market_opening_breadth.test.js` and existing phase1 fixtures/tests.
   Do not add or run the ordinary-stock security-master research/archive pipeline in this phase.
8. Run regression coverage for every required input and negative case: MI_INDEX official scope accepted; common-stock scope relabeling rejected as MI_INDEX; missing/stale/changed source SHA rejected; missing receipt rejected; invalid target date rejected; incomplete/partial opening rejected; prior-five-session denominator and ratio checked; institutional total checked; zero/negative values handled according to source semantics; same-date source paths and units enforced. Run the fixed existing command:
   ```sh
   node --test tests/daily_gainers_market_opening.test.js tests/daily_gainers_dual_track.test.js tests/build_twse_common_stock_breadth.test.js tests/merge_daily_gainers_market_opening_breadth.test.js
   ```
   Keep existing common-stock builder tests intact as historical/independent coverage; they are not a gate for the official opening output.
9. When the 20261104 opening and its required source receipts pass, run exact-date downstream gates:
   ```sh
   node scripts/materialize_daily_gainers_dual_track.js 20261104
   node scripts/validate_daily_gainers_video_script.js 20261104
   node scripts/validate_daily_gainers_news_narration.js 20261104
   ```
   If a downstream featured-stock eligibility validator explicitly blocks a specific symbol, record that validator and item as a separate blocker and continue the official opening pipeline. Do not bypass or lower that downstream gate.
10. Add `.github/workflows/build-daily-gainers-market-opening-video.yml` as a manual `workflow_dispatch` with a validated `target_date` input. It must run the same deterministic builders and validators, require the official receipt/source hashes, commit only validated date-scoped outputs with least-privilege `contents: write`, serialize writes with `cancel-in-progress: false`, be idempotent, and verify the expected remote path/blob after commit. Failure diagnostics may be artifacts but invalid official output must not be committed. No cron/push trigger, Render, YouTube/upload secrets, schedule or publication action.
11. Commit only the bounded v2 write set using an approved remote write method. Re-read current `main`; verify ancestry, all expected paths/blob SHAs/content, source manifest and validation output. Update canonical handoff and state with exact evidence. Do not promote MVP10-A, start Prompt B or automatically continue.

**Prompt A completion:** the reusable v3 official-opening builder, validator, regression tests and manual date workflow are durable and verified on remote main, and the 20261104 complete opening passes its official-opening validator. Run downstream materialize/script/news gates when their inputs exist and record each result, but a separately identified featured-stock eligibility failure must not block or relabel the official-opening phase. Prompt A remains incomplete only while an opening-pipeline criterion or required official opening input is unresolved; do not claim MVP10-A readiness from this phase alone.

## Prompt A — official opening pipeline implementation

Continue the `daily-gainers-market-opening-end-to-end` project in `EasonLiu0913/stock_data`.

Before work: read the repository-root `AGENTS.md`; then the canonical handoff `docs/handoffs/daily-gainers-market-opening-end-to-end.md`; then verify current remote `main`, this proposal, this pair and task state. Continue only `MVP10-OPENING-PIPELINE-REPAIR-v2` R1.

1. Recheck the 20261104 output path and source receipt identities. Reuse verified sources by exact blob/SHA; do not repeat the 44-stock studies or security-master history research.
2. Trace the missing opening backward through the known source receipt, MI_INDEX/FMTQIK/BFI82U inputs, phase1 builder, breadth merge, validator and materializer. Use the first real missing input or broken producer as the repair point.
3. Implement the official MI_INDEX breadth producer and complete opening builder from same-date verified data, using the exact official stock-column scope. Keep official scope and common-stock identity separate. Historical common-stock classification is explicitly outside this opening phase and must not be used to block it.
4. Align the v3 schema, validator CLI, merge and deterministic materializer. Preserve the editorial policy's required opening values and source-to-narration accuracy; compute five-session comparison and institutional total from verified inputs. Fail closed on incorrect/missing sources, dates, hashes, units and formulas.
5. Run the frozen regression command and any exact-date downstream gate whose inputs are available. Do not run Render.
6. Add and review the manual date-only workflow. Verify its input validation, least-privilege permissions, commit behavior, idempotency and final remote blob checks. Do not dispatch it in this round unless this phase's registered instructions expressly authorize; v2 does not authorize dispatch.
7. Commit bounded code/tests/workflow and date-specific verified outputs where evidence suffices. Fetch latest main and verify all expected files/blobs. Update handoff/task state with results and exact remaining dependencies. Stop; do not start Prompt B or promote MVP10-A.

If the official source receipt or source file is truly missing, do not launch a security-master research loop. Continue the reusable builder/workflow/tests that can be completed independently; leave only the target-date output pending on the specific source.

## Prompt B — independent closeout

Prompt B was frozen before A starts. Independently re-read latest remote `main`, root instructions, canonical handoff, state, this proposal/pair, original MVP10 pair, relevant source files, tests, workflow and exact output blobs. Do not rely on Prompt A's summary.

1. Confirm this is still the active project, goal and v2 repair phase; v1 remains historical blocked; original MVP10-A/B files and editorial policy are unchanged.
2. Audit the complete changed-file set against this proposal and frozen contract. The output scope must be limited to the reusable official-opening pipeline, its regression tests, workflow, date-scoped evidence, and required handoff/state checkpoint.
3. Independently verify the v3 opening uses `TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN`, has correct same-date index/turnover/five-session/institutional values and source SHA/Receipt provenance, and does not require or mislabel a common-stock master.
4. Re-run the exact regression command and validator CLI. Run downstream materialize/script/news gates when inputs exist and record their independent outcomes. A featured-stock eligibility issue is not an opening-pipeline failure; it remains a separate dependency for the later original MVP10-A if its frozen criteria require it. Confirm negative tests cover stale source/hash/receipt, scope relabeling, incomplete status and formula mismatch.
5. Inspect workflow triggers, permissions, inputs and side effects: manual date input only, least privilege, no Render/YouTube/upload/schedule/publish. Verify no prohibited workflow was triggered.
6. If every criterion passes, mark only v2 repair Prompt A/B complete, promote unchanged MVP10-A as next phase and stop for a fresh owner `promptA`. If a criterion fails, leave phase incomplete and repair only within this frozen v2 contract. Never run MVP10-A/B automatically.

**Prompt B PASS:** closes only this prerequisite pipeline phase. It does not complete the ultimate video goal, pass MVP10-A/B, authorize Render or alter publication locks.

## Stop conditions

Stop only the affected output if an actual official input, required permission or frozen downstream gate is absent. Record the exact path, source or validator and its effect. Continue independent builder, workflow, tests, AI candidate work or diagnostics allowed above. Do not invent a source, date, value, identity or PASS state. No self-triggered next turn.
