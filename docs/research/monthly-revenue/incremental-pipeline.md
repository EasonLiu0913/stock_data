# MOPS Monthly Revenue Incremental Research Pipeline

## Purpose

This document defines the dependency and invalidation model for Phase 2 incremental historical research.

The goal is not to cache everything. The goal is to avoid recomputing monthly detail artifacts that are already mature and whose research inputs have not changed.

## Current dependency graph

```text
data_mops_monthly_revenue/YYYYMM/monthly_revenue.json
        |
        +-- relevant company revenue / derived-factor content
        |
data_twse_market_chart/market_chart.json
        |
        +-- only the market rows required for the month through D20
        |
scripts/lib/stock_price_provider.js
        |
        +-- provider behavior/version
        |
        v
scripts/generate_mops_revenue_monthly_signal_returns.js
        |
        v
data_prediction_analysis/monthly-revenue/monthly-signals/YYYYMM.json
        |
        +--> coverage-summary.json
        +--> factor-rankings.json
        +--> YoY20 subfactor summary
        +--> factor stability summary
        +--> industry breakdown
        +--> market-regime breakdown
```

The monthly `YYYYMM.json` file is the reusable detail artifact. The summaries below it are aggregate artifacts.

## Detail vs aggregate classification

### Incremental monthly detail

Canonical monthly detail:

```text
data_prediction_analysis/monthly-revenue/monthly-signals/YYYYMM.json
```

This artifact contains the per-stock conservative signal event and D1/D3/D5/D10/D20 returns for one revenue month.

It is expensive enough, and isolated enough by month, that incremental reuse is appropriate.

### Aggregate outputs

The following outputs are intentionally rebuilt from stored monthly details:

- coverage summary;
- factor rankings;
- YoY20 subfactor experiment;
- factor stability;
- industry breakdown;
- market-regime breakdown.

These outputs depend on the full selected research window. Adding one month can legitimately change rankings, stability, industry conclusions, or regime comparisons across the whole window.

They are relatively inexpensive compared with regenerating all per-stock monthly return details, so Phase 2 does not attempt fine-grained aggregate caching.

## Reuse fingerprint

A monthly detail may be reused only when its market window is mature and its stored input fingerprint matches the current research inputs.

The current fingerprint contains:

```text
methodology_version
revenue_research_sha256
market_window_sha256
stock_price_provider_sha256
```

### `methodology_version`

Explicit version of the conservative monthly signal-return methodology.

Changing signal timing, horizons, return rules, or other material methodology requires a version change and therefore invalidates old details.

### `revenue_research_sha256`

Hashes only the revenue fields that can affect research output:

- stock code/name;
- industry;
- MoM;
- YoY;
- YTD YoY;
- previous-month YoY;
- YoY acceleration;
- acceleration flag;
- YoY + MoM positive flag.

It intentionally excludes operational metadata such as:

- collection timestamp;
- status recalculation timestamp;
- snapshot count.

Those fields may change during safe maintenance without changing the research meaning of the month.

### `market_window_sha256`

Hashes only the TAIEX rows required for that revenue month's conservative base date through the D20 horizon.

It does not hash the entire market-chart file because appending newer market dates must not invalidate old historical months.

### `stock_price_provider_sha256`

Hashes the unified Price Provider implementation.

A provider implementation change invalidates stored monthly details because source-selection or price interpretation may have changed.

## Mature vs pending details

A month remains non-reusable while any required horizon is still `pending_market_data` or missing entirely. This means the market window has not matured yet and a later run can legitimately fill new D1/D3/D5/D10/D20 observations.

Historical `missing_stock_price` is treated differently. Real validation showed that a small number of historical stocks may remain unavailable even after the month is fully mature. If any single missing stock price made the whole month non-reusable, every historical month would be regenerated forever despite unchanged inputs.

Current rule:

```text
pending_market_data
  -> GENERATE again later

missing_stock_price in an otherwise mature month
  -> may REUSE when fingerprints are unchanged
```

Aggregate analysis continues to include only observations whose requested horizon status is `complete`, so preserving a mature month with a small number of missing stock prices does not silently treat missing rows as valid results.

## Price-data correction boundary

Phase 2 does not fingerprint every underlying stock-price file or every historical price observation. Doing so would make reuse validation almost as expensive as regenerating the monthly detail and would prematurely create a generic dependency engine.

Current rule:

- pending market-window data automatically invalidates the detail;
- Price Provider implementation changes invalidate affected details;
- stable historical `missing_stock_price` does not repeatedly invalidate a mature month;
- after a historical price-data backfill or known historical price correction, run the affected research range with `force_full_rebuild=true`.

This trade-off came directly from real Phase 2 validation: the existing historical dataset has high but not perfect price coverage, so requiring 100% per-stock completeness prevented incremental reuse from ever occurring.

If repeated real price-correction use cases demonstrate a need for finer automatic price-data invalidation, add that capability based on evidence rather than prebuilding it now.

## Incremental runner

The current runner is:

```text
scripts/run_mops_revenue_monthly_signal_incremental.js
```

For each selected month:

```text
inspect current detail
        |
        +-- mature + fingerprint unchanged --> REUSE
        |
        +-- missing / pending / fingerprint changed --> GENERATE
```

The runner reports per-month action and totals for generated vs reused details.

## Full rebuild mode

The workflow keeps an explicit escape hatch:

```text
force_full_rebuild = true
```

Use it when:

- methodology/schema changes;
- historical price data was backfilled or corrected;
- validating incremental output against a clean build;
- debugging suspected stale detail artifacts.

Full rebuild means every selected monthly detail is regenerated before aggregate summaries are rebuilt.

## Workflow

Production research workflow:

```text
.github/workflows/backfill-mops-revenue-monthly-signal-study.yml
```

Current order:

```text
validate scripts/tests
  -> validate requested range
  -> generate/reuse monthly details
  -> validate monthly details
  -> rebuild coverage
  -> rebuild rankings
  -> rebuild YoY20 subfactors
  -> rebuild stability
  -> rebuild industry breakdown
  -> rebuild market-regime breakdown
  -> commit verified research artifacts
```

## Real validation findings

### First migration run

The first `202511-202606` run after incremental support was added regenerated all legacy detail files, upgraded them from schema v2 to v3, and stored input fingerprints. This was expected because legacy artifacts had no fingerprint.

### Second run

A second run revealed two distinct invalidation causes:

1. `202606` received a legitimate `market_window_sha256` change because the TWSE market chart was updated between runs. Recalculation was correct.
2. `202511-202605` had unchanged fingerprints but were still regenerated because the original reuse rule rejected a whole month when any stock/horizon had `missing_stock_price`.

The second behavior was too strict for the observed 98%-99% historical price coverage and was corrected. Mature months now tolerate stable `missing_stock_price`; only pending market data automatically prevents reuse.

## Validation sequence

Before declaring Phase 2 complete:

1. Run a historical range in default incremental mode.
2. Confirm legacy details are generated and receive fingerprints.
3. Run the same range again without material source/methodology changes.
4. Confirm mature monthly details are reused.
5. Confirm a month whose D20 market window changes is correctly regenerated.
6. Confirm aggregate outputs are still rebuilt.
7. Run the same range with `force_full_rebuild=true`.
8. Compare clean-full and incremental aggregate conclusions for equivalence.
9. Confirm a deliberately missing/corrupt detail is regenerated rather than reused.

## Non-goals

Phase 2 intentionally does not add:

- generic artifact dependency DAG;
- hash database for every repository file;
- per-price-observation dependency graph;
- generic cache server;
- distributed incremental scheduler;
- automatic framework generalization.

These require evidence from later real use cases.
