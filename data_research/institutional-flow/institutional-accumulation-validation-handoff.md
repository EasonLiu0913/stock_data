# Institutional Accumulation / Catalyst Pre-positioning Research — Handoff

Canonical handoff: `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`

## Current phase

**Development-only association refresh: COMPLETE / Prompt B PASS.**

Promoted next round:

`institutional-accumulation-catalyst-evidence-readiness-audit-v1`

Status:

- `institutional-accumulation-preregistration-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-point-in-time-contract-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-sample-freeze-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-outcome-opening-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-association-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-outcome-maturity-refresh-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-association-refresh-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-catalyst-evidence-readiness-audit-v1`: Prompt A **NOT STARTED / ACTIVE**, Prompt B **PREREGISTERED / NOT STARTED**.

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
- Withdrawal v6.0-v6.5 methodology, classifier/lifecycle rules, validation state, outcomes, and holdouts remain frozen and are not Accumulation inputs;
- no binary repricing/success threshold, optimized cutoff, composite score, or production weighting is authorized;
- no same-industry-relative outcome while PIT-safe effective-dated historical industry membership remains unproven;
- no catalyst/news layer may be added to the model until a separately preregistered PIT-safe catalyst round explicitly authorizes it.

## Durable prior-phase checkpoints

### Phase 0 — preregistration/source-semantics audit

Prompt B: **PASS**.

Key commits:

- `8a34187f87998fcc20c32024eeab47ac927f0957`;
- `34868751908edd18aea19dac35885c2c373be902`.

### Phase 1 — PIT contract

Round: `institutional-accumulation-point-in-time-contract-v1`

Prompt B: **PASS**.

Core entry points:

- `scripts/lib/institutional_accumulation_pit.js`
- `scripts/lib/stock_price_provider.js`
- `scripts/lib/histock_broker_quality.js`
- `tests/institutional_accumulation_pit.test.js`
- `tests/institutional_accumulation_pit_coverage.test.js`
- `data_research/institutional-flow/institutional-accumulation-pit-contract-v1.md`

Closeout evidence: run `33505951816`, job `99849911255`, tested head `801d15b006217842597b187baa0d548872382700`, 9 tests passed / 0 failed.

### Phase 2 — durable development sample freeze

Round: `institutional-accumulation-development-sample-freeze-v1`

Prompt B: **PASS**.

Frozen universe:

`1101, 1102, 1103, 1104, 1108, 1109, 1110, 1201, 1203, 1210, 1213, 1215, 1216, 1217, 1218`

Frozen T0 anchors:

`20260814, 20260817, 20260818, 20260819, 20260820, 20260821, 20260824, 20260825, 20260826, 20260827`

Frozen counts:

- methodology_development: `41`
- stock_holdout: `11`
- time_holdout: `10`
- ineligible prospective anchors: `88`

Immutable freeze:

`data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`

Semantic SHA-256:

`66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`

### Phase 3 — development-only continuous outcome opening

Round: `institutional-accumulation-outcome-opening-v1`

Prompt A **COMPLETE** / Prompt B **PASS**.

Durable original outcome byte SHA-256:

`a4422c23cfb749c6f484dfe99e7ca31d7477b410c430536d8314ca8c1bddea58`

### Phase 4 — development-only continuous association analysis

Round: `institutional-accumulation-development-association-v1`

Prompt A **COMPLETE** / Prompt B **PASS**.

Original association byte SHA-256:

`781269adbe62b51a6b6fec9ac9325e602a2014f34282433dbfa04cbbd395e8d2`

Evidence: run `33524892264`, job `99913112251`, durable checkpoint `9c1037023a9e0feffb152fe1ddcd1c254a158d83`, 5 tests passed / 0 failed.

### Development-only outcome maturity refresh

Round: `institutional-accumulation-development-outcome-maturity-refresh-v1`

Prompt A **COMPLETE** / Prompt B **PASS**.

Refreshed outcome byte SHA-256:

`f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`

Coverage through `20260901`:

- D+5 available `38/41`;
- D+10 available `14/41`;
- D+20 available `0/41`;
- D+40 available `0/41`.

Evidence: run `33533052151`, job `99940649047`, durable refreshed outcome commit `8acb153d5f588a1aca046eb500ff9e04ae1be0e9`, 5 tests passed / 0 failed.

## Development-only association refresh closeout

Round:

`institutional-accumulation-development-association-refresh-v1`

### Prompt A implementation evidence

**Prompt A: COMPLETE.**

- workflow run: `33535965601`;
- workflow job: `99950232207` (`analyze-development-associations`);
- implementation head: `075dc5e4aae7a6f5cf6d3e78c4d768168667017b`;
- exact Prompt A + Prompt B pair was already durable in pre-Prompt-A handoff commit `6031af4e3adb26fa0c8cf79d788feccbbf49ba81`;
- parent Phase 2 freeze semantic SHA-256: `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`;
- parent refreshed outcome byte SHA-256: `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`;
- old association byte SHA-256: `781269adbe62b51a6b6fec9ac9325e602a2014f34282433dbfa04cbbd395e8d2`;
- new association byte SHA-256: `779e2be6708e6d8bc55062058ede6178e2dd4cf7634621d05ab05228c31e7b68`;
- durable artifact commit: `7678248ba74bac910ebc86701e6df24d54ced23a`;
- Prompt A checkpoint commit: `5d6406e151c47208d7b5e7e1dd15bcb039fd0a66`;
- durable remote association bytes matched generated bytes;
- frozen methodology-development identities analyzed: `41`;
- attempted pairs: `64`;
- analyzable pairs: `16`;
- insufficient-n pairs: `48`;
- D+5: `n=38`, pair-missing `3`, 16 analyzable pairs;
- D+10: `n=14`, pair-missing `27`, 16 insufficient-n pairs;
- D+20: `n=0`, pair-missing `41`, 16 insufficient-n pairs;
- D+40: `n=0`, pair-missing `41`, 16 insufficient-n pairs;
- deterministic regression guards: `5 passed, 0 failed`.

### Prompt B closeout

**Prompt B closeout: PASS**

The exact closeout contract was recovered from durable pre-Prompt-A handoff commit `6031af4e3adb26fa0c8cf79d788feccbbf49ba81`, where `institutional-accumulation-development-association-refresh-v1` was still `NOT STARTED / ACTIVE` and its phase-specific Prompt B was already preregistered.

Independent closeout verification against current remote state established all preregistered criteria:

1. Association parent outcome SHA-256 is exactly `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`; Phase 2 freeze semantic SHA-256 remains exactly `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b` — **PASS**.
2. Analyzer requires exactly 41 eligible `methodology_development` identities, identity-equality with the 41 outcome rows, and explicitly rejects protected `2454` — **PASS**.
3. Feature set remains exactly the four frozen accumulation features — **PASS**.
4. Outcome set remains exactly continuous `absolute_forward_return`, `taiex_relative_forward_return`, `mfe`, and `mae` at D+5/D+10/D+20/D+40 — **PASS**.
5. Spearman remains Pearson correlation over deterministic average ranks; tie/monotonic regression guards passed in fresh-runner run `33535965601` — **PASS**.
6. `MIN_N` remains exactly `20`; `n < 20` rows are `insufficient_n`, `spearman_rho: null`, `interpretation_allowed: false`; no methodology relaxation occurred — **PASS**.
7. Missingness remains pairwise-complete and non-zero-filled; durable artifact has D+5 `38/3`, D+10 `14/27`, D+20 `0/41`, D+40 `0/41` for n/pair-missing — **PASS**.
8. `binary_success_threshold`, `optimized_cutoff`, `composite_score`, and `weights` remain null; no catalyst/news layer, same-industry outcome, production model, or strategy was introduced — **PASS**.
9. Old/new association hashes, parent refreshed outcome hash, horizon maturity, pair counts, run/job/commit identity, and durable remote verification are recorded and internally consistent — **PASS**.
10. Generated association bytes equal durable remote association bytes SHA-256 `779e2be6708e6d8bc55062058ede6178e2dd4cf7634621d05ab05228c31e7b68` — **PASS**.
11. Stock holdout, time holdout, and protected `2454` outcomes remain sealed. No Withdrawal v6.0-v6.5 methodology/validation file changed in the bounded round — **PASS**.
12. Bounded compare `6031af4e3adb26fa0c8cf79d788feccbbf49ba81...5d6406e151c47208d7b5e7e1dd15bcb039fd0a66` is three commits and only four changed files: analyzer, association workflow, refreshed association artifact, and this canonical handoff. No unrelated research methodology file changed — **PASS**.

Freshness / concurrent-change audit:

- current main had advanced from Prompt A checkpoint `5d6406e151c47208d7b5e7e1dd15bcb039fd0a66` to `2843f93e7cadf2088db83c1c3fa28f3fab0e777c` before closeout;
- those four concurrent commits changed only `data_daily_gain_over_5/**`, `data_twse_margin_maintenance/**`, and `data_twse_quarterly_financial_quality/**` files;
- they did not change the accumulation analyzer, workflow, freeze, refreshed outcome, association artifact, canonical handoff, routing registry, or Withdrawal protected files;
- task routing remained `institutional-accumulation` as the sole active project.

No holdout opening is authorized by this PASS.

## Current repository state

Key durable research identities after closeout:

- immutable Phase 2 freeze SHA-256: `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`;
- refreshed development outcome SHA-256: `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`;
- refreshed development association SHA-256: `779e2be6708e6d8bc55062058ede6178e2dd4cf7634621d05ab05228c31e7b68`;
- methodology-development identities: `41`;
- D+5 analyzable association pairs: `16`;
- D+10/D+20/D+40: below fixed `MIN_N = 20` and uninterpreted;
- stock holdout, time holdout, and protected `2454`: sealed.

## Known limitations / rejected approaches

- D+10 maturity is only `14/41`; D+20/D+40 are not yet observed.
- Normalized HiStock broker history remains insufficient for mandatory use.
- Historical TDCC publication timing remains unsafe/unverified.
- Effective-dated historical industry membership remains unverified.
- Complete timestamped historical catalyst/news/analyst-revision evidence remains unverified.
- PIT-safe free-float/share-base normalization remains unaudited.
- Numerical binary repricing/success thresholds remain deliberately unfrozen.
- Do not infer catalyst value from current price/flow associations; catalyst evidence needs its own PIT-safe source audit and preregistration.

## Entry points

- canonical handoff: `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`
- preregistration: `data_research/institutional-flow/institutional-accumulation-preregistration-v1.md`
- PIT contract: `data_research/institutional-flow/institutional-accumulation-pit-contract-v1.md`
- immutable freeze: `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`
- refreshed outcome: `data_research/institutional-flow/institutional-accumulation-development-outcome-opening-v1.json`
- refreshed association: `data_research/institutional-flow/institutional-accumulation-development-association-v1.json`
- analyzer: `scripts/analyze_institutional_accumulation_development_associations.js`
- analyzer regression: `tests/institutional_accumulation_development_associations.test.js`
- analyzer workflow: `.github/workflows/analyze-institutional-accumulation-development-associations.yml`
- task routing: `docs/agent-prompts/task-routing.json`

Catalyst/news/analyst-revision source entry points are **not yet verified**. The next round must discover and record exact repo-relative paths instead of guessing them.

## Next round

Promoted round:

`institutional-accumulation-catalyst-evidence-readiness-audit-v1`

Purpose: perform a point-in-time/source-semantics readiness audit for potential catalyst/news/analyst-revision evidence before any catalyst feature is allowed into Accumulation research.

This is an **audit/preregistration round only**. It must not add catalyst features to the development association, inspect stock/time holdout outcomes, tune thresholds, or promote a strategy.

Required outcomes of the round:

1. inventory candidate catalyst/news/analyst-revision sources already present in the repository;
2. record exact repo-relative paths, collection timestamps/date semantics, source publication-time semantics, and whether historical point-in-time reconstruction is possible;
3. identify leakage risks such as article update timestamps, same-day-after-close publication, backfilled metadata, retrospective summaries, or analyst revisions without original effective timestamps;
4. classify each source as PIT-safe, conditionally usable with explicit cutoff rules, or unsafe/unproven;
5. decide whether there is enough evidence to preregister a later development-only catalyst association round;
6. if not enough, document the missing historical evidence and stop without adding a catalyst layer.

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
- Promotion does not execute the promoted Prompt A automatically.
