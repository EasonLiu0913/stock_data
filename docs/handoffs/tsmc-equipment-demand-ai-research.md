# TSMC Equipment Demand Daily AI Research

Canonical handoff: `docs/handoffs/tsmc-equipment-demand-ai-research.md`

## Current phase

Phase 1 — repository-side daily AI research contract and dashboard reader.

## Objective

Add a reproducible daily research layer to the existing TSMC equipment-demand dashboard without allowing AI interpretation to overwrite deterministic price facts.

## Frozen decisions / constraints

- Monitoring universe remains TWSE-listed only: 辛耘 3583、志聖 2467、帆宣 6196、亞翔 6139、洋基工程 6691、漢唐 2404.
- Deterministic price facts remain in `data_prediction_analysis/tsmc-equipment-demand/dashboard.json` and remain authoritative.
- Daily research identity is the Asia/Taipei date when market searching starts, not the latest stock trading date.
- Initial cadence is one ChatGPT research run per day at 20:30 Asia/Taipei. Cadence changes require evidence from observed publication times.
- Raw market evidence and AI interpretation are separate durable artifacts.
- Raw evidence is stored outside the frontend data tree; analysis is the only AI artifact consumed by the dashboard.
- Analysis must record the exact SHA-256 of its raw evidence bytes and deterministic price snapshot identity.
- Missing negative news is not proof of no negative change.
- AI may interpret demand/price confirmation or divergence but must not rewrite deterministic price state and must not infer fundamental deterioration solely from price weakness.
- The dashboard does not silently fall back to yesterday's AI report when today's report is missing.

## Storage contract

Raw evidence:

`data_research/tsmc-equipment-demand/ai/raw/YYYYMMDD.json`

AI analysis:

`data_prediction_analysis/tsmc-equipment-demand/ai/analysis/YYYYMMDD.json`

Deterministic facts:

`data_prediction_analysis/tsmc-equipment-demand/dashboard.json`

## Completed in Phase 1 implementation branch

- Added company/theme watchlist contract.
- Added raw evidence JSON Schema.
- Added AI analysis JSON Schema.
- Added deterministic validator with self-test, raw SHA verification, evidence-reference verification, six-stock scope verification, and deterministic per-stock price-state equality.
- Updated dashboard to load only the current Asia/Taipei analysis date and show an explicit pending state if absent.
- Renamed the previous hard-coded `今天要看什麼` block to `固定觀察框架` and reserved `今天要看什麼` for actual daily AI output.
- Added a CI workflow to self-test the contract and validate any newly committed analysis against the same-date raw evidence and current deterministic dashboard facts.

## Entry points

- `public/tsmc-equipment-demand-dashboard.html` — frontend price facts + dated AI analysis reader.
- `data_prediction_analysis/tsmc-equipment-demand/dashboard.json` — deterministic price/fact payload.
- `config/tsmc-equipment-demand-ai-watchlist.json` — fixed six-stock and per-company watch targets.
- `config/schemas/tsmc-equipment-demand-ai-raw.schema.json` — raw evidence schema v1.
- `config/schemas/tsmc-equipment-demand-ai-analysis.schema.json` — analysis schema v1.
- `scripts/validate_tsmc_equipment_demand_ai_report.js` — executable validator and `--self-test` harness.
- `.github/workflows/validate-tsmc-equipment-demand-ai.yml` — post-write validation workflow for analysis reports.
- `.github/workflows/deploy-pages.yml` — canonical Pages publication workflow.
- `.github/workflows/build-tsmc-equipment-demand-dashboard.yml` — deterministic dashboard refresh and Pages publication chain.
- `data_research/tsmc-equipment-demand/ai/README.md` — storage/replay contract.

## Next round

After Phase 1 is merged and current main is verified:

1. Update the already-created daily ChatGPT task to use the canonical raw path `data_research/tsmc-equipment-demand/ai/raw/YYYYMMDD.json` and analysis path `data_prediction_analysis/tsmc-equipment-demand/ai/analysis/YYYYMMDD.json`.
2. Execute the first real daily research run using the actual Asia/Taipei search date.
3. Preserve the raw evidence artifact unchanged after collection.
4. Produce analysis only from that raw artifact plus the current deterministic dashboard facts.
5. Run `scripts/validate_tsmc_equipment_demand_ai_report.js` on the real pair before treating the report as valid.
6. Verify both files exist and are non-empty on current remote main.
7. Verify `[03 市場環境] Validate TSMC Equipment AI Research` passes for the real analysis commit.
8. Verify canonical Pages publication includes the analysis JSON and the dashboard renders the current research date instead of the pending state.
9. Review evidence quality, source mix, company coverage, and whether 20:30 captures the useful daily publication window. Do not change cadence in the same round solely from intuition.

## Safety / stop conditions

- If the repository contract is stale or changed on current main, stop and reconcile before writing a daily report.
- If raw collection is materially incomplete or a required search class fails, preserve diagnostic status in raw and do not produce a falsely confident analysis.
- If validator fails, do not publish/accept the analysis as PASS.
- If analysis references a different deterministic price state than `dashboard.json`, fix the analysis rather than changing the facts.
- Do not regenerate raw evidence merely to make a later analysis look cleaner; a re-analysis should reuse the frozen raw artifact unless the task is explicitly a new evidence-collection run.

## Prompt A — Next-round implementation prompt

Continue the TSMC Equipment Demand Daily AI Research in repository `EasonLiu0913/stock_data`.

Before doing any work:
1. Fetch current remote `main`.
2. Read repository-root `AGENTS.md`.
3. Read canonical handoff `docs/handoffs/tsmc-equipment-demand-ai-research.md`.
4. Verify current main still contains the exact Phase 1 entry points listed in the handoff.
5. Read `data_research/tsmc-equipment-demand/ai/README.md` and `config/tsmc-equipment-demand-ai-watchlist.json`.

Execute only the first real daily research-report round defined in `Next round`. Use the Asia/Taipei date when the search actually starts as `YYYYMMDD`. Save raw market evidence at `data_research/tsmc-equipment-demand/ai/raw/YYYYMMDD.json`, then derive `data_prediction_analysis/tsmc-equipment-demand/ai/analysis/YYYYMMDD.json` only from that frozen raw artifact plus `data_prediction_analysis/tsmc-equipment-demand/dashboard.json` facts. Do not let AI rewrite deterministic price state. Run `scripts/validate_tsmc_equipment_demand_ai_report.js` before accepting the analysis. Verify both artifacts are durable on remote main and allow the repository validation/deployment workflows to run. Stop after the first real daily report is durably written and ready for Prompt B closeout; do not change the daily cadence in this round.

## Prompt B — Next-round closeout / verification prompt

Perform phase-closeout verification for the first real TSMC Equipment Demand Daily AI Research report.

Before verification:
1. Fetch current remote `main`.
2. Read `AGENTS.md`.
3. Read `docs/handoffs/tsmc-equipment-demand-ai-research.md`.
4. Identify the exact `YYYYMMDD` report created by the just-completed Prompt A.

PASS requires all of the following:
- `data_research/tsmc-equipment-demand/ai/raw/YYYYMMDD.json` exists on remote main and is non-empty.
- `data_prediction_analysis/tsmc-equipment-demand/ai/analysis/YYYYMMDD.json` exists on remote main and is non-empty.
- raw `report_date` equals the Asia/Taipei date of `search_started_at`.
- analysis `report_date` and `raw_report_date` equal the raw report date.
- analysis `raw_sha256` equals the exact SHA-256 of the committed raw file bytes.
- analysis `price_trading_date` and `price_dashboard_generated_at` match the deterministic dashboard snapshot used.
- all six TWSE stocks are present exactly once; no OTC stock appears.
- all analysis evidence IDs exist in raw; no invented evidence reference exists.
- every analysis `price_observation.state` matches the corresponding deterministic dashboard stock state.
- insufficient evidence is represented as uncertainty rather than a fabricated neutral/positive conclusion.
- `.github/workflows/validate-tsmc-equipment-demand-ai.yml` passes for the real report.
- the canonical Pages artifact contains `data_prediction_analysis/tsmc-equipment-demand/ai/analysis/YYYYMMDD.json` and the deployed dashboard renders that report for the current research date.
- raw evidence source quality and query coverage are reviewed, including official/IR/regulatory sources and each company's watch targets.

If any requirement fails, fix only the bounded defect and repeat Prompt B verification. Do not promote a cadence change or methodology v2 until this first real daily cycle has durable PASS evidence.
