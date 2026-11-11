# Institutional Accumulation — Scheduled Canary Closeout

Canonical handoff: data_research/institutional-flow/institutional-accumulation-catalyst-scheduled-canary-closeout-handoff.md

Historical predecessor:
data_research/institutional-flow/institutional-accumulation-catalyst-artifact-readiness-handoff.md

## Current phase

Third natural scheduled occurrence closeout is complete. The bounded scheduled canary has exactly 3 accepted eligible natural scheduled occurrences. No outcome interpretation, model/strategy promotion, production change, or universe widening is authorized by this closeout.

## Completed round

Round:
institutional-accumulation-catalyst-bounded-scheduled-canary-third-natural-occurrence-observation-v1

Status:
- Prompt A: COMPLETE
- Prompt B: PASS

Prompt B was recovered from pre-Prompt-A commit a5393bb3442c056942859c294f8882acd4390b72.

Closeout evidence:
- workflow run 37589122480; event schedule; attempt 1; conclusion success;
- schedule_gate job 112686114413 ran first with accepted count before 2;
- preflight commit 8411e9149a39b65b75bc33165196fa8ee18e3725 touched only scheduled state;
- 1102 job 112686184806 -> commit 6ebb53b5141bd48b6c3077da4586330744ca8527;
- 1104 job 112686184693 -> commit c076555317f657a4ec9376bf71aa1abad63f552d;
- 1216 job 112686184929 -> commit 37d4de41bdc64694db7923417edfb8cda5053c67;
- each stock used exactly 2 requests and produced exactly 2 immutable snapshots;
- only official MOPS t05st01 and t05st01_detail endpoints were used;
- finalize job 112687965586 -> commit 9e2b11b7e3bc74e9250ab3a01d2e24f9d1f28f3b;
- scheduled-state blob 240928292cdf5d7afb5c2eda350ce4932b2ea5f6 is exactly 3/3, pending_occurrence null, latest accepted timestamp 2026-10-07T07:49:03.529Z;
- all six third-occurrence snapshots were independently re-read and satisfy the frozen prospective PIT contract;
- protected 36-observation audit remains blob cf58c2f469507d7d10e15ec259e1e1e6f02ce848;
- historical PIT remains blob 7ccafbe36206770d93f454feefdca81a082d4cd0;
- live canary workflow remains blob f6aec20c048802cac41ba2dd37c98d08a000e8ed;
- no manual dispatch/rerun, legacy retry, historical backfill, Wave A/Wave C collection, protected outcome opening, or catalyst-significance interpretation occurred.

Prompt B closeout: PASS

## Completed round

institutional-accumulation-catalyst-bounded-scheduled-canary-post-collection-freeze-audit-v1

Status:
- Prompt A: COMPLETE
- Prompt B: PASS

## Objective

Freeze and audit the completed 3/3 scheduled-canary evidence before any interpretation step. This round is zero-source-network and outcome-blind. It may create only its own deterministic audit artifact, minimal zero-network audit code/test if required, and this handoff checkpoint.

## Entry points

- .github/workflows/collect-institutional-accumulation-catalyst-prospective-canary.yml
- scripts/evaluate_institutional_accumulation_catalyst_scheduled_canary_eligibility.js
- scripts/manage_institutional_accumulation_catalyst_scheduled_canary_state.js
- data_research/institutional-flow/institutional-accumulation-catalyst-bounded-scheduled-canary-state-v1.json
- data_research/institutional-flow/scheduled-catalyst-canary-observability/37298104341/
- data_research/institutional-flow/scheduled-catalyst-canary-observability/37434295221/
- data_research/institutional-flow/scheduled-catalyst-canary-observability/37589122480/
- data_research/institutional-flow/institutional-accumulation-catalyst-prospective-pit-capture-contract-v1.json
- data_research/institutional-flow/institutional-accumulation-catalyst-prospective-observation-audit-v1.json
- data_research/institutional-flow/institutional-accumulation-catalyst-pit-provenance-resolution-v1.json

## Prompt A — post-collection freeze audit

Continue only if institutional-accumulation remains the sole active task and this round remains active. Fetch current main and read AGENTS.md, routing, this handoff, and every Entry point above.

Do not dispatch or rerun the live canary. Do not make source-network requests, collect a fourth occurrence, alter cron/workflow behavior, widen beyond 1102/1104/1216, or open outcomes, holdouts, protected-2454, association, Withdrawal, model, strategy, production, or broad-universe state.

Create deterministic artifact:
data_research/institutional-flow/institutional-accumulation-catalyst-bounded-scheduled-canary-post-collection-freeze-audit-v1.json

Using durable repository evidence only, verify:
1. state is exactly 3/3 with pending_occurrence null;
2. accepted trigger identities are exactly schedule:37298104341:1, schedule:37434295221:1, schedule:37589122480:1 in order;
3. every occurrence contains exactly 1102/1104/1216, 2 requests and 2 snapshots per stock, official endpoints only, and six immutable snapshot paths/ids;
4. latest accepted timestamp equals the latest accepted snapshot timestamp;
5. the eligibility evaluator, executed read-only against the target-reached state, authorizes zero future source requests because target is already reached;
6. workflow/state/protected audit/historical PIT blob identities are recorded;
7. no claim is made about catalyst significance, predictive value, outcome association, production suitability, or broad-universe generalization.

Require deterministic byte-identical regeneration, zero source network, protected blobs unchanged, and a bounded diff limited to the audit artifact plus minimal audit code/test and this handoff. Commit to remote main, record exact evidence here, mark Prompt A COMPLETE / Prompt B pending, then stop: Prompt A complete — ready for Prompt B.

### Prompt A completion evidence — post-collection freeze audit

- Deterministic freeze artifact committed on remote main at `data_research/institutional-flow/institutional-accumulation-catalyst-bounded-scheduled-canary-post-collection-freeze-audit-v1.json`.
- Artifact commit: `51d8bc545a9f9d9bdbd2e229a12b90dcb52ab7b3`; durable artifact blob: `079679bed50a048ef49f0983f8da6219d8bcdb89`.
- Durable scheduled state remained exactly `3/3`, `pending_occurrence: null`, with accepted triggers in order: `schedule:37298104341:1`, `schedule:37434295221:1`, `schedule:37589122480:1`.
- All nine scheduled-observability records were re-read from current main. Every stock/run record has exactly `2` requests, `2` snapshots, and only official `t05st01` / `t05st01_detail` endpoints.
- All 18 referenced immutable snapshot paths were independently fetched from current main. Every path exists; filename immutable id equals `immutable_snapshot_id`; `pit_known_at == collected_at`; `historical_back_imputation_allowed == false`; methodology/parser identities remain frozen.
- Latest durable snapshot is `2026-10-07T07:49:03.529Z`, exactly matching scheduled-state `latest_accepted_observation_timestamp`.
- Repository evaluator/manager were executed read-only from blobs `e0fbbd53c1adffd9bfdc7f13a51719e7036cfd9a` and `91feb8854515484ae4b92b7199ab9b57496034eb` against the current 3/3 state. Probe result: `should_collect=false`, terminal reason `accepted_eligible_target_reached`, accepted count `3 -> 3`, zero requests, zero snapshots, zero endpoints, no state persistence.
- Deterministic serialization/regeneration was executed twice and compared byte-for-byte before commit; outputs were identical.
- Frozen live workflow remains blob `f6aec20c048802cac41ba2dd37c98d08a000e8ed`; scheduled state remains blob `240928292cdf5d7afb5c2eda350ce4932b2ea5f6`; protected 36-observation audit remains `cf58c2f469507d7d10e15ec259e1e1e6f02ce848`; historical PIT remains `7ccafbe36206770d93f454feefdca81a082d4cd0`; PIT capture contract remains `e6d3fe617c848c2e002382ce53e533e858aed0ae`.
- No live canary dispatch/rerun, source-network request, fourth occurrence, cron/workflow change, outcome/holdout/2454/association/Withdrawal/model/strategy/production opening, catalyst-significance interpretation, or universe widening occurred.
- Routing still has `institutional-accumulation` as the sole active project and points to this handoff.

**Prompt A complete — ready for Prompt B.**

## Prompt B — post-collection freeze audit closeout

Run only after Prompt A completes. Fetch current main and recover this exact Prompt B from durable pre-Prompt-A history.

Independently verify:
- institutional-accumulation remains sole active routed project;
- third-natural-occurrence Prompt B PASS above remains durable;
- audit execution used zero source network and no live dispatch/rerun;
- state is exactly 3/3 with pending null and exact trigger order;
- per-occurrence stock/request/snapshot counts and official endpoints match durable observability;
- all referenced snapshots exist and satisfy the frozen PIT contract;
- latest accepted timestamp matches latest snapshot;
- target-reached eligibility independently reproduces zero-request fail-closed behavior;
- deterministic regeneration is byte-identical;
- protected workflow/research/PIT/outcome/model/strategy/production boundaries remain unchanged;
- bounded diff contains only authorized audit/handoff files plus classified unrelated concurrent changes.

If any criterion fails, fix only the bounded defect and restart this Prompt B. On PASS, checkpoint this handoff and preregister only the smallest evidence-driven next round. Do not automatically open outcomes or promote strategy. End Prompt B closeout: PASS.

## Prompt B closeout — post-collection freeze audit

**Prompt B closeout: PASS**

The exact phase-specific Prompt B above was recovered from the durable pre-Prompt-A handoff. Current remote main at independent closeout: `97f563f13f5d5a1e6747e381e7396dc92a6a8bb2`.

Independent closeout evidence:

1. Unique active route remains `institutional-accumulation`; the daily-gainers project remains pending. The original A completion checkpoint and original B acceptance remain intact.
2. The third-natural-occurrence closeout remains durable: run `37589122480`, accepted state `3/3`, no pending occurrence.
3. Audit artifact `data_research/institutional-flow/institutional-accumulation-catalyst-bounded-scheduled-canary-post-collection-freeze-audit-v1.json` exists remotely at blob `079679bed50a048ef49f0983f8da6219d8bcdb89`; it records zero source requests and no live dispatch.
4. Scheduled-state accepted identities remain exactly `schedule:37298104341:1`, `schedule:37434295221:1`, and `schedule:37589122480:1`, in order. The nine observability records show exactly 2 requests and 2 snapshots per stock per accepted occurrence, using only official MOPS listing/detail endpoints.
5. All 18 immutable snapshots were re-read from remote main and validated against `scripts/institutional_accumulation_catalyst_prospective_pit_capture_contract.js`: paths and immutable IDs match; PIT timestamp equals collection timestamp; historical back-imputation is false; frozen methodology/parser identity is preserved.
6. Latest accepted observation timestamp equals latest snapshot timestamp: `2026-10-07T07:49:03.529Z`.
7. Read-only target-reached manager probe reproduced `should_collect=false`, reason `accepted_eligible_target_reached`, count `3 -> 3`, zero requests/snapshots/endpoints, and no persisted state. A later natural scheduled run `42785898914` was success/no-op; 34 later durable occurrence records are target-reached skips with zero requests and zero snapshots. None adds a fourth accepted occurrence.
8. Deterministic audit regeneration was byte-identical. Protected canary workflow, PIT contract, historical/prospective audit and research/outcome boundaries were unchanged by the audit A. The separate source-lineage registration PR #93 and concurrent daily-gainers data commits are outside the audit A diff and are not counted as audit changes.
9. No source-network request, manual dispatch/rerun, fourth occurrence, outcome/holdout opening, catalyst-significance interpretation, universe widening, model/strategy/production change, or YouTube action occurred.

### Next ordered phase: Phase 0a sequencing reconciliation

The goal-v2 charter requires reconciling the linked legacy handoff's separate `institutional-accumulation-material-information-final-preflight-v1` active label before promoting source-lineage v2. Preserve the linked handoff and its preregistered A/B verbatim; do not run it in parallel. Phase 0a is documentation-only and does not change either round's acceptance.

**Phase 0a Prompt A — sequencing reconciliation (not executed in this closeout)**

Before work, fetch current main and read AGENTS.md, this canonical handoff, `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`, the goal-v2 charter, task-routing, and task state. Reconstruct the pre-A original pair for Phase 0a from durable repository state. Update only the goal-v2 charter, canonical routed handoff, and task state to make the order unambiguous: Phase 0 audit B PASS → Phase 0a reconciliation → source-lineage v2 A/B → preserved material-information preflight A/B, unless the source-lineage B evidence requires a newly owner-approved versioned roadmap decision. Keep the linked legacy handoff and both original prompt pairs unchanged; do not edit CI, source data, research artifacts, workflows, or acceptance. Verify routing remains unique and the state points to one active phase. Commit a durable checkpoint and stop without executing source-lineage A.

**Phase 0a Prompt B — sequencing closeout (preregistered before Phase 0a A)**

After Phase 0a A completes, independently verify from fresh remote main that only the three authorized governance files changed; the linked legacy handoff, all original A/B prompt text, source-lineage preregistration, source data and workflows remain unchanged; the charter and routed handoff specify the same unambiguous phase order; task-routing has exactly one active project; task state names Phase 0a A complete/B pending; no source calls, data writes, workflow dispatch/rerun, or research/outcome opening occurred. If any item fails, repair only within this documentation-only contract and repeat verification. On PASS, record durable evidence, promote only the preregistered source-lineage v2 round if its original pair is recoverable and no owner-only gate remains; otherwise mark WAITING_OWNER with the exact missing decision. Do not execute the next A.

## Phase 0a sequencing reconciliation — Prompt A completion

Round: `institutional-accumulation-legacy-handoff-sequencing-reconciliation-v1`

Status:
- Prompt A: COMPLETE and durable on remote main via PR #95 merge commit b8743f40a3948e25c4b2ceadc70293c14f493999
- Original paired Prompt B: BLOCKED by a concurrent mutation of the protected v1 freeze artifact; original acceptance remains unchanged

The original Phase 0a Prompt A and Prompt B above were already present on main before this A began and remain unchanged. Source-lineage v2 pair is preserved at `data_research/institutional-flow/institutional-accumulation-source-lineage-repair-v2-preregistration.md`; the linked material-information preflight pair remains byte-for-byte preserved in `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`.

Sequencing decision, limited to the already preregistered documentation-only scope:
1. Phase 0 post-collection freeze audit — A complete / B PASS.
2. Phase 0a sequencing reconciliation — A complete / B pending.
3. Source-lineage repair v2 — next implementation round after Phase 0a B PASS; use its existing frozen pair. It must preserve the v1 freeze and pinned source bytes, define a distinct v2 lineage/resolved-input view, compare frozen observations against both versions, and add push/PR CI path monitoring last.
4. Existing material-information final preflight — retain its original A/B and historical active label in the linked handoff; route it only after source-lineage v2 closes, unless that B's evidence requires a separately owner-approved versioned roadmap change.

The linked validation handoff is intentionally unchanged. Its `ACTIVE / NOT STARTED` label is preserved as the historical state recorded by that handoff; it does not create a second globally active phase. The routed canonical handoff and charter define the current ordered route. No prompt text, acceptance, source data, CI workflow, research artifact, or workflow execution was changed in this A.

Evidence:
- A started from remote main `eadd6151265167176ad2713ff1792652e71fb2e6`, where Phase 0 was durably closed by PR #94.
- Unique active task remains `institutional-accumulation`; task-routing was read and left unchanged.
- Source-lineage v2 preregistration blob `92fe52ad9317e32313bbb40536fef5caf8a71181` contains both existing Prompt A and Prompt B.
- Linked legacy handoff blob `c64853198c95d1e23063b8d4cfb80a9110816e2e` contains the original material-information preflight pair and is left unchanged.
- Scope is documentation-only; no source request, data write, workflow dispatch/rerun, or outcome/holdout opening occurred.

### Current active round

`institutional-accumulation-legacy-handoff-sequencing-reconciliation-v1`

- Prompt A: COMPLETE and durable on remote main at merge commit b8743f40a3948e25c4b2ceadc70293c14f493999.
- Prompt B: attempted against fresh main; BLOCKED, not PASS.
- No next-phase promotion occurred.

## Owner-approved route and source-lineage registration (2026-11-11)

- The following registration bullets are the state as recorded at the time of PR #93; later Phase 0 and Phase 0a closeouts below supersede their pending-state descriptions without changing the original registration or prompts.


- Owner selected institutional-accumulation as the unique active global route. daily-gainers-market-opening-end-to-end is pending; its project state and original daily-gainers A/B are preserved.
- The routed current round remains unchanged: institutional-accumulation-catalyst-bounded-scheduled-canary-post-collection-freeze-audit-v1, Prompt A COMPLETE, original Prompt B PREREGISTERED / PENDING. Its exact Prompt B above remains the immediate eligible action. This registration does not run or replace it.
- The linked institutional-accumulation-validation-handoff.md separately labels institutional-accumulation-material-information-final-preflight-v1 ACTIVE / NOT STARTED with a preregistered B. That linked record is preserved unchanged. Reconcile its sequencing against this routed canonical handoff in a durable phase-promotion checkpoint before any subsequent A; do not run the two active labels in parallel.
- Goal charter v2: data_research/institutional-flow/institutional-accumulation-goal-v2-charter-roadmap.md.
- Owner-approved source-lineage CHANGE_PROPOSAL and frozen next-round pair: data_research/institutional-flow/institutional-accumulation-source-lineage-repair-v2-preregistration.md.
- Task state: docs/handoffs/state/institutional-accumulation.json.
- Source-lineage v2 is preregistered but NOT promoted and NOT eligible for Prompt A until the current original Prompt B passes and the linked-handoff ordering is explicitly reconciled. CI path filters are intentionally not changed in this registration commit; they are last in the frozen Prompt A.
- The separate Fubon workflow failure run 42856368560, job 129970397296, head b8449802231fd713918f4ebea5670dc25011fdcb, failed at Commit and push changes with fatal: not in a git directory before staging/commit/push. It remains a separate workflow-plumbing diagnosis and does not alter this research round's A/B status.


Source lineage registration correction (2026-11-11): commit graph verification confirms old source blob dc52d8eb2ec32dd57606b6dc1a0c4a904d4e8346 belongs to v1-pinned source commit 01d79c2ed2d6b5b78d5875a06e319b1f20dd480a. Commit fdbe6e0bfaa193626aa1197bcba52e5be49e5236 is the subsequent data refresh commit, not the v1 base.


## Phase 0a sequencing reconciliation — Prompt B closeout (BLOCKED)

The original Phase 0a Prompt B was recovered from the preregistered text above and checked against fresh remote main. Its closeout cannot pass because the protected v1 freeze artifact changed during this round, creating a material conflict with the charter and the already-preregistered source-lineage v2 baseline. The original B text and acceptance have not been edited.

Closeout evidence on the checked main `b3d58ecaa58ce2312289729ca3f31c7250360db9` (which differs from PR #95 merge only by unrelated market-environment workflow/script updates):

- PR #95 is merged at `b8743f40a3948e25c4b2ceadc70293c14f493999`; its remote changed-file list contains exactly the three authorized governance paths: this canonical handoff, `data_research/institutional-flow/institutional-accumulation-goal-v2-charter-roadmap.md`, and `docs/handoffs/state/institutional-accumulation.json`.
- Unique active route remains `institutional-accumulation`; goal remains `goal-v3/institutional-accumulation-goal-v2`. The source-lineage v2 preregistration remains blob `92fe52ad9317e32313bbb40536fef5caf8a71181`; linked legacy handoff remains blob `c64853198c95d1e23063b8d4cfb80a9110816e2e`. The preregistration and linked handoff were not changed by PR #95.
- `data_history_sma/1213.json` remains blob `74e5f719416999acdd7397af3c5196078bd2f992`, unchanged from the Phase 0a A base `eadd6151265167176ad2713ff1792652e71fb2e6`.
- The v1 freeze file did change after the A base: blob `4215a84a110406714e200618d280b70d0d1e7f46` at A base became `6c343ec4a3dfebf194222d37bf4ab2dd13ac4f96` in commit `7d618362fa7a9d446ab84f2be014753e48f5c944` (`analysis: freeze accumulation development sample v1`). That commit changed frozen provenance from legacy Fubon files to current `data_history_sma` files, replaced the pinned source-file hashes, and changed the freeze content SHA-256 from `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b` to `4ffa70f518bf4c94c61630d09ee8e9cb6e37fb0eb98edc1bec828f151ba566ea`. This directly conflicts with the charter's immutable v1 freeze and the preregistered v2 baseline; it is not safe to classify as unrelated.
- The separate validation workflow `.github/workflows/test-node-regression-suite.yml` also changed since the A base (current blob `5bc82be5ab1bdce1207850a80fcfe3872a09c7a3`, prior blob `fad579a62be53cf833d3f28bdc4440b16bfaa041`) under commit `a31c0e476c75a703b52ee7eacfec610177cc5ea2`, pinning runners to `ubuntu-24.04`. This concurrent runner change is unrelated to sequencing and is classified separately. PR #95 itself did not change workflows, source data, or research artifacts.
- No source request, data write, workflow dispatch, job rerun, outcome/holdout opening, or research interpretation was performed by this Prompt B closeout.

Result: Prompt B is BLOCKED / not PASS. Source-lineage v2 remains preregistered but not promoted and Prompt A is not eligible. The linked material-information preflight remains preserved and not active.

Required owner action: approve a versioned CHANGE_PROPOSAL and paired round that resolves the overwritten-v1 identity before any downstream A. The proposal must state whether to restore the original v1 freeze exactly from blob `4215a84a110406714e200618d280b70d0d1e7f46` and retain the regenerated `6c343ec4a3dfebf194222d37bf4ab2dd13ac4f96` only as a separately named v2 view, or adopt a different owner-approved versioned history. Do not modify the existing v1 file or its hashes, reinterpret this B as PASS, or start source-lineage v2 until that versioned decision is recorded.
