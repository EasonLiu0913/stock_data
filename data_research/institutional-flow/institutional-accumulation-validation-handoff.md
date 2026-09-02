# Institutional Accumulation / Catalyst Pre-positioning Research — Handoff

Canonical handoff: `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`

## Current phase

**Official-disclosure PIT coverage/provenance audit: COMPLETE / Prompt B PASS.**

Promoted next round:

`institutional-accumulation-official-disclosure-artifact-reconstruction-v1`

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
- `institutional-accumulation-official-disclosure-artifact-reconstruction-v1`: Prompt A **COMPLETE**, Prompt B **PREREGISTERED / NOT STARTED**.

Promotion does not execute the promoted Prompt A automatically.

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
- no catalyst/news layer may be added to the model until a separately preregistered PIT-safe catalyst round explicitly authorizes it.

## Durable prior-phase checkpoints

Phase 0 preregistration/source-semantics audit: Prompt B **PASS**. Key commits `8a34187f87998fcc20c32024eeab47ac927f0957`, `34868751908edd18aea19dac35885c2c373be902`.

Phase 1 PIT contract: Prompt B **PASS**. Core entry points: `scripts/lib/institutional_accumulation_pit.js`, `scripts/lib/stock_price_provider.js`, `scripts/lib/histock_broker_quality.js`, `tests/institutional_accumulation_pit.test.js`, `tests/institutional_accumulation_pit_coverage.test.js`, `data_research/institutional-flow/institutional-accumulation-pit-contract-v1.md`. Evidence: run `33505951816`, job `99849911255`, tested head `801d15b006217842597b187baa0d548872382700`, 9 tests passed / 0 failed.

Phase 2 durable development sample freeze: Prompt B **PASS**. Frozen universe `1101, 1102, 1103, 1104, 1108, 1109, 1110, 1201, 1203, 1210, 1213, 1215, 1216, 1217, 1218`; T0 anchors `20260814, 20260817, 20260818, 20260819, 20260820, 20260821, 20260824, 20260825, 20260826, 20260827`; methodology-development `41`, stock holdout `11`, time holdout `10`, ineligible prospective anchors `88`; immutable freeze `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`; semantic SHA-256 `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`.

Phase 3 development-only continuous outcome opening: Prompt B **PASS**. Refreshed development outcome SHA-256 `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`.

Phase 4 development-only continuous association analysis and refresh: Prompt B **PASS**. Refreshed association SHA-256 `779e2be6708e6d8bc55062058ede6178e2dd4cf7634621d05ab05228c31e7b68`; D+5 analyzable pairs `16`; D+10/D+20/D+40 remain below fixed `MIN_N = 20` and uninterpreted.

Catalyst evidence readiness audit: Prompt B **PASS**. General catalyst/news/analyst readiness remained `not_ready`; only the narrower official-disclosure coverage audit was authorized next.

## Official-disclosure PIT coverage/provenance audit closeout

Round: `institutional-accumulation-official-disclosure-pit-coverage-audit-v1`

Pre-Prompt-A handoff checkpoint containing the exact paired Prompt A + Prompt B:

`c517e574c8da1a4c059192bf952f9ff59b263602`

Prompt A reproducibility implementation:

- `scripts/audit_institutional_accumulation_official_disclosure_pit_coverage.js`
- `tests/institutional_accumulation_official_disclosure_pit_coverage.test.js`
- `.github/workflows/audit-institutional-accumulation-official-disclosure-pit-coverage.yml`
- `data_research/institutional-flow/institutional-accumulation-official-disclosure-pit-coverage-audit-v1.json`

Fresh-runner evidence:

- successful final workflow run: `33586608708`;
- job: `100111969386`;
- tested/materialized head before writer commit: `f563572be925b16676d076ea7b90ededb9edf1f4`;
- durable audit writer commit: `c735e135ed8c5f2c35a59af7fbc9d9d433f4dceb`;
- bounded regression: 6 tests passed / 0 failed;
- final writer push succeeded to remote `main`.

**Prompt B closeout: PASS**

Independent verification against the preregistered Prompt B:

1. Bounded compare `c517e574c8da1a4c059192bf952f9ff59b263602...c735e135ed8c5f2c35a59af7fbc9d9d433f4dceb` changed only the new audit workflow, audit script, audit regression test, and durable audit artifact. The immutable Phase 2 freeze, refreshed development outcome, and refreshed development association did not change, so their previously verified identities remain `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`, `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`, and `779e2be6708e6d8bc55062058ede6178e2dd4cf7634621d05ab05228c31e7b68` — **PASS**.
2. Exactly `41` frozen methodology-development identities were audited. The artifact explicitly records `outcome_values_read=false`, `holdout_outcomes_read=false`, `protected_2454_outcomes_read=false`, excludes stock `2454`, and the regression checks the same boundary — **PASS**.
3. Durable counts reproduce as: PIT-safe identities `8/41`; primary coverage `official_timestamp=0`, `official_date=0`, `aggregate_snapshot_date=0`, `fallback_deadline=8`, `other_unknown=0`, `current_rebuild_or_later_version=0`, `ambiguous_or_version_unsafe=0`, `missing_artifact=33`, `no_qualifying_event=0`; PIT-safe events by provenance include `fallback_deadline=16` and zero in the other provenance buckets. Final fresh-runner reproduced the same counts — **PASS**.
4. `scripts/fundamental_event_timeline.js` defines precise timestamp evidence before market open as same-day only, otherwise strictly next trading date; date-only and fallback evidence also move to the strictly next trading date. The audit consumes existing `effective_trading_date` and only accepts `effective_trading_date <= T0`; it does not move date-only/fallback evidence earlier. The dedicated regression verifies this behavior — **PASS**.
5. The audit requires both artifact `generated_at` and the latest Git commit touching the current artifact version to be no later than T0 end-of-day before treating that current row/version as historical proof. Later/current rebuilds are classified unsafe rather than used as historical evidence — **PASS**.
6. Scope markers and bounded compare show no generic market news, daily-gainers retrospective news, analyst revisions, future price/outcome data, same-industry outcome, catalyst feature, threshold, optimized cutoff, score, weight, production model, or strategy was introduced — **PASS**.
7. No Withdrawal v6.0-v6.5 methodology or validation file changed in the bounded compare — **PASS**.
8. Changed-file scope is exactly four bounded reproducibility/audit files before this closeout handoff update — **PASS**.
9. Final decision is explicit: `official_disclosure_not_ready`. Unresolved gaps are durable: `33/41` identities lack the required official-event artifact, current rebuilds are not accepted as historical provenance proof, and missing/ambiguous/unknown states remain excluded from PIT-safe coverage — **PASS**.
10. No catalyst-development/preregistration round was executed. This closeout only preregisters and promotes an outcome-blind artifact-reconstruction round; promotion does not execute it automatically — **PASS**.

A Prompt A plumbing defect was found during closeout: the durable audit and successful writer existed on remote `main`, but this handoff still said Prompt A was `NOT STARTED / ACTIVE`. Prompt B repaired only that bounded documentation defect and then re-ran verification from criterion 1.

Readiness decision after closeout: `official_disclosure_not_ready`.

## Official-disclosure artifact reconstruction Prompt A completion

Round: `institutional-accumulation-official-disclosure-artifact-reconstruction-v1`

Prompt A: **COMPLETE**. Prompt B remains **PREREGISTERED / NOT STARTED** and was not executed.

Fresh-runner evidence:

- workflow run: `33587945257`;
- tested head before writer commit: `cb0232a19d1bd476cde7cdb4f805dc40e53664dd`;
- bounded regressions: **PASS**;
- reconstruction execution: **PASS**;
- outcome-blind / no-network contract: **PASS**.

Durable reconstruction result:

- exact prior missing identities classified: `33`;
- `reconstructable_from_pre_T0_durable_inputs`: `0`;
- `source_exists_but_version_or_timing_unsafe`: `0`;
- `source_missing`: `33`;
- `not_applicable`: `0`;
- reconstructed event artifacts: `0`;
- official-disclosure PIT-safe identity coverage before/after: `8/41` -> `8/41`;
- missing-artifact identities before/after: `33` -> `33`.

Boundary result:

- no current network collection was used;
- development outcome values, stock/time holdout outcomes, and protected `2454` outcomes were not read;
- no generic news, analyst-revision, catalyst feature, threshold, score, weighting, production model, or Withdrawal methodology change was introduced;
- no current artifact commit timestamp was used as historical source proof;
- the committed source set available to the existing offline builder contained no reconstructable pre-T0 source for the 33 missing identities, so all 33 remain `source_missing`;
- remaining official-disclosure coverage gaps therefore require a separately preregistered source/network-collection round if the project chooses to pursue them. No such round is started automatically.

Durable artifact:

`data_research/institutional-flow/institutional-accumulation-official-disclosure-artifact-reconstruction-v1.json`

## Current repository state

- immutable Phase 2 freeze SHA-256: `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`;
- refreshed development outcome SHA-256: `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`;
- refreshed development association SHA-256: `779e2be6708e6d8bc55062058ede6178e2dd4cf7634621d05ab05228c31e7b68`;
- methodology-development identities: `41`;
- stock holdout, time holdout, and protected `2454`: sealed;
- general catalyst/news/analyst readiness: `not_ready`;
- official-disclosure preregistration readiness: `official_disclosure_not_ready`;
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
- Official-event coverage is currently only `8/41` identities and all PIT-safe evidence is `fallback_deadline` provenance.
- `33/41` identities currently have no `data_fundamental_events/<stock>/<year>.json` artifact.
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
- coverage auditor: `scripts/audit_institutional_accumulation_official_disclosure_pit_coverage.js`
- coverage regression: `tests/institutional_accumulation_official_disclosure_pit_coverage.test.js`
- coverage workflow: `.github/workflows/audit-institutional-accumulation-official-disclosure-pit-coverage.yml`
- official event workflow: `.github/workflows/build-fundamental-event-timeline.yml`
- official event semantics: `scripts/fundamental_event_timeline.js`
- official event builder: `scripts/build_fundamental_event_timeline.js`
- official event regression: `tests/fundamental_event_timeline.test.js`
- official event artifacts: `data_fundamental_events/<stock>/<year>.json`, `data_fundamental_events/build-summary.json`
- monthly revenue workflows: `.github/workflows/crawl-mops-monthly-revenue.yml`, `.github/workflows/backfill-mops-monthly-revenue.yml`
- financial fallback artifacts: `data_finmind_quarterly_financial_quality/<stock>/YYYYQn.json`
- financial workflows: `.github/workflows/backfill-finmind-quarterly-financial-quality-batch.yml`, `.github/workflows/crawl-twse-quarterly-financial-quality.yml`
- task routing: `docs/agent-prompts/task-routing.json`

## Next round

Round: `institutional-accumulation-official-disclosure-artifact-reconstruction-v1`

Purpose: determine how much of the `33/41` missing-artifact gap can be repaired mechanically from already durable repository inputs, without opening outcomes and without performing a new network collection wave. The round may materialize missing `data_fundamental_events/<stock>/<year>.json` artifacts only when their source rows and historical availability are already durably present in the repository.

This is still an outcome-blind infrastructure/provenance round. It does not authorize a catalyst feature, catalyst/outcome association, holdout opening, generic news, analyst revisions, or a production model.

## Prompt A — Official-disclosure artifact reconstruction

```text
Continue the Institutional Accumulation / Catalyst Pre-positioning research project only if round `institutional-accumulation-official-disclosure-pit-coverage-audit-v1` has durable Prompt B PASS and has explicitly promoted `institutional-accumulation-official-disclosure-artifact-reconstruction-v1`.

Before work:
1. fetch current remote `main`;
2. read repository-root `AGENTS.md`, `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, this canonical handoff, `data_research/institutional-flow/institutional-accumulation-preregistration-v1.md`, `data_research/institutional-flow/institutional-accumulation-pit-contract-v1.md`, immutable freeze `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`, `data_research/institutional-flow/institutional-accumulation-official-disclosure-pit-coverage-audit-v1.json`, `scripts/fundamental_event_timeline.js`, `scripts/build_fundamental_event_timeline.js`, `tests/fundamental_event_timeline.test.js`, `.github/workflows/build-fundamental-event-timeline.yml`, `scripts/audit_institutional_accumulation_official_disclosure_pit_coverage.js`, `tests/institutional_accumulation_official_disclosure_pit_coverage.test.js`, and `docs/agent-prompts/task-routing.json`;
3. recover this exact Prompt A + Prompt B pair from durable pre-Prompt-A history.

Implement only an outcome-blind reconstruction audit/remediation using already durable repository inputs:
- derive the exact missing-artifact stock/T0 identities mechanically from `data_research/institutional-flow/institutional-accumulation-official-disclosure-pit-coverage-audit-v1.json`;
- for each missing stock/year artifact, inspect only already committed source inputs consumed by `scripts/build_fundamental_event_timeline.js`, including existing monthly-revenue/material-information/financial fallback repository data;
- distinguish `reconstructable_from_pre_T0_durable_inputs`, `source_exists_but_version_or_timing_unsafe`, `source_missing`, and `not_applicable` states;
- materialize `data_fundamental_events/<stock>/<year>.json` only when the builder can do so from source data already durably present and historically available under the frozen PIT contract;
- do not use a current network fetch to manufacture historical coverage;
- do not treat newly generated artifact commit time as proof that source rows themselves existed by T0; preserve source-level provenance and classify historical availability separately;
- after any bounded reconstruction, rerun `scripts/audit_institutional_accumulation_official_disclosure_pit_coverage.js` and record the before/after coverage counts;
- create a durable reconstruction artifact at `data_research/institutional-flow/institutional-accumulation-official-disclosure-artifact-reconstruction-v1.json` containing exact missing identities, reconstruction decisions, source paths, provenance, before/after counts, and unresolved gaps;
- do not read development outcome values, stock/time holdout outcomes, or protected `2454` outcomes;
- do not use generic market news, daily-gainers retrospective news, analyst revisions, same-industry outcomes, or future price/outcome evidence;
- do not alter the immutable freeze, refreshed outcome, refreshed association, Withdrawal v6.0-v6.5 state, or any production strategy/model;
- do not start a network backfill. If durable source inputs are insufficient, stop with explicit missing-source classification and preregister any future collection round separately.

Prompt A completion contract:
1. all currently missing official-event artifact identities are mechanically classified;
2. any reconstructed artifacts are derived only from already durable repository inputs and preserve PIT provenance;
3. bounded fundamental-event regressions and coverage-audit regressions pass;
4. before/after coverage counts are durable and reproducible;
5. no outcome/holdout/2454 leakage occurs;
6. no network collection occurs;
7. a durable reconstruction artifact is committed to remote `main`;
8. this handoff records Prompt A completion while preserving the preregistered Prompt B below.

When complete, report:
`Prompt A complete — ready for Prompt B`
and stop.
```

## Prompt B — Official-disclosure artifact reconstruction closeout

```text
Perform mandatory closeout for round `institutional-accumulation-official-disclosure-artifact-reconstruction-v1` only after its Prompt A has completed.

Fetch current remote `main`; read repository-root `AGENTS.md`, this canonical handoff, immutable freeze, prior official-disclosure coverage audit, durable reconstruction artifact, `scripts/fundamental_event_timeline.js`, `scripts/build_fundamental_event_timeline.js`, `tests/fundamental_event_timeline.test.js`, `scripts/audit_institutional_accumulation_official_disclosure_pit_coverage.js`, `tests/institutional_accumulation_official_disclosure_pit_coverage.test.js`, every reconstructed `data_fundamental_events/<stock>/<year>.json` path recorded by Prompt A, and `docs/agent-prompts/task-routing.json`. Recover this exact Prompt B from durable pre-Prompt-A history.

Verify at minimum:
1. frozen Phase 2 / refreshed outcome / refreshed association identities are unchanged and holdout/2454 outcomes remain sealed;
2. every prior missing-artifact identity is classified exactly once as reconstructable, timing/version-unsafe, source-missing, or not-applicable;
3. every newly materialized event artifact is reproducible solely from already committed source inputs and no network collection was used;
4. source-level historical availability is not inferred from the new artifact commit timestamp or current file presence;
5. fundamental-event regression and official-disclosure coverage-audit regression both pass on the tested head;
6. before/after official-disclosure coverage counts reproduce from remote `main` and any improvement is due only to bounded reconstruction;
7. no generic news, daily-gainers retrospective news, analyst revisions, future price/outcome, same-industry outcome, catalyst feature, threshold, score, weight, production model, or strategy was introduced;
8. no Withdrawal v6.0-v6.5 methodology/validation file changed;
9. changed-file scope is bounded to reconstruction/audit documentation, strictly necessary reproducibility code/tests, and explicitly reconstructed `data_fundamental_events` artifacts;
10. final decision explicitly states whether remaining gaps require a separately preregistered network/source-collection round; no such collection or catalyst-development round is executed automatically.

On PASS, update/commit this canonical handoff and stop. Do not open holdouts, start network collection, or add a catalyst layer automatically.

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
- The promoted reconstruction round must not perform network collection.
- Promotion does not execute the promoted Prompt A automatically.
