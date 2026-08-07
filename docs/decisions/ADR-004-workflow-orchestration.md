# ADR-004: Explicit Workflow Orchestration with workflow_call

- Status: Accepted
- Date: 2026-08-07

## Context

Previous event-based chaining created hard-to-debug GitHub Actions behavior, including duplicate deployment paths and `Unknown event` runs.

## Decision

Repository workflow chaining must use reusable workflows and explicit dependencies:

- Downstream workflow exposes `workflow_call`.
- Upstream workflow uses job-level `uses:`.
- `needs:` defines execution order.

Do not use `workflow_run` for normal prediction, replay, strategy, research, or deployment chaining.

The canonical Pages deployment implementation remains:

```text
.github/workflows/deploy-pages.yml
```

## Rationale

Explicit orchestration keeps dependencies visible in the caller and avoids hidden event chains, duplicate deployment, and recursive behavior.

## Consequences

Before workflow changes, repository-wide dependency searches are mandatory as described in `/AGENTS.md`.

Any proposal to introduce `workflow_run` is considered an architecture change and requires explicit owner authorization.

## Related

- `/AGENTS.md`
- `../architecture/github-actions.md`
- `../architecture/prediction-pipeline.md`
