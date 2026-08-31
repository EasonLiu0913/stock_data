# Scheduled Workflow Date Semantics Migration

Canonical handoff: `docs/handoffs/scheduled-workflow-date-semantics.md`

## Current phase

First-wave implementation and mandatory closeout verification are complete.

Repo-wide scheduled-workflow audit was frozen at:

- audit base: `026d34c66fe23adfdfbf0bab322242c2b3480469`
- audited scheduled workflows: 37

First-wave implementation is durably present on remote `main` through:

- implementation/test head before this handoff update: `53a32a03f5fd340c09876dc94ea22360f17359f4`
- successful regression run: `33353663345`

Next phase: bounded second-wave migration for remaining workflows whose scheduled semantics still contain runner-clock or mixed-clock dependencies.

## Objective

Make scheduled collection/business dates delay-safe while preserving each workflow's actual domain policy.

Architecture remains deliberately small:

1. **Scheduled occurrence resolution** — resolve the intended triggering cron occurrence, not actual runner start time.
2. **Collection-date policy** — explicitly map that logical occurrence to the workflow's business-date semantics.

Do not use audit taxonomy D1-D7 as production policy identifiers.

## Frozen decisions / constraints

- Manual explicit dates remain authoritative.
- Source/API-derived dates remain source-derived when they are the canonical business date.
- Repository/latest-complete-data workflows remain repository-driven.
- Do not silently fall back to an older trading date unless an explicit policy permits it.
- Prediction/replay stale-data safety gates must not be weakened.
- Preserve existing crawler outputs, persistence, and large-fetch plan/fresh-runner physical-batch architecture.
- Shared infrastructure must remain small and evidence-driven; do not build a scheduler/DAG/plugin framework.
- Known exact entry-point paths must be carried forward in handoffs/prompts.

## Completed — repo-wide audit

The audit established that scheduled workflows do not share one universal date rule. Relevant mechanisms include same trade date, next trade date, repository/latest complete date, source market session, source timestamps/report periods, and date-independent maintenance.

Positive references that must remain unchanged unless separately justified:

- `.github/workflows/crawl-sma.yml`
- `scripts/resolve_scheduled_sma_target_date.js`
- `.github/workflows/daily-stock-prediction.yml`
- `scripts/resolve_latest_complete_prediction_base.js`
- `.github/workflows/daily-prediction-replay.yml`
- `scripts/resolve_prediction_replay_date.js`
- `.github/workflows/crawl-tdcc-shareholding-snapshot.yml`
- `scripts/crawl_tdcc_shareholding_snapshot.js`

## Completed — first-wave implementation

Shared implementation:

- `scripts/resolve_scheduled_collection_date.js`
  - `resolveScheduledOccurrence`
  - `resolveScheduledCollectionDate`
  - `resolveForEvent`
  - `applyCollectionPolicy`
  - supported first-wave policies:
    - `same_calendar_date`
    - `same_trade_date`
    - `next_trade_date`

Canonical trading-calendar helpers are reused from:

- `scripts/resolve_forecast_dates.js`
  - `loadHolidaySet`
  - `isTradingDate`
  - `nextTradingDate`

Regression tests:

- `tests/resolve_scheduled_collection_date.test.js`

Regression CI:

- `.github/workflows/test-scheduled-collection-date.yml`

The regression CI intentionally materializes exact current-main inputs with raw GitHub fetches instead of depending on `actions/checkout` / `actions/setup-node`, because the first two runs were blocked/cancelled in the action-download/checkout layer before tests started. This change is test-harness only and does not change production workflow semantics.

### Migrated first-wave workflows

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

Scheduled branches in the first nine workflows use `same_trade_date`. `crawl-twse-twt49u.yml` uses `next_trade_date` from the logical scheduled date and skips when the logical scheduled date itself is not a trading day.

Legacy runner-clock logic is retained only for manual-no-date behavior where preserving existing observable manual behavior was intentional.

`crawl-fubon-broker-details.yml` range planning / physical batching / checkpoint persistence was not modified; only its single scheduled-date resolution path changed.

## First-wave closeout evidence — PASS

### Bounded scope

Compare from audit base `026d34c66...` to implementation/test head `53a32a03...` shows only:

- the ten intended first-wave workflows;
- `scripts/resolve_scheduled_collection_date.js`;
- `tests/resolve_scheduled_collection_date.test.js`;
- `.github/workflows/test-scheduled-collection-date.yml`;
- this canonical handoff.

No second-wave workflow was opportunistically migrated.

### No scheduled runner-clock target selection

Independent closeout inspection confirmed each first-wave scheduled branch consumes:

- `${{ github.event_name }}`
- `${{ github.event.schedule }}`
- shared `scripts/resolve_scheduled_collection_date.js`

The legacy `-3h`, `-8h`, current Taipei date, and 14:00 cutoff logic exists only in manual-no-date fallback branches where preserved intentionally.

### Occurrence + policy separation

`resolveScheduledOccurrence(schedule, now)` resolves the cron occurrence independently from business policy.

`applyCollectionPolicy(logicalDateCompact, policy, holidays)` applies an explicit policy. Policy is not inferred from workflow filename/name.

Trading calendar behavior reuses `scripts/resolve_forecast_dates.js` helpers.

### Deterministic regression coverage

`tests/resolve_scheduled_collection_date.test.js` covers:

- same cron occurrence under later runner start;
- delay crossing Taipei midnight;
- delay crossing the legacy 08:00 boundary;
- delay past the next legacy 14:00 cutoff;
- Friday occurrence resolved from Saturday runner start;
- multiple cron expressions;
- explicit manual date override;
- no silent holiday fallback for `same_trade_date`;
- TWT49U Friday -> next trading date across weekend + configured holiday;
- retry workflows preserving logical scheduled date after midnight delay.

### CI evidence

Successful run:

- workflow: `[07 維護更新] Scheduled Collection Date Regression`
- run id: `33353663345`
- conclusion: `success`

Successful regression job steps:

1. `Materialize exact regression inputs from current main` — success
2. `Validate resolver syntax and delay semantics` — success
3. `Verify first-wave workflows use the shared scheduled resolver` — success

### Prediction/replay safety non-regression

` scripts/resolve_latest_complete_prediction_base.js ` still throws when the latest eligible base is incomplete and reports:

- `stale_fallback_allowed: false`
- `checked_candidates: 1`
- no older-date automatic fallback

` scripts/resolve_prediction_replay_date.js ` still selects the newest SMA result date and validates matching V1/V2 manifests plus usable prices. If the newest SMA date is incomplete, it fails instead of walking backward.

### Durable remote state

Before this handoff checkpoint, remote `main` was verified at:

- `53a32a03f5fd340c09876dc94ea22360f17359f4`

All resolver/test/CI/workflow files existed on remote `main` at that head.

## Known problems / rejected approaches

Rejected:

- one universal scheduled Taipei date policy;
- using D1-D7 as runtime policies;
- treating trading-calendar awareness as delay-safe when anchored to runner time;
- weakening prediction/replay safety to make workflows green;
- silently rolling `same_trade_date` backward;
- expanding this work into a generic scheduler framework.

Known remaining mixed-clock risks are intentionally second-wave or later work.

## Entry points

### Repository rules / docs

- `AGENTS.md`
- `docs/project-philosophy.md`
- `docs/roadmap/current-phase.md`
- `docs/handoffs/scheduled-workflow-date-semantics.md`

### Shared resolver / tests

- `scripts/resolve_scheduled_collection_date.js`
  - `resolveScheduledOccurrence`
  - `resolveScheduledCollectionDate`
  - `resolveForEvent`
  - `applyCollectionPolicy`
- `tests/resolve_scheduled_collection_date.test.js`
- `.github/workflows/test-scheduled-collection-date.yml`

### Trading / forecast-date helpers

- `scripts/resolve_forecast_dates.js`
  - `resolveForecastDates`
  - `resolveExplicitForecastDate`
  - `loadHolidaySet`
  - `isTradingDate`
  - `nextTradingDate`
  - `previousTradingDate`

### Prediction/replay safety gates

- `scripts/resolve_latest_complete_prediction_base.js`
- `scripts/resolve_prediction_replay_date.js`

## Next round — second-wave runner/mixed-clock migration

Use a bounded five-workflow scope. Do not migrate all remaining scheduled workflows in one round.

1. `.github/workflows/build-twse-market-chart.yml`
   - current scheduled behavior: runner Taipei time `-8 hours`
   - desired scheduled behavior: logical scheduled trade date using the shared resolver; preserve manual-no-date 08:00 behavior if needed for backward compatibility.
   - preserve `start_date` repository-driven behavior.

2. `.github/workflows/calculate-twse-margin-maintenance.yml`
   - current scheduled behavior: runner Taipei time `-8 hours`
   - desired scheduled behavior: logical scheduled trade date; dependency readiness still decides whether calculation runs.
   - preserve manual explicit date and existing required-file gates.

3. `.github/workflows/crawl-market-news.yml`
   - current workflow calls `scripts/crawl_market_news.js` / `scripts/generate_market_risk_snapshot.js` without a date on scheduled runs; both therefore can inherit runner-current-date semantics.
   - desired scheduled behavior: derive a delay-safe logical collection date from `${{ github.event.schedule }}` and pass that explicit date consistently to both stages.
   - use `same_calendar_date`, not `same_trade_date`, because this workflow runs daily including weekends and represents collection-date snapshots rather than TWSE trade-date artifacts.

4. `.github/workflows/publish-daily-gainers-ai-analysis.yml`
   - current scheduled behavior uses runner Taipei hour: morning -> latest pending; afternoon -> runner Taipei today.
   - desired behavior: determine morning-vs-evening recheck mode from the **logical scheduled occurrence**, not actual runner start time.
   - morning schedules should retain latest-pending behavior.
   - evening schedules should use the logical scheduled Taipei date.
   - push-derived and manual explicit-date behavior must remain unchanged.

5. `.github/workflows/prepare-market-environment.yml`
   - current scheduled behavior calls `scripts/resolve_forecast_dates.js` with actual runner `new Date()`.
   - `scripts/resolve_forecast_dates.js` already supports deterministic `--now`.
   - desired behavior: scheduled runs resolve the intended cron occurrence first, then feed that intended timestamp into `resolve_forecast_dates.js --now ...`, preserving the existing 15:30/trading-calendar forecast-date semantics while making the anchor delay-safe.
   - manual explicit `forecast_date` remains authoritative.
   - do not alter market-environment freshness/integrity gates.

Explicitly out of this second wave:

- source-derived TDCC / CNN Fear & Greed / TAIFEX source-payload workflows;
- external-market source-session resolver;
- EIA refined-product observation-date workflow;
- prediction / replay;
- Fubon rankings hybrid source-year cleanup;
- TAIFEX futures-contract runner-anchor cleanup;
- any third-wave workflow not listed above.

### Second-wave completion contract

Prompt A is complete only when:

- all five named workflows are durably migrated on remote `main`;
- existing shared resolver is reused/extended only as minimally necessary;
- `build-twse-market-chart` and margin-maintenance scheduled targets no longer use runner `-8h`;
- market-news scheduled runs pass one explicit logical collection date to both news and risk-snapshot stages;
- daily-gainers AI morning/evening mode is based on logical occurrence, with push/manual behavior unchanged;
- market-environment scheduled runs feed the intended occurrence timestamp into `resolve_forecast_dates.js --now` (or an equivalently deterministic existing interface), while all integrity/freshness gates remain intact;
- deterministic tests cover delayed runs crossing midnight and the relevant morning/evening / 15:30 boundaries;
- prediction/replay safety scripts remain unchanged in behavior;
- no explicitly out-of-scope third-wave workflow is migrated;
- regression CI is green and remote files are verified;
- agent explicitly reports `Prompt A complete — ready for Prompt B` and stops.

## Safety / stop conditions

- If current `main` changes one of these five workflows materially before implementation, update this handoff first.
- If a workflow's domain policy cannot be established from current code/tests/comments, preserve current observable semantics and record the ambiguity instead of inventing a policy.
- Do not convert market-news into a trading-day dataset.
- Do not replace market-environment freshness/readiness logic; only change the automatic scheduled clock anchor.
- Do not modify prediction/replay stale fallback behavior.
- Do not migrate third-wave workflows in the same round.

## Prompt A — Next-round implementation prompt

Continue the Scheduled Workflow Date Semantics Migration in repository `EasonLiu0913/stock_data`.

Before doing any work:
1. Read `AGENTS.md`.
2. Read `docs/project-philosophy.md` and `docs/roadmap/current-phase.md`.
3. Read the canonical handoff: `docs/handoffs/scheduled-workflow-date-semantics.md`.
4. Verify current remote `main` still matches the first-wave closeout evidence and the five second-wave entry points.
5. Read:
   - `scripts/resolve_scheduled_collection_date.js`
   - `tests/resolve_scheduled_collection_date.test.js`
   - `.github/workflows/test-scheduled-collection-date.yml`
   - `scripts/resolve_forecast_dates.js`

Implement only these five second-wave workflows:

- `.github/workflows/build-twse-market-chart.yml`
- `.github/workflows/calculate-twse-margin-maintenance.yml`
- `.github/workflows/crawl-market-news.yml`
- `.github/workflows/publish-daily-gainers-ai-analysis.yml`
- `.github/workflows/prepare-market-environment.yml`

Requirements:

- `build-twse-market-chart.yml`: scheduled automatic date must use logical scheduled occurrence, not runner `-8h`; preserve explicit/manual and repository-driven `start_date` behavior.
- `calculate-twse-margin-maintenance.yml`: scheduled automatic date must use logical scheduled occurrence, not runner `-8h`; preserve readiness/missing-file gates.
- `crawl-market-news.yml`: resolve `same_calendar_date` from logical scheduled occurrence and pass the exact same explicit date to `scripts/crawl_market_news.js` and `scripts/generate_market_risk_snapshot.js`; preserve manual explicit date.
- `publish-daily-gainers-ai-analysis.yml`: classify morning recheck vs evening same-day mode from logical scheduled occurrence, not runner current hour/date. Morning schedules retain latest-pending selection; evening schedules use logical scheduled Taipei date. Preserve push-derived and manual modes.
- `prepare-market-environment.yml`: use the logical scheduled occurrence timestamp as the `now` anchor for `scripts/resolve_forecast_dates.js` (which already accepts `--now`). Preserve explicit `forecast_date`, trading-calendar semantics, 15:30 logic, freshness checks, strict mode, verification, and snapshot behavior.

Extend the shared resolver only if a real second-wave need requires it; do not build a generic scheduling framework.

Add/extend deterministic tests for:

- delayed 23:07 / 02:33 market-chart occurrences crossing the old 08:00 boundary;
- margin-maintenance delayed past midnight;
- market-news schedules crossing Taipei midnight while retaining collection date;
- daily-gainers AI morning/evening mode when runner starts many hours late;
- market-environment 06:35/07:01/08:02 logical occurrence passed to forecast resolver, including a delay crossing the 15:30 boundary;
- manual explicit-date behavior for affected workflows.

Do not migrate any workflow outside the five named files. Do not change prediction/replay stale-data safety behavior.

Before declaring completion, require a green regression CI and verify the exact implementation/test/workflow files on current remote `main`. Then explicitly report `Prompt A complete — ready for Prompt B` and stop.

## Prompt B — Next-round closeout / verification prompt

Perform the mandatory closeout review for the second-wave Scheduled Workflow Date Semantics migration in repository `EasonLiu0913/stock_data`.

Before verifying:
1. Read `AGENTS.md`.
2. Read `docs/handoffs/scheduled-workflow-date-semantics.md`.
3. Fetch current remote `main`; do not verify only local state or workflow summaries.

Independently verify:

1. **Bounded scope**
   - Only the five preregistered second-wave workflows plus necessary shared resolver/tests/regression harness and handoff changes were made for this migration.
   - No third-wave/source-derived/prediction/replay workflow was opportunistically migrated.

2. **Market-chart + margin-maintenance**
   - Scheduled branches no longer derive target dates from runner `date --date='8 hours ago'`.
   - Manual explicit/manual-no-date compatibility behavior and dependency gates remain intact.

3. **Market news**
   - Scheduled date is `same_calendar_date` from the triggering occurrence.
   - One resolved date is explicitly passed to both `scripts/crawl_market_news.js` and `scripts/generate_market_risk_snapshot.js`.
   - Weekend schedules remain valid calendar-date collections.

4. **Daily-gainers AI publish**
   - Schedule mode is derived from logical occurrence, not actual runner hour.
   - Morning schedules still select latest pending analysis.
   - Evening schedules use logical scheduled Taipei date.
   - Push-derived date and manual explicit-date paths remain unchanged.

5. **Market environment**
   - Scheduled run uses intended occurrence timestamp as the deterministic `now` input to `scripts/resolve_forecast_dates.js`.
   - Existing trading-day / 15:30 semantics and `FORECAST_BASE_DATE` / `FORECAST_TARGET_DATE` behavior remain intact.
   - Existing market-environment freshness/integrity/strict verification gates were not weakened.

6. **Regression evidence**
   - Deterministic tests cover delayed execution, midnight/08:00 boundaries, AI morning/evening mode, and market-environment delay crossing 15:30.
   - Required regression CI completed successfully; record run ID and job-step conclusions.

7. **Prediction/replay non-regression**
   - `scripts/resolve_latest_complete_prediction_base.js` still rejects incomplete latest base without stale fallback.
   - `scripts/resolve_prediction_replay_date.js` still validates the newest SMA result date without fallback.

8. **Durable remote state**
   - Verify expected files/blobs exist on current remote `main`.
   - Record implementation/test commit SHA(s).
   - Green-but-missing remote state is failure.

9. **Handoff checkpoint**
   - If all checks pass, update this canonical handoff with second-wave completion/evidence, exact entry points, next bounded scope, and preregistered next Prompt A + Prompt B.
   - Commit the handoff, re-fetch current `main`, and confirm it is not stale.

If any criterion fails, fix only the bounded defect, rerun the affected regression, and repeat Prompt B. Do not advance to the third wave until Prompt B passes cleanly.
