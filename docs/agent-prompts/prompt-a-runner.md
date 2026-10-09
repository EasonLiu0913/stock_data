# Prompt A Runner Protocol

Canonical repository command: `promptA`

This file defines the repository-level execution protocol for the short owner command `promptA`.

It is a **runner protocol**, not the phase-specific implementation prompt. The actual work contract must come from the current canonical handoff on durable remote `main`.

## V3 project goal startup (mandatory)

Read `docs/agent-prompts/goal-anchored-handoff-v3.md` and `docs/agent-prompts/goal-anchored-legacy-index-v3.json` before selecting a round. After selecting the unique active task, resolve and report its immutable Project Charter goal ID/version, ultimate end-to-end acceptance, current roadmap phase and remaining gates. For an indexed legacy task missing a verified project/phase charter, recover it from its canonical handoff and durable prior evidence, checkpoint the plan without inventing achievements, THEN perform the same preregistered round; don't silently redefine project purpose. Verify current Prompt A is authorized by the current small goal and its original paired Prompt B. Report `Ultimate goal progress / Completed versus remaining phases / Blockers / Next phase ID / Plan changed?`. Task activation does not execute Prompt A.

## Global task routing

Canonical routing registry:

`docs/agent-prompts/task-routing.json`

Repository-wide invariant:

- at most one task may have `state: active`;
- any number of tasks may have `state: pending`;
- activating one task must demote every other task to `pending` in the same routing update;
- creating/registering a new task as `active` must demote the previously active task to `pending`;
- `pending` pauses only project-level default routing and must preserve that project's internal round identity, Prompt A/Prompt B state, frozen samples, closeout state, and handoff history;
- changing task routing never executes Prompt A or Prompt B by itself.

When the owner invokes `promptA` without naming a project, use the unique task marked `active` in `docs/agent-prompts/task-routing.json`.

Do not infer the active task from document recency, conversation history, the last-edited handoff, alphabetical order, or which handoff happens to contain an active round.

If the registry has zero active tasks or more than one active task, do not execute implementation. Report the routing defect and repair it only when repository rules and owner intent make the correct active task unambiguous.

## Mandatory startup

When the repository owner sends exactly `promptA` (case-insensitive after trimming surrounding whitespace), execute this protocol.

1. Fetch current remote `main`. Do not reuse local state, prior conversation state, summaries, or a previously read handoff as authoritative state.
2. Read repository-root `AGENTS.md`.
3. Read `docs/agent-prompts/task-routing.json` from current remote `main`.
4. Verify the global routing invariant and resolve the unique `active` task.
5. Read `docs/project-philosophy.md` and `docs/roadmap/current-phase.md` when required by `AGENTS.md` or the active task.
6. Read the canonical handoff path recorded for the active task in the routing registry.
7. Identify the round that is explicitly active/promoted inside that handoff and whose Prompt A has not yet completed.
8. Recover that round's phase-specific Prompt A from the canonical handoff and, when identity is ambiguous, from durable repository history.
9. Verify the paired Prompt B for the same round was preregistered before Prompt A begins. If no phase-specific paired Prompt B exists, do not start implementation; repair the handoff/pairing first if repository rules authorize that documentation-only repair.

## Last-section next-action rendering

Every result ends with the active project, current phase, blocker, and exact eligible next action. Use a truly supported client control if available; otherwise provide copyable `promptA` or `promptB` in a next-action section. A plain `[繼續 Prompt A]` string is NOT a clickable button and must not be presented as one. If waiting for outside evidence or authorization, put that prerequisite first and avoid unnecessary rerun suggestions.

## Automatic phase diagnosis and blocked-resume procedure

Never require the owner to specify `resume`, M1/M2, a workflow number, or a blocker name. Resolve the original round on latest remote `main` and determine A eligibility independently. Prefer durable phase status, original prompt pair and primary workflow/artifact evidence over text labels that may be stale.

1. Check whether A has durable completion and its paired B is still pending. If yes, **do not redo A**: report `NEXT_COMMAND: promptB`, reason and exact pending gate; stop.
2. Check whether current phase is `BLOCKED`, `WAITING_WORKFLOW`, `WAITING_SCHEDULE`, `WAITING_SOURCE`, `WAITING_OWNER`, `WAITING_PERMISSION` or an interrupted A. These are **not** A COMPLETE. Re-read the original A/B, blocker checkpoint, workflow and source evidence, and last successful durable output.
3. If an external condition is resolved, continue the **same original A** only for missing permitted stages; retain the immutable B and protect idempotent render/upload and paid/expensive operations. If still blocked, no false green: specify exactly what source/permission/run/evidence is needed, what event to recheck, and the next owner command/action. Avoid commits that only repeat unchanged blocker state.
4. If a workflow is in progress, check its actual run/job state and identify run URL, expected evidence, and named schedule/timezone when known. Do not fabricate an ETA or claim the agent will keep running asynchronously. If failed/canceled, identify allowed bounded retry and avoid rerunning completed artifacts.
5. If scope/criteria/paid access is needed, stop for owner approval and produce a versioned CHANGE_PROPOSAL only for genuine charter change; never relax B to bypass blocker.
6. If B already PASS and a next phase is promoted, execute only next eligible A. If final project is complete, stop; do not reactivate another project.

Every outcome: report `Current phase`, `A/B status`, `Ultimate goal progress`, `Completed vs remaining phases`, `Blocking evidence`, `NEXT_COMMAND` (or exact owner action + trigger), `Next phase ID`, `Plan changed?`. A rerun command is not evidence that missing data materialized.

## Prompt A selection rules

Project selection and round selection are separate.

First select the unique globally `active` project through `docs/agent-prompts/task-routing.json`.

Then select by durable round identity inside that project's canonical handoff, not document position.

Prefer explicit fields/sections such as:

- `Active round`
- `Current round`
- `Next round`
- `Round identity`
- `Prompt A — <round>`
- `Preregistered Prompt A`
- status indicating Prompt A has not started / is active

Do not simply execute the last Prompt A in the file. A handoff may already contain a future preregistered pair.

Do not execute a Prompt A when:

- the active project's previous round still has Prompt A complete but Prompt B pending;
- the round has not been promoted;
- the selected Prompt A belongs to a future round;
- the paired phase-specific Prompt B was not preregistered before execution;
- a stop condition in the handoff applies.

If round identity is ambiguous, inspect durable commit history to recover the most recent clean promotion checkpoint and round identity. Conversation history is not an acceptance source.

Do not switch to a different pending project merely because the active project's Prompt A is blocked, complete, or awaiting Prompt B.

## Task activation rules

When the owner explicitly asks to activate a pending task or establish a new task as active:

1. update `docs/agent-prompts/task-routing.json` so the requested task is the sole `active` task;
2. set every other registered task to `pending` in the same durable update;
3. preserve all internal handoff/round state of demoted tasks;
4. commit/push and verify the routing registry on current remote `main`;
5. stop unless the owner separately asked to execute `promptA` or `promptB`.

When a new handoff/project is created with an active Prompt A and is intended to become the default active task, register it as the sole active task and demote the prior active task to pending. Never leave two tasks globally active.

## Pending task listing

When the owner asks to list `pending` tasks, read `docs/agent-prompts/task-routing.json` from current remote `main` and list all tasks whose state is `pending`, including at least:

- task id / label;
- canonical handoff path;
- current internal round identity and Prompt A/Prompt B state from that handoff when available.

Listing pending tasks is read-only and must not activate or execute them.

## Execution rules

Once the correct phase-specific Prompt A is selected:

- execute all startup checks, ordered stages, bounded scope, frozen constraints, safety rules, intermediate gates, tests, workflows, audit requirements, durable-state checks, and completion contract defined by that Prompt A;
- follow all repository-level rules in `AGENTS.md` in addition to the phase-specific prompt;
- exact known repo-relative paths in the handoff are preferred starting points; independent verification/search remains allowed;
- do not broaden scope merely because adjacent work is visible;
- an intermediate gate PASS is not Prompt A completion unless the phase-specific prompt explicitly says it is the round boundary;
- a green workflow/test is not durable completion when the prompt requires repository writes or artifacts;
- after writes, fetch current remote `main` again and apply concurrent-change/freshness rules;
- if concurrent changes materially affect the implementation, baseline, tested SHA, entry points, protected blobs, handoff assumptions, or completion evidence, refresh only the bounded affected evidence/correctness before declaring completion;
- unrelated data-only or documentation-only changes may be recorded and tolerated when they do not stale the round contract.

## Prompt A handoff requirements

Before declaring Prompt A complete:

1. Update the canonical handoff with the round's implementation/audit/research evidence required by its contract.
2. Preserve the **same preregistered Prompt B** for the current round so Prompt B identity remains recoverable.
3. Preregister the following round's paired Prompt A + Prompt B only when the current Prompt A contract requires it.
4. Clearly distinguish:
   - current round Prompt A complete / Prompt B pending;
   - current round preregistered Prompt B;
   - future round preregistered Prompt A/B.
5. Commit/checkpoint the handoff when required.
6. Re-fetch current remote `main` and prove the expected implementation/handoff state is durable and not stale.
7. Verify `docs/agent-prompts/task-routing.json` still routes to the same active project unless the owner explicitly changed project routing during the round.

## Completion and stop behavior

Use the phase-specific Prompt A's exact completion wording when it defines one. Otherwise state clearly that Prompt A is complete and ready for Prompt B.

Then stop.

Do **not**:

- execute Prompt B automatically;
- promote the next round before Prompt B passes;
- execute a future Prompt A merely because it has been preregistered;
- replace durable repository evidence with a conversation summary;
- activate a pending project implicitly because its handoff looks newer or more actionable.
