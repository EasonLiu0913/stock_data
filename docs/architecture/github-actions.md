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

## Concurrency layering

Workflow cancellation is intentionally split into two layers.

### Data / repository write layer — do not cancel in progress

Any workflow that may persist repository state is a write-layer workflow. Typical signals include:

- `permissions: contents: write`;
- `git commit`;
- `git push`;
- checkpoint commits during crawls, research, normalization, prediction, replay, or backfill.

If such a workflow uses a concurrency group, it must use:

```yaml
cancel-in-progress: false
```

Omitting cancellation is also acceptable when no shared serialization group is needed.

Reason: a runner may have generated and validated new data that has not yet reached `main`. Cancelling the workflow at that point can discard uncommitted progress.

### Pages publication layer — stale runs may be cancelled

The canonical Pages workflow is different:

- it must not commit or push repository data;
- it must checkout `ref: main` before packaging;
- it rebuilds a complete Pages artifact from the latest committed `main`;
- cancelling an older Pages-only run therefore cannot remove committed repository data.

Required configuration:

```yaml
concurrency:
  group: github-pages
  cancel-in-progress: true
```

This prevents old Pages builds from forming a long queue while newer committed site state is waiting to publish.

The safety boundary is therefore:

```text
generate / validate / commit / push main
  -> non-cancelable data-write layer

checkout latest main / package / upload / deploy Pages
  -> cancelable publication layer
```

Deployment jobs should remain terminal stages after successful data commits, normally enforced with `needs:`.

The repository-wide guard is:

```text
node scripts/audit_workflow_deployment_races.js --self-test
node scripts/audit_workflow_deployment_races.js
```

It scans every workflow under `.github/workflows/**`, not only the workflows currently known to call Pages.

## Race-safe repository publishing

A write-layer workflow must not assume that one successful `pull --rebase` makes the following `push` safe. Another workflow, user, or agent may advance `main` between those operations.

For outputs that are derived from repository state, a conflict-free rebase is also insufficient: the generated artifact may remain semantically stale even when Git can replay the commit cleanly.

The shared helper is:

```text
scripts/race_safe_main_publish.sh
```

The focused regression harness is:

```text
tests/race_safe_main_publish.test.js
.github/workflows/test-race-safe-main-publish.yml
```

Required policy for adopters:

```text
validated source/input snapshot outside worktree (when collection is expensive)
  -> helper fetches current origin/main
  -> hard reset to current origin/main
  -> caller prepare/regenerate script restores validated source and rebuilds derived output
  -> caller validation script validates publish artifacts
  -> helper stages only explicit repo-relative file paths
  -> no-op if current main already has equivalent output
  -> commit and push
  -> push rejected / remote advanced
       -> discard generated commit
       -> bounded jitter
       -> repeat from latest origin/main
```

Important invariants:

- Do not re-crawl an expensive external source merely because Git push raced; preserve a validated raw artifact outside the worktree and restore it in each retry.
- Derived artifacts that depend on repository state must be regenerated after every reset to latest `main`.
- `--add-path` entries must be explicit owned files; the helper fails closed if prepare/validation leaves unrelated tracked or untracked changes.
- Retry is bounded. Exhaustion must fail the workflow instead of reporting success.
- Same-artifact writers may additionally share a `concurrency` group, always with `cancel-in-progress: false`. Concurrency is a first defense; regenerate-after-race remains the second defense against unrelated writers.
- Pages deployment remains downstream of a successful repository publish.

The first production adopter is:

```text
.github/workflows/crawl-twse-margin-balance.yml
```

It snapshots the validated target-date margin CSV under `$RUNNER_TEMP`, then uses the helper to restore that same CSV and regenerate target-date Daily Gainers flow from latest `main` before each publish attempt.

## Before editing a workflow

Search the repository for:

```text
workflow_run
deploy-pages.yml
workflow_call
uses: ./.github/workflows/
cancel-in-progress
contents: write
git push
```

Also confirm:

- Current `main` content.
- Existing triggers.
- Permissions.
- Concurrency group.
- Whether the workflow can persist repository data.
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
