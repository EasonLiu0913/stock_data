# Institutional Accumulation — Catalyst artifact readiness handoff

Canonical active routing handoff:
`data_research/institutional-flow/institutional-accumulation-catalyst-artifact-readiness-handoff.md`

## Frozen project boundaries

- Phase 2 semantic SHA-256 remains `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`.
- methodology-development identities remain exactly `41`.
- protected `2454` remains motivation-only; outcomes unopened.
- stock/time holdouts remain sealed.
- development outcome SHA-256 remains `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`.
- association SHA-256 remains `779e2be6708e6d8bc55062058ede6178e2dd4cf7634621d05ab05228c31e7b68`.
- Withdrawal v6.0-v6.5 remains frozen and is not an Accumulation input.
- no catalyst/outcome association, threshold, score, optimized weighting, model, strategy, production behavior, scheduler, broad-universe rollout, generic-news layer, or outcome-driven tuning is authorized.
- legacy `/mops/web/ajax_t05st01` attempt count remains frozen at exactly `2`.

## Closed prerequisite state

- Catalyst artifact reconstruction/readiness: Prompt A COMPLETE / Prompt B PASS; 33 total / 0 ready / 33 not_pit_ready; Node24 run `34466672001`, job `102836756516`.
- PIT provenance resolution: Prompt A COMPLETE / Prompt B PASS; durable artifact `data_research/institutional-flow/institutional-accumulation-catalyst-pit-provenance-resolution-v1.json` remains 33 / 0 / 33 / 0 manual review, zero historical network, outcome-blind.
- Prospective PIT-safe capture contract: Prompt A COMPLETE / Prompt B PASS; checkpoint `4c782bebffb892540f74d0f5e1bc151065edfb59`.
- Prospective live-capture canary: Prompt A COMPLETE / Prompt B PASS; checkpoint `017ee0fb03b626e7607af10916594f33320c0b48`; first live run `34481151262`.
- Prospective observation audit: Prompt A COMPLETE / Prompt B PASS; checkpoint `57f5a9faca0c20bfe5339230fa521414e696f4ae`.
- Prospective repeat-capture canary: Prompt A COMPLETE / Prompt B PASS; closeout/promotion checkpoint `d26907c9b4ae371027820ec53fdda80a0a0c4011`; two bounded same-day windows now total 12 immutable observations for stocks 1102/1104/1216.

## Current round

`institutional-accumulation-catalyst-prospective-window-delta-audit-v1`

Status:
- Prompt A: **COMPLETE**
- Prompt B: **PREREGISTERED / PENDING**

Pre-Prompt-A durable baseline:
- `d26907c9b4ae371027820ec53fdda80a0a0c4011`

Operational start head:
- `542512c02efb65d93f4d310c8ee88cf7528efb13`
- Between baseline and operational start, `main` advanced only through unrelated 20260910 daily-gainers, 202608 MOPS monthly-revenue, and TWSE market-chart data updates. Routing, handoff, prospective raw root, 12-observation audit, and frozen PIT state were unchanged.

## Prompt A implementation and evidence

### Delta auditor

- `063fe4a02e734b07444b7483388ec8444ecb31a9` — `research: add prospective catalyst two-window delta auditor`.
- Added `scripts/audit_institutional_accumulation_catalyst_prospective_window_deltas.js`.
- The delta auditor calls the existing `auditObservations` implementation, which in turn uses the canonical prospective PIT validator, rather than weakening or reimplementing snapshot semantics.
- It requires exactly 12 valid observations, zero invalid/conflict observations, exactly stocks 1102/1104/1216, exactly two listing + two detail observations per stock, and 12 unique immutable observations.
- Pairing is deterministic by validated `collected_at` inside each stock + source interface; ties, invalid timestamps, missing/extra occurrences, request-key mismatch, or duplicate immutable identity fail closed.
- Each pair records exact source paths, collection times, immutable IDs, response SHA-256, response bytes, elapsed milliseconds, `raw_content_changed`, and byte delta.

### Delta regression

- `a9986dd3f76e60b90f76b8a95841abd447f03b88` — initial zero-network regression.
- First Node24 attempt exposed a bounded fixture defect: fixture files were written outside the canonical prospective root, so the inherited canonical path-identity validator correctly rejected them before delta pairing.
- Failed run `34493499343`, job `102925941917`, tested SHA `f2b98f9c4387688fbd5bdf2ac04266e8647f0342`. Existing suites passed; new delta suite was 1/8 pass because of the fixture path issue. No artifact checkpoint step ran and no source-network request occurred.
- `12afc0efb2d7cff9c2e41edb623d135774352148` — bounded repair: place fixtures under the canonical repo-relative prospective root.
- Final delta fixture suite covers deterministic two-window pairing, unchanged raw content acceptance, partial window rejection, third-window rejection, timestamp tie rejection, request-key mismatch rejection, unexpected stock/interface rejection, and inherited malformed/hash/base64/PIT/path/immutable fail-closed behavior.

### Artifact generation and durable checkpoint

- `f2b98f9c4387688fbd5bdf2ac04266e8647f0342` initially extended `.github/workflows/test-institutional-accumulation-catalyst-readiness.yml` with delta regression and deterministic artifact generation/checkpointing.
- After the fixture repair, Node24 run `34493611703`, job `102926333075`, tested SHA `12afc0efb2d7cff9c2e41edb623d135774352148`, completed SUCCESS and durably checkpointed the generated machine artifact.
- Durable artifact commit: `c68e92b142dfa1d11694658997c2ae4f8dddf127` — `research: checkpoint prospective catalyst two-window delta audit`.
- Machine artifact: `data_research/institutional-flow/institutional-accumulation-catalyst-prospective-window-delta-audit-v1.json`.
- Artifact Git blob/content identity: `cc5683ce3e33cb9b9c6ae74c42eb5c3a26f0ed00`.
- Observed result: `observation_count=12`, `pair_count=6`, `changed_pair_count=6`, `unchanged_pair_count=0`.
- Collection range remains `2026-09-10T13:12:36.863Z` through `2026-09-10T14:15:57.012Z`.
- All six pairs had `raw_content_changed=true`; all six had `response_bytes_delta=0`. This is raw-response identity evidence only and is explicitly not interpreted as catalyst significance.

### Final read-only deterministic gate

- Because pushes made by the workflow's `GITHUB_TOKEN` do not recursively create a new Actions run, the artifact checkpoint itself did not provide a new tested SHA containing the committed artifact.
- `04e6c0c9a91f08cc2f0040000f4dfe56089fcd61` — `ci: finalize read-only prospective delta audit gate` restores the readiness workflow to `contents: read` and removes the one-time writer/checkpoint step.
- Final Node24 workflow run `34493825499`, job `102927082435`, tested SHA `04e6c0c9a91f08cc2f0040000f4dfe56089fcd61`, Node `v24.20.0`, completed SUCCESS.
- Observed test counts: readiness 1/1; historical PIT 1/1; prospective PIT contract 5/5; canary adapter 6/6; observation audit 10/10; delta audit 8/8 — all PASS.
- The final read-only run regenerated both the existing 12-observation audit and the committed delta audit; `cmp` and `git diff --exit-code` passed for both.
- Readiness, historical PIT, 12-observation audit, and delta audit were deep-compared before/after and remained byte-equivalent.
- Final workflow permission is contents-read only; no live collector or source-fetch step exists in this gate.

## Bounded diff / protected-state confirmation

Baseline comparison `d26907c9b4ae371027820ec53fdda80a0a0c4011` → `04e6c0c9a91f08cc2f0040000f4dfe56089fcd61` contains this round's bounded research-owned paths:
- `scripts/audit_institutional_accumulation_catalyst_prospective_window_deltas.js`
- `tests/institutional_accumulation_catalyst_prospective_window_deltas.test.js`
- `.github/workflows/test-institutional-accumulation-catalyst-readiness.yml`
- `data_research/institutional-flow/institutional-accumulation-catalyst-prospective-window-delta-audit-v1.json`

Concurrent unrelated changes are limited to 20260910 daily-gainers artifacts, 202608 MOPS monthly-revenue data/snapshot/manifest, TWSE market-chart data, and daily-gainers research-pending data.

The existing `data_research/institutional-flow/institutional-accumulation-catalyst-prospective-observation-audit-v1.json` did not change from its 12-observation baseline, and no file under `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/` was added, modified, or deleted in this round. No live collector trigger metadata changed.

Historical PIT remains exactly 33 identities / 0 pit_ready / 33 not_pit_ready / 0 manual review, `network_collection_used=false`, `source_network_requests=0`, `outcome_blind=true`, and protected outcome/holdout/association flags remain unopened.

No protected Phase 2, historical Wave A/Wave C, development outcome, holdout, protected 2454 outcome, catalyst/outcome association, Withdrawal, model, strategy, production, scheduler, broad-universe, or generic-news path changed.

## Prompt A limitation

This round proves deterministic zero-network comparison of two same-day prospective capture windows only. It does not establish multi-day stability, catalyst significance, outcome association, scheduler readiness, broad-universe quality, historical PIT upgrades, model/strategy value, or production behavior. Raw-response hash changes are evidence of raw-response identity changes only.

Prompt A completion boundary reached. The Prompt B preregistered before Prompt A began is preserved verbatim below and remains pending; it has not been executed automatically.

## Prompt B — prospective two-window delta audit closeout

```text
Perform mandatory closeout for `institutional-accumulation-catalyst-prospective-window-delta-audit-v1` only after its Prompt A completes. Fetch current remote main and recover this exact Prompt B from durable pre-Prompt-A history. Independently verify: sole active routing still points to this handoff; the repeat-capture round has durable Prompt B PASS; historical 33/protected state remains frozen and unopened; this round made zero MOPS/source-network requests and did not dispatch the live collector; current 12-observation audit remains byte-identical and still reports exactly 12 valid / 0 invalid / 0 conflict observations for only 1102/1104/1216; the delta auditor consumes canonical validated observation evidence and requires exactly two complete windows; pairing is deterministic by validated collection time within each stock/interface and fails closed on tie, invalid time, missing/extra occurrence or request-key mismatch; machine delta audit durably contains exactly six stock/interface pairs with exact window paths/times/immutable IDs/response hashes/response bytes/elapsed milliseconds/raw_content_changed/byte delta plus aggregate changed/unchanged counts; it does not require raw content to change and does not interpret catalyst significance; fixture regressions fail closed for partial/third windows and inherited malformed/hash/base64/PIT/path/immutable/stock/interface defects; Node24 zero-network workflow passes at recorded tested SHA and deterministic regeneration byte-matches the committed delta artifact; baseline diff contains only bounded script/test/workflow/artifact/handoff changes plus explicitly classified unrelated concurrent changes and no protected Phase 2, historical Wave A/Wave C, outcome, holdout, association, Withdrawal, model/strategy/production/scheduler/broad-universe paths. Fix only bounded defects and restart verification. On PASS record exact commits/run/job/tested SHA/delta artifact identity/counts/limitations, promote only a justified next preregistered round, end `Prompt B closeout: PASS`, and stop without executing the promoted Prompt A.
```

## Stop conditions

- Do not execute Prompt B automatically.
- Do not make any MOPS/source-network request in this round.
- Do not dispatch the live collector or create a third capture window.
- Do not reopen or upgrade the historical 33 identities.
- Do not open protected outcomes, holdouts, association, or Withdrawal state.
- Do not mutate frozen Phase 2/outcome/association artifacts.
- Do not introduce thresholds, scores, models, strategies, production behavior, scheduler, broad-universe rollout, or generic-news features.
- Do not retry the legacy endpoint.
