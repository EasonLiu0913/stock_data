# CHANGE_PROPOSAL — Institutional accumulation source-lineage repair v2

Status: OWNER-APPROVED FOR PREREGISTRATION; implementation not started.
Owner authorization date: 2026-11-11.
Goal: institutional-accumulation, contract goal-v3/institutional-accumulation-goal-v2.
Phase: institutional-accumulation-source-lineage-repair-v2.
Eligibility: Prompt A is preregistered but not promoted and cannot run until the routed current round's original Prompt B is PASS and the linked-handoff ordering conflict is reconciled in a durable promotion checkpoint.

## Problem and verified baseline

The v1 development sample freeze pins both semantic identity and source bytes. For data_history_sma/1213.json:

- v1 semantic SHA-256: 66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b;
- v1 source-file SHA-256: b5951a9a69a3f915a7d69e07851631ec41e06a58c12321ce8008e044ac4097f3;
- v1-pinned source commit: 01d79c2ed2d6b5b78d5875a06e319b1f20dd480a;
- v1-pinned Git blob at that commit: dc52d8eb2ec32dd57606b6dc1a0c4a904d4e8346;
- source refresh commit: fdbe6e0bfaa193626aa1197bcba52e5be49e5236 (parent 01d79c2ed2d6b5b78d5875a06e319b1f20dd480a);
- updated Git blob observed on main: 74e5f719416999acdd7397af3c5196078bd2f992.

The observed JSON diff is 161 rows to 226: 65 additions, 17 dated on or before the frozen cutoff 2026-08-27; zero deletions and zero modifications to existing rows. These counts are a baseline to reverify at A startup, not permission to change v1 or interpret outcomes.

## Owner-approved scope

1. Keep the committed v1 freeze and its exact old source identity immutable.
2. Introduce a separate versioned source-lineage record and, if needed, separate v2 resolved-input artifact. It must name the v1 freeze ID/hash; old source blob and SHA-256; new source blob and SHA-256; repository commits; row-level added/removed/changed counts; source data date range; retrieval/commit context; and the resolution policy used for frozen observations.
3. Define two distinct views: v1 is the original frozen snapshot resolved from the exact source bytes it pinned; v2 is a separately identified later-source view. Never silently substitute current data_history_sma rows into v1. V2 must compare every frozen anchor/observation against both source versions, identify changed resolved values or newly resolvable values, and record the impact without opening sealed outcomes, recomputing association, or retuning the sample.
4. Add deterministic resolver/regression coverage that proves v1 stays byte/hash identical and that v1 and v2 resolve to their pinned source identities. The existing helper scripts/open_institutional_accumulation_development_outcomes.js is an entry point to inspect, not permission to open outcomes; its exact relevant test file has not yet been verified.
5. Only after lineage artifacts and tests are complete, update the existing validation-only workflow path filters. Verified target: .github/workflows/test-node-regression-suite.yml, whose current push and pull_request filters cover scripts/** and whose job runs npm test. Add monitoring for data_history_sma/**, the exact v1 freeze file data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json, the new lineage artifact path, and tests related to lineage (with exact test path established during A). Keep both push and pull_request paths aligned and retain the full existing test command. Do not add data triggers to a mutating freeze writer workflow or create a second CI workflow unless evidence proves the existing validator workflow cannot cover the contract.

## Frozen Prompt A — implementation

Continue the source-lineage repair only after the current routed round's original Prompt B is durably PASS and the conflicting linked-handoff status has been reconciled by a versioned phase-promotion checkpoint. Before changes, fetch current main and recheck the v1 freeze blob/SHA, current source blob/SHA, row-level diff, and routing. Read repository AGENTS.md, the source-lineage proposal, charter, existing canonical handoff, v1 freeze artifact, the relevant institutional source/provenance documents, docs/architecture/research-platform.md, and docs/decisions/ADR-001-research-first.md.

Order:
A1. Revalidate the exact v1 and current source identities; stop if either differs from this preregistration and record new evidence before changing scope.
A2. Preserve v1 unchanged. Generate a deterministic v2 lineage manifest with exact old/new identities and row-level diff, then compare resolved values for all frozen sample anchors under both inputs. Keep outcomes sealed; don't use return labels, association outputs, or catalyst significance.
A3. Implement the minimum versioned resolver/contract and regression tests. Exact test file path is not yet verified; identify and record it before modifying. Prove v1 byte/hash invariance and explicit v1/v2 identity selection.
A4. After A2/A3 validation succeeds, edit only the existing validation-only workflow .github/workflows/test-node-regression-suite.yml path filters to watch the source, frozen freeze, lineage manifest, and regression test paths for both push and pull_request. Retain npm test; do not weaken filters, checks or test assertions.
A5. Run bounded local regression validation, inspect diff, then create a PR. Do not merge automatically. No source-network requests, data backfill, workflow_dispatch of research/data writers, holdout/outcome access, strategy promotion, universe expansion, or production change.

Prompt A completion requires the v1 identity unchanged; v2 lineage manifest and frozen-observation comparison committed in the PR; tests prove separate identity resolution; the validation workflow monitors both push and PR paths and keeps full npm test; all bounded checks pass; evidence and exact paths/run IDs are checkpointed. Stop and report ready for original paired B.

## Frozen Prompt B — independent closeout

Run only after the above Prompt A is complete and the source-lineage phase is explicitly promoted. Fetch fresh main and verify the original routed freeze-audit Prompt B passed before the promotion checkpoint; recover this exact B unchanged.

Independently verify:
- v1 freeze artifact bytes and semantic SHA remain exactly pinned; old 1213.json source SHA/blob are still recorded and the current source version has a distinct SHA/blob;
- v2 lineage record is deterministic and links exact commits/blobs, date context, row-level diff, and resolution policy; every frozen observation comparison is accounted for;
- no outcome/holdout, protected 2454, association, Withdrawal, catalyst significance, production or universe expansion was opened;
- tests show explicit v1 and v2 selection and fail on silent current-source substitution;
- .github/workflows/test-node-regression-suite.yml includes aligned push and pull_request paths for source, frozen freeze, lineage artifact and related tests, and preserves full npm test;
- the PR event checks passed against the tested head, expected files exist on the remote PR branch, and the diff is bounded to the registered files;
- no unplanned writer, backfill, workflow dispatch or merge occurred.

On any failure, retain the original failure evidence and repair only within this exact acceptance; do not alter v1 or broaden phase scope. On PASS, commit the closeout checkpoint and stop; do not create/promote another phase automatically.
