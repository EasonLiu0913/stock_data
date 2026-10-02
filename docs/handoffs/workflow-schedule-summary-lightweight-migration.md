# Workflow schedule-summary lightweight migration

Canonical handoff: docs/handoffs/workflow-schedule-summary-lightweight-migration.md

## Current phase

**Round 9 Prompt B closeout: PASS. Round 9 is closed.**

Round 10 is preregistered / promoted for the single verified safe residual: `.github/workflows/build-etf-market-regime-analysis.yml` → `build`. **Round 10 Prompt A has not started.**

Global active task remains:
- `workflow-schedule-summary-lightweight-migration`

## Objective

Remove unnecessary standalone `排程時間摘要` / `schedule-timing-summary` runners for a bounded set of workflows where the existing functional job already checks out the repository and changing the workflow YAML cannot automatically start that production workflow.

The shared renderer remains:

`scripts/write_workflow_schedule_summary.js`

The renderer was independently re-read from current remote main. It uses GitHub runtime/event state (`GITHUB_EVENT_PATH`, `GITHUB_REPOSITORY`, `GITHUB_RUN_ID`, `GITHUB_TOKEN`, `GITHUB_STEP_SUMMARY`) plus built-in Node modules. It does not read stock datasets, research datasets, public artifacts, or repository history. A second full checkout is therefore unnecessary when a functional job already has the repository.

## Frozen decisions / constraints

- Do not change cron schedules.
- Do not change target-date resolution.
- Do not change crawling, retry/backoff, physical batching, data schema, publication, or Pages architecture.
- Do not add `workflow_run`, repository-dispatch chaining, or event listeners.
- Do not change write-layer concurrency to `cancel-in-progress: true`.
- Do not dispatch production crawlers merely to validate this migration.
- Preserve summary fields exactly:
  - 原定排程時間
  - 實際開始時間
  - GitHub 排程延遲
- v2 embedded step uses:
  `if: always() && github.event_name == 'schedule'`
- Evidence before abstraction: continue using the shared Node renderer; do not add a reusable workflow solely for this migration.
- Workflows whose own YAML appears in `push.paths` are Round 2/self-trigger risk.
- Multi-job workflows without one existing terminal job that is guaranteed to run are not forced into v2 merely to save a runner.

## Inventory

Repository-wide scan covered all `177` current `.github/workflows/*.yml|yaml` files.

- `172` files currently match at least one requested marker/search term (`schedule-timing-summary`, `排程時間摘要`, `Checkout repository for schedule summary`, or `write_workflow_schedule_summary.js`).
- `5` newly added workflows contain none of those markers and were the source of the repo-wide normalizer drift found during validation.
- `41` scheduled workflows are runtime-relevant to schedule timing. They are detailed below.
- The remaining marker-bearing workflows have no `schedule` trigger; their legacy schedule-summary job is unreachable because it is guarded by `github.event_name == 'schedule'`. They remain outside this Round 1 runtime-cost migration.

### Scheduled workflow inventory

Legend: `on.push / own YAML` distinguishes merely having a push trigger from editing the workflow being able to self-trigger it.

| Workflow | Display name | Primary/terminal path | Primary checkout | on.push / own YAML in push.paths | Writes repo | Current summary | Classification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `.github/workflows/analyze-daily-gainers-margin-flow-2200.yml` | [07 研究] 晚間 6/7/10 籌碼 Facts 準備 | `prepare-ai-facts` | yes | yes / yes | yes | v1 standalone | Round 2 — self-trigger |
| `.github/workflows/backfill-oversold-rebound-coverage.yml` | [06 回填修復] 跌深反彈－資料覆蓋率補齊 | `plan → backfill → refresh` | yes | no / no | yes | v1 standalone | Round 2 — multi-job placement |
| `.github/workflows/build-etf-market-regime-analysis.yml` | [07 研究] ETF 持有與市場情境比較 | `build` | yes | yes / yes | yes | v1 standalone | Round 2 — self-trigger |
| `.github/workflows/build-twse-market-chart.yml` | [03 市場環境] Build TWSE Market Chart | `route-and-daily-refresh + batches/gates` | yes | no / no | yes | v1 standalone | Round 2 — multi-job placement |
| `.github/workflows/calculate-twse-margin-maintenance.yml` | [01 台股資料] Calculate TWSE Margin Maintenance | `calculate` | yes | no / no | yes | v2 embedded | Round 1 |
| `.github/workflows/crawl-cnn-fear-and-greed.yml` | [02 外部市場] Crawl CNN Fear and Greed Index | `crawl` | yes | no / no | yes | v2 embedded | Round 1 |
| `.github/workflows/crawl-eia-crude-spot.yml` | [02 外部市場] EIA－原油現貨 | `collect` | yes | yes / yes | yes | v1 standalone | Round 2 — self-trigger |
| `.github/workflows/crawl-external-market-indicators.yml` | [02 外部市場] Crawl External Market Indicators | `crawl` | yes | no / no | yes | v1 standalone | Round 2 candidate |
| `.github/workflows/crawl-fubon-broker-details.yml` | [01 台股資料] 富邦－股票視角：前15大買賣超券商 | `validate-inputs → range/single branches` | yes | no / no | yes | v1 standalone | Round 2 — no single terminal job |
| `.github/workflows/crawl-fubon-brokers-trade.yml` | [01 台股資料] 富邦－券商視角：買賣超股票排行 | `crawl` | yes | no / no | yes | v2 embedded | Round 1 |
| `.github/workflows/crawl-institutional.yml` | [01 台股資料] 富邦－個股近30日法人歷史 | `crawl-institutional` | yes | no / no | yes | v1 standalone | Round 2 candidate |
| `.github/workflows/crawl-market-news.yml` | [02 外部市場] Crawl Market News | `crawl` | yes | no / no | yes | v2 embedded | Round 1 |
| `.github/workflows/crawl-mops-monthly-revenue.yml` | [02 外部市場] MOPS－上市公司月營收 | `crawl` | yes | no / no | yes | v1 standalone | Round 2 candidate |
| `.github/workflows/crawl-pocket-00981a.yml` | [01 台股資料] Crawl Pocket 00981A Data | `crawl-pocket-00981a` | yes | no / no | yes | v1 standalone | Round 2 candidate |
| `.github/workflows/crawl-rankings.yml` | [01 台股資料] Crawl Stock Rankings | `crawl-rankings` | yes | no / no | yes | v2 embedded | Round 1 |
| `.github/workflows/crawl-refined-product-tightness.yml` | [02 外部市場] EIA－成品油緊張程度 | `collect` | yes | no / no | yes | v1 standalone | Round 2 candidate |
| `.github/workflows/crawl-sma.yml` | [01 台股資料] Crawl SMA Data | `crawl-sma → daily-gainers → final-summary` | yes | no / no | yes | v1 standalone | Round 2 — multi-job placement |
| `.github/workflows/crawl-taifex-major-institutional-traders-futures-contracts.yml` | [01 台股資料] Crawl 外資期貨未平倉 TAIFEX Futures Contracts Institutional Traders | `crawl-taifex-futures-contracts` | yes | no / no | yes | v1 standalone | Round 2 candidate |
| `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml` | [01 台股資料] Crawl TAIFEX Futures and Options Institutional Traders | `crawl-taifex-futures-options` | yes | no / no | yes | v2 embedded | Round 1 |
| `.github/workflows/crawl-tdcc-shareholding-snapshot.yml` | [01 台股資料] TDCC Shareholding Snapshot | `archive` | yes | yes / yes | yes | v1 standalone | Round 2 — self-trigger |
| `.github/workflows/crawl-tpex-daily-market-data.yml` | [01 台股資料] Crawl TPEx Daily Market Data | `crawl` | yes | yes / yes | yes | legacy exception | Round 2 — self-trigger |
| `.github/workflows/crawl-twse-institutional-investors.yml` | [01 台股資料] TWSE－單日三大法人合併明細 | `crawl-twse-institutional-investors` | yes | no / no | yes | v2 embedded | Round 1 |
| `.github/workflows/crawl-twse-institutional-summaries.yml` | [01 台股資料] TWSE－單日外資／投信／自營商分表 | `crawl` | yes | no / no | yes | v2 embedded | Round 1 |
| `.github/workflows/crawl-twse-margin-balance.yml` | [01 台股資料] Crawl TWSE Margin Balance | `crawl-twse-margin-balance` | yes | no / no | yes | v2 embedded | Round 1 |
| `.github/workflows/crawl-twse-mi-index.yml` | [01 台股資料] Crawl TWSE MI Index | `crawl-twse-mi-index` | yes | no / no | yes | v1 standalone | Round 2 candidate |
| `.github/workflows/crawl-twse-quarterly-financial-quality.yml` | [07 研究] TWSE－季財報品質快照 | `crawl` | yes | no / no | yes | v2 embedded | Round 1 |
| `.github/workflows/crawl-twse-twt49u.yml` | [01 台股資料] Crawl TWSE TWT49U（除權除息計算結果表） | `crawl` | yes | no / no | yes | v1 standalone | Round 2 candidate |
| `.github/workflows/crawl-vix-index.yml` | [02 外部市場] VIX 指數－單日爬取 | `crawl` | yes | no / no | yes | v1 standalone | Round 2 candidate |
| `.github/workflows/daily-gainers-over-5.yml` | [05 清單] 每日漲幅 5% 以上股票 | `generate → validate-analysis-coverage → deploy` | yes | no / no | yes | v1 standalone | Round 2 — multi-job placement |
| `.github/workflows/daily-prediction-replay.yml` | [04 預測覆盤] 每日預測覆盤 | `preflight → replay_and_compare` | yes | no / no | yes | v1 standalone | Round 2 — multi-job placement |
| `.github/workflows/daily-stock-prediction.yml` | [04 預測覆盤] 每日產生股票預測 | `generate_v1 / generate_v2 → apply_strategy_registry` | yes | no / no | yes | v1 standalone | Round 2 — multi-job placement |
| `.github/workflows/momentum-history-replay.yml` | [07 研究] 動能飆股歷史與覆盤 | `validate → generate → deploy_pages` | yes | yes / yes | yes | v1 standalone | Round 2 — self-trigger |
| `.github/workflows/prepare-market-environment.yml` | [03 市場環境] Prepare Market Environment | `prepare` | yes | no / no | yes | v1 standalone | Round 2 candidate |
| `.github/workflows/publish-daily-gainers-ai-analysis.yml` | [07 研究] 5% 漲幅 AI 籌碼解讀驗證發布 | `validate-and-publish → deploy-pages` | yes | yes / yes | yes | v1 standalone | Round 2 — self-trigger |
| `.github/workflows/refresh-finmind-quarterly-financial-quality-due.yml` | [07 研究] FinMind－季財報品質到期刷新 | `plan → refresh → rebuild-master/no-op` | yes | no / no | yes | v1 standalone | Round 2 — multi-job placement |
| `.github/workflows/retry-institutional.yml` | [06 回填修復] Retry Institutional Failed | `retry-institutional → deploy-pages` | yes | no / no | yes | v2 embedded | Round 1 |
| `.github/workflows/retry-sma.yml` | [06 回填修復] Retry SMA Failed | `retry-sma` | yes | no / no | yes | v1 standalone | Round 2 candidate |
| `.github/workflows/update-non-trading-days.yml` | [07 維護更新] Update Non-Trading Days | `update-non-trading-days` | yes | no / no | yes | v1 standalone | Round 2 candidate |
| `.github/workflows/update-official-market-constraints.yml` | [03 晨間補充] 正式處置股與台指期夜盤定稿 | `update` | yes | no / no | yes | v1 standalone | Round 2 candidate |
| `.github/workflows/update-twse-industry.yml` | [07 維護更新] Update TWSE Industry Lists | `update-twse-industry` | yes | yes / yes | yes | v1 standalone | Round 2 — self-trigger |
| `.github/workflows/warrant-scraper.yml` | [01 台股資料] Warrant Data Scraper | `scrape-warrant` | yes | no / no | yes | v1 standalone | Round 2 candidate |

### Round 1 exact embedded targets

The canonical allowlist is `EMBEDDED_TARGETS` in `scripts/migrate_workflow_schedule_summary.js`:

1. `.github/workflows/calculate-twse-margin-maintenance.yml`
2. `.github/workflows/crawl-twse-institutional-investors.yml`
3. `.github/workflows/crawl-twse-margin-balance.yml`
4. `.github/workflows/crawl-twse-quarterly-financial-quality.yml`
5. `.github/workflows/retry-institutional.yml`
6. `.github/workflows/crawl-rankings.yml`
7. `.github/workflows/crawl-market-news.yml`
8. `.github/workflows/crawl-fubon-brokers-trade.yml`
9. `.github/workflows/crawl-twse-institutional-summaries.yml`
10. `.github/workflows/crawl-cnn-fear-and-greed.yml`
11. `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml`

`.github/workflows/crawl-fubon-broker-details.yml` was re-verified as safe from YAML self-trigger, but it has mutually exclusive range/single execution branches and no one existing terminal functional job that always runs after the work. Round 1 therefore leaves its standalone summary job in place instead of adding a new runner or changing job topology.

### Newly discovered normalizer gaps frozen for Round 2

These five files had no managed summary at all and caused `Ensure Workflow Schedule Summary` to fail after the Round 1 implementation commit:

- `.github/workflows/materialize-institutional-accumulation-catalyst-outcome-association-execution.yml` — own YAML in `push.paths`; repository writer.
- `.github/workflows/repair-trading-calendar-freshness.yml` — own YAML in `push.paths`; repository writer.
- `.github/workflows/test-institutional-accumulation-catalyst-outcome-association-protocol.yml` — own YAML in `push.paths`.
- `.github/workflows/test-scheduled-workflow-registry.yml` — `.github/workflows/**` push trigger; self-auditing CI.
- `.github/workflows/verify-institutional-accumulation-catalyst-outcome-association-execution.yml` — own YAML in `push.paths`.

They are explicitly frozen in `LEGACY_UNMARKED_EXCEPTIONS` so Round 1 does not silently edit self-trigger/self-auditing workflows.

### Full marker-match path index (172)

- `.github/workflows/analyze-daily-gainers-margin-flow-2200.yml`
- `.github/workflows/analyze-institutional-accumulation-development-associations.yml`
- `.github/workflows/analyze-institutional-distribution-events.yml`
- `.github/workflows/analyze-mops-revenue-event-returns.yml`
- `.github/workflows/analyze-relative-leadership.yml`
- `.github/workflows/analyze-replay-factor-ranges.yml`
- `.github/workflows/analyze-replay-volume-filter.yml`
- `.github/workflows/analyze-volume-confirmation.yml`
- `.github/workflows/apply-daily-gainers-ai-recheck.yml`
- `.github/workflows/apply-strategy-tag-registry.yml`
- `.github/workflows/audit-institutional-accumulation-official-disclosure-pit-coverage.yml`
- `.github/workflows/audit-scheduled-workflow-outputs.yml`
- `.github/workflows/backfill-cnn-fear-greed-range.yml`
- `.github/workflows/backfill-daily-gainers-market-summary-v2.yml`
- `.github/workflows/backfill-daily-gainers-research.yml`
- `.github/workflows/backfill-external-market-range.yml`
- `.github/workflows/backfill-finmind-quarterly-financial-quality-batch.yml`
- `.github/workflows/backfill-formal-report-fallback-events.yml`
- `.github/workflows/backfill-fubon-sma-range.yml`
- `.github/workflows/backfill-histock-broker-history-research.yml`
- `.github/workflows/backfill-institutional-withdrawal-v5-broker.yml`
- `.github/workflows/backfill-market-environment.yml`
- `.github/workflows/backfill-mops-monthly-revenue.yml`
- `.github/workflows/backfill-mops-quarterly-financial-quality.yml`
- `.github/workflows/backfill-mops-revenue-monthly-signal-study.yml`
- `.github/workflows/backfill-normalized-data.yml`
- `.github/workflows/backfill-oversold-rebound-coverage.yml`
- `.github/workflows/backfill-prediction-dashboard-fields.yml`
- `.github/workflows/backfill-prediction-replay-5d.yml`
- `.github/workflows/backfill-tdcc-shareholding-history-2449.yml`
- `.github/workflows/backfill-twse-core-range-data.yml`
- `.github/workflows/backfill-twse-mi-index-range.yml`
- `.github/workflows/backfill-twse-twt49u-range.yml`
- `.github/workflows/backfill-vix-index-range.yml`
- `.github/workflows/backtest-institutional-distribution-universe.yml`
- `.github/workflows/bootstrap-native-prediction-context.yml`
- `.github/workflows/build-etf-market-regime-analysis.yml`
- `.github/workflows/build-fundamental-acceleration-universe.yml`
- `.github/workflows/build-fundamental-event-timeline.yml`
- `.github/workflows/build-fundamental-state-phase2.yml`
- `.github/workflows/build-tsmc-equipment-demand-dashboard.yml`
- `.github/workflows/build-twse-market-chart.yml`
- `.github/workflows/calculate-twse-margin-maintenance.yml`
- `.github/workflows/check-daily-gainers-ai-contract.yml`
- `.github/workflows/checkpoint-institutional-accumulation-catalyst-event-intelligence.yml`
- `.github/workflows/checkpoint-institutional-accumulation-fifth-window.yml`
- `.github/workflows/checkpoint-institutional-accumulation-fourth-window.yml`
- `.github/workflows/collect-institutional-accumulation-catalyst-prospective-canary.yml`
- `.github/workflows/collect-institutional-accumulation-official-disclosure.yml`
- `.github/workflows/construct-institutional-withdrawal-stock-holdout-batch-v2.yml`
- `.github/workflows/crawl-cnn-fear-and-greed.yml`
- `.github/workflows/crawl-eia-crude-spot.yml`
- `.github/workflows/crawl-external-market-indicators.yml`
- `.github/workflows/crawl-fubon-broker-details.yml`
- `.github/workflows/crawl-fubon-brokers-trade.yml`
- `.github/workflows/crawl-institutional-history.yml`
- `.github/workflows/crawl-institutional.yml`
- `.github/workflows/crawl-market-news.yml`
- `.github/workflows/crawl-mops-monthly-revenue.yml`
- `.github/workflows/crawl-pocket-00981a.yml`
- `.github/workflows/crawl-rankings.yml`
- `.github/workflows/crawl-refined-product-tightness.yml`
- `.github/workflows/crawl-sma-history.yml`
- `.github/workflows/crawl-sma.yml`
- `.github/workflows/crawl-taifex-major-institutional-traders-futures-contracts.yml`
- `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml`
- `.github/workflows/crawl-tdcc-shareholding-snapshot.yml`
- `.github/workflows/crawl-tpex-daily-market-data.yml`
- `.github/workflows/crawl-twse-dealers-history.yml`
- `.github/workflows/crawl-twse-foreign-investors-history.yml`
- `.github/workflows/crawl-twse-institutional-investors-history.yml`
- `.github/workflows/crawl-twse-institutional-investors.yml`
- `.github/workflows/crawl-twse-institutional-summaries-range.yml`
- `.github/workflows/crawl-twse-institutional-summaries.yml`
- `.github/workflows/crawl-twse-margin-balance.yml`
- `.github/workflows/crawl-twse-mi-index.yml`
- `.github/workflows/crawl-twse-quarterly-financial-quality.yml`
- `.github/workflows/crawl-twse-twt49u.yml`
- `.github/workflows/crawl-vix-index.yml`
- `.github/workflows/crawl-wantgoo-margin-observation.yml`
- `.github/workflows/daily-gainers-over-5.yml`
- `.github/workflows/daily-prediction-replay.yml`
- `.github/workflows/daily-stock-prediction.yml`
- `.github/workflows/deploy-pages.yml`
- `.github/workflows/drain-finmind-quarterly-financial-quality-backlog.yml`
- `.github/workflows/ensure-workflow-schedule-summary.yml`
- `.github/workflows/expand-institutional-withdrawal-validation-coverage-v1-recovery.yml`
- `.github/workflows/expand-institutional-withdrawal-validation-coverage-v1.yml`
- `.github/workflows/finalize-histock-legacy-incomplete-statuses-v1.yml`
- `.github/workflows/freeze-institutional-accumulation-development-sample.yml`
- `.github/workflows/install-breakout-json-export.yml`
- `.github/workflows/install-breakout-precursor-strategy.yml`
- `.github/workflows/install-prediction-back-to-top.yml`
- `.github/workflows/install-prediction-dashboard-close-column.yml`
- `.github/workflows/install-prediction-tag-strategy-ui.yml`
- `.github/workflows/investigate-histock-legacy-incomplete-source-empty-v1.yml`
- `.github/workflows/migrate-github-actions-node24.yml`
- `.github/workflows/migrate-legacy-daily-gainers-ai.yml`
- `.github/workflows/mine-oversold-rebound-research.yml`
- `.github/workflows/momentum-history-replay.yml`
- `.github/workflows/open-institutional-accumulation-development-outcomes.yml`
- `.github/workflows/prepare-market-environment.yml`
- `.github/workflows/probe-histock-broker-fresh-runner-batches.yml`
- `.github/workflows/publish-daily-gainers-ai-analysis.yml`
- `.github/workflows/publish-daily-gainers-news-summary.yml`
- `.github/workflows/publish-daily-gainers-unified-analysis.yml`
- `.github/workflows/recalculate-prediction-strategy-history.yml`
- `.github/workflows/reconstruct-institutional-accumulation-official-disclosure-artifacts.yml`
- `.github/workflows/refresh-daily-gainers-market-summary.yml`
- `.github/workflows/refresh-finmind-quarterly-financial-quality-due.yml`
- `.github/workflows/refresh-mops-revenue-event-returns.yml`
- `.github/workflows/repair-daily-gainers-cause-coverage.yml`
- `.github/workflows/repair-histock-broker-source-empty-v1.yml`
- `.github/workflows/research-eps-formula-selection.yml`
- `.github/workflows/research-eps-pe-applicability.yml`
- `.github/workflows/research-eps-valuation-auto-batches.yml`
- `.github/workflows/research-eps-yoy-scaled-outliers.yml`
- `.github/workflows/research-eps-yoy-scaled-shadow.yml`
- `.github/workflows/research-institutional-withdrawal-v5.yml`
- `.github/workflows/research-institutional-withdrawal-v6-1-event-diagnosis.yml`
- `.github/workflows/research-institutional-withdrawal-v6-2-failure-transition.yml`
- `.github/workflows/research-institutional-withdrawal-v6-3-delayed-failure.yml`
- `.github/workflows/research-institutional-withdrawal-v6-4-durable-failure.yml`
- `.github/workflows/research-institutional-withdrawal-v6-5-recovery-reclaim.yml`
- `.github/workflows/research-institutional-withdrawal-v6-distribution-absorption.yml`
- `.github/workflows/research-institutional-withdrawal-validation-v1.yml`
- `.github/workflows/retry-institutional.yml`
- `.github/workflows/retry-sma.yml`
- `.github/workflows/round-2-factor-research.yml`
- `.github/workflows/round-3-candidate-research.yml`
- `.github/workflows/round-4-walk-forward-research.yml`
- `.github/workflows/round-5-factor-refinement.yml`
- `.github/workflows/run-fundamental-quality-execution-revalidation.yml`
- `.github/workflows/run-two-stage-fundamental-quality-entry-policy.yml`
- `.github/workflows/run-two-stage-fundamental-quality-entry-timing-paired.yml`
- `.github/workflows/run-two-stage-fundamental-quality-entry-timing.yml`
- `.github/workflows/run-two-stage-fundamental-quality-long-horizon-study.yml`
- `.github/workflows/run-two-stage-fundamental-quality-phase3-corrected.yml`
- `.github/workflows/run-two-stage-fundamental-quality-phase3.yml`
- `.github/workflows/run-two-stage-fundamental-quality-pullback-predictors.yml`
- `.github/workflows/run-two-stage-fundamental-quality-pullback-walk-forward.yml`
- `.github/workflows/run-two-stage-fundamental-quality-robustness.yml`
- `.github/workflows/run-two-stage-fundamental-quality-staged-entry.yml`
- `.github/workflows/run-two-stage-fundamental-quality-study.yml`
- `.github/workflows/run-two-stage-fundamental-quality-tail-excursions.yml`
- `.github/workflows/test-daily-gainers-institutional-parser.yml`
- `.github/workflows/test-eia-crude-spot.yml`
- `.github/workflows/test-finmind-broker-history.yml`
- `.github/workflows/test-histock-broker-history.yml`
- `.github/workflows/test-institutional-accumulation-catalyst-event-intelligence-final.yml`
- `.github/workflows/test-institutional-accumulation-catalyst-readiness.yml`
- `.github/workflows/test-institutional-accumulation-pit.yml`
- `.github/workflows/test-institutional-distribution-score.yml`
- `.github/workflows/test-node-regression-suite.yml`
- `.github/workflows/test-official-market-constraints-integration.yml`
- `.github/workflows/test-prediction-tag-strategy-engine.yml`
- `.github/workflows/test-race-safe-main-publish.yml`
- `.github/workflows/test-scheduled-collection-date.yml`
- `.github/workflows/test-strategy-review-center.yml`
- `.github/workflows/test-task-framework.yml`
- `.github/workflows/update-non-trading-days.yml`
- `.github/workflows/update-official-market-constraints.yml`
- `.github/workflows/update-three-day-breakout-report-index.yml`
- `.github/workflows/update-twse-industry.yml`
- `.github/workflows/validate-institutional-withdrawal-lifecycle-v1.yml`
- `.github/workflows/validate-institutional-withdrawal-recovery-contract-v1.yml`
- `.github/workflows/validate-institutional-withdrawal-regression-light.yml`
- `.github/workflows/validate-public-page-registry.yml`
- `.github/workflows/validate-tsmc-equipment-demand-ai.yml`
- `.github/workflows/verify-accumulation-mops-detail-contract-closeout.yml`
- `.github/workflows/verify-institutional-withdrawal-validation-closeout-v1.yml`
- `.github/workflows/warrant-scraper.yml`

## Completed

- Re-fetched and verified current remote `main` before relying on repository state.
- Read `AGENTS.md`, `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, `docs/architecture/github-actions.md`, and `docs/decisions/ADR-004-workflow-orchestration.md`.
- Independently verified the renderer's runtime-only dependencies.
- Scanned all 177 workflow YAML files rather than relying on the initial candidate list.
- Migrated 11 bounded safe workflows from standalone v1 job to embedded v2 step.
- Updated `docs/architecture/github-actions.md` to document staged v1/v2 normalization.
- Updated `scripts/migrate_workflow_schedule_summary.js` with `EMBEDDED_TARGETS`, v2 idempotence behavior, and Round 2 exceptions.
- Preserved self-trigger workflows and multi-job ambiguous workflows for later design.
- Did not manually dispatch any production crawler.

## Evidence / validation

### Implementation commits

- `529650d366084000e43644d34c66b09e9e66c564` — Round 1 embedded implementation, architecture update, migrator update.
- `c25a8621d12868eb5410e37ed14728f2e1b2cc99` — corrected the migrator template-literal escaping after CI exposed a Node syntax error.
- `30d3e735fc7aa91ec2c19c8cc1935cb047ffdf95` — preserved TPEx as a Round 2 exception rather than letting normalization edit its self-trigger workflow.

### Actions launched by the Round 1 implementation commit

For head SHA `529650d...`, GitHub reported exactly seven push-triggered CI/maintenance runs:

- `36601784835` — Audit GitHub Actions Node 24 — success.
- `36601784922` — Public Page Registry CI — success.
- `36601784942` — Scheduled Collection Date Regression — success.
- `36601784766` — Race-safe Main Publish Regression — success.
- `36601784775` — Scheduled Workflow Registry Contract — success.
- `36601784696` — Ensure Workflow Schedule Summary — initially failed because the first migrator revision had an unescaped `${{ github.sha }}` template expression.
- `36601784712` — Node Regression Suite — cancelled by its normal cancel-in-progress behavior as later script commits arrived.

Critically, none of the 11 migrated production workflows launched from the YAML modification commit. This satisfies the Round 1 self-trigger safety condition.

### Validation findings

- `scripts/write_workflow_schedule_summary.js --self-test` passed in run `36601784696` before the migrator syntax check.
- The initial migrator syntax failure was corrected by `c25a862...`.
- Scheduled workflow registry contract passed on the Round 1 implementation head (`36601784775`).
- Race-safe publish regression passed (`36601784766`); no write-layer cancellation or Pages architecture was changed.
- The later `30d3e73...` normalizer audit reached migration comparison and identified five unrelated newly added unmarked workflow files; those are now frozen as Round 2 exceptions instead of being modified in Round 1.
- All 11 v2 targets on current remote main have no standalone `Checkout repository for schedule summary` job and retain `node scripts/write_workflow_schedule_summary.js` inside the selected functional job.
- v2 preserves the three output labels because the shared renderer is unchanged.

### Final Round 1 closeout evidence

- Closeout commit: `a73285d4a8b617d7859592f8f67c604977af0366` — adds this canonical handoff and freezes the five newly discovered self-trigger/self-auditing normalizer gaps without editing their workflow YAML.
- Closeout Actions for `a73285d...`:
  - `36689695276` — Ensure Workflow Schedule Summary — **success**.
  - `36689695319` — Public Page Registry CI — **success**.
  - `36689695102` — Node Regression Suite — **success**.
- Ensure Workflow Schedule Summary closeout log confirms:
  - `write_workflow_schedule_summary self-test passed`;
  - workflow normalization scanned `177` files;
  - `changed_count: 0`;
  - `unchanged_count: 177`.
- `scripts/audit_workflow_deployment_races.js --self-test` was executed from the current remote-main script content in an isolated Node workspace and passed: `audit_workflow_deployment_races layered self-test passed`.
- Full deployment-layer invariants were also re-checked against current remote-main workflow structure during inventory: the canonical Pages workflow retains `group: github-pages`, `cancel-in-progress: true`, `workflow_call`, and `checkout ref: main`; no Round 1 change introduced `workflow_run` or changed write-layer cancellation.
- The Round 1 implementation commit `529650d...` launched only CI/maintenance workflows; none of the 11 migrated production collectors launched because of the YAML changes.
- Latest remote verification of all 11 Round 1 targets confirmed, for every target:
  - no standalone `schedule-timing-summary` job;
  - no `Checkout repository for schedule summary`;
  - exactly one existing repository checkout remains;
  - `# schedule-timing-summary:v2` is present;
  - `if: always() && github.event_name == 'schedule'` is present;
  - `node scripts/write_workflow_schedule_summary.js` is present.
- Normal data/prediction workflows continued to advance `main` after the closeout commit. Those later commits did not modify the Round 1 migration files during final verification.

## Round 1 Prompt B independent closeout — PASS

Independent verification was performed from current remote `main` without assuming the Prompt A completion report was correct.

### Prompt B live inventory

- Re-scanned all `177` current `.github/workflows/*.yml|yaml` files for:
  - `schedule-timing-summary`
  - `排程時間摘要`
  - `Checkout repository for schedule summary`
  - `write_workflow_schedule_summary.js`
- Live result:
  - `172` marker/script-bearing workflows.
  - `5` frozen-unmarked workflows.
  - exactly `11` workflows with `# schedule-timing-summary:v2`.
- The 11 live v2 workflows exactly match the Round 1 preregistered `EMBEDDED_TARGETS`; no silent extra migration and no missing target was found.
- The five frozen-unmarked workflows remain unmodified and explicitly deferred.

### Prompt B per-workflow v2 verification

For every Round 1 workflow on current remote `main`:

- no standalone `schedule-timing-summary` job remains;
- no `Checkout repository for schedule summary` step remains;
- exactly one repository checkout remains;
- the v2 step is inside the preregistered functional job;
- that functional job already checked out the repository before the v2 step;
- the step uses `if: always() && github.event_name == 'schedule'`;
- the step calls the shared `node scripts/write_workflow_schedule_summary.js`.

The verified functional jobs are:

- `calculate-twse-margin-maintenance.yml` → `calculate`
- `crawl-twse-institutional-investors.yml` → `crawl-twse-institutional-investors`
- `crawl-twse-margin-balance.yml` → `crawl-twse-margin-balance`
- `crawl-twse-quarterly-financial-quality.yml` → `crawl`
- `retry-institutional.yml` → `retry-institutional`
- `crawl-rankings.yml` → `crawl-rankings`
- `crawl-market-news.yml` → `crawl`
- `crawl-fubon-brokers-trade.yml` → `crawl`
- `crawl-twse-institutional-summaries.yml` → `crawl`
- `crawl-cnn-fear-and-greed.yml` → `crawl`
- `crawl-taifex-major-institutional-traders-futures-options.yml` → `crawl-taifex-futures-options`

### Prompt B behavior-diff verification

The implementation commit `529650d366084000e43644d34c66b09e9e66c564` was independently re-inspected.

Its workflow diff is limited to removing the legacy standalone summary job and embedding the shared v2 summary step. The two workflows with downstream deploy jobs retain the same deploy job contents (`needs`, `if`, and `uses: ./.github/workflows/deploy-pages.yml`); their apparent movement in the diff is only the consequence of removing the intervening summary job.

No Round 1 workflow diff changed:

- cron expressions;
- `workflow_dispatch` inputs;
- push triggers;
- target-date resolution;
- crawler commands;
- retry/jitter/cooldown behavior;
- physical batching;
- repository write paths;
- commit/push behavior;
- deployment calls;
- permissions;
- concurrency behavior.

### Prompt B summary contract verification

Current `scripts/write_workflow_schedule_summary.js` was re-read directly from remote main.

It still emits:

- `原定排程時間`
- `實際開始時間`
- `GitHub 排程延遲`

Its runtime inputs remain GitHub Actions metadata and Node built-ins:

- `GITHUB_EVENT_PATH`
- `GITHUB_REPOSITORY`
- `GITHUB_RUN_ID`
- `GITHUB_TOKEN`
- `GITHUB_STEP_SUMMARY`
- GitHub Actions run API metadata
- Node `fs`, `https`, and `child_process`

No stock, research, public artifact, or repository-history dataset dependency was introduced.

The exact closeout audit run `36689695276` was independently inspected and confirms:

- `node scripts/write_workflow_schedule_summary.js --self-test` executed;
- `write_workflow_schedule_summary self-test passed`;
- workflow normalization scanned `177` files;
- `changed_count: 0`;
- the audit job concluded `success`.

### Prompt B workflow-registry / syntax verification

Run `36601784775` (`[CI] Scheduled Workflow Registry Contract`) was independently inspected:

- `node --check scripts/audit_scheduled_workflow_outputs.js` executed;
- `node --test tests/audit_scheduled_workflow_outputs.test.js` executed;
- `8` tests passed;
- `0` failed;
- the registry test explicitly confirmed every current scheduled workflow has a registry rule.

The registry workflow, registry audit script/test, summary renderer, deployment-race audit script, and canonical `deploy-pages.yml` have not changed since the tested Round 1 implementation state.

### Prompt B deployment/write-layer audit

A fresh current-main scan of all `177` workflow YAML files applied the repository's deployment-race invariants and found:

- `workflow_run`: `0`
- `repository_dispatch` workaround: `0`
- repository/data writer with `cancel-in-progress: true`: `0`
- all local Pages callers continue to reference `./.github/workflows/deploy-pages.yml`.

Current `.github/workflows/deploy-pages.yml` was independently rechecked:

- exposes `workflow_call`;
- concurrency group is exactly `github-pages`;
- uses `cancel-in-progress: true`;
- checks out `ref: main`;
- does not have `contents: write`;
- does not run `git commit` or `git push`;
- contains no `workflow_run`;
- contains no `repository_dispatch`.

The current `scripts/audit_workflow_deployment_races.js` self-test implementation was re-read and its expected invariants remain unchanged. The prior exact-script self-test evidence recorded in this handoff remains applicable because that script has not changed since the tested closeout state.

### Prompt B GitHub Actions side-effect verification

The workflow-YAML migration commit `529650d...` created exactly seven push-triggered CI/maintenance runs:

- `36601784835` — Audit GitHub Actions Node 24 — success
- `36601784922` — Public Page Registry CI — success
- `36601784942` — Scheduled Collection Date Regression — success
- `36601784766` — Race-safe Main Publish Regression — success
- `36601784775` — Scheduled Workflow Registry Contract — success
- `36601784696` — Ensure Workflow Schedule Summary — initial failure later corrected by `c25a862...`
- `36601784712` — Node Regression Suite — cancelled as a later script commit superseded it

None of the 11 migrated production workflows launched because of the YAML migration commit. No production data-write cascade was caused by the Round 1 migration.

The later closeout commit `a73285d...` produced only CI/maintenance validation runs; all three finished successfully:

- `36689695276` — Ensure Workflow Schedule Summary
- `36689695319` — Public Page Registry CI
- `36689695102` — Node Regression Suite

### Prompt B durable remote-state verification

Round 1 implementation and closeout commits are durable ancestors of current remote main.

After the prior closeout commit, subsequent commits changed only data/prediction artifacts. Prompt B re-compared the previous closeout state against current remote main and found no changes under:

- `.github/workflows/**`
- `scripts/**`
- `docs/architecture/github-actions.md`
- `docs/handoffs/workflow-schedule-summary-lightweight-migration.md`

before this Prompt B handoff update.

### Round 1 PASS decision

All ten preregistered PASS conditions are satisfied.

**Round 1 is closed. Do not reopen it unless new contradictory repository evidence appears.**

### Independent Prompt B — final Round 1 PASS evidence

Prompt B independently verified the Round 1 closeout against remote `main`.

- Full live inventory: all `177` files under `.github/workflows/*.yml|*.yaml` were re-scanned for:
  - `schedule-timing-summary`
  - `排程時間摘要`
  - `Checkout repository for schedule summary`
  - `write_workflow_schedule_summary.js`
- Live result remains exactly:
  - `172` marker-bearing workflows;
  - `5` explicit unmarked/frozen exceptions;
  - exactly `11` v2 embedded Round 1 targets.
- No additional v2 workflow was discovered and no Round 1 target reverted.
- The actual `529650d366084000e43644d34c66b09e9e66c564` diff was independently inspected. For the 11 workflow YAML files, the semantic change is limited to removing the standalone summary job/checkout and inserting the shared v2 summary step into the already checked-out functional job. Cron, dispatch inputs, push triggers, crawler commands, target-date logic, retry/jitter, batching, permissions, concurrency, write paths, commit/push commands, and deployment calls were not changed.
- Current remote verification for all 11 Round 1 targets confirms:
  - `# schedule-timing-summary:v2` present;
  - no standalone `schedule-timing-summary` job;
  - no `Checkout repository for schedule summary`;
  - exactly one existing checkout;
  - `if: always() && github.event_name == 'schedule'`;
  - shared `node scripts/write_workflow_schedule_summary.js`.
- `scripts/write_workflow_schedule_summary.js` was independently re-read from current main:
  - required labels remain `原定排程時間`, `實際開始時間`, `GitHub 排程延遲`;
  - inputs remain GitHub Actions/runtime metadata plus GitHub run metadata;
  - no stock/research/public dataset dependency was introduced.
- GitHub run `36689695276` on closeout SHA `a73285d4a8b617d7859592f8f67c604977af0366` passed the repository's actual schedule-summary enforcement. Its log records `write_workflow_schedule_summary self-test passed` and normalization `workflow_count: 177`, `changed_count: 0`, `unchanged_count: 177`.
- GitHub run `36601784775` passed the scheduled-workflow registry contract on the Round 1 implementation head.
- GitHub run `36689695102` passed the Node regression suite after the bounded closeout fix.
- The initial normalizer syntax defect in `529650d...` was not ignored; it was corrected by `c25a8621d12868eb5410e37ed14728f2e1b2cc99`, and later normalization is green.
- Deployment/write-layer safety was independently re-scanned over the current 177 workflow files:
  - no `workflow_run`;
  - no `repository_dispatch` workaround;
  - no repository/data writer with `cancel-in-progress: true`;
  - canonical `.github/workflows/deploy-pages.yml` still has `group: github-pages`, Pages-only `cancel-in-progress: true`, `workflow_call`, `checkout ref: main`, and is not a repository writer.
- The current `scripts/audit_workflow_deployment_races.js` self-test contract was independently inspected and the same invariants were applied to current remote YAML. The chat container could not clone GitHub due DNS isolation, so the literal repo-wide local command could not be executed in this environment; no failed byte-transfer attempt was counted as evidence. Durable GitHub CI plus the independent 177-file live audit provide the closeout evidence instead.
- Actions side-effect check for implementation SHA `529650d...` found exactly seven push-triggered CI/maintenance runs:
  - `36601784835` — Audit GitHub Actions Node 24 — success
  - `36601784922` — Public Page Registry CI — success
  - `36601784942` — Scheduled Collection Date Regression — success
  - `36601784766` — Race-safe Main Publish Regression — success
  - `36601784775` — Scheduled Workflow Registry Contract — success
  - `36601784696` — Ensure Workflow Schedule Summary — initial bounded failure later fixed by `c25a862...`
  - `36601784712` — Node Regression Suite — cancelled by a subsequent script commit, later superseded by successful run `36689695102`
- None of the 11 migrated production workflows launched because of the Round 1 workflow-YAML commit. There was no production Action fan-out.
- Durable ancestry was independently checked: implementation SHA `529650d...` and closeout SHA `a4694cb99f79000165d6d949251d3c36eca0812e` are ancestors of current remote main.
- All changes after `a4694cb...` were re-compared against migration-sensitive paths; no `.github/workflows/**`, schedule-summary script/migrator/audit, architecture doc, or canonical handoff drift was found before this PASS checkpoint.
- Known Round 2 candidates remain explicitly deferred and unchanged:
  - `.github/workflows/crawl-tpex-daily-market-data.yml`
  - `.github/workflows/analyze-daily-gainers-margin-flow-2200.yml`
  - `.github/workflows/publish-daily-gainers-ai-analysis.yml`
  Each still has a push trigger and references its own YAML, so Round 2 must first decide whether that own-YAML `push.paths` entry should remain before editing the workflow.

**Prompt B verdict: PASS. Round 1 is closed.**

## Round 2 Prompt A implementation evidence

Round:
`workflow-schedule-summary-lightweight-migration-round-2`

Status:
- Prompt A: **COMPLETE**
- Prompt B: **PREREGISTERED / PENDING**

### Routing activation

- `49ebe2a603691bb04c92891ce8648c5ae87b90fd` — activated `workflow-schedule-summary-lightweight-migration` as the sole active task in `docs/agent-prompts/task-routing.json`.
- `institutional-accumulation-event-intelligence` was demoted to `pending` without changing its internal round state.

### Trigger decisions

The three preregistered self-trigger-risk workflows were reviewed before any summary migration.

Decision: each workflow's own YAML path should **not** remain a production `push.paths` trigger.

Reason:
- editing a workflow file is maintenance/configuration activity, not production data maturity;
- allowing the workflow file itself to trigger a repository-writing production workflow makes maintenance commits capable of launching production work;
- each workflow retains its real execution sources:
  - `crawl-tpex-daily-market-data.yml`: schedule + workflow_dispatch;
  - `analyze-daily-gainers-margin-flow-2200.yml`: schedule + workflow_dispatch + actual source-data/script push paths;
  - `publish-daily-gainers-ai-analysis.yml`: schedule + workflow_dispatch + pending-AI/contract/script push paths.

Trigger-hardening commit:
- `f2312e7ecde0fbbcb5dfe922d4345f1439edc668` — removed only the own-YAML production push trigger from:
  - `.github/workflows/crawl-tpex-daily-market-data.yml`;
  - `.github/workflows/analyze-daily-gainers-margin-flow-2200.yml`;
  - `.github/workflows/publish-daily-gainers-ai-analysis.yml`.
- TPEx's `push` block existed only for workflow-edit bootstrap, so that block was removed entirely.
- The other two workflows retained all real data/script push paths unchanged.
- Cron expressions, workflow_dispatch inputs, crawler commands, date logic, retry logic, batching, repository writes, deploy calls, permissions, and concurrency were unchanged.

Actions created by `f2312e7...` included only CI/maintenance workflows. None of the three production workflows launched because of the workflow-file change.

### v2 migration

Implementation commit:
- `d8f824c782b8150c559d022c273a972fb1051135` — migrated the bounded Round 2 cohort to embedded v2 schedule summary and updated the migrator.

Migrated placements:
- `.github/workflows/crawl-tpex-daily-market-data.yml` → job `crawl`;
- `.github/workflows/analyze-daily-gainers-margin-flow-2200.yml` → job `prepare-ai-facts`;
- `.github/workflows/publish-daily-gainers-ai-analysis.yml` → job `validate-and-publish`.

For all three current remote workflows:
- `# schedule-timing-summary:v2` is present;
- standalone `schedule-timing-summary` job is absent;
- `Checkout repository for schedule summary` is absent;
- exactly one pre-existing repository checkout remains;
- the embedded step uses `if: always() && github.event_name == 'schedule'`;
- the shared `node scripts/write_workflow_schedule_summary.js` renderer is used;
- write-layer `cancel-in-progress: true` was not introduced.

Migrator updates:
- added the three Round 2 targets to `EMBEDDED_TARGETS`;
- removed TPEx from `LEGACY_UNMARKED_EXCEPTIONS`;
- replaced the old TPEx frozen-exception self-test with Round 2 embedded-target idempotence coverage.

### Validation / Actions

Implementation SHA `d8f824c...` did **not** launch any of the three production workflows.

Relevant runs:
- `36821114484` — Ensure Workflow Schedule Summary — **SUCCESS**
  - executes `node scripts/write_workflow_schedule_summary.js --self-test`;
  - syntax-checks the migrator;
  - executes `node scripts/audit_workflow_deployment_races.js --self-test`;
  - executes full `node scripts/audit_workflow_deployment_races.js`;
  - runs the repository workflow normalizer and fails if any workflow diff remains.
- `36821114500` — Scheduled Workflow Registry Contract — **SUCCESS**.
- `36821114512` — Node Regression Suite — **SUCCESS**.
  - `npm test` passed;
  - tracked-tree cleanliness check passed.
- `36821114517` — Audit GitHub Actions Node 24 — **SUCCESS**.
- `36821114632` — Public Page Registry CI — **SUCCESS**.
- `36821114508` — Scheduled Collection Date Regression — **SUCCESS**.
- `36821114587` — 5% AI Contract consistency check — **SUCCESS**.

The long delay observed in several runs was in the GitHub checkout step; once checkout completed, the registered tests passed. No bounded migration defect was found.

### Prompt A completion boundary

All Round 2 Prompt A completion conditions are satisfied:
- bounded commits are durable on remote main;
- each intended workflow is remotely verified;
- migration/audit/regression gates pass;
- Actions inspection shows no unexpected production workflow launch;
- no Round 3 work has started.

**Prompt A complete — ready for Prompt B.**

## Round 2 Prompt B independent closeout — PASS

Round:
`workflow-schedule-summary-lightweight-migration-round-2`

Prompt B was recovered from the pre-Prompt-A durable handoff at activation commit
`49ebe2a603691bb04c92891ce8648c5ae87b90fd` and matched the current preserved Round 2 closeout contract.

### Exact commit / diff verification

Trigger-hardening commit:
- `f2312e7ecde0fbbcb5dfe922d4345f1439edc668`
- changed only:
  - `.github/workflows/crawl-tpex-daily-market-data.yml`
  - `.github/workflows/analyze-daily-gainers-margin-flow-2200.yml`
  - `.github/workflows/publish-daily-gainers-ai-analysis.yml`
- exact semantic change:
  - removed TPEx's workflow-edit-only `push` trigger;
  - removed each of the other two workflow YAML paths from their existing `push.paths`;
  - retained all real data/script push triggers;
  - retained all cron schedules and workflow_dispatch inputs.

v2 migration commit:
- `d8f824c782b8150c559d022c273a972fb1051135`
- changed only the same three workflow files plus:
  - `scripts/migrate_workflow_schedule_summary.js`
- workflow YAML changes are limited to:
  - removing the v1 standalone `schedule-timing-summary` job;
  - removing the summary-only checkout;
  - adding the v2 embedded summary step to the preregistered existing functional job.
- no unrelated cron/date/crawler/schema/publication/retry/batching/permissions/concurrency behavior changed.

### Current remote workflow verification

Current remote main was independently re-read after Prompt A.

All three Round 2 workflows still satisfy:
- `# schedule-timing-summary:v2` present;
- no standalone `schedule-timing-summary` job;
- no `Checkout repository for schedule summary`;
- exactly one existing repository checkout;
- `if: always() && github.event_name == 'schedule'`;
- shared `node scripts/write_workflow_schedule_summary.js`;
- own workflow YAML no longer appears in production `push.paths`;
- no `workflow_run`;
- no `repository_dispatch`;
- no `cancel-in-progress: true` introduced.

Verified placements:
- `.github/workflows/crawl-tpex-daily-market-data.yml` → `crawl`;
- `.github/workflows/analyze-daily-gainers-margin-flow-2200.yml` → `prepare-ai-facts`;
- `.github/workflows/publish-daily-gainers-ai-analysis.yml` → `validate-and-publish`.

The publish workflow still calls the canonical:
`./.github/workflows/deploy-pages.yml`
with its existing downstream topology unchanged.

### Summary renderer / migration / deployment audit

Current `scripts/write_workflow_schedule_summary.js` still contains:
- `原定排程時間`;
- `實際開始時間`;
- `GitHub 排程延遲`.

No stock/research/public dataset dependency was introduced.

Run `36821114484` — Ensure Workflow Schedule Summary — **SUCCESS**.
Its checked-in workflow contract executes:
- `node --check scripts/write_workflow_schedule_summary.js`;
- `node scripts/write_workflow_schedule_summary.js --self-test`;
- `node --check scripts/migrate_workflow_schedule_summary.js`;
- `node scripts/audit_workflow_deployment_races.js --self-test`;
- `node scripts/audit_workflow_deployment_races.js`;
- normalizer execution followed by a required clean `git diff` over `.github/workflows`.

The run's audit job and both relevant steps completed successfully, proving:
- renderer self-test PASS;
- deployment-race self-test PASS;
- full deployment-race audit PASS;
- migrator normalization/idempotence against checked-in workflow state PASS.

Current canonical `.github/workflows/deploy-pages.yml` was independently rechecked:
- exposes `workflow_call`;
- concurrency group is exactly `github-pages`;
- Pages-only `cancel-in-progress: true` remains;
- checks out `ref: main`;
- is not a repository writer.

### Registry / regression / YAML acceptance

- `36821114500` — Scheduled Workflow Registry Contract — **SUCCESS**.
- `36821114512` — Node Regression Suite — **SUCCESS**.
  - `npm test` PASS;
  - tracked-tree cleanliness PASS.
- `36821114517` — Audit GitHub Actions Node 24 — **SUCCESS**.
- `36821114632` — Public Page Registry CI — **SUCCESS**.
- `36821114508` — Scheduled Collection Date Regression — **SUCCESS**.
- `36821114587` — 5% AI Contract consistency check — **SUCCESS**.

The changed workflow YAML was accepted by GitHub Actions and the workflow-registry contract passed on the implementation SHA; no YAML parse/registration defect was observed.

### Actions side-effect verification

For `f2312e7...`:
- only CI/maintenance workflows were created;
- no TPEx collector, late Facts production run, or 5% AI publish production run launched because of the workflow-file changes;
- two maintenance runs were superseded/cancelled by the immediately following implementation commit, while their replacement runs on `d8f824c...` completed successfully.

For `d8f824c...`:
- only CI/maintenance workflows were created;
- none of the three migrated production workflows launched.

Therefore the Round 2 self-trigger safety objective is satisfied.

### Durable-state / freshness verification

At independent closeout:
- current remote main before this closeout checkpoint was
  `e6451ea2d233e17d58787490e17170cb48efba65`;
- implementation SHA `d8f824c...` is its direct implementation ancestor;
- the only file changed between `d8f824c...` and `e6451ea...` is this canonical handoff;
- no workflow, renderer, migrator, deployment audit, or routing drift occurred after the tested implementation state;
- `docs/agent-prompts/task-routing.json` still routes the unique active task to this project.

### Inventory correction discovered during closeout

A fresh live check of remaining candidates corrected one stale Round 1 classification:
- `.github/workflows/build-etf-market-regime-analysis.yml` currently contains its own YAML path only under `pull_request.paths`, not under production `push.paths`.
- It is therefore **not currently a production self-trigger-risk workflow**, although it still has a standalone v1 schedule summary.

Remaining confirmed own-YAML production-push-risk candidates include:
- `.github/workflows/crawl-eia-crude-spot.yml`;
- `.github/workflows/crawl-tdcc-shareholding-snapshot.yml`;
- `.github/workflows/momentum-history-replay.yml`;
- `.github/workflows/update-twse-industry.yml`.

**Prompt B closeout: PASS. Round 2 is closed.**

## Round 3 Prompt A implementation — COMPLETE

Round:
`workflow-schedule-summary-lightweight-migration-round-3`

Implementation commits:
- trigger hardening: `a6a940494a5eb3b3d47626b7d22d246f95d7adb9`
- v2 migration: `d2b81ce98973185603f392a6c798e46031714944`

### Trigger decisions

- `.github/workflows/crawl-eia-crude-spot.yml`
  - removed only its own workflow YAML from `push.paths`;
  - retained real script/test push triggers.
- `.github/workflows/crawl-tdcc-shareholding-snapshot.yml`
  - removed only its own workflow YAML from `push.paths`;
  - retained real script/test push triggers;
  - preserved the pre-existing conditional concurrency rule exactly:
    `cancel-in-progress: ${{ github.event_name == 'push' }}`.
- `.github/workflows/update-twse-industry.yml`
  - removed the obsolete workflow-file-only push trigger that was explicitly documented as temporary incident recovery after the 2026-08-20 repair run;
  - retained schedule and workflow_dispatch triggers.

Trigger-hardening diff is bounded to those three workflow files only. It changes no cron, collection logic, schema, retry, batching, permissions, or concurrency behavior.

### v2 placement

Added the Round 3 workflows to `scripts/migrate_workflow_schedule_summary.js` `EMBEDDED_TARGETS`:
- `crawl-eia-crude-spot.yml` → `collect`
- `crawl-tdcc-shareholding-snapshot.yml` → `archive`
- `update-twse-industry.yml` → `update-twse-industry`

Each current remote workflow now has:
- exactly one existing repository checkout;
- no standalone `schedule-timing-summary` job;
- no summary-only checkout;
- exactly one `# schedule-timing-summary:v2` marker;
- `if: always() && github.event_name == 'schedule'`;
- shared `node scripts/write_workflow_schedule_summary.js`;
- no own-YAML production push path.

### Validation evidence

Actions on implementation SHA `d2b81ce98973185603f392a6c798e46031714944`:
- `36825401277` — Ensure Workflow Schedule Summary — **SUCCESS**
  - shared summary tooling validation PASS;
  - repository-pinned summary verification PASS;
  - migrator normalization/idempotence and deployment-race audit are covered by this workflow contract.
- `36825401259` — Scheduled Workflow Registry Contract — **SUCCESS**.
- `36825401279` — Node Regression Suite — **SUCCESS**.
- `36825401331` — Audit GitHub Actions Node 24 — **SUCCESS**.
- `36825401188` — Public Page Registry CI — **SUCCESS**.

Actions side-effect inspection:
- trigger-hardening SHA `a6a9404...` produced no unexpected production run;
- migration SHA `d2b81ce...` launched only CI/maintenance workflows;
- none of EIA crude spot, TDCC shareholding snapshot, or Update TWSE Industry launched because of the workflow YAML changes.

### Prompt A completion boundary

Round 3 Prompt A completion conditions are satisfied:
- bounded implementation commits are durable on remote main;
- current YAML is remotely verified for all three workflows;
- schedule-summary ensure/audit PASS;
- scheduled-workflow registry PASS;
- Node regression PASS;
- Node 24 audit PASS;
- no unexpected production launch;
- no Round 3 Prompt B work has started.

**Prompt A complete — ready for Prompt B.**

## Round 3 Prompt B independent closeout — PASS

Round:
`workflow-schedule-summary-lightweight-migration-round-3`

Prompt B was recovered verbatim from the pre-Prompt-A durable handoff at commit
`3e8403d46b5f79ae92e2c2ab858c6947e320e592`.

### Exact commit / diff verification

Trigger-hardening commit:
- `a6a940494a5eb3b3d47626b7d22d246f95d7adb9`
- changed only:
  - `.github/workflows/crawl-eia-crude-spot.yml`
  - `.github/workflows/crawl-tdcc-shareholding-snapshot.yml`
  - `.github/workflows/update-twse-industry.yml`
- exact semantic changes:
  - EIA: removed only its own workflow YAML from `push.paths`; script/test triggers remain;
  - TDCC: removed only its own workflow YAML from `push.paths`; script/test triggers remain;
  - TWSE Industry: removed only the explicitly temporary workflow-file-only incident-recovery `push` trigger.
- no cron, target-date, crawler, schema, retry, batching, permissions, or concurrency changes are present.

v2 migration commit:
- `d2b81ce98973185603f392a6c798e46031714944`
- changed only the same three workflows plus:
  - `scripts/migrate_workflow_schedule_summary.js`
- workflow changes are limited to:
  - removing the v1 standalone `schedule-timing-summary` job;
  - removing the summary-only checkout;
  - embedding the shared v2 step in the preregistered existing functional job.
- migrator changes add exactly the three Round 3 `EMBEDDED_TARGETS`.
- no unrelated production behavior changed.

Prompt A checkpoint:
- `a27e4b44ca6bc086bd1ebf8d121f6e8ad8102345`
- changes only this canonical handoff.

### Current remote workflow verification

All three Round 3 workflows were independently re-read from current remote main.

Verified:
- `.github/workflows/crawl-eia-crude-spot.yml` → `collect`;
- `.github/workflows/crawl-tdcc-shareholding-snapshot.yml` → `archive`;
- `.github/workflows/update-twse-industry.yml` → `update-twse-industry`.

Each has:
- exactly one existing repository checkout;
- exactly one `# schedule-timing-summary:v2`;
- no `# schedule-timing-summary:v1`;
- no standalone `schedule-timing-summary` job;
- no summary-only checkout;
- `if: always() && github.event_name == 'schedule'`;
- shared `node scripts/write_workflow_schedule_summary.js`;
- no own-YAML production push path;
- no `workflow_run` or `repository_dispatch` workaround.

Concurrency was independently checked:
- EIA remains `cancel-in-progress: false`;
- TWSE Industry remains `cancel-in-progress: false`;
- TDCC remains exactly:
  `cancel-in-progress: ${{ github.event_name == 'push' }}`.
The TDCC rule was neither broadened nor weakened.

### Validation / audit evidence

Implementation SHA `d2b81ce98973185603f392a6c798e46031714944`:
- `36825401277` — Ensure Workflow Schedule Summary — **SUCCESS**
  - `Validate shared summary tooling` — SUCCESS;
  - renderer syntax/self-test, migrator syntax, deployment-race self-test/full audit, and focused workflow-data tests are covered by that step;
  - `Verify every workflow uses repository-pinned summary` — SUCCESS, proving migrator normalization/idempotence against checked-in workflow state.
- `36825401259` — Scheduled Workflow Registry Contract — **SUCCESS**
  - registry validation step — SUCCESS.
- `36825401279` — Node Regression Suite — **SUCCESS**
  - full Node regression suite — SUCCESS;
  - tracked-tree cleanliness verification — SUCCESS.
- `36825401331` — Audit GitHub Actions Node 24 — **SUCCESS**.
- `36825401188` — Public Page Registry CI — **SUCCESS**
  - homepage registry validation — SUCCESS;
  - workflow concurrency/deployment safety audit — SUCCESS.

Current renderer still contains all required summary labels:
- `原定排程時間`;
- `實際開始時間`;
- `GitHub 排程延遲`.

### Actions side-effect verification

For trigger-hardening SHA `a6a940494a5eb3b3d47626b7d22d246f95d7adb9`:
- only CI/maintenance workflows were created;
- the Node 24 and registry jobs were later superseded/cancelled by the immediately following migration commit;
- no EIA, TDCC, or TWSE Industry production collector launched.

For migration SHA `d2b81ce98973185603f392a6c798e46031714944`:
- only CI/maintenance workflows were created;
- all required replacement CI runs completed successfully;
- no EIA, TDCC, or TWSE Industry production collector launched.

Therefore no workflow-YAML commit violated the self-trigger stop condition.

### Durable-state / freshness verification

At independent closeout start:
- remote main was `a27e4b44ca6bc086bd1ebf8d121f6e8ad8102345`;
- implementation SHA `d2b81ce...` is its direct implementation ancestor;
- only this handoff changed after the implementation SHA;
- routing still names `workflow-schedule-summary-lightweight-migration` as the unique active task;
- no workflow/migrator drift occurred after the tested implementation state.

**Prompt B closeout: PASS. Round 3 is closed.**

## Round 4 Prompt A implementation — COMPLETE

Round:
`workflow-schedule-summary-lightweight-migration-round-4`

Implementation commit:
- `f4117bd5f10cd27c85ac60c2e7be997ba2499d9c`

### Bounded implementation

Migrated:
- `.github/workflows/crawl-external-market-indicators.yml` → `crawl`
- `.github/workflows/crawl-institutional.yml` → `crawl-institutional`
- `.github/workflows/crawl-mops-monthly-revenue.yml` → `crawl`

Updated:
- `scripts/migrate_workflow_schedule_summary.js`
  - added exactly the three Round 4 workflows to `EMBEDDED_TARGETS`.

No workflow in this cohort has a production `push` trigger on current main, so the workflow-YAML commit cannot self-trigger the three production collectors.

Each migrated workflow now has:
- exactly one existing repository checkout;
- exactly one `# schedule-timing-summary:v2`;
- no `# schedule-timing-summary:v1`;
- no standalone `schedule-timing-summary` job;
- no summary-only checkout;
- `if: always() && github.event_name == 'schedule'`;
- shared `node scripts/write_workflow_schedule_summary.js`;
- unchanged write-layer `cancel-in-progress: false`.

### Institutional Pages topology

`.github/workflows/crawl-institutional.yml` still retains exactly:
- job `deploy-pages`;
- `needs: crawl-institutional`;
- existing publish-ready/trading-day conditional gate;
- `uses: ./.github/workflows/deploy-pages.yml`.

Only the standalone summary job was removed and its shared v2 step embedded into `crawl-institutional`; downstream Pages orchestration is unchanged.

### Validation evidence

Actions on implementation SHA `f4117bd5f10cd27c85ac60c2e7be997ba2499d9c`:
- `36829327850` — Ensure Workflow Schedule Summary — **SUCCESS**.
- `36829327849` — Public Page Registry CI — **SUCCESS**.
- `36829327899` — Scheduled Collection Date Regression — **SUCCESS**.
- `36829327917` — Audit GitHub Actions Node 24 — **SUCCESS**.
- `36829327959` — Race-safe Main Publish Regression — **SUCCESS**.
- `36829327902` — Scheduled Workflow Registry Contract — **SUCCESS**.
- `36829327912` — Node Regression Suite — **SUCCESS**.
  - full Node regression suite PASS;
  - tracked-tree cleanliness PASS.

Actions side-effect inspection:
- only CI/maintenance workflows launched from the migration SHA;
- none of External Market, Institutional, or MOPS production workflows launched.

### Prompt A completion boundary

Round 4 Prompt A completion conditions are satisfied:
- bounded implementation commit is durable on remote main;
- current YAML is remotely verified for all three workflows;
- Ensure Workflow Schedule Summary PASS;
- deployment/concurrency audit PASS;
- Scheduled Workflow Registry Contract PASS;
- Node Regression PASS;
- race-safe publish regression PASS;
- no unexpected production launch;
- Institutional Pages topology preserved;
- no Round 4 Prompt B work has started.

**Prompt A complete — ready for Prompt B.**

## Round 4 Prompt B independent closeout — PASS

Round:
`workflow-schedule-summary-lightweight-migration-round-4`

Prompt B was recovered verbatim from the pre-Prompt-A durable handoff at commit
`92d7f68ef875523c97e952638d6385b51cbc7bcd`.

### Exact commit / diff verification

Implementation commit:
- `f4117bd5f10cd27c85ac60c2e7be997ba2499d9c`
- changed only:
  - `.github/workflows/crawl-external-market-indicators.yml`
  - `.github/workflows/crawl-institutional.yml`
  - `.github/workflows/crawl-mops-monthly-revenue.yml`
  - `scripts/migrate_workflow_schedule_summary.js`
- exact workflow changes are limited to removing each v1 standalone schedule-summary job and embedding the shared v2 step in the preregistered existing functional job;
- exact migrator change adds only the three Round 4 `EMBEDDED_TARGETS`;
- no cron, date-resolution, crawler, schema, publication, retry, batching, permissions, or concurrency changes are present.

Prompt A checkpoint:
- `ffc50bdb114a3b68126047eaabf07a20cfa46cc7`
- changes only this canonical handoff.

### Current remote workflow verification

All three Round 4 workflows were independently re-read from current remote main.

Verified:
- `.github/workflows/crawl-external-market-indicators.yml` → `crawl`;
- `.github/workflows/crawl-institutional.yml` → `crawl-institutional`;
- `.github/workflows/crawl-mops-monthly-revenue.yml` → `crawl`.

Each has:
- no production `push` trigger;
- exactly one existing repository checkout;
- exactly one `# schedule-timing-summary:v2`;
- no `# schedule-timing-summary:v1`;
- no standalone `schedule-timing-summary` job;
- no summary-only checkout;
- `if: always() && github.event_name == 'schedule'`;
- shared `node scripts/write_workflow_schedule_summary.js`;
- unchanged `cancel-in-progress: false`;
- no `workflow_run` or `repository_dispatch` workaround.

### Institutional Pages topology

`.github/workflows/crawl-institutional.yml` independently retains:
- exactly one `deploy-pages` job;
- exactly one `needs: crawl-institutional`;
- the original trading-day/publish-ready conditional gate;
- exactly one `uses: ./.github/workflows/deploy-pages.yml`.

Canonical `.github/workflows/deploy-pages.yml` still:
- exposes `workflow_call`;
- uses concurrency group `github-pages`;
- has Pages-only `cancel-in-progress: true`;
- checks out `ref: main`;
- does not request `contents: write`.

Therefore the repository-write / Pages publication safety boundary is unchanged.

### Validation / audit evidence

Implementation SHA `f4117bd5f10cd27c85ac60c2e7be997ba2499d9c`:
- `36829327850` — Ensure Workflow Schedule Summary — **SUCCESS**
  - shared summary tooling validation — SUCCESS;
  - renderer self-test and deployment-race audit covered by that step — PASS;
  - repository-pinned normalization verification — SUCCESS, proving migrator normalization/idempotence against checked-in workflow state.
- `36829327849` — Public Page Registry CI — **SUCCESS**
  - canonical homepage validation — SUCCESS;
  - workflow concurrency/deployment safety audit — SUCCESS.
- `36829327899` — Scheduled Collection Date Regression — **SUCCESS**.
- `36829327917` — Audit GitHub Actions Node 24 — **SUCCESS**.
- `36829327959` — Race-safe Main Publish Regression — **SUCCESS**.
- `36829327902` — Scheduled Workflow Registry Contract — **SUCCESS**.
- `36829327912` — Node Regression Suite — **SUCCESS**
  - full Node regression suite — SUCCESS;
  - tracked-tree cleanliness verification — SUCCESS.

The changed workflow YAML was accepted by GitHub Actions and all applicable registry/regression contracts passed on the implementation SHA.

### Actions side-effect verification

For implementation SHA `f4117bd5f10cd27c85ac60c2e7be997ba2499d9c`:
- only the seven expected CI/maintenance workflows ran;
- no External Market production collector launched;
- no Institutional production collector launched;
- no MOPS production collector launched.

Therefore Round 4 introduced no unexpected production self-trigger.

### Durable-state / freshness verification

At independent closeout start:
- remote main was `ffc50bdb114a3b68126047eaabf07a20cfa46cc7`;
- the only commit after implementation SHA `f4117bd5...` was the Prompt A handoff checkpoint;
- routing still names `workflow-schedule-summary-lightweight-migration` as the unique active task;
- no workflow, migrator, renderer, deployment, or routing drift occurred after the tested implementation state.

**Prompt B closeout: PASS. Round 4 is closed.**

## Round 5 Prompt A implementation — COMPLETE

Round:
`workflow-schedule-summary-lightweight-migration-round-5`

Implementation commit:
- `66ff214a9d838c070729193d7dfef20ec202487e`

### Bounded implementation

Migrated:
- `.github/workflows/crawl-pocket-00981a.yml` → `crawl-pocket-00981a`
- `.github/workflows/crawl-refined-product-tightness.yml` → `collect`
- `.github/workflows/crawl-taifex-major-institutional-traders-futures-contracts.yml` → `crawl-taifex-futures-contracts`

Updated:
- `scripts/migrate_workflow_schedule_summary.js`
  - added exactly the three Round 5 workflows to `EMBEDDED_TARGETS`.

At implementation time, none of the three workflows had a production `push` trigger, so the workflow-YAML commit could not self-trigger the three production collectors.

Each migrated workflow now has:
- exactly one existing repository checkout;
- exactly one `# schedule-timing-summary:v2`;
- no `# schedule-timing-summary:v1`;
- no standalone `schedule-timing-summary` job;
- no summary-only checkout;
- `if: always() && github.event_name == 'schedule'`;
- shared `node scripts/write_workflow_schedule_summary.js`;
- unchanged `cancel-in-progress: false`.

### Validation evidence

Actions on implementation SHA `66ff214a9d838c070729193d7dfef20ec202487e`:
- `36849681571` — Ensure Workflow Schedule Summary — **SUCCESS**.
- `36849681660` — Public Page Registry CI — **SUCCESS**.
- `36849681620` — Scheduled Collection Date Regression — **SUCCESS**.
- `36849681575` — Scheduled Workflow Registry Contract — **SUCCESS**.
- `36849681580` — Audit GitHub Actions Node 24 — **SUCCESS**.
- `36849681570` — Node Regression Suite — **CANCELLED**, not failed.
  - it was superseded by a later unrelated main commit while still in checkout.

Concurrent main advancement after the implementation SHA:
- current main advanced by exactly one commit to `537311e3c168e6fa72fa0e781252b8e75722a7d4`;
- the only changed path between the implementation SHA and that main was:
  `scripts/apply_pages_size_budget.js`;
- no Round 5 workflow, migrator, renderer, routing, or schedule-summary state changed.

Replacement Node regression on current durable main:
- `36849959023` — Node Regression Suite — **SUCCESS**;
- full Node regression suite PASS;
- tracked-tree cleanliness PASS.

Actions side-effect inspection:
- the Round 5 migration commit launched only CI/maintenance workflows;
- none of Pocket 00981A, Refined Product Tightness, or TAIFEX Futures Contracts production collectors launched because of the workflow YAML change.

### Prompt A completion boundary

Round 5 Prompt A completion conditions are satisfied:
- bounded implementation commit is durable and remains an ancestor of current remote main;
- current main differs only by an unrelated `scripts/apply_pages_size_budget.js` commit;
- current YAML state for all three workflows remains the migrated v2 state;
- Ensure Workflow Schedule Summary PASS;
- deployment/concurrency audit PASS;
- Scheduled Workflow Registry Contract PASS;
- Node 24 audit PASS;
- Scheduled Collection Date Regression PASS;
- replacement Node Regression PASS on current durable main;
- no unexpected production launch;
- no Round 5 Prompt B work has started.

**Prompt A complete — ready for Prompt B.**

## Round 5 Prompt B independent closeout — PASS

Round:
`workflow-schedule-summary-lightweight-migration-round-5`

Prompt B was recovered verbatim from the pre-Prompt-A durable handoff at commit
`636b79e75159ac444de27342b20bb414568e310d`.

### Exact commit / diff verification

Implementation commit:
- `66ff214a9d838c070729193d7dfef20ec202487e`
- changed only:
  - `.github/workflows/crawl-pocket-00981a.yml`
  - `.github/workflows/crawl-refined-product-tightness.yml`
  - `.github/workflows/crawl-taifex-major-institutional-traders-futures-contracts.yml`
  - `scripts/migrate_workflow_schedule_summary.js`
- workflow changes are limited to removing each v1 standalone schedule-summary job and embedding the shared v2 step in the preregistered existing functional job;
- migrator changes add only the three Round 5 `EMBEDDED_TARGETS`;
- no cron, date-resolution, crawler, schema, publication, retry, batching, permissions, or concurrency changes are present.

Prompt A checkpoint:
- `cc5ae46210b904f04d511aec1a428db34bf2e756`
- changes only this canonical handoff.

### Current remote workflow verification

All three Round 5 workflows were independently re-read from current remote main.

Each currently has:
- no production `push` trigger;
- exactly one existing repository checkout;
- exactly one `# schedule-timing-summary:v2`;
- no `# schedule-timing-summary:v1`;
- no standalone `schedule-timing-summary` job;
- no summary-only checkout;
- `if: always() && github.event_name == 'schedule'`;
- shared `node scripts/write_workflow_schedule_summary.js`;
- unchanged `cancel-in-progress: false`;
- no `workflow_run` or `repository_dispatch` workaround.

The migrator still contains all three Round 5 targets.

### Validation / audit evidence

Implementation SHA `66ff214a9d838c070729193d7dfef20ec202487e`:
- `36849681571` — Ensure Workflow Schedule Summary — **SUCCESS**.
- `36849681660` — Public Page Registry CI — **SUCCESS**.
- `36849681620` — Scheduled Collection Date Regression — **SUCCESS**.
- `36849681575` — Scheduled Workflow Registry Contract — **SUCCESS**.
- `36849681580` — Audit GitHub Actions Node 24 — **SUCCESS**.
- `36849681570` — Node Regression Suite — **CANCELLED**, not failed, because a later main commit superseded it while still in checkout.

Replacement validation:
- `36849959023` — Node Regression Suite on descendant main `537311e3c168e6fa72fa0e781252b8e75722a7d4` — **SUCCESS**;
- full Node regression suite — SUCCESS;
- tracked-tree cleanliness — SUCCESS.
- `36849958768` — Public Page Registry CI on the same descendant main — **SUCCESS**.

Because no Round 5 workflow/migrator file changed between the implementation SHA and the replacement-regression SHA, the replacement run is valid durable-state evidence for the cancelled implementation-sha regression.

### Actions side-effect verification

For implementation SHA `66ff214a9d838c070729193d7dfef20ec202487e`:
- only CI/maintenance workflows launched;
- no Pocket 00981A production collector launched;
- no Refined Product Tightness production collector launched;
- no TAIFEX Futures Contracts production collector launched.

Therefore the migration introduced no unexpected production self-trigger.

### Concurrent-main classification / durability

At independent closeout start, remote main had advanced beyond the Prompt A checkpoint to
`51c8b5abeee69add43f09ffc4f29d342d3f1cd43`.

Changes after the Round 5 implementation consist of:
- normal TAIFEX/TWSE/TWT49U data outputs;
- unrelated `scripts/apply_pages_size_budget.js`;
- the Round 5 Prompt A handoff checkpoint.

No Round 5 workflow, migrator target, renderer, routing, or schedule-summary behavior drifted.

Routing still names `workflow-schedule-summary-lightweight-migration` as the unique active task.

**Prompt B closeout: PASS. Round 5 is closed.**

## Round 6 Prompt A implementation — COMPLETE

Round:
`workflow-schedule-summary-lightweight-migration-round-6`

Implementation commit:
- `415365d9625d7146fed575a850775cced989e08f`

### Bounded implementation

Migrated:
- `.github/workflows/crawl-twse-mi-index.yml` → `crawl-twse-mi-index`
- `.github/workflows/crawl-twse-twt49u.yml` → `crawl`
- `.github/workflows/crawl-vix-index.yml` → `crawl`

Updated:
- `scripts/migrate_workflow_schedule_summary.js`
  - added exactly the three Round 6 workflows to `EMBEDDED_TARGETS`.

At implementation time, none of the three workflows had a production `push` trigger.

Each migrated workflow now has:
- exactly one existing repository checkout;
- exactly one `# schedule-timing-summary:v2`;
- no `# schedule-timing-summary:v1`;
- no standalone `schedule-timing-summary` job;
- no summary-only checkout;
- `if: always() && github.event_name == 'schedule'`;
- shared `node scripts/write_workflow_schedule_summary.js`;
- unchanged `cancel-in-progress: false`.

VIX's pre-existing `node-version: '20'` was intentionally left unchanged because Node runtime migration is outside this bounded round.

### Validation evidence

Actions on implementation SHA `415365d9625d7146fed575a850775cced989e08f`:
- `36855552367` — Ensure Workflow Schedule Summary — **SUCCESS**.
- `36855552317` — Public Page Registry CI — **SUCCESS**.
- `36855552419` — Scheduled Collection Date Regression — **SUCCESS**.
- `36855552472` — Audit GitHub Actions Node 24 — **SUCCESS**.
- `36855553547` — Scheduled Workflow Registry Contract — **SUCCESS**.
- `36855552437` — Node Regression Suite — **SUCCESS**.
  - full Node regression suite PASS;
  - tracked-tree cleanliness PASS.

Actions side-effect inspection:
- the migration push itself launched only CI/maintenance workflows;
- a later `crawl-twse-institutional-summaries.yml` run with the same head SHA was a normal `schedule` event, not caused by the migration push;
- none of TWSE MI Index, TWT49U, or VIX production workflows launched because of the workflow YAML change.

### Concurrent main advancement

Before handoff checkpoint, remote main advanced by one normal scheduled data commit to
`53cc8c9630d2ef1f65a0911cc0282b69d0db0936`.

That descendant changed only:
- `data_twse_dealers/*`;
- `data_twse_foreign_investors/*`;
- `data_twse_investment_trust/*`.

No Round 6 workflow, migrator, renderer, routing, or schedule-summary state changed.

### Prompt A completion boundary

Round 6 Prompt A completion conditions are satisfied:
- bounded implementation commit remains a direct ancestor of current remote main;
- current YAML state for all three workflows remains the migrated v2 state;
- Ensure Workflow Schedule Summary PASS;
- deployment/concurrency audit PASS;
- Scheduled Workflow Registry Contract PASS;
- Node Regression PASS;
- tracked-tree cleanliness PASS;
- no unexpected production self-trigger;
- no Round 6 Prompt B work has started.

**Prompt A complete — ready for Prompt B.**

## Round 6 Prompt B independent closeout — PASS

Round:
`workflow-schedule-summary-lightweight-migration-round-6`

Prompt B was recovered verbatim from the pre-Prompt-A durable handoff at commit
`1ed76d58d93bc7015ca14c3221ee62fefd88edd7`.

### Exact commit / diff verification

Implementation commit:
- `415365d9625d7146fed575a850775cced989e08f`
- changed only:
  - `.github/workflows/crawl-twse-mi-index.yml`
  - `.github/workflows/crawl-twse-twt49u.yml`
  - `.github/workflows/crawl-vix-index.yml`
  - `scripts/migrate_workflow_schedule_summary.js`
- workflow changes are limited to removing each v1 standalone schedule-summary job and embedding the shared v2 step in the preregistered existing functional job;
- migrator changes add only the three Round 6 `EMBEDDED_TARGETS`;
- no cron, date-resolution, crawler, schema, publication, retry, batching, permissions, or concurrency changes are present;
- VIX's pre-existing Node 20 runtime was deliberately left unchanged.

Prompt A checkpoint:
- `42835d46031186dee7da4a1c3d3ba6aaf451893d`
- changes only this canonical handoff.

### Current remote workflow verification

All three Round 6 workflows were independently re-read from current remote main.

Each currently has:
- no production `push` trigger;
- exactly one existing repository checkout;
- exactly one `# schedule-timing-summary:v2`;
- no `# schedule-timing-summary:v1`;
- no standalone `schedule-timing-summary` job;
- no summary-only checkout;
- `if: always() && github.event_name == 'schedule'`;
- shared `node scripts/write_workflow_schedule_summary.js`;
- unchanged `cancel-in-progress: false`;
- no `workflow_run` or `repository_dispatch` workaround.

The migrator still contains all three Round 6 targets.

### Validation / audit evidence

Implementation SHA `415365d9625d7146fed575a850775cced989e08f`:
- `36855552367` — Ensure Workflow Schedule Summary — **SUCCESS**.
- `36855552317` — Public Page Registry CI — **SUCCESS**.
- `36855552419` — Scheduled Collection Date Regression — **SUCCESS**.
- `36855552472` — Audit GitHub Actions Node 24 — **SUCCESS**.
- `36855553547` — Scheduled Workflow Registry Contract — **SUCCESS**.
- `36855552437` — Node Regression Suite — **SUCCESS**.
  - full Node regression suite — SUCCESS;
  - tracked-tree cleanliness — SUCCESS.

The changed workflow YAML was accepted by GitHub Actions and all applicable registry/regression contracts passed on the implementation SHA.

### Actions side-effect verification

For implementation SHA `415365d9625d7146fed575a850775cced989e08f`:
- migration-push-triggered runs were only CI/maintenance workflows;
- a later `crawl-twse-institutional-summaries.yml` run sharing the same head SHA was an independent `schedule` event;
- no TWSE MI Index production collector launched from the migration push;
- no TWT49U production collector launched from the migration push;
- no VIX production collector launched from the migration push.

Therefore Round 6 introduced no unexpected production self-trigger.

### Concurrent-main classification / durability

Current main is two commits ahead of the implementation SHA:
- one normal scheduled data commit adding/updating TWSE dealers, foreign investors, and investment trust data;
- the Round 6 Prompt A handoff checkpoint.

No Round 6 workflow, migrator target, renderer, routing, or schedule-summary behavior drifted.

Routing still names `workflow-schedule-summary-lightweight-migration` as the unique active task.

**Prompt B closeout: PASS. Round 6 is closed.**

## Round 7 Prompt A implementation evidence

Round:
`workflow-schedule-summary-lightweight-migration-round-7`

Bounded implementation commits:
- `ec819ca806398880337ed95aba4a60c2b8340b0f` — embed v2 summary in `.github/workflows/prepare-market-environment.yml`.
- `34a9ed28301b202934a73322433a81d09e5192d7` — embed v2 summary in `.github/workflows/retry-sma.yml`.
- `5cce71611094b1b024a49fa85ebdecdf183f636f` — embed v2 summary in `.github/workflows/update-non-trading-days.yml`.
- `86db7619b1c78d858ce27bbfce445410515cfa3f` — register the three Round 7 `EMBEDDED_TARGETS` in `scripts/migrate_workflow_schedule_summary.js`.

Exact diff verification:
- each workflow change only removes the v1 standalone `schedule-timing-summary` job and embeds one `# schedule-timing-summary:v2` step in the preregistered existing functional job;
- all three embedded steps use `if: always() && github.event_name == 'schedule'` and the shared `node scripts/write_workflow_schedule_summary.js`;
- none of the three workflows has a production `push` trigger;
- `prepare-market-environment.yml` and `retry-sma.yml` retain `cancel-in-progress: false`;
- `update-non-trading-days.yml` still has no explicit concurrency/cancellation rule;
- no cron, date-resolution, crawler, schema, publication, retry, batching, permissions, Pages topology, or concurrency behavior changed.

Validation / audit evidence:
- `36870909804` — Ensure Workflow Schedule Summary — **SUCCESS**.
  - renderer self-test passed;
  - deployment-race layered self-test passed;
  - repository-wide deployment layering audit passed across 177 workflow files;
  - migrator normalization reported all workflows pinned with no diff.
- `36870858160` — Scheduled Workflow Registry Contract — **SUCCESS**.
- `36870909830` — Node Regression Suite — **SUCCESS**.
- `36870909840` — Public Page Registry CI — **SUCCESS**.

Actions side-effect verification:
- workflow-YAML commits `ec819ca...`, `34a9ed...`, and `5cce716...` launched only CI/maintenance validation workflows through `push`; none launched the Round 7 production collectors;
- on implementation SHA `86db761...`, a concurrent ETF Market Regime run was an independent `schedule` event, not a migration push side effect;
- no `Prepare Market Environment`, `Retry SMA Failed`, or `Update Non-Trading Days` production run was launched by the migration commits.

Concurrent-main classification:
- after `86db761...`, remote `main` advanced to `0d6f902625ccc34595e9c52e3558568fa8a208e8` through one scheduled data commit;
- that descendant changed only `public/data/etf-market-regime-analysis/data.json`;
- no Round 7 workflow, migrator, renderer, routing, or schedule-summary state drifted.

### Prompt A completion boundary

Round 7 Prompt A completion conditions are satisfied:
- bounded implementation is durable on remote main;
- all three current workflow YAML files contain exactly one v2 embedded summary and no v1 standalone summary;
- Ensure Workflow Schedule Summary PASS;
- deployment/concurrency audit PASS;
- Scheduled Workflow Registry Contract PASS;
- Node Regression PASS;
- no unexpected production self-trigger;
- routing still points to `workflow-schedule-summary-lightweight-migration`;
- Round 7 Prompt B has not started.

**Prompt A complete — ready for Prompt B.**

## Round 7 Prompt B independent closeout — PASS

Round:
`workflow-schedule-summary-lightweight-migration-round-7`

Prompt B was recovered verbatim from the pre-Prompt-A durable handoff at commit
`d7d12a15576c1248aba94610ceafcbc8f1ae9adc`.

### Exact commit / diff verification

Implementation commits:
- `ec819ca806398880337ed95aba4a60c2b8340b0f` — `.github/workflows/prepare-market-environment.yml`;
- `34a9ed28301b202934a73322433a81d09e5192d7` — `.github/workflows/retry-sma.yml`;
- `5cce71611094b1b024a49fa85ebdecdf183f636f` — `.github/workflows/update-non-trading-days.yml`;
- `86db7619b1c78d858ce27bbfce445410515cfa3f` — the three corresponding `EMBEDDED_TARGETS`.

Independent diff review confirms the workflow commits only:
- remove the v1 standalone `schedule-timing-summary` job and its summary-only checkout;
- add one embedded `# schedule-timing-summary:v2` step in the preregistered functional job;
- add `if: always() && github.event_name == 'schedule'`;
- keep the shared renderer `node scripts/write_workflow_schedule_summary.js`.

No cron, target-date/date-resolution, crawler, schema, publication, retry, physical-batch, permissions, Pages topology, or write-layer concurrency changes were introduced.

`update-non-trading-days.yml` still has no explicit `concurrency` block, satisfying the Round 7 special invariant.

### Current remote workflow verification

All three Round 7 workflows were re-read from current remote main and independently verified:
- no production `push` trigger;
- no `# schedule-timing-summary:v1`;
- no standalone `schedule-timing-summary` job;
- exactly one `# schedule-timing-summary:v2`;
- embedded step uses `always() && github.event_name == 'schedule'`;
- selected functional job already contains the repository checkout;
- shared renderer is used;
- `prepare-market-environment.yml` and `retry-sma.yml` retain `cancel-in-progress: false`;
- `update-non-trading-days.yml` retains no explicit concurrency/cancellation rule.

The migrator still contains all three Round 7 targets.

### Validation / audit evidence

Final implementation state:
- `36870909804` — Ensure Workflow Schedule Summary — **SUCCESS**.
  - `write_workflow_schedule_summary.js --self-test` passed;
  - deployment-race layered self-test passed;
  - repository-wide deployment layering audit passed;
  - migrator normalization/idempotence left no workflow diff.
- `36870858160` — Scheduled Workflow Registry Contract — **SUCCESS**; 8 tests passed.
- `36870909830` — Node Regression Suite — **SUCCESS**; 909 tests passed and tracked-tree cleanliness gate passed.
- `36870909840` — Public Page Registry CI — **SUCCESS**; deployment layering audit passed.

An intermediate Ensure Workflow Schedule Summary run on `34a9ed28301b202934a73322433a81d09e5192d7` failed before the Round 7 migrator allowlist update existed. That intermediate failure is superseded by the required final-state PASS on `86db7619b1c78d858ce27bbfce445410515cfa3f`; it does not represent a remaining defect.

### Actions side-effect verification

For each workflow-YAML implementation SHA:
- push-triggered runs were CI/maintenance workflows only;
- no `Prepare Market Environment`, `Retry SMA Failed`, or `Update Non-Trading Days` production workflow launched because of the migration commit.

A run sharing `86db761...` for ETF Market Regime was independently classified as `event: schedule`, not a migration push side effect.

Therefore Round 7 introduced no unexpected production self-trigger.

### Concurrent-main classification / durability

After the Round 7 Prompt A checkpoint `cb3dd06938e2b855daaca139a66b4d973a134876`, current main advanced through five normal scheduled data commits, ending at
`51b77c734e7238522480ccba9ac9fb727a6b3e90`.

Those descendants changed data/public analysis outputs only, including CNN Fear & Greed, TWSE margin, market news, TPEx daily data, and Fubon broker-trade outputs. They did not modify:
- any Round 7 workflow;
- `scripts/migrate_workflow_schedule_summary.js`;
- the shared renderer;
- task routing;
- the canonical handoff before this closeout update.

Routing still names `workflow-schedule-summary-lightweight-migration` as the sole active task.

**Prompt B closeout: PASS. Round 7 is closed.**

## Round 8 Prompt A implementation evidence

Round:
`workflow-schedule-summary-lightweight-migration-round-8`

Bounded implementation commits:
- `16106ad7e5c7c5553b260710335bfeaad4745a91` — embed v2 summary in `.github/workflows/update-official-market-constraints.yml`.
- `9920aa14a5736b07c6cc9eada5bd65723772bbb2` — embed v2 summary in `.github/workflows/warrant-scraper.yml`.
- `3b303ce5bb0ebdce4ab3f5658c005e28888e9a35` — register the two Round 8 `EMBEDDED_TARGETS` in `scripts/migrate_workflow_schedule_summary.js`.

Exact diff verification:
- each workflow change only removes the v1 standalone `schedule-timing-summary` job and embeds one `# schedule-timing-summary:v2` step in the preregistered existing functional job;
- both embedded steps use `if: always() && github.event_name == 'schedule'` and the shared `node scripts/write_workflow_schedule_summary.js`;
- neither workflow has a production `push` trigger;
- both retain `cancel-in-progress: false`;
- no cron, target-date/date-resolution, crawler, schema, publication, retry, batching, permissions, Pages topology, or write-layer concurrency behavior changed;
- `update-official-market-constraints.yml` finalization-phase selection, prediction-context immutability messaging/behavior, and bounded write scope are unchanged;
- `warrant-scraper.yml` Playwright cache/install/smoke-test topology, source-date contract validation, and `data_twse/` write scope are unchanged.

Validation / audit evidence:
- `36891092336` — Ensure Workflow Schedule Summary — **SUCCESS**.
  - renderer self-test passed;
  - deployment-race layered self-test passed;
  - repository-wide deployment layering audit passed;
  - migrator normalization/idempotence left no workflow diff.
- `36891092315` — Public Page Registry CI — **SUCCESS**.
- `36891084187` — Scheduled Workflow Registry Contract — **SUCCESS**; 8 tests passed.
- `36891084203` — Audit GitHub Actions Node 24 — **SUCCESS**.
- `36891084262` — Scheduled Collection Date Regression — **SUCCESS**.
- `36891092206` — Node Regression Suite — **SUCCESS**; 909 tests passed and tracked-tree cleanliness gate passed.

Actions side-effect verification:
- workflow-YAML commits `16106ad...` and `9920aa...` launched only CI/maintenance validation workflows through `push`;
- no `正式處置股與台指期夜盤定稿` or `Warrant Data Scraper` production workflow was launched by the migration commits;
- no production manual dispatch was used for validation.

Concurrent-main classification:
- after `3b303ce...`, remote `main` advanced to `44bb6b29c0a92f384af7048cdd0b0ab827e06e88` through one scheduled TWSE quarterly-financial-quality data commit;
- that descendant changed only `data_twse_quarterly_financial_quality/2026Q2/2059-latest.json` and `data_twse_quarterly_financial_quality/2026Q2/income-statement-general.json`;
- no Round 8 workflow, migrator, renderer, routing, or schedule-summary state drifted.

### Prompt A completion boundary

Round 8 Prompt A completion conditions are satisfied:
- bounded implementation is durable on remote main;
- both current workflow YAML files contain exactly one v2 embedded summary and no v1 standalone summary;
- Ensure Workflow Schedule Summary PASS;
- deployment/concurrency audit PASS;
- Scheduled Workflow Registry Contract PASS;
- Node 24 audit PASS;
- Scheduled Collection Date Regression PASS;
- Node Regression PASS;
- tracked-tree cleanliness PASS;
- no unexpected production self-trigger;
- routing still points to `workflow-schedule-summary-lightweight-migration`;
- Round 8 Prompt B has not started.

**Prompt A complete — ready for Prompt B.**

## Round 8 Prompt B independent closeout — PASS

Round:
`workflow-schedule-summary-lightweight-migration-round-8`

The exact Round 8 Prompt B was recovered from the pre-Prompt-A durable handoff at
`7a33d3dfc96e5dce8d895d390ab1649e45992c73`.

### Commit / scope verification

Round 8 implementation commits:
- `16106ad7e5c7c5553b260710335bfeaad4745a91` — `.github/workflows/update-official-market-constraints.yml`;
- `9920aa14a5736b07c6cc9eada5bd65723772bbb2` — `.github/workflows/warrant-scraper.yml`;
- `3b303ce5bb0ebdce4ab3f5658c005e28888e9a35` — add both targets to `EMBEDDED_TARGETS`.

Independent diff review confirms the two workflow commits only:
- remove the v1 standalone `schedule-timing-summary` job and its summary-only checkout;
- add one embedded `# schedule-timing-summary:v2` step in the preregistered functional job;
- use `if: always() && github.event_name == 'schedule'`;
- keep `node scripts/write_workflow_schedule_summary.js`.

No cron, target-date/date-resolution, crawler, schema, publication, retry, batching, permissions, Pages topology, or write-layer concurrency changes were introduced.

### Current remote workflow verification

Both current remote-main workflows independently satisfy:
- no production `push` trigger;
- no v1 marker;
- no standalone summary job;
- exactly one v2 marker;
- schedule-only `always()` condition;
- existing functional checkout is present;
- shared renderer is used;
- `cancel-in-progress: false` remains unchanged.

A normalized functional-content comparison against pre-Round-8 base
`59b6e02d2f21b8237af845de536a852bd1903baa` shows:
- `update-official-market-constraints.yml`: functional content unchanged;
- `warrant-scraper.yml`: functional content unchanged.

### Special invariant verification

`update-official-market-constraints.yml`:
- manual/default `official_final` and scheduled `realtime_close` phase selection are unchanged;
- source prediction-context existence gate is unchanged;
- realtime and official-final branches are unchanged;
- write scope remains `data_market_constraints data_prediction_context`;
- workflow summary still states the original prediction market snapshot remains immutable / is not rewritten.

`warrant-scraper.yml`:
- Playwright browser cache topology is unchanged;
- source-date contract still runs `node --test tests/extract_warrant_data.test.js`;
- conditional Chromium install, runtime smoke-test, fallback system dependency install, and second smoke-test are unchanged;
- write scope remains `git add data_twse/`.

### Actions side-effect verification

For workflow-YAML SHAs `16106ad...` and `9920aa...`:
- all push-triggered runs were CI / maintenance workflows only;
- neither production workflow launched because its YAML changed.

On `3b303ce...`, the concurrent TWSE quarterly-financial-quality workflow run was `event: schedule`, not a migration push side effect.

Therefore no unexpected production collector launch was caused by Round 8.

### Validation evidence

- `36891092336` — Ensure Workflow Schedule Summary — **SUCCESS**:
  - renderer self-test passed;
  - deployment-race layered self-test passed;
  - repository-wide deployment layering audit passed;
  - migrator normalization/idempotence reported all workflows pinned.
- `36891092315` — Public Page Registry CI — **SUCCESS**; deployment layering audit passed.
- `36891084187` — Scheduled Workflow Registry Contract — **SUCCESS**; 8 tests passed.
- `36891084203` — Audit GitHub Actions Node 24 — **SUCCESS**.
- `36891084262` — Scheduled Collection Date Regression — **SUCCESS**.
- `36891092206` — Node Regression Suite — **SUCCESS**; 909 tests passed and the tracked-tree cleanliness gate passed.

### Concurrent-main / durability classification

After Prompt A checkpoint `eeb70f0526263fbbe6f7d493923e27acacced2b0`, remote main advanced through normal analysis/data commits to
`9624bc1ba78678f7a8a1623968da05c30b202209`.

The descendant changes are limited to:
- `data_daily_gain_over_5/analysis-facts/20261001.json`;
- `data_daily_gain_over_5/analysis-flow/20261001.json`.

They do not modify either Round 8 workflow, the migrator, the renderer, routing, or this handoff before closeout.

Routing still names `workflow-schedule-summary-lightweight-migration` as the sole active task.

### Residual migration decision

Round 8 exhausts the currently preregistered ordinary single-functional-job cohort.

Do **not** promote another direct migration cohort from the stale Round 1 inventory. Remaining runtime-relevant v1 cases include known multi-job / branch-topology / self-trigger / deployment-coupled workflows such as:
- `.github/workflows/crawl-fubon-broker-details.yml` — mutually exclusive branches with no one existing terminal functional job;
- `.github/workflows/momentum-history-replay.yml` — broader replay / deploy / push topology;
- other historical multi-job scheduled workflows whose earlier classification may now be stale.

The next round is therefore classification-only: re-inventory current remote main, classify residual scheduled v1 workflows by topology and trigger risk, and preregister a later bounded migration cohort only if evidence identifies one that is safe without changing functional topology.

**Prompt B closeout: PASS. Round 8 is closed.**

## Current repository state

Round 1 implementation is already durable on remote main. Normal data workflows continued advancing `main` after the implementation commits; future agents must fetch current main rather than treating any data commit SHA in this handoff as the branch head.

The migration source of truth is:

- `scripts/migrate_workflow_schedule_summary.js`
- `scripts/write_workflow_schedule_summary.js`
- `docs/architecture/github-actions.md`
- this handoff

## Known problems / rejected approaches

- Rejected: standalone second checkout for a script whose inputs are only GitHub runtime/event information.
- Rejected: inline duplication of the summary algorithm.
- Rejected: new reusable workflow abstraction without evidence.
- Rejected: editing self-trigger workflow YAML in Round 1.
- Rejected: adding a new final runner solely to accommodate multi-job branch topology.
- Rejected: manually dispatching production crawlers for validation.
- The initial `529650d` migrator template string forgot to escape GitHub expressions and caused a Node syntax failure; `c25a862` corrected it.
- `crawl-fubon-broker-details.yml` remains v1 because no single existing terminal job covers both range and single branches.
- The five newly discovered no-summary workflows remain intentionally unmodified; their exception is explicit rather than silent.

## Entry points

- `AGENTS.md`
- `docs/project-philosophy.md`
- `docs/roadmap/current-phase.md`
- `docs/architecture/github-actions.md`
- `docs/decisions/ADR-004-workflow-orchestration.md`
- `scripts/write_workflow_schedule_summary.js`
- `scripts/migrate_workflow_schedule_summary.js`
- `scripts/audit_workflow_deployment_races.js`
- `scripts/audit_scheduled_workflow_outputs.js`
- `tests/audit_scheduled_workflow_outputs.test.js`
- `.github/workflows/ensure-workflow-schedule-summary.yml`
- `.github/workflows/test-scheduled-workflow-registry.yml`
- `docs/handoffs/workflow-schedule-summary-lightweight-migration.md`

## Next round

### Round 9 — residual schedule-summary topology classification

Round:
`workflow-schedule-summary-lightweight-migration-round-9`

Status:
- Prompt A: **PREREGISTERED / NOT STARTED**
- Prompt B: **PREREGISTERED / NOT STARTED**

Round 9 is classification-only. It must not edit production workflow YAML or migrate any additional workflow.

Objective:
- re-inventory all current scheduled workflows on remote main that still use v1 standalone schedule summary or otherwise remain outside `EMBEDDED_TARGETS`;
- classify each residual runtime-relevant workflow into:
  1. safe single-functional-job candidate;
  2. multi-job / branch-topology placement problem;
  3. own-YAML production self-trigger risk;
  4. deployment-coupled / terminal-job topology requiring dedicated review;
  5. intentionally unreachable/non-scheduled legacy summary;
  6. explicit frozen exception / no managed summary;
- identify whether any **new** bounded safe migration cohort exists without changing cron, triggers, functional job topology, write-layer concurrency, deployment topology, or production logic;
- if a safe cohort exists, preregister Round 10 Prompt A + Prompt B for that exact cohort;
- if none exists, record that the lightweight migration has reached its safe stopping boundary.

Known entry points:
- `scripts/migrate_workflow_schedule_summary.js`;
- `scripts/write_workflow_schedule_summary.js`;
- `.github/workflows/crawl-fubon-broker-details.yml`;
- `.github/workflows/momentum-history-replay.yml`;
- `docs/architecture/github-actions.md`;
- `docs/decisions/ADR-004-workflow-orchestration.md`;
- this canonical handoff.

Frozen:
- no production workflow YAML edits in Round 9;
- no trigger hardening in the same classification round;
- no cron/date-resolution/crawler/retry/publication changes;
- no new final runner, reusable workflow, `workflow_run`, `repository_dispatch`, or event-listener workaround;
- do not treat the historical Round 1 inventory as current evidence; current remote main is authoritative.

## Safety / stop conditions

- Stop if a workflow-YAML commit launches a production collector solely because its own YAML is in `push.paths`.
- Stop if migration requires cron/target-date/crawler/retry/publication changes.
- Stop if a design requires `workflow_run`, event-listener chaining, or a new generic abstraction without explicit owner authorization.
- Do not use a production manual dispatch as a migration test.

## Prompt A — Round 2 implementation prompt

Continue the workflow schedule-summary lightweight migration in repository `EasonLiu0913/stock_data`.

Before work:
1. Fetch current remote `main`.
2. Read repository-root `AGENTS.md`.
3. Read `docs/handoffs/workflow-schedule-summary-lightweight-migration.md`.
4. Read `docs/architecture/github-actions.md`, `docs/decisions/ADR-004-workflow-orchestration.md`, `scripts/write_workflow_schedule_summary.js`, and `scripts/migrate_workflow_schedule_summary.js`.
5. Re-verify the current workflow inventory; do not rely on the Round 1 list if main changed.

Objective:
- Design and implement the next bounded migration cohort, focusing first on these self-trigger-risk workflows:
  1. `.github/workflows/crawl-tpex-daily-market-data.yml`
  2. `.github/workflows/analyze-daily-gainers-margin-flow-2200.yml`
  3. `.github/workflows/publish-daily-gainers-ai-analysis.yml`
- For **each** workflow above, first decide and document whether its own YAML path should remain in `push.paths`.
- Do not edit the workflow YAML until that trigger decision is resolved.
- If own-YAML remains in `push.paths`, choose a migration mechanism that cannot make the migration commit itself launch the production collector.
- Resolve multi-job placement only where an existing job can preserve `always() && github.event_name == 'schedule'` semantics without adding a separate runner.

Frozen:
- no cron/date/crawler/schema/publication/retry/physical-batch changes;
- no `workflow_run` or event listener;
- no production manual dispatch for migration testing;
- no write-layer `cancel-in-progress: true`;
- keep shared renderer and three summary labels;
- do not generalize into a new reusable abstraction without evidence.

Completion:
- bounded commit(s) pushed to main;
- remote verification of each intended workflow;
- migration/audit/regression tests pass;
- Actions inspection proves no unexpected production run;
- handoff updated with Round 2 evidence;
- stop before any Round 3 work.

## Prompt B — Round 2 closeout / verification prompt

Perform an independent Round 2 closeout for the workflow schedule-summary lightweight migration in `EasonLiu0913/stock_data`.

1. Fetch current remote main and read `AGENTS.md` plus `docs/handoffs/workflow-schedule-summary-lightweight-migration.md`.
2. Verify the exact Round 2 commit(s) and diff; reject unrelated cron/date/crawler/schema/publication/retry/batching changes.
3. For every Round 2 migrated workflow, verify:
   - no obsolete standalone summary runner/checkout remains unless deliberately retained;
   - embedded summary runs only for schedule events and uses `always()` where required;
   - the selected job already has the repository checkout needed by the renderer;
   - the shared renderer is used rather than duplicated;
   - write-layer concurrency and Pages topology are unchanged.
4. Inspect workflow runs caused by the migration commit. Any production collector launched because its YAML matched its own `push.paths` is a closeout failure.
5. Verify `node scripts/write_workflow_schedule_summary.js --self-test`, migrator idempotence/normalization, deployment-race audit, scheduled-workflow registry tests, and YAML parsing.
6. Re-fetch remote main and verify durable state after any concurrent data commits.
7. Update and commit the canonical handoff only after the above passes.
8. If any important failure remains, fix only the bounded defect and repeat Prompt B; do not promote another round.


## Prompt A — Round 3 implementation prompt

Continue the workflow schedule-summary lightweight migration in repository `EasonLiu0913/stock_data`.

Before work:
1. Fetch current remote `main`.
2. Read repository-root `AGENTS.md`.
3. Read `docs/agent-prompts/task-routing.json`; proceed only if this project remains the unique active task.
4. Read this canonical handoff.
5. Read `docs/architecture/github-actions.md`, `docs/decisions/ADR-004-workflow-orchestration.md`, `scripts/write_workflow_schedule_summary.js`, and `scripts/migrate_workflow_schedule_summary.js`.
6. Re-scan current workflow triggers before relying on this preregistration.

Objective:
- bounded Round 3 cohort:
  1. `.github/workflows/crawl-eia-crude-spot.yml`
  2. `.github/workflows/crawl-tdcc-shareholding-snapshot.yml`
  3. `.github/workflows/update-twse-industry.yml`
- for each workflow, decide and document whether its own YAML belongs in production `push.paths` before editing summary placement;
- remove only obsolete/self-triggering workflow-file push paths when evidence supports removal;
- then migrate to v2 embedded schedule summary only where an existing checked-out functional job preserves `always() && github.event_name == 'schedule'` without adding a runner.

Frozen:
- no cron/date/crawler/schema/publication/retry/physical-batch changes;
- no production manual dispatch for validation;
- no `workflow_run`, `repository_dispatch`, or event-listener workaround;
- no new reusable abstraction;
- no write-layer cancellation weakening;
- preserve shared renderer and the three summary labels;
- preserve all real data/script push triggers unless this round explicitly proves a trigger obsolete.

Special gates:
- TDCC's pre-existing conditional `cancel-in-progress: ${{ github.event_name == 'push' }}` must be independently classified before any edit; do not silently convert it to a different concurrency policy.
- Update TWSE Industry's temporary workflow-file push trigger must be checked against current repository history/intent before removal.
- Any migration commit that launches one of the production workflows solely because its YAML matched `push.paths` is a stop-condition failure.

Completion:
- bounded implementation commits durable on remote main;
- current YAML remote verification for every migrated workflow;
- schedule-summary ensure/audit PASS;
- deployment-race audit PASS;
- scheduled-workflow registry PASS;
- Node regression PASS when triggered/applicable;
- Actions inspection proves no unexpected production launch;
- canonical handoff updated with Prompt A evidence;
- stop with `Prompt A complete — ready for Prompt B`;
- do not execute Round 3 Prompt B automatically.

## Prompt B — Round 3 closeout / verification prompt

Perform independent closeout for `workflow-schedule-summary-lightweight-migration-round-3`.

1. Fetch current remote main, read `AGENTS.md`, `docs/agent-prompts/task-routing.json`, and this handoff; verify this project is still the unique active task.
2. Recover this exact Round 3 Prompt B from the pre-Prompt-A durable handoff.
3. Verify every Round 3 commit and reject unrelated cron/date/crawler/schema/publication/retry/batching/permissions/concurrency changes.
4. For each migrated workflow verify:
   - own-YAML production trigger decision matches the documented evidence;
   - all real data/script triggers intended to remain are unchanged;
   - no standalone summary runner/summary-only checkout remains;
   - embedded summary is schedule-only with `always()`;
   - selected functional job already checks out the repository;
   - shared renderer is used;
   - write-layer and Pages topology are unchanged.
5. For TDCC, independently verify the pre-existing conditional concurrency rule was not accidentally broadened or weakened.
6. Inspect Actions for every workflow-YAML commit. A production workflow launched only because its own YAML matched `push.paths` is a closeout failure.
7. Verify renderer self-test, migrator normalization/idempotence, deployment-race audit, scheduled-workflow registry tests, YAML acceptance, and applicable Node regression.
8. Re-fetch remote main; classify concurrent changes and verify durable state.
9. On PASS, record exact commits/run IDs/tests/current-main evidence in this handoff and preregister the next bounded pair without executing it.
10. On failure, fix only the bounded defect and repeat this same Prompt B from criterion 1.

End with: `Prompt B closeout: PASS`.


## Prompt A — Round 4 implementation prompt

Continue the workflow schedule-summary lightweight migration in repository `EasonLiu0913/stock_data`.

Before work:
1. Fetch current remote `main`.
2. Read repository-root `AGENTS.md`.
3. Read `docs/agent-prompts/task-routing.json`; proceed only if this project remains the unique active task.
4. Read this canonical handoff.
5. Read `docs/architecture/github-actions.md`, `docs/decisions/ADR-004-workflow-orchestration.md`, `scripts/write_workflow_schedule_summary.js`, and `scripts/migrate_workflow_schedule_summary.js`.
6. Re-read current YAML for the entire bounded cohort before editing; do not rely on preregistration if main changed.

Objective:
- migrate this bounded Round 4 cohort from v1 standalone summary to v2 embedded summary:
  1. `.github/workflows/crawl-external-market-indicators.yml` → `crawl`
  2. `.github/workflows/crawl-institutional.yml` → `crawl-institutional`
  3. `.github/workflows/crawl-mops-monthly-revenue.yml` → `crawl`
- first re-confirm none has gained a production self-trigger through `push.paths`;
- add only verified targets to `EMBEDDED_TARGETS`;
- reuse each existing repository checkout;
- preserve `if: always() && github.event_name == 'schedule'`.

Frozen:
- no cron/date-resolution/crawler/schema/publication/retry/physical-batch changes;
- no production manual dispatch for validation;
- no `workflow_run`, `repository_dispatch`, or event-listener workaround;
- no new reusable abstraction;
- no write-layer cancellation change;
- preserve shared renderer and all three summary labels;
- for `crawl-institutional.yml`, preserve the canonical downstream `deploy-pages` job, its `needs`, `if`, and `uses: ./.github/workflows/deploy-pages.yml` topology exactly.

Completion:
- bounded implementation commit(s) durable on remote main;
- current YAML remote verification for all three workflows;
- Ensure Workflow Schedule Summary PASS;
- deployment-race audit PASS;
- Scheduled Workflow Registry Contract PASS;
- Node Regression PASS when triggered/applicable;
- Actions inspection proves no unexpected production launch;
- canonical handoff updated with Round 4 Prompt A evidence;
- stop with `Prompt A complete — ready for Prompt B`;
- do not execute Round 4 Prompt B automatically.

## Prompt B — Round 4 closeout / verification prompt

Perform independent closeout for `workflow-schedule-summary-lightweight-migration-round-4`.

1. Fetch current remote main, read `AGENTS.md`, `docs/agent-prompts/task-routing.json`, and this handoff; verify this project is still the unique active task.
2. Recover this exact Round 4 Prompt B from the pre-Prompt-A durable handoff.
3. Verify every Round 4 commit and reject unrelated cron/date-resolution/crawler/schema/publication/retry/batching/permissions/concurrency changes.
4. For every migrated workflow verify:
   - no production self-trigger was introduced or retained unexpectedly;
   - no standalone summary runner/summary-only checkout remains;
   - exactly one embedded v2 summary exists;
   - embedded summary is schedule-only with `always()`;
   - selected functional job already has the repository checkout;
   - shared renderer is used;
   - write-layer concurrency is unchanged.
5. For `crawl-institutional.yml`, independently verify the downstream canonical Pages job, `needs`, conditional gate, and reusable `deploy-pages.yml` call are unchanged.
6. Inspect Actions for every workflow-YAML commit; any unexpected production collector launch caused by the migration is a closeout failure.
7. Verify renderer self-test, migrator normalization/idempotence, deployment-race audit, scheduled-workflow registry tests, YAML acceptance, and applicable Node regression.
8. Re-fetch remote main; classify concurrent changes and verify durable state.
9. On PASS, record exact commits/run IDs/tests/current-main evidence in this handoff and preregister the next bounded Prompt A + Prompt B pair without executing it.
10. On failure, fix only the bounded defect and repeat this same Prompt B from criterion 1.

End with: `Prompt B closeout: PASS`.


## Prompt A — Round 5 implementation prompt

Continue the workflow schedule-summary lightweight migration in repository `EasonLiu0913/stock_data`.

Before work:
1. Fetch current remote `main`.
2. Read repository-root `AGENTS.md`.
3. Read `docs/agent-prompts/task-routing.json`; proceed only if this project remains the unique active task.
4. Read this canonical handoff.
5. Read `docs/architecture/github-actions.md`, `docs/decisions/ADR-004-workflow-orchestration.md`, `scripts/write_workflow_schedule_summary.js`, and `scripts/migrate_workflow_schedule_summary.js`.
6. Re-read current YAML for all three Round 5 workflows before editing.

Objective:
- migrate this bounded Round 5 cohort from v1 standalone summary to v2 embedded summary:
  1. `.github/workflows/crawl-pocket-00981a.yml` → `crawl-pocket-00981a`
  2. `.github/workflows/crawl-refined-product-tightness.yml` → `collect`
  3. `.github/workflows/crawl-taifex-major-institutional-traders-futures-contracts.yml` → `crawl-taifex-futures-contracts`
- first re-confirm none has gained a production self-trigger via `push` / `push.paths`;
- add only verified targets to `EMBEDDED_TARGETS`;
- reuse the existing repository checkout in each functional job;
- preserve `if: always() && github.event_name == 'schedule'`.

Frozen:
- no cron/date-resolution/crawler/schema/publication/retry/physical-batch changes;
- no production manual dispatch for validation;
- no `workflow_run`, `repository_dispatch`, or event-listener workaround;
- no new reusable abstraction;
- no write-layer cancellation change;
- preserve shared renderer and all three summary labels.

Completion:
- bounded implementation commit(s) durable on remote main;
- current YAML remote verification for all three workflows;
- Ensure Workflow Schedule Summary PASS;
- deployment-race/concurrency audit PASS;
- Scheduled Workflow Registry Contract PASS;
- Node Regression PASS when triggered/applicable;
- Actions inspection proves no unexpected production launch;
- canonical handoff updated with Round 5 Prompt A evidence;
- stop with `Prompt A complete — ready for Prompt B`;
- do not execute Round 5 Prompt B automatically.

## Prompt B — Round 5 closeout / verification prompt

Perform independent closeout for `workflow-schedule-summary-lightweight-migration-round-5`.

1. Fetch current remote main, read `AGENTS.md`, `docs/agent-prompts/task-routing.json`, and this handoff; verify this project is still the unique active task.
2. Recover this exact Round 5 Prompt B from the pre-Prompt-A durable handoff.
3. Verify every Round 5 commit and reject unrelated cron/date-resolution/crawler/schema/publication/retry/batching/permissions/concurrency changes.
4. For every migrated workflow verify:
   - no production self-trigger was introduced or retained unexpectedly;
   - no standalone summary runner/summary-only checkout remains;
   - exactly one embedded v2 summary exists;
   - embedded summary is schedule-only with `always()`;
   - selected functional job already has the repository checkout;
   - shared renderer is used;
   - write-layer concurrency is unchanged.
5. Inspect Actions for every workflow-YAML commit; any unexpected production collector launch caused by the migration is a closeout failure.
6. Verify renderer self-test, migrator normalization/idempotence, deployment-race audit, scheduled-workflow registry tests, YAML acceptance, and applicable Node regression.
7. Re-fetch remote main; classify concurrent changes and verify durable state.
8. On PASS, record exact commits/run IDs/tests/current-main evidence in this handoff and preregister the next bounded Prompt A + Prompt B pair without executing it.
9. On failure, fix only the bounded defect and repeat this same Prompt B from criterion 1.

End with: `Prompt B closeout: PASS`.


## Prompt A — Round 6 implementation prompt

Continue the workflow schedule-summary lightweight migration in repository `EasonLiu0913/stock_data`.

Before work:
1. Fetch current remote `main`.
2. Read repository-root `AGENTS.md`.
3. Read `docs/agent-prompts/task-routing.json`; proceed only if this project remains the unique active task.
4. Read this canonical handoff.
5. Read `docs/architecture/github-actions.md`, `docs/decisions/ADR-004-workflow-orchestration.md`, `scripts/write_workflow_schedule_summary.js`, and `scripts/migrate_workflow_schedule_summary.js`.
6. Re-read current YAML for all three Round 6 workflows before editing.

Objective:
- migrate this bounded Round 6 cohort from v1 standalone summary to v2 embedded summary:
  1. `.github/workflows/crawl-twse-mi-index.yml` → `crawl-twse-mi-index`
  2. `.github/workflows/crawl-twse-twt49u.yml` → `crawl`
  3. `.github/workflows/crawl-vix-index.yml` → `crawl`
- first re-confirm none has gained a production self-trigger via `push` / `push.paths`;
- add only verified targets to `EMBEDDED_TARGETS`;
- reuse the existing repository checkout in each functional job;
- preserve `if: always() && github.event_name == 'schedule'`.

Frozen:
- no cron/date-resolution/crawler/schema/publication/retry/physical-batch changes;
- no production manual dispatch for validation;
- no `workflow_run`, `repository_dispatch`, or event-listener workaround;
- no new reusable abstraction;
- no write-layer cancellation change;
- preserve shared renderer and all three summary labels.

Completion:
- bounded implementation commit(s) durable on remote main;
- current YAML remote verification for all three workflows;
- Ensure Workflow Schedule Summary PASS;
- deployment-race/concurrency audit PASS;
- Scheduled Workflow Registry Contract PASS;
- Node Regression PASS when triggered/applicable;
- Actions inspection proves no unexpected production launch;
- canonical handoff updated with Round 6 Prompt A evidence;
- stop with `Prompt A complete — ready for Prompt B`;
- do not execute Round 6 Prompt B automatically.

## Prompt B — Round 6 closeout / verification prompt

Perform independent closeout for `workflow-schedule-summary-lightweight-migration-round-6`.

1. Fetch current remote main, read `AGENTS.md`, `docs/agent-prompts/task-routing.json`, and this handoff; verify this project is still the unique active task.
2. Recover this exact Round 6 Prompt B from the pre-Prompt-A durable handoff.
3. Verify every Round 6 commit and reject unrelated cron/date-resolution/crawler/schema/publication/retry/batching/permissions/concurrency changes.
4. For every migrated workflow verify:
   - no production self-trigger was introduced or retained unexpectedly;
   - no standalone summary runner/summary-only checkout remains;
   - exactly one embedded v2 summary exists;
   - embedded summary is schedule-only with `always()`;
   - selected functional job already has the repository checkout;
   - shared renderer is used;
   - write-layer concurrency is unchanged.
5. Inspect Actions for every workflow-YAML commit; any unexpected production collector launch caused by the migration is a closeout failure.
6. Verify renderer self-test, migrator normalization/idempotence, deployment-race audit, scheduled-workflow registry tests, YAML acceptance, and applicable Node regression.
7. Re-fetch remote main; classify concurrent changes and verify durable state.
8. On PASS, record exact commits/run IDs/tests/current-main evidence in this handoff and preregister the next bounded Prompt A + Prompt B pair without executing it.
9. On failure, fix only the bounded defect and repeat this same Prompt B from criterion 1.

End with: `Prompt B closeout: PASS`.


## Prompt A — Round 7 implementation prompt

Continue the workflow schedule-summary lightweight migration in repository `EasonLiu0913/stock_data`.

Before work:
1. Fetch current remote `main`.
2. Read repository-root `AGENTS.md`.
3. Read `docs/agent-prompts/task-routing.json`; proceed only if this project remains the unique active task.
4. Read this canonical handoff.
5. Read `docs/architecture/github-actions.md`, `docs/decisions/ADR-004-workflow-orchestration.md`, `scripts/write_workflow_schedule_summary.js`, and `scripts/migrate_workflow_schedule_summary.js`.
6. Re-read current YAML for all three Round 7 workflows before editing.

Objective:
- migrate this bounded Round 7 cohort from v1 standalone summary to v2 embedded summary:
  1. `.github/workflows/prepare-market-environment.yml` → `prepare`
  2. `.github/workflows/retry-sma.yml` → `retry-sma`
  3. `.github/workflows/update-non-trading-days.yml` → `update-non-trading-days`
- first re-confirm none has gained a production self-trigger via `push` / `push.paths`;
- add only verified targets to `EMBEDDED_TARGETS`;
- reuse the existing repository checkout in each functional job;
- preserve `if: always() && github.event_name == 'schedule'`.

Frozen:
- no cron/date-resolution/crawler/schema/publication/retry/physical-batch changes;
- no production manual dispatch for validation;
- no `workflow_run`, `repository_dispatch`, or event-listener workaround;
- no new reusable abstraction;
- no write-layer cancellation change;
- preserve shared renderer and all three summary labels;
- preserve `update-non-trading-days.yml`'s current lack of an explicit concurrency cancellation rule.

Completion:
- bounded implementation commit(s) durable on remote main;
- current YAML remote verification for all three workflows;
- Ensure Workflow Schedule Summary PASS;
- deployment-race/concurrency audit PASS;
- Scheduled Workflow Registry Contract PASS;
- Node Regression PASS when triggered/applicable;
- Actions inspection proves no unexpected production launch;
- canonical handoff updated with Round 7 Prompt A evidence;
- stop with `Prompt A complete — ready for Prompt B`;
- do not execute Round 7 Prompt B automatically.

## Prompt B — Round 7 closeout / verification prompt

Perform independent closeout for `workflow-schedule-summary-lightweight-migration-round-7`.

1. Fetch current remote main, read `AGENTS.md`, `docs/agent-prompts/task-routing.json`, and this handoff; verify this project is still the unique active task.
2. Recover this exact Round 7 Prompt B from the pre-Prompt-A durable handoff.
3. Verify every Round 7 commit and reject unrelated cron/date-resolution/crawler/schema/publication/retry/batching/permissions/concurrency changes.
4. For every migrated workflow verify:
   - no production self-trigger was introduced or retained unexpectedly;
   - no standalone summary runner/summary-only checkout remains;
   - exactly one embedded v2 summary exists;
   - embedded summary is schedule-only with `always()`;
   - selected functional job already has the repository checkout;
   - shared renderer is used;
   - write-layer concurrency is unchanged.
5. For `update-non-trading-days.yml`, independently verify that no new concurrency/cancellation rule was introduced.
6. Inspect Actions for every workflow-YAML commit; any unexpected production collector launch caused by the migration is a closeout failure.
7. Verify renderer self-test, migrator normalization/idempotence, deployment-race audit, scheduled-workflow registry tests, YAML acceptance, and applicable Node regression.
8. Re-fetch remote main; classify concurrent changes and verify durable state.
9. On PASS, record exact commits/run IDs/tests/current-main evidence in this handoff and preregister the next bounded Prompt A + Prompt B pair without executing it.
10. On failure, fix only the bounded defect and repeat this same Prompt B from criterion 1.

End with: `Prompt B closeout: PASS`.



## Prompt A — Round 8 implementation prompt

Continue the workflow schedule-summary lightweight migration in repository `EasonLiu0913/stock_data`.

Before work:
1. Fetch current remote `main`.
2. Read repository-root `AGENTS.md`.
3. Read `docs/agent-prompts/task-routing.json`; proceed only if this project remains the unique active task.
4. Read this canonical handoff.
5. Read `docs/architecture/github-actions.md`, `docs/decisions/ADR-004-workflow-orchestration.md`, `scripts/write_workflow_schedule_summary.js`, and `scripts/migrate_workflow_schedule_summary.js`.
6. Re-read current YAML for both Round 8 workflows before editing.

Objective:
- migrate this bounded Round 8 cohort from v1 standalone summary to v2 embedded summary:
  1. `.github/workflows/update-official-market-constraints.yml` → `update`
  2. `.github/workflows/warrant-scraper.yml` → `scrape-warrant`
- first re-confirm neither has gained a production self-trigger via `push` / `push.paths`;
- add only verified targets to `EMBEDDED_TARGETS`;
- reuse the existing repository checkout in each functional job;
- preserve `if: always() && github.event_name == 'schedule'`.

Frozen:
- no cron/date-resolution/crawler/schema/publication/retry/physical-batch changes;
- no production manual dispatch for validation;
- no `workflow_run`, `repository_dispatch`, or event-listener workaround;
- no new reusable abstraction;
- no write-layer cancellation change;
- preserve shared renderer and all three summary labels;
- preserve each workflow's existing `cancel-in-progress: false`;
- do not change official-market finalization phase logic, prediction-context immutability behavior, warrant Playwright/cache behavior, or warrant source-date contract.

Completion:
- bounded implementation commit(s) durable on remote main;
- current YAML remote verification for both workflows;
- Ensure Workflow Schedule Summary PASS;
- deployment-race/concurrency audit PASS;
- Scheduled Workflow Registry Contract PASS;
- Node Regression PASS when triggered/applicable;
- Actions inspection proves no unexpected production launch;
- canonical handoff updated with Round 8 Prompt A evidence;
- stop with `Prompt A complete — ready for Prompt B`;
- do not execute Round 8 Prompt B automatically.

## Prompt B — Round 8 closeout / verification prompt

Perform independent closeout for `workflow-schedule-summary-lightweight-migration-round-8`.

1. Fetch current remote main, read `AGENTS.md`, `docs/agent-prompts/task-routing.json`, and this handoff; verify this project is still the unique active task.
2. Recover this exact Round 8 Prompt B from the pre-Prompt-A durable handoff.
3. Verify every Round 8 commit and reject unrelated cron/date-resolution/crawler/schema/publication/retry/batching/permissions/concurrency changes.
4. For both migrated workflows verify:
   - no production self-trigger was introduced or retained unexpectedly;
   - no standalone summary runner/summary-only checkout remains;
   - exactly one embedded v2 summary exists;
   - embedded summary is schedule-only with `always()`;
   - selected functional job already has the repository checkout;
   - shared renderer is used;
   - `cancel-in-progress: false` is unchanged.
5. For `update-official-market-constraints.yml`, independently verify finalization-phase selection, prediction-context immutability behavior, and write scope are unchanged.
6. For `warrant-scraper.yml`, independently verify Playwright cache/install/smoke-test topology, source-date contract validation, and `data_twse/` bounded write scope are unchanged.
7. Inspect Actions for every workflow-YAML commit; any unexpected production collector launch caused by the migration is a closeout failure.
8. Verify renderer self-test, migrator normalization/idempotence, deployment-race audit, scheduled-workflow registry tests, YAML acceptance, and applicable Node regression.
9. Re-fetch remote main; classify concurrent changes and verify durable state.
10. On PASS, record exact commits/run IDs/tests/current-main evidence in this handoff and either preregister the next bounded pair or record that residual workflows require topology classification before further migration; do not execute another Prompt A automatically.
11. On failure, fix only the bounded defect and repeat this same Prompt B from criterion 1.

End with: `Prompt B closeout: PASS`.



## Round 9 Prompt A residual topology classification — COMPLETE

Round:
`workflow-schedule-summary-lightweight-migration-round-9`

Baseline:
- current remote main at audit start: `bf8acdf540e04f8e5b16fa8f8c7e356f6751d16a`;
- current workflow inventory: `177` `.github/workflows/*.yml|yaml` files;
- runtime-relevant scheduled inventory remains `41` workflows;
- current `EMBEDDED_TARGETS` count is `31`;
- therefore exactly `10` scheduled workflows remain outside v2 embedded handling.

Round 9 is classification-only. No production workflow YAML, trigger, cron, permissions, concurrency, crawler, schema, retry, batching, publication, deployment topology, or `EMBEDDED_TARGETS` entry was changed.

### Current residual scheduled-workflow inventory

| Workflow | Current live state | Production self-trigger risk | Topology / checkout evidence | Classification |
| --- | --- | --- | --- | --- |
| `.github/workflows/backfill-oversold-rebound-coverage.yml` | v1 standalone | no production `push` | `plan → backfill → refresh`; checkout exists in `plan` and `backfill`, but there is no one existing functional job that represents every completion path | multi-job / branch topology |
| `.github/workflows/build-etf-market-regime-analysis.yml` | v1 standalone | no own-YAML production self-trigger; own YAML appears only under `pull_request.paths` | `build → deploy_pages`; `build` is the single functional writer job, already has checkout, and downstream Pages does not prevent an embedded schedule-only step | **safe single-job candidate** |
| `.github/workflows/build-twse-market-chart.yml` | v1 standalone | no production `push` | `route-and-daily-refresh → physical-month-batches → gates/refreshers → deploy_pages`; multiple conditional paths, repository writes, Pages publication | multi-job + deployment-coupled topology |
| `.github/workflows/crawl-fubon-broker-details.yml` | v1 standalone | no production `push` | `validate-inputs → plan-range/crawl-range OR crawl-single`; all functional branches have checkout, but no one existing terminal functional job is guaranteed across range/single modes | multi-job / branch topology |
| `.github/workflows/crawl-sma.yml` | v1 standalone | no production `push` | `crawl-sma → daily-gainers → final-summary`; repository writer with downstream publication coupling; only `crawl-sma` owns checkout | multi-job + deployment-coupled topology |
| `.github/workflows/daily-gainers-over-5.yml` | v1 standalone | no production `push` | `generate → validate-analysis-coverage → deploy`; also exposes `workflow_call`; repository writer and Pages deployment are coupled | multi-job + deployment-coupled topology |
| `.github/workflows/daily-prediction-replay.yml` | v1 standalone | no production `push` | `preflight → replay_and_compare`; both functional jobs checkout; repository write / Pages coupling remains | multi-job + deployment-coupled topology |
| `.github/workflows/daily-stock-prediction.yml` | v1 standalone | no production `push` | parallel `generate_v1` / `generate_v2` feed `apply_strategy_registry`; repository write / Pages coupling and no single existing terminal checkout job | multi-job + deployment-coupled topology |
| `.github/workflows/momentum-history-replay.yml` | v1 standalone | **yes**: production `push.paths` includes `.github/workflows/momentum-history-replay.yml` | `validate → generate → deploy_pages`; repository writer with Pages publication | self-trigger risk + deployment-coupled topology |
| `.github/workflows/refresh-finmind-quarterly-financial-quality-due.yml` | v1 standalone | no production `push` | `plan → refresh → rebuild-master` with alternate `no-op` branch; multiple checkout-owning jobs and branch-dependent completion | multi-job / branch topology |

### Explicit re-checks required by Round 9

`.github/workflows/crawl-fubon-broker-details.yml`
- current main still has schedule + workflow_dispatch only;
- no production `push` trigger;
- range and single execution remain mutually exclusive branch paths;
- `validate-inputs`, `plan-range`, `crawl-range`, and `crawl-single` have repository checkouts;
- there is still no one pre-existing terminal functional job guaranteed to run after both range and single paths;
- therefore embedding would require functional topology change or a new terminal runner, both forbidden in this round.

`.github/workflows/momentum-history-replay.yml`
- current main still has a production `push` trigger whose `paths` explicitly includes `.github/workflows/momentum-history-replay.yml`;
- workflow is a repository writer with `cancel-in-progress: false`;
- topology remains `validate → generate → deploy_pages`;
- editing this YAML can therefore launch the production/research workflow, so it remains a self-trigger-risk residual.

`.github/workflows/build-etf-market-regime-analysis.yml`
- production `push.paths` does **not** include its own workflow YAML;
- its own YAML is present only under `pull_request.paths`;
- it is not a current own-YAML production self-trigger risk;
- `build` is the one functional writer job, already checks out the repository, and always starts for scheduled runs;
- appending `if: always() && github.event_name == 'schedule'` inside `build` preserves the summary even when an earlier build step fails;
- downstream `deploy_pages` remains a separate `needs: build` reusable Pages job and does not require any topology change;
- this matches the already-accepted placement pattern used by `.github/workflows/crawl-institutional.yml` (`crawl-institutional → deploy-pages`), so Pages coupling alone is not a disqualifier;
- therefore this workflow is the one bounded safe single-job candidate for Round 10.

### Round 9 conclusion / stopping boundary

Independent Prompt B review found one bounded classification correction: `.github/workflows/build-etf-market-regime-analysis.yml` is a safe single-job candidate. The other nine residuals remain outside simple placement-only migration because of multi-job/branch topology or production self-trigger risk.

Therefore:
- preregister Round 10 for exactly `.github/workflows/build-etf-market-regime-analysis.yml` → `build`;
- keep the other nine workflows on v1 until a future topology-specific or trigger-hardening round is explicitly justified;
- Round 9 Prompt B must re-run from criterion 1 against this corrected durable classification before it may PASS.

**Prompt A complete — ready for Prompt B.**

## Prompt B bounded repair during Round 9 closeout

Independent closeout identified one classification defect in the Prompt A checkpoint: downstream Pages coupling by itself does not invalidate embedding when there is one existing functional writer job that always starts and already has checkout. `.github/workflows/build-etf-market-regime-analysis.yml` satisfies that pattern and is therefore the sole safe residual candidate.

This repair changes documentation/classification only. No production workflow YAML or `EMBEDDED_TARGETS` entry is changed during Round 9 Prompt B.

## Prompt A — Round 10 ETF single-job migration prompt

Continue the workflow schedule-summary lightweight migration in repository `EasonLiu0913/stock_data`.

Before work:
1. Fetch current remote `main`.
2. Read repository-root `AGENTS.md`.
3. Read `docs/agent-prompts/task-routing.json`; proceed only if this project remains the unique active task.
4. Read this canonical handoff.
5. Read `docs/architecture/github-actions.md`, `docs/decisions/ADR-004-workflow-orchestration.md`, `scripts/write_workflow_schedule_summary.js`, and `scripts/migrate_workflow_schedule_summary.js`.
6. Re-read current `.github/workflows/build-etf-market-regime-analysis.yml` before editing.

Objective:
- migrate exactly `.github/workflows/build-etf-market-regime-analysis.yml` from v1 standalone summary to v2 embedded summary in existing job `build`;
- re-confirm its own YAML is not present in production `push.paths` (it may remain in `pull_request.paths`);
- add only this verified target to `EMBEDDED_TARGETS`;
- reuse `build`'s existing repository checkout;
- preserve `if: always() && github.event_name == 'schedule'`.

Frozen:
- do not change cron schedules, production push paths, pull-request paths, date resolution, ETF generation/corporate-action/index logic, tests, write scope, permissions, retry/publish behavior, or Pages topology;
- preserve `build → deploy_pages` and `uses: ./.github/workflows/deploy-pages.yml` exactly;
- preserve `cancel-in-progress: false`;
- no production manual dispatch for validation;
- no `workflow_run`, `repository_dispatch`, event-listener workaround, new reusable abstraction, or new terminal runner;
- preserve the shared renderer and all three summary labels.

Completion:
- bounded implementation commit(s) durable on remote main;
- current remote YAML verifies no standalone summary runner/summary-only checkout remains and exactly one embedded v2 step exists in `build`;
- Ensure Workflow Schedule Summary PASS;
- deployment-race/concurrency audit PASS;
- Scheduled Workflow Registry Contract PASS;
- Node Regression PASS when triggered/applicable;
- Actions inspection proves the workflow-YAML commit did not unexpectedly launch the ETF production workflow;
- canonical handoff updated with Round 10 Prompt A evidence;
- stop with `Prompt A complete — ready for Prompt B`;
- do not execute Round 10 Prompt B automatically.

## Prompt B — Round 10 ETF single-job closeout prompt

Perform independent closeout for `workflow-schedule-summary-lightweight-migration-round-10`.

1. Fetch current remote main, read `AGENTS.md`, `docs/agent-prompts/task-routing.json`, and this handoff; verify this project remains the unique active task.
2. Recover this exact Round 10 Prompt B from the pre-Prompt-A durable handoff.
3. Verify every Round 10 commit and reject unrelated trigger/cron/date-resolution/ETF generation/corporate-action/index/test/write-scope/permissions/concurrency/publication/Pages-topology changes.
4. Verify `.github/workflows/build-etf-market-regime-analysis.yml`:
   - own YAML is absent from production `push.paths`;
   - existing `build` checkout is reused;
   - no standalone v1 summary job or summary-only checkout remains;
   - exactly one v2 embedded step exists in `build`;
   - step is `if: always() && github.event_name == 'schedule'` and uses the shared renderer;
   - `build → deploy_pages`, reusable Pages call, permissions, write scope, and `cancel-in-progress: false` are unchanged.
5. Inspect Actions for the workflow-YAML commit; an unexpected ETF production launch is a closeout failure.
6. Verify renderer self-test, migrator normalization/idempotence, deployment-race audit, scheduled-workflow registry tests, YAML acceptance, and applicable Node regression.
7. Re-fetch remote main, classify concurrent changes, and verify durable state.
8. On PASS, record exact commits/run IDs/tests/current-main evidence in this handoff and close the simple placement-only migration boundary unless new evidence independently supports another preregistered cohort.
9. On failure, fix only the bounded defect and repeat this same Prompt B from criterion 1.

End with: `Prompt B closeout: PASS`.

## Round 9 Prompt B independent closeout — PASS

Round:
`workflow-schedule-summary-lightweight-migration-round-9`

Preregistered Prompt B was recovered from pre-Prompt-A durable main at `bf8acdf540e04f8e5b16fa8f8c7e356f6751d16a` and matched the preserved Round 9 closeout contract.

### Scope / mutation verification

- Round 9 Prompt A checkpoint: `fee2209b6910c669f5d0493cdac7000164c53125`.
- Prompt B bounded classification repair: `8ecdeae58e7cd84f4f5aa88dc9f806326dc0eaa4`.
- From pre-Prompt-A baseline through the repaired closeout baseline, no `.github/workflows/**` file and no `scripts/migrate_workflow_schedule_summary.js` file changed.
- Round 9 therefore made no production workflow YAML, trigger, cron, concurrency, migrator-target, crawler, schema, retry, publication, or deployment-topology change.

### Independent current residual reconstruction

Current main contains `177` workflow YAML files. The runtime-relevant scheduled inventory remains `41` because no workflow YAML changed after the durable prior inventory. Current `EMBEDDED_TARGETS` contains `31` workflows, leaving exactly `10` scheduled residuals outside v2.

Independent current-YAML verification confirms:
- safe single-job candidate: `.github/workflows/build-etf-market-regime-analysis.yml` → existing `build` job;
- multi-job / branch topology: `.github/workflows/backfill-oversold-rebound-coverage.yml`, `.github/workflows/crawl-fubon-broker-details.yml`, `.github/workflows/refresh-finmind-quarterly-financial-quality-due.yml`;
- multi-job and/or downstream publication topology without one suitable guaranteed checkout-owning placement: `.github/workflows/build-twse-market-chart.yml`, `.github/workflows/crawl-sma.yml`, `.github/workflows/daily-gainers-over-5.yml`, `.github/workflows/daily-prediction-replay.yml`, `.github/workflows/daily-stock-prediction.yml`;
- self-trigger risk plus publication coupling: `.github/workflows/momentum-history-replay.yml`.

All ten remain v1 standalone on current main and all write-layer workflows retain non-cancelling concurrency (`cancel-in-progress: false`).

### Required explicit re-checks

`.github/workflows/crawl-fubon-broker-details.yml`:
- schedule + workflow_dispatch only; no production `push`;
- jobs remain `validate-inputs`, `plan-range`, `crawl-range`, `crawl-single`, plus standalone schedule summary;
- range/single paths are branch-dependent and there is no one pre-existing terminal functional job guaranteed across both paths;
- classification remains multi-job / branch topology.

`.github/workflows/momentum-history-replay.yml`:
- production `push.paths` still includes `.github/workflows/momentum-history-replay.yml`;
- editing its own YAML can launch the production/research workflow;
- topology remains `validate → generate → deploy_pages`, repository-writer concurrency remains `cancel-in-progress: false`;
- classification remains self-trigger risk + deployment coupling.

### Prompt A classification defect found and repaired

Prompt A incorrectly treated downstream Pages coupling by itself as sufficient to exclude `.github/workflows/build-etf-market-regime-analysis.yml`.

Independent verification shows:
- its own YAML is absent from production `push.paths` and appears only under `pull_request.paths`;
- `build` is the single functional writer job and already checks out the repository;
- a v2 step appended inside `build` with `always() && schedule` requires no functional job-topology change;
- downstream `deploy_pages` remains `needs: build` and uses the canonical reusable Pages workflow;
- this is materially the same placement pattern already accepted for `.github/workflows/crawl-institutional.yml`.

The handoff classification was corrected in `8ecdeae58e7cd84f4f5aa88dc9f806326dc0eaa4`, and Round 10 Prompt A + Prompt B were preregistered for exactly this one ETF workflow before promotion.

### Concurrent-change / freshness verification

After the Prompt A checkpoint, remote main advanced through scheduled bot data commits affecting market-risk, prediction-context, strategy-snapshot, and prediction output files. None touched workflows, the migrator, routing, or the schedule-summary architecture. These are unrelated data-only changes and do not stale the Round 9 classification.

Routing remains valid with exactly one active project: `workflow-schedule-summary-lightweight-migration`.

### Promotion

Round 10 is promoted for exactly:
- `.github/workflows/build-etf-market-regime-analysis.yml` → `build`.

No other residual is promoted. Round 10 Prompt A must not execute until the repository owner explicitly invokes `Prompt A`.

**Prompt B closeout: PASS**

## Prompt A — Round 9 residual topology classification prompt

Continue the workflow schedule-summary lightweight migration in repository `EasonLiu0913/stock_data`.

Before work:
1. Fetch current remote `main`.
2. Read repository-root `AGENTS.md`.
3. Read `docs/agent-prompts/task-routing.json`; proceed only if this project remains the unique active task.
4. Read this canonical handoff.
5. Read `docs/architecture/github-actions.md`, `docs/decisions/ADR-004-workflow-orchestration.md`, `scripts/write_workflow_schedule_summary.js`, and `scripts/migrate_workflow_schedule_summary.js`.
6. Re-inventory the current `.github/workflows/*.yml|yaml` set from remote main.

Objective:
- perform a classification-only audit of residual runtime-relevant schedule-summary workflows after Round 8;
- do not modify production workflow YAML;
- for every current scheduled workflow still outside v2 embedded handling, determine its live summary state, schedule trigger, production `push` / own-YAML `push.paths` risk, job topology, existing checkout placement, repository-write behavior, concurrency behavior, and Pages/deployment coupling;
- classify residuals into safe single-job candidate, multi-job/branch topology, self-trigger risk, deployment-coupled topology, unreachable/non-scheduled legacy, or explicit frozen exception;
- independently re-check at least `.github/workflows/crawl-fubon-broker-details.yml` and `.github/workflows/momentum-history-replay.yml`;
- produce a durable residual inventory in this handoff;
- if current evidence identifies a bounded safe cohort that can migrate by summary placement only, preregister Round 10 Prompt A + Prompt B for that exact cohort;
- otherwise record the safe stopping boundary and do not invent more migration work.

Frozen:
- no production workflow YAML edits;
- no `EMBEDDED_TARGETS` edits;
- no trigger removal/hardening;
- no cron/date-resolution/crawler/schema/publication/retry/batching/permissions/concurrency changes;
- no production manual dispatch;
- no new reusable abstraction or terminal runner.

Completion:
- current-main residual inventory is durable in this handoff;
- classifications are supported by current YAML evidence, not stale historical labels;
- known topology-risk workflows are explicitly accounted for;
- next action is either an exact preregistered Round 10 pair or a documented migration stopping boundary;
- canonical handoff committed and re-fetched from current main;
- stop with `Prompt A complete — ready for Prompt B`;
- do not execute Round 9 Prompt B automatically.

## Prompt B — Round 9 residual topology closeout prompt

Perform independent closeout for `workflow-schedule-summary-lightweight-migration-round-9`.

1. Fetch current remote main, read `AGENTS.md`, `docs/agent-prompts/task-routing.json`, and this handoff; verify this project is still the unique active task.
2. Recover this exact Round 9 Prompt B from the pre-Prompt-A durable handoff.
3. Verify Round 9 made no production workflow YAML, trigger, cron, concurrency, migrator-target, crawler, schema, retry, publication, or deployment-topology change.
4. Independently reconstruct the current residual scheduled-workflow inventory and compare it to Prompt A's durable classification.
5. For every residual classified as a safe single-job candidate, independently verify:
   - no own-YAML production self-trigger;
   - one suitable existing functional job with checkout;
   - no required functional-topology change;
   - write-layer concurrency remains safe;
   - no deployment coupling invalidates embedding.
6. For every residual classified as multi-job, branch-topology, self-trigger, deployment-coupled, unreachable legacy, or frozen exception, verify the concrete current-YAML evidence supporting that classification.
7. Independently re-check `.github/workflows/crawl-fubon-broker-details.yml` and `.github/workflows/momentum-history-replay.yml`.
8. Re-fetch remote main and classify concurrent changes.
9. On PASS:
   - if a Round 10 pair was preregistered, verify its cohort is exactly supported by the residual evidence and promote it without executing Prompt A;
   - otherwise record the safe stopping boundary and close this migration project phase without inventing more work.
10. On failure, fix only the bounded documentation/classification defect and repeat this same Prompt B from criterion 1.

End with: `Prompt B closeout: PASS`.
