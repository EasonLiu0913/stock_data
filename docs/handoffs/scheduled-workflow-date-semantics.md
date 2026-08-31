# Scheduled Workflow Date Semantics Migration

Canonical handoff: `docs/handoffs/scheduled-workflow-date-semantics.md`

## Current phase

### Completed round — eighth-wave final scheduled-date verification and retirement audit

Round identity: `eighth-wave-final-scheduled-date-verification-and-retirement-audit`

- Seventh-wave Prompt B closeout checkpoint: `9345f1173e4be8261bf0112b7337fe64e796b7f2`
- Prompt A startup baseline: `3f3cd552a1a68ffc3f411fb66c78e2cfb90fe234`
- Prompt A audit findings checkpoint: `a68dd703f75a481fb821fd67bcde97f05e4bdd2e`
- Final Prompt A handoff checkpoint: `3cdcc1c686076f3a3045a91cd3eacb820d7ab47f`
- Preregistered Prompt B identity source: durable pre-Prompt-A handoff at `3f3cd552a1a68ffc3f411fb66c78e2cfb90fe234`
- Prompt B closeout: **PASS**
- Prompt B closeout checkpoint: this commit (`docs: retire scheduled-date migration after eighth-wave closeout`)

Project status: **retired / monitor-only**.

There is no active ninth-wave implementation round and no speculative paired Prompt A / Prompt B is preregistered. If a future current-main change introduces a concrete scheduled-date defect, start a new explicitly preregistered implementation + closeout pair from then-current evidence.

## Objective — completed

The migration objective was to make scheduled collection/business dates delay-safe while preserving each workflow's true domain policy and source-of-truth date semantics, then retire the project once the complete scheduled-workflow inventory was accounted for and no unresolved runner-clock-owned target defect remained.

That retirement condition is satisfied.

## Frozen decisions / constraints preserved

- Manual explicit dates remain authoritative.
- Source/API-derived canonical dates remain source-derived.
- Repository/latest-complete-data workflows remain repository-driven.
- Prediction/replay stale-data safety gates remain protected.
- No silent fallback to an older trading date was introduced unless it was an already-preserved domain policy.
- `scripts/resolve_scheduled_collection_date.js` remains a bounded cron subset, not a general scheduler.
- `github.event.schedule` occurrence ambiguity remains a known limitation.
- TDCC `observed_date`, CNN timestamp/dataDate, TAIFEX payload date, and warrant source-title date remain source-owned.
- Warrant missing/malformed source date remains fail-closed.
- MOPS and VIX scheduled targets remain intended-occurrence anchored while manual behavior remains unchanged.
- Prediction/replay was not migrated by this project without separate preregistration.
- No US holiday calendar, scheduler/DAG/plugin framework, or new fallback policy was introduced.

## Eighth-wave Prompt A evidence

### Freshness and inventory identity

Prompt A started from current remote `main` at:

`3f3cd552a1a68ffc3f411fb66c78e2cfb90fe234`

Seventh-wave Prompt B closeout checkpoint was:

`9345f1173e4be8261bf0112b7337fe64e796b7f2`

The `.github/workflows` subtree SHA at both seventh-wave closeout and eighth-wave Prompt A startup was:

`039d67c50133b079e9a630303207f1de8ec6be1f`

Prompt A changed only this canonical handoff. No production workflow, production script, test, config, data contract, holiday calendar, scheduler framework, or fallback policy was changed.

### Final scheduled-workflow inventory — 36 workflows

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
| 22 | `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml` | schedule supplies expected date only; payload date canonical |
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

Inventory result: **36 accounted / 36 explained / 0 unexplained / 0 newly added or materially changed scheduled workflows since seventh-wave closeout.**

## Eighth-wave Prompt B closeout evidence

The eighth-wave closeout used the Prompt B preregistered before Prompt A at `3f3cd552a1a68ffc3f411fb66c78e2cfb90fe234`. It did not use a future or rewritten acceptance contract.

### 1. Round identity and bounded scope — PASS

- Seventh-wave Prompt B had already passed at `9345f1173e4be8261bf0112b7337fe64e796b7f2` before eighth-wave Prompt A began.
- Eighth-wave Prompt A baseline was `3f3cd552a1a68ffc3f411fb66c78e2cfb90fe234`.
- Compare `3f3cd552a1a68ffc3f411fb66c78e2cfb90fe234...3cdcc1c686076f3a3045a91cd3eacb820d7ab47f` contains only `docs/handoffs/scheduled-workflow-date-semantics.md`.
- No production workflow/script/test change was hidden inside the retirement audit.

### 2. Complete scheduled-workflow accounting — PASS

- Current remote `main` workflow subtree was independently re-read during Prompt B and is `039d67c50133b079e9a630303207f1de8ec6be1f`.
- Seventh-wave closeout workflow subtree was independently re-read and is the exact same SHA: `039d67c50133b079e9a630303207f1de8ec6be1f`.
- Therefore the complete workflow tree is byte-identical to the durable tree that had already been exhaustively re-accounted as 36 scheduled workflows.
- The 36-workflow ownership table above remains complete: no workflow was added, deleted, or materially changed between seventh-wave closeout and eighth-wave closeout.
- GitHub code-search indexing returned no usable schedule matches during closeout, so tree identity plus durable prior exhaustive inventory was used rather than treating an empty search index as evidence of zero schedules.

### 3. No unresolved scheduled target defect — PASS

- No remaining current workflow was found that owns a business target through runner actual start time where intended-occurrence reconstruction is required.
- Current MOPS workflow keeps manual explicit `revenue_month` first, reconstructs `scheduled_at_utc` only for schedule events, feeds it into existing `autoRevenueMonth(now)`, and keeps manual no-date behavior separate.
- Current VIX workflow keeps manual explicit `date` first, reconstructs `scheduled_at_utc` only for schedule events, feeds it into existing `resolveAutomaticTargetDate(now)`, and keeps manual no-date behavior separate.
- Source/API-owned and repository-owned workflows remain classified by their actual source-of-truth rather than cron presence.

### 4. Protected invariants and exact-head regression — PASS

Prompt B independently re-ran the exact-head scheduled-date regression:

- Workflow run: `33374612312`
- Fresh Prompt B regression job: `99447487346`
- Tested/materialized SHA: `396e8975517bbe0fc687bf9f8226825b35dacd40`
- Conclusion: `success`
- Deterministic tests: **51 pass / 0 fail**
- `TESTED_SHA == MATERIALIZED_SHA`: PASS

The fresh closeout rerun verified:

- resolver syntax and delay semantics;
- all ten first-wave resolver-wired workflow contracts;
- all five second-wave contracts;
- all four third-wave contracts;
- fifth-wave TAIFEX futures/options expected-date/source-payload contract;
- seventh-wave MOPS/VIX intended-occurrence wiring and preserved manual paths;
- warrant source-date fail-closed behavior;
- exact tested SHA identity.

Current `scripts/resolve_scheduled_collection_date.js` blob is still `7f081771527ecf3b395d8f864aad93ac94c26325`. Its cron grammar remains the bounded five-field subset using wildcard, integer, comma-separated integers, and simple integer ranges.

No US holiday calendar, scheduler/DAG/plugin framework, or new fallback policy was introduced.

### 5. Retirement decision durability — PASS

No unresolved scheduled-date migration candidate remains. The project is therefore **retired / monitor-only**.

There is no speculative ninth-wave production work and no future pair is promoted. A future concrete scheduled-date defect must be handled as a new evidence-backed round with its own preregistered Prompt A + Prompt B.

## Known limitation retained

`github.event.schedule` is not an immutable occurrence timestamp. If a later identical cron occurrence has already passed, reconstructing which identical occurrence originally triggered a delayed run can remain ambiguous without another durable occurrence identifier. This known limitation was not hidden by expanding the resolver into a general scheduler.

## Entry points for future monitor-only review

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

## Monitor-only stop condition

Do not start another scheduled-date migration round merely because this handoff exists. Resume implementation work only when current durable repository evidence identifies a concrete new or regressed scheduled-date defect, and preregister its paired implementation + closeout contracts before work begins.
