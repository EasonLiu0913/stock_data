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

## Next-action UI availability and honest fallback

Client capability determines interactivity, not repository instructions. Never output bracketed text masquerading as a button. Render one genuine native action only if the running client exposes a supported clickable control that sends a new owner turn. Otherwise display `下一步操作：promptA` / `下一步操作：promptB` as copyable text, clearly noting that a real click-to-send button cannot be rendered here. For `BLOCKED` with no new prerequisite fulfilled, the next step is the named prerequisite, not an endless retry loop. Do not imply repository changes can modify the ChatGPT app UI, and do not invoke undocumented client APIs. After A completes, ask for B; after B passes, ask for A; never auto-chain.

## Handoff response action card

Every Prompt A/B handoff reply must end with an operational next-step card: Active project, phase, A/B state, blocker, and next action. In clients supporting user-triggered controls, provide a functional clickable `繼續 Prompt A` or `執行 Prompt B` button only when that command is eligible; clicking sends that short command as a new user request and requires fresh-state checks. For waiting, permissions, or missing historical evidence, show the exact prerequisite instead of a misleading success/execute control. If clickable controls are unavailable, use a text-only card with the exact manual command. Never auto-activate buttons, bypass Prompt B, or claim background execution. After final project completion no A/B button is appropriate.

## State-aware routing, recovery and owner guidance (v3)

`promptA` and `promptB` are **stateless owner commands with stateful durable routing**. Each invocation retrieves fresh remote main, unique Active project, original charter/roadmap/pair and current durable evidence. The runner diagnoses state **before** acting; user never has to supply phase ID, restart instructions, elapsed time, or the pending workflow ID.

Decision order (fail closed for ambiguity):

| Durable active-phase state | `promptA` outcome | `promptB` outcome | Guidance |
| --- | --- | --- | --- |
| A not started or resumably interrupted | Run/resume original A | Do not run A implicitly | `promptA` |
| A BLOCKED / WAITING on external condition | Recheck condition; resume if cleared and authorized; otherwise checkpoint precise obstacle | Not eligible: do not start B | `promptA` after named trigger, or owner action |
| A COMPLETE with original B not PASS | No duplicate A | Run original preregistered B | `promptB` |
| B verification in progress or failed | No new A | Reverify/fix inside frozen B safety bounds, or stop on true external gate | `promptB` |
| B PASS / next phase promoted | Run only next promoted phase A on a subsequent owner call | Do not rerun previous B | `promptA` |
| all phases accepted; ultimate finish evidence verified | Do not auto-run | Do not auto-run | project `completed`; owner chooses next task |

When explicit A/B command is not eligible, **explain which command is eligible** and why, with source evidence; do not silently reinterpret A as B or vice versa. `WAITING_WORKFLOW` requires workflow file, run/job URL and observed status when possible; `WAITING_SCHEDULE` requires named schedule and time zone (never invent a run completion time); `WAITING_SOURCE`, `WAITING_OWNER`, `WAITING_PERMISSION` name exact missing proof/action. Unknown cannot be called PASS. A missing workflow run should be reported, not treated as green. A failed workflow gets bounded diagnosis/rerun if allowed; do not create duplicate expensive workflows/artifacts when durable outputs can be reused.

Recheck all completed gates against remote artifacts, workflow identity and hashes to avoid wasted recomputation, and preserve no-duplicate video upload or other production idempotence. If the blocking external condition remains, record same-phase checkpoint only when facts changed and report a concrete next owner action. Do not pretend to wait in a background process, automatically schedule monitoring, or claim future completion without actual automation. Existing GitHub scheduled jobs may provide future evidence, but a later `promptA`/`promptB` invocation or configured automation is required to reassess the handoff.

All prior preregistered Prompt B acceptance criteria, immutable phase IDs, Research PASS rules and owner-controlled scope remain authoritative. Resume cannot skip B, alter original acceptance, promote while waiting, purchase licensed data, bypass credentials, or activate another task. Only charter-authorized bounded repairs are automatic; owner-controlled decisions require explicit owner approval. Every response reports active project/goal version, ultimate progress, completed/remaining phases, current round A/B state, exact blockers/dependencies, recommended next command and trigger, next phase ID and `Plan changed?`. A project stays active until owner switches or its proven ultimate acceptance is recorded complete.

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

## Owner-mandated chat-only operating mode (2026-10-09)

The Handoff Control UI website/MCP server/ChatKit/Vercel deployment experiment is **STOPPED**. Do not deploy, configure, maintain, or resume a separate service/app/website on behalf of this handoff; do not propose deployment again without a new, explicit owner request. This does not cancel independently authorized stock_data Pages workflows. All work stays in this ChatGPT conversation plus approved GitHub repository reads/writes.

Native button behavior is client-controlled; if no supported native action exists, never use Markdown pseudo-buttons. Show a brief status/action panel with copyable `promptA` or `promptB` only when appropriate. If the phase is BLOCKED and its prerequisite has not changed, give the exact missing evidence and the next authorized evidence-gathering task or owner action; no circular “run promptA again” loops. On each user-invoked A/B: fetch fresh remote main, identify unique Active task, compare actual evidence with last checkpoint, make bounded progress when possible, record reproducible result once, and preserve original acceptance and gate separation. Do not create a new Active project for UI work.

