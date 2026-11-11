# Market Environment Historical Gap Recovery — [06]

Date: 2026-11-11. Owner direction: centralize historical missing-snapshot repairs in the existing `[06 回填修復] Backfill Market Environment` workflow. Do not make `[06]` invoke `[03]`, and do not alter `[03]`'s scheduled recovery and production gates.

## Inputs and use

Workflow: `.github/workflows/backfill-market-environment.yml`.

- `start_date`, `end_date`: inclusive Taiwan forecast trading dates in YYYYMMDD.
- `dry_run=true` by default: inventory only; no upstream dispatch, snapshot modification, or push.
- `dry_run=false`: request date-scoped upstream repairs and rebuild dates that are already ready.
- `force=false`: reuse valid existing snapshots, do not overwrite invalid existing snapshots automatically.
- `generate_actual=true`: build missing actual snapshots only if that day's replay-summary, replay-dashboard and prediction summary exist.

Inventory implementation: `scripts/plan_market_environment_recovery.js`. It scans selected trading dates, calculates the previous Taiwan trading day as base date, checks forecast snapshot date/hash/status, actual snapshot date/schema presence, and source readiness when forecast rebuild is needed. Each source issue is recorded with dataset, date and reason. Deduplication within a given run is keyed by `dataset:date`.

## Upstream repair mapping

- Fubon SMA: `backfill-fubon-sma-range.yml` with exact base-date start/end, minimum 900.
- TWSE MI_INDEX: `crawl-twse-mi-index.yml` with exact base date.
- TAIFEX foreign futures: `crawl-taifex-major-institutional-traders-futures-contracts.yml` with exact base date.
- US market and risk: `crawl-external-market-indicators.yml` with expected US market session date.

Maximum **12 distinct upstream dispatches per [06] invocation** to avoid unbounded fan-out; excess items remain visible as gaps and require another owner-invoked run. A successful dispatch request is not a successful recovery. GitHub Actions run IDs for downstream workflows must be checked independently. Cross-run, date-scoped dispatch deduplication is not yet guaranteed by this workflow.

The [06] job does **not wait** for long-running source crawlers, does **not** trigger [03], and marks the current build run FAILED if any selected date is blocked or if any dispatch/build failed. A later explicit historical [06] invocation picks up committed upstream files and builds ready dates. The normal [03] schedule remains independent.

## Historical snapshot identity and acceptance

- Existing verified snapshots are reused, not blindly regenerated.
- Missing prediction snapshots are generated only from confirmed prerequisite datasets. Successful outputs are rechecked for date, mode, freshness and snapshot hash.
- `historical_reconstructed` remains a historical-research state, **not** promoted to [03] live fresh status.
- Missing actual snapshots are only built from actual replay inputs. Missing replay inputs are reported as blocked, never fabricated.
- Successful partial outputs are committed to `main` by the existing final commit/push logic; the overall run can still FAIL if another date is blocked.
- A plan JSON artifact named `market-environment-gaps-<run_id>` plus the Job Summary provides dated, inspectable evidence for follow-up.

## Testing/validation

1. Execute the workflow in dry-run mode on 20260915–20260923; inspect the JSON plan artifact and Step Summary, verify dry-run does not dispatch or push.
2. Execute a one-date historical recovery with `dry_run=false`, `force=false`. If upstream is missing, expect independent workflow dispatch requests and this [06] Run to FAIL; check related [01]/[02]/[06] workflow runs separately.
3. After upstream commits, re-invoke [06] for that date. Verify that only missing outputs were generated; check the persisted file, hash/date/source provenance and final commit.
4. Verify [03] runs remain scheduled normally and all YouTube upload/publication locks stay unchanged.

**Status:** Implementation committed; no runtime GitHub Actions [06] validation recorded as part of this change. Do not mark end-to-end historical backfill PASS until a live run provides evidence.
