# Daily Data Recovery v2 — Push-based recovery request (research)

Canonical path: docs/architecture/daily-data-recovery-v2.md
Status: EXPERIMENT 01 / NOT PRODUCTION. Supersedes v1 only as a proposed push-based invocation route; v1's validation and authorization checks remain binding.

## Problem and scope
ChatGPT's connected GitHub file-write capability may be present while direct workflow_dispatch is absent. A fresh agent-authored git push could provide a controlled invocation path. Only data necessary for the daily TWSE-listed 5% video is in scope; do not fill every repository dataset. Green CI or HTTP 200 never proves valid current-date data.

## Proposed operation (not enabled)
At a scheduled checkpoint, inspect latest main, trading date, source expected-as-of dates and actual daily-video dependency contract. Identify missing/stale datasets and existing queued/running runs, then emit a unique immutable JSON recovery request under recovery-requests/. A permanent narrow path-filtered push workflow receives requests, parses and validates exact schema, ref and allowlist, rechecks live evidence, deduplicates by logical date+dataset, and (only after a separate implementation/authorization gate) uses approved existing crawler/reusable jobs in dependency order. Revalidate produced files, embedded dates and latest pointers. Never treat request content as executable code or a workflow name. No arbitrary user-controlled shell, paths or branch names. Do not duplicate complete/running work. Do not re-create/modify workflow YAML for each request. Do not assume Actions GITHUB_TOKEN pushes trigger other workflows; use explicit reusable job needs, and respect AGENTS.md prohibitions on workflow_run and deployment chaining.

## Safety
No production crawler, cron, publication, Pages, YouTube, video render/upload or research Prompt B is authorized here. M9 Owner Choice A BLOCKED and publication locks remain unchanged. Do not install this experimental push receiver on main until its triggering behavior, branch protection and unrelated existing push workflows are audited. Fail closed on a wrong date, source not published, holiday, invalid schema, stale success, unauthorized dataset, duplicate request, permission failure or unexpected branch/ref. Keep recovery request data-only. Separate the authorization to accept a request from authorization to invoke data collection. Treat contents:read as the experiment's maximum permissions. No secrets in requests.

## Experiment 01: connector push → Actions
Branch: research/daily-data-recovery-v2-exp01-20261013. Receiver: .github/workflows/research-daily-recovery-push-exp01.yml. It listens only for a change under recovery-requests/experiment-01/** on this research branch. It has contents:read, validates an inert JSON probe, produces a step summary, and executes no crawlers, dispatch, writes, deployment or release actions. First commit adds receiver and this document. Second independent ChatGPT Connector create_file commit adds recovery-requests/experiment-01/probe-20261013.json to test whether that push creates a Run. Acceptance: actual push commit SHA, workflow run ID/URL with event=push and matching head SHA/ref, successful completed job and probe schema evidence. Mere commit success is NOT PASS. If no run: inspect workflow presence/trigger filters, token/connector push event and other applicable GitHub restrictions; record BLOCKED, do not invent an ID.

## Promotion gates
After Experiment 01 passes: audit real daily-video dependency mapping, expected-date contracts, side-effect-free entrypoints, trigger topology, existing push workflows on main, allowed caller permissions, idempotency/concurrency and fail-closed tests; owner reviews separately before installing a production dispatcher or modifying schedule. Prefer one permanent path-filtered dispatcher rather than duplicated YAML per missing datum.

## Next action
Inspect the probe commit via GitHub and fetch its associated workflow runs, then evaluate Experiment 01 acceptance and checkpoint evidence. Do not call this a validated production recovery solution.
