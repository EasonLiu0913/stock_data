# ADR-007: Task Framework Uses a Hook-based, Business-agnostic Long-task Model

**Status:** Accepted  
**Date:** 2026-08-07

## Context

Long-running backfills currently need repeated execution concerns such as resume, retry, checkpointing, validation boundaries, logging, and summaries.

The first concrete problem is MOPS monthly-revenue historical backfill. Future tasks may share some of the same execution needs, but the project philosophy requires evidence before abstraction.

The task framework must therefore solve the current long-task reliability problem without becoming coupled to MOPS, GitHub Actions, or speculative future workflow features.

## Decision

Create a small business-agnostic item task runner whose core responsibility is lifecycle orchestration.

Domain code supplies item semantics and callbacks such as:

- `isComplete`
- `processItem`
- `validateItem`
- optional retry classification

The framework supplies:

- item lifecycle
- resume orchestration
- retry orchestration
- persistent manifest updates
- checkpoint boundaries
- progress logging / summary
- lightweight lifecycle hooks

The first event extension mechanism is plain hook callbacks, not a full event bus or plugin framework.

Example conceptual lifecycle:

```text
Task start
  -> item start
  -> process
  -> retry if needed
  -> validate
  -> item done
  -> checkpoint when boundary reached
  -> task finish
```

Checkpoint is a task/batch operation, not an item state.

The item state model is:

```text
PENDING
RUNNING
RETRY_WAIT
VALIDATING
DONE
FAILED
SKIPPED
```

## GitHub independence

The core framework must not know about GitHub Actions, Pages, runners, commits, or pushes.

In particular, the runner must not directly execute `git commit` or `git push`.

External persistence or CI-specific actions may be performed by callers/adapters responding to hooks such as `onCheckpoint`.

## Resume semantics

A persistent `DONE` status is evidence, not unquestioned truth.

Before skipping an item, the domain completion check must confirm the expected output still exists and remains valid.

```text
manifest DONE
  -> revalidate current output
  -> valid: SKIPPED this run
  -> invalid/missing: rebuild
```

A stale previous transient state such as `RUNNING` must never permanently block a new run.

## Why hooks

Hooks provide enough decoupling for the first real use case while keeping implementation small.

They allow logging, summaries, metrics, and checkpoint-side effects to remain outside the task runner without prematurely introducing:

- EventEmitter/event bus
- plugin registry
- middleware pipeline
- dependency injection container

Those abstractions require evidence from later real users.

## Consequences

### Positive

- MOPS can gain reliable resume/checkpoint/retry behavior without embedding execution infrastructure in business code.
- The framework remains usable locally and outside GitHub Actions.
- Side effects stay separated from lifecycle control.
- Later evolution remains possible without committing to a large plugin architecture now.

### Trade-offs

- The first hook API may need refinement when a second or third real task adopts the runner.
- Some Git checkpoint orchestration remains in workflow/caller code rather than being hidden inside the core framework.
- Domain validators remain explicit instead of being replaced with one generic validator schema.

These trade-offs are intentional.

## Non-goals

This ADR does not authorize building a generic workflow engine.

The initial framework must not add speculative scheduler, DAG, distributed workers, worker pools, streaming sources, middleware, DI, plugin registries, or automatic Git operations.

## Success criterion

The architecture is validated when MOPS historical backfill can be interrupted, preserve validated checkpoint progress, resume by skipping still-valid items, rebuild invalid prior outputs, retry transient failures, and expose clear failures without changing unrelated prediction/replay/deployment behavior.

## Related documents

- `docs/project-philosophy.md`
- `docs/architecture/task-framework.md`
- `docs/decisions/ADR-005-backfill-checkpoint-incremental.md`
- `docs/decisions/ADR-008-incremental-framework-evolution.md`
- `docs/roadmap/current-phase.md`
