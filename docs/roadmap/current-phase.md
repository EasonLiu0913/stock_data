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

Corrected rule:

```text
pending_market_data
  -> not mature; regenerate later

missing_stock_price in an otherwise mature month
  -> may reuse when fingerprints are unchanged
```

If historical price data is later backfilled or corrected, run the affected range with `force_full_rebuild=true`.

Do not add a per-price-observation dependency graph without repeated evidence that it is needed.

### Aggregate behavior

The following remain full aggregate rebuilds from stored monthly details:

- coverage summary;
- factor rankings;
- YoY20 subfactor experiment;
- factor stability;
- industry breakdown;
- market-regime breakdown.

This is intentional because aggregate recomputation is cheap relative to per-stock detail generation and conclusions may change when the selected month window changes.

### Phase 2B — Real-run validation (final gate)

Validation evidence:

#### Legacy migration — passed

`202511-202606` with `force_full_rebuild=false` upgraded eight legacy monthly details to schema v3 and added fingerprints.

Commit:

```text
f826c687  analysis: refresh MOPS monthly revenue signals 202511-202606
```

#### Incremental reuse — passed after one evidence-driven fix

The first rerun exposed that `missing_stock_price` was incorrectly preventing all mature months from reuse.

Fixes:

```text
1994cbc6  fix: reuse mature MOPS details with stable missing prices
2c8984ab  test: distinguish pending market data from missing historical prices
62f675c5  docs: refine mature-detail reuse after real validation
```

A subsequent real run proved:

```text
202511-202605 -> REUSE
202606        -> GENERATE while D20 market window is still maturing
```

Only the affected newest month was rewritten; mature historical months were not regenerated.

#### Full rebuild equivalence — passed

A clean `force_full_rebuild=true` run over `202511-202605` was followed by the exact same range in incremental mode.

Comparison:

```text
670ae7c5  full rebuild 202511-202605
41f94036  incremental 202511-202605
```

Observed:

- all seven monthly detail artifacts were reused without modification;
- coverage, rankings, stability, industry, regime, and YoY20 aggregate outputs differed only in `generated_at`;
- research samples, rankings, rates, and conclusions were equivalent.

#### Missing/corrupt recovery — validator staged; real-run pending

Controlled validator:

```text
scripts/validate_mops_revenue_incremental_recovery.js
```

The production workflow now has optional inputs:

```text
run_recovery_validation = false
recovery_month = YYYYMM
```

When enabled on a mature reusable range, the validator:

1. hashes every monthly detail in the requested range;
2. backs up the selected recovery month;
3. deletes the selected detail and runs the real incremental runner;
4. requires exactly that one month to regenerate while all others reuse;
5. restores the original file;
6. corrupts the selected detail with invalid JSON and repeats the same check;
7. restores the original file again;
8. verifies every monthly detail hash exactly matches the pre-test workspace state.

The workflow also runs `git diff --exit-code` immediately afterward, so the controlled recovery test must leave zero persistent monthly-detail changes before normal research generation continues.

Do not mark Phase 2 complete until this controlled recovery validation passes in a real GitHub Actions run.

## Phase 2 acceptance criteria

Phase 2 is complete when:

1. adding one new revenue month does not regenerate unchanged historical monthly detail artifacts — **passed**;
2. missing/corrupt monthly detail is automatically rebuilt — **real-run pending**;
3. pending market-window detail is refreshed as new D1/D3/D5/D10/D20 data arrives — **passed**;
4. methodology/version change correctly invalidates old details or full rebuild can be selected — **implemented/tested**;
5. aggregate research outputs remain equivalent to a clean full build — **passed**;
6. incremental/full modes have automated regression tests — **passed**;
7. the workflow reports generated/reused monthly artifacts clearly — **passed**.

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
