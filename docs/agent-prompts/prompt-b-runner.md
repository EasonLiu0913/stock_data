# Prompt B Closeout Runner Protocol

Canonical repository command: `promptB`

This file defines the repository-level execution protocol for the short owner command `promptB`.

It is a **closeout runner protocol**, not the phase-specific acceptance contract. The actual Prompt B must come from durable repository history and must have been preregistered before the corresponding Prompt A began.

## Mandatory startup

When the repository owner sends exactly `promptB` (case-insensitive after trimming surrounding whitespace), execute this protocol.

1. Fetch current remote `main`. Do not reuse local state, prior conversation state, summaries, or a previously read handoff as authoritative state.
2. Read repository-root `AGENTS.md`.
3. Read `docs/project-philosophy.md` and `docs/roadmap/current-phase.md` when required by `AGENTS.md` or the active task.
4. Determine the canonical handoff for the active continuing task from durable repository evidence.
5. Read that handoff from current remote `main`.
6. Find the most recent round whose Prompt A is complete but whose corresponding Prompt B closeout does not yet have durable PASS evidence.
7. Recover the Prompt B that was preregistered for **that same round before Prompt A began**.

## Prompt B selection rules

Do not select by document position.

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

The correct target is the nearest round satisfying both:

1. Prompt A has durable completion evidence.
2. That round does not yet have durable Prompt B PASS evidence.

Then recover that round's preregistered Prompt B from a pre-Prompt-A handoff checkpoint or other durable repository history when necessary.

Never:

- use a future round Prompt B to validate the current round;
- declare the current implementation absent merely because the last Prompt B belongs to a future round;
- execute a future Prompt A to satisfy a wrongly selected Prompt B;
- use conversation history as the sole Prompt B identity source.

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
3. Determine whether it materially affects implementation, audit evidence, baseline, tested SHA, entry points, protected blobs, handoff assumptions, or the preregistered next-round assumptions.
4. Unrelated data-only or documentation-only changes may be recorded and tolerated if they do not stale the acceptance evidence.
5. If evidence is stale, repair or refresh only the bounded freshness/correctness defect allowed by Prompt B and `AGENTS.md`.

Concurrent changes must never be silently ignored.

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
   - newly active/promoted round;
   - that round's preregistered Prompt A;
   - that round's preregistered Prompt B.
6. If the next pair was not already preregistered and repository rules require continuing work, create a phase-specific paired Prompt A + Prompt B now, with exact known repo-relative paths, bounded scope, frozen constraints, stop conditions, Prompt A completion contract, and phase-specific Prompt B criteria.
7. Commit/checkpoint the canonical handoff.
8. Fetch current remote `main` again and verify the handoff commit exists, the evidence is durable, the promoted round identity is unambiguous, and later concurrent changes have not made the new baseline/entry points/assumptions stale.

Then stop.

Do **not** execute the promoted Prompt A automatically.
