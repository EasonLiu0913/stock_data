# Scheduled Workflow Date Semantics Migration

Canonical handoff: `docs/handoffs/scheduled-workflow-date-semantics.md`

## Current phase

Second-wave implementation and mandatory closeout verification are complete.

Repo-wide scheduled-workflow audit was frozen at:

- audit base: `026d34c66fe23adfdfbf0bab322242c2b3480469`
- audited scheduled workflows: 37

Durable implementation evidence:

- first-wave implementation/test head: `53a32a03f5fd340c09876dc94ea22360f17359f4`
- first-wave regression run: `33353663345`
- first-wave handoff checkpoint: `5704095d91b7456af97f70d3a96fd88ca4e7ab56`
- second-wave implementation/test head: `27ce0b0e1eb8eb9beabe2a8a087571bc4cd47bb1`
- second-wave regression run: `33354868624`

Next phase: bounded third-wave cleanup for four known mixed-clock/source-anchor workflows.

## Objective

Make scheduled collection/business dates delay-safe while preserving each workflow's actual domain policy.

Architecture remains deliberately small:

1. **Scheduled occurrence resolution** — resolve the intended triggering cron occurrence, not actual runner start time.
2. **Domain date policy** — explicitly map that occurrence to the workflow's business/source-date semantics.

Do not use audit taxonomy D1-D7 as production policy identifiers.

## Frozen decisions / constraints

- Manual explicit dates remain authoritative.
- Source/API-derived dates remain source-derived when they are the canonical business date.
- Repository/latest-complete-data workflows remain repository-driven.
- Do not silently fall back to an older trading date unless that fallback is an explicit preserved domain policy.
- Prediction/replay stale-data safety gates must not be weakened.
- Preserve existing crawler outputs, validation gates, persistence, and large-fetch plan/fresh-runner physical-batch architecture.
- Shared infrastructure must remain small and evidence-driven; do not build a scheduler/DAG/plugin framework.
- Known exact entry-point paths must be carried forward in handoffs/prompts.

## Completed — first wave

Shared implementation:

- `scripts/resolve_scheduled_collection_date.js`
  - `resolveScheduledOccurrence`
  - `resolveScheduledCollectionDate`
  - `resolveForEvent`
  - `applyCollectionPolicy`
- `scripts/resolve_forecast_dates.js`
  - `loadHolidaySet`
  - `isTradingDate`
  - `nextTradingDate`
  - `previousTradingDate`
- `tests/resolve_scheduled_collection_date.test.js`
- `.github/workflows/test-scheduled-collection-date.yml`

Migrated first-wave workflows:

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

First-wave regression run `33353663345` passed.

## Completed — second wave

Second-wave scope was exactly these five workflows:

- `.github/workflows/build-twse-market-chart.yml`
- `.github/workflows/calculate-twse-margin-maintenance.yml`
- `.github/workflows/crawl-market-news.yml`
- `.github/workflows/publish-daily-gainers-ai-analysis.yml`
- `.github/workflows/prepare-market-environment.yml`

Necessary shared/test changes only:

- `scripts/resolve_scheduled_collection_date.js`
- `tests/resolve_scheduled_collection_date.test.js`
- `.github/workflows/test-scheduled-collection-date.yml`

### Second-wave implementation details

#### Market chart

`.github/workflows/build-twse-market-chart.yml` now resolves scheduled dates through `scripts/resolve_scheduled_collection_date.js` instead of runner `date --date='8 hours ago'`.

The shared resolver received one minimal extension:

- `normalizeDayBoundaryHour`
- `logicalDateForOccurrence`
- `--day-boundary-hour`

`build-twse-market-chart.yml` uses `--day-boundary-hour 8` so the 23:07 and next-day 02:33 Taipei occurrences preserve the pre-existing 08:00 business-day boundary while becoming delay-safe. Explicit manual date and repository-driven `start_date` behavior remain unchanged.

#### Margin maintenance

`.github/workflows/calculate-twse-margin-maintenance.yml` scheduled runs use logical `same_trade_date`. Legacy `-8h` remains only in the manual-no-date compatibility path. Existing output-exists and required-file readiness gates remain intact.

#### Market news

`.github/workflows/crawl-market-news.yml` resolves one `same_calendar_date` from the logical scheduled occurrence and passes the exact same explicit date to:

- `scripts/crawl_market_news.js`
- `scripts/generate_market_risk_snapshot.js`

Weekend schedules remain calendar-date collections.

#### Daily Gainers AI publish

`.github/workflows/publish-daily-gainers-ai-analysis.yml` resolves the intended scheduled occurrence and derives its Taipei hour from `scheduled_at_utc`.

- logical morning occurrence -> latest pending / `next_day_recheck`
- logical evening occurrence -> logical scheduled Taipei date / `same_day`
- push-derived and manual explicit-date modes remain unchanged

#### Market Environment

`.github/workflows/prepare-market-environment.yml` resolves the intended scheduled occurrence and passes `scheduled_at_utc` to:

`scripts/resolve_forecast_dates.js --now ...`

Existing explicit `forecast_date`, trading-calendar/15:30 semantics, strict mode, snapshot verification, regeneration, and freshness/integrity gates remain intact.

## Second-wave closeout evidence — PASS

### Bounded scope

Independent compare from `5704095d91b7456af97f70d3a96fd88ca4e7ab56` to `27ce0b0e1eb8eb9beabe2a8a087571bc4cd47bb1` contained exactly eight files:

1. `.github/workflows/build-twse-market-chart.yml`
2. `.github/workflows/calculate-twse-margin-maintenance.yml`
3. `.github/workflows/crawl-market-news.yml`
4. `.github/workflows/prepare-market-environment.yml`
5. `.github/workflows/publish-daily-gainers-ai-analysis.yml`
6. `.github/workflows/test-scheduled-collection-date.yml`
7. `scripts/resolve_scheduled_collection_date.js`
8. `tests/resolve_scheduled_collection_date.test.js`

No third-wave, source-derived, prediction, or replay workflow was opportunistically migrated.

### Deterministic regression coverage

`tests/resolve_scheduled_collection_date.test.js` now covers, in addition to first-wave cases:

- market-chart 23:07 and 02:33 occurrences with the 08:00 business-day boundary under delayed execution;
- margin-maintenance delayed past Taipei midnight;
- market-news collection date retained across Taipei midnight;
- Daily Gainers AI morning/evening classification from logical occurrence when the runner starts many hours late;
- Market Environment 06:35 / 07:01 / 08:02 logical occurrences used as forecast anchors;
- Market Environment delayed execution crossing the 15:30 forecast boundary;
- manual explicit-date authority.

### CI evidence

Successful regression run:

- workflow: `[07 維護更新] Scheduled Collection Date Regression`
- run id: `33354868624`
- head: `27ce0b0e1eb8eb9beabe2a8a087571bc4cd47bb1`
- conclusion: `success`

Regression job `99374971500` passed all steps:

1. `Materialize exact regression inputs from current main`
2. `Validate resolver syntax and delay semantics`
3. `Verify first-wave workflows use the shared scheduled resolver`
4. `Verify second-wave workflow semantics`

### Prediction/replay non-regression

Exact blob identity was independently verified between the second-wave base and current implementation head:

- `scripts/resolve_latest_complete_prediction_base.js`
  - blob: `61800be23d488bdf67874e87db492e8dc947b110`
  - still fails when the latest eligible base is incomplete; `stale_fallback_allowed: false`
- `scripts/resolve_prediction_replay_date.js`
  - blob: `9dd7c74bbe73c4088138b7b1262a8fed71608ff7`
  - still validates the newest SMA result and does not silently walk backward

### Durable remote state

Before this closeout handoff commit, remote `main` was independently re-fetched at:

- `27ce0b0e1eb8eb9beabe2a8a087571bc4cd47bb1`

Representative current-main blobs:

- `scripts/resolve_scheduled_collection_date.js`: `7f081771527ecf3b395d8f864aad93ac94c26325`
- `tests/resolve_scheduled_collection_date.test.js`: `8abe5120db290ba1243ea55a58031ffbc38c2159`
- `.github/workflows/test-scheduled-collection-date.yml`: `18c59668e07bba4cd7ccf6510d6c1a0a1a8b4999`
- `.github/workflows/build-twse-market-chart.yml`: `7cee42314eaadcf398089ea6266edf9c04189632`
- `.github/workflows/calculate-twse-margin-maintenance.yml`: `814a9cf46d84a3dc5d40a6955f35d7760edde3f2`
- `.github/workflows/crawl-market-news.yml`: `1fad25c8eb60e2a1a179e7c72e83c003d24d0736`
- `.github/workflows/publish-daily-gainers-ai-analysis.yml`: `9af23186bbcac5397b19bd16b4fc516869993420`
- `.github/workflows/prepare-market-environment.yml`: `786b605f58695b932c88f58ac5f064eb5e612efa`

## Known problems / rejected approaches

Rejected:

- one universal scheduled Taipei date policy;
- using D1-D7 as runtime policies;
- treating trading-calendar awareness as delay-safe while anchoring to runner time;
- weakening prediction/replay safety to make workflows green;
- silently rolling `same_trade_date` backward unless the workflow's established domain policy explicitly requires that behavior;
- converting source/API dates into runner-derived dates;
- expanding this migration into a generic scheduler framework.

Remaining work must continue in bounded waves.

## Entry points

### Repository rules / canonical state

- `AGENTS.md`
- `docs/project-philosophy.md`
- `docs/roadmap/current-phase.md`
- `docs/handoffs/scheduled-workflow-date-semantics.md`

### Shared scheduled-date infrastructure

- `scripts/resolve_scheduled_collection_date.js`
  - `resolveScheduledOccurrence`
  - `resolveScheduledCollectionDate`
  - `resolveForEvent`
  - `applyCollectionPolicy`
  - `logicalDateForOccurrence`
- `scripts/resolve_forecast_dates.js`
- `tests/resolve_scheduled_collection_date.test.js`
- `.github/workflows/test-scheduled-collection-date.yml`

### Prediction/replay safety gates — do not weaken

- `scripts/resolve_latest_complete_prediction_base.js`
- `scripts/resolve_prediction_replay_date.js`

### Third-wave exact entry points

External market session:

- `.github/workflows/crawl-external-market-indicators.yml`
- `scripts/crawl_external_market_indicators.js`
  - `resolveAutomaticTargetDate(now)`
  - current automatic rule: New York date at/after 09:30, otherwise previous weekday

EIA refined-product query upper bound:

- `.github/workflows/crawl-refined-product-tightness.yml`
- `scripts/crawl_refined_product_tightness.js`
  - current default target: `todayCompact()` from runner UTC date
  - output business date remains source/API-derived `observation_date`
- `tests/refined_product_tightness.test.js`

Fubon rankings source-date/year cleanup:

- `.github/workflows/crawl-rankings.yml`
- `scripts/scraper_fubon.js`
- `scripts/scraper_fubon_foreign.js`
  - `getDateString(pageDate)`
- `scripts/scraper_fubon_other.js`

The ranking pages expose source `MM/DD`, but all three scripts currently inject `new Date().getFullYear()` and fall back to runner current date when the source date is missing.

TAIFEX futures-contract scheduled anchor:

- `.github/workflows/crawl-taifex-major-institutional-traders-futures-contracts.yml`
- `scripts/crawl_taifex_major_institutional_traders_futures_contracts.js`
- `data_history_sma/non_trading_days.json`

The scheduled workflow currently anchors to runner Taipei date and explicitly rolls backward across weekends/configured non-trading days. That rollback is an existing domain policy and must be preserved deliberately rather than accidentally.

## Next round — third-wave bounded mixed/source-clock cleanup

Implement only these four workflows and their directly required scripts/tests/regression harness:

1. `.github/workflows/crawl-external-market-indicators.yml`
2. `.github/workflows/crawl-refined-product-tightness.yml`
3. `.github/workflows/crawl-rankings.yml`
4. `.github/workflows/crawl-taifex-major-institutional-traders-futures-contracts.yml`

### Third-wave policy requirements

#### 1. External market indicators

Preserve `scripts/crawl_external_market_indicators.js` New York session policy exactly:

- at/after 09:30 America/New_York -> New York session date, weekend-rolled as currently implemented;
- before 09:30 -> previous weekday;
- actual source market date/finality validation remains authoritative.

Scheduled runs must resolve the intended cron occurrence first and feed that timestamp into the existing New York-session resolver through a minimal deterministic interface such as `--now`. A delayed runner must not move the requested U.S. market session.

Manual explicit `date` and provisional/final overwrite behavior remain unchanged.

#### 2. EIA refined-product tightness

Do **not** convert `observation_date` into a scheduled calendar date. The canonical artifact date remains the latest aligned EIA observation returned by the API.

Only the scheduled **query upper bound** becomes delay-safe: derive the upper-bound date from the intended scheduled occurrence in UTC, matching the current `todayCompact()` UTC-date semantics at on-time execution, and pass it explicitly with `--date`.

Manual explicit date, source-derived `observation_date`, force/reuse behavior, methodology, and factor calculations remain unchanged.

#### 3. Fubon rankings

The source page `MM/DD` remains authoritative for month/day. Remove runner-current-year dependence by giving the three ranking scrapers a deterministic anchor derived from the logical scheduled occurrence and using that anchor only to infer the missing year around year boundaries.

Do not overwrite a valid page `MM/DD` with a scheduled date.

If page date is absent, do not silently manufacture a production artifact from runner current date. Preserve/fail safely using a deterministic, explicitly tested fallback only if current observable behavior requires it and the source-date ambiguity can be resolved without guessing.

The three scripts must use one consistent date-resolution rule:

- `scripts/scraper_fubon.js`
- `scripts/scraper_fubon_foreign.js`
- `scripts/scraper_fubon_other.js`

Preserve existing crawl targets, pacing/retry behavior, output naming shape, and commit scope.

#### 4. TAIFEX futures contracts

Scheduled runs must derive their base date from the intended cron occurrence, not runner Taipei `new Date()`.

Preserve the existing explicit policy:

- start from the logical scheduled Taipei calendar date;
- if it is weekend/configured non-trading day, roll backward until the most recent trading date;
- pass that explicit date to `scripts/crawl_taifex_major_institutional_traders_futures_contracts.js`.

Manual single-date and manual range behavior remain unchanged. Do not change the range crawler into a new batching architecture in this date-semantics round.

### Explicitly out of third wave

Do not migrate or reinterpret:

- `.github/workflows/crawl-tdcc-shareholding-snapshot.yml`
- `.github/workflows/crawl-cnn-fear-and-greed.yml`
- `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml`
- prediction / replay workflows or safety resolvers;
- any workflow not named in the four-workflow third-wave scope.

### Third-wave completion contract

Prompt A is complete only when:

- all four named workflows are durably migrated on current remote `main`;
- external-market New York-session selection is anchored to intended occurrence without changing finality/source-date validation;
- EIA scheduled query upper bound is occurrence-derived while `observation_date` remains API-derived;
- all three Fubon ranking scripts use one deterministic source-date/year rule and no scheduled output date depends on runner current year/date;
- TAIFEX futures-contract scheduled base date is occurrence-derived while its existing backward-to-trading-date policy remains intact;
- deterministic tests cover delayed runs crossing UTC/Taipei/New York date boundaries and year rollover where relevant;
- regression CI is green and verifies the exact third-wave wiring/semantics;
- prediction/replay safety blobs remain unchanged;
- no out-of-scope workflow is migrated;
- exact implementation/test files are verified on current remote `main`;
- agent reports exactly `Prompt A complete — ready for Prompt B` and stops.

## Safety / stop conditions

- If current `main` materially changes any third-wave entry point before implementation, update this handoff before changing code.
- Do not replace source-derived dates with scheduled dates.
- Do not weaken external-market finality validation or EIA observation-date semantics.
- Do not guess a Fubon ranking year from runner time.
- Do not change TAIFEX futures/options source-payload workflow in this wave.
- Do not modify prediction/replay stale fallback behavior.
- Do not expand beyond the four preregistered workflows.

## Prompt A — Next-round implementation prompt

Continue the Scheduled Workflow Date Semantics Migration in repository `EasonLiu0913/stock_data`.

Before doing any work:
1. Read `AGENTS.md`.
2. Read `docs/project-philosophy.md` and `docs/roadmap/current-phase.md`.
3. Read the canonical handoff: `docs/handoffs/scheduled-workflow-date-semantics.md`.
4. Fetch current remote `main` and verify it still matches the second-wave closeout evidence and the third-wave entry points.
5. Read exactly:
   - `scripts/resolve_scheduled_collection_date.js`
   - `tests/resolve_scheduled_collection_date.test.js`
   - `.github/workflows/test-scheduled-collection-date.yml`
   - `.github/workflows/crawl-external-market-indicators.yml`
   - `scripts/crawl_external_market_indicators.js`
   - `.github/workflows/crawl-refined-product-tightness.yml`
   - `scripts/crawl_refined_product_tightness.js`
   - `tests/refined_product_tightness.test.js`
   - `.github/workflows/crawl-rankings.yml`
   - `scripts/scraper_fubon.js`
   - `scripts/scraper_fubon_foreign.js`
   - `scripts/scraper_fubon_other.js`
   - `.github/workflows/crawl-taifex-major-institutional-traders-futures-contracts.yml`
   - `scripts/crawl_taifex_major_institutional_traders_futures_contracts.js`
   - `data_history_sma/non_trading_days.json`

Implement only the four third-wave workflows preregistered in the handoff:

- `.github/workflows/crawl-external-market-indicators.yml`
- `.github/workflows/crawl-refined-product-tightness.yml`
- `.github/workflows/crawl-rankings.yml`
- `.github/workflows/crawl-taifex-major-institutional-traders-futures-contracts.yml`

Follow the exact per-workflow domain policies and third-wave completion contract in `docs/handoffs/scheduled-workflow-date-semantics.md`.

Key requirements:

- External market: intended scheduled occurrence must anchor the existing New York 09:30 session resolver; preserve source market date/finality behavior and manual explicit date.
- EIA: make only the scheduled query upper bound delay-safe using the intended occurrence's UTC date; keep `observation_date` API-derived and preserve force/reuse/methodology behavior.
- Fubon rankings: page MM/DD remains source-derived; infer year deterministically from logical scheduled occurrence, consistently across all three ranking scripts; eliminate runner current-year/date dependence from scheduled artifact naming without inventing a source date.
- TAIFEX futures contracts: intended scheduled Taipei date becomes the anchor; preserve the existing weekend/configured-holiday rollback to the most recent trading date; preserve manual date/range behavior.

Use the existing scheduled-occurrence resolver where it fits. Add only minimal deterministic interfaces to domain-specific scripts where needed; do not build a generic scheduler.

Add deterministic regression coverage for late runners crossing the relevant New York, UTC, Taipei, and year-rollover boundaries. Extend `.github/workflows/test-scheduled-collection-date.yml` to materialize and verify the exact third-wave inputs/contracts.

Do not migrate any workflow outside the four named files. Do not change prediction/replay stale-data safety behavior.

Before declaring completion, require a green regression CI and verify exact implementation/test/workflow files on current remote `main`. Then report exactly:

`Prompt A complete — ready for Prompt B`

and stop.

## Prompt B — Next-round closeout / verification prompt

Perform the mandatory closeout review for the third-wave Scheduled Workflow Date Semantics migration in repository `EasonLiu0913/stock_data`.

Before verifying:
1. Read `AGENTS.md`.
2. Read `docs/handoffs/scheduled-workflow-date-semantics.md`.
3. Fetch current remote `main`; do not verify only local state or workflow summaries.

Independently enforce every third-wave closeout criterion preregistered in the canonical handoff, including:

1. **Bounded scope**
   - Only the four preregistered third-wave workflows plus directly necessary scripts/tests/regression harness and handoff changes were made.
   - No TDCC, CNN Fear & Greed, TAIFEX futures/options source-payload, prediction/replay, or other workflow was opportunistically migrated.

2. **External market session**
   - Scheduled target selection uses the intended occurrence as the `now` anchor for the existing New York session resolver.
   - The 09:30 America/New_York rule is unchanged.
   - Source market date, provisional/final status, validation, and manual explicit date remain unchanged.
   - A delayed runner crossing New York midnight/session boundaries does not move the requested session.

3. **EIA refined-product tightness**
   - Scheduled query upper bound derives from the intended occurrence's UTC calendar date, matching prior on-time behavior.
   - `observation_date` remains the aligned EIA source observation, not the scheduled date.
   - Manual date, force/reuse, methodology, and factor calculations remain intact.

4. **Fubon rankings**
   - All three scripts share one deterministic source MM/DD + anchor-year rule.
   - Valid page MM/DD is not replaced with scheduled date.
   - Scheduled artifact naming no longer depends on runner `new Date().getFullYear()` or runner current-date fallback.
   - Year-rollover behavior is deterministic and tested.
   - Crawl targets, pacing/retries, output naming shape, and commit scope remain intact.

5. **TAIFEX futures contracts**
   - Scheduled base date derives from logical occurrence, not runner Taipei date.
   - Existing backward rollback across weekends/configured non-trading days is preserved exactly.
   - Manual single-date and range behavior remain unchanged.

6. **Regression evidence**
   - Deterministic tests cover relevant delayed-execution boundaries and source/year semantics.
   - Regression CI completed successfully; record run ID and step conclusions.

7. **Prediction/replay non-regression**
   - Verify `scripts/resolve_latest_complete_prediction_base.js` and `scripts/resolve_prediction_replay_date.js` remain unchanged in behavior/blob identity unless a separately preregistered reason exists.

8. **Durable remote state**
   - Verify every required implementation/test/workflow file and contract marker on current remote `main`.
   - Green-but-missing remote state is failure.

If any criterion fails, fix only the bounded defect, rerun the affected regression, and repeat Prompt B.

If everything passes, update and commit `docs/handoffs/scheduled-workflow-date-semantics.md` with third-wave completion evidence, exact next bounded scope, and the following Prompt A + Prompt B. Re-fetch `main` after the handoff commit and confirm the handoff is not stale, then stop.
