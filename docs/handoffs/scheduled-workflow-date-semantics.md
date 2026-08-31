# Scheduled Workflow Date Semantics Migration

Canonical handoff: `docs/handoffs/scheduled-workflow-date-semantics.md`

## Current phase

### Completed round — seventh-wave MOPS + VIX scheduled target migration

Round identity: `seventh-wave-mops-vix-scheduled-target-migration`

- Prompt A startup baseline: `a18279c017d14902bbc0d8909927d31eebf0a7fd`
- Final implementation/test head: `396e8975517bbe0fc687bf9f8226825b35dacd40`
- Prompt A handoff checkpoint: `a78357435bdb80bee37ab38d6d4effbe98e33da1`
- Prompt B closeout checkpoint: `9345f1173e4be8261bf0112b7337fe64e796b7f2`
- Prompt B closeout: **PASS**
- Exact-head regression run: `33374612312`
- Original regression job: `99433173161`
- Deterministic tests: 51 pass / 0 fail

### Active round — eighth-wave final scheduled-date verification and retirement audit

Round identity: `eighth-wave-final-scheduled-date-verification-and-retirement-audit`

Status: **Prompt A complete; pending the preregistered eighth-wave Prompt B closeout below.**

Prompt A startup baseline: `3f3cd552a1a68ffc3f411fb66c78e2cfb90fe234`.

Prompt A audit findings commit: `TO_BE_RECORDED_AFTER_WRITE`.

Retirement decision: **retire / monitor-only if Prompt B independently passes**. The eighth-wave audit found no unresolved runner-clock-owned scheduled business-date defect and no new production migration candidate. Do not invent a ninth-wave implementation round merely to keep this project active.

## Objective

Make scheduled collection/business dates delay-safe while preserving each workflow's true domain policy and source-of-truth date semantics, then retire the migration project when the complete current scheduled-workflow inventory is accounted for and no unresolved runner-clock-owned target defect remains.

Architecture remains intentionally small:

1. reconstruct intended scheduled occurrence only when schedule ownership truly determines an expected business date;
2. map the occurrence through the domain-specific date policy;
3. preserve source/API-derived dates when the upstream payload owns the business date;
4. preserve repository/latest-complete-data ownership when repository state is authoritative;
5. do not turn the bounded resolver into a general scheduler framework.

## Frozen decisions / constraints

- Manual explicit dates remain authoritative.
- Source/API-derived canonical dates remain source-derived.
- Repository/latest-complete-data workflows remain repository-driven.
- Do not silently fall back to an older trading date unless that fallback is an explicit preserved domain policy.
- Prediction/replay stale-data safety gates must not be weakened.
- Preserve crawler outputs, validation gates, persistence, and plan + fresh-runner physical-batch architecture.
- `scripts/resolve_scheduled_collection_date.js` remains a verified bounded cron subset, not a general cron engine.
- `github.event.schedule` occurrence ambiguity remains a known limitation.
- TDCC source `observed_date` remains source-derived; `available_at` remains conservative first successful archive capture time and must not be backdated.
- CNN source `fear_and_greed.timestamp` / `dataDate` remains source-derived.
- TAIFEX futures/options artifact naming remains payload-date derived through `getPayloadDate(csvText)`; scheduled date is expected-date validation only.
- Warrant artifact date remains source-title-derived; missing/malformed source date must fail closed and extractor failure must not be ignored.
- MOPS seventh-wave scheduled target remains intended-occurrence anchored while manual explicit/no-date behavior and MOPS domain policy stay unchanged.
- VIX seventh-wave scheduled target remains intended-occurrence anchored while manual explicit/no-date behavior and the New York 17:00 / previous-weekday domain policy stay unchanged.
- Do not migrate prediction/replay without separate preregistration.
- Do not add a US holiday calendar, scheduler/DAG/plugin framework, or new fallback policy.

## Eighth-wave Prompt A audit evidence

### Freshness and durable inventory identity

Prompt A freshly read current remote `main` at:

- startup / pre-write head: `3f3cd552a1a68ffc3f411fb66c78e2cfb90fe234`
- seventh-wave Prompt B closeout checkpoint: `9345f1173e4be8261bf0112b7337fe64e796b7f2`

Compare `9345f1173e4be8261bf0112b7337fe64e796b7f2...3f3cd552a1a68ffc3f411fb66c78e2cfb90fe234` showed eight later commits, but **no `.github/workflows/*` file and no scheduled-date production/test script changed**. Later changes were repository command/docs work plus unrelated daily data updates.

The complete `.github/workflows` subtree identity is unchanged across seventh-wave closeout and eighth-wave startup:

- seventh-wave closeout workflow tree: `039d67c50133b079e9a630303207f1de8ec6be1f`
- eighth-wave startup workflow tree: `039d67c50133b079e9a630303207f1de8ec6be1f`

Therefore the current scheduled-workflow set is byte-identical to the already durable seventh-wave-closeout workflow tree; the eighth wave re-accounted that current tree against all first-through-seventh-wave evidence rather than silently treating later unrelated commits as migration evidence.

### Final current scheduled-workflow inventory — 36 workflows

Every current scheduled workflow is explicitly accounted for below.

| # | Workflow | Current ownership / disposition |
| ---: | --- | --- |
| 1 | `.github/workflows/crawl-twse-mi-index.yml` | already migrated intended-occurrence semantics |
| 2 | `.github/workflows/crawl-twse-institutional-investors.yml` | already migrated intended-occurrence semantics |
| 3 | `.github/workflows/crawl-twse-margin-balance.yml` | already migrated intended-occurrence semantics |
| 4 | `.github/workflows/crawl-fubon-broker-details.yml` | already migrated intended-occurrence semantics |
| 5 | `.github/workflows/crawl-fubon-brokers-trade.yml` | already migrated intended-occurrence semantics |
| 6 | `.github/workflows/crawl-institutional.yml` | already migrated intended-occurrence semantics |
| 7 | `.github/workflows/retry-institutional.yml` | already migrated intended-occurrence semantics |
| 8 | `.github/workflows/retry-sma.yml` | already migrated intended-occurrence semantics |
| 9 | `.github/workflows/crawl-twse-institutional-summaries.yml` | already migrated intended-occurrence semantics |
| 10 | `.github/workflows/crawl-twse-twt49u.yml` | already migrated intended-occurrence semantics |
| 11 | `.github/workflows/build-twse-market-chart.yml` | already migrated intended-occurrence semantics |
| 12 | `.github/workflows/calculate-twse-margin-maintenance.yml` | already migrated intended-occurrence semantics |
| 13 | `.github/workflows/crawl-market-news.yml` | already migrated intended-occurrence semantics |
| 14 | `.github/workflows/publish-daily-gainers-ai-analysis.yml` | already migrated intended-occurrence semantics |
| 15 | `.github/workflows/prepare-market-environment.yml` | already migrated intended-occurrence semantics |
| 16 | `.github/workflows/crawl-external-market-indicators.yml` | intended occurrence feeds preserved domain/session policy |
| 17 | `.github/workflows/crawl-refined-product-tightness.yml` | intended occurrence bounds the scheduled query; source observation date remains authoritative |
| 18 | `.github/workflows/crawl-rankings.yml` | intended occurrence anchors deterministic source-date/year inference; missing source date fails rather than inventing one |
| 19 | `.github/workflows/crawl-taifex-major-institutional-traders-futures-contracts.yml` | intended occurrence feeds preserved TAIFEX expected-date policy |
| 20 | `.github/workflows/crawl-tdcc-shareholding-snapshot.yml` | source/API-owned canonical observation date; no migration |
| 21 | `.github/workflows/crawl-cnn-fear-and-greed.yml` | source/API-owned timestamp/dataDate; no migration |
| 22 | `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml` | scheduled occurrence determines expected date only; source payload date remains canonical artifact identity |
| 23 | `.github/workflows/analyze-daily-gainers-margin-flow-2200.yml` | repository/source-file-owned target date; no migration |
| 24 | `.github/workflows/crawl-mops-monthly-revenue.yml` | seventh-wave intended-occurrence migration complete |
| 25 | `.github/workflows/crawl-pocket-00981a.yml` | source/API-owned holdings/industry business dates; no migration |
| 26 | `.github/workflows/crawl-sma.yml` | already intended-occurrence anchored / covered |
| 27 | `.github/workflows/crawl-twse-quarterly-financial-quality.yml` | source/API-owned fiscal year/quarter; no migration |
| 28 | `.github/workflows/crawl-vix-index.yml` | seventh-wave intended-occurrence migration complete |
| 29 | `.github/workflows/daily-gainers-over-5.yml` | repository latest-SMA-owned target; runner time is only freshness guard |
| 30 | `.github/workflows/daily-prediction-replay.yml` | separately protected repository/latest-data-owned policy; no silent fallback |
| 31 | `.github/workflows/daily-stock-prediction.yml` | separately protected repository/latest-complete-data-owned policy |
| 32 | `.github/workflows/momentum-history-replay.yml` | repository/versioned-snapshot-owned target |
| 33 | `.github/workflows/update-non-trading-days.yml` | date-irrelevant refresh of source-owned holiday data |
| 34 | `.github/workflows/update-official-market-constraints.yml` | repository-owned prediction context target; schedule selects phase, not business date |
| 35 | `.github/workflows/update-twse-industry.yml` | date-irrelevant current-universe refresh |
| 36 | `.github/workflows/warrant-scraper.yml` | source-title/date-owned; missing/malformed source date fails closed |

Inventory result: **36 accounted / 36 explained / 0 unexplained / 0 newly added or materially changed scheduled workflows since seventh-wave closeout.**

### Protected-contract regression audit

The eighth wave re-ran the exact-head regression contract instead of merely citing the prior green run.

- Workflow: `.github/workflows/test-scheduled-collection-date.yml`
- Existing run ID re-used for exact-head rerun: `33374612312`
- Fresh eighth-wave regression job ID: `99443852753`
- Tested/materialized SHA: `396e8975517bbe0fc687bf9f8226825b35dacd40`
- Conclusion: `success`
- Deterministic tests: **51 pass / 0 fail**
- `TESTED_SHA == MATERIALIZED_SHA`: PASS

Fresh rerun verified:

- resolver syntax and delay semantics;
- all ten first-wave resolver-wired workflows;
- all five second-wave contracts;
- all four third-wave contracts;
- fifth-wave TAIFEX futures/options expected-date/source-payload contract;
- seventh-wave MOPS and VIX intended-occurrence wiring and preserved manual paths;
- warrant source-date fail-closed contract;
- exact tested SHA identity.

Current `scripts/resolve_scheduled_collection_date.js` blob remains `7f081771527ecf3b395d8f864aad93ac94c26325`. Its cron parser still accepts only the bounded five-field subset built from wildcard, integer, comma-separated integers, and simple integer ranges; no general scheduler grammar/framework was introduced.

Current MOPS domain script blob remains `89d5d68d2a9238905b672798e5b286f157646422`; scheduled workflow wiring passes reconstructed `scheduled_at_utc` into existing `autoRevenueMonth(now)`, while manual explicit and manual no-date paths remain distinct.

Current VIX scheduled wiring passes reconstructed `scheduled_at_utc` into existing `resolveAutomaticTargetDate(now)` while preserving manual explicit and manual no-date behavior and exact source-row validation.

No workflow/script changes after seventh-wave closeout touched TDCC, CNN, TAIFEX, warrant, prediction/replay, MOPS/VIX, or shared scheduled-date code, so those protected ownership contracts remain identical to the seventh-wave closeout tree/scripts while the fresh exact-head regression independently revalidated the executable migrated subset.

### Prompt A changed-file set

Clean retirement audit scope is documentation-only:

- `docs/handoffs/scheduled-workflow-date-semantics.md`

No production workflow, production script, test, config, data contract, scheduler framework, holiday calendar, or fallback policy was changed by eighth-wave Prompt A.

### Retirement decision

**No unresolved scheduled target defect remains in the current 36-workflow scheduled inventory.**

Decision after Prompt A: mark this migration project **retired / monitor-only pending Prompt B closeout**.

Monitor-only means:

- future newly added or materially changed scheduled workflows must be evaluated under normal repository rules when they appear;
- do not keep a speculative “next migration wave” preregistered when no current defect exists;
- do not reinterpret source-owned or repository-owned business dates as schedule-owned merely because a workflow has cron;
- if a future concrete defect is found, start a new explicitly preregistered implementation + closeout pair from then-current evidence.

## Entry points

Repository rules / canonical state:

- `AGENTS.md`
- `promptA.md`
- `promptB.md`
- `docs/agent-prompts/prompt-a-runner.md`
- `docs/agent-prompts/prompt-b-runner.md`
- `docs/project-philosophy.md`
- `docs/roadmap/current-phase.md`
- `docs/handoffs/scheduled-workflow-date-semantics.md`

Shared scheduled-date infrastructure / regression:

- `scripts/resolve_scheduled_collection_date.js`
- `scripts/resolve_forecast_dates.js`
- `scripts/resolve_taifex_scheduled_date.js`
- `tests/resolve_scheduled_collection_date.test.js`
- `tests/scheduled_date_third_wave.test.js`
- `tests/scheduled_date_fourth_wave.test.js`
- `.github/workflows/test-scheduled-collection-date.yml`
- `data_history_sma/non_trading_days.json`

Seventh-wave contracts:

- `.github/workflows/crawl-mops-monthly-revenue.yml`
- `scripts/crawl_mops_monthly_revenue.js`
- `tests/mops_monthly_revenue.test.js`
- `.github/workflows/crawl-vix-index.yml`
- `scripts/crawl_vix_index.js`
- `tests/crawl_vix_index.test.js`
- `tests/refresh_dataset_indexes.test.js`

Protected source/repository-owned controls:

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

- Prompt A is complete; do not start another implementation round before the preregistered Prompt B below passes.
- Do not invent a speculative ninth-wave migration candidate.
- Do not add a US holiday calendar, scheduler/DAG/plugin framework, or new fallback policy.
- Do not migrate prediction/replay in this project without separate preregistration.
- If future current-main drift adds or materially changes scheduled workflows before closeout, Prompt B must treat that as fresh evidence and re-account the affected inventory rather than silently absorbing it.

## Prompt B — eighth-wave final scheduled-date verification and retirement closeout

Perform phase-closeout verification for round `eighth-wave-final-scheduled-date-verification-and-retirement-audit` in repository `EasonLiu0913/stock_data`.

Before verification:
1. Fetch current remote `main` and read `AGENTS.md`, `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, and this canonical handoff.
2. Recover the eighth-wave Prompt A baseline, audit findings commit/head, and this preregistered Prompt B from durable pre-Prompt-A history.
3. Verify seventh-wave Prompt B had already passed before eighth-wave Prompt A began.
4. Do not use any later future Prompt B as the eighth-wave acceptance contract.

Verify independently:

1. **Round identity and scope**
   - This was the promoted eighth-wave final audit, not a prematurely executed future round.
   - Clean retirement should change only this canonical handoff; any additional change must be a strictly justified bounded verification repair recorded in the handoff.

2. **Complete scheduled-workflow accounting**
   - Independently enumerate all current `.github/workflows/*.yml` files containing `schedule:`.
   - Confirm every current scheduled workflow is accounted for with actual target-date ownership evidence.
   - Confirm no workflow was omitted merely because it had been classified in an older wave.
   - Confirm any workflow newly added or materially changed after seventh-wave closeout was explicitly separated from historical evidence.

3. **No unresolved scheduled target defect**
   - Confirm no remaining scheduled workflow selects a schedule-owned business target from runner actual start time where intended-occurrence reconstruction is required.
   - Confirm MOPS and VIX seventh-wave semantics remain correct.
   - Confirm source/API-owned and repository-owned dates were not incorrectly converted to scheduled dates.

4. **Protected invariants and regression**
   - Exact-head scheduled-date regression passes on the recorded tested SHA and materializes that SHA rather than moving `/main`.
   - Shared resolver cron grammar remains bounded.
   - TDCC, CNN, TAIFEX, warrant fail-closed source ownership, prediction/replay, and prior migration contracts remain intact.
   - No US holiday calendar, scheduler framework, or new fallback policy was introduced.

5. **Retirement decision durability**
   - If no unresolved candidate remains, the handoff explicitly marks the migration as retired/monitor-only and does not preregister speculative production work.
   - If a genuine new defect was found, it has a separate preregistered paired implementation/closeout contract with exact entry points and evidence; it was not silently implemented beyond an allowed bounded freshness/correctness repair.
   - Re-fetch current remote `main` after all writes and verify the final handoff, tested SHA, findings, changed-file set, and retirement/new-defect decision are durable.

If any criterion fails, fix only the bounded eighth-wave audit/verification defect and repeat this Prompt B from criterion 1.

If closeout passes:

- update and commit this canonical handoff with eighth-wave Prompt B PASS evidence;
- mark the migration project retired/monitor-only if no unresolved candidate exists;
- if a separately preregistered defect round exists, promote only that already-preregistered pair;
- re-fetch current remote `main` and verify durability/staleness;
- stop. Do not start another Prompt A automatically.
