# Scheduled Workflow Date Semantics Migration

Canonical handoff: `docs/handoffs/scheduled-workflow-date-semantics.md`

## Current phase

The repo-wide audit plus first-wave, second-wave, and third-wave migrations are complete.

Fourth-wave source-derived semantics audit is complete. It was deliberately audit/classification only: no production workflow or crawler semantics were changed.

The next phase is a narrowly preregistered TAIFEX futures/options scheduled expected-date migration. TDCC shareholding snapshot and CNN Fear & Greed are explicitly closed as `no_migration` for this project unless new evidence materially changes their source contracts.

## Objective

Make scheduled collection/business dates delay-safe while preserving each workflow's real domain policy.

Architecture remains deliberately small:

1. **Scheduled occurrence resolution** — reconstruct the intended triggering cron occurrence when schedule logically owns an expected business date.
2. **Domain date policy** — map the occurrence to the workflow's business/source-date expectation.
3. **Source-derived date preservation** — when the upstream payload is authoritative for the observation/business date, keep that date source-derived and use any scheduled date only as an expected-date validation when justified.

Do not use the audit taxonomy D1-D7 as production policy identifiers.

## Frozen decisions / constraints

- Manual explicit dates remain authoritative.
- Source/API-derived dates remain source-derived when they are the canonical business date.
- Repository/latest-complete-data workflows remain repository-driven.
- Do not silently fall back to an older trading date unless that fallback is an explicit preserved domain policy.
- Prediction/replay stale-data safety gates must not be weakened.
- Preserve existing crawler outputs, validation gates, persistence, and large-fetch plan/fresh-runner physical-batch architecture.
- Shared infrastructure must remain small and evidence-driven; do not build a scheduler/DAG/plugin framework.
- Known exact entry-point paths must be carried forward in handoffs/prompts.
- A green workflow is not completion unless the tested implementation is the exact intended implementation head and required durable files are present on remote `main`.
- `scripts/resolve_scheduled_collection_date.js` is a verified cron subset, not a general cron engine. Supported shapes remain `*`, integers, comma-separated integers, and simple integer ranges in standard five-field expressions.
- `github.event.schedule` is not an immutable occurrence timestamp. If a later identical cron occurrence has already passed, reconstruction is ambiguous; do not claim exactness without an independent durable occurrence identifier.
- TDCC source `observed_date` must not be replaced by scheduled date.
- TDCC `available_at` remains conservative first successful archive capture time and must not be backdated.
- CNN source `fear_and_greed.timestamp` / `dataDate` remains source-derived.
- TAIFEX futures/options artifact naming remains payload-date derived through `getPayloadDate(csvText)`; the next migration may add an occurrence-derived expected-date gate, but must not replace payload date as the canonical artifact date.

## Completed — first wave

Implementation/test head: `53a32a03f5fd340c09876dc94ea22360f17359f4`

Regression run: `33353663345`

Handoff checkpoint: `5704095d91b7456af97f70d3a96fd88ca4e7ab56`

Shared implementation:

- `scripts/resolve_scheduled_collection_date.js`
- `scripts/resolve_forecast_dates.js`
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

## Completed — second wave

Implementation/test head: `27ce0b0e1eb8eb9beabe2a8a087571bc4cd47bb1`

Regression run: `33354868624`

Closeout checkpoint: `89a2ade5cbe15e9e0858cb607cc699fc7fbf9878`

Migrated workflows:

- `.github/workflows/build-twse-market-chart.yml`
- `.github/workflows/calculate-twse-margin-maintenance.yml`
- `.github/workflows/crawl-market-news.yml`
- `.github/workflows/publish-daily-gainers-ai-analysis.yml`
- `.github/workflows/prepare-market-environment.yml`

Preserved semantics:

- Market chart: scheduled occurrences use the existing 08:00 business-day boundary without runner `-8h` dependence.
- Margin maintenance: scheduled runs use logical `same_trade_date`; legacy manual-no-date behavior remains separate.
- Market news: crawler and risk snapshot share one explicit logical collection date.
- Daily Gainers publish: mode comes from logical scheduled occurrence, not runner hour.
- Market Environment: logical `scheduled_at_utc` anchors existing forecast-date logic.

## Completed — third wave

Implementation/test head: `63c2c4a2867944cb6522c0f14715a1c23dd19109`

Exact-head regression run: `33365436045`

Regression job: `99404991901`

Conclusion: `success`; deterministic tests: 27 pass, 0 fail.

Third-wave production scope:

- `.github/workflows/crawl-external-market-indicators.yml`
- `.github/workflows/crawl-refined-product-tightness.yml`
- `.github/workflows/crawl-rankings.yml`
- `.github/workflows/crawl-taifex-major-institutional-traders-futures-contracts.yml`
- `scripts/resolve_external_market_session_date.js`
- `scripts/resolve_fubon_ranking_date.js`
- `scripts/resolve_taifex_scheduled_date.js`
- `scripts/scraper_fubon.js`
- `scripts/scraper_fubon_foreign.js`
- `scripts/scraper_fubon_other.js`
- `tests/scheduled_date_third_wave.test.js`
- `.github/workflows/test-scheduled-collection-date.yml`

Protected prediction/replay blobs at implementation head remained unchanged:

- `scripts/resolve_latest_complete_prediction_base.js`: `61800be23d488bdf67874e87db492e8dc947b110`
- `scripts/resolve_prediction_replay_date.js`: `9dd7c74bbe73c4088138b7b1262a8fed71608ff7`

Third-wave handoff checkpoint before fourth-wave audit: `e355f828935c5d45cee5d099dca0ab9aa6e51c63`.

## Completed — fourth-wave source-derived semantics audit

### Audit baseline / freshness

Audit baseline was current remote `main`:

`e355f828935c5d45cee5d099dca0ab9aa6e51c63`

The branch was re-fetched before audit and again before writing this checkpoint; it still matched the third-wave handoff checkpoint, so no prerequisite refresh was required.

Exact audited blob identities:

TDCC:

- `.github/workflows/crawl-tdcc-shareholding-snapshot.yml`: `c6a5d2f6a8bd9720d75e2f6fd0c0d102d0d5b417`
- `scripts/crawl_tdcc_shareholding_snapshot.js`: `3bc0ef36fb1e4fe7d096e9c34948f615cad921e9`
- `tests/tdcc_shareholding_snapshot.test.js`: `bfac615b903efed9d23c4500905ae0d596debe82`

CNN Fear & Greed:

- `.github/workflows/crawl-cnn-fear-and-greed.yml`: `7c7b9d3f9575365b7c79dd6391418586b9a45ee4`
- `scripts/crawl_cnn_fear_and_greed.js`: `6c31cd4fad03ceaf664d1b3d01a227a25850bc95`
- no dedicated crawler test path was present in the preregistered fourth-wave entry points.

TAIFEX futures/options:

- `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml`: `2c3e1b6af03c7c7ed627a00c62e3858767811034`
- `scripts/crawl_taifex_major_institutional_traders_futures_options.js`: `9a6e1235c145cd2472a6df141f2b04a8fee09ff9`
- no dedicated crawler test path was present in the preregistered fourth-wave entry points.

Shared supporting blobs inspected:

- `scripts/resolve_scheduled_collection_date.js`: `7f081771527ecf3b395d8f864aad93ac94c26325`
- `scripts/resolve_taifex_scheduled_date.js`: `ce763c974c168366757d6de420a1c138e429011b`
- `.github/workflows/test-scheduled-collection-date.yml`: `59977a09493d18f160e69e73c6a3141e7632a041`

The fourth wave changed only this handoff. No production workflow, crawler, prediction/replay script, or regression implementation was edited.

### TDCC shareholding snapshot — `no_migration`

Entry points:

- `.github/workflows/crawl-tdcc-shareholding-snapshot.yml`
- `scripts/crawl_tdcc_shareholding_snapshot.js`
- `tests/tdcc_shareholding_snapshot.test.js`

Schedule/probe role:

- Friday 20:10 / 21:10 / 22:10 Taipei and Saturday 08:10 are repeated probes for availability.
- The schedule selects *when to try the source*, not the official observation date.

Authoritative business/source date:

- `normalizeRows()` reads the source row date through `FIELD.date` and writes `observed_date`.
- All valid rows must resolve to exactly one source date; otherwise the crawler fails.
- Artifact path `weekly/YYYYMMDD.json`, manifest identity, and `canonical_file` are derived from this source `observed_date`.

Capture/availability timestamps:

- `capturedAt` defaults to actual runner `new Date().toISOString()` and records the actual successful capture time.
- `available_at` is initialized from that real capture time, then preserved from an existing manifest on duplicate/migration runs.
- This is intentional no-lookahead metadata. Delayed execution must move first capture availability later, not backdate it to the intended schedule.

Manual behavior:

- `workflow_dispatch` has no date input; manual execution has the same latest-source probe semantics.
- Test-only `--captured-at` and `--input-file` make capture/source fixtures deterministic; they do not redefine the source observation date.

Delayed-runner boundaries:

- Crossing Friday/Saturday, UTC/Taipei midnight, or a later probe boundary cannot rename an official artifact because the filename date is source-derived.
- Delay can only make the real `captured_at` / first `available_at` later, which is correct conservative provenance.

Decision:

`no_migration`

No scheduled-date resolver should be inserted. Doing so would risk replacing source observation semantics or backdating availability.

### CNN Fear & Greed — `no_migration`

Entry points:

- `.github/workflows/crawl-cnn-fear-and-greed.yml`
- `scripts/crawl_cnn_fear_and_greed.js`

Schedule/probe role:

- Five daily cron probes fetch the current CNN source snapshot.
- Schedule controls observation opportunity only; no occurrence-derived date is passed to the crawler.

Authoritative business/source date:

- `validatePayload()` requires `fear_and_greed.timestamp` to be a valid ISO timestamp.
- `dataDate` is extracted directly from the `YYYY-MM-DD` portion of that source timestamp.
- Output path `data_cnn_fear_and_greed/YYYYMMDD/cnn_fear_and_greed.json`, GitHub outputs, manifest `latest_date`, and commit metadata are keyed from that source-derived date/timestamp.

Capture/availability timestamps:

- There is no separate canonical capture-time or availability-time field in this crawler.
- Runner wall clock is not used to name or validate the official CNN artifact.

Manual behavior:

- `workflow_dispatch` has no explicit date input and fetches the same latest source snapshot.
- `--input-file` is only a deterministic source fixture path.

Delayed-runner boundaries:

- If a run starts after UTC/Taipei/source-date boundaries, it archives the source snapshot actually returned and names it from that source timestamp.
- A delayed probe may observe a later source snapshot than an on-time probe would have, but there is no occurrence-owned expected business date contract in this workflow. Replacing `dataDate` with scheduled occurrence would be incorrect.

Decision:

`no_migration`

No scheduled-date migration is justified by the audited code.

### TAIFEX futures/options source payload — `needs_migration_next_round`

Entry points:

- `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml`
- `scripts/crawl_taifex_major_institutional_traders_futures_options.js`
- `scripts/resolve_taifex_scheduled_date.js`
- `scripts/resolve_scheduled_collection_date.js`
- `data_history_sma/non_trading_days.json`

Schedule/probe role:

- Daily 17:21 and 19:06 Taipei probes target the latest TAIFEX futures/options institutional payload.
- Current scheduled runs invoke the crawler without `--date`.

Authoritative business/source date:

- `getPayloadDate(csvText)` parses the first source data row and normalizes column 0 as the canonical payload date.
- Official CSV naming remains `${payloadDate}_taifex_major_institutional_traders_futures_options.csv`.

Capture/runner timestamps:

- Runner Taipei wall clock appears only in the Git commit message (`CURRENT_DATE`).
- It does not currently name the official CSV.

Manual behavior:

- `workflow_dispatch.inputs.date` is an expected-date validation, not a historical query parameter.
- The crawler always fetches the latest-only open-data URL; when `--date` is supplied it compares source `payloadDate` to the expected date and fails on mismatch.

Delayed-runner boundary defect:

- Because the scheduled branch supplies no expected date, an occurrence intended for trading date N can start after TAIFEX latest payload has advanced to trading date N+1 and silently accept/archive N+1.
- The artifact is still correctly named from source payload date, so this is not an artifact misnaming bug. It is an occurrence-to-latest-source validation gap: the old scheduled occurrence loses its expected-date identity.
- Weekend/non-trading occurrences also prove why simple `same_calendar_date` is insufficient; the intended latest trading date must preserve the repository's configured weekend/holiday rollback policy.

Decision:

`needs_migration_next_round`

Smallest preregistered implementation:

1. Edit `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml` only as production wiring.
2. For `schedule`, resolve the intended occurrence with `scripts/resolve_scheduled_collection_date.js` in `Asia/Taipei` using the exact `github.event.schedule` expression.
3. Convert the occurrence's Taipei calendar date to previous-or-same trading date using existing `scripts/resolve_taifex_scheduled_date.js` and `data_history_sma/non_trading_days.json`.
4. Pass that resolved date to the existing crawler as `--date`; retain payload date from `getPayloadDate(csvText)` as artifact identity.
5. Keep manual explicit `workflow_dispatch.inputs.date` unchanged and authoritative as an expected-date validation.
6. Do not change the crawler unless deterministic testing shows a strictly necessary test seam; production source-date parsing and output naming are already correct.
7. Add deterministic regression coverage at `tests/scheduled_date_fourth_wave.test.js` and wire it into `.github/workflows/test-scheduled-collection-date.yml`.

Preregistered regression cases:

- scheduled 17:21 Taipei occurrence delayed past a later wall-clock boundary still resolves the occurrence's own expected trading date;
- delayed occurrence crossing into the next trading day rejects a latest payload whose `getPayloadDate()` has advanced beyond the expected date;
- Saturday/Sunday occurrence resolves previous Friday;
- configured non-trading weekday rolls back to the previous trading date;
- manual explicit `--date` behavior remains unchanged;
- source payload date remains the filename date and is never overwritten by scheduled occurrence date;
- no production file outside the preregistered TAIFEX futures/options wiring/test scope changes.

## Current repository state

Fourth-wave audit baseline: `e355f828935c5d45cee5d099dca0ab9aa6e51c63`.

Fourth-wave audit findings commit: recorded by the next handoff checkpoint update after this commit is created.

No production semantics were changed in the audit round.

## Entry points

### Repository rules / canonical state

- `AGENTS.md`
- `docs/project-philosophy.md`
- `docs/roadmap/current-phase.md`
- `docs/handoffs/scheduled-workflow-date-semantics.md`

### Shared scheduled-date infrastructure

- `scripts/resolve_scheduled_collection_date.js`
- `scripts/resolve_forecast_dates.js`
- `tests/resolve_scheduled_collection_date.test.js`
- `tests/scheduled_date_third_wave.test.js`
- `.github/workflows/test-scheduled-collection-date.yml`

### Existing TAIFEX trading-date helper

- `scripts/resolve_taifex_scheduled_date.js`
- `data_history_sma/non_trading_days.json`

### Closed fourth-wave audit targets

TDCC:

- `.github/workflows/crawl-tdcc-shareholding-snapshot.yml`
- `scripts/crawl_tdcc_shareholding_snapshot.js`
- `tests/tdcc_shareholding_snapshot.test.js`

CNN:

- `.github/workflows/crawl-cnn-fear-and-greed.yml`
- `scripts/crawl_cnn_fear_and_greed.js`

### Next-round exact implementation/test entry points

- `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml`
- `scripts/crawl_taifex_major_institutional_traders_futures_options.js`
- `scripts/resolve_scheduled_collection_date.js`
- `scripts/resolve_taifex_scheduled_date.js`
- `data_history_sma/non_trading_days.json`
- `tests/scheduled_date_fourth_wave.test.js` (new)
- `.github/workflows/test-scheduled-collection-date.yml`

### Prediction/replay safety gates — do not weaken

- `scripts/resolve_latest_complete_prediction_base.js`
- `scripts/resolve_prediction_replay_date.js`

## Known problems / rejected approaches

- Do not automatically migrate a scheduled workflow merely because it has multiple cron probes.
- TDCC `observed_date` is source-derived; `available_at` is a conservative first-successful-capture timestamp and must not be backdated.
- CNN `dataDate` is source timestamp-derived and must not become an occurrence-derived artifact date.
- TAIFEX futures/options should not copy the futures-contract crawler wholesale. Reuse only the already-proven occurrence resolution plus previous-or-same-trading-date expectation; keep the latest-only source payload authoritative for artifact date.
- Do not make the TAIFEX crawler pretend `--date` changes the API query. It is an expected-date validation only.
- Do not migrate prediction/replay as part of this project without separate preregistration.
- Do not expand the next implementation wave to TDCC, CNN, or unrelated workflows.

## Next round — fifth-wave TAIFEX futures/options expected-date migration

Implement only the preregistered scheduled expected-date gate for TAIFEX futures/options.

Meaningful phase boundary:

- scheduled occurrence is converted to the previous-or-same TAIFEX trading date;
- that date is passed as crawler `--date` expected-date validation;
- source `getPayloadDate(csvText)` remains canonical artifact date;
- deterministic regression proves delayed-runner, weekend, holiday, manual-date, and source-date-preservation behavior;
- exact-head GitHub regression succeeds;
- remote durable implementation/test files are verified before Prompt A can be declared complete.

## Safety / stop conditions

- If current `main` materially changes any next-round entry point before implementation, refresh this handoff before coding.
- Do not replace source-derived payload date with scheduled date.
- Do not change TDCC or CNN production code in the fifth wave.
- Do not change manual explicit TAIFEX expected-date behavior.
- Do not make `--date` claim historical-query capability; the endpoint is latest-only.
- Do not weaken source mismatch failure.
- Do not treat `resolve_scheduled_collection_date.js` as a general cron engine.
- Do not claim exact intended occurrence after a later identical cron occurrence has passed without an independent durable occurrence identifier.
- Do not modify prediction/replay stale fallback behavior.
- Do not expand beyond the preregistered TAIFEX futures/options workflow/test scope.

## Prompt A — Next-round implementation prompt

Continue the Scheduled Workflow Date Semantics Migration in repository `EasonLiu0913/stock_data`.

This round is a bounded **TAIFEX futures/options scheduled expected-date migration**.

Before doing any work:
1. Read `AGENTS.md`.
2. Read `docs/project-philosophy.md` and `docs/roadmap/current-phase.md`.
3. Read the canonical handoff: `docs/handoffs/scheduled-workflow-date-semantics.md`.
4. Fetch current remote `main`; do not rely on local/conversation state.
5. Verify the fourth-wave audit checkpoint and these exact entry points have not materially changed. If they have, refresh the handoff before continuing.
6. Read:
   - `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml`
   - `scripts/crawl_taifex_major_institutional_traders_futures_options.js`
   - `scripts/resolve_scheduled_collection_date.js`
   - `scripts/resolve_taifex_scheduled_date.js`
   - `data_history_sma/non_trading_days.json`
   - `.github/workflows/test-scheduled-collection-date.yml`
   - `tests/resolve_scheduled_collection_date.test.js`
   - `tests/scheduled_date_third_wave.test.js`

Implement only:

1. In `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml`, split scheduled and non-scheduled date handling without changing manual explicit behavior.
2. For `schedule`, resolve the intended occurrence from `${{ github.event.schedule }}` using `scripts/resolve_scheduled_collection_date.js` with `Asia/Taipei` calendar semantics.
3. Feed that occurrence date to `scripts/resolve_taifex_scheduled_date.js --base-date ...` so weekends and `data_history_sma/non_trading_days.json` roll back to previous-or-same trading date.
4. Invoke `scripts/crawl_taifex_major_institutional_traders_futures_options.js --date "$EXPECTED_DATE"` for scheduled runs.
5. Preserve the crawler's existing latest-only behavior: `getPayloadDate(csvText)` remains the canonical source/artifact date, and mismatch against `--date` must fail rather than rename the payload.
6. Keep `workflow_dispatch.inputs.date` semantics unchanged. Manual no-date remains latest-source behavior.
7. Add `tests/scheduled_date_fourth_wave.test.js` with deterministic coverage for:
   - delayed 17:21 Taipei occurrence;
   - delay crossing into the next trading day/source payload date;
   - weekend rollback;
   - configured non-trading weekday rollback;
   - unchanged manual explicit expected-date behavior;
   - source payload date remains output filename date;
   - mismatch fails.
8. Wire the new test and TAIFEX futures/options workflow/script paths into `.github/workflows/test-scheduled-collection-date.yml` exact-head materialization and regression checks.

Frozen constraints:

- Do not edit TDCC or CNN production files.
- Do not replace source payload date with scheduled date.
- Do not change `getPayloadDate(csvText)` semantics except for a strictly necessary test seam that preserves production behavior.
- Do not make `--date` into a historical-query promise.
- Do not weaken mismatch failure.
- Do not modify prediction/replay.
- Do not expand to any workflow outside this preregistered TAIFEX futures/options scope.

Required implementation evidence:

- exact starting `main` SHA;
- exact changed-file list proving bounded scope;
- local/deterministic Node syntax/tests for all touched JS/test files;
- exact-head GitHub Actions regression from `.github/workflows/test-scheduled-collection-date.yml` whose `head_sha`, tested SHA, and intended implementation/test head all match;
- remote blob verification for the workflow, new test, regression workflow, and any touched script;
- verification that TDCC/CNN production blobs and protected prediction/replay blobs did not change.

Prompt A completion contract:

- scheduled TAIFEX futures/options runs validate the occurrence-owned expected trading date while preserving source payload artifact date;
- all preregistered regression cases pass;
- exact-head regression is green;
- bounded production/test scope is proven;
- required files/contract markers are present on current remote `main` after a fresh fetch;
- implementation state is durable on remote `main`;
- then report exactly `Prompt A complete — ready for Prompt B` and stop.

## Prompt B — Next-round closeout / verification prompt

Perform closeout verification for the fifth-wave TAIFEX futures/options scheduled expected-date migration in repository `EasonLiu0913/stock_data`.

Before verification:
1. Read `AGENTS.md`.
2. Read `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, and `docs/handoffs/scheduled-workflow-date-semantics.md` from current remote `main`.
3. Fetch current remote `main` and identify the claimed fifth-wave implementation/test head and exact-head regression run.

Verify independently:

1. **Bounded scope**
   - Production changes are limited to `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml` unless the handoff preregistered a strictly necessary crawler test seam.
   - Test/regression changes are limited to `tests/scheduled_date_fourth_wave.test.js` and `.github/workflows/test-scheduled-collection-date.yml` plus any explicitly preregistered strictly necessary helper change.
   - TDCC and CNN production blobs are unchanged.
   - Prediction/replay protected blobs are unchanged.

2. **Scheduled occurrence semantics**
   - Scheduled branch derives the intended occurrence from `${{ github.event.schedule }}` via `scripts/resolve_scheduled_collection_date.js` in `Asia/Taipei`.
   - The occurrence calendar date is converted through `scripts/resolve_taifex_scheduled_date.js` to previous-or-same trading date using `data_history_sma/non_trading_days.json`.
   - A delayed runner does not substitute actual runner current date.

3. **Source-date preservation**
   - `getPayloadDate(csvText)` remains the canonical source date.
   - Output filename is still based on payload date.
   - Scheduled expected date is validation only.
   - Mismatch fails; it must not rename, backdate, or silently accept a newer payload for an older occurrence.

4. **Manual behavior**
   - Manual explicit input remains authoritative expected-date validation.
   - Manual no-date remains latest-source behavior.
   - The workflow does not claim the latest-only endpoint supports historical date queries.

5. **Regression coverage**
   - Deterministic tests cover delayed 17:21 occurrence, next-trading-day crossing, weekend rollback, configured holiday rollback, manual explicit date, payload-date filename preservation, and mismatch failure.
   - Existing scheduled-date regression suites still pass.

6. **Exact-head CI identity**
   - Regression run `head_sha` equals the claimed implementation/test head.
   - Materialization uses that exact SHA, not moving `/main`.
   - The regression job conclusion is `success`.

7. **Durable remote verification**
   - Re-fetch current `main` after CI/write activity.
   - Verify the expected workflow/test/regression files and required contract markers exist on remote `main`.
   - Verify the implementation commit is actually reachable from current `main`.
   - Treat green-but-missing remote output as failure.

If any important criterion fails, fix or bounded-rerun only what is necessary and repeat Prompt B verification. Do not proceed to a later migration wave until Prompt B passes.

If closeout passes:

- update this canonical handoff with fifth-wave implementation head, exact-head regression run/job, changed-file list, preserved blob identities, and durable remote verification;
- classify remaining scheduled-date audit scope conservatively;
- preregister the next paired Prompt A + Prompt B before any further migration;
- commit the handoff;
- re-fetch current remote `main` and verify the handoff is durable and not stale;
- then stop. Do not start the next Prompt A automatically.
