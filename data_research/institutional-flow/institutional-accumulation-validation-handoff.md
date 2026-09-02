# Institutional Accumulation / Catalyst Pre-positioning Research — Handoff

Canonical handoff: `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`

## Current phase

**Official-disclosure source-collection preregistration: Prompt A COMPLETE / Prompt B pending.**

Active round:

`institutional-accumulation-official-disclosure-source-collection-preregistration-v1`

Status:

- `institutional-accumulation-preregistration-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-point-in-time-contract-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-sample-freeze-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-outcome-opening-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-association-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-outcome-maturity-refresh-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-association-refresh-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-catalyst-evidence-readiness-audit-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-official-disclosure-pit-coverage-audit-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-official-disclosure-artifact-reconstruction-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-official-disclosure-source-collection-preregistration-v1`: Prompt A **COMPLETE**, Prompt B **PREREGISTERED / NOT STARTED**.

No later collection round is promoted until this round's Prompt B passes.

## Objective

Detect cases where price has not yet fully repriced upward while durable institutional capital has already changed behavior in a bullish direction, then separately test whether point-in-time-safe catalyst evidence adds incremental value.

This remains research, not a production strategy.

## Frozen decisions / constraints

Canonical preregistration:

`data_research/institutional-flow/institutional-accumulation-preregistration-v1.md`

Frozen invariants:

- Phase 2 semantic SHA-256: `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`;
- methodology-development identities: exactly `41`;
- protected MediaTek `2454` remains `motivation_cases_only` and excluded from development/validation outcome tuning;
- stock holdout and time holdout outcomes remain sealed;
- refreshed development outcome byte SHA-256: `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`;
- refreshed development association byte SHA-256: `779e2be6708e6d8bc55062058ede6178e2dd4cf7634621d05ab05228c31e7b68`;
- Withdrawal v6.0-v6.5 methodology, classifier/lifecycle rules, validation state, outcomes, and holdouts remain frozen and are not Accumulation inputs;
- no binary repricing/success threshold, optimized cutoff, composite score, or production weighting is authorized;
- no same-industry-relative outcome while PIT-safe effective-dated historical industry membership remains unproven;
- no catalyst/news layer may be added until a separately preregistered PIT-safe catalyst round explicitly authorizes it.

## Durable prior-phase checkpoints

Phase 0 preregistration/source-semantics audit: Prompt B **PASS**. Key commits `8a34187f87998fcc20c32024eeab47ac927f0957`, `34868751908edd18aea19dac35885c2c373be902`.

Phase 1 PIT contract: Prompt B **PASS**. Core entry points: `scripts/lib/institutional_accumulation_pit.js`, `scripts/lib/stock_price_provider.js`, `scripts/lib/histock_broker_quality.js`, `tests/institutional_accumulation_pit.test.js`, `tests/institutional_accumulation_pit_coverage.test.js`, `data_research/institutional-flow/institutional-accumulation-pit-contract-v1.md`. Evidence: run `33505951816`, job `99849911255`, tested head `801d15b006217842597b187baa0d548872382700`, 9 tests passed / 0 failed.

Phase 2 durable development sample freeze: Prompt B **PASS**. Frozen universe `1101, 1102, 1103, 1104, 1108, 1109, 1110, 1201, 1203, 1210, 1213, 1215, 1216, 1217, 1218`; T0 anchors `20260814, 20260817, 20260818, 20260819, 20260820, 20260821, 20260824, 20260825, 20260826, 20260827`; methodology-development `41`, stock holdout `11`, time holdout `10`, ineligible prospective anchors `88`; immutable freeze `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`; semantic SHA-256 `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`.

Phase 3 development-only continuous outcome opening: Prompt B **PASS**. Refreshed development outcome SHA-256 `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`.

Phase 4 development-only continuous association analysis and refresh: Prompt B **PASS**. Refreshed association SHA-256 `779e2be6708e6d8bc55062058ede6178e2dd4cf7634621d05ab05228c31e7b68`; D+5 analyzable pairs `16`; D+10/D+20/D+40 remain below fixed `MIN_N = 20` and uninterpreted.

Catalyst evidence readiness audit: Prompt B **PASS**. General catalyst/news/analyst readiness remained `not_ready`; only narrower official-disclosure work was authorized.

Official-disclosure PIT coverage/provenance audit: Prompt B **PASS**. Durable coverage before reconstruction was `8/41`, with `33/41` identities missing `data_fundamental_events/<stock>/<year>.json`; all accepted PIT-safe evidence was `fallback_deadline` provenance.

## Official-disclosure artifact reconstruction closeout

Round: `institutional-accumulation-official-disclosure-artifact-reconstruction-v1`

Pre-Prompt-A baseline / durable prior closeout head:

`6da456e934be644c289d14d3f4e004807fa5ab33`

Prompt A durable implementation and evidence:

- reconstruction script: `scripts/reconstruct_institutional_accumulation_official_disclosure_artifacts.js`;
- regression: `tests/institutional_accumulation_official_disclosure_artifact_reconstruction.test.js`;
- workflow: `.github/workflows/reconstruct-institutional-accumulation-official-disclosure-artifacts.yml`;
- durable reconstruction artifact: `data_research/institutional-flow/institutional-accumulation-official-disclosure-artifact-reconstruction-v1.json`;
- coverage artifact: `data_research/institutional-flow/institutional-accumulation-official-disclosure-pit-coverage-audit-v1.json`;
- successful fresh-runner: `33587945257`;
- fresh-runner job: `100115895663`;
- tested head: `cb0232a19d1bd476cde7cdb4f805dc40e53664dd`;
- Prompt A durable writer commit: `86def90982460cc4633327837cf92042a8dfaf2b`.

Prompt A result:

- exact prior missing identities classified: `33`;
- `reconstructable_from_pre_T0_durable_inputs`: `0`;
- `source_exists_but_version_or_timing_unsafe`: `0`;
- `source_missing`: `33`;
- `not_applicable`: `0`;
- reconstructed event artifacts: `0`;
- official-disclosure PIT-safe identity coverage before/after: `8/41 -> 8/41`;
- missing-artifact identities before/after: `33 -> 33`;
- `network_collection_used=false`;
- `development_outcome_values_read=false`;
- `holdout_outcomes_read=false`;
- `protected_2454_outcomes_read=false`.

### Prompt B independent verification

**Prompt B closeout: PASS**

1. Bounded compare `6da456e934be644c289d14d3f4e004807fa5ab33...86def90982460cc4633327837cf92042a8dfaf2b` changed only the reconstruction workflow/script/test, reconstruction artifact, prior coverage audit generated timestamp, and this canonical handoff. The immutable Phase 2 freeze, refreshed outcome, refreshed association, and Withdrawal files were not changed — **PASS**.
2. All `33` prior missing-artifact identities are classified exactly once. Counts reproduce as `0 reconstructable`, `0 timing/version unsafe`, `33 source_missing`, `0 not_applicable` — **PASS**.
3. No new `data_fundamental_events/<stock>/<year>.json` was materialized. Therefore there is no artifact whose provenance depends on a current fetch or current artifact timestamp; `network_collection_used=false` is durable in the reconstruction artifact — **PASS**.
4. The reconstruction script uses Git history for source-level durability checks and does not infer historical availability from a newly generated artifact commit timestamp or present-day file existence — **PASS**.
5. Fresh-runner `33587945257` completed successfully on tested head `cb0232a19d1bd476cde7cdb4f805dc40e53664dd`; bounded regressions, reconstruction execution, outcome-blind/no-network verification, handoff completion write, and writer push all completed successfully — **PASS**.
6. Current remote `main` reproduces `8/41` PIT-safe identities and `33` missing-artifact identities. No coverage improvement occurred because no safe pre-T0 source existed for the missing identities — **PASS**.
7. No generic market news, daily-gainers retrospective news, analyst revisions, future price/outcome, same-industry outcome, catalyst feature, threshold, score, weight, production model, or strategy was introduced — **PASS**.
8. No Withdrawal v6.0-v6.5 methodology/validation file changed — **PASS**.
9. Changed-file scope is bounded to reconstruction/audit reproducibility and this handoff. No event artifacts were reconstructed, so no unrelated data tree was touched — **PASS**.
10. Final decision: the remaining `33/41` official-disclosure gaps require a separately preregistered historical official-source/network-collection effort if this evidence class is to be expanded. No network collection, holdout opening, catalyst-development round, or catalyst layer is executed by this closeout — **PASS**.

## Official-disclosure source-collection preregistration Prompt A

Round: `institutional-accumulation-official-disclosure-source-collection-preregistration-v1`

Prompt A durable preregistration file:

`data_research/institutional-flow/institutional-accumulation-official-disclosure-source-collection-preregistration-v1.md`

Prompt A documentation commit:

`9f320065a180420d109d3606e474d567efdde706`

Prompt A result:

- exact unresolved identities mechanically preserved: `33` across nine unique TWSE stocks;
- all identities remain outcome-blind and the holdouts / protected `2454` outcomes remain sealed;
- MOPS historical monthly-revenue archive is accepted as a verified first-party historical single-month source contract;
- MOPS historical material-information query is accepted as a first-party candidate, but exact machine enumeration / pagination / empty-response behavior is a mandatory fail-closed preflight gate before collection;
- current TWSE OpenAPI `t187ap05_L` / `t187ap04_L` is rejected as the historical reconstruction source because no historical date/range/version contract is verified;
- future collection is preregistered as plan -> deterministic queue -> fresh-runner physical batches -> checkpoint -> re-plan/resume, with `max-parallel: 1`, request caps, jitter, cooldown, retry-on-fresh-runner, response-quality guards, and stale-writer protection;
- exact monthly raw-source artifact paths are preregistered; deeper material-information path naming remains intentionally gated on the preflight proving stable record/pagination keys;
- provenance explicitly forbids using future collection time or future git commit time as historical availability proof;
- `collection_preregistered` is the durable decision;
- historical source collection itself was **not** executed;
- no catalyst feature, development association, threshold, score, weight, production model, or strategy was created.

Prompt A completion state: **COMPLETE — Prompt B pending**.

## Current repository state

- immutable Phase 2 freeze SHA-256: `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`;
- refreshed development outcome SHA-256: `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`;
- refreshed development association SHA-256: `779e2be6708e6d8bc55062058ede6178e2dd4cf7634621d05ab05228c31e7b68`;
- methodology-development identities: `41`;
- stock holdout, time holdout, and protected `2454`: sealed;
- general catalyst/news/analyst readiness: `not_ready`;
- official-disclosure source collection decision: `collection_preregistered`, awaiting mandatory Prompt B closeout;
- current official-event PIT-safe identity coverage: `8/41`;
- missing official-event artifact identities: `33/41`;
- no catalyst feature or catalyst/outcome association is authorized yet.

## Known limitations / unresolved readiness gaps

- D+10 maturity is only `14/41`; D+20/D+40 are not yet observed.
- Normalized HiStock broker history remains insufficient for mandatory use.
- Historical TDCC publication timing remains unsafe/unverified.
- Effective-dated historical industry membership remains unverified.
- PIT-safe free-float/share-base normalization remains unaudited.
- Numerical binary repricing/success thresholds remain deliberately unfrozen.
- Official-event coverage is only `8/41` identities and all accepted PIT-safe evidence is `fallback_deadline` provenance.
- `33/41` identities still have no historically proven official-event artifact/source chain; this Prompt A preregistered later collection but did not fill them.
- MOPS material-information machine enumeration/pagination and WAF behavior must pass the preregistered preflight before that source can be collected.
- Immutable original-version provenance for official source rows remains incomplete/unproven beyond artifacts whose current version is durably proven by T0.
- Generic market-news records lack a versioned historical visibility/edit contract.
- Dedicated historical PIT-safe analyst revisions remain absent/unverified.

## Entry points

- canonical handoff: `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`
- preregistration: `data_research/institutional-flow/institutional-accumulation-preregistration-v1.md`
- PIT contract: `data_research/institutional-flow/institutional-accumulation-pit-contract-v1.md`
- immutable freeze: `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`
- refreshed outcome: `data_research/institutional-flow/institutional-accumulation-development-outcome-opening-v1.json`
- refreshed association: `data_research/institutional-flow/institutional-accumulation-development-association-v1.json`
- readiness audit: `data_research/institutional-flow/institutional-accumulation-catalyst-evidence-readiness-audit-v1.md`
- official-disclosure coverage audit: `data_research/institutional-flow/institutional-accumulation-official-disclosure-pit-coverage-audit-v1.json`
- reconstruction artifact: `data_research/institutional-flow/institutional-accumulation-official-disclosure-artifact-reconstruction-v1.json`
- source-collection preregistration: `data_research/institutional-flow/institutional-accumulation-official-disclosure-source-collection-preregistration-v1.md`
- reconstruction script: `scripts/reconstruct_institutional_accumulation_official_disclosure_artifacts.js`
- reconstruction regression: `tests/institutional_accumulation_official_disclosure_artifact_reconstruction.test.js`
- reconstruction workflow: `.github/workflows/reconstruct-institutional-accumulation-official-disclosure-artifacts.yml`
- coverage auditor: `scripts/audit_institutional_accumulation_official_disclosure_pit_coverage.js`
- coverage regression: `tests/institutional_accumulation_official_disclosure_pit_coverage.test.js`
- coverage workflow: `.github/workflows/audit-institutional-accumulation-official-disclosure-pit-coverage.yml`
- official event workflow: `.github/workflows/build-fundamental-event-timeline.yml`
- official event semantics: `scripts/fundamental_event_timeline.js`
- official event builder: `scripts/build_fundamental_event_timeline.js`
- official event regression: `tests/fundamental_event_timeline.test.js`
- official event artifacts: `data_fundamental_events/<stock>/<year>.json`, `data_fundamental_events/build-summary.json`
- monthly revenue crawler: `scripts/crawl_mops_monthly_revenue.js`
- monthly revenue workflows: `.github/workflows/crawl-mops-monthly-revenue.yml`, `.github/workflows/backfill-mops-monthly-revenue.yml`
- financial fallback artifacts: `data_finmind_quarterly_financial_quality/<stock>/YYYYQn.json`
- financial workflows: `.github/workflows/backfill-finmind-quarterly-financial-quality-batch.yml`, `.github/workflows/crawl-twse-quarterly-financial-quality.yml`
- task routing: `docs/agent-prompts/task-routing.json`

## Next round

Round: `institutional-accumulation-official-disclosure-source-collection-preregistration-v1`

Next required action is the **mandatory Prompt B closeout for this same round**. Prompt A is complete; no historical source collection round is promoted or executed until Prompt B passes.

Prompt B must independently verify the exact unresolved set, source classification, provenance semantics, physical-batch plan, changed-file scope, and the absence of historical backfill/outcome/catalyst work.

## Prompt A — Official-disclosure source-collection preregistration

```text
Continue the Institutional Accumulation / Catalyst Pre-positioning research project only if round `institutional-accumulation-official-disclosure-artifact-reconstruction-v1` has durable Prompt B PASS and has explicitly promoted `institutional-accumulation-official-disclosure-source-collection-preregistration-v1`.

Before work:
1. fetch current remote `main`;
2. read repository-root `AGENTS.md`, `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, this canonical handoff, `data_research/institutional-flow/institutional-accumulation-preregistration-v1.md`, `data_research/institutional-flow/institutional-accumulation-pit-contract-v1.md`, immutable freeze `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`, reconstruction artifact `data_research/institutional-flow/institutional-accumulation-official-disclosure-artifact-reconstruction-v1.json`, `scripts/fundamental_event_timeline.js`, `scripts/build_fundamental_event_timeline.js`, `tests/fundamental_event_timeline.test.js`, `.github/workflows/build-fundamental-event-timeline.yml`, `.github/workflows/crawl-mops-monthly-revenue.yml`, `.github/workflows/backfill-mops-monthly-revenue.yml`, and `docs/agent-prompts/task-routing.json`;
3. recover this exact Prompt A + Prompt B pair from durable pre-Prompt-A history.

Implement only a preregistration/feasibility round. Do not perform the historical network backfill yet.

Required work:
- derive the exact unresolved `33` stock/T0 identities mechanically from `data_research/institutional-flow/institutional-accumulation-official-disclosure-artifact-reconstruction-v1.json`;
- audit official/first-party historical source options capable of reproducing monthly-revenue and/or material-information rows relevant to those identities;
- document exact endpoint or interface semantics when verified, including whether historical date/range queries are supported, timestamp precision, publication/update/version behavior, pagination, request caps, response-empty semantics, and rate-limit/blocking behavior;
- do not use generic market news, analyst revisions, daily-gainers retrospective news, or outcome data as substitute evidence;
- design a physical batch plan for the future collection round: explicit stock/date partitions, maximum requests per batch, cooldown/jitter, retry policy, checkpoint interval, stale-writer protection, and resume/no-refetch behavior;
- define exact repo-relative raw-source artifact paths only after the source contract is verified; do not invent a generic storage abstraction merely for future flexibility;
- define how a collected raw row will prove historical availability at T0 independently of the future collection commit timestamp;
- create `data_research/institutional-flow/institutional-accumulation-official-disclosure-source-collection-preregistration-v1.md` containing source decisions, rejected sources, exact missing identities, provenance rules, physical-batch plan, checkpoint/write rules, proposed exact entry points for the later collector/workflow/tests, and explicit stop conditions;
- if no official/first-party historical interface can provide PIT-safe source rows, record `collection_not_feasible` and do not broaden to generic news or analyst data in this round;
- do not read development outcomes, holdout outcomes, or protected `2454` outcomes;
- do not mutate the immutable freeze, refreshed outcome, refreshed association, Withdrawal v6.0-v6.5 state, or any production strategy/model.

Prompt A completion contract:
1. all 33 unresolved identities remain explicitly enumerated and outcome-blind;
2. every candidate official/first-party source is classified with verified historical-query and provenance semantics;
3. a bounded future collection architecture is preregistered with exact request/batch/checkpoint rules;
4. the durable preregistration file exists on remote `main`;
5. no historical source backfill or catalyst-development round is executed;
6. this handoff records Prompt A completion while preserving the preregistered Prompt B below.

When complete, report:
`Prompt A complete — ready for Prompt B`
and stop.
```

## Prompt B — Official-disclosure source-collection preregistration closeout

```text
Perform mandatory closeout for round `institutional-accumulation-official-disclosure-source-collection-preregistration-v1` only after its Prompt A has completed.

Fetch current remote `main`; read repository-root `AGENTS.md`, this canonical handoff, immutable freeze, reconstruction artifact, durable source-collection preregistration file `data_research/institutional-flow/institutional-accumulation-official-disclosure-source-collection-preregistration-v1.md`, `scripts/fundamental_event_timeline.js`, `scripts/build_fundamental_event_timeline.js`, `.github/workflows/build-fundamental-event-timeline.yml`, `.github/workflows/crawl-mops-monthly-revenue.yml`, `.github/workflows/backfill-mops-monthly-revenue.yml`, and `docs/agent-prompts/task-routing.json`. Recover this exact Prompt B from durable pre-Prompt-A history.

Verify at minimum:
1. frozen Phase 2 / refreshed outcome / refreshed association identities are unchanged and holdout/2454 outcomes remain sealed;
2. the exact unresolved set is still 33 identities and no identity was dropped or relabeled using outcome information;
3. each proposed source is official/first-party and its historical query capability, publication/version semantics, empty-response semantics, and timestamp precision are explicitly evidenced or explicitly unresolved;
4. no generic news, analyst revisions, daily-gainers retrospective news, future price/outcome, same-industry outcome, catalyst feature, threshold, score, weight, production model, or strategy was introduced;
5. no historical network backfill was executed in this preregistration round;
6. the future collection plan has physical batches, explicit request caps, retry/cooldown/jitter, durable checkpoints, resume/no-refetch behavior, and stale-writer protection; reject any one-long-run collector design;
7. proposed raw-source artifact paths and later collector/workflow/test entry points are exact where known, and unknown paths are explicitly marked unverified rather than forcing rediscovery by design;
8. provenance rules do not treat future collection time or future artifact commit time as historical availability proof;
9. changed-file scope is bounded to preregistration/audit documentation and strictly necessary feasibility/reproducibility support;
10. final decision is explicit: either `collection_preregistered` with a bounded later collection Prompt A/B pair, or `collection_not_feasible` with no automatic broadening to other evidence classes.

On PASS, update/commit this canonical handoff and stop. Do not execute the collection round, open holdouts, or add a catalyst layer automatically.

End with:
`Prompt B closeout: PASS`
and stop.
```

## Safety / stop conditions

- No production strategy promotion.
- No MediaTek outcome-driven tuning.
- No development-outcome reading in official-disclosure infrastructure rounds.
- No stock-holdout/time-holdout outcome opening.
- No mutation of the immutable Phase 2 freeze, refreshed development outcome, or refreshed association.
- No binary cutoff or weighted score optimization.
- No catalyst/news feature creation yet.
- No generic news or analyst-revision admission without separate PIT proof.
- No modification of frozen Withdrawal methodology/validation state.
- The promoted source-collection preregistration round performs no historical network backfill.
- Promotion does not execute the promoted Prompt A automatically.
