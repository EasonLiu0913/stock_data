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

## Owner-approved versioned correction — 2026-11-11

The original Phase 0a Prompt B closeout remains BLOCKED as recorded above; its frozen acceptance and result are unchanged. The owner authorized the versioned resolution “restore the original v1 freeze and list the regenerated content separately as v2.” The registered successor proposal and immutable pair are in `data_research/institutional-flow/institutional-accumulation-source-lineage-repair-v2.1-change-proposal.md` (proposal v2.1). It preserves the original v1 bytes from blob `4215a84a110406714e200618d280b70d0d1e7f46`, assigns the regenerated freeze blob `6c343ec4a3dfebf194222d37bf4ab2dd13ac4f96` to a separate v2 artifact, and treats latest source blob `e8991ea4a67d5cfe04095413dac2eaadaa974771` as later input, not a silent rebind. No implementation has started. The proposal becomes eligible only after its governance PR is merged and the pair is verified on fresh main; then a distinct owner `promptA` is required.


## v2.1 proposal merge checkpoint — 2026-11-11

PR #97 merged at `386ded3d1a1e7862bbc94789fd5361be16943faa`. The owner-approved proposal and its frozen Prompt A/B are now on `main` at `data_research/institutional-flow/institutional-accumulation-source-lineage-repair-v2.1-change-proposal.md`. Main still has the regenerated freeze at v1 path (blob `6c343ec4a3dfebf194222d37bf4ab2dd13ac4f96`) and current `data_history_sma/1213.json` blob `e8991ea4a67d5cfe04095413dac2eaadaa974771`; neither was modified by PR #97. Phase 0a Prompt B remains historically BLOCKED. The v2.1 Prompt A/B are preregistered and eligible, but A has not started; a separate owner-issued `promptA` command is required.


## v2.1 Prompt A implementation checkpoint — 2026-11-11

The earlier v2.1 merge checkpoint's statement that implementation had not started is superseded by this section. Phase 0a Prompt B remains historically BLOCKED and unchanged. The active round remains `institutional-accumulation-source-lineage-repair-v2.1`; Prompt A is in progress and Prompt B is not eligible yet.

- PR #98 is open on branch `codex/institutional-freeze-v2.1-prompta-20261111`, based on current main `05868fb2210ede5a3356b416098966b0ffb14703`; initial implementation head is `04812709629f15a337153058b46c32993312e797`.
- Preserved original required-check failure: Node Regression Suite run #799, job `130610288264`, failed on three existing tests at `verifyFrozenManifest`. The first invalid assumption was comparing v1's pinned `data_history_sma/1213.json` hash `b5951a9a69a3f915a7d69e07851631ec41e06a58c12321ce8008e044ac4097f3` to the later working-tree source hash `8af39f77620932d41507171b2b2b5c533107fd2f152b28b7aabb5f30f7b799da`.
- The bounded repair resolves v1 through `scripts/lib/institutional_accumulation_freeze_versions.js::resolveFreezeVersion` and validates the source-path hash against the bytes at the registered historical source commit/blob; other frozen source paths retain their existing working-tree checks. This preserves fail-closed identity and does not alter v1 or v2 artifacts.
- The v1 validator test is now explicitly named for pinned-source behavior. Both push and pull_request path filters explicitly include `scripts/open_institutional_accumulation_development_outcomes.js` and `tests/institutional_accumulation_development_outcomes.test.js`; the full `npm test` gate remains unchanged.
- Bounded local verification after the validator change: the two related test files reported 13 passed, 0 failed, 1 skipped because this stale local checkout lacks the registered observed-main commit needed for deterministic lineage regeneration. `git diff --check` and Node syntax checks pass. No generated outcome file was written.
- Corrected PR CI has not run yet. Prompt A remains in progress until the corrected PR head's full regression job succeeds and remote artifacts/checks are verified.

No source-network request/write, workflow dispatch/rerun, outcome artifact write, holdout/protected-case access, association/catalyst interpretation, production change, or publication action occurred in this repair step.


## v2.1 Prompt A completion checkpoint — 2026-11-11

**Prompt A COMPLETE — ready for Prompt B.** Preserve and run only the already preregistered v2.1 Prompt B; do not alter its text or acceptance. Phase 0a Prompt B remains historically BLOCKED and unchanged.

- PR #98 remains open and unmerged. Implementation/fix commit: `55cf2e3fcacd865f6d63741ab0130ac5aeb1801f`; tested head before this documentation checkpoint: same SHA. The PR base and current `main` both remain `05868fb2210ede5a3356b416098966b0ffb14703`.
- Corrected full Node Regression Suite: run #43048723303, job `130619674581`, pull_request event; SUCCESS, `1262/1262` passed, 0 failed, 0 skipped. The v1 pinned-source regression and deterministic lineage-manifest regeneration both passed. Checkout, required history fetch, syntax check, and clean-tree verification passed.
- Scheduled Workflow Registry Contract run #43048723520 and Public Page Registry CI run #43048723373 also succeeded. The latter was a validation check; no deployment was invoked.
- Preserve the earlier Node Regression Suite failure run #43046092864 / job `130610288264` as historical FAIL; it is not relabeled or deleted.
- The separate Node 24 audit run #43048723395 / job `130619673550` still fails on pre-existing `.github/workflows/backfill-market-environment.yml:93` (`actions/upload-artifact@v4`). That file is unchanged on current main and outside this frozen source-lineage A; keep this check classified separately and do not expand this PR to fix it. PR mergeability state was `unstable`; this phase does not authorize merging.
- Remote PR branch readback confirms v1 freeze blob `4215a84a110406714e200618d280b70d0d1e7f46`, v2 freeze blob `6c343ec4a3dfebf194222d37bf4ab2dd13ac4f96`, source-lineage manifest blob `2613628c273b05e620e84ec57bd909cff60088a3`, and this canonical handoff checkpoint. The later source observation remains separate and unchanged.
- No source-network fetch/write, workflow dispatch/rerun, Pages deployment, outcomes/holdouts opening, association/catalyst interpretation, production or strategy change, merge, or YouTube action occurred.

Next permitted action: an explicit owner-issued `promptB` starts independent closeout for this same round. No automatic continuation or promotion is authorized.



## v2.1 Prompt B closeout — 2026-11-12

**Prompt B PASS. Stop here. Do not merge automatically, promote another phase, or begin another Prompt A.** The historical Phase 0a Prompt B remains BLOCKED; this closeout does not relabel or replace that result.

- Active project/goal: `institutional-accumulation` / `goal-v3/institutional-accumulation-goal-v2`. Phase/round: `institutional-accumulation-source-lineage-repair-v2.1`.
- Fresh remote main at closeout: `9aa2cdd5ed189727663319f2428cf2cdc67f8ccc`. It is an unrelated Fubon broker-data update. The latest `data_history_sma/1213.json` blob remains `e8991ea4a67d5cfe04095413dac2eaadaa974771`; the PR base remains `05868fb2210ede5a3356b416098966b0ffb14703`.
- PR #98 remains open/unmerged. Corrected implementation head: `ace644dcbcfe421ba9f77e54b213288f9582a462`. B bounded corrections restored the freeze writer to the exact base blob `53287665c3205de3de376ba57fb9360e0115f3a2` (the PR file patch is empty) and restored both workflow runner pins from `ubuntu-latest` to `ubuntu-24.04`; correction commits are `912ffbd16ceac3684eb5093c21a5c5e36229b1af` and `ace644dcbcfe421ba9f77e54b213288f9582a462`.
- Independent remote readback: v1 freeze blob `4215a84a110406714e200618d280b70d0d1e7f46`; v2 freeze blob `6c343ec4a3dfebf194222d37bf4ab2dd13ac4f96`; lineage manifest blob `2613628c273b05e620e84ec57bd909cff60088a3`. The manifest regression verifies both pinned identities, the later source observation, 96 development anchors / 3,360 observation comparisons / 0 state changes / 0 value changes / 3 provenance changes, and excludes protected/holdout comparisons. The corrected full suite also passed the registered v1 semantic SHA check.
- Corrected Node Regression Suite: run #43052441050, job #130634656843, pull_request event on head `ace644d...`, SUCCESS; 1,261 passed, 0 failed, 0 skipped. Required history fetch, syntax check, and tracked-tree cleanliness steps passed. The pinned-source, separate v1/v2 resolution, fail-closed substitution, deterministic lineage-manifest regeneration, and development-only comparison tests passed.
- Scheduled Workflow Registry Contract run #43052441265 succeeded. Public Page Registry CI run #43052441010 succeeded as validation-only; no deployment occurred.
- Preserve unrelated Node 24 audit failure run #43052440913 / job #130632912058. Its log identifies only `.github/workflows/backfill-market-environment.yml:93` (`actions/upload-artifact@v4`); that workflow blob is identical on the PR base and latest main (`bc4572bcb29fa19b6eb38a6bc0a9b49a4d562b6e`). It is outside this frozen source-lineage acceptance and was not changed.
- The exact preregistered B checks passed: source and frozen identities remain distinct; push/PR paths are aligned and include data, both freezes, manifest, and related regression tests; full `npm test` is retained; no data fetch/write, dispatch/rerun, outcomes/holdouts, association/catalyst interpretation, protected-case access, strategy/production change, Pages deployment, or YouTube action occurred.
- Plan changed: yes. Only the bounded Prompt B corrections above were made. No phase promotion or automatic continuation is permitted. Next action requires a separate owner instruction; do not infer that this PASS authorizes merge or the next phase.



## Owner-authorized versioned phase-promotion checkpoint — 2026-11-12

This amendment records the explicit next-phase promotion after the v2.1 source-lineage closeout. It supersedes only the effective phase ordering/state above; historical Phase 0a and v2.1 records, original artifacts, and frozen prompt acceptances remain unchanged.

- Phase 0a `institutional-accumulation-legacy-handoff-sequencing-reconciliation-v1` remains historically **Prompt A COMPLETE / Prompt B BLOCKED**. This result is not relabeled or replaced.
- Phase 1 executable successor `institutional-accumulation-source-lineage-repair-v2.1` is **Prompt A COMPLETE / Prompt B PASS**. PR #98 merged at `ca57515958bb74c850f0280dbe9647c53ca27822`; independent closeout run #43054958973 (job #130643346241) passed 1,261/1,261, 0 failed, 0 skipped. The separate Node 24 audit failure remains classified as unrelated per the v2.1 closeout.
- The preserved next phase `institutional-accumulation-material-information-final-preflight-v1` is now explicitly **ACTIVE / Prompt A preregistered / Prompt B preregistered**. Its exact original A/B pair is reproduced below from the unchanged linked handoff blob `c64853198c95d1e23063b8d4cfb80a9110816e2e`; no acceptance text is changed.
- The linked legacy handoff remains unchanged at that blob. Phase 0a remains a historical blocked result, and no source-lineage v2 or earlier pair is rewritten.
- Next action is a separate owner-issued `promptA`. This checkpoint does not execute it. No automatic continuation, source request, workflow dispatch/rerun, Wave C, outcome/holdout access, strategy promotion, production change, or publication is authorized.

## Prompt A — Material-information final preflight

```text
Continue the Institutional Accumulation / Catalyst Pre-positioning research project only if `institutional-accumulation-official-disclosure-source-collection-v1` has durable Prompt B PASS and has explicitly promoted round `institutional-accumulation-material-information-final-preflight-v1`.

Before work:
1. fetch current remote `main`;
2. read repository-root `AGENTS.md`, `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, this canonical handoff, `data_research/institutional-flow/institutional-accumulation-official-disclosure-source-collection-preregistration-v1.md`, `data_research/institutional-flow/official-disclosure-raw/mops-material-information/preflight.json`, `scripts/plan_institutional_accumulation_official_disclosure_collection.js`, `scripts/preflight_institutional_accumulation_mops_material_information.js`, `tests/institutional_accumulation_official_disclosure_collection.test.js`, and `docs/agent-prompts/task-routing.json`;
3. recover this exact Prompt A + Prompt B pair from durable pre-Prompt-A history.

Execute only the third and final material-information preflight attempt:
- first prove current planner is outcome-blind, `Wave A=0`, `Wave B=1`, `Wave C=0`, `preflight_attempt_count=2`, `preflight_retryable=true`;
- run the existing bounded preflight once on one fresh runner, with the existing request cap of 3 and `2-5s` per-request jitter;
- checkpoint `data_research/institutional-flow/official-disclosure-raw/mops-material-information/preflight.json` durably with race-safe push behavior;
- if the attempt is another ambiguous security/WAF/shrunken response, require `attempt_count=3`, `retryable=false`, `terminal_state=manual_review`; it must not become source-empty;
- if the machine contract PASSes, persist PASS diagnostics but do not execute Wave C in this round;
- do not refetch Wave A; do not read outcomes/holdouts/protected `2454`; do not create catalyst features, associations, thresholds, models, strategies, or production behavior; do not modify Withdrawal state.

Prompt A completion requires the final preflight state and diagnostics to exist on current remote `main`, the planner to reflect that durable state correctly, the canonical handoff to record Prompt A complete / Prompt B pending, and the same preregistered Prompt B below to remain recoverable.

When complete, report `Prompt A complete — ready for Prompt B` and stop.
```

## Prompt B — Material-information final preflight closeout

```text
Perform mandatory closeout for round `institutional-accumulation-material-information-final-preflight-v1` only after its Prompt A has completed.

Fetch current remote `main`; read `AGENTS.md`, this canonical handoff, the source-collection preregistration, current `preflight.json`, planner, preflight implementation, tests, relevant workflow/run evidence, and task routing. Recover this exact Prompt B from durable pre-Prompt-A history.

Verify at minimum:
1. protected Phase 2/outcome/association/holdout/2454/Withdrawal state is unchanged;
2. pre-run state was exactly attempt 2 + retryable and Wave A was not refetched;
3. exactly one final fresh-runner preflight attempt was executed and request count stayed within the preregistered cap;
4. HTTP 200/shrunken/WAF ambiguity was never treated as source-empty;
5. if blocked again, durable state is exactly attempt 3 / retryable false / manual_review and planner no longer auto-queues Wave B;
6. if PASS, source method/body, pagination/end condition, detail identity, explicit empty semantics, quality markers and WAF distinction are all proven durably;
7. Wave C did not run in this round regardless of PASS/BLOCKED;
8. every required diagnostic/writer artifact exists on current remote main;
9. no outcomes/holdouts/catalyst association/model/production behavior were introduced;
10. canonical handoff records the result and preregisters the appropriate next paired round before promotion.

On PASS update/commit the handoff, promote only the next explicitly preregistered round, do not execute it, end with `Prompt B closeout: PASS`, and stop.
```
