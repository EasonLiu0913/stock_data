# Current Development Phase

Last updated: 2026-08-07

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
- Task Framework architecture design (`docs/architecture/task-framework.md`).
- ADR-007 hook-based business-agnostic long-task model.
- ADR-008 incremental framework evolution from real use cases.
- Task Framework core, MOPS adapter, production workflow migration, checkpoint persistence, and real resume validation.

## Current evidence

The existing validated MOPS research history is mainly 202511-202606. This is useful but too short for strong cross-regime conclusions; the current period has insufficient weak-market observations.

Do not promote a new production revenue strategy solely from this short period.

## Completed Phase 1 — Task Framework + MOPS backfill adoption

Goal achieved:

> **MOPS historical backfill is interruptible, resumable, and recoverable from validated progress.**

The production path is:

```text
.github/workflows/backfill-mops-monthly-revenue.yml
  -> scripts/run_mops_backfill_workflow.js
  -> scripts/backfill_mops_monthly_revenue_task.js
  -> scripts/framework/task_runner.js
```

Real GitHub Actions validation on 2026-08-07 confirmed both checkpointed writes and a no-refetch resume rerun.

The first run over `202511-202602` with `force_new_snapshot=true` produced the expected 3-month checkpoint, final 1-month partial checkpoint, final metadata/index commit, and new snapshots.

The second run over the same range with `force_new_snapshot=false` preserved Task manifest timestamps and snapshot counts, produced no item checkpoint commit, and therefore proved complete months were revalidated and skipped instead of fetched again.

## Current Phase 2 — Incremental historical research

Goal:

> **Adding one new or changed month must not regenerate every unchanged historical monthly detail artifact.**

### Phase 2A — Dependency inventory and incremental detail runner (landed; real-run validation pending)

Dependency inventory is documented in:

```text
docs/research/monthly-revenue/incremental-pipeline.md
```

The current research graph is intentionally split into two layers:

```text
Monthly signal detail YYYYMM.json
  -> incrementally generate / validate / reuse

Aggregate research outputs
  -> rebuild from selected monthly details
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

The workflow now has:

```text
force_full_rebuild = false   # default incremental mode
force_full_rebuild = true    # explicit clean/full detail rebuild
```

### Monthly detail reuse rule

A detail is reusable only when:

1. the expected dataset/month identity is valid;
2. all D1/D3/D5/D10/D20 event returns are complete;
3. the stored input fingerprint exists;
4. the stored fingerprint matches current research inputs.

Current fingerprint fields:

```text
methodology_version
revenue_research_sha256
market_window_sha256
stock_price_provider_sha256
```

`revenue_research_sha256` hashes only research-relevant company/factor fields. It deliberately ignores operational MOPS metadata such as collection timestamps, status recalculation timestamps, and snapshot count.

`market_window_sha256` hashes only the TAIEX rows required from the conservative base date through D20. Appending newer market history must not invalidate an old complete month.

The Price Provider implementation itself is fingerprinted so a source-priority or interpretation change invalidates existing details.

Any detail with `pending_market_data` or `missing_stock_price` is regenerated on later runs rather than being treated as immutable.

Known corrections to already-complete historical price data use `force_full_rebuild=true` for the affected range. Phase 2 does not yet build a per-price-observation dependency graph because there is not enough evidence to justify that complexity.

### Aggregate behavior

The following remain full aggregate rebuilds from stored monthly details:

- coverage summary;
- factor rankings;
- YoY20 subfactor experiment;
- factor stability;
- industry breakdown;
- market-regime breakdown.

This is intentional: these summaries are inexpensive compared with per-stock monthly return generation and may legitimately change across the selected window when one new month is added.

### Automated coverage

Incremental tests cover:

- volatile collection metadata does not change stable revenue research input;
- market data appended beyond a completed D20 window does not invalidate the month;
- incomplete return details are not reusable;
- unchanged detail is reused while invalid detail is generated;
- full rebuild mode generates every selected month without consulting reuse.

The production workflow runs these tests before historical generation.

### Phase 2B — Real-run validation (current gate)

The first workflow run after migration is expected to regenerate legacy monthly details once because old files do not contain the new fingerprint. Expected reason:

```text
missing_input_fingerprint
```

Recommended validation sequence:

1. Run `[07 研究] MOPS－月營收歷史因子區間回測` on the currently validated historical range with `force_full_rebuild=false`.
2. Confirm legacy monthly details are generated once and receive fingerprints.
3. Run the exact same range again with `force_full_rebuild=false`.
4. Confirm complete unchanged monthly details report `REUSE` instead of `GENERATE`.
5. Confirm aggregate summaries are still rebuilt.
6. Run a controlled comparison with `force_full_rebuild=true` and verify aggregate conclusions are equivalent to incremental mode.
7. Confirm a missing/corrupt monthly detail is regenerated rather than reused before declaring Phase 2 complete.

Do not mark Phase 2 complete from repository code alone; real workflow evidence is required just as it was for the Task Framework.

## Phase 2 acceptance criteria

Phase 2 is complete when:

1. adding one new revenue month does not regenerate unchanged historical monthly detail artifacts;
2. missing/corrupt or incomplete monthly detail is automatically rebuilt;
3. a methodology/version change correctly invalidates old details or full rebuild can be selected;
4. aggregate research outputs remain equivalent to a clean full build;
5. incremental/full modes have automated regression tests;
6. the workflow reports generated/reused monthly artifacts clearly.

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
