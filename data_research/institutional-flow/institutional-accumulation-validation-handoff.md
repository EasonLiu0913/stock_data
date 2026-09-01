# Institutional Accumulation / Catalyst Pre-positioning Research — Handoff

Canonical handoff: `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`

## Current phase

**Development-only outcome maturity refresh: COMPLETE / Prompt B PASS.**

Promoted next round:

`institutional-accumulation-development-association-refresh-v1`

Status:

- `institutional-accumulation-preregistration-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-point-in-time-contract-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-sample-freeze-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-outcome-opening-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-association-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-outcome-maturity-refresh-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-association-refresh-v1`: Prompt A **NOT STARTED / ACTIVE**, Prompt B **PREREGISTERED / NOT STARTED**.

Promotion does not execute the promoted Prompt A automatically.

## Objective and frozen constraints

Detect cases where price has not yet fully repriced upward while durable institutional capital has already changed behavior in a bullish direction, then later test whether PIT-safe catalyst evidence adds incremental value.

This remains research, not a production strategy.

Canonical preregistration:

`data_research/institutional-flow/institutional-accumulation-preregistration-v1.md`

Frozen invariants:

- Phase 2 semantic SHA-256: `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`;
- methodology-development identities: exactly `41`;
- protected MediaTek `2454` remains `motivation_cases_only` and excluded from development/validation outcome tuning;
- stock holdout and time holdout outcomes remain sealed;
- Withdrawal v6.0-v6.5 methodology, classifier/lifecycle rules, validation state, outcomes, and holdouts remain frozen and are not Accumulation inputs;
- no binary repricing/success threshold, optimized cutoff, composite score, or production weighting is authorized;
- no same-industry-relative outcome while PIT-safe effective-dated historical membership remains unproven;
- no catalyst/news layer unless separately preregistered.

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

Durable Phase 3 outcome byte SHA-256:

`a4422c23cfb749c6f484dfe99e7ca31d7477b410c430536d8314ca8c1bddea58`

Phase 3 coverage through `20260831` (`11` sessions): D+5 `31`, D+10 `6`, D+20 `0`, D+40 `0`.

### Phase 4 — development-only continuous association analysis

Round: `institutional-accumulation-development-association-v1`

Prompt A **COMPLETE** / Prompt B **PASS**.

Durable association artifact:

`data_research/institutional-flow/institutional-accumulation-development-association-v1.json`

Durable association byte SHA-256:

`781269adbe62b51a6b6fec9ac9325e602a2014f34282433dbfa04cbbd395e8d2`

Evidence: run `33524892264`, job `99913112251`, durable checkpoint `9c1037023a9e0feffb152fe1ddcd1c254a158d83`, tests 5 passed / 0 failed.

At the Phase 3 outcome bytes only D+5 met the fixed `MIN_N = 20` gate. The reported D+5 associations were generally weak and remain descriptive development-only evidence.

## Development-only outcome maturity refresh

Round:

`institutional-accumulation-development-outcome-maturity-refresh-v1`

### Prompt A implementation checkpoint

**Prompt A: COMPLETE.**

Fresh-runner evidence:

- workflow run: `33533052151`;
- workflow job: `99940649047`;
- workflow head / pre-refresh implementation commit: `214d10ff77f3c2e6021313e957fb9a5dc084d50b`;
- durable refreshed outcome commit: `8acb153d5f588a1aca046eb500ff9e04ae1be0e9`;
- old outcome byte SHA-256: `a4422c23cfb749c6f484dfe99e7ca31d7477b410c430536d8314ca8c1bddea58`;
- refreshed outcome byte SHA-256: `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`;
- old session coverage: `20260814` through `20260831` (`11` sessions);
- refreshed session coverage: `20260814` through `20260901` (`12` sessions);
- D+5 available: `31 -> 38`; not observed: `10 -> 3`;
- D+10 available: `6 -> 14`; not observed: `35 -> 27`;
- D+20 available: `0 -> 0`; not observed: `41 -> 41`;
- D+40 available: `0 -> 0`; not observed: `41 -> 41`;
- methodology-development identities: `41` unchanged;
- stock holdout materialized: `0`;
- time holdout materialized: `0`;
- protected 2454 materialized: `0`;
- deterministic tests: `5 passed, 0 failed`;
- deterministic second-generation bytes matched first generation;
- durable remote bytes matched generated SHA-256;
- Phase 4 association artifact was not rewritten or recomputed.

### Prompt B closeout

**Prompt B closeout: PASS**

The exact maturity-refresh Prompt B was recovered from durable pre-Prompt-A handoff state at commit `214d10ff77f3c2e6021313e957fb9a5dc084d50b`; it was therefore preregistered before durable refresh commit `8acb153d5f588a1aca046eb500ff9e04ae1be0e9`.

Independent closeout verification against current remote state re-established all preregistered criteria:

1. Phase 2 freeze identity/hash, universe, anchors, partition definitions, and all 41 methodology-development identities remain unchanged — **PASS**.
2. Refreshed outcome contains exactly the same 41 methodology-development identities — **PASS**.
3. Stock holdout, time holdout, and protected MediaTek `2454` remain sealed; materialized counts remain `0/0/0` — **PASS**.
4. Outcome contract remains continuous absolute return, TAIEX-relative return, MFE, and MAE at D+5/D+10/D+20/D+40 — **PASS**.
5. Session coverage advanced only from `20260831` to genuinely available `20260901`; unavailable horizons remain explicit null rather than zero — **PASS**.
6. Stock prices still use `scripts/lib/stock_price_provider.js:getDailyPrice`; TAIEX-relative returns still use same-session TWSE MI_INDEX `發行量加權股價指數` — **PASS**.
7. Same-industry-relative outcome remains omitted because PIT-safe effective-dated historical industry membership is unproven — **PASS**.
8. `binary_success_threshold` remains null and no binary label, optimized cutoff, composite score, weighting, catalyst/news layer, production model, or strategy was introduced — **PASS**.
9. Old/new outcome hashes, session coverage, and per-horizon maturity counts are recorded and internally consistent — **PASS**.
10. Fresh-runner tests/reproduction passed and generated refreshed bytes equal durable remote bytes `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e` — **PASS**.
11. Phase 4 association artifact was not rewritten/recomputed in the refresh; it remains historical evidence tied to old outcome bytes — **PASS**.
12. Compare `214d10ff77f3c2e6021313e957fb9a5dc084d50b...8acb153d5f588a1aca046eb500ff9e04ae1be0e9` is exactly one commit and exactly two modified files: the development outcome artifact and this canonical handoff. No Withdrawal methodology/validation file changed — **PASS**.

Freshness/concurrent-change audit:

- current remote main advanced beyond the refresh checkpoint due unrelated operational/data workflow commits;
- the observed current head during closeout was `2068657d1347fb622f29a02e8d0342a4ae9841cd`, a Fubon broker daily-data completion commit;
- task routing remains `institutional-accumulation` as the sole active project;
- no concurrent change identified here alters the frozen Phase 2 identity, refreshed outcome artifact, Phase 4 association artifact, routing state, or protected research assumptions.

No holdout opening is authorized by this PASS.

## Known limitations carried forward

- Refreshed maturity is D+5 `38/41`, D+10 `14/41`, D+20 `0/41`, D+40 `0/41`.
- D+10 still fails the fixed preregistered `MIN_N = 20` gate.
- Normalized HiStock broker history remains insufficient for mandatory use.
- Historical TDCC publication timing remains unsafe/unverified.
- Effective-dated historical industry membership remains unverified.
- Complete timestamped historical catalyst/news/analyst-revision evidence remains unverified.
- PIT-safe free-float/share-base normalization remains unaudited.
- Numerical binary repricing/success thresholds remain deliberately unfrozen.
- Stock holdout, time holdout, and protected `2454` remain sealed.

## Next round

Promoted round:

`institutional-accumulation-development-association-refresh-v1`

Purpose: re-run the already-frozen development-only continuous association analysis against refreshed outcome byte identity `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`, without modifying the Phase 2 sample, opening holdouts, changing feature definitions, changing the fixed `MIN_N = 20` gate, or introducing thresholds/weights/production logic.

This round may update descriptive development-only associations because D+5 maturity increased from 31 to 38. D+10 remains below minimum-n at 14 and must remain uninterpreted unless current refreshed bytes independently show otherwise under the unchanged gate.

### Exact entry points

- analyzer: `scripts/analyze_institutional_accumulation_development_associations.js`
- analyzer regression: `tests/institutional_accumulation_development_associations.test.js`
- analyzer workflow: `.github/workflows/analyze-institutional-accumulation-development-associations.yml`
- immutable freeze: `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`
- refreshed outcome input: `data_research/institutional-flow/institutional-accumulation-development-outcome-opening-v1.json`
- association artifact to refresh: `data_research/institutional-flow/institutional-accumulation-development-association-v1.json`
- preregistration: `data_research/institutional-flow/institutional-accumulation-preregistration-v1.md`
- PIT contract: `data_research/institutional-flow/institutional-accumulation-pit-contract-v1.md`
- canonical handoff: `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`

## Prompt A — Development-only association refresh

```text
Continue the Institutional Accumulation / Catalyst Pre-positioning research project only if round `institutional-accumulation-development-outcome-maturity-refresh-v1` has durable Prompt B PASS and has explicitly promoted `institutional-accumulation-development-association-refresh-v1`.

Before work, fetch current remote main; read AGENTS.md, `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, this canonical handoff, `data_research/institutional-flow/institutional-accumulation-preregistration-v1.md`, `data_research/institutional-flow/institutional-accumulation-pit-contract-v1.md`, immutable freeze `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`, refreshed outcomes `data_research/institutional-flow/institutional-accumulation-development-outcome-opening-v1.json`, analyzer `scripts/analyze_institutional_accumulation_development_associations.js`, regression `tests/institutional_accumulation_development_associations.test.js`, workflow `.github/workflows/analyze-institutional-accumulation-development-associations.yml`, and current association artifact `data_research/institutional-flow/institutional-accumulation-development-association-v1.json`.

Recover this exact Prompt A + Prompt B pair from durable history and verify it was preregistered after maturity-refresh Prompt B PASS and before this association refresh begins.

Implement only a bounded development-only association refresh:
- pin refreshed parent outcome byte SHA-256 exactly `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`;
- keep Phase 2 freeze semantic SHA-256 exactly `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`;
- analyze exactly the same 41 `methodology_development` identities and no others;
- preserve the same four frozen features: `core_accumulation_percentile`, `supply_absorption_percentile`, `price_return_percentile`, `price_non_confirmation_rank_gap`;
- preserve the same continuous outcomes only: `absolute_forward_return`, `taiex_relative_forward_return`, `mfe`, `mae` at D+5/D+10/D+20/D+40;
- preserve Spearman implementation/tie handling and fixed `MIN_N = 20` exactly; do not change methodology to make more pairs analyzable;
- pairwise missingness remains non-zero-filled; `n < 20` remains `insufficient_n`, rho null, interpretation forbidden;
- do not open or inspect stock-holdout, time-holdout, or protected `2454` outcomes;
- do not add binary labels, thresholds, optimized cutoffs, composite scores, weights, catalyst/news evidence, production logic, or same-industry outcomes;
- do not modify Withdrawal v6.0-v6.5 methodology/validation state.

Regenerate only the descriptive development association artifact against the refreshed outcome bytes. Record old association byte SHA-256, new association byte SHA-256, parent refreshed outcome byte SHA-256, per-horizon n/missingness, analyzable/insufficient pair counts, deterministic test evidence, workflow/run/job identity, durable artifact commit, and remote-byte verification in the canonical handoff.

Prompt A completion contract:
1. refreshed outcome parent byte identity is verified exactly;
2. immutable freeze and 41 development identities remain unchanged;
3. frozen feature/outcome definitions, Spearman semantics, and MIN_N remain unchanged;
4. no holdout/2454 outcome is opened;
5. refreshed association artifact is durably present on remote main;
6. regenerated bytes match durable remote bytes;
7. tests/guards pass;
8. handoff records Prompt A completion evidence while preserving this preregistered Prompt B.

When complete, report:
`Prompt A complete — ready for Prompt B`
and stop. Do not open holdouts or promote a production strategy.
```

## Prompt B — Development-only association refresh closeout

```text
Perform mandatory closeout for round `institutional-accumulation-development-association-refresh-v1` only after its Prompt A has completed.

Fetch current remote main; read AGENTS.md, this canonical handoff, the original preregistration, Phase 1 PIT contract, immutable Phase 2 freeze, refreshed development outcome artifact, `scripts/analyze_institutional_accumulation_development_associations.js`, `tests/institutional_accumulation_development_associations.test.js`, `.github/workflows/analyze-institutional-accumulation-development-associations.yml`, and the durable refreshed association artifact. Recover this exact preregistered Prompt B from durable pre-Prompt-A history.

Verify at minimum:
1. association parent outcome byte SHA-256 is exactly `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e` and Phase 2 freeze semantic SHA-256 remains exactly `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`;
2. analyzer uses exactly the same 41 methodology-development identities and excludes all holdout partitions and protected `2454`;
3. feature set is unchanged and contains only the four preregistered accumulation features;
4. outcome set remains only continuous absolute return, TAIEX-relative return, MFE, and MAE at D+5/D+10/D+20/D+40;
5. Spearman implementation/tie behavior is unchanged and deterministic regression guards pass;
6. `MIN_N` remains exactly `20`; pairs below 20 have null rho and forbidden interpretation; no sample-size-driven methodology relaxation occurred;
7. pairwise missingness remains non-zero-filled and n/missing counts are internally consistent;
8. no binary label, success threshold, optimized cutoff, composite score, weighting, catalyst/news layer, same-industry outcome, production model, or strategy was introduced;
9. old/new association hashes, parent refreshed outcome hash, per-horizon n/missingness, analyzable/insufficient counts, run/job/commit identity, and durable remote verification are recorded and internally consistent;
10. regenerated association bytes match durable remote bytes;
11. stock holdout, time holdout, and protected 2454 outcomes remain sealed and no Withdrawal v6.0-v6.5 methodology/validation file changed;
12. bounded changed-file/commit audit shows only the files necessary for this association refresh and canonical handoff checkpoint.

On PASS, update/commit this canonical handoff. Do not open untouched holdouts automatically. Any next evidence class or holdout-opening decision requires a separately preregistered paired round.

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
