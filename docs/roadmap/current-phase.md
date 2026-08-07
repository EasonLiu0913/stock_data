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

### Framework core

The implementation exists at:

```text
scripts/framework/
├── task_runner.js
├── task_manifest.js
├── task_logger.js
├── task_retry.js
└── index.js
```

Implemented capabilities:

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

### MOPS adapter and production path

The production path is:

```text
.github/workflows/backfill-mops-monthly-revenue.yml
  -> scripts/run_mops_backfill_workflow.js
  -> scripts/backfill_mops_monthly_revenue_task.js
  -> scripts/framework/task_runner.js
```

The GitHub Actions caller remains outside `scripts/framework/**` and owns Git-specific persistence while the core runner remains Git/GitHub-independent.

Resume semantics:

- `likely_complete` -> may be skipped after revalidation;
- `baseline_seed` -> may be skipped after revalidation;
- `collecting` -> structurally valid for the current run but must refresh later;
- missing, malformed, month-mismatched, empty, or inconsistent output -> rebuild.

Production behavior includes:

- preflight syntax and regression tests;
- 36-month single-run safety limit;
- three retry attempts for retryable item failures;
- polite delay between actually crawled months;
- checkpoint after every 3 validated progress items;
- final partial checkpoint;
- pre-failure checkpoint for earlier validated progress;
- checkpoint commits stage only validated month directories plus the Task Framework manifest;
- root MOPS indexes are excluded from partial checkpoints;
- successful full runs rebuild baseline/derived metadata and root indexes before final commit;
- `force_new_snapshot=true` forces actual crawling rather than allowing resume skip.

### Real GitHub Actions validation — passed

First validation run on 2026-08-07:

```text
start_month = 202511
end_month = 202602
force_new_snapshot = true
```

Observed repository evidence:

- `202511`, `202512`, `202601`, and `202602` were recorded as `done` in the Task Framework manifest;
- all four items succeeded in one attempt;
- new snapshots were created for all four selected months;
- `snapshot_count` increased to 2;
- the Git history showed exactly three commits after the production migration, matching first 3-month checkpoint, final 1-month partial checkpoint, and final metadata/index commit;
- downstream `202603-202607` only received expected baseline/derived metadata recalculation.

Resume validation run on the same range used:

```text
start_month = 202511
end_month = 202602
force_new_snapshot = false
```

Observed repository evidence:

- Task manifest content and timestamps did not change;
- all four selected months retained `snapshot_count = 2`;
- therefore no selected month was crawled again;
- no new snapshot files were created;
- no item-progress checkpoint commit was created;
- only one final metadata/index commit occurred because the current implementation deterministically recalculates metadata timestamps after a successful task invocation.

This proves the production resume path revalidates and skips complete months instead of refetching them.

The `collecting` refresh path remains covered by automated adapter behavior and should also be observed naturally when a live incomplete month occurs; it is no longer a blocker for Phase 1 completion.

## Current Phase 2 — Incremental historical research

Goal:

> Adding one new or changed month should not recompute every immutable monthly research artifact.

### Required behavior

- Full-build mode remains available for methodology/schema/version changes.
- Incremental mode generates only missing or invalidated monthly detail artifacts.
- Existing valid immutable monthly detail artifacts are revalidated and reused.
- Aggregated outputs may be rebuilt from stored monthly detail artifacts when inexpensive and deterministic.
- Explicit force/full rebuild options remain available.
- Dependency/invalidation rules must be explicit so a methodology change cannot silently reuse incompatible monthly artifacts.

### Initial implementation scope

Start with the MOPS historical research pipeline only. Do not generalize the Task Framework further yet.

First identify the current generators and their dependency graph for:

- historical monthly signals / event detail;
- D1/D3/D5/D10/D20 return detail;
- coverage summary;
- factor rankings;
- YoY20 subfactor experiment;
- factor stability;
- industry breakdown;
- market-regime breakdown.

Classify outputs into:

```text
Monthly immutable/detail artifact
  -> incremental generate / validate / reuse

Aggregate artifact
  -> rebuild from monthly detail when appropriate
```

Define a research artifact version or methodology fingerprint before allowing incremental reuse across methodology changes.

### Phase 2 acceptance criteria

Phase 2 is complete when:

1. adding one new revenue month does not regenerate unchanged historical monthly detail artifacts;
2. missing/corrupt monthly detail is automatically rebuilt;
3. a methodology/version change can force correct invalidation/full rebuild;
4. aggregate research outputs remain equivalent to a clean full build;
5. incremental/full modes have automated regression tests;
6. the workflow reports generated/reused/rebuilt monthly artifacts clearly.

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
- Do not generalize the Task Framework until another real use case produces evidence for an additional abstraction.
