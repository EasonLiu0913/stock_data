# Current Development Phase

Last updated: 2026-08-07

## Active area

MOPS monthly-revenue historical research platform.

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

## Current evidence

The existing validated history is mainly 202511-202606. This is useful but too short for strong cross-regime conclusions; the current period has insufficient weak-market observations.

Do not promote a new production revenue strategy solely from this short period.

## Current phase: backfill infrastructure hardening

Before extending MOPS history to multiple years, improve the backfill/research workflow in two steps.

### Phase 1 — Checkpoint backfill

Goal: long MOPS range backfills must preserve validated partial progress.

Requirements:

- Process a bounded number of months per checkpoint (initial design target: about 3 months).
- Validate each completed month before checkpointing.
- Commit/push checkpoint progress.
- On rerun, automatically skip already valid months unless force mode is selected.
- Log planned/completed/skipped/failed months.
- A failure in a late month must not require re-fetching all earlier valid months.

### Phase 2 — Incremental historical research

Goal: adding one new month should not recompute all immutable monthly return artifacts.

Requirements:

- Full-build mode remains available for methodology/schema changes.
- Incremental mode generates only missing/changed monthly detail artifacts.
- Aggregated summaries/rankings/stability/industry/regime outputs may be rebuilt from stored monthly detail artifacts.
- Explicit force/full rebuild options must remain available.

## Planned historical extension

Only after Phase 1 and Phase 2 are validated:

1. Backfill MOPS `202401-202510`.
2. Validate coverage, schema compatibility, company counts, price/TAIEX availability, and research output.
3. Backfill `202201-202312`.
4. Validate again.
5. Backfill `202001-202112`.

Do not start by requesting the entire `202001-202606` range in one all-or-nothing workflow.

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

- Market regime remains research context, never a strategy gate.
- Research findings do not automatically change production strategies.
- Workflow chaining must follow `AGENTS.md`; do not introduce `workflow_run`.
- Preserve existing prediction/replay/deployment behavior while improving research workflows.
