# Institutional Accumulation / Catalyst Pre-positioning Research — Handoff

Canonical handoff: `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`

## Current phase

**Phase 3 — development-only continuous outcome opening: COMPLETE / Prompt B PASS.**

Promoted next round:

`institutional-accumulation-development-association-v1`

Status:

- `institutional-accumulation-preregistration-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-point-in-time-contract-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-sample-freeze-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-outcome-opening-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-association-v1`: Prompt A **NOT STARTED / ACTIVE**, Prompt B **PREREGISTERED / NOT STARTED**.

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

The pre-Phase-3 durable file at commit `d1ff07d0499d25a818e45ff76a6c7afcde1a141d` and the Phase 3 closeout file both have Git blob SHA `4215a84a110406714e200618d280b70d0d1e7f46`, so the frozen manifest was not regenerated or changed during outcome opening.

The manifest carries SHA-256 identities for the source files referenced by frozen PIT observations.

## Phase 3 — development-only continuous outcome opening

Round:

`institutional-accumulation-outcome-opening-v1`

### Prompt A implementation

Prompt A: **COMPLETE**.

Durable implementation entry points:

- `scripts/open_institutional_accumulation_development_outcomes.js`
- `tests/institutional_accumulation_development_outcomes.test.js`
- `.github/workflows/open-institutional-accumulation-development-outcomes.yml`
- `data_research/institutional-flow/institutional-accumulation-development-outcome-opening-v1.json`

Durable outcome commit:

`429abae00b0a7cd6587c0a7e9a70b1c55315176a`

Prompt A fresh-runner evidence:

- workflow run `33514998467`;
- original successful job `99879685892`;
- frozen parent semantic SHA-256 verified: `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`;
- frozen referenced source files verified: `154`;
- methodology-development outcomes materialized: `41`;
- stock-holdout outcomes materialized: `0`;
- time-holdout outcomes materialized: `0`;
- protected `2454` outcomes materialized: `0`.

Outcome coverage at closeout:

| Horizon | Continuous outcome available | Not yet observed |
| --- | ---: | ---: |
| D+5 | 31 | 10 |
| D+10 | 6 | 35 |
| D+20 | 0 | 41 |
| D+40 | 0 | 41 |

Session coverage used by the durable Phase 3 artifact is `20260814` through `20260831` (11 sessions from the outcome session calendar). Not-yet-observed horizons remain explicit `null`; they are not converted to zero.

Outcome contract:

- D+5 / D+10 / D+20 / D+40 count exchange trading sessions;
- stock prices use `scripts/lib/stock_price_provider.js:getDailyPrice`;
- TAIEX-relative returns use the same session date and TWSE MI_INDEX `發行量加權股價指數`;
- absolute forward return and TAIEX-relative forward return remain continuous;
- MFE/MAE remain continuous and use the same T0/session convention;
- same-industry-relative outcomes remain omitted because PIT-safe effective-dated historical industry membership is unproven;
- `binary_success_threshold` remains `null`;
- no production classifier, final weighted score, or strategy was promoted.

## Phase 3 Prompt B closeout

**Prompt B closeout: PASS**

The exact Phase 3 Prompt B was recovered from durable pre-Prompt-A commit:

`d1ff07d0499d25a818e45ff76a6c7afcde1a141d`

Independent closeout verification re-established current remote state and checked every preregistered criterion:

1. Phase 2 manifest identity/content hash and all referenced source identities were verified before outcome opening and the freeze was not regenerated/redefined — **PASS**.
2. Outcome materialization is limited to eligible frozen `methodology_development` anchors — **PASS** (`41`).
3. Stock holdout, time holdout, and protected MediaTek `2454` future outcomes were not opened, summarized, or encoded — **PASS** (`0 / 0 / 0`).
4. D+5/D+10/D+20/D+40 count exchange trading sessions rather than calendar days — **PASS**.
5. Stock prices use the unified provider and TAIEX-relative outcomes align to the same session sequence — **PASS**.
6. Missing stock/benchmark or not-yet-mature observations remain explicit missing/null values and are never zero-filled — **PASS**.
7. Same-industry-relative outcomes remain omitted while historical effective-dated membership is unproven — **PASS**.
8. No post-outcome binary repricing/success cutoff was invented or tuned — **PASS**.
9. Phase 2 features, universe, anchors, partitions, mandatory/optional source rules, manifest identity, and hashes remain unchanged — **PASS**.
10. The durable development-only outcome artifact is reproducible and carries parent freeze identity/hash plus stock/benchmark outcome provenance — **PASS**.
11. No production classifier/final weighted score/strategy was promoted, and Withdrawal v6.0-v6.5 state remains untouched — **PASS**.
12. Changed files/tests/commits and durable remote artifacts satisfy the preregistered development-only outcome-opening contract — **PASS**.

### Closeout reproducibility and bounded repair evidence

Prompt B independently reran the Phase 3 writer. The first rerun reproduced all research tests and outcome bytes but exposed a sparse-checkout verification defect: after rebasing an already-applied generated-file commit, the sparse worktree did not rematerialize the artifact, causing the final local `sha256sum` check to fail even though the durable remote artifact existed.

This was treated as a closeout defect rather than ignored. Only the workflow durability check was repaired:

- repair commit `4c3821759f4ac426cf72d9843f0851d0d02c7383` — `fix: verify regenerated accumulation artifact after rebase`;
- repaired run `33516827150`;
- repaired job `99885841794`;
- conclusion: **SUCCESS**;
- deterministic guards: **5 passed, 0 failed**;
- regenerated outcome byte SHA-256: `a4422c23cfb749c6f484dfe99e7ca31d7477b410c430536d8314ca8c1bddea58`;
- durable remote outcome byte SHA-256: `a4422c23cfb749c6f484dfe99e7ca31d7477b410c430536d8314ca8c1bddea58`;
- writer reported the durable artifact/checkpoint already matched regenerated output, so no new outcome-data commit was needed.

Changed-file audit from pre-Phase-3 baseline `d1ff07d0499d25a818e45ff76a6c7afcde1a141d` contains only the Phase 3 opener workflow/script/test/outcome artifact and this handoff as research changes. Concurrent market-news/risk, TWSE institutional-investor, and TWT49U data commits are unrelated. No Withdrawal methodology/validation files changed.

## Known limitations carried forward

- D+10 currently has only 6 complete development outcomes; D+20 and D+40 have not matured in the frozen Phase 3 artifact.
- Normalized HiStock broker history remains insufficient for mandatory use.
- Historical TDCC publication timing remains unsafe/unverified.
- Effective-dated historical industry membership remains unverified.
- Complete timestamped historical catalyst/news/analyst-revision evidence remains unverified.
- PIT-safe free-float/share-base normalization remains unaudited.
- Numerical binary repricing/success thresholds remain deliberately unfrozen.
- Stock holdout, time holdout, and protected `2454` remain sealed.

## Next round

Promoted round:

`institutional-accumulation-development-association-v1`

Purpose: inspect whether the already-frozen PIT accumulation / supply-absorption / price-non-confirmation features show useful monotonic association with the **already-opened development-only continuous outcomes**, without opening holdouts, inventing binary success thresholds, or promoting a production score.

The round is preregistered now, before any association result is computed.

---

## Prompt A — Development-only continuous association analysis

```text
Continue the Institutional Accumulation / Catalyst Pre-positioning research project only if Phase 3 round `institutional-accumulation-outcome-opening-v1` has mandatory Prompt B PASS and has explicitly promoted `institutional-accumulation-development-association-v1`.

Before work, fetch current remote main; read AGENTS.md, project philosophy/roadmap, this canonical handoff, the original preregistration, Phase 1 PIT contract, the immutable Phase 2 freeze manifest, and the durable Phase 3 development-only outcome artifact. Recover this exact Prompt A + Prompt B pair from durable history and verify it was preregistered before any association result was computed.

Use ONLY frozen eligible rows whose Phase 2 partition is `methodology_development` and whose identity matches the durable Phase 3 outcome artifact. Do not inspect, open, regenerate, summarize, or derive any stock-holdout, time-holdout, or protected MediaTek `2454` outcome.

Do not extend or refresh the Phase 3 outcome artifact with newer sessions in this round. The Phase 3 artifact is a frozen input for this association analysis.

Primary frozen feature family for this round:
- `pit_features.cross_sectional.core_accumulation_percentile`;
- `pit_features.cross_sectional.supply_absorption_percentile`;
- `pit_features.cross_sectional.price_return_percentile`;
- `pit_features.cross_sectional.price_non_confirmation_rank_gap`.

Primary continuous outcome family is restricted to values already present in the Phase 3 artifact:
- absolute forward return;
- TAIEX-relative forward return;
- MFE;
- MAE;
for D+5 / D+10 / D+20 / D+40 when present.

Preregistered analysis rule:
- use Spearman rank association for each feature/outcome/horizon pair;
- pairwise complete observations only;
- calculate/report an association statistic only when pairwise complete `n >= 20`;
- when `n < 20`, report `insufficient_n` and do not interpret direction or strength;
- do not search alternative minimum-n rules after seeing results;
- do not add binary labels, success thresholds, optimized cutoffs, composite scores, or weights;
- do not treat multiple pairwise associations as a production model;
- preserve continuous values and report sample count/missingness for every attempted pair.

At the current frozen Phase 3 coverage, D+5 may be analyzable while D+10/D+20/D+40 may fail the preregistered minimum-n gate. That is an allowed outcome and must not cause holdout opening, outcome refresh, or threshold relaxation.

Write a durable development-only association artifact carrying parent Phase 2 freeze hash, parent Phase 3 outcome identity/byte identity, feature/outcome identities, horizon, n, missingness, Spearman statistic or `insufficient_n`, and research-only/no-production flags. Add deterministic regression/reproduction checks and update this canonical handoff while preserving the paired Prompt B.

Do not add catalyst/news evidence in this round. Do not alter Withdrawal v6.0-v6.5 state. Do not promote a production classifier, final weighted score, or strategy.

Stop after the development-only association artifact is durably written and verified. Do not open holdouts automatically.

When complete, report:
`Prompt A complete — ready for Prompt B`
and stop.
```

## Prompt B — Development-only association closeout

```text
Perform mandatory closeout for round `institutional-accumulation-development-association-v1` only after its Prompt A has completed.

Fetch current remote main; read AGENTS.md, this canonical handoff, the original preregistration, Phase 1 PIT contract, Phase 2 freeze manifest, and Phase 3 development-only outcome artifact. Recover this exact preregistered Prompt B from durable pre-Prompt-A history.

Verify at minimum:
1. Phase 2 freeze identity/hash and Phase 3 outcome artifact identity/bytes used by the analysis are durable and were not redefined or refreshed for this round;
2. every analyzed row is an eligible frozen `methodology_development` identity and matches the Phase 3 outcome artifact;
3. no stock-holdout, time-holdout, or protected MediaTek `2454` outcome was opened, summarized, derived, or encoded;
4. only the four preregistered frozen feature fields were analyzed;
5. only already-present Phase 3 continuous outcome fields were analyzed and the Phase 3 artifact was not extended with newer sessions;
6. Spearman rank association is implemented correctly and deterministically;
7. statistics are produced only for pairwise-complete `n >= 20`; all smaller samples are explicitly `insufficient_n` with no directional/strength conclusion;
8. missing observations are excluded pairwise and are never zero-filled;
9. no binary label, success threshold, optimized cutoff, composite score, weighting, or production model was introduced after viewing results;
10. the durable association artifact is reproducible and carries parent identities/hashes, feature/outcome/horizon identities, n/missingness, and research-only flags;
11. no catalyst/news layer was added, no production strategy was promoted, and Withdrawal v6.0-v6.5 state remains untouched;
12. changed files/tests/commits and durable remote artifacts satisfy this preregistered development-only association contract.

On PASS, update/commit this canonical handoff. Do not open untouched holdouts unless a separately preregistered and explicitly promoted future round authorizes it.

End with:
`Prompt B closeout: PASS`
and stop.
```

## Safety / stop conditions

- No production strategy promotion.
- No MediaTek outcome-driven tuning.
- No stock-holdout/time-holdout outcome opening.
- No Phase 3 outcome refresh/extension during the association round.
- No binary cutoff or weighted score optimization.
- No catalyst/news layer during the promoted association round.
- No modification of frozen Withdrawal methodology/validation state.
- Promotion does not execute the promoted Prompt A automatically.
