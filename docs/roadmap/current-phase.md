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

The first implementation exists at:

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

### Phase 0B — Framework validation

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

The GitHub connector used during implementation could not reliably expose push-triggered Action results, so repository state alone must not be treated as proof that CI passed. The production backfill workflow therefore runs the framework/MOPS regression suite itself before doing any crawl or write work.

## Phase 1 — Adopt the framework in MOPS backfill

### Phase 1A — MOPS task adapter (landed)

The domain adapter exists at:

```text
scripts/backfill_mops_monthly_revenue_task.js
```

Adapter responsibilities remain MOPS-specific:

- builds `YYYYMM` item ranges;
- calls the existing MOPS month crawler;
- applies the existing snapshot policy;
- validates MOPS output structure and company counts;
- rebuilds downstream baseline/derived metadata from the requested start month after a successful task run;
- stores Task Framework state outside the MOPS dataset at `data_task_manifests/mops-monthly-revenue-backfill.json` by default.

Resume semantics are intentionally stricter than "file exists":

- `likely_complete` -> may be skipped after revalidation;
- `baseline_seed` -> may be skipped after revalidation;
- `collecting` -> remains structurally valid for the current run, but must be refreshed on a later run rather than permanently frozen;
- missing, malformed, month-mismatched, empty, or inconsistent output -> rebuild.

The existing crawler exports `crawlMonth()` so the adapter reuses the same implementation rather than creating a duplicate crawler.

Adapter regression coverage exists in:

```text
tests/mops_backfill_task_adapter.test.js
```

### Phase 1B — Production workflow migration (landed)

The production workflow uses the Task Framework path:

```text
.github/workflows/backfill-mops-monthly-revenue.yml
  -> scripts/run_mops_backfill_workflow.js
  -> scripts/backfill_mops_monthly_revenue_task.js
  -> scripts/framework/task_runner.js
```

The GitHub Actions caller is intentionally outside `scripts/framework/**`. It owns Git-specific persistence while the core runner remains Git/GitHub-independent.

Production behavior includes:

- preflight syntax and regression tests before crawling;
- the existing 36-month single-run safety limit;
- three attempts for retryable item failures;
- polite delay between actually crawled months;
- resume skip for revalidated `likely_complete` / `baseline_seed` months;
- automatic refresh for `collecting` months;
- checkpoint after every 3 validated progress items;
- final partial checkpoint when fewer than 3 items remain;
- pre-failure checkpoint for earlier validated progress;
- checkpoint commits stage only validated month directories plus the Task Framework manifest;
- root MOPS indexes are intentionally not checkpoint-committed, preventing a failed in-progress month from leaking into published dataset indexes;
- after a successful full run, baseline/derived metadata and root indexes are rebuilt and committed in the final commit;
- `force_new_snapshot=true` forces selected months to actually crawl, preserving the old workflow meaning instead of allowing resume-skip to bypass the requested snapshot.

Checkpoint Git persistence lives in:

```text
scripts/run_mops_backfill_workflow.js
```

Caller regression coverage exists in:

```text
tests/mops_backfill_workflow_caller.test.js
```

The `[99 測試] Task Framework` workflow also covers this caller and the production workflow path.

### Phase 1C — Real-run validation (first run passed; resume rerun pending)

A real GitHub Actions run on 2026-08-07 used:

```text
start_month = 202511
end_month = 202602
force_new_snapshot = true
```

Observed repository evidence after the run:

- the Task Framework manifest was created and contains `202511`, `202512`, `202601`, and `202602` as `done`;
- all four items completed with one attempt;
- `202511` is a valid `baseline_seed` item;
- `202512`, `202601`, and `202602` are `likely_complete`;
- each selected month has `snapshot_count = 2`, confirming `force_new_snapshot=true` caused an actual new crawl/snapshot rather than a resume skip;
- fresh snapshots were written at approximately 23:19-23:20 Taipei time;
- baseline/derived metadata was rebuilt after the crawl (status calculation time approximately 23:20:07 Taipei time);
- comparing the production-migration commit to `main` shows exactly three additional commits, consistent with the designed execution sequence: first 3-month checkpoint, final 1-month partial checkpoint, and final metadata/index commit;
- downstream months `202603-202607` changed only in derived/baseline metadata, as expected from rebuilding the chain from `202511`;
- no evidence was observed that an in-progress failed month leaked into the root MOPS index.

This validates the first real checkpoint/write path on GitHub Actions.

Remaining Phase 1C validation:

1. Rerun the same `202511-202602` range with `force_new_snapshot=false`.
2. Confirm the four complete months are revalidated and skipped rather than fetched again.
3. Confirm no additional snapshots are created for those skipped months.
4. Confirm the run does not create unnecessary data checkpoint commits when there is no new item progress.
5. Later, when a real `collecting` month is available, confirm it refreshes rather than being permanently skipped.

A deliberately injected production failure is not required. The automated lifecycle suite covers `before_failure`; a natural real failure may validate it later.

Phase 1 should be considered complete after the resume rerun succeeds. Then proceed to Phase 2 incremental historical research.

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

Only after Task Framework + MOPS real-run validation + incremental research are validated:

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
