# Institutional Accumulation — Catalyst artifact readiness handoff

Canonical active routing handoff:
`data_research/institutional-flow/institutional-accumulation-catalyst-artifact-readiness-handoff.md`

## Frozen project boundaries

- Phase 2 semantic SHA-256: `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`.
- methodology-development identities: exactly `41`.
- protected `2454` remains motivation-only; outcomes unopened.
- stock/time holdouts remain sealed.
- development outcome SHA-256: `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`.
- association SHA-256: `779e2be6708e6d8bc55062058ede6178e2dd4cf7634621d05ab05228c31e7b68`.
- Withdrawal v6.0-v6.5 remains frozen and is not an Accumulation input.
- no catalyst/outcome association, threshold, score, optimized weighting, model, strategy, production behavior, scheduler, broad-universe rollout, generic-news layer, or outcome-driven tuning is authorized.
- legacy `/mops/web/ajax_t05st01` attempt count remains frozen at exactly `2`.

## Closed prerequisite state

- Catalyst artifact reconstruction/readiness: Prompt A COMPLETE / Prompt B PASS; 33 total / 0 ready / 33 not_pit_ready; Node24 run `34466672001`, job `102836756516`.
- PIT provenance resolution: Prompt A COMPLETE / Prompt B PASS; durable artifact `data_research/institutional-flow/institutional-accumulation-catalyst-pit-provenance-resolution-v1.json` remains 33 / 0 / 33 / 0 manual review, zero historical network, outcome-blind.
- Prospective PIT-safe capture contract: Prompt A COMPLETE / Prompt B PASS; checkpoint `4c782bebffb892540f74d0f5e1bc151065edfb59`.
- Prospective live-capture canary: Prompt A COMPLETE / Prompt B PASS; checkpoint `017ee0fb03b626e7607af10916594f33320c0b48`; first live run `34481151262`, six immutable snapshots for 1102/1104/1216.
- Prospective observation audit: Prompt A COMPLETE / Prompt B PASS; checkpoint `57f5a9faca0c20bfe5339230fa521414e696f4ae`; initial deterministic zero-network audit over six observations.

## Closed round — prospective repeat-capture canary

Round: `institutional-accumulation-catalyst-prospective-repeat-capture-canary-v1`

Status:
- Prompt A: **COMPLETE**
- **Prompt B closeout: PASS**

Pre-Prompt-A durable baseline:
- `57f5a9faca0c20bfe5339230fa521414e696f4ae`

Prompt A checkpoint:
- `18a1d3b9fa464510a981c41f3eb16afc5dfe5dbe`

### Prompt B independent verification

The exact Prompt B was recovered from the pre-Prompt-A handoff at `57f5a9faca0c20bfe5339230fa521414e696f4ae`, not from conversation state or the Prompt A summary.

1. Routing remains exactly one active task, `institutional-accumulation`, routed to this handoff — PASS.
2. The preceding prospective observation-audit round has durable Prompt B PASS at baseline `57f5a9fa...` — PASS.
3. Historical PIT remains exactly `identity_count=33`, `pit_ready=0`, `not_pit_ready=33`, `manual_review=0`, `network_collection_used=false`, `source_network_requests=0`, `outcome_blind=true`; protected 2454/development outcome/holdout/association flags remain false — PASS.
4. Pre-live Node24 zero-network gate run `34487290435`, job `102904719545`, tested SHA `716c4ce6d54d7df1952dae743a4281f0fda2cbaa`, Node 24, completed SUCCESS before the second live window. Its run was created `2026-09-10T14:10:18Z` and completed before the first live job began — PASS.
5. Live run `34487369703` contained exactly three matrix jobs: `1102`, `1104`, `1216`, all SUCCESS. Workflow strategy is `max-parallel:1`, with only those three preregistered stocks — PASS.
6. Collector allows only official POST `https://mops.twse.com.tw/mops/api/t05st01` and `https://mops.twse.com.tw/mops/api/t05st01_detail`, performs randomized 20-60 second pre-request cooldown, and caps requests at two per stock — PASS.
7. Second live window produced exactly six newly accepted snapshots: two each for 1102/1104/1216. Per-stock durable checkpoints are `82ea4b0523c50f5993590fb50df9f49d1a298171`, `7972c7a6075255155810cd53cfae273b96fff6c5`, and `1cf4def22ee405b32e32ed1311a88227f21b8113`. Total repository-controlled requests were exactly six — PASS.
8. Race-safe checkpoint code refetches/reset current main, compares any existing immutable path byte-for-byte, fails closed on mismatch, appends only new paths, and verifies each durable remote snapshot afterward — PASS.
9. Baseline comparison `57f5a9fa... -> 18a1d3b9...` shows the six original first-window snapshots were not modified or deleted; exactly six new prospective snapshot paths were added — PASS.
10. Auditor `scripts/audit_institutional_accumulation_catalyst_prospective_observations.js` directly reuses `validateProspectiveSnapshot` and `snapshotRelativePath` from the canonical PIT contract, validates canonical base64/byte length/PIT/methodology/stock/interface/path, rejects duplicate/conflicting immutable identity, and only accepts one or two complete windows — PASS.
11. Current audit artifact `data_research/institutional-flow/institutional-accumulation-catalyst-prospective-observation-audit-v1.json` reports exactly `12 valid / 0 invalid / 0 conflict`, stocks 1102/1104/1216 each `4 total / 2 listing / 2 detail`, interfaces `6 listing + 6 detail`, `12` unique immutable snapshot IDs, actual `12` unique response SHA-256 values, and collection range `2026-09-10T13:12:36.863Z` through `2026-09-10T14:15:57.012Z` — PASS.
12. Audit response-hash uniqueness is reported, not required; repeated official content may legitimately share a raw-content hash while immutable observation identity remains collection-time/path based — PASS.
13. Final Node24 deterministic gate run `34488284071`, job `102908102138`, tested SHA `247cd1663e2ba4b642e2a7fb6fbfd4b375f1de1b`, Node `v24.20.0`, SUCCESS. Test counts: readiness `1/1`, PIT provenance `1/1`, prospective contract `5/5`, canary adapter `6/6`, repeated observation audit `10/10`, all PASS — PASS.
14. Final gate regenerated the audit with `--write`; byte comparison (`cmp`) and `git diff --exit-code` passed. Readiness and historical PIT artifacts were deep-compared before/after and unchanged — PASS.
15. Audit content/blob identity at Prompt A final state: `86a3b0b8059e8f78ec46a01a16cb3498072e453c` — recorded.
16. Baseline diff contains only bounded round-owned auditor/test/readiness-workflow changes, trigger metadata, six new snapshots, regenerated audit and handoff, plus unrelated 20260910 daily-gainers and TWSE margin-maintenance data updates. No protected Phase 2, historical Wave A/Wave C, outcome, holdout, association, Withdrawal, model, strategy, production, scheduler, broad-universe, or generic-news path changed — PASS.
17. No legacy endpoint retry, historical backfill, Wave A/Wave C refetch/rewrite, scheduler, or broad-universe rollout occurred — PASS.

Closeout limitation:
- this proves append-only longitudinal PIT behavior across exactly two bounded collection windows for the same three stocks;
- both windows occurred on the same calendar date, so multi-day stability is not yet established;
- no catalyst/outcome relationship, broad-universe quality, scheduler readiness, historical PIT upgrade, model, strategy, or production behavior is established or authorized.

**Prompt B closeout: PASS**

## Current active round

`institutional-accumulation-catalyst-prospective-window-delta-audit-v1`

Status:
- Prompt A: **NOT STARTED / ACTIVE**
- Prompt B: **PREREGISTERED / PENDING**

Promotion does not execute Prompt A automatically.

## Next round objective

Before any third live capture or scheduler discussion, convert the two existing prospective windows into deterministic zero-network change evidence. Pair window 1 versus window 2 by stock and source interface, record whether raw official content changed, byte-size deltas, collection-time spacing and exact immutable/hash/path identities, while preserving the current 12-observation audit as the source observation set. This is evidence plumbing only; it must not interpret business significance or open outcomes.

Exact entry points:
- `scripts/institutional_accumulation_catalyst_prospective_pit_capture_contract.js`
- `scripts/audit_institutional_accumulation_catalyst_prospective_observations.js`
- `tests/institutional_accumulation_catalyst_prospective_observations.test.js`
- `.github/workflows/test-institutional-accumulation-catalyst-readiness.yml`
- `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/`
- `data_research/institutional-flow/institutional-accumulation-catalyst-prospective-observation-audit-v1.json`
- `data_research/institutional-flow/institutional-accumulation-catalyst-pit-provenance-resolution-v1.json`
- `docs/agent-prompts/task-routing.json`
- `AGENTS.md`

## Prompt A — prospective two-window delta audit

```text
Continue the Institutional Accumulation / Catalyst Pre-positioning project only if `docs/agent-prompts/task-routing.json` still routes the sole active task to `data_research/institutional-flow/institutional-accumulation-catalyst-artifact-readiness-handoff.md` and round `institutional-accumulation-catalyst-prospective-window-delta-audit-v1` remains Prompt A NOT STARTED / ACTIVE.

Before work:
1. fetch current remote main and read repository-root `AGENTS.md`, `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, routing, this handoff, the canonical PIT contract, observation auditor/test, readiness workflow, current 12-observation audit, and frozen PIT provenance artifact;
2. recover this exact Prompt A + Prompt B pair from durable pre-Prompt-A history;
3. independently verify the repeat-capture round has durable Prompt B PASS, current observation audit still contains exactly 12 valid / 0 invalid / 0 conflict observations for only 1102/1104/1216, and historical/protected state remains frozen;
4. classify any concurrent changes before continuing.

Objective: build a deterministic zero-network two-window delta audit over the already checked-in 12 prospective observations. Do not make any MOPS/source-network request.

Implementation requirements:
- add domain-specific script, preferred path `scripts/audit_institutional_accumulation_catalyst_prospective_window_deltas.js`;
- add zero-network regression, preferred path `tests/institutional_accumulation_catalyst_prospective_window_deltas.test.js`;
- emit machine-readable artifact `data_research/institutional-flow/institutional-accumulation-catalyst-prospective-window-delta-audit-v1.json`;
- consume/validate the current observation set through the existing observation auditor/canonical PIT validator rather than reimplementing weaker snapshot semantics;
- require exactly two complete windows, exactly stocks 1102/1104/1216, exactly listing + detail per stock per window, 12 unique immutable observations, and zero invalid/conflict observations;
- deterministically pair occurrence 1 versus occurrence 2 for each stock + source interface by validated `collected_at` order; fail closed on ties, missing pair, extra occurrence, ambiguous ordering, invalid timestamp, or source-request-key mismatch;
- for each of the six pairs record stock, interface, window-1/window-2 source path, collected_at, immutable snapshot ID, response SHA-256, response bytes, elapsed milliseconds, `raw_content_changed` boolean, and byte delta;
- report aggregate changed/unchanged pair counts and exact collection-time range, but do not require content to change and do not interpret the semantic/business meaning of any response content;
- fixture tests must prove fail-closed behavior for partial windows, third window, timestamp tie/invalid timestamp, request-key mismatch, unexpected stock/interface, malformed/hash/base64/PIT/path/immutable conflict inherited through canonical validation;
- extend `.github/workflows/test-institutional-accumulation-catalyst-readiness.yml` to run this delta-audit regression and deterministic regeneration/byte comparison with zero network;
- commit the generated delta-audit artifact only if deterministic validation passes.

Frozen/safety rules:
- zero MOPS/source-network requests; no live collector dispatch;
- no third capture window in this round;
- no scheduler, recurring automation, or broad-universe expansion;
- no historical PIT upgrade/backfill, Wave A/Wave C refetch, legacy endpoint retry;
- no development outcomes, holdouts, protected 2454 outcomes, future returns, catalyst/outcome association, Withdrawal, threshold, score, optimized weighting, model, strategy, production behavior, or generic-news layer;
- do not infer catalyst importance from raw-content change or lack of change.

Completion contract:
- script/test/workflow coverage and machine artifact durable on remote main;
- Node24 zero-network gate PASS at exact tested SHA;
- deterministic regeneration byte-matches committed delta audit;
- six deterministic stock/interface window pairs represented with exact identities/times/hashes/paths and aggregate changed/unchanged counts;
- current 12-observation audit and frozen historical state remain unchanged;
- bounded diff contains only this round's script/test/workflow/artifact/handoff plus classified unrelated concurrent changes;
- canonical handoff records commits/run/job/tested SHA/delta-audit content identity/counts/limitations and preserves the exact Prompt B below;
- stop with `Prompt A complete — ready for Prompt B.`
```

## Prompt B — prospective two-window delta audit closeout

```text
Perform mandatory closeout for `institutional-accumulation-catalyst-prospective-window-delta-audit-v1` only after its Prompt A completes. Fetch current remote main and recover this exact Prompt B from durable pre-Prompt-A history. Independently verify: sole active routing still points to this handoff; the repeat-capture round has durable Prompt B PASS; historical 33/protected state remains frozen and unopened; this round made zero MOPS/source-network requests and did not dispatch the live collector; current 12-observation audit remains byte-identical and still reports exactly 12 valid / 0 invalid / 0 conflict observations for only 1102/1104/1216; the delta auditor consumes canonical validated observation evidence and requires exactly two complete windows; pairing is deterministic by validated collection time within each stock/interface and fails closed on tie, invalid time, missing/extra occurrence or request-key mismatch; machine delta audit durably contains exactly six stock/interface pairs with exact window paths/times/immutable IDs/response hashes/response bytes/elapsed milliseconds/raw_content_changed/byte delta plus aggregate changed/unchanged counts; it does not require raw content to change and does not interpret catalyst significance; fixture regressions fail closed for partial/third windows and inherited malformed/hash/base64/PIT/path/immutable/stock/interface defects; Node24 zero-network workflow passes at recorded tested SHA and deterministic regeneration byte-matches the committed delta artifact; baseline diff contains only bounded script/test/workflow/artifact/handoff changes plus explicitly classified unrelated concurrent changes and no protected Phase 2, historical Wave A/Wave C, outcome, holdout, association, Withdrawal, model/strategy/production/scheduler/broad-universe paths. Fix only bounded defects and restart verification. On PASS record exact commits/run/job/tested SHA/delta artifact identity/counts/limitations, promote only a justified next preregistered round, end `Prompt B closeout: PASS`, and stop without executing the promoted Prompt A.
```

## Stop conditions

- Do not execute the promoted Prompt A automatically.
- Do not reopen or upgrade the historical 33 identities.
- Do not open protected outcomes, holdouts, association, or Withdrawal state.
- Do not mutate frozen Phase 2/outcome/association artifacts.
- Do not introduce thresholds, scores, models, strategies, production behavior, scheduler, broad-universe rollout, or generic-news features.
- Do not retry the legacy endpoint.
- Fail closed whenever PIT/value-version proof, immutable content identity, source response quality, observation validity, or two-window pairing is unresolved.
