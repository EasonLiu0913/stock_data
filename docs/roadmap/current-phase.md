# Current Development Phase

Last updated: 2026-08-08

## Active area

Long-history expansion for the MOPS monthly-revenue research platform.

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

## Completed Phase 1 — Task Framework + MOPS backfill adoption

Goal achieved:

> **MOPS historical backfill is interruptible, resumable, and recoverable from validated progress.**

Real GitHub Actions validation confirmed checkpointed writes, retry behavior, and no-refetch resume behavior.

## Completed Phase 2 — Incremental historical research

Goal achieved:

> **Adding one new or changed month does not regenerate unchanged historical monthly detail artifacts.**

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

Supported modes:

```text
force_full_rebuild = false   # default incremental mode
force_full_rebuild = true    # explicit clean/full detail rebuild
```

### Monthly detail fingerprint

```text
methodology_version
revenue_research_sha256
market_window_sha256
stock_price_provider_sha256
```

Operational MOPS metadata such as collection timestamps and snapshot count are deliberately excluded from the revenue fingerprint.

The market fingerprint covers only the conservative base date through D20, so unrelated future market rows do not invalidate old mature months.

### Mature detail reuse rule

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

### Phase 2 real-run validation — passed

#### Legacy migration

`202511-202606` with `force_full_rebuild=false` upgraded eight legacy monthly details to schema v3 and added fingerprints.

Commit:

```text
f826c687  analysis: refresh MOPS monthly revenue signals 202511-202606
```

#### Incremental reuse

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

#### Full rebuild equivalence

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

#### Missing/corrupt recovery

Controlled validator:

```text
scripts/validate_mops_revenue_incremental_recovery.js
```

Real GitHub Actions validation over mature `202511-202605` with recovery month `202603` passed both controlled scenarios:

1. missing monthly detail regenerated only `202603` while other months reused;
2. corrupt JSON regenerated only `202603` while other months reused;
3. the original monthly detail was restored after each scenario;
4. `git diff --exit-code` passed before normal generation continued;
5. final workflow commit contained no monthly-detail changes, only aggregate `generated_at` updates.

Final evidence commit:

```text
e8dd1008  analysis: refresh MOPS monthly revenue signals 202511-202605
```

### Phase 2 acceptance criteria

1. adding one new revenue month does not regenerate unchanged historical monthly detail artifacts — **passed**;
2. missing/corrupt monthly detail is automatically rebuilt — **passed**;
3. pending market-window detail is refreshed as new D1/D3/D5/D10/D20 data arrives — **passed**;
4. methodology/version change correctly invalidates old details or full rebuild can be selected — **passed**;
5. aggregate research outputs remain equivalent to a clean full build — **passed**;
6. incremental/full modes have automated regression tests — **passed**;
7. the workflow reports generated/reused monthly artifacts clearly — **passed**.

## Current Phase 3 — Long-history expansion

Goal:

> **Extend evidence in staged historical blocks, validating data quality and research behavior after each block instead of performing one all-or-nothing backfill.**

### Phase 3A — Raw MOPS backfill `202401-202510` — passed

Production run:

```text
[06 回填修復] MOPS－上市公司月營收區間回填
start_month: 202401
end_month: 202510
force_new_snapshot: false
```

Final commit:

```text
9b8c8466  data: backfill MOPS monthly revenue 202401-202510
```

Observed:

- all 22 months `202401-202510` are `DONE` in the Task manifest;
- company counts range from 967 to 990 and evolve smoothly through the period;
- all non-seed monthly coverage ratios are approximately 0.9979 to 1.0041 and pass the completeness threshold;
- `202401` is the expected `baseline_seed` because the preceding month was not yet in this staged dataset;
- `202402-202510` are `likely_complete`;
- only `202505` required a retry (`attempts=2`) and then completed successfully;
- root MOPS manifest now lists the continuous range `202401-202607`;
- checkpoint commits were created every three successfully processed months, with a final one-month partial checkpoint for `202510`.

Checkpoint evidence:

```text
5dbb0b98  202401-202403
eb270565  202404-202406
ec1f4e4f  202407-202409
f50dcb6e  202410-202412
3376afee  202501-202503
7b43e94f  202504-202506
40bd6dd6  202507-202509
de7ecde9  202510-202510
```

This is the first long-range production run proving the Task Framework checkpoint/retry model over 22 historical months.

### Phase 3B — Research generation for `202401-202510` — current

Next step:

Run the incremental historical research workflow over the new raw-data block:

```text
[07 研究] MOPS－月營收歷史因子區間回測
start_month: 202401
end_month: 202510
force_full_rebuild: false
run_recovery_validation: false
```

Expected behavior:

- all 22 months are new research artifacts and should `GENERATE` once;
- each monthly detail should receive schema v3 fingerprints;
- coverage must be checked for stock price availability and TAIEX D1/D3/D5/D10/D20 coverage;
- aggregate rankings, stability, industry, regime, and YoY20 outputs must rebuild for the wider history;
- do not promote a production strategy solely because a factor looks strong after this one extension; compare persistence across later historical blocks.

### Planned next blocks

Only after `202401-202510` research output is validated:

1. backfill MOPS `202201-202312`;
2. validate raw coverage and incremental research again;
3. backfill `202001-202112`;
4. validate again.

Do not request the entire `202001-202606` range in one all-or-nothing workflow.

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
