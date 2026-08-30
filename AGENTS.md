# AGENTS.md

This file defines mandatory repository-level instructions for coding agents working in `EasonLiu0913/stock_data`.

## Project philosophy

Before making a substantial architecture, research, strategy, backfill, workflow, or shared-framework decision, read:

1. `docs/project-philosophy.md`
2. `docs/roadmap/current-phase.md`
3. The relevant `docs/architecture/**` document
4. The relevant `docs/research/**` document
5. Applicable `docs/decisions/ADR-*.md`

All implementation must follow the project philosophy:

> **Let evidence drive evolution.**  
> **Build platforms from proven patterns, not predicted needs.**

Mandatory interpretation:

- Evidence before Strategy.
- Evidence before Abstraction.
- Research before Automation.
- Extract shared platform capabilities only after real repeated use cases demonstrate the pattern.
- Prefer one source of truth for core concepts.
- Preserve traceability/version identity for important strategies, schemas, registries, and research methodology.
- Prefer small validated evolution over speculative large redesigns.
- Optimize for maintainability, observability, and reproducibility rather than cleverness.

Before introducing a major feature or abstraction, answer:

1. What real problem does this solve now?
2. Is this the first use case, or is there repeated evidence of the same need?
3. Should this remain domain-specific, or is there enough evidence to promote it into a platform capability?
4. Which architecture, research, roadmap, or ADR document must be updated with the change?

See `docs/project-philosophy.md` and `docs/decisions/ADR-000-project-philosophy.md` for the canonical rationale.

## Mandatory documentation handoff

The documentation is a living project handoff. Do not rely only on prior chat history when the repository documents contain the current decision or roadmap.

When a major architecture decision, research conclusion, rejected approach, or active development phase changes, update the corresponding document in the same development cycle.

## Phase handoff checkpoints

Every multi-step task, investigation, research thread, backfill, workflow migration, or other effort that is expected to continue across rounds should remain ready for another agent to take over the next round without requiring the user to reconstruct the history manually.

A handoff is a fast path into the current state, not a restriction on how an agent may investigate. A new agent may still search the repository from scratch, independently verify assumptions, or challenge prior conclusions when useful. The requirement is that the repository itself preserves enough current state that continuing from the prior round is possible immediately.

### When to checkpoint

Before beginning the next meaningful round or phase, update and commit the canonical handoff whenever the previous round materially changed any of these:

- current understanding of the problem;
- root-cause evidence;
- architecture or implementation decisions;
- frozen constraints or research rules;
- completed code/workflow/data changes;
- known failure modes or rejected approaches;
- current repository entry points;
- next-round objective or execution order.

Do not update the handoff for every mechanical request, every individual batch, or every trivial commit. Checkpoint at meaningful phase boundaries: investigation → fix, fix → validation, validation → next coverage wave, research → implementation, implementation → rollout, and similar transitions.

### Canonical handoff location

Prefer an existing project-specific handoff when one already exists. Long-running research or domain projects should keep their handoff close to the project, for example:

```text
data_research/<project>/<project>-handoff.md
```

Existing project-specific handoffs remain canonical and should not be duplicated elsewhere.

If no project-specific handoff exists, create one under:

```text
docs/handoffs/<task-or-project-name>.md
```

The handoff must state its own canonical repository path near the top so the user and future agents can reference it unambiguously.

### Required handoff contents

A canonical handoff should contain, as applicable:

```text
# Task / project name

Canonical handoff: <repo path>

## Current phase
## Objective
## Frozen decisions / constraints
## Completed
## Evidence / validation
## Current repository state
## Known problems / rejected approaches
## Entry points
## Next round
## Safety / stop conditions
## Prompt A — Next-round implementation prompt
## Prompt B — Next-round closeout / verification prompt
```

`Entry points` should name the scripts, workflows, directories, functions, or documents most likely to matter next. This is meant to save rediscovery time, not to forbid broader repository search.

### Exact entry-point paths are mandatory when known

A handoff or paired prompt must not make the next agent rediscover repository locations that the current agent already knows.

- When the exact repository location of a relevant script, workflow, config, fixture, test, generated contract, document, or other entry point is known, write the exact repo-relative path in the handoff and in the next-round prompt when that file is needed there.
- Do not substitute a conceptual name such as “the frozen lifecycle classifier”, “the regression fixtures”, or “the validation workflow” for an already-known path.
- When several files jointly define a contract, list each material path and state its role so the next agent knows which file is executable code, which is a preregistered spec, which is a regression/contract harness, and which is durable expected evidence.
- When a stable function, symbol, command, workflow job, or fixture identifier materially reduces rediscovery, include it as well as the file path.
- Use instructions such as “locate”, “find”, or “search for” an entry point only when its exact path is genuinely unknown or has not yet been verified. In that case, say explicitly that the path is not yet verified rather than implying rediscovery is required by design.
- Before committing a handoff, review `Entry points`, `Next round`, Prompt A, and Prompt B for vague references that can be replaced by exact known paths.

A handoff is incomplete if it knowingly sends the next agent searching for an entry point that could have been named directly. Repository search remains available for independent verification, but it must not be used as a substitute for documenting known locations.

`Evidence / validation` should include useful commit SHAs, workflow run IDs, test results, representative diagnostics, or other concrete evidence when available.

`Next round` should be executable and ordered. Avoid vague entries such as "continue investigating" when the next concrete checks are already known.

### Paired implementation + closeout prompts

Every active handoff checkpoint must preserve **two** ready-to-copy prompts for the following round.

- **Prompt A — Next-round implementation prompt** defines startup, planned work, frozen constraints, safety rules, and the meaningful phase boundary.
- **Prompt B — Next-round closeout / verification prompt** must be written **before Prompt A is executed** and defines how that round will be independently verified before it can close.

Prompt B must be phase-specific, not a generic "check the result" instruction. As applicable, predefine the commits, workflow runs/jobs, physical-batch boundaries, request caps, jitter/cooldowns, durable checkpoints, race-safe push behavior, response-quality diagnostics, regression tests, coverage/audit counts, forbidden artifacts, deployment state, or other invariants that must be checked.

The intended lifecycle is:

```text
Handoff N
│
├─ Prompt A
│   Next-round Implementation Prompt
│
└─ Prompt B
    Next-round Closeout / Verification Prompt
        ↓
Agent executes Prompt A
        ↓
work / workflow completes
        ↓
user sends Prompt B to the agent
        ↓
agent performs phase-closeout review
        ↓
problems found?
├─ yes
│   ↓
│   fix / bounded rerun
│   ↓
│   repeat Prompt B verification
│
└─ no
    ↓
update canonical handoff
    ↓
commit handoff
    ↓
verify current main has not made handoff stale
    ↓
produce:
    Prompt A(N+1)
    Prompt B(N+1)
    ↓
stop
```

The closeout gate is mandatory:

- If Prompt B finds an important failure, lost checkpoint, stale assumption, safety violation, incomplete workflow, or missing evidence, do **not** proceed as if the phase were clean. Fix or bounded-rerun only what is needed, then repeat closeout verification.
- If a preregistered research gate such as a coverage/sample-freeze gate is reached, record and commit that gate at the phase boundary and **stop before opening the next evidence class in the same round**. Reaching sample freeze does not authorize that same round to inspect untouched outcomes.
- The final closeout response must provide both Prompt A and Prompt B for the next round, and the canonical handoff must preserve both as durable repository state.
- Do not begin Prompt A(N+1) merely because it was generated unless the repository owner explicitly asks to continue.

This paired-prompt rule preregisters verification criteria before work starts and prevents a successful-looking implementation summary from substituting for a real phase-closeout review.

### Intermediate gates are not Prompt A completion points

A Prompt A may contain preflight, regression, sample-freeze, permission, readiness, syntax, or other intermediate gates. Passing one of those gates is progress inside Prompt A unless the prompt explicitly defines that gate as the round boundary.

- Do not stop a Prompt A merely because an intermediate gate passed when later ordered Prompt A work remains.
- A progress report after an intermediate gate must say clearly that it is **intermediate status**, that Prompt A is **not complete**, and whether execution is continuing.
- Do not use wording such as “done”, “finished”, “complete”, “ready for Prompt B”, or equivalent until the Prompt A completion contract is actually satisfied.
- If an intermediate gate fails, stop only as required by that gate's safety rule; do not silently skip the remaining work or reinterpret the failed gate as completion.
- Paired Prompt B must not be invoked merely because Prompt A reported an intermediate PASS.

When Prompt A has multiple ordered stages, the expected behavior is:

```text
intermediate gate PASS
→ continue remaining Prompt A stages
→ satisfy implementation / workflow / artifact contract
→ verify current durable repository state
→ explicitly report "Prompt A complete — ready for Prompt B"
→ stop
```

A handoff should state the Prompt A completion contract explicitly when the round has non-trivial intermediate gates.

### Writer workflow green is not durable completion

For any workflow or implementation round expected to create, update, checkpoint, or push repository state, a green GitHub Actions conclusion is **not sufficient evidence of completion**.

The round is durably complete only when every required output named by the prompt/workflow contract has been verified on the remote repository state that future agents will read.

As applicable, verify all of the following after the write step:

1. the expected artifact/file was generated;
2. the expected artifact/file was staged or otherwise included in the bounded write set;
3. a commit containing the expected change exists;
4. the push/checkpoint actually succeeded;
5. after fetching current `origin/main`, every expected repo-relative path exists on remote `main`;
6. the remote blob/content has the required methodology, sample/version identity, date/range, schema, or other contract markers;
7. the expected commit/run/artifact identity is recorded in the handoff or closeout evidence.

If a writer logs success or exits `0` while expected durable outputs are absent from remote `main`, treat that as a **green-but-incomplete plumbing failure**, not as successful completion. Fix the bounded write/checkpoint defect and rerun the affected writer before Prompt B can pass.

Where a workflow has known canonical output paths, prefer an explicit final remote verification step. Missing required remote artifacts must fail the workflow rather than leave a misleading green run.

This rule applies especially to sparse checkout, bounded checkpoint helpers, generated files outside the checkout cone, push races, and any workflow whose analysis can succeed while persistence silently does nothing.

### Copy-paste next-round prompt

Every active handoff must end with the paired Prompt A / Prompt B package defined above. Prompt A continues implementation; Prompt B performs closeout/verification after that work finishes.

The prompt must be self-guiding. Do not assume a new agent already knows this repository's handoff rules or other repository-level instructions. The prompt must explicitly instruct the receiving agent to read the repository-root `AGENTS.md` first, then read the canonical handoff, then verify the current `main` state before continuing.

Use a structure like:

```text
Continue the <task/project> in repository `EasonLiu0913/stock_data`.

Before doing any work:
1. Read the repository-level instructions in `AGENTS.md`.
2. Read the canonical handoff for this task: <canonical handoff path>.
3. Verify that the current `main` branch still matches the commits, workflows, files, and assumptions referenced by the handoff.
4. Continue from the handoff's `Next round` section.

You may independently search the repository, re-check implementation details, or challenge previous conclusions when useful. The handoff is intended to provide a ready-to-continue state, not to prevent fresh investigation.

Preserve all frozen decisions, research constraints, safety rules, physical-batch requirements, and stop conditions unless new evidence clearly requires revisiting them.

Next focus: <explicit next-round objective>

Before starting another major round or phase:
- update the canonical handoff with what was completed;
- record important evidence, commits, workflow runs, failures, and changed understanding;
- update `Current phase`, `Current repository state`, `Entry points`, and `Next round`;
- update Prompt A for the following round;
- update the phase-specific Prompt B closeout criteria for the following round;
- commit the handoff to the repository.

Do not rely on private conversation history as the only record of project state. Keep the repository handoff ready for either the same agent or a new agent to continue from the next phase.
```

If the next round has a specific action, include it explicitly rather than leaving only the placeholder. For example:

```text
Next focus: audit historical HiStock source_empty checkpoints created by old long-running runners, classify ambiguous degraded responses, and requeue only unsafe negatives through the fresh-runner physical-batch workflow.
```

The prompt should be usable without relying on private chat history, and it must carry forward the requirement to create the next handoff checkpoint before another major phase begins.

### Handoff commit expectations

The handoff must be committed to the repository before the next major round begins when a checkpoint is required.

Preferred commit-message shape:

```text
docs: checkpoint <task> handoff
```

It is also acceptable to include the handoff update in the final implementation or validation commit of the round when that keeps the repository state atomic.

A conversation summary alone is not a durable project handoff. Important continuing state should live in the repository so another conversation or agent can inspect it directly.

### Research-first architecture rules

- New data or a promising backtest must not directly become a production strategy.
- Research should proceed through historical validation, baseline-relative ranking, stability, industry analysis, and market-regime analysis before explicit strategy promotion.
- Market environment is research/dashboard context only. It must not gate a fixed strategy, hide otherwise matching stocks, or make a strategy disappear.
- Historical stock-price research should use the unified price provider rather than adding new direct legacy price-source dependencies.
- Long historical backfills must prefer checkpoint/resume behavior, and recurring research updates should prefer incremental monthly detail generation over unnecessary full-history recomputation.
- Baseline choice must be explicit: broad factor research compares with the same-month listed-stock universe; industry conclusions compare with the same-month same-industry universe.

See `docs/README.md` and `docs/decisions/` for rationale and details.

## Safe large-fetch architecture: plan + fresh-runner physical batches

These rules are mandatory for any large crawl, backfill, historical repair, multi-stock fetch, coverage expansion, or other workflow that can issue many requests to the same external server.

Whenever the repository owner asks for **plan + batch**, interpret that phrase as this architecture by default. A `for` loop with a small `batch_size` inside one long-running GitHub Actions job is **not** sufficient.

### Required execution model

Use this sequence unless the source has already been proven safe under a stricter documented alternative:

```text
plan
→ deterministic bounded queue
→ split queue into physical batches
→ fresh GitHub runner for batch 0
→ checkpoint / push progress
→ runner exits
→ cooldown
→ fresh GitHub runner for batch 1
→ checkpoint / push progress
→ runner exits
→ ...
→ re-plan from committed state
→ continue remaining batches
```

A physical batch means a separate GitHub Actions job / runner lifecycle. The purpose is to reset the runner process, HTTP connection pool, cookies/session state, DNS/network path, and other long-lived request behavior between batches.

Do **not** treat either of these as equivalent to a physical batch:

```text
one job → loop batch 0 → sleep → loop batch 1 → sleep → loop batch 2
one runner → many requests with only per-request jitter
```

Those patterns may still accumulate server-side throttling or soft-block state even if the code calls them "batches".

### Planner requirements

Before fetching, create a deterministic plan from source-derived or otherwise preregistered inputs. The planner must:

- define the bounded universe / date range / stock set before requests begin;
- calculate the missing work from committed repository state;
- never cherry-pick successful cases based on outcomes;
- produce an explicit queue or matrix that can be inspected before execution;
- cap work per workflow run;
- define `batch_size` explicitly;
- preserve deterministic ordering unless randomized ordering is explicitly required for network safety;
- make re-planning idempotent so completed checkpoints disappear from the next queue;
- support resume after cancellation, runner failure, or partial completion.

For research workflows, planning must remain outcome-blind when the research contract requires it.

### Physical batch defaults

Unless the source-specific workflow documents a safer tested value:

- Use `strategy.max-parallel: 1` for matrix jobs that hit the same external source.
- Keep each physical batch small. For HTTP page scraping, start around 1–5 requests per runner rather than dozens or hundreds.
- Use randomized per-request jitter inside a batch.
- Use a randomized cooldown between physical batches.
- End the runner after the batch instead of keeping one runner alive for the whole queue.
- Re-checkout the latest committed `main` at the start of each new physical batch.
- Commit/push a checkpoint after each batch when the workflow writes repository data.
- Keep write-layer concurrency non-canceling: `cancel-in-progress: false`.

Example shape:

```yaml
jobs:
  plan:
    # produce matrix JSON from committed state

  fetch:
    needs: plan
    strategy:
      max-parallel: 1
      matrix: ${{ fromJSON(needs.plan.outputs.matrix) }}
    runs-on: ubuntu-latest
    steps:
      - checkout latest main
      - randomized physical-batch cooldown
      - fetch only this bounded batch
      - validate response quality
      - checkpoint and push
```

If one physical batch contains several requests, still add a small randomized delay between requests. The batch boundary does not replace request-level pacing; both are required.

### Fresh-runner requirement

For a source that has shown throttling, incomplete responses, connection degradation, or anti-bot behavior, every physical batch must use a fresh runner by default.

Do not "optimize" the workflow back into one long-running job merely to reduce Actions startup overhead. Server reliability and data correctness take priority over a few extra runner startups.

If a later optimization proposes reusing one runner across many batches, it must first demonstrate with diagnostics that response quality does not deteriorate over time and document that evidence.

### Response-quality guardrails and soft-block detection

HTTP `200` is not sufficient evidence that a request succeeded correctly.

Large-fetch code must record enough diagnostics to detect a soft block or degraded response, for example:

- HTTP status;
- final URL / redirects;
- response byte size;
- requested date / stock visibility;
- expected source keywords;
- table row count / record count;
- known structural markers or sentinel records when available;
- parser completeness / incomplete-record count.

If the source normally returns a materially larger document or populated table and a later request suddenly returns a much smaller response or header-only table, classify that as a suspected extraction / throttling failure first. Do not immediately persist it as genuine source-empty data.

In particular, a result such as:

```text
HTTP 200
requested date visible
response materially smaller than normal
table_rows = 1 (header only)
```

must not automatically become terminal `source_empty` when the source may be soft-blocking or returning a degraded page.

Terminal negative evidence should require an explicit, trustworthy source-side empty signal or another validated rule. Ambiguous degraded responses must remain retryable/reviewable and should be retried later in a fresh-runner physical batch.

### Failure memory and checkpoint rules

Every batch must distinguish at least:

- success;
- confirmed source-empty / terminal negative;
- transient network or server error;
- suspected extraction / soft-block failure;
- permanent quality failure when genuinely non-retryable.

Persist enough status to avoid blindly repeating confirmed terminal negatives, but do not let a suspected soft block permanently poison the queue.

A successful later fetch must override an earlier ambiguous failure for the same source key/date.

Checkpoint behavior must be concurrency-safe:

- completed files already on remote `main` win;
- after a push race, fetch the latest `main`, reset/replay safely according to the repository's checkpoint helper, and replay only files still absent;
- do not use an add/add-prone blind `git pull --rebase` pattern for append-only checkpoint files;
- a cancelled workflow must be able to resume from committed checkpoints without restarting the entire range.

### Re-plan between waves

After a bounded wave of TDCC, Broker, market, or other source fetches finishes, re-run the planner against the newly committed state before scheduling more work.

Do not precompute one enormous static request list and execute it for hours. Prefer:

```text
plan wave
→ physical batches
→ checkpoint
→ re-plan
→ next wave
```

This reduces duplicate requests and lets newly satisfied coverage gates remove unnecessary work.

### Evidence from the HiStock validation incident

This rule is based on observed repository behavior, not theory.

During institutional-withdrawal validation coverage, a long-running Broker job initially fetched HiStock normally but later returned degraded pages. One known-positive `1598 / 2026-05-07` request returned approximately 69 KB with only `table_rows = 1` and was incorrectly classified as `source_empty`, even though the browser showed a populated broker table.

A diagnostic using fresh-runner physical batches fetched the same known-positive page repeatedly with approximately 90 KB responses, `table_rows = 16`, and the expected broker rows. The production recovery workflow was then changed to true physical batches. Broker batches at the beginning, middle, and end of the run continued returning populated ~90 KB pages with 16 rows, including the final batch, instead of degrading late in the run.

Therefore the repository-level default is:

> **Large external-source fetches use plan + bounded queue + fresh-runner physical batches + jitter + cooldown + checkpoint + re-plan/resume.**

This is the required meaning of **plan + batch** for future work unless the repository owner explicitly asks for a different execution model or a source-specific documented test proves another model equally safe.

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

## Workflow concurrency layering

Concurrency rules are intentionally different for repository/data writers and for the final Pages publication layer.

### Data / repository write layer: never cancel in progress

Any workflow that may persist repository state is a write-layer workflow. This includes workflows with any of these characteristics:

- `permissions: contents: write`;
- `git commit`;
- `git push`;
- checkpoint commits during crawls, prediction, replay, research, normalization, or backfills.

If such a workflow uses a concurrency group, it must use:

```yaml
cancel-in-progress: false
```

It may omit cancellation when no shared serialization group is required, but it must not use `cancel-in-progress: true`.

Reason: generated or validated data may still exist only on the runner before the final push. Cancelling the writer can discard that uncommitted progress.

### Pages publication layer: stale runs should be cancelled

The canonical `.github/workflows/deploy-pages.yml` is a publication-only workflow. It must:

- never commit or push repository data;
- checkout `ref: main` before packaging;
- use the shared `github-pages` concurrency group;
- use `cancel-in-progress: true`.

Required configuration:

```yaml
concurrency:
  group: github-pages
  cancel-in-progress: true
```

Because every Pages run rebuilds from the latest committed `main`, cancelling an older Pages-only run cannot remove committed data. A newer run simply rebuilds and publishes the newer complete `main` state.

The required boundary is:

```text
generate / validate / commit / push main
→ non-cancelable data-write layer

checkout latest main / package / upload / deploy Pages
→ cancelable publication layer
```

A Pages job must remain downstream of the successful data-writing job, normally through `needs:`. Never move repository writes into `deploy-pages.yml`.

The repository-wide guard is:

```text
node scripts/audit_workflow_deployment_races.js --self-test
node scripts/audit_workflow_deployment_races.js
```

It scans every `.yml` / `.yaml` file in `.github/workflows`, not only currently known Pages callers.