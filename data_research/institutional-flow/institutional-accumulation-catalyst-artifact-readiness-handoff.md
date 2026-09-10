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
- PIT provenance resolution: Prompt A COMPLETE / Prompt B PASS; durable artifact remains 33 / 0 / 33 / 0 manual review, zero historical network, outcome-blind.
- Prospective PIT-safe capture contract: Prompt A COMPLETE / Prompt B PASS; checkpoint `4c782bebffb892540f74d0f5e1bc151065edfb59`.
- Prospective live-capture canary: Prompt A COMPLETE / Prompt B PASS; checkpoint `017ee0fb03b626e7607af10916594f33320c0b48`; first live run `34481151262`.
- Prospective observation audit: Prompt A COMPLETE / Prompt B PASS; checkpoint `57f5a9faca0c20bfe5339230fa521414e696f4ae`.
- Prospective repeat-capture canary: Prompt A COMPLETE / Prompt B PASS; checkpoint `d26907c9b4ae371027820ec53fdda80a0a0c4011`; two bounded same-day windows total 12 immutable observations for 1102/1104/1216.

## Closed round — prospective two-window delta audit

Round: `institutional-accumulation-catalyst-prospective-window-delta-audit-v1`

Status:
- Prompt A: **COMPLETE**
- **Prompt B closeout: PASS**

Pre-Prompt-A durable baseline:
- `d26907c9b4ae371027820ec53fdda80a0a0c4011`

Prompt A checkpoint:
- `6f0cc9181767e7f20b323601d6f8416d58cb3a4c`

### Prompt B independent verification

The exact phase-specific Prompt B was recovered from the durable pre-Prompt-A handoff at `d26907c9b4ae371027820ec53fdda80a0a0c4011`, not from conversation state or the Prompt A completion summary.

1. Current routing has exactly one active task, `institutional-accumulation`, routed to this handoff — PASS.
2. The preceding repeat-capture round has durable Prompt B PASS at baseline `d26907c9...` — PASS.
3. Historical PIT remains exactly `identity_count=33`, `pit_ready=0`, `not_pit_ready=33`, `manual_review=0`, `network_collection_used=false`, `source_network_requests=0`, `outcome_blind=true`; protected 2454/development outcome/holdout/association flags remain unopened — PASS.
4. Current observation audit blob remains byte-identical to the pre-A baseline: `86a3b0b8059e8f78ec46a01a16cb3498072e453c`. It still reports exactly `12 valid / 0 invalid / 0 conflict`, only stocks 1102/1104/1216, each `4 total / 2 listing / 2 detail`, with 12 unique immutable observations — PASS.
5. Baseline comparison `d26907c9... -> 6f0cc918...` contains no added/modified/deleted file under `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/`; no third capture window or live-collector data was introduced — PASS.
6. Delta auditor `scripts/audit_institutional_accumulation_catalyst_prospective_window_deltas.js` calls the existing canonical observation auditor, requires exactly the current 12 valid observations and two occurrences per stock/interface, and does not weaken snapshot validation — PASS.
7. Pairing is deterministic by validated ISO `collected_at` within each stock + source interface. Invalid timestamps, ties, missing/extra occurrences, request-key mismatch, or duplicate immutable identities fail closed in code — PASS.
8. Delta artifact `data_research/institutional-flow/institutional-accumulation-catalyst-prospective-window-delta-audit-v1.json` is durable with blob identity `cc5683ce3e33cb9b9c6ae74c42eb5c3a26f0ed00` and reports exactly `observation_count=12`, `pair_count=6`, `changed_pair_count=6`, `unchanged_pair_count=0` — PASS.
9. Each of the six pairs records stock, interface, source-request key, exact window-1/window-2 path, collected_at, immutable snapshot ID, response SHA-256, response bytes, elapsed milliseconds, `raw_content_changed`, and byte delta. The artifact explicitly records that raw-content change is not catalyst significance and that outcome association remains unopened — PASS.
10. Regression `tests/institutional_accumulation_catalyst_prospective_window_deltas.test.js` covers deterministic pairing, unchanged-content acceptance, partial-window rejection, third-window rejection, timestamp-tie rejection, request-key mismatch, unexpected stock/interface, and inherited malformed/hash/base64/PIT/path/immutable fail-closed behavior — PASS.
11. The initial failed Node24 run `34493499343`, job `102925941917`, correctly exposed only a fixture-path defect; inherited canonical path validation rejected noncanonical fixture paths. No artifact checkpoint or source-network request occurred. The bounded repair was commit `12afc0efb2d7cff9c2e41edb623d135774352148` — classified and closed.
12. Artifact-generation run `34493611703`, job `102926333075`, tested SHA `12afc0efb2d7cff9c2e41edb623d135774352148`, completed SUCCESS and durably checkpointed the delta artifact at commit `c68e92b142dfa1d11694658997c2ae4f8dddf127` — PASS.
13. Final read-only Node24 deterministic run `34493825499`, job `102927082435`, tested SHA `04e6c0c9a91f08cc2f0040000f4dfe56089fcd61`, Node `v24.20.0`, completed SUCCESS. Test counts were readiness `1/1`, historical PIT `1/1`, prospective PIT contract `5/5`, canary adapter `6/6`, observation audit `10/10`, delta audit `8/8` — PASS.
14. Final workflow permission is `contents: read`. It regenerated both observation and delta audits and passed `cmp`, `git diff --exit-code`, and deep-equality checks against committed artifacts. It has no live source-fetch step — PASS.
15. Baseline diff contains this round's bounded research-owned script/test/workflow/delta-artifact/handoff changes plus explicitly classified concurrent 20260910 daily-gainers, 202608 MOPS monthly-revenue, TWSE market-chart, and daily-gainers research-pending data. No protected Phase 2, Wave A/Wave C, outcome, holdout, association, Withdrawal, model, strategy, production, scheduler, broad-universe, or generic-news path changed — PASS.
16. This round made zero MOPS/source-network requests and did not dispatch the live collector — PASS.

Closeout limitation:
- this proves deterministic zero-network comparison of exactly two same-day prospective windows;
- all six pairs changed raw-response SHA identity while response byte lengths stayed equal, but this must not be interpreted as catalyst importance or business meaning;
- multi-day stability, catalyst/outcome relationship, broad-universe quality, scheduler readiness, historical PIT upgrade, model/strategy value, and production behavior remain unproven and unauthorized.

**Prompt B closeout: PASS**

## Current active round

`institutional-accumulation-catalyst-prospective-cross-day-repeat-capture-canary-v1`

Status:
- Prompt A: **NOT STARTED / ACTIVE**
- Prompt B: **PREREGISTERED / PENDING**

Promotion does not execute Prompt A automatically.

## Next round objective

The two existing windows are both from 2026-09-10. The next smallest evidence step is one additional **cross-day** bounded prospective capture for the same three stocks, without scheduler or universe expansion. It must not start until the next capture is both on a later Asia/Taipei calendar date and at least 12 hours after the latest existing collection timestamp (`2026-09-10T14:15:57.012Z`). This prevents a near-midnight third sample from being mislabeled as meaningful multi-day evidence.

Exact entry points:
- `scripts/institutional_accumulation_catalyst_prospective_pit_capture_contract.js`
- `scripts/collect_institutional_accumulation_catalyst_prospective_canary.js`
- `scripts/audit_institutional_accumulation_catalyst_prospective_observations.js`
- `scripts/audit_institutional_accumulation_catalyst_prospective_window_deltas.js`
- `tests/institutional_accumulation_catalyst_prospective_pit_capture_contract.test.js`
- `tests/institutional_accumulation_catalyst_prospective_canary.test.js`
- `tests/institutional_accumulation_catalyst_prospective_observations.test.js`
- `tests/institutional_accumulation_catalyst_prospective_window_deltas.test.js`
- `.github/workflows/collect-institutional-accumulation-catalyst-prospective-canary.yml`
- `.github/workflows/test-institutional-accumulation-catalyst-readiness.yml`
- `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/`
- `data_research/institutional-flow/institutional-accumulation-catalyst-prospective-observation-audit-v1.json`
- `data_research/institutional-flow/institutional-accumulation-catalyst-prospective-window-delta-audit-v1.json`
- `data_research/institutional-flow/institutional-accumulation-catalyst-pit-provenance-resolution-v1.json`
- `docs/agent-prompts/task-routing.json`
- `AGENTS.md`

## Prompt A — cross-day repeat-capture canary

```text
Continue the Institutional Accumulation / Catalyst Pre-positioning project only if `docs/agent-prompts/task-routing.json` still routes the sole active task to `data_research/institutional-flow/institutional-accumulation-catalyst-artifact-readiness-handoff.md` and round `institutional-accumulation-catalyst-prospective-cross-day-repeat-capture-canary-v1` remains Prompt A NOT STARTED / ACTIVE.

Before work:
1. fetch current remote `main`; read repository-root `AGENTS.md`, `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, routing, this handoff, the canonical PIT contract, collector, observation auditor, two-window delta auditor, their tests, both relevant workflows, current 12-observation audit, current two-window delta audit, and frozen PIT provenance artifact;
2. recover this exact Prompt A + Prompt B pair from durable pre-Prompt-A history;
3. independently confirm the two-window delta-audit round has durable Prompt B PASS, current raw root still contains exactly the 12 accepted observations, current observation/delta artifacts retain their recorded blob identities, and historical/protected state remains frozen;
4. classify any concurrent changes before continuing.

Eligibility gate before any live request:
- derive the latest accepted collection timestamp from canonical validated evidence; it must remain `2026-09-10T14:15:57.012Z` unless a concurrent change is explicitly classified;
- the proposed new capture must occur on an Asia/Taipei calendar date later than 2026-09-10 **and** at least 12 elapsed hours after that latest timestamp;
- if either condition is not yet true, make no source request, do not dispatch the collector, do not mark Prompt A complete, and stop with an explicit `Prompt A not yet eligible for cross-day capture` status.

Objective: prove one additional cross-day forward-only capture window for exactly stocks 1102, 1104, 1216 while preserving append-only PIT identity and the already-closed two-window delta artifact. This remains evidence collection only.

Ordered execution after eligibility is satisfied:
A. Before any live request, make only the bounded zero-network auditor/test/readiness changes required to accept and deterministically audit exactly three complete windows without weakening canonical snapshot validation. Preserve the existing two-window delta artifact byte-identically; if the current two-window delta auditor would become invalid merely because a third window exists, evolve its input boundary so the already-closed first-two-window evidence remains reproducible rather than silently redefining that artifact.
B. Run the Node 24 zero-network readiness gate and require all contract/canary/observation/delta regressions to pass before source requests. Repair only bounded defects; do not launch live requests until green.
C. Launch exactly one additional live capture window using `.github/workflows/collect-institutional-accumulation-catalyst-prospective-canary.yml` for only 1102, 1104, 1216. Keep independent fresh-runner physical jobs, `max-parallel:1`, randomized production 20-60 second pre-request cooldown, one listing and at most one verified detail request per stock, no tight retry, and total repository-controlled source requests <=6.
D. Use only official `POST /mops/api/t05st01` and `POST /mops/api/t05st01_detail`. Never retry `/mops/web/ajax_t05st01`, never run historical range/backfill, and never touch historical Wave A/Wave C.
E. Require race-safe append-only checkpointing. All original 12 snapshot files must remain byte-identical and present. Every new accepted snapshot must satisfy raw base64/decoded length/response SHA-256/parser/methodology/PIT/canonical immutable-path validation and `historical_back_imputation_allowed=false`.
F. After all three jobs checkpoint durably, regenerate the canonical prospective observation audit. Expected successful shape is 18 valid / 0 invalid / 0 conflict, exactly the same three stocks, each 6 total / 3 listing / 3 detail, 9 listing + 9 detail, and 18 unique immutable snapshot IDs. Report actual unique response-hash count; do not require 18 unique raw hashes.
G. Add or regenerate only the minimum deterministic cross-day evidence needed to distinguish the new third window from the two same-day windows. Record exact local/UTC window dates and elapsed spacing, but do not interpret catalyst significance or open outcomes.
H. Run the final Node 24 read-only deterministic gate on the final checked-in state and require committed audit regeneration to byte-match.
I. Compare the pre-A baseline to final Prompt-A head. Only bounded auditor/test/readiness changes, six-or-fewer new prospective snapshots, regenerated/new cross-day audit evidence, trigger/checkpoint metadata if required, and this handoff may belong to this round; classify unrelated concurrent data-only changes separately.

Frozen/safety rules:
- no scheduler or recurring automation;
- no broad-universe expansion;
- no historical PIT upgrade/backfill or Wave A/Wave C refetch;
- no development outcomes, holdouts, protected 2454 outcomes, future returns, catalyst/outcome association, Withdrawal, threshold, score, optimized weighting, model, strategy, production behavior, or generic-news layer;
- zero legacy endpoint retries;
- fail closed on degraded/WAF/security/malformed/application/schema/identity ambiguity before snapshot acceptance;
- raw response changes are not business significance;
- do not execute Prompt B automatically.

Completion contract:
- eligibility gate was satisfied before any live request;
- pre-live Node24 zero-network gate PASS;
- exactly one bounded cross-day live window completes within <=6 repository-controlled requests;
- original 12 snapshots and the already-closed two-window delta artifact remain byte-identical;
- all new accepted snapshots are durable append-only on current remote main;
- deterministic audit evidence records the exact observed three-window/cross-day counts and spacing with no conflicts;
- final Node24 read-only deterministic gate PASS at recorded tested SHA;
- canonical handoff records exact implementation commits, live run/job IDs, request/snapshot counts, checkpoint commits, artifact identities/counts/limitations, and preserves the exact preregistered Prompt B below;
- stop with `Prompt A complete — ready for Prompt B.`
```

## Prompt B — cross-day repeat-capture canary closeout

```text
Perform mandatory closeout for `institutional-accumulation-catalyst-prospective-cross-day-repeat-capture-canary-v1` only after its Prompt A completes. Fetch current remote `main` and recover this exact Prompt B from durable pre-Prompt-A history. Independently verify: sole active routing still points to this handoff; the preceding two-window delta-audit round has durable Prompt B PASS; historical 33/protected state remains frozen and unopened; eligibility was satisfied before any source request, with the third window occurring on an Asia/Taipei calendar date later than 2026-09-10 and at least 12 elapsed hours after `2026-09-10T14:15:57.012Z`; the pre-live Node24 zero-network gate passed before the third-window source requests; exactly one additional bounded live capture window ran for only 1102/1104/1216 through independent fresh-runner jobs with max-parallel 1; total repository-controlled source requests were <=6 with one listing and at most one detail per stock and production 20-60 second pre-request cooldown; only official t05st01/t05st01_detail APIs were used; no legacy endpoint, historical backfill, Wave A/Wave C refetch/rewrite, scheduler, or broad-universe rollout occurred; the original 12 snapshots remain byte-identical and durable; the previously closed two-window delta artifact remains byte-identical and reproducible rather than being silently redefined by the third window; every newly accepted snapshot is append-only and passes raw-base64/byte/hash/parser/methodology/PIT/canonical-path validation with historical_back_imputation_allowed=false; the final observation audit correctly represents exactly three complete windows and, on full success, reports 18 valid / 0 invalid / 0 conflict, the same three stocks with 3 listing + 3 detail each and 18 unique immutable IDs while merely reporting actual raw-response hash uniqueness; deterministic cross-day evidence records the new window's exact UTC/Asia-Taipei date and spacing without interpreting catalyst significance or opening outcomes; final Node24 read-only workflow passes at recorded tested SHA and deterministic regeneration byte-matches committed audit artifacts; baseline diff contains only bounded auditor/test/workflow/audit/snapshot/handoff changes plus classified unrelated concurrent changes and no protected Phase 2, historical Wave A/Wave C, outcome, holdout, association, Withdrawal, model/strategy/production/scheduler/broad-universe paths. Fix only bounded defects and restart verification. On PASS record exact commits/runs/jobs/request counts/checkpoints/artifact identities/counts/limitations, promote only a justified next preregistered round, end `Prompt B closeout: PASS`, and stop without executing the promoted Prompt A.
```

## Stop conditions

- Do not execute the promoted Prompt A automatically.
- Do not perform a cross-day capture before the eligibility gate is satisfied.
- Do not reopen or upgrade the historical 33 identities.
- Do not open protected outcomes, holdouts, association, or Withdrawal state.
- Do not mutate frozen Phase 2/outcome/association artifacts.
- Do not introduce thresholds, scores, models, strategies, production behavior, scheduler, broad-universe rollout, or generic-news features.
- Do not retry the legacy endpoint.
- Fail closed whenever PIT/value-version proof, immutable content identity, source response quality, observation validity, or window identity is unresolved.
