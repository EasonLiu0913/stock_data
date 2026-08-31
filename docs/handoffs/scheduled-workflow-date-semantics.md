# Scheduled Workflow Date Semantics Migration

Canonical handoff: `docs/handoffs/scheduled-workflow-date-semantics.md`

## Current phase

Research / repo-wide audit is complete and frozen at `main` commit `026d34c66fe23adfdfbf0bab322242c2b3480469`. The next phase is bounded migration design and implementation for the first high-risk scheduled workflows whose target business date is still derived from actual runner start time.

## Objective

Make scheduled collection dates delay-safe without forcing one universal business-date rule onto heterogeneous data sources.

The target architecture has two layers:

1. **Scheduled occurrence resolution** — derive the logical occurrence date/time from the cron expression that triggered the run, not the delayed runner start time.
2. **Collection-date policy** — map that logical occurrence to the workflow's business date semantics (`same_trade_date`, `next_trade_date`, source-derived date, latest-complete repository date, etc.).

Do not use the audit taxonomy D1-D7 as production policy names. D1-D7 describe current mechanisms only.

## Frozen decisions / constraints

- Audit inventory is frozen against `main` commit `026d34c66fe23adfdfbf0bab322242c2b3480469` unless current `main` materially changes a relevant workflow.
- The repo-wide audit found 37 workflows with `on.schedule` at the frozen commit.
- Do not apply one global rule such as `TARGET_DATE = scheduled Taipei date` to every workflow.
- Do not derive scheduled business dates from actual runner start time when the workflow's intended semantics are tied to the original scheduled occurrence.
- Manual `workflow_dispatch` explicit dates remain authoritative and must continue to work.
- Source/API-derived workflows (for example TDCC or source timestamp datasets) must remain source-derived where that is the canonical business date.
- Repository/latest-complete-data workflows (prediction/replay) must remain repository-driven and must not be converted to runner-clock semantics.
- Never silently fall back to an older trading day unless the workflow's explicit collection-date policy allows that behavior.
- Preserve current crawler behavior and output paths; the first migration is about date resolution, not crawler rewrites.
- Follow `AGENTS.md`: evidence before abstraction, exact known entry-point paths in handoffs/prompts, paired Prompt A + Prompt B preregistration, and durable remote verification before phase closeout.

## Completed

Repo-wide scheduled-workflow audit completed. Key current-mechanism findings:

### High-risk first migration group

- `.github/workflows/crawl-twse-mi-index.yml` — D2, actual runner Taipei time minus 3h; desired `same_trade_date`.
- `.github/workflows/crawl-twse-institutional-investors.yml` — D2, actual runner Taipei time minus 3h; desired `same_trade_date`.
- `.github/workflows/crawl-twse-margin-balance.yml` — D2, actual runner Taipei time minus 3h; desired `same_trade_date`.
- `.github/workflows/crawl-fubon-broker-details.yml` — D2, actual runner Taipei time minus 8h; desired explicit scheduled business-date policy.
- `.github/workflows/crawl-fubon-brokers-trade.yml` — D2, actual runner Taipei time minus 8h; desired explicit scheduled business-date policy.
- `.github/workflows/crawl-institutional.yml` — D2, runner-clock 14:00 cutoff; desired post-close same logical collection date.
- `.github/workflows/retry-institutional.yml` — D1, actual runner Taipei date; desired preserve the intended logical collection date.
- `.github/workflows/retry-sma.yml` — D1, actual runner Taipei date; desired preserve the intended logical collection date.
- `.github/workflows/crawl-twse-institutional-summaries.yml` — D1, actual runner Taipei date; desired `same_trade_date`.
- `.github/workflows/crawl-twse-twt49u.yml` — D4, actual runner Taipei date + trading calendar; desired `next_trade_date` from the logical scheduled date.

### Positive references / do not regress

- `.github/workflows/crawl-sma.yml`
- `scripts/resolve_scheduled_sma_target_date.js`

`crawl-sma.yml` already resolves scheduled runs from `${{ github.event.schedule }}` instead of runner start time and performs a separate source-readiness gate. This is the primary in-repo reference for delay-safe scheduled occurrence behavior.

- `.github/workflows/daily-stock-prediction.yml`
- `scripts/resolve_latest_complete_prediction_base.js`

Prediction target selection is latest-complete-repository-data driven and intentionally refuses stale fallback when the latest eligible base date is incomplete.

- `.github/workflows/daily-prediction-replay.yml`
- `scripts/resolve_prediction_replay_date.js`

Replay selects the newest SMA result date and requires matching V1/V2 manifests plus usable result-day prices; it does not silently fall back to an older result date.

- `.github/workflows/crawl-tdcc-shareholding-snapshot.yml`
- `scripts/crawl_tdcc_shareholding_snapshot.js`

TDCC uses source `observed_date` and separately preserves first `available_at`.

## Evidence / validation

Frozen audit base:

- `main`: `026d34c66fe23adfdfbf0bab322242c2b3480469`
- commit message: `data: refresh official constraints and apply strategy snapshot 20260831`

Representative audit evidence:

- `crawl-twse-mi-index.yml`, `crawl-twse-institutional-investors.yml`, `crawl-twse-margin-balance.yml`: runner Taipei clock with `-3h` magic offset.
- `crawl-fubon-broker-details.yml`, `crawl-fubon-brokers-trade.yml`: runner Taipei clock with `-8h` magic offset.
- `crawl-institutional.yml`: runner-clock 14:00 cutoff.
- `retry-institutional.yml`, `retry-sma.yml`: actual runner Taipei date.
- `crawl-twse-twt49u.yml`: actual runner Taipei date followed by trading-calendar next-date resolution.
- `crawl-sma.yml`: schedule-expression-based intended-date resolver.

Recent production symptom relevant to this migration: prediction base resolution correctly failed rather than using stale data when expected `20260828` inputs were absent, including:

- `data_twse_institutional_investors/20260828_twse_institutional_investors.json`
- `data_twse_mi_index/20260828_twse_mi_index.json`

The migration must reduce the chance that delayed scheduled collectors produce the wrong logical date while preserving the prediction safety gate.

## Current repository state

At checkpoint creation, current `main` is `026d34c66fe23adfdfbf0bab322242c2b3480469`.

No production workflow or date resolver has been modified by this audit phase. The only intended repository change at this checkpoint is this handoff.

## Known problems / rejected approaches

Rejected:

- One universal `scheduled Taipei date` rule for all workflows.
- Reusing D1-D7 as runtime production policy identifiers.
- Treating trading-calendar awareness as automatically delay-safe when its anchor is still actual runner time.
- Treating a green workflow run as sufficient if expected durable files are absent from remote `main`.
- Silently selecting older data to make prediction/replay succeed.

Known risks to test explicitly:

- delayed schedule crossing midnight;
- delayed schedule crossing a magic cutoff such as 08:00 or 14:00;
- Friday/weekend/holiday scheduling;
- next-trading-date policy for TWT49U;
- manual explicit-date runs;
- retries running hours later than the original collection attempt;
- schedule expressions with multiple cron entries in one workflow.

## Entry points

### Repository rules / docs

- `AGENTS.md`
- `docs/project-philosophy.md`
- `docs/roadmap/current-phase.md`
- `docs/handoffs/scheduled-workflow-date-semantics.md`

### Existing positive reference

- `.github/workflows/crawl-sma.yml`
- `scripts/resolve_scheduled_sma_target_date.js`

### Existing trading-calendar helpers

- `scripts/resolve_forecast_dates.js`
  - `loadHolidaySet`
  - `isTradingDate`
  - `nextTradingDate`
  - `previousTradingDate`

### First migration workflows

- `.github/workflows/crawl-twse-mi-index.yml`
- `.github/workflows/crawl-twse-institutional-investors.yml`
- `.github/workflows/crawl-twse-margin-balance.yml`
- `.github/workflows/crawl-fubon-broker-details.yml`
- `.github/workflows/crawl-fubon-brokers-trade.yml`
- `.github/workflows/crawl-institutional.yml`
- `.github/workflows/retry-institutional.yml`
- `.github/workflows/retry-sma.yml`
- `.github/workflows/crawl-twse-institutional-summaries.yml`
- `.github/workflows/crawl-twse-twt49u.yml`

### Relevant downstream safety gates

- `.github/workflows/daily-stock-prediction.yml`
- `scripts/resolve_latest_complete_prediction_base.js`
- `.github/workflows/daily-prediction-replay.yml`
- `scripts/resolve_prediction_replay_date.js`

## Next round

Implement only the first bounded date-semantics migration group.

1. Re-read current `main` and verify the ten workflow files above still match the audit assumptions.
2. Inspect `scripts/resolve_scheduled_sma_target_date.js` and `scripts/resolve_forecast_dates.js` before designing shared code.
3. Introduce the smallest reusable scheduled-occurrence/date-policy resolver justified by these repeated real cases. Do not build a generic scheduler framework.
4. The shared interface must distinguish:
   - event type (`schedule` vs manual/other);
   - exact triggering cron expression `${{ github.event.schedule }}`;
   - explicit manual date override;
   - declared timezone (`Asia/Taipei` for the first group);
   - collection-date policy (`same_calendar_date` / `same_trade_date` / `next_trade_date` or a similarly small explicit vocabulary actually needed by this group).
5. Preserve/manual explicit-date behavior.
6. Migrate the ten first-group workflows away from direct runner-time target-date calculation.
7. Add deterministic regression fixtures/tests covering schedule delay, midnight crossing, cutoff crossing, weekend/holiday behavior, multiple cron expressions, manual explicit date, and TWT49U next-trading-date behavior.
8. Do not modify source-derived, repository-driven, prediction, replay, market-news, external-market, TDCC, VIX, EIA, or other second-wave workflows in this round.
9. Run syntax/tests and inspect the resulting workflow expressions/CLI arguments.
10. Verify durable remote `main` contains the expected implementation and test files before declaring Prompt A complete.

### Prompt A completion contract

Prompt A is complete only when:

- the shared resolver and its regression tests exist on remote `main`;
- all ten first-group workflows no longer derive automatic scheduled target dates from actual runner clock;
- explicit manual-date behavior is preserved;
- TWT49U still resolves the next trading date from the logical scheduled date;
- tests prove delayed execution does not change the intended target date for the migrated schedule expressions;
- no second-wave workflow was migrated accidentally;
- remote `main` has the expected commits/files;
- the agent explicitly reports `Prompt A complete — ready for Prompt B` and stops.

## Safety / stop conditions

- If current `main` materially changed any of the ten workflow date semantics after the frozen audit commit, update this handoff before implementation rather than blindly applying the old classification.
- If a workflow's intended business-date semantics cannot be established from current code/comments/tests, preserve current observable behavior and document the ambiguity; do not invent a new policy silently.
- If the shared resolver would require speculative generic scheduler/DAG/plugin architecture, stop and keep the solution narrower.
- Do not change prediction/replay stale-data safety gates.
- Do not silently fall back to older trading dates.

## Prompt A — Next-round implementation prompt

Continue the Scheduled Workflow Date Semantics Migration in repository `EasonLiu0913/stock_data`.

Before doing any work:
1. Read the repository-level instructions in `AGENTS.md`.
2. Read `docs/project-philosophy.md` and `docs/roadmap/current-phase.md`.
3. Read the canonical handoff: `docs/handoffs/scheduled-workflow-date-semantics.md`.
4. Verify that current `main` still matches the audit assumptions and first-migration entry points recorded in the handoff.
5. Read the positive reference `.github/workflows/crawl-sma.yml` and `scripts/resolve_scheduled_sma_target_date.js`, plus trading-calendar helpers in `scripts/resolve_forecast_dates.js`.

Implement only the first bounded high-risk migration group:

- `.github/workflows/crawl-twse-mi-index.yml`
- `.github/workflows/crawl-twse-institutional-investors.yml`
- `.github/workflows/crawl-twse-margin-balance.yml`
- `.github/workflows/crawl-fubon-broker-details.yml`
- `.github/workflows/crawl-fubon-brokers-trade.yml`
- `.github/workflows/crawl-institutional.yml`
- `.github/workflows/retry-institutional.yml`
- `.github/workflows/retry-sma.yml`
- `.github/workflows/crawl-twse-institutional-summaries.yml`
- `.github/workflows/crawl-twse-twt49u.yml`

Goal: scheduled runs must resolve their logical collection date from the triggering schedule occurrence rather than actual runner start time, then apply an explicit business-date policy. Manual explicit dates must remain authoritative.

Use the smallest shared resolver justified by these ten proven cases. It must accept the triggering cron expression and expose an explicit small collection-date policy vocabulary sufficient for this group. Reuse `scripts/resolve_forecast_dates.js` trading-calendar helpers where appropriate instead of duplicating calendar logic.

Add deterministic regression tests/fixtures for:

- delayed execution within the same day;
- delay crossing Taipei midnight;
- delay crossing old 08:00 / 14:00 magic cutoffs;
- weekday/weekend/holiday handling;
- multiple cron expressions per workflow;
- manual explicit date override;
- TWT49U `next_trade_date` from logical scheduled date;
- retries preserving the intended logical collection date rather than recalculating from the later runner time.

Do not migrate second-wave workflows in this round. Do not weaken `scripts/resolve_latest_complete_prediction_base.js` or `scripts/resolve_prediction_replay_date.js` stale/incomplete-data safety behavior.

Before declaring completion, verify the required implementation/test files and all ten migrated workflows exist on current remote `main`. A green CI result without durable remote files is not completion.

Prompt A is complete only when the canonical handoff's `Prompt A completion contract` is fully satisfied. Then explicitly report: `Prompt A complete — ready for Prompt B` and stop.

## Prompt B — Next-round closeout / verification prompt

Perform the mandatory closeout review for the first Scheduled Workflow Date Semantics migration in repository `EasonLiu0913/stock_data`.

Before verifying:
1. Read `AGENTS.md`.
2. Read `docs/handoffs/scheduled-workflow-date-semantics.md`.
3. Fetch current remote `main`; do not verify only a local worktree or workflow summary.

Verify the implementation independently against these preregistered criteria:

1. **Bounded scope**
   - Confirm exactly the intended first-wave date-semantics implementation/test files and the ten named workflows were changed for migration purposes.
   - Confirm second-wave workflows were not opportunistically migrated.

2. **No runner-clock automatic target dates in first wave**
   Inspect each of:
   - `.github/workflows/crawl-twse-mi-index.yml`
   - `.github/workflows/crawl-twse-institutional-investors.yml`
   - `.github/workflows/crawl-twse-margin-balance.yml`
   - `.github/workflows/crawl-fubon-broker-details.yml`
   - `.github/workflows/crawl-fubon-brokers-trade.yml`
   - `.github/workflows/crawl-institutional.yml`
   - `.github/workflows/retry-institutional.yml`
   - `.github/workflows/retry-sma.yml`
   - `.github/workflows/crawl-twse-institutional-summaries.yml`
   - `.github/workflows/crawl-twse-twt49u.yml`

   Confirm automatic scheduled target selection no longer depends on actual runner `date`, `new Date()`, or magic `-3h` / `-8h` / 14:00 cutoff logic.

3. **Occurrence + policy separation**
   - Confirm the shared implementation resolves the triggering schedule occurrence from the cron expression/event context.
   - Confirm collection-date policy is explicit and small, not inferred from workflow filenames.
   - Confirm trading-calendar behavior reuses canonical helpers where practical.

4. **Delay regression tests**
   Require deterministic tests proving at minimum:
   - same cron occurrence gives the same target despite later runner-start timestamps;
   - crossing Taipei midnight does not move a scheduled run to the next logical date;
   - crossing the old 08:00 / 14:00 boundaries does not change the scheduled target;
   - weekend/holiday behavior is deterministic;
   - TWT49U next-trading-date behavior is calculated from logical scheduled date;
   - explicit manual-date override remains unchanged;
   - retry workflows preserve the intended logical date.

5. **Prediction/replay safety non-regression**
   - Confirm `scripts/resolve_latest_complete_prediction_base.js` still refuses stale fallback when the latest eligible prediction base is incomplete.
   - Confirm `scripts/resolve_prediction_replay_date.js` still validates the newest SMA result date rather than silently falling back.

6. **Durable remote state**
   - Confirm all expected implementation/test/workflow files are present on current remote `main`.
   - Record implementation commit SHA(s) and relevant test/CI evidence.
   - Treat green-but-missing remote artifacts as failure.

7. **Handoff checkpoint**
   If verification passes, update `docs/handoffs/scheduled-workflow-date-semantics.md` with:
   - completed implementation;
   - exact new resolver/test paths and important symbols/commands;
   - commit/test evidence;
   - any changed understanding;
   - next second-wave migration scope;
   - Prompt A and phase-specific Prompt B for the following round.
   Commit the handoff and verify current `main` has not made it stale.

If any criterion fails, fix only the bounded defect, rerun the affected tests, and repeat this closeout review. Do not advance to second-wave migration until Prompt B passes cleanly.
