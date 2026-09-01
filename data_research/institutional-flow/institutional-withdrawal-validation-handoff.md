# Institutional Withdrawal Research — Validation Phase Handoff

Canonical handoff: `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`

Checkpoint: 2026-09-01

## Current phase

**Prospective Batch 2+ expansion-protocol Prompt A is complete; its preregistered Prompt B closeout is pending.**

Do not start Batch 2 sample construction, TDCC/HiStock collection, normalization, outcome generation, tuning, or production promotion until the Prompt B below independently passes.

Current round identity:

`institutional-withdrawal-expansion-protocol-v1-preregistration`

Prompt A implementation commit:

`fee0622dbd8f5e12f0769215514adc7db47816af` — `research: preregister institutional withdrawal expansion protocol v1`

Canonical protocol:

`data_research/institutional-flow/institutional-withdrawal-expansion-protocol-v1.md`

Methodology identity:

`institutional-withdrawal-untouched-expansion-protocol-v1`

Status:

- Prompt A: **COMPLETE**
- Prompt B: **PENDING**
- future sample-construction Prompt A/B: **NOT YET PROMOTED**; they may be prepared only after current Prompt B passes.

---

## Objective

Validate frozen methodology `institutional-withdrawal-lifecycle-v1` on untouched stock holdouts without retuning v6.0-v6.5, while preserving strict separation between development evidence, prior untouched batches, future sample construction, and future outcomes.

Canonical Batch 1 preregistration:

`data_research/institutional-flow/validation-plan-v1.md`

Prospective Batch 2+ expansion protocol:

`data_research/institutional-flow/institutional-withdrawal-expansion-protocol-v1.md`

---

## Frozen methodology / leakage guardrails

Frozen development stocks:

`2330,2317,2454,2382,2303,2449`

Frozen development period:

`2026-04-01` through `2026-08-21`.

Frozen untouched Batch 1 stocks:

`1598,1616,1809,6257,7791`

Batch 1 sample-freeze commit:

`84cc5ea7585b94598e25262d35ae97557ad3ab53`

Batch 1 canonical outcome commit:

`9f2a5339346e2e2260b2d7802da9a68f3dfebb90`

Batch 1 Prompt B closeout workflow/run:

- `.github/workflows/verify-institutional-withdrawal-validation-closeout-v1.yml`
- run `33317813525` — PASS

Batch 1 outcome remains immutable:

- fragile lifecycle events: `0`;
- durable-failure events: `0`;
- resolved lifecycle events: `0`;
- `failure_plus_reclaim`: `0`;
- `failure_plus_no_reclaim`: `0`.

This is underpowered/unresolved evidence, not permission to retune or cherry-pick later stocks.

Frozen constraints:

- no v6.0-v6.5 threshold, weight, lifecycle, feature-semantic, validation-gate, development exclusion, or Broker completeness tuning from holdout outcomes;
- historical TDCC remains association-only and `production_no_lookahead_safe=false`;
- research calendar is source-derived from valid TWSE foreign-investor daily files;
- `data_history_sma/trading_days.json` is forbidden as the research calendar;
- missing OHLCV sessions remain gaps; no compression or imputation;
- development, stock-holdout, and time-holdout results remain separate;
- v6.1 future-outcome diagnosis is regression-only and forbidden as a holdout-classifier input.

---

## Prompt A result — prospective expansion protocol

Prompt A created and durably committed:

`data_research/institutional-flow/institutional-withdrawal-expansion-protocol-v1.md`

Methodology identity:

`institutional-withdrawal-untouched-expansion-protocol-v1`

The protocol prospectively freezes, before any Batch 2 identity is selected:

- candidate universe: 4-digit stocks observed in valid Foreign or OHLCV rows over `2026-04-01..2026-08-21`, after permanent exclusions;
- permanent exclusions: six development stocks, all five Batch 1 stocks, and every stock already frozen in any later untouched batch;
- deterministic order: ascending `sha256("institutional-withdrawal-validation-expansion-v1|" + stock)`, stock code tie-break;
- unchanged validation-plan v1 coverage gate: TDCC >=3, common Foreign/OHLCV sessions >=40, common ratio >=0.80, normalized Broker days >=40;
- strict Broker status semantics including `source_rows_incomplete` non-negative/unusable and degraded HTTP 200 + shrunken HTML + `table_rows=1` ambiguous/retryable;
- sequential future design: 10 stocks per batch;
- finite future cap: Batch 2 through Batch 5 only, at most 40 additional untouched stocks;
- sample-freeze boundary before any outcome generation;
- exact Batch 1 + later untouched stock-holdout pooling rule for the preregistered validation-plan v1 metrics, while preserving per-batch reporting and excluding time holdout from stock-holdout promotion statistics;
- zero-event/underpowered batches remain retained evidence and are never replaced ad hoc;
- stopping after a completed batch when cumulative untouched counts reach >=30 resolved durable failures, >=8 reclaim, and >=8 no-reclaim, or unconditionally after Batch 5;
- directional favorability does not control expansion; directional promotion criteria are evaluated only after a preregistered stopping condition is reached.

No Batch 2 stock identities were selected or frozen in Prompt A. No new TDCC/HiStock collection or normalization was run. No Batch 2 return, drawdown, lifecycle, repair, or validation outcome was generated or inspected.

### Mechanical implementation audit

Known entry points:

- `scripts/plan_institutional_withdrawal_validation_coverage.js`
- `scripts/plan_institutional_withdrawal_validation_expansion_v1.js`
- `scripts/plan_institutional_withdrawal_validation_broker_batches_v1.js`
- `scripts/audit_histock_broker_source_empty_checkpoints.js`
- `scripts/test_histock_broker_status_policy_regressions.js`
- `.github/workflows/expand-institutional-withdrawal-validation-coverage-v1-recovery.yml`
- `.github/workflows/validate-institutional-withdrawal-recovery-contract-v1.yml`

Verified audit finding:

`scripts/plan_institutional_withdrawal_validation_expansion_v1.js` already implements the fixed SHA-256 seed ordering and source-derived coverage mechanics, but currently excludes only development stocks and labels the ordering as network-request scheduling only. It does not yet encode prior-holdout exclusions, protocol identity, or deterministic next-10 sample selection.

Required bounded change before any Batch 2 freeze:

- make the future sample planner encode/read `institutional-withdrawal-untouched-expansion-protocol-v1`;
- permanently exclude development + all prior holdout identities;
- use the frozen SHA-256 order as sample order;
- select at most the next 10 eligible stocks without outcome inputs;
- emit durable evidence proving no earlier ordered candidate was improperly skipped.

This gap was documented only. Prompt A did not execute the planner to reveal Batch 2 identities.

---

## Exact implementation / verification entry points

### Frozen lifecycle chain

- `scripts/analyze_institutional_withdrawal_v6_distribution_absorption.js` — frozen `classify(row)` structure classifier
- `scripts/analyze_institutional_withdrawal_v6_1_events.js` — development-only diagnosis/regression anchor
- `scripts/analyze_institutional_withdrawal_v6_2_failure_transition.js` — frozen immediate failure transition
- `scripts/analyze_institutional_withdrawal_v6_3_delayed_failure.js` — frozen sessions 11-20 delayed failure
- `scripts/analyze_institutional_withdrawal_v6_4_durable_failure.js` — frozen 3-session durability confirmation
- `scripts/analyze_institutional_withdrawal_v6_5_recovery_reclaim.js` — frozen sessions 4-15 recovery/reclaim

Frozen specs:

- `data_research/institutional-flow/v6-distribution-absorption-spec.md`
- `data_research/institutional-flow/v6-2-failure-transition-spec.md`
- `data_research/institutional-flow/v6-3-delayed-failure-spec.md`
- `data_research/institutional-flow/v6-4-durable-failure-spec.md`
- `data_research/institutional-flow/v6-5-recovery-reclaim-spec.md`

Durable development anchors:

- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-distribution-absorption.json`
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-1-event-diagnosis.json`
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-2-failure-transition.json`
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-3-delayed-failure.json`
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-4-durable-failure.json`
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-5-recovery-reclaim.json`

Untouched Batch 1 validation:

- `scripts/build_institutional_withdrawal_validation_matrix_v1.js`
- `scripts/build_institutional_withdrawal_validation_fragile_bridge_v1.js`
- `scripts/compute_institutional_withdrawal_validation_outcomes_v1.js`
- `scripts/test_institutional_withdrawal_validation_v1.js`
- `.github/workflows/research-institutional-withdrawal-validation-v1.yml`
- `.github/workflows/verify-institutional-withdrawal-validation-closeout-v1.yml`
- `data_research/institutional-flow/validation/validation-outcomes-v1.json`
- `data_research/institutional-flow/validation/validation-metrics-v1.json`

Future outcome-blind coverage/sample construction entry points:

- `data_research/institutional-flow/institutional-withdrawal-expansion-protocol-v1.md`
- `scripts/plan_institutional_withdrawal_validation_coverage.js`
- `scripts/plan_institutional_withdrawal_validation_expansion_v1.js`
- `scripts/plan_institutional_withdrawal_validation_broker_batches_v1.js`
- `scripts/audit_histock_broker_source_empty_checkpoints.js`
- `.github/workflows/expand-institutional-withdrawal-validation-coverage-v1-recovery.yml`

If later coverage collection is authorized, preserve:

`plan -> freeze bounded queue -> explicit batch_size -> fresh runner -> jitter -> cooldown -> checkpoint -> runner exits -> next batch -> re-plan`

with `cancel-in-progress:false`, matrix `fail-fast:false`, `max-parallel:1`, one TDCC stock per runner, Broker <=5 exact-source-date requests per runner, latest-main checkout, durable checkpoint before runner exit, and no blind `git pull --rebase`.

---

## Current round completion contract

Prompt A completion evidence:

- protocol path exists on remote `main`;
- methodology identity is stable;
- universe/order/batch/cap/pooling/stopping/sample-freeze rules are explicit;
- no Batch 2 identities/outcomes were opened;
- implementation gap is documented without candidate-specific execution;
- implementation commit: `fee0622dbd8f5e12f0769215514adc7db47816af`.

Current round must now stop for its preregistered Prompt B.

---

## Prompt B — Prospective expansion-protocol closeout / verification

```text
The prospective Batch 2+ expansion-protocol preregistration round has finished.

Do not start Batch 2 coverage/sample construction, collection, outcome validation, tuning, or production promotion yet.

Perform the mandatory phase-closeout review according to the latest `AGENTS.md`, `validation-plan-v1.md`, and canonical handoff.

Before reviewing any future candidate stock outcome:

1. Re-read `AGENTS.md`.
2. Re-read `docs/project-philosophy.md`.
3. Re-read `docs/roadmap/current-phase.md`.
4. Re-read `data_research/institutional-flow/validation-plan-v1.md`.
5. Re-read `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`.
6. Read the exact prospective expansion protocol created by Prompt A.
7. Verify current `main` and identify every Prompt A commit/workflow run.

First verify phase separation:

- Batch 1 remains immutable as exactly `1598,1616,1809,6257,7791`;
- development methodology v6.0-v6.5 remains unchanged;
- no Batch 2 stock identities were selected/frozen/finalized;
- no new Batch 2 TDCC/HiStock collection or normalization was performed;
- no Batch 2 future return, drawdown, lifecycle outcome, structural-repair outcome, or validation metric was generated or inspected;
- no existing Batch 1 outcome/metrics file was used to rank or choose specific future stocks;
- no production strategy was tuned or promoted.

Then independently review the prospective expansion protocol. It must precommit, before future candidate selection:

- eligible candidate-universe definition;
- permanent development/prior-holdout exclusions;
- deterministic ordering / selection rule;
- calendar/date policy;
- strict coverage gates and Broker semantics;
- one-shot vs sequential design;
- if sequential, deterministic batch size;
- finite maximum-batch or equivalent stopping bound;
- event-count accumulation rule;
- explicit pooling/separation rule for Batch 1 versus later untouched batches;
- stopping rule independent of whether an individual batch looks favorable;
- treatment of zero-event/underpowered batches;
- exact sample-freeze boundary before outcome generation.

Challenge the protocol specifically for post-outcome adaptivity. A rule is not acceptable if it effectively means "keep adding stocks until results look useful", "pick stocks likely to trigger the classifier", "expand because Batch 1 had zero events" without a precommitted bounded rule, or any equivalent discretionary outcome-responsive sampling.

Verify the protocol can be implemented mechanically with known entry points, or records exact bounded implementation gaps before future sample construction. Do not execute the future sample-selection planner merely to see which stocks would be chosen.

If any required prospective rule is missing, discretionary, outcome-responsive, or internally inconsistent:

- DO NOT close the phase;
- fix only the protocol while candidate identities/outcomes remain unopened;
- repeat Prompt B verification.

Only after this protocol closeout passes:

1. update `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md` with exact protocol path, methodology identity, commit/run evidence, restrictions, and mechanically authorized next sample-construction objective;
2. prepare Prompt A(N+1) for outcome-blind sample construction under that frozen protocol and a phase-specific Prompt B(N+1) for its sample-freeze closeout;
3. commit the handoff to `main`;
4. re-fetch current `main` and verify no later workflow/data commit made the handoff stale;
5. respond with the closeout summary, final handoff commit SHA, protocol identity, and both following prompts.

Do not construct Batch 2 or open its outcomes in this closeout round.
```

---

## Known caveats retained

- Historical TDCC remains association-only, not exact historical publication-time no-lookahead evidence.
- HiStock response-byte baselines are stock/page dependent; absolute bytes alone do not classify degradation.
- `source_rows_incomplete` means unusable exact-date Broker coverage, not no Broker activity.
- Batch 1 is permanently frozen and returned zero fragile events; this is underpowered evidence, not a reason to modify Batch 1.
- Promotion still requires the preregistered minimum event counts and directional evidence.
- v6.1 remains regression-only for holdout work.
- Batch 2+ cannot be constructed until the current preregistered Prompt B passes.
