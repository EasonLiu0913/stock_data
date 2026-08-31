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

### Intermediate gates are not Prompt A completion points

A Prompt A may contain preflight, regression, sample-freeze, permission, readiness, syntax, or other intermediate gates. Passing one of those gates is progress inside Prompt A unless the prompt explicitly defines that gate as the round boundary.

- Do not stop a Prompt A merely because an intermediate gate passed when later ordered Prompt A work remains.
- A progress report after an intermediate gate must say clearly that it is **intermediate status**, that Prompt A is **not complete**, and whether execution is continuing.
- Do not use wording such as “done”, “finished”, “complete”, “ready for Prompt B”, or equivalent until the Prompt A completion contract is actually satisfied.