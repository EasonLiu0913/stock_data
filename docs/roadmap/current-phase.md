# Current Development Phase

Last updated: 2026-08-07

## Active area

Long-running Task Framework MVP for the MOPS monthly-revenue historical research platform.

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

## Current evidence

The existing validated MOPS research history is mainly 202511-202606. This is useful but too short for strong cross-regime conclusions; the current period has insufficient weak-market observations.

Do not promote a new production revenue strategy solely from this short period.

## Current phase: Task Framework MVP

The immediate goal is not to build a generic workflow platform.

The goal is:

> **Make MOPS historical backfill reliably interruptible, resumable, and recoverable.**

The framework must remain business-agnostic and independent of GitHub Actions.

### Phase 0A — Framework core implementation (landed)

The first implementation now exists at:

```text
scripts/framework/
├── task_runner.js
├── task_manifest.js
├── task_logger.js
├── task_retry.js
└── index.js
```

Implemented MVP capabilities:

1. sequential item execution;
2. resume with current-output revalidation;
3. retry orchestration for retryable failures;
4. persistent JSON manifest with atomic writes;
5. count-based checkpoint callbacks;
6. final partial checkpoint and pre-failure partial checkpoint;
7. clear progress logging and final summary;
8. lightweight lifecycle hooks without a plugin/event-bus system;
9. no GitHub Actions or Git commands inside the core framework.

Item states:

```text
PENDING
RUNNING
RETRY_WAIT
VALIDATING
DONE
FAILED
SKIPPED
```

Checkpoint remains a task/batch operation, not an item state.

### Phase 0B — Framework validation (current gate)

Automated lifecycle coverage exists in:

```text
tests/task_framework.test.js
```

Dedicated CI exists in:

```text
.github/workflows/test-task-framework.yml
```

The validation suite covers:

- successful item lifecycle;
- existing valid item -> skipped without needless manifest rewrite;
- manifest says done but current output invalid -> rebuilt;
- stale transient manifest state does not block resume;
- retryable failure -> retry -> success;
- retry exhaustion -> visible failure;
- non-retryable failure -> no unnecessary retry;
- count checkpoint + final partial checkpoint;
- validated partial progress checkpointed before a later failure;
- framework works without optional lifecycle hooks.

**Current validation gate:** confirm `[99 測試] Task Framework` passes on GitHub Actions before migrating MOPS backfill onto the framework. Do not mark Phase 0 complete based only on files existing on `main`.

## Phase 1 — Adopt the framework in MOPS backfill

After the framework core/tests pass, migrate the MOPS monthly-revenue range backfill to use it.

Requirements:

- MOPS month key remains domain-owned (`YYYYMM`).
- MOPS owns `isComplete`, processing, validation, and retry classification.
- Process a bounded number of validated months per checkpoint (initial target: 3).
- On rerun, skip already valid months unless force mode is selected.
- Rebuild a month if its recorded completion is stale, missing, or invalid.
- Log planned/completed/skipped/failed/retried months.
- A failure in a late month must not require re-fetching all earlier valid months.
- Preserve existing `force_new_snapshot` semantics.

### Git checkpoint boundary

The core framework must not run Git commands.

If GitHub Actions needs to commit/push checkpointed MOPS outputs, that remains workflow/caller responsibility, triggered around framework checkpoint boundaries.

## Phase 2 — Incremental historical research

After MOPS checkpoint/resume behavior is validated in real use, improve historical research updates.

Goal: adding one new month should not recompute all immutable monthly return artifacts.

Requirements:

- Full-build mode remains available for methodology/schema changes.
- Incremental mode generates only missing/changed monthly detail artifacts.
- Aggregated summaries/rankings/stability/industry/regime outputs may be rebuilt from stored monthly detail artifacts.
- Explicit force/full rebuild options must remain available.

Do not automatically generalize the Task Framework further just because incremental research exists. First compare the real execution needs and only promote genuinely repeated behavior.

## Planned historical extension

Only after Task Framework + MOPS adoption + incremental research are validated:

1. Backfill MOPS `202401-202510`.
2. Validate coverage, schema compatibility, company counts, price/TAIEX availability, research output, and resume behavior.
3. Backfill `202201-202312`.
4. Validate again.
5. Backfill `202001-202112`.

Do not start by requesting the entire `202001-202606` range in one all-or-nothing workflow.

## Framework non-goals for this phase

Do not implement yet:

- scheduler;
- dependency DAG;
- distributed state;
- parallel worker pool;
- streaming item source;
- EventEmitter event bus;
- generic plugin registry;
- middleware pipeline;
- dependency injection container;
- ETA engine;
- generic validation schema;
- automatic Git commit/push inside the core runner;
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
- The first framework implementation exists to make MOPS reliable, not to become a universal orchestration engine.
- A new framework abstraction requires evidence from another real use case.
