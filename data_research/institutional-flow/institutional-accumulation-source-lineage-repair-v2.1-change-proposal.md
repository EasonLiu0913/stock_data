# CHANGE_PROPOSAL — Restore the original v1 freeze and separate regenerated content as v2

Status: OWNER-APPROVED FOR PREREGISTRATION; Prompt A has not started.
Owner authorization: 2026-11-11 — restore the original v1 freeze and keep newly generated content in a separate v2 artifact.
Goal: institutional-accumulation, contract goal-v3/institutional-accumulation-goal-v2.
Successor phase / round: institutional-accumulation-source-lineage-repair-v2.1.
This proposal supersedes the executable eligibility and paired round in the earlier v2 preregistration; that file and its original A/B remain byte-for-byte historical evidence. It does not change or pass the blocked Phase 0a Prompt B.

## Why this versioned change is needed

The original Phase 0a Prompt B remains BLOCKED because the v1 freeze file was replaced during its round. The changed v1 path is not an acceptable new v1 identity. The owner-approved resolution is to restore the exact original freeze bytes as v1 and preserve the regenerated freeze bytes as a separate v2 artifact. This is a versioned repair, not a retroactive change to the Phase 0a result.

## Registered identity baseline

- Original v1 freeze path: `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`
- Exact original v1 Git blob to restore: `4215a84a110406714e200618d280b70d0d1e7f46`
- Original v1 semantic SHA-256: `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`
- Original source commit/blob: `01d79c2ed2d6b5b78d5875a06e319b1f20dd480a` / `dc52d8eb2ec32dd57606b6dc1a0c4a904d4e8346`
- Regenerated freeze currently at the v1 path: Git blob `6c343ec4a3dfebf194222d37bf4ab2dd13ac4f96`; preserve these exact bytes as `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v2.json`.
- That generated snapshot's registered source version is the source refresh commit `fdbe6e0bfaa193626aa1197bcba52e5be49e5236`, source blob `74e5f719416999acdd7397af3c5196078bd2f992`, and its already-recorded source SHA/diff in the earlier v2 preregistration. Do not silently rebind the v2 snapshot to newer current data.
- Latest main at proposal preparation: `f660a8ce3154395dc120a919343c006da9a02bcf`; current `data_history_sma/1213.json` blob is `e8991ea4a67d5cfe04095413dac2eaadaa974771`. This later source state is not the v2 snapshot's input; record it only as a later observed source version and recheck at Prompt A startup.

## Frozen scope and stop conditions

- No change to the research goal, sealed outcomes/holdouts, protected case 2454, selection, methodology, or historic Phase 0a acceptance.
- Keep the Phase 0a Prompt B result BLOCKED forever as its historical result; never label it PASS because this repair succeeds.
- Keep the original source-lineage v2 proposal and its A/B text unchanged. This v2.1 paired round is the authorized successor because the old executable eligibility depends on the blocked Phase 0a B.
- The source data `data_history_sma/1213.json` is read-only in this phase. No fetch, backfill, or workflow dispatch/rerun.
- No outcome/holdout opening, association recomputation, catalyst-significance interpretation, universe expansion, strategy/model/production change, or publication action.
- Existing validation-only CI path filters may be changed only as the final ordered A step, after lineage artifacts and tests pass. Do not alter source-writing workflows.

## Frozen Prompt A — implementation

Before edits, fetch current main and read AGENTS.md; this proposal; the canonical routed handoff; the goal-v2 charter; the original v2 preregistration; the v1 freeze and v1 source blobs; the relevant institutional recovery/research architecture and ADR-001. Confirm the active route, this pair is on main, and the identities below still match. If a pinned identity has changed or cannot be recovered exactly, stop before writing and record the precise mismatch.

A1. Verify that the v1 freeze path still points to the unauthorized regenerated blob and independently recover original v1 bytes from Git blob `4215a84a110406714e200618d280b70d0d1e7f46`. Verify its semantic hash matches the registered v1 SHA-256. Do not edit the original sample or its sealed outcomes.
A2. Create `institutional-accumulation-development-sample-freeze-v2.json` from the exact current regenerated freeze blob `6c343ec4a3dfebf194222d37bf4ab2dd13ac4f96`, bound to its registered source refresh identity (commit `fdbe6e0bfaa193626aa1197bcba52e5be49e5236`, source blob `74e5f719416999acdd7397af3c5196078bd2f992`). Do not re-resolve this artifact from latest `main` source blob `e8991ea4a67d5cfe04095413dac2eaadaa974771`.
A3. Restore the original v1 path byte-for-byte from blob `4215a84a110406714e200618d280b70d0d1e7f46`; verify the remote Git blob equals it. Record v1 and v2 identities in a deterministic lineage manifest, including exact freeze/source paths, commits, blobs, file and semantic hashes, row-level old-to-new source diff, cutoff, retrieval/commit context, and resolution policy. State explicitly that newer source blob `e8991ea4a67d5cfe04095413dac2eaadaa974771` is a later source version and is not silently substituted.
A4. Compare each frozen sample anchor/observation under the exact v1 and v2 source identities. Record all changed or newly resolvable values without opening outcomes, return labels, association outputs, or protected/holdout cases.
A5. Implement only the minimum version-aware resolver/contract and deterministic regression coverage needed to prove: (i) v1 resolves only against its pinned original source bytes, (ii) v2 resolves only against its separately pinned source bytes, (iii) current-source substitution fails closed, and (iv) v1 file/blob/hash remains unchanged.
A6. After A3–A5 validation succeeds, update only `.github/workflows/test-node-regression-suite.yml` path filters, aligning push and pull_request paths for `data_history_sma/**`, both v1/v2 freeze artifacts, the lineage manifest, and exact related tests. Retain the existing full `npm test` command. Do not modify any mutating freeze writer or weaken test assertions.
A7. Run bounded local checks, inspect the full diff, create a PR, and record commit/check evidence. Do not merge automatically.

Prompt A is complete only when the original v1 blob is restored unchanged, the regenerated snapshot is preserved as v2 with pinned source identity, deterministic lineage and all-anchor comparison artifacts exist, identity-selection regressions pass, CI push/PR filters cover the exact contract paths, and the PR contains all expected files. Stop for the paired Prompt B.

## Frozen Prompt B — independent closeout

Run only after Prompt A is complete and its PR is available. Fetch fresh main and independently check the PR head and relevant historical commits/blobs.

Verify:
1. `...development-sample-freeze-v1.json` has exact original blob `4215a84a110406714e200618d280b70d0d1e7f46` and semantic SHA-256 `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`.
2. `...development-sample-freeze-v2.json` is byte-identical to former blob `6c343ec4a3dfebf194222d37bf4ab2dd13ac4f96`, points only to source refresh commit/blob `fdbe6e0bfaa193626aa1197bcba52e5be49e5236` / `74e5f719416999acdd7397af3c5196078bd2f992`, and is not silently rebound to latest source blob `e8991ea4a67d5cfe04095413dac2eaadaa974771`.
3. Lineage manifest identifies both freeze/source identities, records the deterministic row diff and all frozen-observation comparisons; tests prove explicit version selection and fail-closed substitution.
4. `.github/workflows/test-node-regression-suite.yml` has aligned push and pull_request path filters for source, v1/v2 freezes, lineage manifest, and exact related tests; full `npm test` remains.
5. No source network/write, workflow dispatch/rerun, outcomes/holdouts, association/catalyst interpretation, protected case, universe, strategy, production, Pages, or YouTube actions occurred. Preserve any failing check/run IDs and diagnose only under these criteria; never lower acceptance.
6. The change is attributable to this v2.1 proposal and does not relabel Phase 0a Prompt B as PASS.

If any check fails, retain the original evidence and do only a bounded correction permitted by these frozen criteria. On PASS, write a durable closeout checkpoint and stop; do not auto-promote or begin another phase.

## Next-action rule

This proposal and paired prompts become executable only after the governance PR is merged to main and fresh-main verification confirms the exact proposal and paired texts. Merge does not itself execute Prompt A. A separate owner-issued `promptA` is required to begin.
