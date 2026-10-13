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


## Research-direction visibility and anti-loop progress

Each active task records machine-readable progress in `docs/handoffs/state/<task-id>.json`. Required fields: task_id, phase, a_status, b_status, current_blocker, planned_research, prior_attempt, anti_loop and evidence. `planned_research` names the investigative question, method, expected evidence, success criterion and fallback. `anti_loop` indicates whether the proposal repeats a previous method with unchanged input and identifies a genuinely different next step. Canonical handoff and verified source records, not this status index, determine acceptance.

Every Handoff final action card must include **目前阻礙**, **預計研究方向**, **與上次差異**, **停止／轉向條件** and a genuinely eligible next action. With no distinct executable next step and no new evidence, report WAITING_SOURCE and the specific dependency; do not repeatedly suggest the same promptA. No new deployment or external UI is authorized.

## Exact next command

Every response ends with **下一步指令**. Select exactly one actionable command: `promptA` when A can do distinct authorized work; `promptB` only after A COMPLETE and B eligible; or an explicit non-command action such as `查看 GitHub Workflow`, `提供歷史來源`, `等待新證據`, or `授權必要權限`. Do not recommend `promptA` repeatedly if nothing changed and no distinct research is possible. Show the reason and the prerequisite. Never print a fake clickable button.

## Research progress verdict (mandatory)

Every Handoff Prompt A/B round MUST include a **研究進度判定** with exactly one enum value: `PROGRESS`, `NO_PROGRESS`, or `BLOCKED`. Determine it from evidence acquired in this round, not optimistic narration:
- `PROGRESS`: newly verified, durable source, code, tests, or validation evidence materially advances the active phase. Cite the concrete artifact/commit/run and explain the change.
- `NO_PROGRESS`: no material new verified evidence despite work; explain what was tried, why it did not advance, and what materially different approach could be attempted. Never count rereading the same file or repeating unchanged tests as progress.
- `BLOCKED`: a required external prerequisite (historical source, permission, CI proof, owner decision) prevents further eligible phase advancement; identify exactly what proof/action clears the block. A round may produce useful work while the **phase** remains blocked: report `PROGRESS` for the round and separately `phase_status: BLOCKED`.

For machine-readable state, use `research_progress_status` (enum), `research_progress_evidence` (array of verifiable refs), `research_progress_reason` (string), `phase_status` (separate lifecycle status), and `next_action`. Update the canonical handoff or existing progress record with these fields; if a JSON state file exists, keep it synchronized, never invent acceptance or test PASS. The final card must show **研究進度判定**, **目前阻礙**, **預計研究方向**, **與上次差異**, **停止／轉向條件**, and **下一步指令**. This policy applies to both A and B, preserves original frozen gates, and never authorizes UI deployments.

## Native Interactive Handoff Card — presentation contract

User preference: all Handoff v3 responses finish with a native interactive ChatGPT card, *when this chat client supports it*. The card displays Active task, goal and phase, independent research progress verdict, phase status, 目前阻礙, 預計研究方向, 與上次差異, 停止／轉向條件, and 下一步指令. Expose one real click-to-send Prompt A or Prompt B control only if that command is appropriate: clicking issues literal `promptA` or `promptB` in the same conversation and rechecks current GitHub state. Optional verified GitHub workflow links can be secondary actions. When blocked with unchanged evidence and no distinct authorized investigation, prefer the exact prerequisite and no misleading execution button. Native UI is a client capability; never simulate buttons with Markdown, nor assert a button works when it has not been rendered. Fallback to copyable text when unsupported. Strictly no standalone deployment, MCP hosting, or separate website as part of this UI requirement. Immutable paired A/B gates remain unchanged.

## Owner-approved autonomy and exception-only status UI (2026-10-13)

For an already user-invoked and authorized Prompt A/B, continue all distinct, safe, in-scope steps during the current execution. A minor obstacle, ordinary missing source for one item, or intermediate checkpoint is not an owner-interaction gate: mark that item SOURCE_INSUFFICIENT / pending, pursue other in-scope evidence and validate what is available. Do not stop merely to request another '繼續 Prompt A' click. Existing no-background-execution and frozen A/B/production authorization boundaries remain: this authorizes continuity only within the current live turn and existing scope, never autonomous later turns, automatic execution of a separately owner-gated B, or unapproved changes.

Maintain a machine-readable exception log with issue key, attempt_count, distinct attempted approaches, evidence, next safe alternative and owner_action_required. Count failures for the SAME issue; after five unsuccessful bounded attempts, stop retrying that issue, checkpoint it and surface it to the owner. Never fake five attempts or repeat an identical ineffective call. Stop and display an interactive status card ONLY when (1) an actual owner choice between material options is needed, (2) new owner authorization/credential/payment/scope or immutable gate change is needed, or (3) five bounded attempts on the same issue have failed. Safety-mandated stop conditions apply immediately regardless of retry count; do not violate policy to reach five. If no native interactive UI is available, give a concise factual exception panel, not a fake button.

In routine successful or partially progressing turns, store blocker/dependency, planned research, progress verdict, next action and exact evidence in durable handoff, but do NOT require a blocker paragraph, next-step card or click-to-continue in every user-facing answer. Briefly report achieved result and continue remaining authorized work. The exception-only presentation rule supersedes older unconditional final-card, blocker-display and one-command-per-reply wording in this repository; it does not supersede verification gates, phase authorization, or prohibition on background execution.

### No button/command-name dependency for in-scope continuation (owner clarification 2026-10-13)
Whether the next safe action is named Prompt A, validation, evidence research, readback, source remediation or another substage is irrelevant: execute it directly within the current user-authorized work and live turn. A button is never a required transition for such work. Only stop for actual owner choice, additional authorization, five failed bounded attempts on the same issue, mandatory safety stop, or a genuinely separate frozen owner-gated phase (not a cosmetic stage label). Preserve truthful live-turn/no-background limitations.

### Whole-goal execution with progressive batch expansion (owner clarification 2026-10-13)

A user-authorized goal is the unit of completion, NOT its trial batch or a substage. For a target of N records, agents may begin with a small bounded pilot (for example 3), validate, expand to a larger batch (for example 5, then 10), and continue through the entire remaining N in the SAME live execution whenever safe and within the frozen scope. Do not hand control back merely because a pilot, intermediate batch, local test, readback or checkpoint succeeded. Preserve durable checkpoint and idempotent resume after each batch, and scale down or switch investigative method on a failure without erasing successful batches. A completion report should cover the entire requested scope and acceptance; if external constraints prevent full completion, report exactly what remains, what has been checked, and the actual stop condition, without pretending that a sub-batch completed the goal. No background execution after the turn ends, no automatic crossing of independently owner-gated A/B or publication boundaries, and exception-only owner interaction rules still apply.

## Owner rule: GitHub incidents do not end a whole authorized work package (2026-10-13)

A GitHub write failure, Actions failure, or a missing single-stock source is an item-level event, not a whole-goal completion/stop. Preserve successful remote checkpoints; diagnose an Actions job from logs, perform bounded in-scope repair and verify again. Mark missing individual evidence Fail-Closed and continue other records. If persistence is temporarily unavailable, continue safe read-only semantic review, cross-checks and negative tests and distinguish local versus remote evidence. If a specific tool write is blocked by a safety check, do NOT evade it, rename its payload to bypass it, or repeat the same blocked operation; continue independent permitted work. Escalate for an actual material owner decision, new authorization, five genuinely distinct failed bounded attempts on the same ordinary problem, or immediate mandatory safety stop. Keep frozen phase A/B and publication gates. Whole authorized target, not GitHub commits or batch boundaries, is the completion unit; do not assert remote PASS without readback.
