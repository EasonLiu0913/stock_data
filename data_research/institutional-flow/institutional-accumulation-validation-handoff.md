# Institutional Accumulation / Catalyst Pre-positioning Research — Handoff

Canonical handoff: `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`

## Current phase

**Phase 4 — development-only continuous association analysis: COMPLETE / Prompt B PASS.**

Promoted next round:

`institutional-accumulation-development-outcome-maturity-refresh-v1`

Status:

- `institutional-accumulation-preregistration-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-point-in-time-contract-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-sample-freeze-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-outcome-opening-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-association-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-outcome-maturity-refresh-v1`: Prompt A **NOT STARTED / ACTIVE**, Prompt B **PREREGISTERED / NOT STARTED**.

Promotion does not execute the promoted Prompt A automatically.

## Objective and frozen constraints

Detect cases where price has not yet fully repriced upward while durable institutional capital has already changed behavior in a bullish direction, then later test whether PIT-safe catalyst evidence adds incremental value.

This remains research, not a production strategy.

Canonical preregistration:

`data_research/institutional-flow/institutional-accumulation-preregistration-v1.md`

Protected MediaTek `2454` remains `motivation_cases_only` and outside development/validation tuning evidence. Stock holdout and time holdout outcomes remain sealed. Withdrawal v6.0-v6.5 methodology, classifier/lifecycle rules, validation state, outcomes, and holdouts remain frozen and are not Accumulation inputs.

No arbitrary final weighted score is frozen. No binary repricing/success threshold has been introduced.

Required lifecycle remains:

`outcome-blind selection -> durable sample freeze -> development-only outcome opening -> mandatory closeout -> development-only association analysis -> mandatory closeout -> separately authorized future work`

## Durable prior-phase checkpoints

### Phase 0 — preregistration/source-semantics audit

Prompt B: **PASS**.

Key commits:

- `8a34187f87998fcc20c32024eeab47ac927f0957` — preregistration/source-semantics audit;
- `34868751908edd18aea19dac35885c2c373be902` — Phase 0 checkpoint.

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

Closeout evidence included workflow run `33505951816`, job `99849911255`, tested head `801d15b006217842597b187baa0d548872382700`, with 9 tests passed and 0 failed.

### Phase 2 — durable development sample freeze

Round: `institutional-accumulation-development-sample-freeze-v1`

Prompt B: **PASS**.

Frozen universe:

`1101, 1102, 1103, 1104, 1108, 1109, 1110, 1201, 1203, 1210, 1213, 1215, 1216, 1217, 1218`

Frozen T0 anchors:

`20260814, 20260817, 20260818, 20260819, 20260820, 20260821, 20260824, 20260825, 20260826, 20260827`

Frozen eligible counts:

- methodology_development: `41`
- stock_holdout: `11`
- time_holdout: `10`
- ineligible prospective anchors: `88`

Phase 2 manifest:

`data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`

Manifest semantic SHA-256:

`66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`

The frozen manifest must not be regenerated, reselected, repartitioned, or modified in later development rounds.

### Phase 3 — development-only continuous outcome opening

Round: `institutional-accumulation-outcome-opening-v1`

Prompt A: **COMPLETE**. Prompt B: **PASS**.

Durable implementation entry points:

- `scripts/open_institutional_accumulation_development_outcomes.js`
- `tests/institutional_accumulation_development_outcomes.test.js`
- `.github/workflows/open-institutional-accumulation-development-outcomes.yml`
- `data_research/institutional-flow/institutional-accumulation-development-outcome-opening-v1.json`

Durable outcome commit:

`429abae00b0a7cd6587c0a7e9a70b1c55315176a`

Closeout repair evidence:

- repair commit `4c3821759f4ac426cf72d9843f0851d0d02c7383`;
- repaired run `33516827150`;
- repaired job `99885841794`;
- deterministic guards: `5 passed, 0 failed`;
- durable Phase 3 outcome byte SHA-256: `a4422c23cfb749c6f484dfe99e7ca31d7477b410c430536d8314ca8c1bddea58`.

Frozen Phase 3 session coverage:

- first: `20260814`
- last: `20260831`
- count: `11`

Outcome coverage at Phase 3 closeout:

| Horizon | Continuous outcome available | Not yet observed |
| --- | ---: | ---: |
| D+5 | 31 | 10 |
| D+10 | 6 | 35 |
| D+20 | 0 | 41 |
| D+40 | 0 | 41 |

Not-yet-observed horizons remain explicit `null`; they are never zero-filled.

Outcome contract:

- D+5 / D+10 / D+20 / D+40 count exchange trading sessions;
- stock prices use `scripts/lib/stock_price_provider.js:getDailyPrice`;
- TAIEX-relative returns use the same session date and TWSE MI_INDEX `發行量加權股價指數`;
- absolute forward return and TAIEX-relative forward return remain continuous;
- MFE/MAE remain continuous and use the same T0/session convention;
- same-industry-relative outcomes remain omitted because PIT-safe effective-dated historical industry membership is unproven;
- `binary_success_threshold` remains `null`;
- no production classifier, final weighted score, or strategy was promoted.

## Phase 4 — development-only continuous association analysis

Round:

`institutional-accumulation-development-association-v1`

### Prompt A implementation

Prompt A: **COMPLETE**.

Durable implementation artifacts:

- `scripts/analyze_institutional_accumulation_development_associations.js`;
- `tests/institutional_accumulation_development_associations.test.js`;
- `.github/workflows/analyze-institutional-accumulation-development-associations.yml`;
- `data_research/institutional-flow/institutional-accumulation-development-association-v1.json`.

Fresh-runner Prompt A evidence:

- workflow run: `33524892264`;
- workflow job: `99913112251`;
- workflow head: `f2b9ed955fd1cb07a2a22c13a07921ccb4cee137`;
- durable artifact/checkpoint commit: `9c1037023a9e0feffb152fe1ddcd1c254a158d83`;
- parent Phase 2 freeze semantic SHA-256: `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`;
- parent Phase 3 outcome byte SHA-256: `a4422c23cfb749c6f484dfe99e7ca31d7477b410c430536d8314ca8c1bddea58`;
- generated/durable association artifact byte SHA-256: `781269adbe62b51a6b6fec9ac9325e602a2014f34282433dbfa04cbbd395e8d2`;
- frozen methodology-development identities analyzed: `41`;
- preregistered pair attempts: `64`;
- analyzable pairs (`n >= 20`): `16`;
- insufficient-n pairs: `48`;
- deterministic tests: `5 passed, 0 failed`.

Only D+5 met the preregistered `n >= 20` gate at frozen Phase 3 coverage. D+10/D+20/D+40 remained `insufficient_n` and uninterpreted.

### Phase 4 Prompt B closeout

**Prompt B closeout: PASS**

The exact Phase 4 Prompt B was recovered from durable pre-Prompt-A commit `70c047b8b7b286a5efad1f9773dd43a7b1cd0419`, whose handoff already contained the Phase 4 Prompt A + Prompt B pair before implementation commit `e20deef6e8ae1e6caa92b29040205daeec2f2fda`.

Independent closeout verification re-established current remote state and checked every preregistered criterion:

1. Phase 2 freeze identity/hash and Phase 3 outcome byte identity used by the analysis remain the preregistered values and were not redefined or refreshed in Phase 4 — **PASS**.
2. Analyzer filters only eligible frozen `methodology_development` rows, requires exactly `41`, and requires identity equality with the 41 Phase 3 outcome rows — **PASS**.
3. Stock holdout, time holdout, and protected MediaTek `2454` outcomes remain sealed; the analyzer explicitly rejects `2454` in the development partition/outcome scope — **PASS**.
4. Only the four preregistered feature fields are present in `FEATURES` — **PASS**.
5. Only `absolute_forward_return`, `taiex_relative_forward_return`, `mfe`, and `mae` for D+5/D+10/D+20/D+40 are analyzed; parent outcome bytes are pinned and `extended_or_refreshed_in_this_round` is false — **PASS**.
6. Spearman is implemented as Pearson correlation of deterministic average ranks; tie behavior and monotonic examples are covered by regression tests — **PASS**.
7. `MIN_N` is fixed at `20`; statistics are emitted only for `n >= 20`; smaller samples are `insufficient_n`, `spearman_rho: null`, `interpretation_allowed: false` — **PASS**.
8. Feature/outcome missingness is handled pairwise; non-finite observations are skipped rather than zero-filled, and `pair_missing = 41 - n` is regression-checked — **PASS**.
9. `binary_success_threshold`, `optimized_cutoff`, `composite_score`, and `weights` remain `null`; no production model is introduced — **PASS**.
10. The durable artifact carries parent identities/hashes, feature/outcome/horizon identities, n/missingness, research-only/development-only flags, and reproduces deterministic bytes — **PASS**.
11. `catalyst_news_layer_added` remains false, no production strategy/model was promoted, and the bounded changed-file audit contains no Withdrawal methodology/validation files — **PASS**.
12. From pre-Phase-4 baseline `70c047b8b7b286a5efad1f9773dd43a7b1cd0419` to durable Phase-4 checkpoint `9c1037023a9e0feffb152fe1ddcd1c254a158d83`, the research change set is exactly the analyzer script, regression test, workflow, association artifact, and this canonical handoff — **PASS**.

Fresh-runner evidence independently confirms:

- workflow run `33524892264`, job `99913112251`, conclusion `success`;
- all workflow steps including regression guards, scope/minimum-n verification, durable commit/push, and remote-byte verification succeeded;
- tests: `5 passed, 0 failed`;
- generated association SHA-256 = durable remote association SHA-256 = `781269adbe62b51a6b6fec9ac9325e602a2014f34282433dbfa04cbbd395e8d2`.

Concurrent-change audit after `9c1037023a9e0feffb152fe1ddcd1c254a158d83` found only the unrelated CNN Fear & Greed data update `e22f32976aa724724ecf8fa6e49f5386865f2db0`; no Phase 4 implementation, routing, handoff, frozen input, or protected research state was changed.

No holdout opening is authorized by this PASS.

## Phase 4 development-only findings

These are descriptive development-only associations, not a production model and not a strategy promotion.

At D+5 (`n=31` for each analyzable pair):

- `core_accumulation_percentile`: rho `0.1568` absolute return, `0.0482` TAIEX-relative return, `0.1698` MFE, `-0.1602` MAE;
- `supply_absorption_percentile`: rho `0.1175` absolute return, `0.0235` TAIEX-relative return, `0.0624` MFE, `-0.2339` MAE;
- `price_return_percentile`: rho `0.1310` absolute return, `0.0991` TAIEX-relative return, `0.1929` MFE, `-0.1671` MAE;
- `price_non_confirmation_rank_gap`: rho `0.0266` absolute return, `-0.0519` TAIEX-relative return, `-0.0053` MFE, `0.0350` MAE.

The current D+5 associations are generally weak in magnitude. No threshold, weight, ranking formula, or production decision may be inferred from them. D+10/D+20/D+40 were not interpreted because they failed the preregistered minimum-n gate.

## Known limitations carried forward

- The frozen Phase 3 artifact is only mature enough for D+5 (`31`) and a small D+10 subset (`6`); D+20/D+40 are not yet mature there.
- Normalized HiStock broker history remains insufficient for mandatory use.
- Historical TDCC publication timing remains unsafe/unverified.
- Effective-dated historical industry membership remains unverified.
- Complete timestamped historical catalyst/news/analyst-revision evidence remains unverified.
- PIT-safe free-float/share-base normalization remains unaudited.
- Numerical binary repricing/success thresholds remain deliberately unfrozen.
- Stock holdout, time holdout, and protected `2454` remain sealed.

## Next round

Promoted round:

`institutional-accumulation-development-outcome-maturity-refresh-v1`

Purpose: separately authorize a bounded refresh of **development-only** continuous outcomes for the already-frozen 41 methodology-development identities as additional exchange sessions mature, without changing the Phase 2 sample, opening any holdout, tuning any threshold, or mixing the refresh with association re-analysis in the same round.

This next round is preregistered only after Phase 4 Prompt B PASS. It does not alter the immutable Phase 2 freeze and does not authorize holdout opening.

### Exact entry points

- writer: `scripts/open_institutional_accumulation_development_outcomes.js`
- writer regression: `tests/institutional_accumulation_development_outcomes.test.js`
- writer workflow: `.github/workflows/open-institutional-accumulation-development-outcomes.yml`
- immutable freeze: `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`
- current frozen outcome input: `data_research/institutional-flow/institutional-accumulation-development-outcome-opening-v1.json`
- Phase 4 association evidence: `data_research/institutional-flow/institutional-accumulation-development-association-v1.json`
- PIT contract: `data_research/institutional-flow/institutional-accumulation-pit-contract-v1.md`
- canonical handoff: `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`

## Prompt A — Development-only outcome maturity refresh

```text
Continue the Institutional Accumulation / Catalyst Pre-positioning research project only if Phase 4 round `institutional-accumulation-development-association-v1` has mandatory Prompt B PASS and has explicitly promoted `institutional-accumulation-development-outcome-maturity-refresh-v1`.

Before work, fetch current remote main; read AGENTS.md, `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, this canonical handoff, `data_research/institutional-flow/institutional-accumulation-preregistration-v1.md`, `data_research/institutional-flow/institutional-accumulation-pit-contract-v1.md`, immutable freeze `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`, current outcome artifact `data_research/institutional-flow/institutional-accumulation-development-outcome-opening-v1.json`, writer `scripts/open_institutional_accumulation_development_outcomes.js`, regression `tests/institutional_accumulation_development_outcomes.test.js`, workflow `.github/workflows/open-institutional-accumulation-development-outcomes.yml`, and Phase 4 association artifact `data_research/institutional-flow/institutional-accumulation-development-association-v1.json`.

Recover this exact Prompt A + Prompt B pair from durable history and verify it was preregistered after Phase 4 closeout and before this refresh begins.

Implement only a bounded development-outcome maturity refresh:
- keep the Phase 2 freeze semantic SHA-256 exactly `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`;
- keep exactly the same 41 eligible `methodology_development` identities;
- do not regenerate, reselect, repartition, or mutate the Phase 2 freeze;
- extend outcome session coverage only with exchange sessions that are actually available on current remote data;
- recompute continuous D+5/D+10/D+20/D+40 absolute return, TAIEX-relative return, MFE, and MAE under the existing Phase 3 contract;
- preserve explicit null for not-yet-mature or unavailable observations and never zero-fill missing values;
- do not add same-industry outcomes while effective-dated PIT-safe industry membership remains unproven;
- do not open, inspect, summarize, derive, or encode stock-holdout, time-holdout, or protected MediaTek `2454` outcomes;
- do not add binary labels, success thresholds, optimized cutoffs, composite scores, weights, catalyst/news evidence, or production logic;
- do not modify Withdrawal v6.0-v6.5 methodology/validation state.

The existing Phase 4 association artifact is historical evidence from the prior frozen outcome bytes. Do not rewrite or recompute it in this round. This round must stop at the refreshed development-only outcome artifact plus deterministic reproduction/remote-durability verification.

Record old and new outcome byte SHA-256, old and new session coverage, and per-horizon available/not-yet-observed counts in the canonical handoff. Add or update deterministic regression guards only when needed to preserve the existing outcome contract; do not change methodology to improve sample size.

Prompt A completion contract:
1. the immutable Phase 2 freeze identity/hash is verified unchanged;
2. exactly 41 methodology-development identities are refreshed;
3. no holdout/2454 outcome is opened;
4. the refreshed outcome artifact is durably present on remote main;
5. regenerated bytes match durable remote bytes;
6. tests/guards pass;
7. the handoff records Prompt A completion evidence while preserving this preregistered Prompt B.

When complete, report:
`Prompt A complete — ready for Prompt B`
and stop. Do not rerun Phase 4 associations automatically.
```

## Prompt B — Development-only outcome maturity refresh closeout

```text
Perform mandatory closeout for round `institutional-accumulation-development-outcome-maturity-refresh-v1` only after its Prompt A has completed.

Fetch current remote main; read AGENTS.md, this canonical handoff, the original preregistration, Phase 1 PIT contract, immutable Phase 2 freeze, the pre-refresh outcome artifact identity recorded in this handoff/history, `scripts/open_institutional_accumulation_development_outcomes.js`, `tests/institutional_accumulation_development_outcomes.test.js`, `.github/workflows/open-institutional-accumulation-development-outcomes.yml`, and the durable refreshed outcome artifact. Recover this exact preregistered Prompt B from durable pre-Prompt-A history.

Verify at minimum:
1. Phase 2 freeze identity/hash, universe, anchors, partitions, mandatory/optional source rules, and all 41 methodology-development identities remain unchanged;
2. refresh output contains only those same 41 eligible methodology-development identities;
3. no stock-holdout, time-holdout, or protected MediaTek `2454` outcome was opened, summarized, derived, or encoded;
4. the only outcome families remain continuous absolute return, TAIEX-relative return, MFE, and MAE at D+5/D+10/D+20/D+40 under the existing exchange-session convention;
5. session coverage only advances through genuinely available exchange sessions and no unavailable/missing observation is zero-filled;
6. unified stock-price provider and same-session TAIEX benchmark semantics remain unchanged;
7. no same-industry outcome was introduced without proven PIT-safe effective-dated historical membership;
8. no binary label, success threshold, optimized cutoff, composite score, weighting, catalyst/news layer, or production model/strategy was introduced;
9. old and new outcome byte identities, session coverage, and per-horizon maturity counts are recorded and internally consistent;
10. deterministic tests/reproduction pass and regenerated refreshed bytes match durable remote bytes;
11. the prior Phase 4 association artifact was not rewritten or recomputed during this refresh;
12. changed files/tests/commits and durable remote artifacts satisfy this bounded development-only maturity-refresh contract and Withdrawal v6.0-v6.5 state remains untouched.

On PASS, update/commit this canonical handoff. Any subsequent association re-analysis must be a separately preregistered next round using the refreshed outcome byte identity; do not open untouched holdouts automatically.

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
- No catalyst/news layer unless a later separately preregistered round authorizes it.
- No modification of frozen Withdrawal methodology/validation state.
- Promotion does not execute the promoted Prompt A automatically.
