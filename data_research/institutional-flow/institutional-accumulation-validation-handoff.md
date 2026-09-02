# Institutional Accumulation / Catalyst Pre-positioning Research — Handoff

Canonical handoff: `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`

## Current phase

**Official-disclosure source collection: COMPLETE / Prompt B PASS.**

Promoted next round:

`institutional-accumulation-material-information-final-preflight-v1`

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
- `institutional-accumulation-official-disclosure-source-collection-preregistration-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-official-disclosure-source-collection-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-material-information-final-preflight-v1`: Prompt A **NOT STARTED / ACTIVE**, Prompt B **PREREGISTERED / NOT STARTED**.

Prompt B closeout passed after a bounded retryability defect fix. Promotion does not execute the next Prompt A automatically.

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

Phase 2 durable development sample freeze: Prompt B **PASS**. Frozen universe `1101, 1102, 1103, 1104, 1108, 1109, 1110, 1201, 1203, 1210, 1213, 1215, 1216, 1217, 1218`; T0 anchors `20260814, 20260817, 20260818, 20260819, 20260820, 20260821, 20260824, 20260825, 20260826, 20260827`; methodology-development `41`, stock holdout `11`, time holdout `10`, ineligible prospective anchors `88`; immutable freeze `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`.

Phase 3 development-only continuous outcome opening: Prompt B **PASS**. Refreshed development outcome SHA-256 `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`.

Phase 4 development-only continuous association analysis and refresh: Prompt B **PASS**. Refreshed association SHA-256 `779e2be6708e6d8bc55062058ede6178e2dd4cf7634621d05ab05228c31e7b68`; D+5 analyzable pairs `16`; D+10/D+20/D+40 remain below fixed `MIN_N = 20` and uninterpreted.

Catalyst evidence readiness audit: Prompt B **PASS**. General catalyst/news/analyst readiness remained `not_ready`; only narrower official-disclosure work was authorized.

Official-disclosure PIT coverage/provenance audit: Prompt B **PASS**. Durable coverage before reconstruction was `8/41`, with `33/41` identities missing `data_fundamental_events/<stock>/<year>.json`; all accepted PIT-safe evidence was `fallback_deadline` provenance.

Official-disclosure artifact reconstruction: Prompt B **PASS**. Reconstruction classified all 33 prior missing identities as `source_missing`; no network collection was used and coverage remained `8/41`.

## Official-disclosure source-collection preregistration closeout

Round: `institutional-accumulation-official-disclosure-source-collection-preregistration-v1`

Pre-Prompt-A baseline:

`d77045c6855f6b26c3d01b03a8549b0d9eeed52d`

Prompt A durable evidence:

- preregistration document: `data_research/institutional-flow/institutional-accumulation-official-disclosure-source-collection-preregistration-v1.md`;
- Prompt A document commit: `9f320065a180420d109d3606e474d567efdde706`;
- Prompt A handoff checkpoint: `01bb0cecbd19c27d00fdda9f86cd81b525324719`;
- durable decision: `collection_preregistered`;
- unresolved identities: exactly `33`, across stocks `1102, 1103, 1104, 1109, 1201, 1203, 1215, 1216, 1217`;
- no historical source backfill executed in Prompt A.

### Prompt B independent verification

**Prompt B closeout: PASS**

The exact phase-specific Prompt B was recovered from the pre-Prompt-A handoff at `d77045c6855f6b26c3d01b03a8549b0d9eeed52d`.

1. Frozen Phase 2 / refreshed outcome / refreshed association identities are unchanged; Prompt A changed only the new preregistration document and this canonical handoff, so protected research artifacts were untouched. Holdout and protected `2454` outcomes remain sealed — **PASS**.
2. The unresolved set remains exactly `33` identities, mechanically copied from the reconstruction artifact and explicitly enumerated by T0/stock. No identity was removed or relabeled using outcome information — **PASS**.
3. Source classification is explicit: MOPS historical monthly-revenue archive is official/first-party and month-addressable; MOPS historical material information is official/first-party but machine enumeration, pagination, empty-response and WAF behavior remain explicitly gated by preflight; TWSE current OpenAPI is rejected for historical reconstruction because no historical range/version contract is proven; TPEx is not applicable to the frozen TWSE set — **PASS**.
4. No generic news, analyst revisions, daily-gainers retrospective news, future price/outcome, same-industry outcome, catalyst feature, threshold, score, weight, production model, or strategy was introduced — **PASS**.
5. No historical network backfill was executed by this preregistration round — **PASS**.
6. Future collection architecture is true physical batching: deterministic planner, fresh runner per physical batch, `strategy.max-parallel: 1`, `batch_size=1` for the monthly archive and initial detail requests, request caps, `2-5s` jitter, `20-60s` retry/inter-batch cooldown, maximum three fresh-runner attempts per request key, checkpoint after every physical batch, re-plan/resume/no-refetch, response-quality gates, and stale-writer/push-race protection. One-long-run collection is explicitly forbidden — **PASS**.
7. Exact monthly raw paths are preregistered under `data_research/institutional-flow/official-disclosure-raw/mops-monthly-revenue/202607/`. Material-information root is exact, while deeper naming is explicitly and intentionally gated on preflight proving stable page/detail keys. Exact proposed scripts/tests/workflow for the next implementation round are listed below — **PASS**.
8. Provenance rules explicitly state that `collected_at` and later git commit time are audit metadata only and never historical-availability proof. Source-reported report/spoke time and version-safety state remain separate — **PASS**.
9. Bounded Prompt A compare `d77045c6855f6b26c3d01b03a8549b0d9eeed52d...01bb0cecbd19c27d00fdda9f86cd81b525324719` changed only the new source-collection preregistration document and this canonical handoff — **PASS**.
10. Final decision is `collection_preregistered`. During Prompt B, a bounded documentation defect was found: the collection architecture was preregistered but the next round's literal paired Prompt A/Prompt B was not yet present. This closeout fixes only that defect by preregistering the pair below, then promotes that round without executing it — **PASS after bounded fix**.

## Official-disclosure source collection Prompt A checkpoint

Round: `institutional-accumulation-official-disclosure-source-collection-v1`

Prompt A status: **COMPLETE — Prompt B pending**.

Durable implementation / execution evidence:

- implementation commits: `a533656f9beb47d538a916ad5bb0d3b0690cb064`, `4b713dda720c42cb1120b3ef859e5914c52ecf9b`, `cc6ebbe230e3487bc4b092a842939961a422977e`, `6a069ac9023943587e643a55665a234bfebefbc1`, `4beb0761c68ddc7441b0b459ed0b3c35686cffd9`, `5b0422b36a08d162ba7a84cdeab0b4271a9f8750`;
- execution workflow run: `33593814104`;
- Wave A job: `100133419008`, conclusion `success`;
- Wave A durable writer commit: `93a8ca2e7056bf2aee49cc185ebeb3765a243c98`;
- Wave A request key: `mops-monthly-revenue | market=sii | revenue_month=202607`;
- Wave A quality: `quality_passed`, HTTP `200`, response bytes `453020`, SHA-256 `ecb9dbd31124cc0afdf06c343e9bb2f0a41a16c0022b8d593eefcb53eeec66bd`, company rows `992`, all nine frozen stocks present;
- Wave A durable artifacts: `data_research/institutional-flow/official-disclosure-raw/mops-monthly-revenue/202607/source.html`, `source-meta.json`, `rows.json`;
- Wave B job: `100133797722`, workflow conclusion `success`, research decision `blocked`;
- Wave B durable writer commit: `eb7767237`;
- Wave B reason: `listing_security_or_quality_block`; deterministic preflight stock/year `1102 / ROC 115`; one listing request returned HTTP `200` but only `800` bytes, so it was correctly rejected as ambiguous security/quality failure rather than terminal source-empty;
- Wave B durable diagnostic: `data_research/institutional-flow/official-disclosure-raw/mops-material-information/preflight.json`;
- `replan-wave-c` completed successfully and `wave-c-listing` was **skipped by design** because durable Wave B decision was not PASS;
- no material-information Wave C collection ran; no catalyst/outcome association, holdout opening, threshold, score, model, strategy, or production behavior was introduced.

This checkpoint is a bounded documentation repair performed before Prompt B closeout because Prompt A implementation and durable collection artifacts had completed, but the handoff still incorrectly said `NOT STARTED / ACTIVE`. The preregistered Prompt B below is preserved unchanged.

## Official-disclosure source collection Prompt B closeout

Round: `institutional-accumulation-official-disclosure-source-collection-v1`

**Prompt B closeout: PASS**

The exact phase-specific Prompt B was recovered from durable pre-Prompt-A handoff commit `bf048ec66ba570ee63aa39dbbf8feaf918825aac`.

Independent verification:

1. Bounded compare from `bf048ec66ba570ee63aa39dbbf8feaf918825aac` to current closeout state changes only collection implementation/workflow/tests, collection raw/checkpoint artifacts, canonical handoff, and bounded closeout helpers. Immutable Phase 2 freeze, refreshed outcome, refreshed association, holdouts/protected `2454`, and Withdrawal v6.0-v6.5 state were not modified — **PASS**.
2. Planner derives work from exactly `33` reconstruction decisions with `state=source_missing` plus committed raw/checkpoint state, enforces the exact count, and reads no outcome artifacts — **PASS**.
3. Wave A used the deterministic `mops-monthly-revenue|market=sii|revenue_month=202607` key on one fresh runner. Run `33593814104`, job `100133419008`, durable commit `93a8ca2e7056bf2aee49cc185ebeb3765a243c98`: HTTP `200`, `453020` bytes, response SHA-256 `ecb9dbd31124cc0afdf06c343e9bb2f0a41a16c0022b8d593eefcb53eeec66bd`, report date `20260902`, `992` company rows, and all nine frozen stocks present. Raw HTML, metadata, and rows are durable — **PASS**.
4. HTTP `200` is not sufficient for quality PASS. Wave B returned HTTP `200` with only `800` bytes and was classified `listing_security_or_quality_block`, never terminal source-empty. Prompt B found an implementation defect because the original planner incorrectly removed that ambiguous blocked key from future plans. Bounded fixes `d56e9cf6f52e91ac72cbbc4e89ff404d03edc6b8`, `b6b5e9eae9f05bbadc2ea10e4d8c93ba4814423d`, and `97a89c217dae47284f2e8921ee49196ee941a62d` made ambiguous blocks retryable across fresh runners with a three-attempt ceiling — **PASS after bounded fix**.
5. Wave B respected the maximum-three-request contract. Initial preflight used one listing request. Fresh-runner closeout retry run `33595125165`, job `100136914148`, used one additional listing request and again received HTTP `200` + `800` bytes. Durable commit `bc1b57736` records `attempt_count=2`, `retryable=true`, `terminal_state=null`. Wave C never ran because preflight never PASSed — **PASS**.
6. Wave C did not run, so no listing/detail collection occurred. The durable workflow retains `max-parallel: 1`, fresh-runner partitioning, bounded writes, and fail-gating on preflight PASS — **PASS / not exercised**.
7. Fresh-runner regression and planner checks in run `33595125165` proved current re-plan is `Wave A=0`, `Wave B=1`, `Wave C=0`, with `preflight_attempt_count=2` and `preflight_retryable=true`. Thus completed Wave A is not refetched and ambiguous Wave B remains retryable exactly as preregistered — **PASS**.
8. Wave A provenance explicitly separates `collected_at` from historical availability; report date is `20260902`, timestamp precision is `aggregate_snapshot_date`, and `version_safety=historical_timing_safe_value_version_unproven`. Current collection/git time is not used as historical visibility proof — **PASS**.
9. Required writer artifacts exist on current remote `main`: Wave A `source.html`, `source-meta.json`, `rows.json`; Wave B `mops-material-information/preflight.json`; implementation planner/collectors/tests/workflow are durable. This closeout does not rely on green workflow status alone — **PASS**.
10. No catalyst/outcome association, holdout opening, generic-news/analyst substitution, threshold, score, weight, model, strategy, or production behavior was introduced — **PASS**.

Final collection-boundary state: Wave A complete; material-information machine contract remains unresolved after two ambiguous soft-block attempts; exactly one preregistered fresh-runner attempt remains. No catalyst-development or outcome-association work is authorized.

## Current repository state

- immutable Phase 2 freeze SHA-256: `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`;
- refreshed development outcome SHA-256: `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`;
- refreshed development association SHA-256: `779e2be6708e6d8bc55062058ede6178e2dd4cf7634621d05ab05228c31e7b68`;
- methodology-development identities: `41`;
- stock holdout, time holdout, and protected `2454`: sealed;
- general catalyst/news/analyst readiness: `not_ready`;
- official-disclosure source collection Prompt A: `complete`; Prompt B: `pass`;
- current official-event PIT-safe identity coverage remains `8/41`;
- unresolved official-event identities remain `33/41`; Wave A official monthly-revenue raw evidence is collected, while material-information enumeration remains blocked by fail-closed preflight;
- no catalyst feature or catalyst/outcome association is authorized yet.

## Known limitations / unresolved readiness gaps

- D+10 maturity is only `14/41`; D+20/D+40 are not yet observed.
- Historical TDCC publication timing remains unsafe/unverified.
- Effective-dated historical industry membership remains unverified.
- PIT-safe free-float/share-base normalization remains unaudited.
- Numerical binary repricing/success thresholds remain deliberately unfrozen.
- MOPS material-information machine enumeration/pagination and WAF behavior must pass the preregistered preflight before that source can be collected.
- Immutable original-version provenance for official source rows remains incomplete/unproven unless source/version evidence independently proves it.
- Generic market-news records lack a versioned historical visibility/edit contract.
- Dedicated historical PIT-safe analyst revisions remain absent/unverified.

## Entry points

- canonical handoff: `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`
- parent preregistration: `data_research/institutional-flow/institutional-accumulation-preregistration-v1.md`
- PIT contract: `data_research/institutional-flow/institutional-accumulation-pit-contract-v1.md`
- immutable freeze: `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`
- reconstruction artifact: `data_research/institutional-flow/institutional-accumulation-official-disclosure-artifact-reconstruction-v1.json`
- source-collection preregistration: `data_research/institutional-flow/institutional-accumulation-official-disclosure-source-collection-preregistration-v1.md`
- official event semantics: `scripts/fundamental_event_timeline.js`
- official event builder: `scripts/build_fundamental_event_timeline.js`
- monthly revenue crawler: `scripts/crawl_mops_monthly_revenue.js`
- existing monthly revenue workflows: `.github/workflows/crawl-mops-monthly-revenue.yml`, `.github/workflows/backfill-mops-monthly-revenue.yml`
- task routing: `docs/agent-prompts/task-routing.json`

Proposed exact collection-round implementation entry points:

- `scripts/plan_institutional_accumulation_official_disclosure_collection.js`
- `scripts/collect_institutional_accumulation_mops_monthly_revenue_batch.js`
- `scripts/preflight_institutional_accumulation_mops_material_information.js`
- `scripts/collect_institutional_accumulation_mops_material_information_batch.js`
- `tests/institutional_accumulation_official_disclosure_collection.test.js`
- `.github/workflows/collect-institutional-accumulation-official-disclosure.yml`

## Next round

Round: `institutional-accumulation-material-information-final-preflight-v1`

Purpose: execute exactly the remaining third and final fresh-runner MOPS material-information machine-contract preflight attempt. Wave A must remain no-refetch. This round does not run Wave C even if the preflight passes; a later separately preregistered round is required for material-information collection. If the third attempt is again an ambiguous security/quality block, persist `attempt_count=3`, `retryable=false`, `terminal_state=manual_review`, then stop.

## Prompt A — Official-disclosure source collection

```text
Continue the Institutional Accumulation / Catalyst Pre-positioning research project only if round `institutional-accumulation-official-disclosure-source-collection-preregistration-v1` has durable Prompt B PASS and has explicitly promoted `institutional-accumulation-official-disclosure-source-collection-v1`.

Before work:
1. fetch current remote `main`;
2. read repository-root `AGENTS.md`, `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, this canonical handoff, `data_research/institutional-flow/institutional-accumulation-official-disclosure-source-collection-preregistration-v1.md`, `data_research/institutional-flow/institutional-accumulation-official-disclosure-artifact-reconstruction-v1.json`, immutable freeze `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`, `scripts/crawl_mops_monthly_revenue.js`, `.github/workflows/backfill-mops-monthly-revenue.yml`, and `docs/agent-prompts/task-routing.json`;
3. recover this exact Prompt A + Prompt B pair from the durable handoff checkpoint created before this Prompt A begins.

Implement only the preregistered official-disclosure source collection architecture using exact entry points:
- `scripts/plan_institutional_accumulation_official_disclosure_collection.js`;
- `scripts/collect_institutional_accumulation_mops_monthly_revenue_batch.js`;
- `scripts/preflight_institutional_accumulation_mops_material_information.js`;
- `scripts/collect_institutional_accumulation_mops_material_information_batch.js` only if preflight PASS authorizes it;
- `tests/institutional_accumulation_official_disclosure_collection.test.js`;
- `.github/workflows/collect-institutional-accumulation-official-disclosure.yml`.

Required execution contract:
- planner derives work only from the frozen 33 identities, preregistration, and committed checkpoint state; no outcome inspection;
- Wave A monthly-revenue queue is the deterministic `mops-monthly-revenue | market=sii | revenue_month=202607` key;
- retain raw HTML plus source metadata/parsed rows at the exact preregistered paths under `data_research/institutional-flow/official-disclosure-raw/mops-monthly-revenue/202607/`;
- Wave A uses one request per fresh runner, `strategy.max-parallel: 1`, `2-5s` jitter, maximum three fresh-runner attempts per key, `20-60s` retry/inter-batch cooldown, checkpoint after every physical batch, response byte/hash/marker/row-count/stock-visibility quality guards, and no header-only/shrunken response as terminal empty;
- Wave B material-information preflight uses deterministic stock `1102`, ROC year `115`, maximum three requests total, and fails closed unless request method/body, pagination/end condition, detail identity, explicit empty semantics, structural markers, and WAF/security-denial distinction are all verified;
- Wave C material-information collection may run only after durable preflight PASS and must follow one company-year listing partition per fresh runner plus a second deterministic detail queue with initial detail `batch_size=1`, `max-parallel: 1`, jitter/cooldown, checkpoint/re-plan/resume, and maximum three fresh-runner attempts per key;
- every writer fetches latest main before work and again before push; remote quality-passed artifacts win; on races replay only still-missing bounded files; do not use blind add/add-prone rebase;
- write-layer concurrency must use `cancel-in-progress: false`;
- ambiguous WAF/shrunken/parser-incomplete responses remain retryable and are never persisted as confirmed source-empty;
- `collected_at`/git commit time remain audit metadata only and never historical availability proof;
- do not read development outcome values, stock/time holdout outcomes, or protected `2454` outcomes;
- do not create catalyst features, association analysis, thresholds, scores, weights, production models, or strategies;
- do not modify Withdrawal v6.0-v6.5 state.

Prompt A completion contract:
1. planner/tests/workflow and required collectors are durable on remote `main`;
2. Wave A is durably collected or has an explicit fail-closed terminal/manual-review state consistent with the preregistration;
3. Wave B preflight has a durable PASS or BLOCKED result with diagnostics; Wave C runs only if PASS;
4. every successfully collected source key has durable raw/checkpoint artifacts and provenance/quality metadata on remote `main`;
5. re-plan from current remote state does not refetch completed quality-passed keys;
6. all protected research/holdout/outcome/Withdrawal state remains unchanged;
7. the canonical handoff records Prompt A completion and preserves the preregistered Prompt B below.

When complete, report:
`Prompt A complete — ready for Prompt B`
and stop.
```

## Prompt B — Official-disclosure source collection closeout

```text
Perform mandatory closeout for round `institutional-accumulation-official-disclosure-source-collection-v1` only after its Prompt A has completed.

Fetch current remote `main`; read repository-root `AGENTS.md`, this canonical handoff, the source-collection preregistration document, reconstruction artifact, immutable freeze, collection planner/collectors/preflight/tests/workflow, all collection raw/checkpoint artifacts, and `docs/agent-prompts/task-routing.json`. Recover this exact Prompt B from durable pre-Prompt-A history.

Verify at minimum:
1. frozen Phase 2, refreshed outcome, refreshed association, holdout, protected `2454`, and Withdrawal v6.0-v6.5 state are unchanged;
2. planner inputs are exactly the frozen 33 unresolved identities plus committed collection state and do not use outcomes;
3. Wave A request key and physical-batch behavior match preregistration exactly; raw HTML, metadata, rows, response hash/bytes, report-date and stock visibility diagnostics are durable when successful;
4. HTTP 200 alone is never accepted as quality PASS and ambiguous shrunken/WAF/header-only responses remain retryable rather than terminal source-empty;
5. Wave B used at most three requests and produced a durable PASS or BLOCKED result proving or rejecting the machine enumeration contract; Wave C did not run unless Wave B PASSed;
6. if Wave C ran, each listing/detail partition used fresh-runner physical batches, `max-parallel: 1`, bounded request counts, jitter/cooldown, checkpoint/re-plan/resume/no-refetch, and stale-writer protection;
7. current re-plan excludes all completed quality-passed source keys and preserves retryable ambiguous failures correctly;
8. provenance never treats current collection/git time as historical availability proof; source-reported timestamps and version-safety are explicit;
9. every expected writer artifact is present on current remote `main`; green workflow status without durable outputs is a failure;
10. no catalyst/outcome association, holdout opening, generic-news/analyst substitution, threshold, score, weight, model, strategy, or production behavior was introduced.

On PASS, update/commit this canonical handoff and stop at the collection phase boundary. Do not automatically execute catalyst-development or outcome-association work. Any next evidence-opening round requires a newly preregistered paired Prompt A/B and explicit promotion.

End with:
`Prompt B closeout: PASS`
and stop.
```


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

## Safety / stop conditions

- No production strategy promotion.
- No MediaTek outcome-driven tuning.
- No development-outcome reading during collection.
- No stock-holdout/time-holdout outcome opening.
- No mutation of the immutable Phase 2 freeze, refreshed development outcome, or refreshed association.
- No binary cutoff or weighted score optimization.
- No catalyst/news feature creation during collection.
- No generic news or analyst-revision admission without a separate PIT contract.
- No modification of frozen Withdrawal methodology/validation state.
- MOPS material-information collection remains blocked unless its bounded preflight passes.
- Prompt B closeout passed after a bounded retryability defect fix. Promotion does not execute the next Prompt A automatically.
