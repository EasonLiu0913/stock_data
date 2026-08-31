# Scheduled Workflow Date Semantics Migration

Canonical handoff: `docs/handoffs/scheduled-workflow-date-semantics.md`

## Current phase

The repo-wide audit plus first-wave and second-wave migrations are complete. Third-wave production work has **not** started yet.

This checkpoint hardens the handoff/verification contract before third-wave implementation.

Audit / durable evidence:

- audit base: `026d34c66fe23adfdfbf0bab322242c2b3480469`
- audited scheduled workflows: 37
- first-wave implementation/test head: `53a32a03f5fd340c09876dc94ea22360f17359f4`
- first-wave regression run: `33353663345`
- first-wave handoff checkpoint: `5704095d91b7456af97f70d3a96fd88ca4e7ab56`
- second-wave implementation/test head: `27ce0b0e1eb8eb9beabe2a8a087571bc4cd47bb1`
- second-wave regression run: `33354868624`
- second-wave closeout checkpoint before handoff hardening: `89a2ade5cbe15e9e0858cb607cc699fc7fbf9878`
- concurrent unrelated data-only commit observed during hardening: `31b54724aef1e6857484165dc05fcd5a843f8147`

Independent compare confirmed `31b54724aef1e6857484165dc05fcd5a843f8147` changed only prediction data/snapshot artifacts and did **not** change any third-wave workflow/script/test entry point.

Next phase: bounded third-wave cleanup for four known mixed-clock/source-anchor workflows.

## Objective

Make scheduled collection/business dates delay-safe while preserving each workflow's real domain policy.

Architecture remains deliberately small:

1. **Scheduled occurrence resolution** — reconstruct the intended triggering cron occurrence from the triggering expression instead of using actual runner wall-clock time.
2. **Domain date policy** — explicitly map that occurrence to the workflow's business/source-date semantics.

Do not use the audit taxonomy D1-D7 as production policy identifiers.

## Frozen decisions / constraints

- Manual explicit dates remain authoritative.
- Source/API-derived dates remain source-derived when they are the canonical business date.
- Repository/latest-complete-data workflows remain repository-driven.
- Do not silently fall back to an older trading date unless that fallback is an explicit preserved domain policy.
- Prediction/replay stale-data safety gates must not be weakened.
- Preserve existing crawler outputs, validation gates, persistence, and large-fetch plan/fresh-runner physical-batch architecture.
- Shared infrastructure must remain small and evidence-driven; do not build a scheduler/DAG/plugin framework.
- Known exact entry-point paths must be carried forward in handoffs/prompts. Do not make the next agent rediscover a known path, function, fixture, or test entry point.
- A green workflow is not completion unless the tested implementation is the exact intended implementation head and the required durable files are present on remote `main`.

### Exact-head regression rule — mandatory from third wave onward

The existing regression harness currently materializes files from:

`https://raw.githubusercontent.com/EasonLiu0913/stock_data/main/...`

That is a race-prone evidence pattern because `main` can advance after a workflow run is created. Run `33354868624` is accepted as second-wave evidence because the implementation head and closeout history were independently reconciled, but the pattern must not continue.

Before third-wave Prompt A may declare completion, update:

- `.github/workflows/test-scheduled-collection-date.yml`

so every materialized regression input is fetched from the workflow run's exact commit SHA, e.g. the equivalent of:

```bash
ref="${GITHUB_SHA}"
base="https://raw.githubusercontent.com/EasonLiu0913/stock_data/${ref}"
```

The regression job must print the tested SHA. Prompt B must verify:

- regression run `head_sha` == the claimed implementation/test head;
- the regression harness fetched/materialized that same SHA, not moving `main`;
- remote durable state contains the expected files after the run.

Green CI attached to SHA A while actually materializing SHA B is a closeout failure.

### Scheduled-occurrence resolver support contract

`scripts/resolve_scheduled_collection_date.js` is a **verified cron subset**, not a general cron engine.

Current supported grammar is intentionally limited to the shapes already regression-tested in this repository:

- `*`
- integer values
- comma-separated integer values
- simple integer ranges
- standard five-field expressions using only those forms

Do not assume support for step syntax such as `*/5`, aliases, macros, or other cron grammar unless support is deliberately added with deterministic regression fixtures first.

The current resolver also must not silently claim full POSIX/GitHub semantics for a new expression that constrains both day-of-month and day-of-week. If a future workflow introduces an unverified DOM+DOW combination, stop, define the intended semantics, and add tests before using the shared resolver.

### Scheduled-occurrence reconstruction limitation

`github.event.schedule` gives the cron expression, not an immutable intended timestamp. The current resolver reconstructs the most recent matching occurrence before runner `now`.

Therefore exact reconstruction assumes the job begins **before a later identical cron occurrence becomes eligible**. If execution is delayed so long that a later occurrence of the same expression has already passed, the original occurrence is information-theoretically ambiguous from `github.event.schedule` alone.

Do not describe such a reconstruction as exact. For any workflow where that ambiguity can realistically affect correctness, fail/flag the ambiguity or introduce an explicit durable occurrence identifier; do not guess.

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

Migrated workflows:

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

Second-wave scope was exactly:

- `.github/workflows/build-twse-market-chart.yml`
- `.github/workflows/calculate-twse-margin-maintenance.yml`
- `.github/workflows/crawl-market-news.yml`
- `.github/workflows/publish-daily-gainers-ai-analysis.yml`
- `.github/workflows/prepare-market-environment.yml`

Necessary shared/test changes:

- `scripts/resolve_scheduled_collection_date.js`
- `tests/resolve_scheduled_collection_date.test.js`
- `.github/workflows/test-scheduled-collection-date.yml`

### Second-wave implementation details

- Market chart: scheduled occurrences use `--day-boundary-hour 8`, preserving the old 08:00 business-day boundary without runner `-8h` dependence.
- Margin maintenance: scheduled runs use logical `same_trade_date`; legacy `-8h` remains only for manual-no-date compatibility.
- Market news: one logical `same_calendar_date` is passed explicitly to both `scripts/crawl_market_news.js` and `scripts/generate_market_risk_snapshot.js`.
- Daily Gainers AI publish: morning/evening mode is derived from logical scheduled occurrence, not runner hour.
- Market Environment: logical `scheduled_at_utc` is passed to `scripts/resolve_forecast_dates.js --now`, preserving its existing trading-calendar/15:30 rules.

Second-wave regression run:

- run: `33354868624`
- head: `27ce0b0e1eb8eb9beabe2a8a087571bc4cd47bb1`
- conclusion: success
- regression job: `99374971500`

Second-wave implementation compare from `5704095d91b7456af97f70d3a96fd88ca4e7ab56` to `27ce0b0e1eb8eb9beabe2a8a087571bc4cd47bb1` contained exactly these eight files:

1. `.github/workflows/build-twse-market-chart.yml`
2. `.github/workflows/calculate-twse-margin-maintenance.yml`
3. `.github/workflows/crawl-market-news.yml`
4. `.github/workflows/prepare-market-environment.yml`
5. `.github/workflows/publish-daily-gainers-ai-analysis.yml`
6. `.github/workflows/test-scheduled-collection-date.yml`
7. `scripts/resolve_scheduled_collection_date.js`
8. `tests/resolve_scheduled_collection_date.test.js`

Prediction/replay safety blobs remained unchanged:

- `scripts/resolve_latest_complete_prediction_base.js`: `61800be23d488bdf67874e87db492e8dc947b110`
- `scripts/resolve_prediction_replay_date.js`: `9dd7c74bbe73c4088138b7b1262a8fed71608ff7`

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
  - existing rule: New York date at/after 09:30; before 09:30 use previous weekday

EIA refined-product query upper bound:

- `.github/workflows/crawl-refined-product-tightness.yml`
- `scripts/crawl_refined_product_tightness.js`
  - current default query upper bound: `todayCompact()` from runner UTC date
  - canonical output business date: source/API `observation_date`
- `tests/refined_product_tightness.test.js`

Fubon rankings source date/year:

- `.github/workflows/crawl-rankings.yml`
- `scripts/scraper_fubon.js`
- `scripts/scraper_fubon_foreign.js`
  - current helper: `getDateString(pageDate)`
- `scripts/scraper_fubon_other.js`

Current defect in all three ranking scripts:

- valid source `MM/DD` is combined with `new Date().getFullYear()`;
- missing source date falls back to runner current date.

TAIFEX futures-contract scheduled anchor:

- `.github/workflows/crawl-taifex-major-institutional-traders-futures-contracts.yml`
- `scripts/crawl_taifex_major_institutional_traders_futures_contracts.js`
- `data_history_sma/non_trading_days.json`

The scheduled workflow currently anchors to runner Taipei date and rolls backward across weekends/configured non-trading days. That rollback is an existing domain policy and must be preserved deliberately.

## Next round — third-wave bounded mixed/source-clock cleanup

Implement only these four workflows and their directly required scripts/tests/regression harness:

1. `.github/workflows/crawl-external-market-indicators.yml`
2. `.github/workflows/crawl-refined-product-tightness.yml`
3. `.github/workflows/crawl-rankings.yml`
4. `.github/workflows/crawl-taifex-major-institutional-traders-futures-contracts.yml`

The relevant third-wave entry-point baseline remains:

`89a2ade5cbe15e9e0858cb607cc699fc7fbf9878`

A concurrent commit `31b54724aef1e6857484165dc05fcd5a843f8147` was independently verified as data-only and did not touch any third-wave entry point. Handoff-hardening commits after it also must not modify third-wave production entry points.

Before production edits, compare the third-wave entry points against the `89a2ade...` baseline. Unrelated data/snapshot commits are allowed; any material change to a third-wave workflow/script/test entry point requires refreshing this handoff before implementation.

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

Only the scheduled **query upper bound** becomes delay-safe: derive the upper-bound date from the intended scheduled occurrence in UTC, matching current `todayCompact()` UTC-date semantics at on-time execution, and pass it explicitly with `--date`.

Manual explicit date, source-derived `observation_date`, force/reuse behavior, methodology, and factor calculations remain unchanged.

#### 3. Fubon rankings — decision is frozen, no fallback design work remains

The source page `MM/DD` is authoritative for month/day. The scheduled logical occurrence is only an **anchor for deterministic year inference** around year boundaries.

All three scripts must use one consistent date-resolution rule:

- `scripts/scraper_fubon.js`
- `scripts/scraper_fubon_foreign.js`
- `scripts/scraper_fubon_other.js`

Required behavior:

1. If a valid source page `MM/DD` exists:
   - preserve that source month/day;
   - infer the year deterministically from the logical scheduled-occurrence anchor;
   - handle Dec/Jan rollover explicitly and test it.
2. If source page date is absent, malformed, or cannot be resolved without guessing:
   - **fail that ranking target**;
   - **do not write an official dated CSV for that target**;
   - surface the failure so the crawler/workflow cannot report complete success;
   - **never** fall back to runner date;
   - **never** fall back to scheduled date;
   - **never** invent a source date.
3. Existing valid source `MM/DD` must never be overwritten by the scheduled date.

There is no longer an open decision about a deterministic missing-date fallback. Missing trustworthy source date means no official artifact for that target.

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
- prediction/replay workflows or safety resolvers;
- any workflow not named in the four-workflow third-wave scope.

### Third-wave completion contract

Prompt A is complete only when:

- `.github/workflows/test-scheduled-collection-date.yml` has been hardened to materialize regression inputs from the run's exact `GITHUB_SHA`, not moving `main`;
- regression output records the tested SHA;
- all four named workflows are durably migrated on current remote `main`;
- external-market New York-session selection is anchored to intended occurrence without changing finality/source-date validation;
- EIA scheduled query upper bound is occurrence-derived while `observation_date` remains API-derived;
- all three Fubon ranking scripts use one deterministic source-MM/DD + occurrence-anchor year rule;
- Fubon missing/malformed source page date fails that target and writes no official dated artifact;
- no scheduled Fubon output date depends on runner current year/date;
- TAIFEX futures-contract scheduled base date is occurrence-derived while its existing backward-to-trading-date policy remains intact;
- deterministic tests cover delayed runs crossing UTC/Taipei/New York boundaries, Fubon Dec/Jan year rollover, and Fubon missing-page-date failure;
- any new cron expression/grammar used with the shared resolver is within the verified subset or is accompanied by new parser/semantic regression tests;
- regression CI is green and its `head_sha` equals the claimed implementation/test head;
- prediction/replay safety blobs remain unchanged;
- no out-of-scope workflow is migrated;
- exact implementation/test files are verified on current remote `main`;
- agent reports exactly `Prompt A complete — ready for Prompt B` and stops.

## Safety / stop conditions

- If current `main` materially changes any third-wave entry point before implementation, update this handoff before changing code.
- Do not replace source-derived dates with scheduled dates.
- Do not weaken external-market finality validation or EIA observation-date semantics.
- Do not guess a Fubon ranking year from runner time.
- Do not create any Fubon dated artifact when its source page date is unavailable or untrustworthy.
- Do not treat `resolve_scheduled_collection_date.js` as a general cron engine.
- Do not claim exact intended occurrence after a later identical cron occurrence has passed unless an independent durable occurrence identifier exists.
- Do not change TAIFEX futures/options source-payload workflow in this wave.
- Do not modify prediction/replay stale fallback behavior.
- Do not expand beyond the four preregistered workflows.

## Prompt A — Next-round implementation prompt

Continue the Scheduled Workflow Date Semantics Migration in repository `EasonLiu0913/stock_data`.

Before doing any work:
1. Read `AGENTS.md`.
2. Read `docs/project-philosophy.md` and `docs/roadmap/current-phase.md`.
3. Read the canonical handoff: `docs/handoffs/scheduled-workflow-date-semantics.md`.
4. Fetch current remote `main`. Compare the third-wave entry points against baseline `89a2ade5cbe15e9e0858cb607cc699fc7fbf9878`. The already-verified concurrent commit `31b54724aef1e6857484165dc05fcd5a843f8147` is data-only and may be ignored for this entry-point check. If any third-wave entry point changed materially, update the handoff before implementation.
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

Implement only the four preregistered third-wave workflows and directly required scripts/tests/regression-harness changes:

- `.github/workflows/crawl-external-market-indicators.yml`
- `.github/workflows/crawl-refined-product-tightness.yml`
- `.github/workflows/crawl-rankings.yml`
- `.github/workflows/crawl-taifex-major-institutional-traders-futures-contracts.yml`

First, harden `.github/workflows/test-scheduled-collection-date.yml` so it materializes every regression input from `${GITHUB_SHA}` rather than moving `main`, and prints the exact tested SHA.

Then follow the exact third-wave policies in this handoff:

- External market: intended occurrence anchors the existing New York 09:30 session resolver; preserve source market date/finality and manual explicit date.
- EIA: only the scheduled query upper bound becomes occurrence-derived UTC date; `observation_date` stays API-derived.
- Fubon rankings: page `MM/DD` remains authoritative; logical occurrence only anchors deterministic year inference. If page date is missing/malformed/unresolvable, fail that target and write no official dated artifact. No runner-date or scheduled-date fallback is allowed.
- TAIFEX futures contracts: logical scheduled Taipei date becomes the anchor; preserve existing weekend/configured-holiday rollback and manual date/range behavior.

Use the existing scheduled-occurrence resolver only within its verified cron subset. Do not add untested cron grammar or treat it as a general cron engine. Remember that reconstruction from `github.event.schedule` is ambiguous after a later identical occurrence has passed; do not claim exactness in that case.

Add deterministic tests for relevant late-runner New York/UTC/Taipei boundaries, Fubon Dec/Jan year rollover, Fubon missing-page-date failure, and the exact TAIFEX rollback policy. Extend `.github/workflows/test-scheduled-collection-date.yml` to materialize and verify the exact third-wave inputs/contracts at `${GITHUB_SHA}`.

Do not migrate any workflow outside the four named files. Do not change prediction/replay stale-data safety behavior.

Before declaring completion:

1. require green regression CI;
2. verify the regression run `head_sha` equals the claimed implementation/test head;
3. verify exact implementation/test/workflow files on remote `main`;
4. verify prediction/replay protected blobs are unchanged.

Then report exactly:

`Prompt A complete — ready for Prompt B`

and stop.

## Prompt B — Next-round closeout / verification prompt

Perform the mandatory closeout review for the third-wave Scheduled Workflow Date Semantics migration in repository `EasonLiu0913/stock_data`.

Before verifying:
1. Read `AGENTS.md`.
2. Read `docs/handoffs/scheduled-workflow-date-semantics.md`.
3. Fetch current remote `main`; do not verify only local state or workflow summaries.

Independently enforce every third-wave closeout criterion preregistered in the canonical handoff.

1. **Bounded scope**
   - Only the four preregistered third-wave workflows plus directly necessary scripts/tests/regression harness and later handoff changes were made.
   - No TDCC, CNN Fear & Greed, TAIFEX futures/options source-payload, prediction/replay, or other workflow was opportunistically migrated.

2. **Exact-head regression evidence**
   - `.github/workflows/test-scheduled-collection-date.yml` materializes inputs from the run's exact `${GITHUB_SHA}`, not `/main`.
   - Record the regression run ID, `head_sha`, claimed implementation/test head, and tested/materialized SHA.
   - These SHAs must match. Any mismatch is failure even if the job is green.

3. **External market session**
   - Scheduled target selection uses intended occurrence as the `now` anchor for the existing New York session resolver.
   - The 09:30 America/New_York rule is unchanged.
   - Source market date, provisional/final status, validation, and manual explicit date remain unchanged.
   - Delayed execution across New York date/session boundaries does not move the requested session.

4. **EIA refined-product tightness**
   - Scheduled query upper bound derives from intended occurrence's UTC calendar date, matching prior on-time behavior.
   - `observation_date` remains aligned EIA source observation, not scheduled date.
   - Manual date, force/reuse, methodology, and factor calculations remain intact.

5. **Fubon rankings**
   - All three scripts share one deterministic source `MM/DD` + logical-occurrence-anchor year rule.
   - Valid page `MM/DD` is never replaced by scheduled date.
   - No scheduled artifact naming depends on runner `new Date().getFullYear()` or runner current-date fallback.
   - Missing/malformed/unresolvable page date fails that target and writes no official dated artifact; there is no alternate fallback.
   - Dec/Jan year rollover and missing-page-date failure are deterministic and tested.
   - Crawl targets, pacing/retries, output naming shape, and commit scope remain intact.

6. **TAIFEX futures contracts**
   - Scheduled base date derives from logical occurrence, not runner Taipei date.
   - Existing backward rollback across weekends/configured non-trading days is preserved exactly.
   - Manual single-date and range behavior remain unchanged.

7. **Shared resolver contract**
   - No new untested cron grammar was introduced.
   - Any new cron semantics beyond the verified subset have explicit parser/semantic tests.
   - The implementation does not falsely claim exact occurrence reconstruction in a case where a later identical occurrence has already passed without an independent durable occurrence identifier.

8. **Prediction/replay non-regression**
   - Verify `scripts/resolve_latest_complete_prediction_base.js` and `scripts/resolve_prediction_replay_date.js` retain the protected behavior/blob identity unless a separately preregistered reason exists.

9. **Durable remote state**
   - Verify every required implementation/test/workflow file and contract marker on current remote `main`.
   - Green-but-missing remote state is failure.

If any criterion fails, fix only the bounded defect, rerun the affected regression, and repeat Prompt B.

If everything passes, update and commit `docs/handoffs/scheduled-workflow-date-semantics.md` with third-wave completion evidence, exact next bounded scope, and the following Prompt A + Prompt B. Re-fetch `main` after the handoff commit and confirm the handoff is not stale, then stop.
