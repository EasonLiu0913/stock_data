# Current Development Phase

Last updated: 2026-08-08

## Active area

Incremental historical research for the MOPS monthly-revenue research platform.

## Completed foundation

- MOPS monthly-revenue crawler and range backfill.
- Monthly revenue snapshots and baseline handling.
- Live-observed revenue event study.
- Conservative historical monthly-signal study.
- D1/D3/D5/D10/D20 return calculation.
- Unified stock price provider:
  - TWSE MI_INDEX
  - `data_history_sma`
  - legacy `data_fubon`
- Coverage summary.
- Factor ranking against same-month universe baseline.
- YoY >=20% subfactor experiment.
- Factor stability analysis.
- Industry breakdown against same-industry baseline.
- Market-regime breakdown as research context only.
- Structured architecture/research/ADR documentation handoff.
- Task Framework core, MOPS adapter, production workflow migration, checkpoint persistence, and real resume validation.

## Current evidence

The existing validated MOPS research history is mainly 202511-202606. This is useful but too short for strong cross-regime conclusions; the current period has insufficient weak-market observations.

Do not promote a new production revenue strategy solely from this short period.

## Completed Phase 1 — Task Framework + MOPS backfill adoption

Goal achieved:

> **MOPS historical backfill is interruptible, resumable, and recoverable from validated progress.**

Real GitHub Actions validation confirmed both checkpointed writes and a no-refetch resume rerun.

## Current Phase 2 — Incremental historical research

Goal:

> **Adding one new or changed month must not regenerate every unchanged historical monthly detail artifact.**

### Phase 2A — Dependency inventory and incremental detail runner (landed)

Dependency inventory:

```text
docs/research/monthly-revenue/incremental-pipeline.md
```

Monthly detail generator:

```text
scripts/generate_mops_revenue_monthly_signal_returns.js
```

Incremental runner:

```text
scripts/run_mops_revenue_monthly_signal_incremental.js
```

Production workflow:

```text
.github/workflows/backfill-mops-revenue-monthly-signal-study.yml
```

The workflow supports:

```text
force_full_rebuild = false   # default incremental mode
force_full_rebuild = true    # explicit clean/full detail rebuild
```

### Monthly detail fingerprint

Current fingerprint fields:

```text
methodology_version
revenue_research_sha256
market_window_sha256
stock_price_provider_sha256
```

Operational MOPS metadata such as collection timestamps and snapshot count are deliberately excluded from the revenue fingerprint.

The market fingerprint covers only the conservative base date through D20, so unrelated future market rows do not invalidate old mature months.

### Mature detail reuse rule

Real Phase 2 validation showed that the original rule was too strict.

The repository has high but not perfect historical price coverage. Requiring every one of roughly 990 stocks to have every D1/D3/D5/D10/D20 price caused all historical months to regenerate forever even when fingerprints were unchanged.

Corrected rule:

```text
pending_market_data
  -> not mature; regenerate later

missing_stock_price in an otherwise mature month
  -> may reuse when fingerprints are unchanged
```

If historical price data is later backfilled or corrected, run the affected range with `force_full_rebuild=true`.

This keeps the implementation simple while matching observed repository data. Do not add a per-price-observation dependency graph without repeated evidence that it is needed.

### Aggregate behavior

The following remain full aggregate rebuilds from stored monthly details:

- coverage summary;
- factor rankings;
- YoY20 subfactor experiment;
- factor stability;
- industry breakdown;
- market-regime breakdown.

This is intentional because aggregate recomputation is cheap relative to per-stock detail generation and conclusions may change when the selected month window changes.

### Phase 2B — Real-run validation (current gate)

Validation evidence so far:

#### First incremental migration run — passed

Range:

```text
202511-202606
force_full_rebuild=false
```

Observed:

- all eight legacy monthly details upgraded from schema v2 to v3;
- all eight received research fingerprints;
- aggregate outputs rebuilt successfully;
- commit: `f826c687 analysis: refresh MOPS monthly revenue signals 202511-202606`.

#### Second incremental run — exposed and fixed an invalidation bug

Before the second run, TWSE market data was updated. As a result, `202606` legitimately changed `market_window_sha256` and should regenerate.

However, `202511-202605` had unchanged fingerprints and still regenerated. Root cause:

- old `hasIncompleteReturns()` rejected a whole month if any stock/horizon was `missing_stock_price`;
- historical price completeness is high but not 100%, so this prevented reuse from ever occurring.

Fix landed:

```text
1994cbc6  fix: reuse mature MOPS details with stable missing prices
2c8984ab  test: distinguish pending market data from missing historical prices
62f675c5  docs: refine mature-detail reuse after real validation
```

### Next validation step

Run the same research workflow again:

```text
start_month: 202511
end_month: 202606
force_full_rebuild: false
```

Expected behavior if there is no new material market/source change during the run:

```text
202511 REUSE
202512 REUSE
202601 REUSE
202602 REUSE
202603 REUSE
202604 REUSE
202605 REUSE
202606 REUSE
```

If the newest month's D20 market window changes again before execution, only that affected month should regenerate; older mature months with unchanged fingerprints should still reuse.

After reuse is proven, Phase 2 still requires:

1. controlled `force_full_rebuild=true` comparison against incremental aggregate outputs;
2. confirmation that a missing/corrupt monthly detail is rebuilt rather than reused.

Do not mark Phase 2 complete until those checks pass.

## Phase 2 acceptance criteria

Phase 2 is complete when:

1. adding one new revenue month does not regenerate unchanged historical monthly detail artifacts;
2. missing/corrupt monthly detail is automatically rebuilt;
3. pending market-window detail is refreshed as new D1/D3/D5/D10/D20 data arrives;
4. methodology/version change correctly invalidates old details or full rebuild can be selected;
5. aggregate research outputs remain equivalent to a clean full build;
6. incremental/full modes have automated regression tests;
7. the workflow reports generated/reused monthly artifacts clearly.

## Planned historical extension

Only after incremental research is validated:

1. Backfill MOPS `202401-202510`.
2. Validate coverage, schema compatibility, company counts, price/TAIEX availability, research output, and resume behavior.
3. Backfill `202201-202312`.
4. Validate again.
5. Backfill `202001-202112`.

Do not start by requesting the entire `202001-202606` range in one all-or-nothing workflow.

## Framework non-goals

Do not implement yet:

- scheduler;
- dependency DAG engine;
- distributed state;
- parallel worker pool;
- streaming item source;
- EventEmitter event bus;
- generic plugin registry;
- middleware pipeline;
- dependency injection container;
- ETA engine;
- generic validation schema;
- generic artifact hash database;
- per-price-observation dependency graph;
- forced Prediction/Replay migration.

These require evidence from later real use cases.

## After long-history validation

Next research theme:

```text
Revenue fundamentals
  + Institutional investors
  + Broker activity
  + Margin data
  + Market / industry context
  -> lead/lag analysis
```

Example windows:

- D-20
- D-15
- D-10
- D-5
- D-1
- publication / conservative availability point
- D+1
- D+3
- D+5

The goal is to study which market participants move before or after fundamental information becomes available.

## Fixed constraints

- Let evidence drive evolution.
- Market regime remains research context, never a strategy gate.
- Research findings do not automatically change production strategies.
- Workflow chaining must follow `AGENTS.md`; do not introduce `workflow_run`.
- Preserve existing prediction/replay/deployment behavior while improving research workflows.
- Do not generalize the Task Framework until another real use case produces evidence for an additional abstraction.
