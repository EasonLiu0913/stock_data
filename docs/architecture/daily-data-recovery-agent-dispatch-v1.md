# Daily data recovery and GitHub Actions dispatch — Agent contract v1

Status: DESIGN / REFERENCE ONLY. This document does not install or enable a dispatcher, schedule, crawler, or release path.

## Why this exists
An AI agent can inspect missing data without necessarily possessing the capability to start an existing GitHub Actions workflow. A prior research CI run created by a path-filtered push is **not** evidence that its agent can call `workflow_dispatch`. GitHub and the agent have separate execution responsibilities. Every agent must discover its actual connected capabilities and permissions rather than claim an unavailable action was triggered.

## Responsibility boundary
- ChatGPT / other agents: determine target trading date and source publication cadence; read latest main and files; validate actual output; locate exact existing workflow and inputs; detect existing queued/in_progress jobs; request an authorized repair only if an invocation capability exists; report verifiable status and evidence.
- GitHub Actions: execute approved crawlers, serialize work, enforce idempotency, validate dates, record Run IDs, and commit only verified data.
- Preferred future architecture: a single **Daily Data Recovery Dispatcher** with native GitHub `schedule` and optionally `workflow_dispatch` (subject to implementation and owner approval). It should use a fixed allowlist mapping of data types to existing crawler workflows or reusable workflow jobs. This is a proposal, not a claim that the dispatcher exists.

## Mandatory agent decision protocol
1. Fetch fresh remote main SHA; establish Asia/Taipei logical collection date, trading-day/holiday status and individual source publication cycles. Some ETFs disclose holdings less frequently than market data; a source's expected date must be defined explicitly.
2. Read canonical data contract and paths. Check existence, schema, nonempty valid records, embedded source/as-of date, source provenance, and latest pointer. An old file is not valid merely because a crawler returned HTTP 200 or the Action is green. Never overwrite a valid latest pointer with stale output.
3. For each missing datum, identify the **existing** approved workflow file and exact declared inputs from its current YAML; do not guess workflow names or fabricate a dispatch URL. Check the relevant workflow's newest Runs and concurrency. If queued/in_progress for the same logical date, record RUNNING and do not duplicate dispatch.
4. Discover available connector capabilities separately: read runs, `workflow_dispatch` for a fresh run, and rerun existing job are distinct. If direct dispatch is unavailable or permission denied, report DISPATCH_CAPABILITY_UNAVAILABLE or DISPATCH_PERMISSION_DENIED. Rerun is not a substitute for fresh dispatch; a push-triggered research CI is not equivalent to calling dispatch. Do not create empty commits, edit unrelated files, or claim a call happened.
5. If a specifically owner-approved recovery dispatcher already exists, use only its documented entrypoint and allowed data-scope. Otherwise leave a precise handoff: target date, missing dataset, workflow path and inputs, checked in-progress Run IDs, capability blocker, and next GitHub-native scheduled occurrence if verified. Never silently broaden production access.
6. After an actual invocation, record the returned Run ID/URL, workflow ref, SHA, input date and request outcome; distinguish requested/queued/running/completed. On terminal success, re-fetch remote main and validate the **produced data artifact** and its as-of date before COMPLETE. Green CI without current output is STALE_DATA_FAILED or MISSING.
7. Only request missing dependency workflows, in dependency order; prevent repeats with logical-date/data-type keys and existing concurrency. A cycle must end cleanly rather than wait indefinitely in a chat turn. The next native scheduled occurrence or explicitly configured ChatGPT automation may recheck.

## Result vocabulary
COMPLETE: exact expected snapshot validated. MISSING: absent. RUNNING: existing current-date Run. SOURCE_NOT_PUBLISHED: official source not due. NON_TRADING_DAY: verified calendar says no trade and source policy matches. STALE_DATA_FAILED: success/200 but as-of date fails. FAILED: verified failed workflow or invalid new content. BLOCKED: dependent evidence or authorization absent. DISPATCH_CAPABILITY_UNAVAILABLE and DISPATCH_PERMISSION_DENIED: explicit invocation limitations. UNKNOWN: not yet verifiable; never imply success.

## Proposed recovery architecture (not implemented)
Agent check → repository data/expected-date validator → allowlisted missing-data plan → native GitHub scheduled/authorized dispatcher → existing crawler/reusable jobs → post-run validation → data-only handoff/status report. Validate workflow path and inputs against current main before any request. Use minimal `actions:write`/workflow permission only in the dedicated service that truly needs it; keep read-only agents read-only. Separate data recovery from publication, video, YouTube, Pages, and unrelated research. A dispatcher must fail closed if a dependency, authorization, logical date, publication status, or mapping is uncertain. Centralize de-duplication, concurrency, branch policy, bounded retries and evidence logging; do not build a speculative cross-project orchestration framework.

## Existing repo-specific cautions
- Check `data_daily_gain_over_5/` and the respective workflow/contract for list, news, facts, AI and unified/final outputs. Do not assume their cadence is identical.
- `.github/workflows/publish-daily-gainers-ai-analysis.yml`, `publish-daily-gainers-news-summary.yml` and `publish-daily-gainers-unified-analysis.yml` currently declare `workflow_dispatch` with date inputs, but these are publication-related and **not** generic crawler dispatchers. Inspect the current YAML, permissions and side effects; do not automatically invoke them as missing-source crawlers.
- `deploy-pages.yml` has a separate publishing role. Do not accidentally trigger or accelerate an early global deployment ahead of finalized news summary.
- `crawl-pocket-00981a.yml`: do not treat an old holdings date as today's holdings; separate holdings release cycle from industry breakdown.
- Video, M9 owner choice A BLOCKED, TTS, render, cron, Pages, YouTube and any publication or phase gates are unaffected by this document and remain under their independent authorizations.

## Minimum final report
Main SHA; Taiwan logical date and trading calendar; per-source expected as-of date; dataset/status and evidence path; missing dependencies; workflow YAML/inputs (if applicable); existing Run IDs; actual requested dispatch with new Run ID if any; post-run artifact validation; blocker/next allowed recheck. If no invocation capability, state that clearly and do not substitute a fake success.

## Adoption gate
Before implementation, inventory actual workflow→output mapping, current dependencies, data publication times, available GitHub connector actions, and any desired owner-approved write permission. Preregister fail-closed tests covering duplicate Runs, wrong dates, holidays, delayed sources, stale 200/success, missing tools, permission denied and unintended Pages/video activation. Document review alone does not authorize a new dispatcher or any Actions execution.
