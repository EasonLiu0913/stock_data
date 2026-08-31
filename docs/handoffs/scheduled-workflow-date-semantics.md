# Scheduled Workflow Date Semantics Migration

Canonical handoff: `docs/handoffs/scheduled-workflow-date-semantics.md`

## Current phase

The repo-wide audit plus first-wave, second-wave, and third-wave migrations are complete.

Third-wave closeout passed independently on current remote `main`.

Next phase is deliberately **audit/classification only** for three remaining source-derived scheduled workflows. Do not migrate them merely because they are scheduled; first determine whether runner wall-clock time affects any canonical business/source date or only probe/capture timing.

## Objective

Make scheduled collection/business dates delay-safe while preserving each workflow's real domain policy.

Architecture remains deliberately small:

1. **Scheduled occurrence resolution** — reconstruct the intended triggering cron occurrence from the triggering expression instead of using actual runner wall-clock time where the schedule logically owns the date.
2. **Domain date policy** — explicitly map that occurrence to the workflow's business/source-date semantics.
3. **Source-derived date preservation** — when the upstream payload is authoritative for the observation/business date, keep that date source-derived and do not replace it with scheduled occurrence.

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
- A green workflow is not completion unless the tested implementation is the exact intended implementation head and the required durable files are present on remote `main`.
- `scripts/resolve_scheduled_collection_date.js` is a verified cron subset, not a general cron engine. Supported shapes remain `*`, integers, comma-separated integers, and simple integer ranges in standard five-field expressions.
- `github.event.schedule` is not an immutable occurrence timestamp. If a later identical cron occurrence has already passed, reconstruction is ambiguous; do not claim exactness without an independent durable occurrence identifier.

## Completed — first wave

Implementation/test head:

`53a32a03f5fd340c09876dc94ea22360f17359f4`

Regression run:

`33353663345`

Handoff checkpoint:

`5704095d91b7456af97f70d3a96fd88ca4e7ab56`

Shared implementation:

- `scripts/resolve_scheduled_collection_date.js`
  - `resolveScheduledOccurrence`
  - `resolveScheduledCollectionDate`
  - `resolveForEvent`
  - `applyCollectionPolicy`
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

Implementation/test head:

`27ce0b0e1eb8eb9beabe2a8a087571bc4cd47bb1`

Regression run:

`33354868624`

Closeout checkpoint before third-wave handoff hardening:

`89a2ade5cbe15e9e0858cb607cc699fc7fbf9878`

Second-wave scope:

- `.github/workflows/build-twse-market-chart.yml`
- `.github/workflows/calculate-twse-margin-maintenance.yml`
- `.github/workflows/crawl-market-news.yml`
- `.github/workflows/publish-daily-gainers-ai-analysis.yml`
- `.github/workflows/prepare-market-environment.yml`

Key preserved semantics:

- Market chart: scheduled occurrences use the existing 08:00 business-day boundary without runner `-8h` dependence.
- Margin maintenance: scheduled runs use logical `same_trade_date`; legacy manual-no-date behavior remains separate.
- Market news: crawler and risk snapshot share one explicit logical collection date.
- Daily Gainers publish: mode comes from logical scheduled occurrence, not runner hour.
- Market Environment: logical `scheduled_at_utc` anchors existing forecast-date logic.

## Completed — third wave

### Implementation / closeout identity

Third-wave implementation/test head:

`63c2c4a2867944cb6522c0f14715a1c23dd19109`

Exact-head regression run:

`33365436045`

Regression job:

`99404991901`

Regression conclusion:

`success`

Exact-head evidence from the run:

- run `head_sha`: `63c2c4a2867944cb6522c0f14715a1c23dd19109`
- claimed implementation/test head: `63c2c4a2867944cb6522c0f14715a1c23dd19109`
- workflow `TESTED_SHA`: `63c2c4a2867944cb6522c0f14715a1c23dd19109`
- materialization base: `https://raw.githubusercontent.com/EasonLiu0913/stock_data/${TESTED_SHA}`
- printed tested commit: `63c2c4a2867944cb6522c0f14715a1c23dd19109`
- deterministic test result: 27 tests, 27 pass, 0 fail

The regression harness now materializes regression inputs from the run's exact `${github.sha}` / `${GITHUB_SHA}` equivalent, not moving `/main`.

### Third-wave bounded scope verification

Compare from pre-third-wave durable main `411a3ad933850b5a410eccbe1d0029bd53307143` to implementation/test head `63c2c4a2867944cb6522c0f14715a1c23dd19109` contained only:

- `.github/workflows/crawl-external-market-indicators.yml`
- `.github/workflows/crawl-refined-product-tightness.yml`
- `.github/workflows/crawl-rankings.yml`
- `.github/workflows/crawl-taifex-major-institutional-traders-futures-contracts.yml`
- `.github/workflows/test-scheduled-collection-date.yml`
- `scripts/resolve_external_market_session_date.js`
- `scripts/resolve_fubon_ranking_date.js`
- `scripts/resolve_taifex_scheduled_date.js`
- `scripts/scraper_fubon.js`
- `scripts/scraper_fubon_foreign.js`
- `scripts/scraper_fubon_other.js`
- `tests/scheduled_date_third_wave.test.js`

No TDCC, CNN Fear & Greed, TAIFEX futures/options source-payload workflow, prediction/replay workflow, or other production workflow was migrated in third wave.

### External market — PASS

Entry points:

- `.github/workflows/crawl-external-market-indicators.yml`
- `scripts/crawl_external_market_indicators.js`
- `scripts/resolve_external_market_session_date.js`

Preserved contract:

- scheduled workflow first resolves intended occurrence with `scripts/resolve_scheduled_collection_date.js`;
- occurrence timestamp is passed as `--now` to `scripts/resolve_external_market_session_date.js`;
- that helper delegates to the existing `scripts/crawl_external_market_indicators.js --resolve-date` logic under an isolated anchored clock, so the canonical New York 09:30 session rule remains one source of truth;
- source market date, provisional/final status, validation, skip-existing behavior, and manual explicit date remain owned by the existing crawler/validator path;
- regression proves a delayed runner crossing a New York date/session boundary does not move the requested session.

### EIA refined-product tightness — PASS

Entry points:

- `.github/workflows/crawl-refined-product-tightness.yml`
- `scripts/crawl_refined_product_tightness.js`
- `tests/refined_product_tightness.test.js`

Preserved contract:

- only scheduled query upper bound is occurrence-derived;
- upper bound is the intended occurrence's UTC calendar date;
- manual explicit date remains authoritative;
- manual no-date still uses existing crawler default behavior;
- source/API aligned `observation_date` remains the canonical artifact date;
- force/reuse behavior, methodology, and factor calculations were not changed.

### Fubon rankings — PASS

Entry points:

- `.github/workflows/crawl-rankings.yml`
- `scripts/resolve_fubon_ranking_date.js`
- `scripts/scraper_fubon.js`
- `scripts/scraper_fubon_foreign.js`
- `scripts/scraper_fubon_other.js`

Preserved contract:

- source page `MM/DD` remains authoritative for month/day;
- `FUBON_DATE_ANCHOR` is only the deterministic year-inference anchor;
- all three scripts use `resolveFubonRankingDate`;
- no scheduled artifact naming uses runner `new Date().getFullYear()` or runner current-date fallback;
- missing/malformed/invalid source page date throws before official dated CSV write;
- failures surface as non-success rather than inventing a source date;
- Dec/Jan rollover and missing/malformed date failure are deterministic regression cases;
- foreign-ranking retry/backoff/pacing and output naming shape remain intact; workflow commit scope remains `data_fubon/`.

### TAIFEX futures contracts — PASS

Entry points:

- `.github/workflows/crawl-taifex-major-institutional-traders-futures-contracts.yml`
- `scripts/resolve_taifex_scheduled_date.js`
- `scripts/crawl_taifex_major_institutional_traders_futures_contracts.js`
- `data_history_sma/non_trading_days.json`

Preserved contract:

- scheduled base date comes from intended occurrence interpreted in `Asia/Taipei`;
- existing backward rollback across weekends/configured non-trading days is preserved by `scripts/resolve_taifex_scheduled_date.js`;
- explicit rolled-back date is passed to the existing crawler;
- manual single-date and range branches remain unchanged;
- no batching architecture change was introduced in this date-semantics wave.

### Shared resolver contract — PASS

No new cron grammar was introduced. Third-wave expressions use only already-supported integer / wildcard / weekday forms. The implementation does not add claims that ambiguous reconstruction after a later identical occurrence is exact.

### Prediction/replay non-regression — PASS

Protected blobs on third-wave implementation/test head:

- `scripts/resolve_latest_complete_prediction_base.js`: `61800be23d488bdf67874e87db492e8dc947b110`
- `scripts/resolve_prediction_replay_date.js`: `9dd7c74bbe73c4088138b7b1262a8fed71608ff7`

These match the protected pre-third-wave identities.

## Current repository state

Third-wave implementation/test head at closeout start:

`63c2c4a2867944cb6522c0f14715a1c23dd19109`

Third-wave exact-head regression:

`33365436045`

The handoff checkpoint commit created by this closeout is the next durable state. After committing it, re-fetch `main` and verify no concurrent production change has made this handoff stale before starting another round.

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

### Third-wave helpers retained as current production entry points

- `scripts/resolve_external_market_session_date.js`
- `scripts/resolve_fubon_ranking_date.js`
- `scripts/resolve_taifex_scheduled_date.js`

### Prediction/replay safety gates — do not weaken

- `scripts/resolve_latest_complete_prediction_base.js`
- `scripts/resolve_prediction_replay_date.js`

### Next-round exact audit entry points

TDCC shareholding snapshot:

- `.github/workflows/crawl-tdcc-shareholding-snapshot.yml`
- `scripts/crawl_tdcc_shareholding_snapshot.js`
- `tests/tdcc_shareholding_snapshot.test.js`
- durable date fields to classify: source row `observed_date`, archive `captured_at`, conservative `available_at`

CNN Fear & Greed:

- `.github/workflows/crawl-cnn-fear-and-greed.yml`
- `scripts/crawl_cnn_fear_and_greed.js`
- source date currently comes from `fear_and_greed.timestamp` -> `dataDate`

TAIFEX futures/options source payload:

- `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml`
- `scripts/crawl_taifex_major_institutional_traders_futures_options.js`
- `getPayloadDate(csvText)` reads canonical payload date from the first source data row
- manual `--date` is only an expected-date validation against the latest-only open-data payload

## Known problems / rejected approaches

- Do not automatically migrate a scheduled workflow merely because it has multiple cron probes. Probe time and artifact/business date are different concepts.
- TDCC `observed_date` is source-derived; `available_at` is a conservative first-successful-capture timestamp and must not be backdated to the scheduled occurrence without a separately justified methodology change.
- CNN `dataDate` is source timestamp-derived. A scheduled occurrence must not overwrite it unless audit finds a separate runner-derived business-date bug.
- TAIFEX futures/options currently names the artifact from the payload date. The next round must determine whether schedule delay only affects which latest payload is observed or whether an explicit expected-date anchor is necessary for correctness. Do not assume it should copy the futures-contract policy; the API behavior is different.
- Do not migrate prediction/replay as part of this project without separate preregistration.

## Next round — fourth-wave source-derived semantics audit only

Audit exactly these three workflows and their named scripts/tests:

1. `.github/workflows/crawl-tdcc-shareholding-snapshot.yml`
2. `.github/workflows/crawl-cnn-fear-and-greed.yml`
3. `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml`

This is an **audit/classification round, not a production migration round**.

For each workflow, document separately:

- trigger/probe occurrence semantics;
- canonical source/business date;
- capture/availability timestamp semantics;
- manual-date behavior;
- whether actual runner wall clock participates in artifact naming, business-date validation, or only capture metadata;
- delayed-runner behavior across UTC/Taipei/source-market boundaries;
- whether any defect is actually present;
- if a defect exists, the exact smallest next implementation scope and regression cases required.

Expected default hypotheses to test, not assume:

- TDCC: likely source-derived `observed_date` with capture-time `available_at`; schedule may need no date migration.
- CNN Fear & Greed: likely source timestamp-derived `dataDate`; schedule may need no date migration.
- TAIFEX futures/options: payload date is source-derived, but delayed latest-only fetch may need explicit expected-date semantics or may intentionally remain latest-source driven; audit before deciding.

Stop after the audit checkpoint. Do not edit the three production workflows/scripts in Prompt A unless a prerequisite test/inspection helper that does not change production semantics is strictly necessary. Any actual migration must be preregistered in the following handoff first.

## Safety / stop conditions

- If current `main` materially changes any next-round entry point before audit, refresh this handoff before drawing conclusions.
- Do not replace source-derived dates with scheduled dates.
- Do not backdate TDCC `available_at` to observation or schedule time.
- Do not convert CNN source timestamp into scheduled artifact date.
- Do not assume TAIFEX futures/options behaves like the TAIFEX futures-contract crawler; the source APIs differ.
- Do not treat `resolve_scheduled_collection_date.js` as a general cron engine.
- Do not claim exact intended occurrence after a later identical cron occurrence has passed without an independent durable occurrence identifier.
- Do not modify prediction/replay stale fallback behavior.
- Do not expand beyond the three preregistered audit workflows.

## Prompt A — Next-round implementation prompt

Continue the Scheduled Workflow Date Semantics Migration in repository `EasonLiu0913/stock_data`.

This round is a bounded **source-derived date semantics audit**, not a production migration.

Before doing any work:
1. Read `AGENTS.md`.
2. Read `docs/project-philosophy.md` and `docs/roadmap/current-phase.md`.
3. Read the canonical handoff: `docs/handoffs/scheduled-workflow-date-semantics.md`.
4. Fetch current remote `main`; do not rely on local/conversation state.
5. Verify the handoff checkpoint and the following exact entry points have not materially changed since the checkpoint. If they have, refresh the handoff before continuing.
6. Read exactly:
   - `.github/workflows/crawl-tdcc-shareholding-snapshot.yml`
   - `scripts/crawl_tdcc_shareholding_snapshot.js`
   - `tests/tdcc_shareholding_snapshot.test.js`
   - `.github/workflows/crawl-cnn-fear-and-greed.yml`
   - `scripts/crawl_cnn_fear_and_greed.js`
   - `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml`
   - `scripts/crawl_taifex_major_institutional_traders_futures_options.js`
   - `scripts/resolve_scheduled_collection_date.js`
   - `.github/workflows/test-scheduled-collection-date.yml`

Audit only these three workflows:

1. TDCC shareholding snapshot
2. CNN Fear & Greed
3. TAIFEX futures/options source payload

For each one, produce repository-durable findings covering:

- schedule/probe occurrence role;
- authoritative source/business date and exact field/function/path;
- capture/availability timestamp role;
- manual date behavior;
- any use of runner `new Date()` / timezone-derived date that can affect official artifact naming or validation;
- delayed-runner boundary cases;
- whether a real date-semantics defect exists;
- whether no migration is the correct conclusion.

Frozen constraints:

- TDCC source `observed_date` must not be replaced by scheduled date.
- TDCC `available_at` remains conservative first successful archive capture time; do not backdate it.
- CNN source `fear_and_greed.timestamp` / `dataDate` remains source-derived unless the audit proves a distinct bug.
- TAIFEX futures/options artifact date currently comes from `getPayloadDate(csvText)` and must not be replaced speculatively.
- Manual explicit behavior must remain intact.
- Do not modify prediction/replay.
- Do not expand to any workflow outside the three named audit targets.
- Do not implement a production migration in this round. If a defect is found, preregister the smallest implementation + tests in the next handoff instead.

Required audit evidence:

- exact current `main` SHA;
- exact blob SHAs for the three workflows and their crawler/test entry points;
- concise delayed-runner boundary analysis for each source;
- explicit decision for each: `no_migration`, `needs_migration_next_round`, or `needs_more_source_evidence`;
- exact proposed implementation/test paths for any `needs_migration_next_round` result.

Prompt A completion contract:

- all three sources are independently classified;
- no production semantics were changed;
- findings are written into this canonical handoff (or a directly linked repository document if the handoff would become unwieldy);
- next migration scope, if any, is preregistered with paired Prompt A + Prompt B;
- current remote `main` is re-fetched and the audit checkpoint is verified durable;
- then report exactly `Prompt A complete — ready for Prompt B` and stop.

## Prompt B — Next-round closeout / verification prompt

Perform the mandatory closeout review for the fourth-wave source-derived Scheduled Workflow Date Semantics audit in repository `EasonLiu0913/stock_data`.

Before verifying:
1. Read `AGENTS.md`.
2. Read `docs/handoffs/scheduled-workflow-date-semantics.md`.
3. Fetch current remote `main`; do not verify only local state or the Prompt A summary.

Independently enforce every preregistered audit criterion.

1. **Bounded scope**
   - Audit is limited to TDCC, CNN Fear & Greed, and TAIFEX futures/options source payload plus directly necessary documentation/test-only inspection helpers.
   - No production date-semantics migration was made in this audit round.
   - No prediction/replay or unrelated workflow was changed.

2. **TDCC source-date classification**
   - Verify `scripts/crawl_tdcc_shareholding_snapshot.js` derives canonical `observed_date` from source rows.
   - Verify `available_at` remains first successful archive capture time and was not backdated to scheduled occurrence.
   - Verify the audit explicitly distinguishes probe schedule, source observation date, `captured_at`, and `available_at`.

3. **CNN source-date classification**
   - Verify `scripts/crawl_cnn_fear_and_greed.js` derives `dataDate` from `fear_and_greed.timestamp`.
   - Verify no audit conclusion substitutes scheduled date for that source timestamp.
   - Verify delayed-runner analysis distinguishes source data freshness from runner execution time.

4. **TAIFEX futures/options classification**
   - Verify `getPayloadDate(csvText)` remains the source of artifact date.
   - Verify manual `--date` remains an expected-date check against the latest-only source payload.
   - Verify the audit explicitly decides whether delayed execution creates a correctness defect, and does not copy the futures-contract rollback policy without evidence.

5. **Shared resolver / occurrence limits**
   - Verify no unsupported cron grammar or false exactness claim was introduced.
   - If the audit recommends a future occurrence-based check, its ambiguity and supported cron subset are documented.

6. **Durable evidence**
   - Record current `main` and exact blob identities used by the audit.
   - Verify the audit findings and classifications exist on remote `main`, not only in chat.

7. **Next-round preregistration**
   - Every source has one explicit decision: `no_migration`, `needs_migration_next_round`, or `needs_more_source_evidence`.
   - Any future migration is bounded to exact paths and deterministic regression cases before implementation begins.
   - Paired Prompt A + Prompt B for the following round are present in the canonical handoff.

If any criterion fails, fix only the bounded audit/documentation defect and repeat Prompt B.

If all criteria pass, update and commit `docs/handoffs/scheduled-workflow-date-semantics.md` with the verified classifications and the exact next bounded scope. Re-fetch `main` after the handoff commit and confirm the handoff is not stale, then stop. Do not begin the next Prompt A automatically.
