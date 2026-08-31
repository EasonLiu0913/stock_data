# Scheduled Workflow Date Semantics Migration

Canonical handoff: `docs/handoffs/scheduled-workflow-date-semantics.md`

## Current phase

### Pending closeout — sixth-wave residual scheduled-date audit

Round identity: `sixth-wave-residual-scheduled-date-audit`

Prompt A starting baseline: `6f2401f9b66c91ffd93411a14a228b2205aecaee`

Prompt A status: implementation/audit work complete; waiting for the preregistered sixth-wave Prompt B closeout.

Prompt B closeout: NOT YET RUN.

This round was audit/classification only. No production workflow, script, test, config, or data file was changed.

### Preregistered future round — seventh-wave residual clock-owned target migration

Future round identity: `seventh-wave-mops-vix-scheduled-target-migration`

Status: preregistered future work only. It is not active until sixth-wave Prompt B closeout passes.

Future scope is limited to the two sixth-wave findings classified `needs_separate_preregistered_migration`:

- MOPS monthly revenue automatic target month;
- VIX automatic target market date.

Do not start this round automatically.

## Objective

Make scheduled collection/business dates delay-safe while preserving each workflow's true domain policy and source-of-truth date semantics.

Architecture remains intentionally small:

1. reconstruct the intended scheduled occurrence only when the schedule logically owns an expected business date;
2. map the occurrence through the domain-specific business-date policy;
3. preserve source/API-derived observation dates as canonical when the upstream payload owns the business date;
4. preserve repository/latest-complete-data ownership where repository state, not runner time, is authoritative.

Do not use the historical D1-D7 audit taxonomy as production policy identifiers.

## Frozen decisions / constraints

- Manual explicit dates remain authoritative.
- Source/API-derived dates remain source-derived when they are canonical business dates.
- Repository/latest-complete-data workflows remain repository-driven.
- Do not silently fall back to an older trading date unless that fallback is an explicit preserved domain policy.
- Prediction/replay stale-data safety gates must not be weakened.
- Preserve crawler outputs, validation gates, persistence, and plan + fresh-runner physical-batch architecture.
- Shared infrastructure must remain small and evidence-driven; do not build a scheduler/DAG/plugin framework.
- Known exact repo-relative entry points must be carried forward in prompts and handoffs.
- A green workflow is not completion unless the tested implementation is the intended implementation head and durable remote state is verified.
- `scripts/resolve_scheduled_collection_date.js` remains a verified cron subset, not a general cron engine. Supported shapes are wildcard, integer, comma-separated integers, and simple integer ranges in five-field expressions.
- `github.event.schedule` is not an immutable occurrence timestamp. If a later identical cron occurrence has already passed, reconstruction is ambiguous without an independent durable occurrence identifier.
- TDCC source `observed_date` must remain source-derived; `available_at` remains conservative first successful archive capture time and must not be backdated.
- CNN source `fear_and_greed.timestamp` / `dataDate` must remain source-derived.
- TAIFEX futures/options artifact naming remains payload-date derived through `getPayloadDate(csvText)`; scheduled date is expected-date validation only.
- Do not migrate prediction/replay in this project without separate preregistration.

## Completed rounds

### First wave

Implementation/test head: `53a32a03f5fd340c09876dc94ea22360f17359f4`

Regression run: `33353663345`

Handoff checkpoint: `5704095d91b7456af97f70d3a96fd88ca4e7ab56`

Shared entry points:

- `scripts/resolve_scheduled_collection_date.js`
- `scripts/resolve_forecast_dates.js`
- `tests/resolve_scheduled_collection_date.test.js`
- `.github/workflows/test-scheduled-collection-date.yml`

First-wave workflows already explicitly migrated/covered:

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

### Second wave

Implementation/test head: `27ce0b0e1eb8eb9beabe2a8a087571bc4cd47bb1`

Regression run: `33354868624`

Closeout checkpoint: `89a2ade5cbe15e9e0858cb607cc699fc7fbf9878`

Second-wave workflows already explicitly migrated/covered:

- `.github/workflows/build-twse-market-chart.yml`
- `.github/workflows/calculate-twse-margin-maintenance.yml`
- `.github/workflows/crawl-market-news.yml`
- `.github/workflows/publish-daily-gainers-ai-analysis.yml`
- `.github/workflows/prepare-market-environment.yml`

### Third wave

Implementation/test head: `63c2c4a2867944cb6522c0f14715a1c23dd19109`

Exact-head regression run: `33365436045`

Regression job: `99404991901`

Conclusion: success.

Third-wave production scope included:

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

### Fourth wave — source-derived semantics audit

Audit baseline: `e355f828935c5d45cee5d099dca0ab9aa6e51c63`

Audit findings commit: `303bd5b4342a6825f16dd22992378a4850707b25`

Closeout checkpoint: `2642a232b8cdee947e9120920a9dab3c4c61ae1b`

Prompt B closeout: PASS

Classifications:

- TDCC shareholding snapshot: `no_migration`
- CNN Fear & Greed: `no_migration`
- TAIFEX futures/options source payload: `needs_migration_next_round`

### Fifth wave — TAIFEX futures/options expected-date migration

Prompt A baseline: `2642a232b8cdee947e9120920a9dab3c4c61ae1b`

Implementation commit: `bf50cf55330fb3d7d6325643a972b9b96ea58471`

Bounded regression-fix commit / final implementation-test head: `5f3b3b3060319c2758166894e2f0ca8bdf41f2d6`

Prompt B closeout: PASS

Exact-head regression:

- workflow: `.github/workflows/test-scheduled-collection-date.yml`
- run ID: `33369408473`
- regression job ID: `99416854795`
- `head_sha`: `5f3b3b3060319c2758166894e2f0ca8bdf41f2d6`
- materialized/tested SHA: `5f3b3b3060319c2758166894e2f0ca8bdf41f2d6`
- conclusion: `success`
- deterministic tests: 34 pass, 0 fail

Exact fifth-wave changed-file set:

- `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml`
- `scripts/crawl_taifex_major_institutional_traders_futures_options.js`
- `tests/scheduled_date_fourth_wave.test.js`
- `.github/workflows/test-scheduled-collection-date.yml`

Protected blobs at fifth-wave closeout:

- `scripts/resolve_latest_complete_prediction_base.js`: `61800be23d488bdf67874e87db492e8dc947b110`
- `scripts/resolve_prediction_replay_date.js`: `9dd7c74bbe73c4088138b7b1262a8fed71608ff7`
- `.github/workflows/crawl-tdcc-shareholding-snapshot.yml`: `c6a5d2f6a8bd9720d75e2f6fd0c0d102d0d5b417`
- `.github/workflows/crawl-cnn-fear-and-greed.yml`: `7c7b9d3f9575365b7c79dd6391418586b9a45ee4`
- `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml`: `91b0724db5fb28c768dd2bb563e1232aef84d636`
- `scripts/crawl_taifex_major_institutional_traders_futures_options.js`: `560c42e82338629e2af5a3203a37b9a64571c945`
- `tests/scheduled_date_fourth_wave.test.js`: `fef19e2e46777fabd27700ae2b25a3a328d63401`

The fifth-wave crawler preserves source payload date as canonical artifact identity and treats the scheduled target only as expected-date validation. Manual no-date remains latest-source behavior. Known `github.event.schedule` identical-occurrence ambiguity remains explicitly bounded.

## Sixth-wave Prompt A audit evidence

### Freshness baseline

Fresh remote `main` at Prompt A start and immediately before the audit write was:

- `6f2401f9b66c91ffd93411a14a228b2205aecaee`

The only post-fifth-wave change to `.github/workflows/test-scheduled-collection-date.yml` at that head is commit `6f2401f9b66c91ffd93411a14a228b2205aecaee` (`test: pin schedule summary to tested sha`), which pins `write_workflow_schedule_summary.js` to `${{ github.sha }}`. It does not change fifth-wave TAIFEX date semantics, resolver grammar, protected prediction/replay logic, TDCC/CNN source-date ownership, or any production entry point.

Current workflow tree used for the deterministic inventory:

- `.github/workflows/` tree: `0c064e9f2ec1e3427bdc43e7c04fbfcfeee8b601`

### Deterministic residual scheduled-workflow inventory

The audit first accounted for the 22 scheduled workflows already explicitly migrated/classified by waves 1-5 above. The residual scheduled workflows and their classifications are below.

| Workflow | Classification | Exact date-semantics evidence |
| --- | --- | --- |
| `.github/workflows/analyze-daily-gainers-margin-flow-2200.yml` | `no_migration_source_or_repository_owned` | Scheduled/manual fallback chooses the latest repository `data_daily_gain_over_5/YYYYMMDD.json`; source-push mode derives the date from changed source-data paths. Business date is repository/source-file owned, not runner-clock owned. Material date logic is in the workflow; downstream deterministic builder is `scripts/build_daily_gainers_ai_facts.js`. |
| `.github/workflows/crawl-mops-monthly-revenue.yml` | `needs_separate_preregistered_migration` | Empty manual input calls `scripts/crawl_mops_monthly_revenue.js` `autoRevenueMonth()`, which uses `new Date()` in `Asia/Taipei` and selects the previous calendar month. A delayed occurrence crossing a month boundary can therefore change the requested revenue month. Tests: `tests/mops_monthly_revenue.test.js`. |
| `.github/workflows/crawl-pocket-00981a.yml` | `no_migration_source_or_repository_owned` | Runner Taipei date is only a retry/readiness comparison and operational `update_YYYYMMDD.json` marker. Canonical holdings/industry business dates and dated artifact filenames come from source API row dates in `scripts/crawl_pocket_00981A_holdings.js`. Do not promote the update marker date to source business-date authority. |
| `.github/workflows/crawl-sma.yml` | `already_migrated_or_covered` | Scheduled runs already pass `${{ github.event.schedule }}` to `scripts/resolve_scheduled_sma_target_date.js`, export intended `target_date` / `scheduled_at_utc`, and keep manual explicit/manual no-date behavior separate. `scripts/detect_latest_sma_date.js` remains the availability detector. |
| `.github/workflows/crawl-twse-quarterly-financial-quality.yml` | `no_migration_source_or_repository_owned` | `scripts/crawl_twse_quarterly_financial_quality.js` takes fiscal year/quarter from TWSE OpenAPI payload fields and writes `data_twse_quarterly_financial_quality/<period>/...`; runner time is only `generated_at`. Test: `tests/twse_quarterly_financial_quality.test.js`. |
| `.github/workflows/crawl-vix-index.yml` | `needs_separate_preregistered_migration` | Manual explicit date is authoritative; automatic scheduled path calls `scripts/crawl_vix_index.js --resolve-date` with no occurrence input. `resolveAutomaticTargetDate(now = new Date())` uses actual runner `America/New_York` date/time and the 17:00 cutoff, so a delayed occurrence crossing that boundary can change target market date. Tests: `tests/crawl_vix_index.test.js`, `tests/refresh_dataset_indexes.test.js`. |
| `.github/workflows/daily-gainers-over-5.yml` | `no_migration_source_or_repository_owned` | Automatic target is the latest `data_fubon/fubon_YYYYMMDD_sma.json` present in the git tree; Taipei runner time is only a freshness guard that skips stale latest-SMA state rather than selecting an older business date. Generator: `scripts/generate_daily_gainers_over_5.js`. |
| `.github/workflows/daily-prediction-replay.yml` | `no_migration_source_or_repository_owned` | `scripts/resolve_prediction_replay_date.js` selects the newest repository SMA date and requires matching V1/V2 manifests; it explicitly refuses silent fallback when newest state is incomplete. Manual explicit `replay_date` remains authoritative. This protected repository-owned policy is unchanged. |
| `.github/workflows/daily-stock-prediction.yml` | `no_migration_source_or_repository_owned` | With no manual `forecast_date`, `scripts/resolve_latest_complete_prediction_base.js` chooses the latest complete repository base and derives the forecast target. It does not use runner current date as target ownership. `scripts/resolve_forecast_dates.js` validates/expands that target. Protected safety gates are unchanged. |
| `.github/workflows/momentum-history-replay.yml` | `no_migration_source_or_repository_owned` | Scheduled/no-input path invokes `scripts/run_momentum_history_replay.js --latest`; selection is from completed/versioned Momentum snapshot repository state. Push/PR modes use latest completed snapshots as well. Schedule time is a retry opportunity, not target-date authority. |
| `.github/workflows/update-non-trading-days.yml` | `date_irrelevant` | `scripts/update_non_trading_days_from_twse_holidays.js` fetches the official TWSE holiday CSV and merges source rows into `data_history_sma/non_trading_days.json`; schedule date does not choose a business artifact date. Runner time appears only in commit message metadata. |
| `.github/workflows/update-official-market-constraints.yml` | `no_migration_source_or_repository_owned` | Empty manual target uses `scripts/finalize_prediction_market_context.js` repository `predictionDates().at(-1)` and requires `data_prediction_context/<target>/latest.json`. `${{ github.event.schedule }}` only selects finalization phase (`realtime_close` vs `official_final`), not target business date. |
| `.github/workflows/update-twse-industry.yml` | `date_irrelevant` | Scheduled task refreshes the current TWSE industry universe through `scripts/extract_twse_industry.js`; output identity is not a dated business artifact. Runner time is not used as a source/business date. |
| `.github/workflows/warrant-scraper.yml` | `no_migration_source_or_repository_owned` | `scripts/extract_warrant_data.js` derives the normal dated filename from the source page title/date range. The source title is canonical. Its legacy no-title fallback uses runner ISO date only as a degraded filename fallback and is not a scheduled target-date policy; do not reinterpret that fallback as canonical business-date ownership without a separate preregistered investigation. |

No residual scheduled workflow is left unclassified by this audit. Workflows inspected during inventory that do not contain a `schedule` trigger (for example history/backfill/manual/push-only workflows such as `.github/workflows/crawl-institutional-history.yml`, `.github/workflows/crawl-sma-history.yml`, `.github/workflows/crawl-twse-dealers-history.yml`, `.github/workflows/crawl-twse-foreign-investors-history.yml`, `.github/workflows/crawl-twse-institutional-investors-history.yml`, `.github/workflows/crawl-twse-institutional-summaries-range.yml`, `.github/workflows/crawl-wantgoo-margin-observation.yml`, `.github/workflows/refresh-daily-gainers-market-summary.yml`, `.github/workflows/refresh-mops-revenue-event-returns.yml`, `.github/workflows/deploy-pages.yml`, `.github/workflows/ensure-workflow-schedule-summary.yml`, `.github/workflows/publish-daily-gainers-news-summary.yml`, and `.github/workflows/publish-daily-gainers-unified-analysis.yml`) are outside the residual scheduled set.

### Sixth-wave migration candidates — deferred, not implemented

#### Candidate A — MOPS monthly revenue automatic month

Exact entry points:

- `.github/workflows/crawl-mops-monthly-revenue.yml`
- `scripts/crawl_mops_monthly_revenue.js`
- `tests/mops_monthly_revenue.test.js`
- shared candidate infrastructure only if needed: `scripts/resolve_scheduled_collection_date.js`
- shared regression workflow only if needed for exact-head verification: `.github/workflows/test-scheduled-collection-date.yml`

Frozen policy:

- manual explicit `workflow_dispatch.inputs.revenue_month` remains authoritative;
- scheduled automatic target is the previous Taipei calendar month relative to the intended scheduled occurrence, not runner start time;
- both monthly cron probes retain the same target-month policy;
- `include_previous_month`, previous-month baseline/rebuild logic, source URL construction, source `report_date`, first/last-seen timestamps, completeness rules, and persistence remain unchanged;
- no historical capability beyond the existing MOPS month-addressed URL may be invented.

#### Candidate B — VIX automatic market date

Exact entry points:

- `.github/workflows/crawl-vix-index.yml`
- `scripts/crawl_vix_index.js`
- `tests/crawl_vix_index.test.js`
- `tests/refresh_dataset_indexes.test.js`
- shared candidate infrastructure only if needed: `scripts/resolve_scheduled_collection_date.js`
- shared regression workflow only if needed for exact-head verification: `.github/workflows/test-scheduled-collection-date.yml`

Frozen policy:

- manual explicit `workflow_dispatch.inputs.date` remains authoritative;
- scheduled automatic target must be computed from the intended scheduled occurrence using the existing `America/New_York` 17:00 cutoff / previous-weekday rule, not actual runner time;
- exact Yahoo market-row validation remains mandatory; no silent fallback to an older source row;
- source market row date remains canonical artifact `date`, `requested_date`, and `market_date` after an exact match;
- plan-only, isolated output, safe publish/retry, `force`, refresh-indexes, and range/backfill behavior remain unchanged;
- no broader US holiday/calendar policy may be invented in this round.

## Current repository state

Sixth-wave Prompt A audit is complete and waiting for its preregistered Prompt B closeout.

Expected/actual sixth-wave changed-file set: `docs/handoffs/scheduled-workflow-date-semantics.md` only.

No sixth-wave production migration was performed.

The next round remains preregistered future work until sixth-wave Prompt B passes.

## Entry points

### Repository rules / canonical state

- `AGENTS.md`
- `docs/project-philosophy.md`
- `docs/roadmap/current-phase.md`
- `docs/handoffs/scheduled-workflow-date-semantics.md`

### Shared scheduled-date infrastructure

- `scripts/resolve_scheduled_collection_date.js`
- `scripts/resolve_forecast_dates.js`
- `scripts/resolve_taifex_scheduled_date.js`
- `tests/resolve_scheduled_collection_date.test.js`
- `tests/scheduled_date_third_wave.test.js`
- `tests/scheduled_date_fourth_wave.test.js`
- `.github/workflows/test-scheduled-collection-date.yml`
- `data_history_sma/non_trading_days.json`

### Source-derived controls preserved

TDCC:

- `.github/workflows/crawl-tdcc-shareholding-snapshot.yml`
- `scripts/crawl_tdcc_shareholding_snapshot.js`
- `tests/tdcc_shareholding_snapshot.test.js`

CNN:

- `.github/workflows/crawl-cnn-fear-and-greed.yml`
- `scripts/crawl_cnn_fear_and_greed.js`

TAIFEX futures/options:

- `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml`
- `scripts/crawl_taifex_major_institutional_traders_futures_options.js`

### Prediction/replay safety gates — do not weaken

- `scripts/resolve_latest_complete_prediction_base.js`
- `scripts/resolve_prediction_replay_date.js`

## Safety / stop conditions

- If current `main` materially changes an audited entry point, refresh affected evidence before closeout or implementation.
- Sixth wave is audit-only; no production migration belongs to this round.
- Do not infer migration need merely from presence of `schedule:` or multiple cron probes.
- Preserve all source-derived and repository-owned dates.
- Do not change prediction/replay.
- Do not broaden `scripts/resolve_scheduled_collection_date.js` cron grammar.
- If exact date ownership cannot be established in a future round, stop and document the unresolved point rather than guessing.

## Preregistered Prompt A — sixth-wave residual scheduled-date audit

Continue the Scheduled Workflow Date Semantics Migration in repository `EasonLiu0913/stock_data`.

Active round: `sixth-wave-residual-scheduled-date-audit`.

This round is a bounded **audit/classification-only** round. Do not implement another production migration in the same round.

Before doing any work:
1. Read `AGENTS.md`.
2. Read `docs/project-philosophy.md` and `docs/roadmap/current-phase.md`.
3. Read the canonical handoff: `docs/handoffs/scheduled-workflow-date-semantics.md`.
4. Fetch current remote `main`; do not rely on local or conversation state.
5. Verify the fifth-wave closeout checkpoint and current blobs/entry points have not materially changed.
6. Inspect `.github/workflows/` and enumerate workflow YAML files that contain a `schedule` trigger.
7. Exclude only workflows already explicitly classified or migrated in this handoff after confirming their current paths still exist.

Audit only:

1. Build a deterministic residual inventory of scheduled workflows not yet explicitly classified by this handoff.
2. For each residual workflow, inspect its exact repo-relative workflow path plus every exact script/config/test path that materially determines its date/business-date behavior.
3. Classify each as exactly one of:
   - `already_migrated_or_covered`
   - `no_migration_source_or_repository_owned`
   - `needs_separate_preregistered_migration`
   - `date_irrelevant`
4. Record the evidence for each classification in `docs/handoffs/scheduled-workflow-date-semantics.md`.
5. For every `needs_separate_preregistered_migration`, list exact known workflow/script/test/config entry points and the preserved domain policy, but do not implement it.
6. Preserve TDCC, CNN, TAIFEX, prediction/replay, and all prior migrated contracts unchanged.
7. If no residual workflow requires migration, record that the migration project has no currently identified production candidate and preregister a final verification/retirement round rather than inventing new implementation work.

Bounded write scope:

- expected repository change: `docs/handoffs/scheduled-workflow-date-semantics.md` only;
- production workflow/script/test changes are forbidden unless a directly relevant freshness/correctness defect makes a bounded repair necessary and is documented.

Stop conditions:

- If exact date ownership cannot be established for a residual workflow, mark it unresolved; do not guess or implement.
- If current `main` changes materially during the audit, refresh affected evidence before completion.
- Do not turn audit findings into same-round production changes.

Prompt A completion contract:

- every residual scheduled workflow has an explicit classification or an explicit unresolved status with exact paths;
- any future migration candidate has exact entry points and preserved policy recorded;
- bounded changed-file set is proven;
- current remote `main` is re-fetched and the audit handoff is durable;
- paired next-round Prompt A + Prompt B are preregistered in the handoff before reporting completion;
- then report exactly `Prompt A complete — ready for Prompt B` and stop.

## Preregistered Prompt B — sixth-wave residual scheduled-date audit closeout

Perform closeout verification for active round `sixth-wave-residual-scheduled-date-audit` in repository `EasonLiu0913/stock_data`.

Before verification:
1. Read `AGENTS.md`.
2. Read `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, and `docs/handoffs/scheduled-workflow-date-semantics.md` from current remote `main`.
3. Fetch current remote `main` and recover the sixth-wave Prompt A baseline and audit findings commit from durable repository history.
4. Use this preregistered Prompt B from the pre-Prompt-A handoff checkpoint as the only closeout version.

Verify independently:

1. **Bounded scope**
   - The audit changed `docs/handoffs/scheduled-workflow-date-semantics.md` only, unless a strictly necessary freshness repair is explicitly documented and bounded.
   - No production scheduled-date migration was performed in the audit round.
   - Prediction/replay protected blobs remain unchanged.

2. **Residual inventory completeness**
   - Re-enumerate `.github/workflows/` workflow YAML files containing a `schedule` trigger from current remote `main`.
   - Verify every residual workflow not already classified/migrated by the handoff appears in the sixth-wave audit table or is explicitly accounted for as already covered.
   - No workflow may be omitted merely because its date logic is indirect.

3. **Classification quality**
   - Every residual item is exactly one of `already_migrated_or_covered`, `no_migration_source_or_repository_owned`, `needs_separate_preregistered_migration`, `date_irrelevant`, or explicitly unresolved.
   - Each classification cites exact repo-relative workflow/script/config/test entry points that establish date ownership.
   - No migration need is inferred solely from cron presence or multiple probes.

4. **Protected invariants**
   - TDCC `observed_date` / conservative `available_at` semantics remain unchanged.
   - CNN source timestamp / `dataDate` semantics remain unchanged.
   - TAIFEX futures/options payload-date artifact identity and mismatch failure remain unchanged.
   - `scripts/resolve_scheduled_collection_date.js` cron grammar was not broadened.
   - Prediction/replay safety gates remain unchanged.

5. **Future-candidate preregistration**
   - Every `needs_separate_preregistered_migration` candidate has exact known workflow/script/test/config entry points, frozen domain policy, stop conditions, a bounded Prompt A, and a phase-specific Prompt B preregistered before any implementation.
   - If there is no candidate, the next paired prompts must be a final verification/retirement round rather than speculative implementation.

6. **Durable evidence**
   - Re-fetch current remote `main` after any audit write.
   - Verify the audit findings and paired next-round prompts are present in the canonical handoff on remote `main`.
   - Verify the audit commit is reachable from current `main`.
   - Treat a local summary or green unrelated workflow as insufficient evidence.

If any criterion fails, fix only the bounded audit/freshness defect and repeat this Prompt B from criterion 1.

If closeout passes:

- update the canonical handoff with sixth-wave closeout evidence;
- mark `Prompt B closeout: PASS`;
- promote only the already-preregistered next round;
- commit the handoff;
- re-fetch current remote `main` and verify the handoff is durable and not stale;
- then stop. Do not start the next Prompt A automatically.

## Preregistered Prompt A — seventh-wave MOPS + VIX scheduled target migration

Continue the Scheduled Workflow Date Semantics Migration in repository `EasonLiu0913/stock_data`.

Future round identity: `seventh-wave-mops-vix-scheduled-target-migration`.

Do not execute this Prompt A unless the sixth-wave residual audit has completed Prompt B closeout with PASS and this round is promoted to active in the canonical handoff.

Before doing any work:
1. Fetch current remote `main`; do not rely on local or conversation state.
2. Read `AGENTS.md`, `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, and this canonical handoff.
3. Recover the sixth-wave audit/closeout evidence and confirm only these two candidates were promoted.
4. Re-read exact entry points:
   - `.github/workflows/crawl-mops-monthly-revenue.yml`
   - `scripts/crawl_mops_monthly_revenue.js`
   - `tests/mops_monthly_revenue.test.js`
   - `.github/workflows/crawl-vix-index.yml`
   - `scripts/crawl_vix_index.js`
   - `tests/crawl_vix_index.test.js`
   - `tests/refresh_dataset_indexes.test.js`
   - `scripts/resolve_scheduled_collection_date.js`
   - `.github/workflows/test-scheduled-collection-date.yml`
5. Verify the frozen policies and these entry points have not materially changed.

Implement only the following bounded migrations:

### Stage 1 — MOPS monthly revenue

- Preserve manual explicit `revenue_month` exactly.
- For scheduled runs only, reconstruct the intended scheduled occurrence using the existing bounded shared resolver or an equally small already-established seam.
- Derive the automatic MOPS target as the previous Taipei calendar month relative to that intended occurrence.
- Do not use runner actual start time to select the scheduled revenue month.
- Preserve `include_previous_month`, baseline/rebuild logic, source `report_date`, first/last-seen semantics, completeness rules, source URL behavior, persistence, and manual no-date semantics.
- Add deterministic tests for at least a delayed run crossing a Taipei month boundary and a normal same-month delay.

Intermediate gate: MOPS tests and syntax checks must pass. This is not round completion; continue to Stage 2.

### Stage 2 — VIX

- Preserve manual explicit `date` exactly.
- For scheduled runs only, reconstruct the intended scheduled occurrence and feed that occurrence into the existing `America/New_York` 17:00 cutoff / previous-weekday rule.
- Do not use runner actual start time to select the scheduled VIX target.
- Preserve exact Yahoo source-row validation, no silent fallback, source-row canonical artifact dates, isolated output + safe publish, `force`, plan-only, refresh-indexes, and range/backfill behavior.
- Do not invent a US holiday calendar or broaden the date policy beyond the existing weekday/cutoff behavior.
- Add deterministic tests for a delayed run crossing the New York 17:00 cutoff / date boundary and a normal delay.

Intermediate gate: VIX tests and syntax checks must pass. This is not round completion.

### Stage 3 — regression and durable verification

- Update `.github/workflows/test-scheduled-collection-date.yml` only as required to cover the two new contracts and exact-head materialization.
- Do not broaden `scripts/resolve_scheduled_collection_date.js` cron grammar.
- Keep TDCC, CNN, TAIFEX, prediction/replay, prior migrated workflows, and unrelated research/data workflows unchanged.
- Run deterministic relevant tests and the exact-head scheduled-date regression contract.
- Re-fetch current remote `main`; prove implementation commits, expected blobs, tests, tested SHA, protected invariants, and bounded changed-file set are durable.
- Update this handoff with Prompt A completion evidence while retaining the preregistered seventh-wave Prompt B below.
- Preregister the following round's Prompt A + Prompt B before declaring completion; if no remaining production candidate exists, preregister a final verification/retirement round.

Expected production changed-file set is limited to:

- `.github/workflows/crawl-mops-monthly-revenue.yml`
- `scripts/crawl_mops_monthly_revenue.js`
- `tests/mops_monthly_revenue.test.js`
- `.github/workflows/crawl-vix-index.yml`
- `scripts/crawl_vix_index.js`
- `tests/crawl_vix_index.test.js`
- optionally `tests/refresh_dataset_indexes.test.js` only if exact existing index behavior needs explicit regression coverage;
- optionally `.github/workflows/test-scheduled-collection-date.yml` for regression wiring;
- optionally `scripts/resolve_scheduled_collection_date.js` only if a strictly necessary backward-compatible seam is required, with cron grammar unchanged;
- this canonical handoff.

Stop conditions:

- If either candidate's frozen domain policy cannot be preserved without broad architecture change, stop that candidate and document the blocker; do not improvise.
- If a current-main change materially alters either candidate, refresh evidence before implementation.
- Do not add any third production migration candidate in this round.

Only after all three stages and durable verification pass, report exactly `Prompt A complete — ready for Prompt B` and stop. Do not execute Prompt B or another Prompt A.

## Preregistered Prompt B — seventh-wave MOPS + VIX scheduled target migration closeout

Perform phase-closeout verification for round `seventh-wave-mops-vix-scheduled-target-migration` in repository `EasonLiu0913/stock_data`.

Before verification:
1. Fetch current remote `main` and read `AGENTS.md`, project philosophy, current roadmap, and this canonical handoff.
2. Recover the seventh-wave Prompt A baseline, implementation/test head, and this preregistered Prompt B from durable pre-Prompt-A history.
3. Do not use a later future Prompt B as the acceptance contract.

Verify independently:

1. **Bounded scope**
   - Changed files are limited to the preregistered MOPS/VIX entry points, strictly necessary shared regression/seam files, and handoff.
   - No third production workflow was migrated.
   - TDCC, CNN, TAIFEX, prediction/replay, and prior migration contracts are unchanged.

2. **MOPS occurrence semantics**
   - Manual explicit `revenue_month` is unchanged and authoritative.
   - Scheduled automatic target is previous Taipei calendar month relative to intended scheduled occurrence, not runner start time.
   - Delayed month-boundary and normal-delay deterministic tests exist and pass.
   - Baseline/rebuild, source report date, timestamps, completeness, persistence, and source URL behavior remain unchanged.

3. **VIX occurrence semantics**
   - Manual explicit `date` is unchanged and authoritative.
   - Scheduled automatic target is derived from intended occurrence using the existing New York 17:00 cutoff / previous-weekday rule.
   - Exact Yahoo market-row validation and no-silent-fallback behavior remain intact.
   - Source market row remains canonical artifact date.
   - No US holiday-calendar policy was invented.
   - Delayed cutoff/date-boundary and normal-delay tests exist and pass.

4. **Shared resolver / protected invariants**
   - `scripts/resolve_scheduled_collection_date.js` cron grammar is not broadened.
   - Existing first-through-fifth-wave contracts still pass.
   - Prediction/replay protected blobs/behavior remain unchanged unless a separate preregistered freshness repair is explicitly justified.

5. **Exact-head regression identity**
   - Regression tests materialize and test the implementation head SHA, not moving `/main`.
   - Tested/materialized SHA equals the intended seventh-wave implementation/test head.
   - Relevant deterministic tests and scheduled-date regression pass.

6. **Durable completion**
   - Re-fetch current remote `main` after all writes.
   - Verify implementation commits are reachable, expected files/blobs are present, bounded changed-file set holds, and canonical handoff contains seventh-wave completion evidence plus the already-preregistered next pair.

If any criterion fails, fix only the bounded seventh-wave defect and repeat this Prompt B from criterion 1.

If closeout passes, update the canonical handoff with Prompt B PASS evidence, promote only the already-preregistered next round, commit, re-fetch remote `main`, verify durability, and stop. Do not start the next Prompt A automatically.
