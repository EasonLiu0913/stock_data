# TSMC Equipment Demand Daily AI Research

Canonical handoff: `docs/handoffs/tsmc-equipment-demand-ai-research.md`

## Current phase

Phase 1 — repository-side daily AI research contract and dashboard reader.

## Objective

Add a reproducible daily research layer to the existing TSMC equipment-demand dashboard without allowing AI interpretation to overwrite deterministic price facts.

## Frozen decisions / constraints

- Monitoring universe remains TWSE-listed only: 辛耘 3583、志聖 2467、帆宣 6196、亞翔 6139、洋基工程 6691、漢唐 2404.
- Deterministic price facts remain in `data_prediction_analysis/tsmc-equipment-demand/dashboard.json` and remain authoritative.
- Daily research identity uses an Asia/Taipei **06:00 boundary**, not midnight and not the latest stock trading date. `06:00:00–23:59:59` belongs to that Taipei calendar date; `00:00:00–05:59:59` belongs to the previous Taipei calendar date. Each research day therefore runs from 06:00 through 05:59:59 the next morning.
- The same 06:00 research-day identity must be used by raw/analysis filenames, `report_date`, validator checks, dashboard lookup, and the ChatGPT daily task prompt.
- Initial cadence is one ChatGPT research run per day at 20:30 Asia/Taipei. Cadence changes require evidence from observed publication times.
- Raw market evidence and AI interpretation are separate durable artifacts.
- Raw evidence is stored outside the frontend data tree; analysis is the only AI artifact consumed by the dashboard.
- Analysis must record the exact SHA-256 of its raw evidence bytes and deterministic price snapshot identity.
- Missing negative news is not proof of no negative change.
- AI may interpret demand/price confirmation or divergence but must not rewrite deterministic price state and must not infer fundamental deterioration solely from price weakness.
- The dashboard does not silently fall back to an older research-day AI report when the canonical research-day report is missing.

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
- Updated dashboard to load only the current canonical research-day analysis and show an explicit pending state if absent.
- Renamed the previous hard-coded `今天要看什麼` block to `固定觀察框架` and reserved `今天要看什麼` for actual daily AI output.
- Added a CI workflow to self-test the contract and validate any newly committed analysis against the same-date raw evidence and current deterministic dashboard facts.
- 2026-09-04: changed research-day rollover from midnight to 06:00 Asia/Taipei. Updated the dashboard reader, validator/self-test, canonical README, handoff, and the enabled ChatGPT daily task prompt. This means e.g. `2026-09-04 00:30 +08:00` still resolves to report date `20260903`, while `2026-09-04 06:00 +08:00` resolves to `20260904`.

## Entry points

- `public/tsmc-equipment-demand-dashboard.html` — frontend price facts + dated AI analysis reader; `researchDateKey()` implements the 06:00 research-day boundary.
- `data_prediction_analysis/tsmc-equipment-demand/dashboard.json` — deterministic price/fact payload.
- `config/tsmc-equipment-demand-ai-watchlist.json` — fixed six-stock and per-company watch targets.
- `config/schemas/tsmc-equipment-demand-ai-raw.schema.json` — raw evidence schema v1.
- `config/schemas/tsmc-equipment-demand-ai-analysis.schema.json` — analysis schema v1.
- `scripts/validate_tsmc_equipment_demand_ai_report.js` — executable validator and `--self-test` harness; `researchDate()` enforces the same 06:00 boundary.
- `.github/workflows/validate-tsmc-equipment-demand-ai.yml` — post-write validation workflow for analysis reports.
- `.github/workflows/deploy-pages.yml` — canonical Pages publication workflow.
- `.github/workflows/build-tsmc-equipment-demand-dashboard.yml` — deterministic dashboard refresh and Pages publication chain.
- `data_research/tsmc-equipment-demand/ai/README.md` — storage/replay and research-day contract.

## Next round

After current main is verified:

1. Execute daily research using the canonical 06:00 Asia/Taipei research-day boundary.
2. Preserve the raw evidence artifact unchanged after collection.
3. Produce analysis only from that raw artifact plus the current deterministic dashboard facts.
4. Run `scripts/validate_tsmc_equipment_demand_ai_report.js` on the real pair before treating the report as valid.
5. Verify both files exist and are non-empty on current remote main.
6. Verify `[03 市場環境] Validate TSMC Equipment AI Research` passes for the real analysis commit.
7. Verify canonical Pages publication includes the analysis JSON and the dashboard renders the canonical research day instead of a premature post-midnight pending state.
8. Review evidence quality, source mix, company coverage, and whether 20:30 captures the useful daily publication window.

## Safety / stop conditions

- If the repository contract is stale or changed on current main, stop and reconcile before writing a daily report.
- If raw collection is materially incomplete or a required search class fails, preserve diagnostic status in raw and do not produce a falsely confident analysis.
- If validator fails, do not publish/accept the analysis as PASS.
- If analysis references a different deterministic price state than `dashboard.json`, fix the analysis rather than changing the facts.
- Do not regenerate raw evidence merely to make a later analysis look cleaner; a re-analysis should reuse the frozen raw artifact unless the task is explicitly a new evidence-collection run.
- Do not reintroduce a midnight rollover or implement an implicit yesterday fallback; the canonical identity itself is 06:00-to-05:59:59.

## Prompt A — Next-round implementation prompt

Continue the TSMC Equipment Demand Daily AI Research in repository `EasonLiu0913/stock_data`.

Before doing any work:
1. Fetch current remote `main`.
2. Read repository-root `AGENTS.md`.
3. Read canonical handoff `docs/handoffs/tsmc-equipment-demand-ai-research.md`.
4. Verify current main still contains the exact Phase 1 entry points listed in the handoff.
5. Read `data_research/tsmc-equipment-demand/ai/README.md` and `config/tsmc-equipment-demand-ai-watchlist.json`.

Execute the current daily research-report round. Resolve `YYYYMMDD` using the canonical Asia/Taipei 06:00 research-day boundary: searches beginning from 00:00:00 through 05:59:59 use the previous Taipei calendar date; searches beginning from 06:00:00 through 23:59:59 use the current Taipei calendar date. Save raw market evidence at `data_research/tsmc-equipment-demand/ai/raw/YYYYMMDD.json`, then derive `data_prediction_analysis/tsmc-equipment-demand/ai/analysis/YYYYMMDD.json` only from that frozen raw artifact plus `data_prediction_analysis/tsmc-equipment-demand/dashboard.json` facts. Do not let AI rewrite deterministic price state. Run `scripts/validate_tsmc_equipment_demand_ai_report.js` before accepting the analysis. Verify both artifacts are durable on remote main and allow the repository validation/deployment workflows to run.

## Prompt B — Next-round closeout / verification prompt

Perform phase-closeout verification for the current TSMC Equipment Demand Daily AI Research report.

Before verification:
1. Fetch current remote `main`.
2. Read `AGENTS.md`.
3. Read `docs/handoffs/tsmc-equipment-demand-ai-research.md`.
4. Identify the exact `YYYYMMDD` report created by the just-completed Prompt A using the 06:00 Asia/Taipei research-day boundary.

PASS requires all of the following:
- `data_research/tsmc-equipment-demand/ai/raw/YYYYMMDD.json` exists on remote main and is non-empty.
- `data_prediction_analysis/tsmc-equipment-demand/ai/analysis/YYYYMMDD.json` exists on remote main and is non-empty.
- raw `report_date` equals the canonical 06:00-based Asia/Taipei research day of `search_started_at`; specifically, 00:00:00–05:59:59 maps to the previous Taipei calendar date and 06:00:00–23:59:59 maps to the current Taipei calendar date.
- analysis `report_date` and `raw_report_date` equal the raw report date.
- analysis `raw_sha256` equals the exact SHA-256 of the committed raw file bytes.
- analysis `price_trading_date` and `price_dashboard_generated_at` match the deterministic dashboard snapshot used.
- all six TWSE stocks are present exactly once; no OTC stock appears.
- all analysis evidence IDs exist in raw; no invented evidence reference exists.
- every analysis `price_observation.state` matches the corresponding deterministic dashboard stock state.
- insufficient evidence is represented as uncertainty rather than a fabricated neutral/positive conclusion.
- `node scripts/validate_tsmc_equipment_demand_ai_report.js --self-test` passes, including the 05:59:59/06:00:00 boundary cases.
- `.github/workflows/validate-tsmc-equipment-demand-ai.yml` passes for the real report.
- the canonical Pages artifact contains `data_prediction_analysis/tsmc-equipment-demand/ai/analysis/YYYYMMDD.json` and the deployed dashboard renders that canonical research day.
- raw evidence source quality and query coverage are reviewed, including official/IR/regulatory sources and each company's watch targets.

If any requirement fails, fix only the bounded defect and repeat Prompt B verification.
