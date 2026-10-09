# Prompt B Closeout Runner Protocol

Canonical repository command: `promptB`

This file defines the repository-level execution protocol for the short owner command `promptB`.

It is a **closeout runner protocol**, not the phase-specific acceptance contract. The actual Prompt B must come from durable repository history and must have been preregistered before the corresponding Prompt A began.

## V3 goal-anchored closeout (mandatory)

Before closeout read `docs/agent-prompts/goal-anchored-handoff-v3.md` and `docs/agent-prompts/goal-anchored-legacy-index-v3.json`, recover the active project's original Project Charter version/Phase Roadmap and phase-specific preregistered Prompt B. Verify not only the local CI outcome but the current small goal's deliverable and contribution to the original end-to-end objective. Preserve historic phase acceptance and never mark the whole project complete before its ultimate acceptance gate. Report `Ultimate goal progress / Completed versus remaining phases / Blockers / Next phase ID / Plan changed?`. Unapproved changes to scope or acceptance require a blocked CHANGE_PROPOSAL rather than rewritten PASS. Future phases never run automatically.

## Global task routing

Canonical routing registry:

`docs/agent-prompts/task-routing.json`

Repository-wide invariant:

- at most one task may have `state: active`;
- any number of tasks may have `state: pending`;
- activating one task must demote every other task to `pending` in the same routing update;
- creating/registering a new task as `active` must demote the previously active task to `pending`;
- `pending` preserves the project's internal round, closeout, sample-freeze, and handoff state;
- routing changes do not execute Prompt A or Prompt B by themselves.

When the owner invokes `promptB` without naming a project, use the unique task marked `active` in `docs/agent-prompts/task-routing.json`.

Do not infer the active task from conversation history, handoff recency, document position, or which handoff contains a pending closeout.

If the registry has zero active tasks or more than one active task, do not execute closeout. Report the routing defect and repair it only when repository rules and owner intent make the correct active task unambiguous.

## Mandatory startup

When the repository owner sends exactly `promptB` (case-insensitive after trimming surrounding whitespace), execute this protocol.

1. Fetch current remote `main`. Do not reuse local state, prior conversation state, summaries, or a previously read handoff as authoritative state.
2. Read repository-root `AGENTS.md`.
3. Read `docs/agent-prompts/task-routing.json` from current remote `main`.
4. Verify the global routing invariant and resolve the unique `active` task.
5. Read `docs/project-philosophy.md` and `docs/roadmap/current-phase.md` when required by `AGENTS.md` or the active task.
6. Read the canonical handoff path recorded for that active task in the routing registry.
7. Find the most recent round inside that handoff whose Prompt A is complete but whose corresponding Prompt B closeout does not yet have durable PASS evidence.
8. Recover the Prompt B that was preregistered for **that same round before Prompt A began**.

## Last-section next-action rendering

Every result ends with the active project, current phase, blocker, and exact eligible next action. Render a clickable next-command button only through a real supported user-triggered client control; otherwise output a copyable command as text and do not print a simulated `[執行 Prompt B]` button. If B is not eligible, explain the missing A prerequisite and avoid implying that B was executed.

## Readiness diagnosis and correct-command guidance

The user does not need to know the phase ID or whether A or B should run. Before closeout, inspect current remote charter/roadmap, canonical handoff, pre-A original B, and actual artifact/workflow evidence:

- A **not complete** / `BLOCKED` / `WAITING_*`: **do not run B** and do not silently invoke A. Identify A's checkpoint and blocker, check whether its external dependency has changed, then report `NEXT_COMMAND: promptA` if resumable, or a concrete owner action/verified workflow trigger if not. Do not claim this is a failed B closeout, because B is not yet eligible.
- A **durably complete**, B not PASS: execute this round's preregistered B and verify every unchanged criterion against current remote main. If waiting for a workflow, name verified run/job/status and expected artifact; if a bounded defect can be fixed under original B, rerun complete verification. If a permission/owner decision is needed, stop with specific instructions.
- B already PASS and next phase promoted: do not repeat B; report `NEXT_COMMAND: promptA` and next phase identity. If overall ultimate goal is durably complete, report complete without new execution.
- If A/B state is contradictory or pre-A immutable B cannot be reconstructed, stop for evidence recovery; never infer PASS or promote from chat history.

All outputs must state `Active project`, `goal ID/version`, `Ultimate goal progress`, `Completed vs remaining phases`, `Current A/B eligibility`, `Blocking evidence`, `NEXT_COMMAND`, `Next phase ID`, `Plan changed?`. Future checks require a later owner invocation, independently operating scheduled GitHub workflow, or explicitly installed automation; never promise passive monitoring from a single assistant turn.

## Prompt B selection rules

Project selection and round selection are separate.

First select the unique globally active project through `docs/agent-prompts/task-routing.json`.

Then select the correct closeout round inside that project's canonical handoff. Do not select by document position.

In particular, do **not** simply use the last Prompt B in the handoff. Prompt A may have preregistered the next round's Prompt A + Prompt B, making the last Prompt B a future-round contract.

Prefer durable identifiers such as:

- `Active round`
- `Pending closeout`
- `Current round`
- `Round identity`
- `Prompt A complete; Prompt B pending`
- `Prompt B closeout: PASS`
- `Preregistered Prompt B — <round>`
- `Preregistered future Prompt B`

The correct target is the nearest round in the active project satisfying both:

1. Prompt A has durable completion evidence.
2. That round does not yet have durable Prompt B PASS evidence.

Then recover that round's preregistered Prompt B from a pre-Prompt-A handoff checkpoint or other durable repository history when necessary.

Never:

- use a future round Prompt B to validate the current round;
- use a pending project's Prompt B merely because it has a closer pending closeout;
- declare the current implementation absent merely because the last Prompt B belongs to a future round;
- execute a future Prompt A to satisfy a wrongly selected Prompt B;
- use conversation history as the sole Prompt B identity source.

## Task activation rules

When the owner explicitly asks to activate a pending task or establish a new task as active:

1. update `docs/agent-prompts/task-routing.json` so the requested task is the sole `active` task;
2. set every other registered task to `pending` in the same durable update;
3. preserve all internal handoff/round state of demoted tasks;
4. commit/push and verify the routing registry on current remote `main`;
5. stop unless the owner separately asked to execute `promptA` or `promptB`.

When a new handoff/project is created with an active Prompt A and is intended to become the default active task, register it as the sole active task and demote the prior active task to pending. Never leave two tasks globally active.

## Pending task listing

When the owner asks to list `pending` tasks, read `docs/agent-prompts/task-routing.json` from current remote `main` and list all tasks whose state is `pending`, including at least task label/id, canonical handoff path, and current internal round/Prompt state when available.

Listing is read-only. Do not activate or execute pending tasks.

## Independent verification rules

After selecting the correct phase-specific Prompt B, independently execute every criterion it defines, including as applicable:

- closeout criteria;
- bounded-scope checks;
- stop conditions;
- audit/implementation verification;
- deterministic tests and regression;
- workflow/run/job identity checks;
- tested/materialized SHA checks;
- artifact/contract markers;
- protected blobs and behavior;
- durable repository-state verification;
- completion requirements.

Do not treat any of these as sufficient by themselves:

- the Prompt A completion message;
- an agent summary;
- a green GitHub Actions conclusion;
- a test-pass summary;
- a workflow summary;
- conversation history.

Important state must be re-established from current remote `main` and durable repository evidence.

## Concurrent change / freshness rules

If current remote `main` advanced after Prompt A completion:

1. Fetch the new current `main`.
2. Classify every concurrent change relevant to the round.
3. Determine whether it materially affects implementation, audit evidence, baseline, tested SHA, entry points, protected blobs, handoff assumptions, routing state, or the preregistered next-round assumptions.
4. Unrelated data-only or documentation-only changes may be recorded and tolerated if they do not stale the acceptance evidence.
5. If evidence is stale, repair or refresh only the bounded freshness/correctness defect allowed by Prompt B and `AGENTS.md`.

Concurrent changes must never be silently ignored.

If `docs/agent-prompts/task-routing.json` changed during the round, verify whether the project being closed is still the active project. Do not silently close a now-pending project through the bare `promptB` command unless the owner explicitly selected that project.

## Failure behavior

If any phase-specific Prompt B criterion fails:

- do not declare the round complete;
- do not promote the next round;
- do not start another Prompt A;
- fix only the bounded defect causing the failure;
- rerun the required tests/workflows/audit/verification;
- fetch current remote `main` again;
- restart verification from criterion 1 of the same preregistered Prompt B, not merely the failed item;
- continue until all criteria pass or a defined stop condition is reached.

## PASS behavior

Only when all criteria pass:

1. Update the canonical handoff with durable closeout evidence required by the phase-specific Prompt B.
2. Explicitly record `Prompt B closeout: PASS` for the completed round.
3. Preserve round identity, Prompt A head/evidence, closeout commit/run/job/tested SHA details, bounded changed-file set, protected invariants, known limitations, and durable-state evidence as applicable.
4. Promote **only** the already-preregistered next round after PASS.
5. Clearly separate:
   - completed round;
   - Prompt B PASS evidence;
   - newly active/promoted round within the same project;
   - that round's preregistered Prompt A;
   - that round's preregistered Prompt B.
6. If the next pair was not already preregistered and repository rules require continuing work, create a phase-specific paired Prompt A + Prompt B now, with exact known repo-relative paths, bounded scope, frozen constraints, stop conditions, Prompt A completion contract, and phase-specific Prompt B criteria.
7. Commit/checkpoint the canonical handoff.
8. Fetch current remote `main` again and verify the handoff commit exists, the evidence is durable, the promoted round identity is unambiguous, and later concurrent changes have not made the new baseline/entry points/assumptions stale.
9. Verify the same project remains the sole globally active task unless the owner explicitly requested a routing change. Promoting the next round within a project does not activate a different project.

Then stop.

Do **not** execute the promoted Prompt A automatically.

## Chat-only implementation boundary (owner-approved)

Handoff Control UI standalone-site/MCP/Vercel/ChatKit deployment is stopped until a new explicit user request. Do not deploy or restart it through Prompt B or call it a required acceptance step; this does not affect independently authorized stock_data publishing. Perform all Handoff B gate checks through this ChatGPT conversation and repository evidence. Preserve the preregistered original B acceptance; require verified A COMPLETE, never self-advance. In the final card use a copyable command only when eligible and never simulate an unavailable interactive button.

