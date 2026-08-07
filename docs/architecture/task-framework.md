# Task Framework Architecture

> A small, business-agnostic execution framework for reliable long-running item-based tasks.

## Why this exists

The first real problem is MOPS historical backfill reliability: a long range should be able to stop, preserve validated progress, resume safely, retry transient failures, and report what happened without forcing all previous months to run again.

The framework exists to solve that execution problem. It is not a generic workflow engine and is not a replacement for GitHub Actions.

> **MVP success criterion:** MOPS backfill can reliably stop, resume, and continue from validated progress.

## Scope

The MVP framework owns **how a long-running task executes**.

It is responsible for:

- item lifecycle
- resume decisions
- retry orchestration
- persistent task manifest updates
- checkpoint boundaries
- hook callbacks
- consistent progress logging and final summary

Domain code owns **what the task means**.

MOPS, TWSE, ETF, research, or replay code remains responsible for:

- building the item list
- fetching or calculating domain data
- deciding whether an existing item is truly complete
- validating domain outputs
- classifying domain-specific retryable errors when needed
- deciding which output files belong to the item

The framework must never contain domain functions such as `validateMopsRevenue()`.

## First use case

The first production user is the MOPS monthly-revenue range backfill.

For MOPS:

```text
item = YYYYMM
```

The abstraction must remain generic enough that future real users may use:

```text
item = YYYYMMDD
item = stockCode
item = compositeKey
```

but the MVP must not implement speculative streaming sources, DAGs, distributed workers, or generic scheduling.

## MVP API

The initial contract remains explicit and small:

```js
await runTask({
  taskId: 'mops-monthly-revenue-backfill',
  items,
  manifestPath,

  async isComplete(item, context) {
    // Verify existing output is still present and valid.
  },

  async processItem(item, context) {
    // Domain work.
  },

  async validateItem(item, context) {
    // Domain validation after processing.
  },

  retry: {
    maxAttempts: 3,
    isRetryable(error, context) {
      // Optional domain classification.
    }
  },

  checkpoint: {
    everyItems: 3
  },

  hooks: {
    async onTaskStart(event) {},
    async onItemStart(event) {},
    async onItemRetry(event) {},
    async onItemDone(event) {},
    async onCheckpoint(event) {},
    async onTaskFinish(event) {}
  }
});
```

The current implementation is intentionally smaller than a generic workflow engine. New API surface requires evidence from additional real use cases.

## Item state model

Checkpoint is a task/batch operation, not an item state.

The item lifecycle is:

```text
PENDING
   ↓
RUNNING
   ↓
VALIDATING
   ↓
DONE
```

Retry branch:

```text
RUNNING
   ↓
RETRY_WAIT
   ↓
RUNNING
```

Terminal alternatives:

```text
FAILED
SKIPPED
```

Meanings:

- `PENDING`: planned for this run and not yet attempted.
- `RUNNING`: domain processing is active.
- `RETRY_WAIT`: a retryable attempt failed and another attempt is allowed.
- `VALIDATING`: output exists and domain validation is running.
- `DONE`: validated output is complete.
- `FAILED`: processing or validation exhausted allowed recovery.
- `SKIPPED`: a previous output was revalidated and is already complete for this run.

A previous `DONE` record is not sufficient by itself to skip work.

## Safe resume rule

Resume must be validation-driven:

```text
persistent manifest says DONE
        ↓
expected output still exists
        ↓
domain isComplete / validator passes
        ↓
YES → SKIPPED for this run
NO  → rebuild item
```

This protects against deleted files, damaged output, schema changes, or stale manifest state.

A stale prior run state such as `RUNNING` must never permanently block a new run.

Existing valid output may also be adopted into the manifest when the framework is introduced to data that predates the manifest. This avoids forcing a destructive full rebuild simply to initialize task state.

## Persistent manifest vs run state

Do not mix durable completion evidence with transient execution state.

### Persistent task manifest

Long-lived state used for resume decisions:

```json
{
  "schema_version": 1,
  "task_id": "mops-monthly-revenue-backfill",
  "items": {
    "202401": {
      "status": "done",
      "completed_at": "2026-08-07T00:00:00.000Z",
      "validator_version": 1,
      "output_hash": "optional"
    }
  }
}
```

The exact stored metadata should remain minimal until a real need requires more fields.

Manifest writes use a temporary file followed by rename so an interrupted write does not intentionally leave a partially written JSON file as the normal persistence path.

### Per-run state / summary

Describes only the current execution:

```json
{
  "run_id": "...",
  "started_at": "...",
  "current_item": "202409",
  "total": 22,
  "done": 8,
  "skipped": 10,
  "failed": 0
}
```

This may be persisted for diagnostics later, but it is not the authority for whether a future run should skip an item.

## Checkpoint model

Checkpoint occurs only after validated progress.

The MVP uses count-based checkpointing:

```text
checkpoint.everyItems = 3
```

A later real use case may justify time-based checkpointing such as `everyMinutes`, but do not add it until needed.

The current recovery semantics intentionally include three checkpoint reasons:

### `count`

Emitted when validated progress reaches `everyItems`.

Example:

```text
month 1 DONE
month 2 DONE
month 3 DONE
→ checkpoint(reason=count)
```

### `final`

If the task finishes with validated progress smaller than the next count boundary, that partial progress is still checkpointed.

Example with `everyItems = 3`:

```text
month 1 DONE
month 2 DONE
end of task
→ checkpoint(reason=final, validated=2)
```

This prevents the last partial batch from depending on another future run to be persisted externally.

### `before_failure`

If a later item fails while earlier validated progress has not yet reached the next count boundary, the earlier progress is checkpointed before the task reports failure.

Example:

```text
month 1 DONE
month 2 DONE
month 3 FAILED
→ checkpoint(reason=before_failure, validated=2)
→ task fails visibly
```

This behavior is central to the original reliability goal: a late failure must not discard earlier validated work merely because the configured batch size was not reached.

A checkpoint should:

1. include only validated/adopted progress;
2. have the durable manifest already updated locally;
3. emit an `onCheckpoint` hook/event;
4. allow the caller or adapter to persist external progress if required.

A checkpoint hook failure is itself a task failure and must not be silently treated as successful persistence.

### Git is outside the core framework

The core task runner must not execute `git commit` or `git push` directly.

The framework should not know GitHub Actions exists.

Git persistence belongs in the caller, workflow, or a later adapter responding to a checkpoint hook.

This keeps the runner usable from local Node.js, CI, containers, or future runtime environments.

## Retry model

The framework owns retry sequencing, attempt counts, and delay policy.

Domain code may classify whether an error is retryable.

Typical examples:

```text
HTTP 429 / 5xx / temporary network error → retryable
invalid schema / deterministic validation failure → normally non-retryable
known no-data condition → domain decides skip, success, or failure
```

MVP configuration may include:

```js
retry: {
  maxAttempts: 3,
  baseDelayMs: 3000,
  maxDelayMs: 30000,
  isRetryable
}
```

Do not hide the final error after retries are exhausted.

## Validation contract

Validation remains a domain callback, not a generic `requiredFields` framework feature.

A validator may return structured metadata:

```js
{
  valid: true,
  metadata: {
    records: 987
  }
}
```

The framework only cares whether the item is valid and may preserve small diagnostic metadata.

## Hook model

The MVP uses lightweight hooks rather than a full EventEmitter/plugin system.

Hooks allow side effects without coupling them to `TaskRunner`:

```text
Task Runner
   ↓
Hook callback
   ├─ console / CI integration
   ├─ checkpoint persistence caller
   └─ future metrics/plugin adapter
```

Initial hooks include:

- `onTaskStart`
- `onItemStart`
- `onItemRetry`
- `onItemDone`
- `onCheckpoint`
- `onTaskFinish`

The runner works when no optional hooks are supplied.

Do not implement a generic Event Bus, plugin registry, middleware pipeline, or dependency injection container in the MVP.

## Logging and summary

First-version logging favors clarity over visual sophistication.

Example:

```text
[MOPS] [12/22] 202412 START
[MOPS] [12/22] 202412 RETRY 1/3
[MOPS] [12/22] 202412 DONE 4.8s
[MOPS] CHECKPOINT count done=12 skipped=3 failed=0
```

Final summary exposes at least:

```text
Total
Done
Skipped
Failed
Retries
Checkpoints
Elapsed
```

ETA and progress bars are intentionally out of MVP scope because crawler duration is highly variable.

## Initial files

The first implementation stays compact:

```text
scripts/framework/
├── task_runner.js
├── task_manifest.js
├── task_logger.js
├── task_retry.js
└── index.js
```

Lifecycle regression coverage lives at:

```text
tests/task_framework.test.js
```

Dedicated CI lives at:

```text
.github/workflows/test-task-framework.yml
```

Do not create large directory trees for imagined future capabilities.

## MVP capabilities

Version 1 intentionally contains only:

1. item execution;
2. resume / revalidate / skip;
3. retry;
4. persistent manifest;
5. checkpoint callback;
6. unified logging and summary;
7. lightweight lifecycle hooks required to keep side effects outside the runner.

## Explicit non-goals

Do not implement yet:

- scheduler
- dependency DAG
- parallel worker pool
- distributed state
- streaming item source
- EventEmitter event bus
- generic plugin registry
- middleware pipeline
- dependency injection container
- ETA engine
- generic domain validation schema
- automatic Git commit/push in the core runner
- forced migration of Prediction or Replay onto the framework

These require evidence from additional real use cases.

## Evolution path

The intended evidence-driven path is:

```text
MOPS backfill
  ↓
prove resume/checkpoint/retry model
  ↓
second real long-running task adopts it
  ↓
identify duplicated needs
  ↓
extract only the proven next abstraction
```

Potential later users include TWSE historical backfill and incremental historical research, but they are not design requirements for MVP.

## Acceptance criteria before broader adoption

The first implementation is successful when:

- a MOPS range can be interrupted after a checkpoint;
- validated previous months are skipped on rerun;
- invalid/missing prior outputs are rebuilt even when manifest says done;
- transient errors retry without losing prior validated progress;
- exhausted/non-retryable failures are visible;
- partial validated work is checkpointed at task end and before a later failure;
- checkpoint persistence does not require the runner to know Git or GitHub Actions;
- existing prediction/replay/deployment behavior is unchanged;
- framework lifecycle behavior has automated tests and CI validation.

Only after these are demonstrated should the framework be proposed for a second domain.
