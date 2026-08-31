# Prompt A Runner Protocol

Canonical repository command: `promptA`

This file defines the repository-level execution protocol for the short owner command `promptA`.

It is a **runner protocol**, not the phase-specific implementation prompt. The actual work contract must come from the current canonical handoff on durable remote `main`.

## Mandatory startup

When the repository owner sends exactly `promptA` (case-insensitive after trimming surrounding whitespace), execute this protocol.

1. Fetch current remote `main`. Do not reuse local state, prior conversation state, summaries, or a previously read handoff as authoritative state.
2. Read repository-root `AGENTS.md`.
3. Read `docs/project-philosophy.md` and `docs/roadmap/current-phase.md` when required by `AGENTS.md` or the active task.
4. Determine the canonical handoff for the active continuing task from durable repository evidence. Prefer an explicit canonical path already named by the repository/task context. Do not guess among unrelated handoffs.
5. Read that canonical handoff from current remote `main`.
6. Identify the round that is explicitly active/promoted and whose Prompt A has not yet completed.
7. Recover that round's phase-specific Prompt A from the canonical handoff and, when identity is ambiguous, from durable repository history.
8. Verify the paired Prompt B for the same round was preregistered before Prompt A begins. If no phase-specific paired Prompt B exists, do not start implementation; repair the handoff/pairing first if repository rules authorize that documentation-only repair.

## Prompt A selection rules

Select by durable round identity, not document position.

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

- the previous round still has Prompt A complete but Prompt B pending;
- the round has not been promoted;
- the selected Prompt A belongs to a future round;
- the paired phase-specific Prompt B was not preregistered before execution;
- a stop condition in the handoff applies.

If the handoff is ambiguous, inspect durable commit history to recover the most recent clean promotion checkpoint and round identity. Conversation history is not an acceptance source.

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

## Completion and stop behavior

Use the phase-specific Prompt A's exact completion wording when it defines one. Otherwise state clearly that Prompt A is complete and ready for Prompt B.

Then stop.

Do **not**:

- execute Prompt B automatically;
- promote the next round before Prompt B passes;
- execute a future Prompt A merely because it has been preregistered;
- replace durable repository evidence with a conversation summary.
