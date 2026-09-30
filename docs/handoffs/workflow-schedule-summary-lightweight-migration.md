# Workflow schedule-summary lightweight migration

Canonical handoff: docs/handoffs/workflow-schedule-summary-lightweight-migration.md

## Current phase

Round 1 implementation and durable closeout. Round 2 has **not** begun.

Remote-main baseline was re-fetched repeatedly during the round because normal data workflows continued to advance `main`. The implementation commit already present on remote main is:

- `529650d366084000e43644d34c66b09e9e66c564` — `perf: inline schedule summaries in safe workflows`
- `c25a8621d12868eb5410e37ed14728f2e1b2cc99` — fixes escaped GitHub expressions in the migrator
- `30d3e735fc7aa91ec2c19c8cc1935cb047ffdf95` — freezes TPEx as a Round 2 legacy exception

This handoff commit records the complete Round 1 state and freezes additional newly discovered self-trigger/self-auditing exceptions so the repository-wide normalizer does not force Round 1 to edit them.

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

Round 2 must remain a separate, owner-invoked round.

Ordered work:

1. Re-fetch remote main and re-run the full inventory.
2. Start with self-trigger scheduled production workflows; design how to change YAML without turning the migration commit into a production collection run.
3. Separately decide multi-job placement for workflows such as `crawl-fubon-broker-details.yml`, `crawl-sma.yml`, prediction/replay workflows, and FinMind refresh.
4. Revisit the five frozen unmarked workflows and decide whether they actually need schedule-summary normalization at all; most have no schedule trigger.
5. Consider narrowing the normalizer contract so non-scheduled workflows do not carry unreachable schedule-only jobs. Treat that as a separate evidence-driven cleanup, not an implicit Round 2 side effect.
6. Preserve the renderer contract and all frozen production behavior.

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
- Design and implement the next bounded migration cohort, focusing first on scheduled workflows that remain v1.
- Do not blindly edit self-trigger workflows. For every candidate whose own YAML is in `push.paths`, first choose a safe migration mechanism that cannot cause the migration commit itself to run the production collector.
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
