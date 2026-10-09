# Goal-Anchored Handoff v3 — repository-wide mandatory protocol

Effective: 2026-10-09. Applies to ALL tasks registered in `docs/agent-prompts/task-routing.json`, including pending and completed legacy projects. This is a governance migration, not a mandate to redo completed implementation.

## Non-negotiable project hierarchy
1. **Project Charter (WHY / end-to-end finish line)**: user objective, beneficiaries/output, measurable final acceptance, immutable scope, exclusions, dependencies, risks, and evidence standards. The charter is the upper boundary of any phase/prompt.
2. **Phase Roadmap (WHAT / milestones)**: ordered phase IDs, concrete outcome, acceptance gate, dependencies, `pending|active|complete|blocked|superseded` status; one internally active phase at a time. A roadmap item is not authorization to run.
3. **Paired Round Prompt A/B (HOW / execution)**: preregistered on durable remote `main` BEFORE A; A implements one promoted phase/round, B independently verifies original preregistered criteria. Never advance with B pending.

## One global route, durable state
- `docs/agent-prompts/task-routing.json` uniquely selects the project on bare `promptA` or `promptB`; exactly one active project for normal execution, at most one under all circumstances.
- `pending` preserves all phase/round state, preregistered prompts, and proof. `completed` never auto-reactivates or silently loses closeout history. Reopening completed work requires owner authorization and a new phase/decision.
- Each task must have a canonical handoff; its Goal Charter and Roadmap may live **inside** that handoff or in a linked, versioned project-specific charter. Never create competing canonical handoffs.
- A routing entry must advertise `goal_contract_version` and `governance_state` (`native_v3` or `legacy_v3_indexed`). Legacy indexes reference existing handoffs and are NOT assertions of newly verified PASS.
- Legacy projects are governed by v3 immediately. Preserve the historic current phase, goal, prompt pairs, frozen rules and evidence; where detailed historical goals are not yet recoverable, state `not_reconstructed`, forbid improvising a new ultimate goal, and require a bounded source-based reconstruction before new implementation on that project. A completed legacy project remains completed.

## Mandatory startup for BOTH short commands
1. Fetch CURRENT remote main, read `AGENTS.md`, this v3 policy, routing registry and runner protocol; select only globally active project.
2. Resolve its canonical handoff and Charter + ordered Phase Roadmap, checking version/goal identity. For legacy projects, read the v3 index and original handoff, reconstruct only evidence-grounded gaps, commit before Prompt A if essential contract fields are absent.
3. Explicitly report `project_id`, `goal_id/version`, `ultimate outcome`, `active phase/round`, `Prompt A/B state`, `nearest remaining acceptance gate`. Confirm requested work traces to the charter.
4. Apply all older AGENTS.md research/safety, freshness, paired-prompt, durable artifacts and concurrency safeguards; v3 adds to, does not waive, them.
5. Reject a routing/phase ambiguity instead of selecting the most recent handoff.

## Lifecycle and closeout
- Project-level `pending|active|completed` is distinct from internal phase `pending|active|complete|blocked|superseded`. Test PASS, artifact PASS, phase PASS, and ultimate-project COMPLETE are four different claims.
- On A completion: durable implementation evidence, ORIGINAL B still intact, A complete/B pending; STOP. On B PASS: verify durable remote outputs, evidence identity, charter alignment, and authorized scope; mark phase complete, promote exactly one preregistered next phase (or preregister bounded next pair before its first A); STOP.
- Every A/B report must include: `Ultimate goal progress`, `Completed vs remaining phases`, `Current blocking evidence`, `Next phase ID`, `Plan changed? yes/no`; no false progress claim.
- Global task `completed` only after final end-to-end acceptance. A green CI alone never completes an end-to-end product.

## Changes and drift control
- Any unplanned requirement: write `CHANGE_PROPOSAL` with evidence, changed constraints, affected phases, options/tradeoffs, and proposed new acceptance. Classify `bounded implementation correction` vs `goal/scope/acceptance change`.
- The former can proceed inside preregistered A/B safety bounds, with evidence and full B review. The latter **requires explicit owner approval** before changing locked charter, milestones, acceptance, scope, or production routing. Version the charter (`goal-vN`) and decision log; preserve old versions.
- Never rewrite preregistered Prompt B after A has started merely to turn a failure green. If legitimate requirement changes, record superseded round with explicit approval and preregister a NEW pair.
- If a phase cannot proceed because official evidence is missing, mark `BLOCKED` with specific source/evidence, not complete; do not skip ahead or opportunistically broaden research.

## Legacy inventory and migration
- `docs/agent-prompts/goal-anchored-legacy-index-v3.json` records each existing project ID, canonical handoff, honest inferred umbrella goal, and whether detailed charter/phase inventory was reconstructed.
- This index is a navigation/governance overlay, NOT a new competing source of phase state, not a PASS attestation, and never a substitute for consulting the canonical handoff.
- Gradual *evidence recovery* is allowed at task activation while v3 rules are effective on every task NOW; do not bulk rewrite research handoffs or reset rounds under the guise of upgrading.
- Audit uniqueness, valid refs, task states and Goal v3 metadata on every routing update. Any uncertainty blocks only affected project execution.

## Acceptance of v3 migration
Routing unique, all preexisting project IDs represented, no historical completed project reopened, canonical handoffs preserved, original Prompt A/B runners intact and augmented, active project specified by owner, no Prompt A run from migration commit.
