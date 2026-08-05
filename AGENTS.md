# AGENTS.md

This file defines mandatory repository-level instructions for coding agents working in `EasonLiu0913/stock_data`.

## GitHub Actions workflow architecture

These rules apply to every change under `.github/workflows/**`.

### Never use `workflow_run` for workflow chaining

- Do not use `workflow_run` to continue prediction, replay, strategy, or Pages deployment workflows.
- Do not create a separate workflow that listens for another workflow to finish.
- Do not use event-based workflow chaining for deployment.
- Do not introduce Actions that appear as `Unknown event`.
- Any newly added `workflow_run` must be treated as an architecture error unless the repository owner explicitly authorizes that exact use.

### Required chaining method

Use reusable workflows and explicit job dependencies:

1. The downstream workflow must expose `on: workflow_call`.
2. The upstream workflow must call it with job-level `uses:`.
3. Use `needs:` to define execution order.

Example:

```yaml
deploy_pages:
  name: Deploy GitHub Pages
  needs: previous_job
  uses: ./.github/workflows/deploy-pages.yml
```

Do not replace this pattern with `workflow_run`, `repository_dispatch`, or a new event-listener workflow.

## Canonical Pages deployment workflow

All GitHub Pages deployments must reuse:

```text
.github/workflows/deploy-pages.yml
```

Do not create another Pages deployment workflow when the existing reusable workflow can support the requirement.

## Required workflow chains

### Daily stock prediction

The intended order is:

```text
generate_v1
→ generate_v2
→ apply_strategy_registry
→ deploy_pages
```

`apply_strategy_registry` must call:

```text
.github/workflows/apply-strategy-tag-registry.yml
```

The strategy registry workflow must then directly call:

```text
.github/workflows/deploy-pages.yml
```

### Daily prediction replay

The intended order is:

```text
replay_and_compare
→ deploy_pages
```

The deployment job must directly reuse `.github/workflows/deploy-pages.yml` with `needs: replay_and_compare`.

## Required checks before editing workflows

Before changing any workflow, search the repository for:

```text
workflow_run
deploy-pages.yml
workflow_call
uses: ./.github/workflows/
```

Confirm that the change does not create a second deployment path or duplicate an existing reusable workflow.

## Pages deployment performance rules

- Validate only the requested target prediction or replay date during deployment.
- Do not validate every historical date during routine deployment.
- Keep sparse checkout enabled in `.github/workflows/deploy-pages.yml`.
- Package only data roots actually referenced by frontend assets.
- Do not restore full-repository checkout and full-repository `rsync` packaging.
- Preserve historical dashboard access only for data that the published frontend actually references.
- Keep `scripts/prepare_pages_site.sh --self-test` working when deployment packaging logic changes.

## Safety when modifying workflows

- Fetch the latest `main` version before editing.
- Preserve unrelated triggers, permissions, concurrency settings, and reusable workflow inputs.
- Check caller permissions before adding a reusable workflow call; reusable workflows cannot elevate permissions beyond the caller.
- Avoid parallel writes to the same workflow file.
- Re-read the updated file after committing and verify the resulting commit SHA.
