# Institutional Accumulation / Catalyst Pre-positioning Research — Handoff

Canonical handoff: `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`

## Current phase

**Catalyst evidence readiness audit: COMPLETE / Prompt B PASS.**

Promoted next round:

`institutional-accumulation-official-disclosure-pit-coverage-audit-v1`

Status:

- `institutional-accumulation-preregistration-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-point-in-time-contract-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-sample-freeze-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-outcome-opening-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-association-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-outcome-maturity-refresh-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-association-refresh-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-catalyst-evidence-readiness-audit-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-official-disclosure-pit-coverage-audit-v1`: Prompt A **NOT STARTED / ACTIVE**, Prompt B **PREREGISTERED / NOT STARTED**.

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

## Catalyst evidence readiness audit closeout

Round: `institutional-accumulation-catalyst-evidence-readiness-audit-v1`

Prompt A audit artifact:

`data_research/institutional-flow/institutional-accumulation-catalyst-evidence-readiness-audit-v1.md`

Prompt A audit commit: `b37410ecb5d3992986f457dff374ed53e40dc645`.

Prompt A checkpoint commit: `1fe3b43a4cfb9c23b3ca3bda765e15b42c78ce31`.

**Prompt B closeout: PASS**

The exact Prompt B was recovered from durable pre-Prompt-A handoff commit `60b4a3142f83d63527142e387c39e5d20b8d3e9b`, where this round was `NOT STARTED / ACTIVE` and Prompt B was already `PREREGISTERED / NOT STARTED`.

Independent closeout verification:

1. Bounded compare `60b4a3142f83d63527142e387c39e5d20b8d3e9b...1fe3b43a4cfb9c23b3ca3bda765e15b42c78ce31` changed only two files: this handoff and the new readiness-audit artifact. Therefore the immutable Phase 2 freeze, refreshed outcome, and refreshed association bytes were not modified; their frozen identities remain `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`, `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`, and `779e2be6708e6d8bc55062058ede6178e2dd4cf7634621d05ab05228c31e7b68` — **PASS**.
2. Stock holdout, time holdout, and protected `2454` outcomes remained sealed; no protected research artifact changed — **PASS**.
3. Candidate sources have exact known repo-relative paths and documented publication/effective timestamp, collection timestamp, timezone/cutoff, edit/update, backfill, and historical-reconstruction semantics in the durable audit — **PASS**.
4. Source classifications are evidence-backed: official material disclosures, monthly-revenue snapshots, and formal financial-report fallback events are `conditional_with_cutoff`; generic market news, daily-gainers news/theme analysis, and analyst-revision history are `unsafe_or_unproven` — **PASS**.
5. Same-day/post-close timing, revised articles, retrospectively normalized metadata, missing original timestamps, backfilled/current-state reconstruction, retrospective price contamination, and future-aware analyst-field risks were explicitly checked — **PASS**.
6. No catalyst feature, success label, threshold, optimized cutoff, composite score, weight, production model, strategy, or same-industry outcome was introduced — **PASS**.
7. No Withdrawal v6.0-v6.5 methodology/validation file changed — **PASS**.
8. Changed-file scope was bounded to audit/documentation artifacts only — **PASS**.
9. Final readiness decision is explicitly `not_ready`; unresolved gaps include mechanical official-event coverage across frozen development identities/T0s, immutable original-version provenance, versioned historical news visibility/edit history, and a dedicated PIT-safe analyst-revision source — **PASS**.
10. No future catalyst-development round was executed automatically. This PASS only promotes a new outcome-blind official-disclosure coverage/provenance audit — **PASS**.

Freshness audit:

- current `main` advanced after Prompt A checkpoint to `c42b0ffa5717cc6b4e64b5006e2f02bcb218ef8a` before closeout;
- bounded compare from `1fe3b43a4cfb9c23b3ca3bda765e15b42c78ce31` to that head changed only `data_daily_gain_over_5/analysis-facts/20260901.json` and `data_daily_gain_over_5/analysis-flow/20260901.json` across three concurrent commits;
- those changes do not alter the audit artifact, source semantics, frozen research artifacts, routing registry, or Withdrawal protected state and therefore do not stale this PASS.

Readiness decision after closeout: `not_ready`.

## Current repository state

- immutable Phase 2 freeze SHA-256: `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`;
- refreshed development outcome SHA-256: `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`;
- refreshed development association SHA-256: `779e2be6708e6d8bc55062058ede6178e2dd4cf7634621d05ab05228c31e7b68`;
- methodology-development identities: `41`;
- stock holdout, time holdout, and protected `2454`: sealed;
- general catalyst/news/analyst readiness: `not_ready`;
- only a narrower, outcome-blind official-disclosure PIT coverage/provenance audit is promoted next.

## Known limitations / unresolved readiness gaps

- D+10 maturity is only `14/41`; D+20/D+40 are not yet observed.
- Normalized HiStock broker history remains insufficient for mandatory use.
- Historical TDCC publication timing remains unsafe/unverified.
- Effective-dated historical industry membership remains unverified.
- PIT-safe free-float/share-base normalization remains unaudited.
- Numerical binary repricing/success thresholds remain deliberately unfrozen.
- Mechanical `data_fundamental_events` coverage against all frozen methodology-development identities/T0s has not yet been measured.
- Immutable original-version provenance for official source rows remains incomplete/unproven.
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
- official event workflow: `.github/workflows/build-fundamental-event-timeline.yml`
- official event semantics: `scripts/fundamental_event_timeline.js`
- official event builder: `scripts/build_fundamental_event_timeline.js`
- official event regression: `tests/fundamental_event_timeline.test.js`
- official event artifacts: `data_fundamental_events/<stock>/<year>.json`, `data_fundamental_events/build-summary.json`
- monthly revenue workflows: `.github/workflows/crawl-mops-monthly-revenue.yml`, `.github/workflows/backfill-mops-monthly-revenue.yml`
- financial fallback artifacts: `data_finmind_quarterly_financial_quality/<stock>/YYYYQn.json`
- financial workflows: `.github/workflows/backfill-finmind-quarterly-financial-quality-batch.yml`, `.github/workflows/crawl-twse-quarterly-financial-quality.yml`
- generic market-news workflow/crawler: `.github/workflows/crawl-market-news.yml`, `scripts/crawl_market_news.js`, `config/market_news_sources.json`, `data_market_news/<collection-date>/...`
- daily-gainers retrospective-news path: `.github/workflows/publish-daily-gainers-news-summary.yml`, `data_daily_gain_over_5/analysis-news/YYYYMMDD.json`, `data_daily_gain_over_5/market-summary/YYYYMMDD.json`
- task routing: `docs/agent-prompts/task-routing.json`

## Next round

Round: `institutional-accumulation-official-disclosure-pit-coverage-audit-v1`

Purpose: outcome-blind mechanical coverage/provenance audit of the existing official disclosure/fundamental-event infrastructure across only the already-frozen methodology-development identities and T0 anchors, to determine whether a narrower official-disclosure-only catalyst preregistration could later be justified.

This round is an audit only. It must not inspect any development outcome values, stock/time holdout outcomes, or protected `2454` outcomes; it must not create catalyst features or associate disclosures with returns.

## Prompt A — Official-disclosure PIT coverage/provenance audit

```text
Continue the Institutional Accumulation / Catalyst Pre-positioning research project only if round `institutional-accumulation-catalyst-evidence-readiness-audit-v1` has durable Prompt B PASS and has explicitly promoted `institutional-accumulation-official-disclosure-pit-coverage-audit-v1`.

Before work, fetch current remote main; read repository-root `AGENTS.md`, `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, this canonical handoff, `data_research/institutional-flow/institutional-accumulation-preregistration-v1.md`, `data_research/institutional-flow/institutional-accumulation-pit-contract-v1.md`, immutable freeze `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`, readiness audit `data_research/institutional-flow/institutional-accumulation-catalyst-evidence-readiness-audit-v1.md`, `scripts/fundamental_event_timeline.js`, `scripts/build_fundamental_event_timeline.js`, `tests/fundamental_event_timeline.test.js`, `.github/workflows/build-fundamental-event-timeline.yml`, `data_fundamental_events/<stock>/<year>.json`, `data_fundamental_events/build-summary.json`, and `docs/agent-prompts/task-routing.json`.

Recover this exact Prompt A + Prompt B pair from durable history and verify it was preregistered before this round begins.

Implement only a bounded, outcome-blind mechanical coverage/provenance audit for official disclosure/fundamental-event evidence:
- derive the exact 41 methodology-development stock/T0 identities only from the immutable Phase 2 freeze; do not read development outcome values;
- for each identity, inspect whether `data_fundamental_events/<stock>/<year>.json` contains event records whose `published_at`, `published_date`, `fallback_known_date`, `timestamp_precision`, `availability_confidence`, `effective_trading_date`, and source provenance would make them available by T0 under `scripts/fundamental_event_timeline.js`;
- separately count coverage for `official_timestamp`, `official_date`, `aggregate_snapshot_date`, `fallback_deadline`, other/unknown states, and no-event/no-artifact cases;
- distinguish durable pre-existing repository evidence from values that could only be produced by a current rebuild; do not treat a current rebuild as historical version proof;
- inspect Git history or durable artifact provenance only as needed to determine whether a candidate row/version existed by the relevant T0; do not infer provenance from accounting period or current file presence alone;
- record ambiguous/revised/version-unsafe rows separately instead of counting them PIT-safe;
- do not use generic market news, daily-gainers news/theme analysis, analyst revisions, same-industry outcomes, or any future price/outcome evidence;
- do not inspect/materialize stock-holdout, time-holdout, or protected `2454` outcomes;
- do not alter the immutable freeze, refreshed outcome, refreshed association, Withdrawal v6.0-v6.5 state, or any production strategy/model;
- do not perform network backfill unless a later separately authorized round explicitly requires it.

Create a durable audit artifact such as `data_research/institutional-flow/institutional-accumulation-official-disclosure-pit-coverage-audit-v1.json` or `.md` with exact counts, provenance categories, missingness, and unresolved version risks. Update this canonical handoff with a clear decision: `official_disclosure_preregistration_ready` only if the existing durable evidence is sufficiently reconstructable under the frozen PIT contract, otherwise `official_disclosure_not_ready`.

Prompt A completion contract:
1. exact 41 methodology-development identities audited without reading outcome values;
2. per-source/per-provenance coverage and missingness are mechanically counted;
3. current-rebuild-only evidence is separated from historically durable evidence;
4. ambiguous/revised/version-unsafe rows are not counted PIT-safe;
5. no holdout/2454 outcomes are opened;
6. no catalyst feature/association/threshold/model/strategy is created;
7. changed-file scope is limited to audit/documentation artifacts and any bounded audit script/test strictly required for reproducibility;
8. handoff records Prompt A completion while preserving the preregistered Prompt B below.

When complete, report:
`Prompt A complete — ready for Prompt B`
and stop.
```

## Prompt B — Official-disclosure PIT coverage/provenance audit closeout

```text
Perform mandatory closeout for round `institutional-accumulation-official-disclosure-pit-coverage-audit-v1` only after its Prompt A has completed.

Fetch current remote main; read repository-root `AGENTS.md`, this canonical handoff, the immutable Phase 2 freeze, readiness audit, every exact official-event source/script/workflow/artifact path recorded by Prompt A, and the durable coverage/provenance audit artifact. Recover this exact Prompt B from durable pre-Prompt-A history.

Verify at minimum:
1. Phase 2 freeze SHA remains `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`, refreshed outcome SHA remains `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`, and refreshed association SHA remains `779e2be6708e6d8bc55062058ede6178e2dd4cf7634621d05ab05228c31e7b68`;
2. exactly 41 methodology-development identities were audited and no development outcome values, stock/time holdout outcomes, or protected `2454` outcomes were inspected/materialized;
3. counts by `official_timestamp`, `official_date`, `aggregate_snapshot_date`, `fallback_deadline`, ambiguous/unsafe, missing artifact, and no qualifying event are reproducible from durable repository evidence;
4. the effective-trading-date/cutoff rules exactly match `scripts/fundamental_event_timeline.js` and date-only/fallback evidence is not moved earlier;
5. current rebuilds are not treated as proof that a row/version existed at historical T0; revision/version ambiguity is explicitly excluded or classified unsafe;
6. no generic news, daily-gainers retrospective news, analyst revision, future price/outcome, same-industry outcome, catalyst feature, threshold, optimized cutoff, score, weight, production model, or strategy was introduced;
7. no Withdrawal v6.0-v6.5 methodology/validation file changed;
8. changed-file scope is bounded to audit/documentation and strictly necessary reproducibility code/tests;
9. final decision is explicit: `official_disclosure_preregistration_ready` or `official_disclosure_not_ready`, with unresolved provenance gaps listed;
10. any later catalyst-development/preregistration round remains separately preregistered and is not executed automatically.

On PASS, update/commit this canonical handoff and stop. Do not open holdouts or add a catalyst layer automatically.

End with:
`Prompt B closeout: PASS`
and stop.
```

## Safety / stop conditions

- No production strategy promotion.
- No MediaTek outcome-driven tuning.
- No development-outcome reading in the official-disclosure coverage audit.
- No stock-holdout/time-holdout outcome opening.
- No mutation of the immutable Phase 2 freeze, refreshed development outcome, or refreshed association.
- No binary cutoff or weighted score optimization.
- No catalyst/news feature creation in the audit round.
- No generic news or analyst-revision admission without separate PIT proof.
- No modification of frozen Withdrawal methodology/validation state.
- Promotion does not execute the promoted Prompt A automatically.
