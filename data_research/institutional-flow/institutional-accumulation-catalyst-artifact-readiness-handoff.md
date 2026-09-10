# Institutional Accumulation — Catalyst artifact readiness handoff

Canonical active routing handoff:
`data_research/institutional-flow/institutional-accumulation-catalyst-artifact-readiness-handoff.md`

This is the current durable routing handoff for Institutional Accumulation / Catalyst Pre-positioning. Older detailed round history remains recoverable from git history.

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
- current frozen state remains exactly `identity_count=33`, `pit_ready=0`, `not_pit_ready=33`, `manual_review=0`, `network_collection_used=false`, `source_network_requests=0`, `outcome_blind=true`.
- protected `2454`, development outcome, holdout, and catalyst/outcome-association read flags remain false.
- Node 24 closeout run `34478084243`, job `102873698591`.

### Prospective PIT-safe capture contract

`institutional-accumulation-catalyst-prospective-pit-capture-contract-v1`
- Prompt A COMPLETE / Prompt B PASS.
- Prompt B closeout/promotion checkpoint `4c782bebffb892540f74d0f5e1bc151065edfb59`.
- contract remains append-only immutable raw-response capture with SHA-256 content identity, parser/methodology identity, `pit_known_at=collected_at`, no historical back-imputation, deterministic identical rerun as no-op, and conflicting same immutable path as fail-closed.

### Prospective live-capture canary

`institutional-accumulation-catalyst-prospective-live-capture-canary-v1`
- Prompt A COMPLETE / Prompt B PASS.
- closeout/promotion checkpoint `017ee0fb03b626e7607af10916594f33320c0b48`.
- live run `34481151262` used exactly stocks `1102`, `1104`, `1216`, each as an independent fresh-runner physical matrix job with `max-parallel:1`.
- total source requests exactly 6: one listing and one verified detail request per stock.
- durable checkpoint commits: `224e5574f0f7adad2d33890f4948388b97685979` (1102), `7122ab57a5a8947b5a7a15bcf223b25caf48145c` (1104), `f71ab6e689ce18d3655fe64ba462555398654703` (1216).
- exactly six accepted immutable snapshots remain under `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/`.
- no historical backfill, legacy retry, historical Wave A/Wave C rewrite, protected outcome read, association, model, or strategy work occurred.

## Current round

`institutional-accumulation-catalyst-prospective-observation-audit-v1`

Status:
- Prompt A: **COMPLETE**
- Prompt B: **PREREGISTERED / PENDING**

Pre-Prompt-A durable baseline:
- `017ee0fb03b626e7607af10916594f33320c0b48`.

Operational start head:
- `23b4e9502a60b479bcbaad6384b6530d3af2b1d6`.
- `main` had advanced after the preregistration checkpoint through unrelated TWSE margin/flow data-only commits; routing, handoff round identity, six prospective snapshots, and protected research state were unchanged, so Prompt A continued from current main rather than rolling back.

### Prompt A objective and result

Objective: create a deterministic, zero-network, machine-readable audit over the six checked-in prospective live-canary snapshots using the existing prospective PIT contract validator as the source of truth.

Result: **PASS / completion boundary reached**.

Durable implementation commits:
- `d467cd0358e649980a2225aa670889727fd846dd` — `research: add prospective catalyst observation audit`; adds `scripts/audit_institutional_accumulation_catalyst_prospective_observations.js`.
- `77026bcb2c333bcf2a730594e513b05d52be3f2d` — `test: add prospective catalyst observation audit regression`; adds `tests/institutional_accumulation_catalyst_prospective_observations.test.js`.
- `f377eae7ebe4a451fdce30b525149a0d3518d93a` — `research: add deterministic prospective catalyst observation audit artifact`; adds `data_research/institutional-flow/institutional-accumulation-catalyst-prospective-observation-audit-v1.json`.
- `998b4242db149c9f61cbbedbc78d506e85ac136b` — `test: validate deterministic prospective catalyst observation audit`; extends `.github/workflows/test-institutional-accumulation-catalyst-readiness.yml`.

Concurrent unrelated commit between the bounded implementation commits:
- `1104768fd1f0f320c7634ecffbd3a23229f7fd1f` — `analysis: refresh 5% AI facts 20260910`, adding only `data_daily_gain_over_5/analysis-facts/20260910.json`; it is unrelated to this round and did not alter the acceptance evidence or protected paths.

### Deterministic audit contract

Entry points:
- `scripts/audit_institutional_accumulation_catalyst_prospective_observations.js` — deterministic zero-network auditor.
- `tests/institutional_accumulation_catalyst_prospective_observations.test.js` — fail-closed fixture regression.
- `data_research/institutional-flow/institutional-accumulation-catalyst-prospective-observation-audit-v1.json` — durable machine-readable audit.
- `scripts/institutional_accumulation_catalyst_prospective_pit_capture_contract.js` — canonical immutable snapshot validator reused by the audit.
- `.github/workflows/test-institutional-accumulation-catalyst-readiness.yml` — Node 24 zero-network deterministic regeneration gate.
- `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/` — checked-in six-snapshot source root.

The auditor:
- recursively enumerates only JSON snapshots in deterministic sorted order;
- parses each snapshot and validates it with the existing prospective PIT contract validator;
- verifies canonical base64 roundtrip, decoded byte length, raw-response SHA-256, immutable snapshot identity, canonical snapshot path, expected methodology identity, expected stock/interface identity, `pit_known_at=collected_at`, and `historical_back_imputation_allowed=false`;
- fails closed on malformed JSON, invalid base64/length, raw hash mismatch, duplicate/conflicting immutable identity, unexpected stock/interface, invalid PIT metadata, or unexpected non-JSON entry;
- has no `generated_at` or other clock-dependent output, so the same checked-in source set serializes byte-for-byte identically.

### Durable audit result

`data_research/institutional-flow/institutional-accumulation-catalyst-prospective-observation-audit-v1.json` reports:
- `network_collection_used=false`;
- `valid_observation_count=6`;
- `invalid_observation_count=0`;
- `conflict_count=0`;
- `stock_count=3`;
- stocks exactly `1102`, `1104`, `1216`;
- each stock exactly `total=2`, `listing=1`, `detail=1`;
- source interfaces exactly 3 listing + 3 detail;
- `unique_immutable_snapshot_count=6`;
- `unique_response_sha256_count=6`;
- collection range `2026-09-10T13:12:36.863Z` through `2026-09-10T13:17:19.439Z`;
- one methodology identity: `institutional-accumulation-catalyst-prospective-live-capture-canary-v1`;
- one parser identity: `institutional-accumulation-catalyst-prospective-canary-parser-v1`;
- exact source paths, immutable IDs, response hashes, byte lengths and collection timestamps for all six observations.

### Node 24 zero-network verification

Workflow:
- `test: institutional accumulation catalyst readiness`.
- run `34484229269` — **SUCCESS**.
- job `102894333809` (`regression`) — **SUCCESS**.
- tested SHA `998b4242db149c9f61cbbedbc78d506e85ac136b`.
- Node `v24.20.0`.

Observed regression counts:
- catalyst artifact readiness `1/1` PASS;
- historical PIT provenance `1/1` PASS;
- prospective PIT contract `5/5` PASS;
- prospective live-canary adapter `6/6` PASS;
- prospective observation audit fixtures `7/7` PASS.

The workflow then regenerated `institutional-accumulation-catalyst-prospective-observation-audit-v1.json` with `--write`; both byte comparison against the committed artifact and `git diff --exit-code` passed. It also deep-compared the readiness and historical PIT artifacts before/after and found no change. This workflow has contents-read permission and no MOPS/source-fetch stage; this round made zero MOPS/source-network requests.

### Unrelated global CI failure classification

The same `998b4242...` push also triggered `[00 網站部署] Public Page Registry CI` run `34484229289`, whose deployment-race audit failed on the pre-existing `build-tsmc-equipment-demand-dashboard.yml` reusable deployment-chain also watching `data/normalized` push paths. The failure is outside this round's four owned audit paths and does not affect the zero-network audit, its durable artifact, routing, PIT contract, or protected research state. It is recorded but intentionally not expanded into this bounded research round.

### Protected-state confirmation

- historical PIT remains exactly `33 identities / 0 pit_ready / 33 not_pit_ready / 0 manual_review`;
- `network_collection_used=false`, `source_network_requests=0`, `outcome_blind=true` remain unchanged in the historical PIT artifact;
- no historical 33 identity upgrade/rewrite occurred;
- no historical Wave A/Wave C raw evidence was refetched or mutated;
- no new MOPS/source-network request occurred in this round;
- legacy `/mops/web/ajax_t05st01` was not retried;
- development outcomes, stock/time holdouts, protected `2454` outcomes, future-return data, catalyst/outcome association, and Withdrawal state remained unopened/unchanged;
- no threshold, score, optimized weighting, model, strategy, production behavior, scheduler, broad-universe rollout, or generic-news layer was introduced.

### Prompt A limitation

This round audits only the six already checked-in live-canary observations from one bounded collection window. It does not establish longitudinal stability, broad-universe collection quality, scheduling readiness, historical PIT upgrades, or catalyst/outcome relationships.

Prompt A completion boundary reached. The exact Prompt B preregistered before Prompt A began is preserved below and remains pending; it has not been executed automatically.

## Prompt B — prospective observation audit closeout

```text
Perform mandatory closeout for `institutional-accumulation-catalyst-prospective-observation-audit-v1` only after its Prompt A completes. Fetch current remote `main` and recover this exact Prompt B from durable pre-Prompt-A history. Independently verify: sole active routing still points to this handoff; the preceding live-capture canary round has durable Prompt B PASS; historical 33 identities remain exactly 0 pit_ready / 33 not_pit_ready and protected outcome/holdout/association state remains unopened; this round made zero MOPS/source-network requests and did not retry the legacy endpoint; the audit implementation uses the existing prospective PIT contract validator as source of truth; the generated machine-readable audit exists durably and deterministically enumerates exactly six valid checked-in observations across exactly stocks 1102, 1104, 1216 with one listing and one detail per stock, zero invalid/conflict observations, exact source paths, immutable snapshot IDs, response SHA-256 identities and collection-time range; raw base64 bytes/length/hash, pit_known_at=collected_at, methodology identity and historical_back_imputation_allowed=false are validated; fixture regressions fail closed for malformed JSON, hash/byte mismatch, duplicate immutable identity with conflicting content, unexpected stock/interface and invalid PIT metadata; Node 24 zero-network workflow passes at the recorded tested SHA and deterministic regeneration matches the committed audit; compare the bounded changed-file set against the pre-Prompt-A baseline and confirm no protected Phase 2, historical Wave A/Wave C, outcome, holdout, association, Withdrawal, model/strategy/production/scheduler paths changed. Fix only bounded defects and restart verification. On PASS record exact commits/runs/jobs/tested SHA/audit identity/limitations, promote only a justified next preregistered round, end `Prompt B closeout: PASS`, and stop without executing the promoted Prompt A.
```

## Stop conditions

- Do not execute Prompt B automatically.
- Do not promote or execute a future Prompt A before this Prompt B passes.
- Do not reopen or upgrade the historical 33 identities.
- Do not open protected outcomes, holdouts, association, or Withdrawal state.
- Do not mutate frozen Phase 2/outcome/association artifacts.
- Do not introduce catalyst/outcome association, thresholds, scores, models, strategies, production behavior, scheduler, broad-universe rollout, or generic-news features.
- Do not retry the legacy endpoint.
- Fail closed whenever PIT/value-version proof, immutable content identity, or observation validity is unresolved.
