# Institutional Accumulation / Catalyst Pre-positioning Research — Handoff

Canonical handoff: `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`

## Current phase

**Catalyst evidence readiness audit: Prompt A COMPLETE / mandatory Prompt B closeout pending.**

Current round:

`institutional-accumulation-catalyst-evidence-readiness-audit-v1`

Status:

- `institutional-accumulation-preregistration-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-point-in-time-contract-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-sample-freeze-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-outcome-opening-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-association-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-outcome-maturity-refresh-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-association-refresh-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-catalyst-evidence-readiness-audit-v1`: Prompt A **COMPLETE**, Prompt B **PREREGISTERED / NOT STARTED**.

Prompt A completion does not execute Prompt B automatically.

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
- Withdrawal v6.0-v6.5 methodology, classifier/lifecycle rules, validation state, outcomes, and holdouts remain frozen and are not Accumulation inputs;
- no binary repricing/success threshold, optimized cutoff, composite score, or production weighting is authorized;
- no same-industry-relative outcome while PIT-safe effective-dated historical industry membership remains unproven;
- no catalyst/news layer may be added to the model until a separately preregistered PIT-safe catalyst round explicitly authorizes it.

## Durable prior-phase checkpoints

### Phase 0 — preregistration/source-semantics audit

Prompt B: **PASS**.

Key commits: `8a34187f87998fcc20c32024eeab47ac927f0957`, `34868751908edd18aea19dac35885c2c373be902`.

### Phase 1 — PIT contract

Round: `institutional-accumulation-point-in-time-contract-v1`

Prompt B: **PASS**. Closeout evidence: run `33505951816`, job `99849911255`, tested head `801d15b006217842597b187baa0d548872382700`, 9 tests passed / 0 failed.

### Phase 2 — durable development sample freeze

Round: `institutional-accumulation-development-sample-freeze-v1`

Prompt B: **PASS**.

Frozen universe: `1101, 1102, 1103, 1104, 1108, 1109, 1110, 1201, 1203, 1210, 1213, 1215, 1216, 1217, 1218`.

Frozen T0 anchors: `20260814, 20260817, 20260818, 20260819, 20260820, 20260821, 20260824, 20260825, 20260826, 20260827`.

Frozen counts: methodology_development `41`, stock_holdout `11`, time_holdout `10`, ineligible prospective anchors `88`.

Immutable freeze: `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`.

Semantic SHA-256: `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`.

### Phase 3 — development-only continuous outcome opening

Round: `institutional-accumulation-outcome-opening-v1`

Prompt A **COMPLETE** / Prompt B **PASS**.

Durable original outcome byte SHA-256: `a4422c23cfb749c6f484dfe99e7ca31d7477b410c430536d8314ca8c1bddea58`.

### Phase 4 — development-only continuous association analysis

Round: `institutional-accumulation-development-association-v1`

Prompt A **COMPLETE** / Prompt B **PASS**.

Original association byte SHA-256: `781269adbe62b51a6b6fec9ac9325e602a2014f34282433dbfa04cbbd395e8d2`.

Evidence: run `33524892264`, job `99913112251`, durable checkpoint `9c1037023a9e0feffb152fe1ddcd1c254a158d83`, 5 tests passed / 0 failed.

### Development-only outcome maturity refresh

Round: `institutional-accumulation-development-outcome-maturity-refresh-v1`

Prompt A **COMPLETE** / Prompt B **PASS**.

Refreshed outcome byte SHA-256: `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`.

Coverage through `20260901`: D+5 `38/41`, D+10 `14/41`, D+20 `0/41`, D+40 `0/41`.

Evidence: run `33533052151`, job `99940649047`, durable refreshed outcome commit `8acb153d5f588a1aca046eb500ff9e04ae1be0e9`, 5 tests passed / 0 failed.

### Development-only association refresh closeout

Round: `institutional-accumulation-development-association-refresh-v1`

Prompt A **COMPLETE** / Prompt B **PASS**.

Key evidence:

- workflow run `33535965601`, job `99950232207`;
- exact Prompt A + Prompt B pair durable before implementation in handoff commit `6031af4e3adb26fa0c8cf79d788feccbbf49ba81`;
- refreshed outcome byte SHA-256 `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`;
- refreshed association byte SHA-256 `779e2be6708e6d8bc55062058ede6178e2dd4cf7634621d05ab05228c31e7b68`;
- durable association commit `7678248ba74bac910ebc86701e6df24d54ced23a`;
- Prompt A checkpoint commit `5d6406e151c47208d7b5e7e1dd15bcb039fd0a66`;
- methodology-development identities remained exactly `41`;
- stock holdout, time holdout, and protected `2454` outcomes remained sealed;
- fixed `MIN_N = 20`, missingness, continuous outcome contract, and no-score/no-threshold constraints remained unchanged.

Association-refresh closeout commit `60b4a3142f83d63527142e387c39e5d20b8d3e9b` records Prompt B PASS and, before the present readiness audit began, promoted `institutional-accumulation-catalyst-evidence-readiness-audit-v1` with its exact Prompt A + Prompt B pair already durable.

## Catalyst evidence readiness audit — Prompt A checkpoint

Round: `institutional-accumulation-catalyst-evidence-readiness-audit-v1`

**Prompt A: COMPLETE. Prompt B closeout remains mandatory and has not started.**

Durable audit artifact:

`data_research/institutional-flow/institutional-accumulation-catalyst-evidence-readiness-audit-v1.md`

Audit artifact commit:

`b37410ecb5d3992986f457dff374ed53e40dc645`

Readiness decision:

`not_ready`

Evidence-backed source classifications:

1. **Official material-information / disclosure timeline — `conditional_with_cutoff`.**
   - `.github/workflows/build-fundamental-event-timeline.yml`
   - `scripts/fundamental_event_timeline.js`
   - `scripts/build_fundamental_event_timeline.js`
   - `tests/fundamental_event_timeline.test.js`
   - `data_fundamental_events/<stock>/<year>.json`
   - `data_fundamental_events/build-summary.json`
   - official timestamp/date provenance is represented explicitly; minute/second timestamps before 09:00 may become effective that session, while at/after open, date-only, and fallback evidence is deferred conservatively to the next trading session;
   - current OpenAPI rebuild behavior does not by itself prove immutable original-version availability at every frozen T0.

2. **Official monthly revenue snapshots — `conditional_with_cutoff`.**
   - `scripts/build_fundamental_event_timeline.js`
   - `.github/workflows/crawl-mops-monthly-revenue.yml`
   - `.github/workflows/backfill-mops-monthly-revenue.yml`
   - `data_fundamental_events/<stock>/<year>.json`
   - OpenAPI `出表日期` is explicitly an aggregate snapshot date, not company publication time; date-only/fallback evidence is deferred to the next trading session; backfilled current values are not proof of the exact earlier version.

3. **Formal financial-report fallback events — `conditional_with_cutoff`.**
   - `scripts/build_fundamental_event_timeline.js`
   - `data_finmind_quarterly_financial_quality/<stock>/YYYYQn.json`
   - `.github/workflows/backfill-finmind-quarterly-financial-quality-batch.yml`
   - `.github/workflows/crawl-twse-quarterly-financial-quality.yml`
   - conservative known date is an availability bound, not an original intraday publication timestamp or immutable value-version proof.

4. **Generic market-news archive — `unsafe_or_unproven`.**
   - `.github/workflows/crawl-market-news.yml`
   - `scripts/crawl_market_news.js`
   - `config/market_news_sources.json`
   - `data_market_news/<collection-date>/...`
   - RSS/article timestamps may exist, but Yahoo relative times are reconstructed relative to actual crawl time; historical search windows query what is visible at rebuild time rather than an immutable historical search/article version; edited/reindexed/post-close retrospective articles therefore cannot be reconstructed safely for frozen T0s from the current contract.

5. **Daily-gainers news/theme analysis — `unsafe_or_unproven`.**
   - `.github/workflows/publish-daily-gainers-news-summary.yml`
   - `data_daily_gain_over_5/analysis-news/YYYYMMDD.json`
   - `data_daily_gain_over_5/market-summary/YYYYMMDD.json`
   - `scripts/canonicalize_daily_gainers_news_analysis.js`
   - `scripts/validate_daily_gainers_news_analysis.js`
   - `scripts/build_daily_gainers_market_summary.js`
   - this evidence is produced for the already-observed daily-gainer cohort and is downstream of the price event; it is retrospective explanation, not admissible pre-positioning evidence.

6. **Analyst revision / target-price / recommendation history — `unsafe_or_unproven`.**
   - no dedicated historical repository source was verified by current-main search;
   - original effective timestamp, timezone, version/revision sequence, historical snapshot availability, and non-future-aware consensus semantics are therefore unproven.

Explicit leakage checks completed:

- revised articles: generic news has no immutable original-version chain;
- retrospectively normalized metadata: current historical search/rebuild behavior can expose later state;
- post-close / same-day releases: official event resolver is conservative, generic news lacks an equivalent frozen availability gate;
- missing original timestamps: date-only/fallback official evidence is deferred; unresolved generic-news timestamps remain unsafe;
- future-aware analyst fields: no verified PIT analyst dataset exists;
- retrospective price contamination: daily-gainers news/theme summaries are downstream of observed price-gainer selection and excluded.

Historical reconstruction result:

- official disclosure/fundamental infrastructure is promising but does not yet prove complete immutable historical coverage/version provenance for all 41 frozen methodology-development identities and T0 anchors;
- generic news is not reconstructable as originally visible at each frozen T0 under the current crawler contract;
- no dedicated PIT-safe analyst revision archive was verified.

Therefore a general catalyst/news/analyst development-association round is **not ready** for preregistration. A later narrower official-disclosure-only proposal may be considered only after a separate outcome-blind coverage/provenance audit proves reconstructability for the intended frozen development anchors. No such future round is promoted or executed by this Prompt A.

Prompt A changed only documentation/audit artifacts. It did not inspect/materialize stock-holdout, time-holdout, or protected `2454` outcomes; did not modify the immutable freeze, refreshed development outcome, refreshed association, or Withdrawal v6.0-v6.5 state; and did not create a catalyst feature/model/strategy.

## Current repository state

Key research identities that Prompt B must independently re-verify:

- immutable Phase 2 freeze SHA-256: `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`;
- refreshed development outcome SHA-256: `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`;
- refreshed development association SHA-256: `779e2be6708e6d8bc55062058ede6178e2dd4cf7634621d05ab05228c31e7b68`;
- methodology-development identities: `41`;
- stock holdout, time holdout, and protected `2454`: sealed;
- catalyst readiness decision: `not_ready`.

## Known limitations / unresolved readiness gaps

- D+10 maturity is only `14/41`; D+20/D+40 are not yet observed.
- Normalized HiStock broker history remains insufficient for mandatory use.
- Historical TDCC publication timing remains unsafe/unverified.
- Effective-dated historical industry membership remains unverified.
- PIT-safe free-float/share-base normalization remains unaudited.
- Numerical binary repricing/success thresholds remain deliberately unfrozen.
- A mechanical, outcome-blind `data_fundamental_events` coverage audit across all frozen development identities/T0s has not yet been performed.
- Immutable original-version provenance for official rows that can later be revised remains unproven.
- Generic market-news records lack a versioned historical visibility/edit contract.
- Dedicated historical PIT-safe analyst revisions are absent/unverified.

## Entry points

- canonical handoff: `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`
- preregistration: `data_research/institutional-flow/institutional-accumulation-preregistration-v1.md`
- PIT contract: `data_research/institutional-flow/institutional-accumulation-pit-contract-v1.md`
- immutable freeze: `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`
- refreshed outcome: `data_research/institutional-flow/institutional-accumulation-development-outcome-opening-v1.json`
- refreshed association: `data_research/institutional-flow/institutional-accumulation-development-association-v1.json`
- readiness audit: `data_research/institutional-flow/institutional-accumulation-catalyst-evidence-readiness-audit-v1.md`
- official event workflow: `.github/workflows/build-fundamental-event-timeline.yml`
- official event semantics: `scripts/fundamental_event_timeline.js`
- official event builder: `scripts/build_fundamental_event_timeline.js`
- generic market-news workflow: `.github/workflows/crawl-market-news.yml`
- generic market-news crawler: `scripts/crawl_market_news.js`
- daily-gainers news workflow: `.github/workflows/publish-daily-gainers-news-summary.yml`
- task routing: `docs/agent-prompts/task-routing.json`

## Prompt A — Catalyst evidence readiness audit

```text
Continue the Institutional Accumulation / Catalyst Pre-positioning research project only if round `institutional-accumulation-development-association-refresh-v1` has durable Prompt B PASS and has explicitly promoted `institutional-accumulation-catalyst-evidence-readiness-audit-v1`.

Before work, fetch current remote main; read repository-root `AGENTS.md`, `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, this canonical handoff, `data_research/institutional-flow/institutional-accumulation-preregistration-v1.md`, `data_research/institutional-flow/institutional-accumulation-pit-contract-v1.md`, immutable freeze `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`, refreshed development outcome `data_research/institutional-flow/institutional-accumulation-development-outcome-opening-v1.json`, refreshed association `data_research/institutional-flow/institutional-accumulation-development-association-v1.json`, and `docs/agent-prompts/task-routing.json`.

Recover this exact Prompt A + Prompt B pair from durable history and verify it was preregistered after association-refresh Prompt B PASS and before this readiness audit begins.

Implement only a bounded PIT/source-semantics readiness audit for potential catalyst/news/analyst-revision evidence:
- inventory candidate repository data/workflows/scripts that could supply catalyst, corporate-news, public-announcement, analyst-revision, earnings/revenue, or other pre-positioning evidence;
- where exact paths are discovered, record each exact repo-relative path and role in this handoff; do not leave known paths vague;
- for each candidate source, document event/publication/effective timestamp semantics, collection timestamp semantics, historical availability, timezone, same-day cutoff behavior, update/edit behavior, backfill behavior, and whether data can be reconstructed as known at each frozen T0;
- classify each candidate as `pit_safe`, `conditional_with_cutoff`, or `unsafe_or_unproven`, with evidence;
- explicitly test for leakage risks from revised articles, retrospectively normalized metadata, post-close/same-day releases, missing original timestamps, or future-aware analyst fields;
- do not inspect or materialize stock-holdout, time-holdout, or protected `2454` outcomes;
- do not alter the immutable Phase 2 freeze, refreshed development outcome, or refreshed association artifact;
- do not add catalyst features, binary labels, thresholds, optimized cutoffs, composite scores, weights, production logic, or a strategy;
- do not modify Withdrawal v6.0-v6.5 methodology/validation state.

Produce a durable audit section or dedicated audit artifact only if needed, and update this canonical handoff with exact discovered entry points, source classifications, evidence, unresolved gaps, and a clear decision: either `ready_for_separate_catalyst_preregistration` or `not_ready`.

Prompt A completion contract:
1. candidate source inventory is explicit and evidence-backed;
2. exact known repo-relative paths are recorded;
3. PIT timestamp/cutoff/edit/backfill semantics are documented per source;
4. leakage risks are explicitly classified;
5. no holdout/2454 outcome is opened;
6. no existing development research artifact is modified except documentation/audit artifacts required by this audit;
7. no catalyst feature/model/strategy is created;
8. handoff records Prompt A completion while preserving the preregistered Prompt B below.

When complete, report:
`Prompt A complete — ready for Prompt B`
and stop.
```

## Prompt B — Catalyst evidence readiness audit closeout

```text
Perform mandatory closeout for round `institutional-accumulation-catalyst-evidence-readiness-audit-v1` only after its Prompt A has completed.

Fetch current remote main; read repository-root `AGENTS.md`, this canonical handoff, `data_research/institutional-flow/institutional-accumulation-preregistration-v1.md`, `data_research/institutional-flow/institutional-accumulation-pit-contract-v1.md`, immutable freeze `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`, refreshed outcome `data_research/institutional-flow/institutional-accumulation-development-outcome-opening-v1.json`, refreshed association `data_research/institutional-flow/institutional-accumulation-development-association-v1.json`, every exact source/workflow/script path recorded by Prompt A, and any durable audit artifact created by Prompt A. Recover this exact Prompt B from durable pre-Prompt-A history.

Verify at minimum:
1. the audit did not alter the Phase 2 freeze SHA `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`, refreshed outcome SHA `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`, or refreshed association SHA `779e2be6708e6d8bc55062058ede6178e2dd4cf7634621d05ab05228c31e7b68`;
2. stock holdout, time holdout, and protected `2454` outcomes remain sealed;
3. every candidate source has an exact repo-relative path when known, plus publication/effective timestamp, collection timestamp, timezone/cutoff, edit/update, backfill, and historical-reconstruction semantics;
4. every source classification (`pit_safe`, `conditional_with_cutoff`, `unsafe_or_unproven`) is supported by concrete repository/source evidence rather than assumption;
5. same-day/post-close timing, revised articles, backfilled metadata, retrospective summaries, and future-aware analyst-revision risks were explicitly checked;
6. no catalyst feature, success label, threshold, optimized cutoff, score, weight, production model, strategy, or same-industry outcome was introduced;
7. no Withdrawal v6.0-v6.5 methodology/validation file changed;
8. changed-file scope is bounded to audit/documentation artifacts needed for this readiness round;
9. the final readiness decision is explicit: `ready_for_separate_catalyst_preregistration` or `not_ready`, with unresolved gaps listed;
10. any future catalyst-development round remains separately preregistered and is not executed automatically.

On PASS, update/commit this canonical handoff. Do not open holdouts and do not add a catalyst layer automatically.

End with:
`Prompt B closeout: PASS`
and stop.
```

## Safety / stop conditions

- No production strategy promotion.
- No MediaTek outcome-driven tuning.
- No stock-holdout/time-holdout outcome opening.
- No mutation of the immutable Phase 2 freeze.
- No binary cutoff or weighted score optimization.
- No catalyst/news feature creation during the readiness audit.
- No modification of frozen Withdrawal methodology/validation state.
- Prompt A completion does not execute Prompt B automatically.
