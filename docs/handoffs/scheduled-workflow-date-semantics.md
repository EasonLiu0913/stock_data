# Scheduled Workflow Date Semantics Migration

Canonical handoff: `docs/handoffs/scheduled-workflow-date-semantics.md`

## Current phase

### Completed round — sixth-wave residual scheduled-date audit

Round identity: `sixth-wave-residual-scheduled-date-audit`

Prompt A baseline: `6f2401f9b66c91ffd93411a14a228b2205aecaee`

Prompt A audit findings commit: `ce419d0640603cada035ea4e915381bb42b2a462`

Prompt B closeout checkpoint: `82077179f4e785d49230667385ba1c15972890cc`

Prompt B closeout: PASS

The sixth wave was audit/classification only. No production workflow, script, test, config, or data file changed in Prompt A.

### Post-sixth-wave bounded hardening — warrant source-date fail-closed

A closeout review found one degraded fallback correctness defect in the warrant scraper: normal artifact dates were source-title-derived, but a missing source title could fall back to runner UTC date and the extractor step used `continue-on-error: true`.

Bounded repair commits:

- `5be7eddeb0bb3f90867b64c55d9c85b340803d5a` — `fix: fail closed on warrant source date`
- `2085dfc1f91c94626d96b6cbac3be8c00baf955c` — `test: cover warrant source-date filename contract`
- `2e5a26f7163ab892dd36e795e24bea32d6f9a794` — `fix: stop warrant workflow on unverified source date`
- `d1275ce13a2adfdb24fe11c8d74b493ca40528fc` — `test: guard warrant source-date ownership`

Exact-head regression:

- workflow: `.github/workflows/test-scheduled-collection-date.yml`
- run ID: `33373951803`
- regression job ID: `99431081251`
- tested/materialized SHA: `d1275ce13a2adfdb24fe11c8d74b493ca40528fc`
- conclusion: `success`
- deterministic tests: 38 pass, 0 fail

Hardened warrant contract:

- `.github/workflows/warrant-scraper.yml`
- `scripts/extract_warrant_data.js`
- `tests/extract_warrant_data.test.js`
- canonical dated filename must come from the TWSE source title/date range;
- missing or malformed source date fails closed and must not fabricate a runner-clock artifact date;
- the production extractor step must not ignore source-date failure;
- this is a source-date correctness hardening, not a scheduled-occurrence migration candidate.

### Active / next round — seventh-wave MOPS + VIX scheduled target migration

Active round identity: `seventh-wave-mops-vix-scheduled-target-migration`

Status: promoted only after sixth-wave Prompt B PASS; Prompt A has not been started by this hardening.

Pre-seventh-wave durable baseline/hardening head: `d1275ce13a2adfdb24fe11c8d74b493ca40528fc`.

This round is limited to the two sixth-wave findings classified `needs_separate_preregistered_migration`:

- MOPS monthly revenue automatic target month;
- VIX automatic target market date.

Do not add a third production candidate.

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
- `scripts/resolve_scheduled_collection_date.js` remains a verified cron subset, not a general cron engine. Do not broaden its supported grammar in the seventh wave.
- `github.event.schedule` is not an immutable occurrence timestamp. If a later identical cron occurrence has already passed, reconstruction is ambiguous without an independent durable occurrence identifier.
- TDCC source `observed_date` remains source-derived; `available_at` remains conservative first successful archive capture time and must not be backdated.
- CNN source `fear_and_greed.timestamp` / `dataDate` remains source-derived.
- TAIFEX futures/options artifact naming remains payload-date derived through `getPayloadDate(csvText)`; scheduled date is expected-date validation only.
- Warrant artifact date remains source-title-derived; missing/malformed source title/date must fail closed rather than fabricate a runner date.
- Do not migrate prediction/replay in this project without separate preregistration.

## Prior completed waves

- First wave implementation/test head: `53a32a03f5fd340c09876dc94ea22360f17359f4`; regression run `33353663345`; handoff checkpoint `5704095d91b7456af97f70d3a96fd88ca4e7ab56`.
- Second wave implementation/test head: `27ce0b0e1eb8eb9beabe2a8a087571bc4cd47bb1`; regression run `33354868624`; closeout checkpoint `89a2ade5cbe15e9e0858cb607cc699fc7fbf9878`.
- Third wave implementation/test head: `63c2c4a2867944cb6522c0f14715a1c23dd19109`; exact-head regression run `33365436045`; job `99404991901`; success.
- Fourth wave audit findings commit: `303bd5b4342a6825f16dd22992378a4850707b25`; closeout checkpoint `2642a232b8cdee947e9120920a9dab3c4c61ae1b`; Prompt B PASS.
- Fifth wave implementation commit: `bf50cf55330fb3d7d6325643a972b9b96ea58471`; final implementation/test head `5f3b3b3060319c2758166894e2f0ca8bdf41f2d6`; exact-head regression run `33369408473`; job `99416854795`; 34 pass / 0 fail; Prompt B PASS.
- Sixth wave audit findings commit: `ce419d0640603cada035ea4e915381bb42b2a462`; closeout checkpoint `82077179f4e785d49230667385ba1c15972890cc`; Prompt B PASS.

## Sixth-wave residual inventory

The 22 scheduled workflows already explicitly migrated/classified by waves 1-5 were re-accounted for. The 14 residual scheduled workflows were classified as follows:

| Workflow | Classification | Evidence / ownership |
| --- | --- | --- |
| `.github/workflows/analyze-daily-gainers-margin-flow-2200.yml` | `no_migration_source_or_repository_owned` | schedule/manual fallback chooses latest repository `data_daily_gain_over_5/YYYYMMDD.json`; source-push mode derives date from changed source-data paths; downstream builder `scripts/build_daily_gainers_ai_facts.js`. |
| `.github/workflows/crawl-mops-monthly-revenue.yml` | `needs_separate_preregistered_migration` | empty input calls `scripts/crawl_mops_monthly_revenue.js` `autoRevenueMonth()`, which uses runner `new Date()` in `Asia/Taipei`; month-boundary delay can drift target month. Test: `tests/mops_monthly_revenue.test.js`. |
| `.github/workflows/crawl-pocket-00981a.yml` | `no_migration_source_or_repository_owned` | runner Taipei date is retry/readiness/update-marker metadata; canonical holdings/industry dates come from API rows in `scripts/crawl_pocket_00981A_holdings.js`. |
| `.github/workflows/crawl-sma.yml` | `already_migrated_or_covered` | scheduled branch passes `${{ github.event.schedule }}` to `scripts/resolve_scheduled_sma_target_date.js`; availability detector is `scripts/detect_latest_sma_date.js`. |
| `.github/workflows/crawl-twse-quarterly-financial-quality.yml` | `no_migration_source_or_repository_owned` | `scripts/crawl_twse_quarterly_financial_quality.js` takes fiscal year/quarter from TWSE OpenAPI payload; runner time is generated metadata only. Test: `tests/twse_quarterly_financial_quality.test.js`. |
| `.github/workflows/crawl-vix-index.yml` | `needs_separate_preregistered_migration` | scheduled automatic path calls `scripts/crawl_vix_index.js --resolve-date` without occurrence input; `resolveAutomaticTargetDate(now = new Date())` uses runner `America/New_York` clock and 17:00 cutoff. Tests: `tests/crawl_vix_index.test.js`, `tests/refresh_dataset_indexes.test.js`. |
| `.github/workflows/daily-gainers-over-5.yml` | `no_migration_source_or_repository_owned` | automatic target is latest `data_fubon/fubon_YYYYMMDD_sma.json` in git tree; runner Taipei time is a stale-state skip guard, not target ownership. |
| `.github/workflows/daily-prediction-replay.yml` | `no_migration_source_or_repository_owned` | `scripts/resolve_prediction_replay_date.js` selects newest repository SMA date and requires matching V1/V2 manifests; no silent fallback. |
| `.github/workflows/daily-stock-prediction.yml` | `no_migration_source_or_repository_owned` | `scripts/resolve_latest_complete_prediction_base.js` selects latest complete repository base and derives forecast target; `scripts/resolve_forecast_dates.js` validates/expands it. |
| `.github/workflows/momentum-history-replay.yml` | `no_migration_source_or_repository_owned` | scheduled/no-input path invokes `scripts/run_momentum_history_replay.js --latest`; selection is from completed/versioned snapshot state. |
| `.github/workflows/update-non-trading-days.yml` | `date_irrelevant` | `scripts/update_non_trading_days_from_twse_holidays.js` fetches official holiday rows and merges them; schedule date does not own an artifact date. |
| `.github/workflows/update-official-market-constraints.yml` | `no_migration_source_or_repository_owned` | empty target uses `scripts/finalize_prediction_market_context.js` repository `predictionDates().at(-1)`; cron selects phase only. |
| `.github/workflows/update-twse-industry.yml` | `date_irrelevant` | refreshes current universe via `scripts/extract_twse_industry.js`; no dated business artifact identity. |
| `.github/workflows/warrant-scraper.yml` | `no_migration_source_or_repository_owned` | canonical artifact filename derives from the TWSE source title/date range in `scripts/extract_warrant_data.js`. Post-sixth-wave hardening removed the degraded runner-date fallback; missing/malformed source date now fails closed, the workflow no longer ignores extractor failure, and `tests/extract_warrant_data.test.js` covers the contract. |

No residual scheduled workflow remains unresolved. The only promoted seventh-wave production migrations are MOPS and VIX.

## Sixth-wave Prompt B closeout evidence

- Correct Prompt B identity was recovered from durable pre-Prompt-A checkpoint `6f2401f9b66c91ffd93411a14a228b2205aecaee`.
- Prompt A bounded scope changed only this handoff.
- All 36 current scheduled workflows were independently re-accounted for: 22 already covered + 14 residual.
- The two migration candidates were based on actual runner-clock target ownership, not cron presence alone.
- Protected resolver/prediction/source-date invariants were unchanged.
- Both future migration candidates were preregistered with exact entry points before implementation.
- Sixth-wave Prompt B closeout: PASS at `82077179f4e785d49230667385ba1c15972890cc`.

Known limitation retained: `github.event.schedule` cannot uniquely identify an original occurrence after a later identical cron occurrence has also passed without another durable occurrence identifier. Seventh-wave implementation must remain within the established bounded occurrence-reconstruction contract.

## Entry points

Repository rules / canonical state:

- `AGENTS.md`
- `docs/project-philosophy.md`
- `docs/roadmap/current-phase.md`
- `docs/handoffs/scheduled-workflow-date-semantics.md`

Shared scheduled-date infrastructure:

- `scripts/resolve_scheduled_collection_date.js`
- `scripts/resolve_forecast_dates.js`
- `scripts/resolve_taifex_scheduled_date.js`
- `tests/resolve_scheduled_collection_date.test.js`
- `tests/scheduled_date_third_wave.test.js`
- `tests/scheduled_date_fourth_wave.test.js`
- `.github/workflows/test-scheduled-collection-date.yml`
- `data_history_sma/non_trading_days.json`

Seventh-wave exact candidate entry points:

- `.github/workflows/crawl-mops-monthly-revenue.yml`
- `scripts/crawl_mops_monthly_revenue.js`
- `tests/mops_monthly_revenue.test.js`
- `.github/workflows/crawl-vix-index.yml`
- `scripts/crawl_vix_index.js`
- `tests/crawl_vix_index.test.js`
- `tests/refresh_dataset_indexes.test.js`
- `scripts/resolve_scheduled_collection_date.js`
- `.github/workflows/test-scheduled-collection-date.yml`

Protected source-derived / repository-owned controls:

- `.github/workflows/crawl-tdcc-shareholding-snapshot.yml`
- `scripts/crawl_tdcc_shareholding_snapshot.js`
- `tests/tdcc_shareholding_snapshot.test.js`
- `.github/workflows/crawl-cnn-fear-and-greed.yml`
- `scripts/crawl_cnn_fear_and_greed.js`
- `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml`
- `scripts/crawl_taifex_major_institutional_traders_futures_options.js`
- `.github/workflows/warrant-scraper.yml`
- `scripts/extract_warrant_data.js`
- `tests/extract_warrant_data.test.js`
- `scripts/resolve_latest_complete_prediction_base.js`
- `scripts/resolve_prediction_replay_date.js`

## Safety / stop conditions

- If current `main` materially changes a seventh-wave entry point before Prompt A begins, refresh the handoff/evidence before implementation.
- Preserve all source-derived and repository-owned dates.
- Preserve the warrant fail-closed source-date contract; do not reintroduce a runner-date fallback or ignored extractor failure.
- Do not change prediction/replay.
- Do not broaden `scripts/resolve_scheduled_collection_date.js` cron grammar.
- Do not add any third production migration candidate in the seventh wave.
- If either candidate's frozen domain policy cannot be preserved without broad architecture change, stop that candidate and document the blocker rather than improvising.

## Preregistered Prompt A — seventh-wave MOPS + VIX scheduled target migration

Continue the Scheduled Workflow Date Semantics Migration in repository `EasonLiu0913/stock_data`.

Active round identity: `seventh-wave-mops-vix-scheduled-target-migration`.

Before doing any work:
1. Fetch current remote `main`; do not rely on local or conversation state.
2. Read `AGENTS.md`, `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, and this canonical handoff.
3. Verify current `main` includes the post-sixth-wave warrant hardening through `d1275ce13a2adfdb24fe11c8d74b493ca40528fc` and that no later change makes the seventh-wave assumptions stale.
4. Recover the sixth-wave audit/closeout evidence and confirm only these two candidates were promoted.
5. Re-read exact entry points:
   - `.github/workflows/crawl-mops-monthly-revenue.yml`
   - `scripts/crawl_mops_monthly_revenue.js`
   - `tests/mops_monthly_revenue.test.js`
   - `.github/workflows/crawl-vix-index.yml`
   - `scripts/crawl_vix_index.js`
   - `tests/crawl_vix_index.test.js`
   - `tests/refresh_dataset_indexes.test.js`
   - `scripts/resolve_scheduled_collection_date.js`
   - `.github/workflows/test-scheduled-collection-date.yml`
6. Verify the frozen policies and these entry points have not materially changed.

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
- Add deterministic tests for a delayed run crossing the New York 17:00 cutoff/date boundary and a normal delay.

Intermediate gate: VIX tests and syntax checks must pass. This is not round completion.

### Stage 3 — regression and durable verification

- Update `.github/workflows/test-scheduled-collection-date.yml` only as required to cover the two new contracts and exact-head materialization.
- Do not broaden `scripts/resolve_scheduled_collection_date.js` cron grammar.
- Keep TDCC, CNN, TAIFEX, warrant fail-closed source-date behavior, prediction/replay, prior migrated workflows, and unrelated research/data workflows unchanged.
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

Prompt A completion contract:

- Stages 1-3 are all complete; intermediate PASS does not end the round.
- Relevant deterministic tests pass.
- Exact-head regression tests the intended implementation/test head SHA.
- Bounded changed-file set and protected invariants are proven.
- Current remote `main` is re-fetched and implementation/handoff evidence is durable.
- The following round's paired Prompt A + Prompt B are preregistered before completion is declared.
- Then report exactly `Prompt A complete — ready for Prompt B` and stop.

Do not execute Prompt B or another Prompt A automatically.

## Preregistered Prompt B — seventh-wave MOPS + VIX scheduled target migration closeout

Perform phase-closeout verification for round `seventh-wave-mops-vix-scheduled-target-migration` in repository `EasonLiu0913/stock_data`.

Before verification:
1. Fetch current remote `main` and read `AGENTS.md`, `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, and this canonical handoff.
2. Recover the seventh-wave Prompt A baseline, implementation/test head, and this preregistered Prompt B from durable pre-Prompt-A history.
3. Do not use a later future Prompt B as the acceptance contract.

Verify independently:

1. **Bounded scope**
   - Changed files are limited to the preregistered MOPS/VIX entry points, strictly necessary shared regression/seam files, and handoff.
   - No third production workflow was migrated.
   - TDCC, CNN, TAIFEX, warrant fail-closed source-date behavior, prediction/replay, and prior migration contracts are unchanged.

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
   - Warrant source title/date remains canonical; missing/malformed source date still fails closed; extractor failure is not ignored.
   - Prediction/replay protected blobs/behavior remain unchanged unless a separate preregistered freshness repair is explicitly justified.

5. **Exact-head regression identity**
   - Regression tests materialize and test the implementation head SHA, not moving `/main`.
   - Tested/materialized SHA equals the intended seventh-wave implementation/test head.
   - Relevant deterministic tests and scheduled-date regression pass.

6. **Durable completion**
   - Re-fetch current remote `main` after all writes.
   - Verify implementation commits are reachable, expected files/blobs are present, bounded changed-file set holds, and canonical handoff contains seventh-wave completion evidence plus the already-preregistered next pair.

If any criterion fails, fix only the bounded seventh-wave defect and repeat this Prompt B from criterion 1.

If closeout passes:

- update the canonical handoff with seventh-wave Prompt B PASS evidence;
- promote only the already-preregistered next round;
- commit the handoff;
- re-fetch current remote `main` and verify durability/staleness;
- stop. Do not start the next Prompt A automatically.
