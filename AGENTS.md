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

## Goal-Anchored Handoff v3 (mandatory for every registered project)

Read `docs/agent-prompts/goal-anchored-handoff-v3.md` before any project Prompt A/B. Every globally routed project must preserve an owner-governed ultimate goal (Project Charter), ordered small-goal Phase Roadmap, and preregistered immutable paired A/B verification. The canonical routing registry is `docs/agent-prompts/task-routing.json`; the legacy navigation index is `docs/agent-prompts/goal-anchored-legacy-index-v3.json`. This v3 governance applies to ALL existing projects now, without rewriting historic closeout claims or reopening completed projects. Unreconstructed legacy goals block speculative new implementation until verified from original canonical handoff. Every closeout must trace results to ultimate goal, report remaining phases and explicitly preserve stop conditions. Scope or acceptance changes require owner-approved versioned CHANGE_PROPOSAL; a failed Prompt B may never be retroactively weakened. One active global project, no automatic Prompt A on activation. Existing paired-prompt and research safeguards continue unchanged.

## Autonomous handoff state diagnosis and bounded resumption (mandatory)

On **every** `promptA` or `promptB`, inspect current remote `main`, the unique active project, its immutable charter, current phase/round, original paired A/B, durable artifacts, workflow runs and dependencies. Decide and explicitly report the **correct next action**, even when the owner issued the other command. Do not require the owner to name M1/M2, say `resume`, identify a workflow, or reconstruct prior work.

A `BLOCKED`, `WAITING_*`, canceled, incomplete, or interrupted Prompt A remains resumable by bare `promptA` **inside its original frozen scope** once the blocking condition is cleared; first recheck actual evidence, avoid repeating already durable successful steps, and resume only missing work. A blocked A is not A COMPLETE and never makes B eligible. If the owner sends `promptB` while A is incomplete, **diagnose and direct to `promptA`**, but do not silently execute A instead. If the owner sends `promptA` while A is complete/B is pending, **direct to `promptB`**, but do not execute B automatically. If B fails, bounded repair/reverification is governed by the same original B criteria; never lower or replace its acceptance.

Waiting must name the exact external dependency (workflow name/URL/run/job, next natural scheduled occurrence/date/time or source evidence) when verified, explain the observation condition, and state whether the owner must act. Never manufacture a wait time or claim passive/background execution: a new owner command, native GitHub scheduled workflow, or explicitly configured automation is needed for future reevaluation. For a payment, credential, external permission, research gate, scope change or owner decision, stop with precise required action, not an invented workaround. For completed goals stop and offer existing pending-project routing only with authorization.

Every response must include: active project/goal version; ultimate goal progress; current phase/round and A/B eligibility; completed vs remaining phases; blocker and evidence; recommended **next command/action**; whether automatic continuation is permitted; plan changed? yes/no. Progress through phases is **multi-invocation**, not an uninterrupted assistant background loop: after A complete stop for explicit B, after B PASS promote only the next preregistered phase and stop for explicit A. Owner may switch Active project at any time; preserve old project checkpoint. See `docs/agent-prompts/goal-anchored-handoff-v3.md`.

## Mandatory end-of-response next-action card (all Handoff A/B turns)

After EVERY Handoff-related response, including success, blocked, waiting, ineligible command, failure, or ultimate COMPLETE, show a **compact final action card** as the LAST user-facing section, using the client-supported interactive components when available. The card must include current Active project label and state, current phase and A/B status, one short evidence-grounded blocker or result, and the correct next step. When the next permitted step is `promptA` or `promptB`, offer a **real clickable button** labeled `繼續 Prompt A` or `執行 Prompt B`, respectively. A click submits exactly that short command as a **new user turn** through supported native user-triggered UI actions (e.g. `GenUI.issueNewTurn("promptA")` or `GenUI.issueNewTurn("promptB")`), so all fresh-main routing, gates and eligibility checks repeat. Never represent a textual label or inert mock button as interactive. Never claim the button already executed anything.

Show a button ONLY for an actually eligible or resumable next step. For `WAITING_WORKFLOW`, `WAITING_SCHEDULE`, `WAITING_SOURCE`, `WAITING_OWNER`, or `WAITING_PERMISSION`, prominently name the unmet prerequisite and precise user action. A retry/recheck Prompt A button may be offered if bare A is genuinely authorized to reassess new evidence, but label it as **重新檢查／繼續 Prompt A** and explicitly explain it cannot clear an unchanged external gate. If a verified workflow URL or permission page is known, a supported link to that page is preferable to a fake execution button. On ultimate goal COMPLETE, do not offer an A/B execute button; show completion and the owner-authorized project-switch step.

This requirement is **presentation**, not a change to any charter, immutable paired acceptance, automatic background execution, or promotion rule. The repository cannot force all third-party Agent UIs to support clickable controls: in plain-text clients provide an equivalent clearly delimited final next-action panel with the exact command and honest statement that it must be entered manually. All actions must be direct user clicks, not programmatic self-triggered turns. Keep the detailed verification evidence in the response above the card; the card is only the concise operational summary.

## Next-action UI capability contract

At the end of each Prompt A/B response, check whether this chat client actually exposes a supported user-clickable action control. If it does, show exactly one real action for the eligible next command and require a fresh user-triggered turn. **Never print pseudo-buttons** such as `[繼續 Prompt A]` or `[執行 Prompt B]` when no interactive control is available: bracketed labels are not buttons. If unsupported, show a clear, compact **下一步操作** section with a copyable literal `promptA` or `promptB` and explicitly say this client cannot render a real send-command button. Do not invent an API such as `GenUI.issueNewTurn`; use it only if genuinely available in the executing client. If blocked on owner action, source, workflow, or permission, name the blocker and avoid a misleading repeat-action recommendation. Repository markdown cannot add native ChatGPT UI controls. Preserve all existing A/B gates and owner-trigger requirements.

## Repository short commands: `promptA` / `promptB`

The repository owner may invoke the paired-prompt lifecycle with the short commands `promptA` or `promptB` instead of pasting the full generic runner instructions into chat.

These short commands are routing commands only. They never replace the phase-specific Prompt A / Prompt B that must remain preregistered in the canonical handoff.

Canonical runner protocols:

- `promptA` → root entry point `promptA.md` → `docs/agent-prompts/prompt-a-runner.md`
- `promptB` → root entry point `promptB.md` → `docs/agent-prompts/prompt-b-runner.md`

When the owner sends exactly `promptA` or `promptB`, case-insensitive after trimming surrounding whitespace:

1. Fetch current remote `main` before relying on repository state.
2. Read this `AGENTS.md`.
3. Read the corresponding runner protocol above.
4. Resolve the current canonical handoff and round identity from durable repository state.
5. Execute only the phase-specific Prompt A or Prompt B selected by that runner protocol.

Important selection invariant:

- `promptA` selects the explicitly active/promoted round whose Prompt A has not completed; it must not execute a future preregistered round while a closeout is pending.
- `promptB` selects the most recent round whose Prompt A is complete but whose corresponding Prompt B does not yet have durable PASS evidence, and must recover the Prompt B preregistered for that same round before Prompt A began.
- Never select Prompt A or Prompt B merely because it is the last one in a handoff document.
- Conversation history, agent summaries, green CI, and prior completion messages are not substitutes for current remote and durable repository evidence.

The detailed startup, freshness, failure, PASS, handoff, promotion, and stop rules live in the runner protocol files and are mandatory when these short commands are used.

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

## Chat-only Handoff v3 UI and no-deployment boundary (owner decision 2026-10-09)

The owner explicitly cancelled the **Handoff Control UI / MCP Apps / standalone website deployment track**. Stop that work completely; do NOT deploy or prepare deployment of a website, Vercel project, MCP server, ChatKit frontend, tunnel, or third-party interface for Handoff, and do not suggest resuming it unless the owner explicitly asks. Previously generated prototype archives are inactive reference artifacts only, not an active phase. This restriction is specific to the Handoff-control UI track and must **not** inadvertently disable the stock_data project's independently authorized existing GitHub Pages/video publishing workflows.

All Handoff control and A/B interaction stays inside the current ChatGPT conversation, using the existing connected GitHub tools to inspect/update actual remote state. A text-only chat cannot invent a native click-to-send button: when unavailable, end with an honest, compact copyable command (e.g. `promptA`, `promptB`) and never render bracketed faux-buttons. Avoid repeated blocked retries: diagnose whether evidence, CI status, owner action, or permission really changed and perform useful bounded eligible work; if no progress is possible, state the single concrete external dependency instead of encouraging repeated identical commands. The one-Active rule, paired A/B gate, original immutable acceptance, and fresh-main checks remain mandatory.

## Handoff progress visibility: blocker plus planned research direction

Every Handoff v3 phase status and final next-action card MUST state both **目前阻礙** (current blocker, with missing evidence) and **預計研究方向** (specific, falsifiable next investigation). Also report what differs from the previous attempt and a stop/pivot rule. Store machine-readable progress at `docs/handoffs/state/<active-task-id>.json` with `phase`, `a_status`, `b_status`, `current_blocker`, `planned_research`, `prior_attempt`, `anti_loop`, and `evidence`. Treat this JSON as a progress *index*, not proof of acceptance: canonical handoff plus independent verified source/test evidence remain authoritative. Never mark tests PASS based on JSON claims. If proposed research repeats an attempt without new input, report STALLED/WAITING_SOURCE and a changed method or exact owner dependency, rather than recycling the same Prompt A. No external service or deployment is authorized by this addition.


## Explicit next-step instruction

The final Handoff status card must show **下一步指令** after 目前阻礙 and 預計研究方向. Recommend exactly one of `promptA`, `promptB`, or a precise prerequisite action such as 查看 Workflow、提供歷史資料、授權權限、等待新證據. Only recommend A/B if genuinely eligible and useful. For unchanged BLOCKED state with no distinct work, do not suggest circular promptA retries. No faux clickable buttons.
