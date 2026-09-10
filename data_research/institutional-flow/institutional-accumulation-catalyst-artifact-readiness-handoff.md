# Institutional Accumulation — Catalyst artifact readiness handoff

Canonical active routing handoff:
`data_research/institutional-flow/institutional-accumulation-catalyst-artifact-readiness-handoff.md`

This is the durable routing handoff for Institutional Accumulation / Catalyst Pre-positioning. Older detailed round history remains recoverable from git history.

## Frozen project boundaries

- Phase 2 semantic SHA-256 remains `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`.
- methodology-development identities remain exactly `41`.
- protected `2454` remains motivation-only; its outcomes remain unopened.
- stock/time holdout outcomes remain sealed.
- refreshed development outcome SHA-256 remains `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`.
- refreshed association SHA-256 remains `779e2be6708e6d8bc55062058ede6178e2dd4cf7634621d05ab05228c31e7b68`.
- Withdrawal v6.0-v6.5 remains frozen and is not an Accumulation input.
- no catalyst/outcome association, threshold, score, optimized weighting, model, strategy, production behavior, scheduler, broad-universe rollout, generic-news layer, or outcome-driven tuning is authorized.
- legacy `/mops/web/ajax_t05st01` attempt count remains frozen at exactly `2`.
- present-day API visibility, collection timestamps, and source event dates alone are never historical PIT/value-version proof.

## Closed prerequisite state

### Catalyst artifact reconstruction/readiness

`institutional-accumulation-catalyst-artifact-reconstruction-readiness-v1`
- Prompt A COMPLETE / Prompt B PASS.
- 33 total identities / 0 ready / 33 `not_pit_ready`.
- Node 24 closeout run `34466672001`, job `102836756516`.

### PIT provenance resolution

`institutional-accumulation-catalyst-pit-provenance-resolution-v1`
- Prompt A COMPLETE / Prompt B PASS.
- durable artifact: `data_research/institutional-flow/institutional-accumulation-catalyst-pit-provenance-resolution-v1.json`.
- frozen state remains exactly `identity_count=33`, `pit_ready=0`, `not_pit_ready=33`, `manual_review=0`, `network_collection_used=false`, `source_network_requests=0`, `outcome_blind=true`.
- protected 2454, development outcome, holdout, and catalyst/outcome-association read flags remain false.

### Prospective PIT-safe capture contract

`institutional-accumulation-catalyst-prospective-pit-capture-contract-v1`
- Prompt A COMPLETE / Prompt B PASS.
- closeout/promotion checkpoint `4c782bebffb892540f74d0f5e1bc151065edfb59`.
- append-only immutable raw-response capture, SHA-256 content identity, parser/methodology identity, `pit_known_at=collected_at`, no historical back-imputation, identical rerun no-op, conflicting immutable path fail-closed.

### Prospective live-capture canary

`institutional-accumulation-catalyst-prospective-live-capture-canary-v1`
- Prompt A COMPLETE / Prompt B PASS.
- closeout/promotion checkpoint `017ee0fb03b626e7607af10916594f33320c0b48`.
- first live run `34481151262` captured exactly stocks `1102`, `1104`, `1216`, one listing plus one verified detail request per stock, total six source requests, through independent hosted-runner physical jobs with `max-parallel:1`.
- first-window durable checkpoints: `224e5574f0f7adad2d33890f4948388b97685979`, `7122ab57a5a8947b5a7a15bcf223b25caf48145c`, `f71ab6e689ce18d3655fe64ba462555398654703`.

### Prospective observation audit

`institutional-accumulation-catalyst-prospective-observation-audit-v1`
- Prompt A COMPLETE / Prompt B PASS.
- closeout checkpoint `57f5a9faca0c20bfe5339230fa521414e696f4ae`.
- initial audit proved deterministic zero-network validation of the original six checked-in observations.

## Current round

`institutional-accumulation-catalyst-prospective-repeat-capture-canary-v1`

Status:
- Prompt A: **COMPLETE**
- Prompt B: **PREREGISTERED / PENDING**

Pre-Prompt-A durable baseline:
- `57f5a9faca0c20bfe5339230fa521414e696f4ae`.

Operational start head:
- `0ea3292ed10ebf7cdae64f887b3d767de6afb50b`.
- Between the preregistration checkpoint and operational start, `main` advanced only through unrelated 20260910 daily-data commits (`data_daily_gain_over_5/analysis-facts/20260910.json` and TWSE margin-maintenance data/index). Routing, this round, prospective snapshots, and protected research state were unchanged, so execution continued from current main rather than rolling back.

## Prompt A implementation and evidence

### A. Bounded zero-network repeated-window support

Commits:
- `a2153659b77318a52ff7bd5d41ee82000645e80e` — auditor accepts only one or two complete three-stock observation windows while preserving fail-closed PIT/identity validation.
- `766cf7d78ce71288ed9621ed956dde782e7c8caa` — regression adds two-window coverage, repeated raw-content-hash allowance, partial-window fail-closed behavior, and retains malformed/hash/base64/byte/identity/stock/interface/PIT rejection.
- `716c4ce6d54d7df1952dae743a4281f0fda2cbaa` — readiness workflow updated for repeated-window assertions and removes raw prospective-root `push.paths` trigger to avoid false intermediate failures while separate physical jobs append snapshots. The prospective root remains in sparse checkout and the final audit artifact still triggers deterministic validation.

The auditor continues to use `validateProspectiveSnapshot` and `snapshotRelativePath` from `scripts/institutional_accumulation_catalyst_prospective_pit_capture_contract.js` as the canonical contract source of truth. It does not require response SHA-256 uniqueness across windows because identical official response content may legitimately recur.

### B. Pre-live Node 24 gate

Workflow: `test: institutional accumulation catalyst readiness`.
- run `34487290435` — SUCCESS.
- job `102904719545` — SUCCESS.
- tested SHA `716c4ce6d54d7df1952dae743a4281f0fda2cbaa`.
- Node `v24.20.0`.
- readiness `1/1`, historical PIT `1/1`, prospective PIT contract `5/5`, canary adapter `6/6`, repeated observation audit `10/10`, all PASS.
- deterministic audit regeneration, byte comparison, and `git diff --exit-code` passed.
- this gate completed before any second-window MOPS/source request.

### C. Second bounded live capture window

Trigger checkpoint:
- `30517ac860f3bab25658c6a774bf86d1dd62f68b` — records this round, baseline, pre-live tested SHA/run/job, exact stocks and request caps.

Live workflow:
- `[研究] Institutional Accumulation Prospective Catalyst Canary` run `34487369703` — SUCCESS.
- exact stock set: `1102`, `1104`, `1216` only.
- independent hosted-runner physical matrix jobs with `max-parallel:1`; observed serial order 1102 → 1104 → 1216.
- production collector retained randomized 20–60 second pre-request cooldown.
- only official POST `/mops/api/t05st01` and POST `/mops/api/t05st01_detail` were used.
- no tight retry, legacy endpoint, historical range/backfill, Wave A refetch, or Wave C rewrite.
- total repository-controlled requests exactly `6`; total newly accepted snapshots exactly `6`.

Per-stock evidence:
- `1102`: job `102904995062`, `2 requests / 2 snapshots`, durable checkpoint `82ea4b0523c50f5993590fb50df9f49d1a298171`.
- `1104`: job `102904994656`, `2 requests / 2 snapshots`, durable checkpoint `7972c7a6075255155810cd53cfae273b96fff6c5`.
- `1216`: job `102904995016`, `2 requests / 2 snapshots`, durable checkpoint `1cf4def22ee405b32e32ed1311a88227f21b8113`.

New append-only snapshots:
- `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/prospective_material_information_listing/1102_115_all/20260910T141148260Z--a7f27b9a2e11db605349d955bb2e0a7cddbcfb839867857ff7337467935037fe.json`
- `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/prospective_material_information_detail/1102_1150115_1_sii/20260910T141248294Z--03b1cce2b4f0b0b6e6fa906be98413900251fa08565ae342621f163f5bd154c1.json`
- `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/prospective_material_information_listing/1104_115_all/20260910T141409604Z--b990ce1d6d257455954c24140d57d376e898c09bdcc44ba69e63f05c85dfc1d1.json`
- `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/prospective_material_information_detail/1104_1150113_1_sii/20260910T141440520Z--b4af7cc7778f09c5f28a1377aad392e8bc5206ebd46b69cdbbafcf313c4b61d5.json`
- `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/prospective_material_information_listing/1216_115_all/20260910T141521079Z--663bae89aa899779c0332cd77706de0ec7c9e17dd24b84aaf4a867f2a1117aa6.json`
- `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/prospective_material_information_detail/1216_1150109_1_sii/20260910T141557012Z--9ae93f1291ff6a8abd0dc360bc0105ad76ba0d054d3765bb5c5bd82e08345372.json`

All six new snapshots passed remote durable validation for contract/methodology identity, canonical immutable path, raw base64/byte/hash identity, `pit_known_at=collected_at`, and `historical_back_imputation_allowed=false`. Baseline comparison shows the original six first-window snapshots were not modified or deleted.

### D. Deterministic longitudinal audit

Audit update commit:
- `247cd1663e2ba4b642e2a7fb6fbfd4b375f1de1b` — `research: extend prospective catalyst observation audit to repeat window`.

Audit artifact:
- `data_research/institutional-flow/institutional-accumulation-catalyst-prospective-observation-audit-v1.json`.
- Git blob/content identity: `86a3b0b8059e8f78ec46a01a16cb3498072e453c`.

Observed result:
- `valid_observation_count=12`;
- `invalid_observation_count=0`;
- `conflict_count=0`;
- exactly stocks `1102`, `1104`, `1216`;
- each stock exactly `total=4`, `listing=2`, `detail=2`;
- interfaces exactly `6 listing + 6 detail`;
- `unique_immutable_snapshot_count=12`;
- actual `unique_response_sha256_count=12` for this run, while uniqueness is intentionally not an acceptance requirement;
- collection range `2026-09-10T13:12:36.863Z` through `2026-09-10T14:15:57.012Z`;
- exact source paths, immutable IDs, response hashes, response byte lengths, parser/methodology identity, and collection timestamps are recorded.

### E. Final Node 24 deterministic gate

Workflow: `test: institutional accumulation catalyst readiness`.
- run `34488284071` — SUCCESS.
- job `102908102138` — SUCCESS.
- tested SHA `247cd1663e2ba4b642e2a7fb6fbfd4b375f1de1b`.
- Node `v24.20.0`.
- readiness `1/1`, historical PIT `1/1`, prospective PIT contract `5/5`, canary adapter `6/6`, repeated observation audit `10/10`, all PASS.
- workflow regenerated the 12-observation audit with `--write`; byte comparison and `git diff --exit-code` passed.
- readiness and historical PIT artifacts were deep-compared before/after and remained unchanged.

### F. Bounded diff / protected-state confirmation

Baseline comparison `57f5a9faca0c20bfe5339230fa521414e696f4ae` → `247cd1663e2ba4b642e2a7fb6fbfd4b375f1de1b` contains the expected round-owned changes: auditor, auditor tests, readiness workflow adjustment, trigger metadata, six new prospective snapshots, and regenerated audit. Unrelated concurrent daily-data changes are limited to daily-gainers facts and TWSE margin-maintenance artifacts and were classified separately.

No original prospective snapshot was modified/deleted. No protected Phase 2, historical Wave A/Wave C, development outcome, holdout, protected 2454 outcome, catalyst/outcome association, Withdrawal, model, strategy, production, scheduler, broad-universe, or generic-news path changed.

Current historical PIT artifact remains exactly:
- `identity_count=33`;
- `pit_ready_identity_count=0`;
- `not_pit_ready_identity_count=33`;
- `manual_review_identity_count=0`;
- `network_collection_used=false`;
- `source_network_requests=0`;
- `outcome_blind=true`;
- protected 2454/outcome/holdout/association read flags false;
- Phase 2 semantic SHA and methodology-development count 41 unchanged.

## Prompt A limitation

This round proves append-only longitudinal behavior across exactly two bounded capture windows for the same three stocks. It does not establish broad-universe collection quality, long-duration stability, scheduler readiness, historical PIT upgrades, or any catalyst/outcome relationship. No scheduler/recurring automation or broad rollout is authorized by this result.

Prompt A completion boundary reached. The Prompt B preregistered before Prompt A began is preserved verbatim below and remains pending; it has not been executed automatically.

## Prompt B — bounded prospective repeat-capture canary closeout

```text
Perform mandatory closeout for `institutional-accumulation-catalyst-prospective-repeat-capture-canary-v1` only after its Prompt A completes. Fetch current remote `main` and recover this exact Prompt B from durable pre-Prompt-A history. Independently verify: sole active routing still points to this handoff; the preceding observation-audit round has durable Prompt B PASS; historical 33 identities remain exactly 0 pit_ready / 33 not_pit_ready and protected state remains unopened; the pre-live Node 24 zero-network gate passed before any new source request; exactly one additional bounded live capture window ran for only stocks 1102, 1104, 1216 through independent fresh-runner jobs with max-parallel 1; total repository-controlled source requests were <=6 with one listing and at most one detail per stock and production 20-60 second pre-request cooldown; only official t05st01/t05st01_detail APIs were used; no legacy endpoint, historical backfill, Wave A/Wave C refetch/rewrite, scheduler, or broad-universe rollout occurred; the original six prospective snapshots remain byte-identical and durable; every newly accepted snapshot is append-only, raw-base64/byte/hash validated, has canonical immutable identity/path, parser/methodology identity, pit_known_at equal to collected_at, historical_back_imputation_allowed=false, and remote durable checkpoint evidence; race-safe checkpoint conflicts fail closed; the evolved deterministic audit correctly represents repeated windows, rejects malformed/hash/base64/byte/PIT/path/stock/interface conflicts, and on a fully successful second window reports 12 valid / 0 invalid / 0 conflict, exactly three stocks with 2 listing + 2 detail each, 12 unique immutable snapshot identities, while reporting rather than requiring uniqueness of repeated raw-response SHA-256 content; final Node 24 zero-network workflow passes at the recorded tested SHA and deterministic regeneration byte-matches the committed audit; compare the bounded changed-file set against the pre-Prompt-A baseline and confirm no protected Phase 2, outcome, holdout, association, Withdrawal, model/strategy/production/scheduler paths changed. Fix only bounded defects and restart verification. On PASS record exact commits/runs/jobs/request counts/checkpoints/audit content identity/limitations, promote only a justified next preregistered round, end `Prompt B closeout: PASS`, and stop without executing the promoted Prompt A.
```

## Stop conditions

- Do not execute Prompt B automatically.
- Do not promote or execute another Prompt A before this Prompt B passes.
- Do not reopen or upgrade the historical 33 identities.
- Do not open protected outcomes, holdouts, association, or Withdrawal state.
- Do not mutate frozen Phase 2/outcome/association artifacts.
- Do not introduce thresholds, scores, models, strategies, production behavior, scheduler, broad-universe rollout, or generic-news features.
- Do not retry the legacy endpoint.
- Fail closed whenever PIT/value-version proof, immutable identity, response validity, or append-only durability is unresolved.
