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

### Active round — eighth-wave final scheduled-date verification and retirement audit

Round identity: `eighth-wave-final-scheduled-date-verification-and-retirement-audit`

Status: **Prompt A complete; pending the preregistered eighth-wave Prompt B closeout below.**

- Prompt A startup baseline: `3f3cd552a1a68ffc3f411fb66c78e2cfb90fe234`
- Prompt A audit findings checkpoint: `a68dd703f75a481fb821fd67bcde97f05e4bdd2e`
- Final Prompt A handoff checkpoint: this commit (`docs: finalize eighth-wave scheduled-date audit`)
- Retirement decision: **retire / monitor-only if Prompt B independently passes**

The eighth-wave audit found no unresolved runner-clock-owned scheduled business-date defect and no new production migration candidate. Do not invent a ninth-wave implementation round merely to keep this project active.

## Objective

Make scheduled collection/business dates delay-safe while preserving each workflow's true domain policy and source-of-truth date semantics, then retire the migration project when the complete current scheduled-workflow inventory is accounted for and no unresolved runner-clock-owned target defect remains.

## Frozen decisions / constraints

- Manual explicit dates remain authoritative.
- Source/API-derived canonical dates remain source-derived.
- Repository/latest-complete-data workflows remain repository-driven.
- Prediction/replay stale-data safety gates must not be weakened.
- Do not silently fall back to an older trading date unless that fallback is an explicit preserved domain policy.
- `scripts/resolve_scheduled_collection_date.js` remains a bounded cron subset, not a general scheduler.
- `github.event.schedule` occurrence ambiguity remains a known limitation.
- TDCC `observed_date`, CNN timestamp/dataDate, TAIFEX payload date, and warrant source-title date remain source-owned.
- Warrant missing/malformed source date remains fail-closed.
- MOPS and VIX seventh-wave scheduled targets remain intended-occurrence anchored while manual behavior remains unchanged.
- Do not migrate prediction/replay without separate preregistration.
- Do not add a US holiday calendar, scheduler/DAG/plugin framework, or new fallback policy.

## Eighth-wave Prompt A audit evidence

### Freshness and inventory identity

Prompt A freshly read current remote `main` at `3f3cd552a1a68ffc3f411fb66c78e2cfb90fe234`.

Seventh-wave Prompt B closeout checkpoint was `9345f1173e4be8261bf0112b7337fe64e796b7f2`.

Compare `9345f1173e4be8261bf0112b7337fe64e796b7f2...3f3cd552a1a68ffc3f411fb66c78e2cfb90fe234` showed eight later commits, but no `.github/workflows/*` file and no scheduled-date production/test script changed. Later changes were repository command/docs work plus unrelated daily data updates.

The `.github/workflows` subtree SHA is identical at seventh-wave closeout and eighth-wave startup:

- seventh-wave closeout: `039d67c50133b079e9a630303207f1de8ec6be1f`
- eighth-wave startup: `039d67c50133b079e9a630303207f1de8ec6be1f`

Therefore the current scheduled-workflow set is byte-identical to the durable seventh-wave-closeout workflow tree.

### Final current scheduled-workflow inventory — 36 workflows

| # | Workflow | Ownership / disposition |
| ---: | --- | --- |
| 1 | `.github/workflows/crawl-twse-mi-index.yml` | migrated intended occurrence |
| 2 | `.github/workflows/crawl-twse-institutional-investors.yml` | migrated intended occurrence |
| 3 | `.github/workflows/crawl-twse-margin-balance.yml` | migrated intended occurrence |
| 4 | `.github/workflows/crawl-fubon-broker-details.yml` | migrated intended occurrence |
| 5 | `.github/workflows/crawl-fubon-brokers-trade.yml` | migrated intended occurrence |
| 6 | `.github/workflows/crawl-institutional.yml` | migrated intended occurrence |
| 7 | `.github/workflows/retry-institutional.yml` | migrated intended occurrence |
| 8 | `.github/workflows/retry-sma.yml` | migrated intended occurrence |
| 9 | `.github/workflows/crawl-twse-institutional-summaries.yml` | migrated intended occurrence |
| 10 | `.github/workflows/crawl-twse-twt49u.yml` | migrated intended occurrence |
| 11 | `.github/workflows/build-twse-market-chart.yml` | migrated intended occurrence |
| 12 | `.github/workflows/calculate-twse-margin-maintenance.yml` | migrated intended occurrence |
| 13 | `.github/workflows/crawl-market-news.yml` | migrated intended occurrence |
| 14 | `.github/workflows/publish-daily-gainers-ai-analysis.yml` | migrated intended occurrence |
| 15 | `.github/workflows/prepare-market-environment.yml` | migrated intended occurrence |
| 16 | `.github/workflows/crawl-external-market-indicators.yml` | occurrence feeds preserved session policy |
| 17 | `.github/workflows/crawl-refined-product-tightness.yml` | occurrence bounds query; source observation date canonical |
| 18 | `.github/workflows/crawl-rankings.yml` | occurrence anchors source-date/year inference |
| 19 | `.github/workflows/crawl-taifex-major-institutional-traders-futures-contracts.yml` | occurrence feeds preserved TAIFEX policy |
| 20 | `.github/workflows/crawl-tdcc-shareholding-snapshot.yml` | source/API-owned |
| 21 | `.github/workflows/crawl-cnn-fear-and-greed.yml` | source/API-owned |
| 22 | `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml` | schedule only supplies expected date; payload date canonical |
| 23 | `.github/workflows/analyze-daily-gainers-margin-flow-2200.yml` | repository/source-file-owned |
| 24 | `.github/workflows/crawl-mops-monthly-revenue.yml` | seventh-wave intended occurrence complete |
| 25 | `.github/workflows/crawl-pocket-00981a.yml` | source/API-owned |
| 26 | `.github/workflows/crawl-sma.yml` | intended-occurrence covered |
| 27 | `.github/workflows/crawl-twse-quarterly-financial-quality.yml` | source/API-owned fiscal period |
| 28 | `.github/workflows/crawl-vix-index.yml` | seventh-wave intended occurrence complete |
| 29 | `.github/workflows/daily-gainers-over-5.yml` | repository latest-SMA-owned |
| 30 | `.github/workflows/daily-prediction-replay.yml` | protected repository/latest-data-owned |
| 31 | `.github/workflows/daily-stock-prediction.yml` | protected repository/latest-complete-data-owned |
| 32 | `.github/workflows/momentum-history-replay.yml` | repository/versioned-snapshot-owned |
| 33 | `.github/workflows/update-non-trading-days.yml` | date-irrelevant source refresh |
| 34 | `.github/workflows/update-official-market-constraints.yml` | repository-owned; schedule selects phase only |
| 35 | `.github/workflows/update-twse-industry.yml` | date-irrelevant universe refresh |
| 36 | `.github/workflows/warrant-scraper.yml` | source-title/date-owned and fail-closed |

Result: **36 accounted / 36 explained / 0 unexplained / 0 newly added or materially changed scheduled workflows since seventh-wave closeout.**

### Fresh exact-head regression

The eighth wave re-ran the exact-head regression rather than merely citing the prior green result.

- Workflow: `.github/workflows/test-scheduled-collection-date.yml`
- Run ID: `33374612312`
- Fresh eighth-wave rerun regression job: `99443852753`
- Tested/materialized SHA: `396e8975517bbe0fc687bf9f8226825b35dacd40`
- Conclusion: `success`
- Deterministic tests: **51 pass / 0 fail**
- `TESTED_SHA == MATERIALIZED_SHA`: PASS

Fresh rerun verified resolver delay semantics, first-wave resolver wiring, second-wave contracts, third-wave contracts, fifth-wave TAIFEX futures/options, seventh-wave MOPS/VIX, warrant fail-closed behavior, and exact SHA identity.

Current `scripts/resolve_scheduled_collection_date.js` blob is `7f081771527ecf3b395d8f864aad93ac94c26325`; its parser remains limited to five-field wildcard/integer/comma-list/simple-range cron syntax.

Current `scripts/crawl_mops_monthly_revenue.js` blob is `89d5d68d2a9238905b672798e5b286f157646422`. Scheduled MOPS wiring feeds reconstructed `scheduled_at_utc` into existing `autoRevenueMonth(now)`; manual explicit and manual no-date paths remain distinct.

Current VIX scheduled wiring feeds reconstructed `scheduled_at_utc` into existing `resolveAutomaticTargetDate(now)` while preserving manual explicit/manual no-date behavior and exact source-row validation.

No workflow/script changes after seventh-wave closeout touched TDCC, CNN, TAIFEX, warrant, prediction/replay, MOPS/VIX, or shared scheduled-date code.

### Prompt A changed-file set

Clean retirement audit scope is documentation-only:

- `docs/handoffs/scheduled-workflow-date-semantics.md`

No production workflow, script, test, config, data contract, scheduler framework, holiday calendar, or fallback policy was changed by eighth-wave Prompt A.

### Retirement decision

**No unresolved scheduled target defect remains in the current 36-workflow scheduled inventory.**

Decision: mark this migration project **retired / monitor-only pending Prompt B closeout**.

Monitor-only means future newly added or materially changed scheduled workflows are evaluated from then-current evidence; no speculative migration wave is preregistered now. If a future concrete defect appears, create a new explicitly preregistered implementation + closeout pair at that time.

## Entry points

- `AGENTS.md`
- `promptA.md`
- `promptB.md`
- `docs/agent-prompts/prompt-a-runner.md`
- `docs/agent-prompts/prompt-b-runner.md`
- `docs/handoffs/scheduled-workflow-date-semantics.md`
- `.github/workflows/test-scheduled-collection-date.yml`
- `scripts/resolve_scheduled_collection_date.js`
- `.github/workflows/crawl-mops-monthly-revenue.yml`
- `scripts/crawl_mops_monthly_revenue.js`
- `tests/mops_monthly_revenue.test.js`
- `.github/workflows/crawl-vix-index.yml`
- `scripts/crawl_vix_index.js`
- `tests/crawl_vix_index.test.js`
- `.github/workflows/warrant-scraper.yml`
- `scripts/extract_warrant_data.js`
- `tests/extract_warrant_data.test.js`
- `scripts/resolve_latest_complete_prediction_base.js`
- `scripts/resolve_prediction_replay_date.js`

## Safety / stop conditions

- Prompt A is complete; do not start another implementation round before the preregistered Prompt B below passes.
- Do not invent a speculative ninth-wave migration candidate.
- If current-main drift before closeout adds or materially changes scheduled workflows, Prompt B must re-account the affected inventory.

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
