# GitHub Actions Architecture

## Purpose

This document complements the mandatory workflow rules in `/AGENTS.md`.

`AGENTS.md` is authoritative when there is any conflict.

## Workflow categories

Workflows should have a clear primary responsibility:

1. Data collection
2. Normalization / validation
3. Prediction / replay
4. Research / backfill
5. Deployment

Avoid combining unrelated lifecycle stages in one job simply for convenience.

## Workflow chaining

Do not use `workflow_run` for repository workflow chaining.

Required pattern:

- Downstream workflow exposes `workflow_call`.
- Upstream workflow uses job-level `uses:`.
- Execution order uses `needs:`.

Example:

```yaml
deploy_pages:
  needs: previous_job
  uses: ./.github/workflows/deploy-pages.yml
```

Do not substitute `repository_dispatch` or a separate event-listener workflow for normal chaining.

## Canonical Pages deployment

All Pages publication must reuse:

```text
.github/workflows/deploy-pages.yml
```

Do not create a second deployment implementation or a legacy Pages rebuild API path.

## Before editing a workflow

Search the repository for:

```text
workflow_run
deploy-pages.yml
workflow_call
uses: ./.github/workflows/
```

Also confirm:

- Current `main` content.
- Existing triggers.
- Permissions.
- Concurrency group.
- Existing downstream callers.
- Pages packaging dependencies if public runtime paths are affected.

## Long-running backfill workflows

Historical jobs should be designed for partial progress.

Preferred behavior:

```text
plan missing work
  -> process bounded batch
  -> validate
  -> checkpoint commit/push
  -> continue
```

Re-running should skip already valid completed units unless force mode is explicitly requested.

For monthly datasets, a checkpoint every small bounded number of months is preferable to a single all-or-nothing run spanning years.

## Incremental research

Historical source backfill and historical research are related but distinct.

Preferred model:

- First build: generate all required monthly detail artifacts.
- New month: generate only the new/changed monthly detail artifact.
- Summaries/rankings: rebuild from already stored detail artifacts when needed.

Do not recompute expensive immutable monthly returns merely because one new month was added.

## Validation

A workflow should validate required source files and its own output before committing or calling downstream workflows.

Validation errors must be explicit; do not silently substitute today's date or unrelated available data.

## Failure recovery

For long workflows, log at least:

- Planned units.
- Completed units.
- Skipped units and reason.
- Failed unit.
- Checkpoint state.

A failed late unit should not erase validated earlier work.

## Deployment performance

Routine Pages deployment should validate only requested/current relevant dates and should preserve sparse checkout and dependency-driven packaging as required by `AGENTS.md`.
