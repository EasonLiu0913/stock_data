# Institutional Withdrawal Research — Validation Phase Handoff

Canonical handoff: `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`

Phase-closeout checkpoint: 2026-08-30

## Current phase

**Untouched stock-holdout Batch 1 outcome-validation closeout PASSED, but the preregistered validation is underpowered/unresolved because the frozen classifier produced zero fragile lifecycle events in Batch 1.**

The frozen Batch 1 result is evidence and must not be altered, expanded, or reused for post-hoc tuning. No production-promotion gate is met. No v6.0-v6.5 threshold, weight, lifecycle definition, validation gate, feature semantic, development-stock exclusion, or Broker completeness rule may be retuned from this result.

**Further untouched stock-holdout expansion is not yet authorized.** Because Batch 1 outcomes are now known, any Batch 2+ expansion rule must first be prospectively preregistered before new candidate identities are selected, coverage results are used to form a new sample, or any new holdout outcome is generated. The next authorized phase is protocol design/preregistration only.

---

## Canonical validation phase flow

This diagram is the authoritative phase-order summary for untouched Institutional Withdrawal validation. Detailed rules below still control when they are stricter.

```text
Frozen development methodology v6.0-v6.5
        ↓
Outcome-blind coverage / sample construction
        ↓
Prompt B sample-freeze closeout
        ↓
Exact untouched sample becomes immutable
        ↓
Prompt A untouched outcome-validation implementation
        │
        ├─ intermediate pre-outcome / regression gates PASS
        │      ≠ Prompt A complete
        │      ↓ continue
        │
        └─ lifecycle + preregistered outcomes / metrics
               ↓
          canonical artifacts generated
               ↓
          committed + pushed
               ↓
          remote main paths + identity verified
               ↓
          "Prompt A complete — ready for Prompt B"
               ↓
Prompt B independent outcome closeout
        ↓
Untouched batch permanently closed
        ↓
Production-promotion gate evaluated
        ├─ met
        │    ↓
        │  separate production-review / promotion phase
        │
        └─ not met / underpowered / zero-event
             ↓
        DO NOT directly add another batch
             ↓
Prompt A prospective Batch 2+ expansion-protocol preregistration
        ↓
Prompt B protocol closeout
        ↓
Sampling / ordering / batching / stopping / pooling rules frozen
        ↓
Prompt A outcome-blind future sample construction
        ↓
Prompt B future sample-freeze closeout
        ↓
Exact future batch sample becomes immutable
        ↓
Prompt A untouched outcome validation for that frozen batch
        ↓
Prompt B independent outcome closeout
        ↓
Apply the preregistered finite stopping / accumulation rule
```

Two repository-wide acceptance rules apply at every applicable step:

```text
Intermediate gate PASS
≠ Prompt A completion
```

and

```text
Writer workflow green
≠ durable completion

required durable evidence:
generate → bounded write set → commit → push → fetch remote main → verify expected path/blob/identity
```

Once an untouched batch's outcomes are opened, that batch may never be expanded, reduced, substituted, or used to choose specific later stocks. Any later expansion must follow a prospective protocol frozen before those later candidate identities/outcomes are opened.

---

## Objective

Validate frozen methodology `institutional-withdrawal-lifecycle-v1` on untouched stock holdouts without retuning v6.0-v6.5 and without mixing development observations into untouched statistics.

Canonical Batch 1 preregistration:

`data_research/institutional-flow/validation-plan-v1.md`

---

## Frozen methodology / leakage guardrails

Treat v6.0 through v6.5 as frozen development research.

Development stocks:

`2330,2317,2454,2382,2303,2449`

Development period:

`2026-04-01` through `2026-08-21`.

Do not retune thresholds, weights, lifecycle definitions, validation gates, feature semantics, or development-stock exclusions from validation evidence.

Research calendar remains source-derived from valid TWSE foreign-investor daily files. Never use `data_history_sma/trading_days.json` as the research calendar.

Historical TDCC remains association-only because exact historical publication-time availability is incomplete; retain `production_no_lookahead_safe=false` semantics for historical TDCC evidence.

Missing OHLCV sessions remain real source gaps. Do not compress sessions or impute missing OHLCV. The documented development gap `2026-06-24` remains a regression anchor.

Stock-holdout, development, and any later time-holdout results must remain separate.

---

## Frozen Batch 1 sample identity — IMMUTABLE

Frozen stock-holdout Batch 1 is exactly:

`1598,1616,1809,6257,7791`

Sample-freeze commit:

`84cc5ea7585b94598e25262d35ae97557ad3ab53` — `docs: checkpoint institutional withdrawal sample freeze`

Freeze basis:

- anchor range: `2026-04-01` through `2026-08-21`;
- source-derived calendar sessions at sample freeze: `98`;
- all five stocks were returned by `stock_holdout_ready`;
- `stock_holdout_needs_broker_normalization=[]`;
- `time_holdout_ready=[]`;
- Section 9 of `validation-plan-v1.md` required freezing all returned ready stocks;
- remaining TDCC/Broker queues were explicitly not permission to add stocks after the gate.

Durable outcome-blind evidence commit:

`f92b362ac57e1e6248d1ecd35b9c729690266b29` — `research: refresh outcome-blind validation coverage preflight`

Durable evidence blobs at the freeze boundary:

- `histock-source-empty-audit-v1.json`: `bfc57294e5a8e027a6786482fd0c4fa8f7fbedb0`;
- `coverage-expansion-v1.json`: `e99ff566dd9ef9afed7248529b8d19c5760dbf6f`;
- `validation-coverage-v1.json`: `a19d0a5c3a2c3acb7b46079a2fbf926e06ef76d5`.

After outcomes were opened, no stock was added, removed, substituted, or selectively excluded. Batch 1 is permanently closed as these five stocks.

---

## Untouched outcome-validation implementation — Prompt A

Prompt A implemented the minimum preregistered stock-holdout pipeline without modifying the frozen v6.0-v6.5 analyzers/specs.

Implementation commits:

- `87104f601251f35f908b4d4cecac80107e342272` — `research: add untouched withdrawal validation matrix`;
- `452a4934135a1ad27f392717d8886cb70e6005e0` — `research: add outcome-free fragile bridge`;
- `11c62316cd31146cb2bf47c492a476712f97ee1f` — `research: add untouched withdrawal outcome metrics`;
- `2ea62ed8e50430f05b7aed48b3b89bc37719d3fc` — `test: cover untouched withdrawal validation contract`;
- `f66805eca4876b8d7302bf3773aaf91e3016a8d4` — `ci: add untouched withdrawal validation workflow`;
- `33c7cceb07eb9f41a8f175d067228303f3f22f5d` — `research: request untouched withdrawal validation v1`;
- `96a12c81582695c0815023bc41959b978a973486` — `fix: allow bounded checkpoints outside sparse checkout`;
- `c088282d00d02c185110ebe1d9e32c634ea0096a` — `research: rerun untouched withdrawal validation v1`;
- `9f2a5339346e2e2260b2d7802da9a68f3dfebb90` — `research: record untouched institutional withdrawal validation v1`.

An unrelated automatic market-news commit occurred before the validation implementation commits and is not research evidence:

- `729c36ea333deea328c74376c0299d769c58287d` — `chore: update market news 2026-08-30 21:20:20`.

Prompt A Actions runs:

- `33316613293` — validation Run #1. All analysis/test steps were green, but the final bounded checkpoint was a **green-but-no-artifact plumbing failure** because sparse checkout prevented staging newly generated canonical output paths. The log ended with `No bounded checkpoint changes to commit.` No canonical validation result was committed by this run.
- `33316749621` — validation Run #2 after bounded sparse-checkout checkpoint fix. **Success.** It fresh-replayed frozen development regressions, rebuilt the five-stock outcome-free matrix, ran the untouched lifecycle, computed preregistered metrics, validated canonical contracts, and actually committed the two canonical artifacts as `9f2a5339346e2e2260b2d7802da9a68f3dfebb90`.

The checkpoint fix changed only bounded Git staging mechanics (`git add --sparse` for explicitly supplied paths); it did not change classifier methodology, sample membership, Broker semantics, or outcome definitions.

This incident is now generalized in `AGENTS.md`: a green writer workflow is not durable completion unless required remote `main` artifacts and their contract identity are verified.

---

## Prompt B independent closeout verification — PASSED

Prompt B added a dedicated read-only closeout harness so verification did not rewrite the canonical validation result:

- `44b7564b83f72a071239f9f90e0008db3f6ff34d` — `test: add untouched withdrawal closeout verifier`;
- `3439734a919270f3a3d7c402461a60f353974d9a` — `test: request untouched withdrawal closeout verification`.

Closeout workflow/run:

- `.github/workflows/verify-institutional-withdrawal-validation-closeout-v1.yml`;
- Actions run `33317813525` — **success**;
- token permission during verification: `contents: read`;
- generated verification outputs were `/tmp` only; canonical outcomes/metrics were not regenerated or committed.

### Frozen-rule / anti-leakage commit audit

Compare boundary:

`84cc5ea7585b94598e25262d35ae97557ad3ab53` → `9f2a5339346e2e2260b2d7802da9a68f3dfebb90`

Changed-file audit found no changes to:

- `scripts/analyze_institutional_withdrawal_v6_distribution_absorption.js`;
- `scripts/analyze_institutional_withdrawal_v6_1_events.js`;
- `scripts/analyze_institutional_withdrawal_v6_2_failure_transition.js`;
- `scripts/analyze_institutional_withdrawal_v6_3_delayed_failure.js`;
- `scripts/analyze_institutional_withdrawal_v6_4_durable_failure.js`;
- `scripts/analyze_institutional_withdrawal_v6_5_recovery_reclaim.js`;
- frozen v6 specs;
- `data_research/institutional-flow/validation-plan-v1.md`;
- Broker status-policy regression contract.

Therefore no frozen threshold, weight, lifecycle definition, validation gate, feature semantic, development-stock exclusion, or Broker completeness rule changed after sample freeze.

### Fresh development regression replay

Closeout run `33317813525` freshly replayed the frozen chain and confirmed:

- v6.1 fragile events: exactly `10`;
- v6.4 durable candidates: exactly `5`;
- persistence window: `3` sessions;
- `required_broken_votes=2`;
- `required_supply_votes=1`;
- `2317 / 2026-06-18` → candidate failure `2026-06-26`;
- `2454 / 2026-06-12` → candidate failure `2026-07-08`;
- `2382 / 2026-06-18` → candidate failure `2026-07-17`;
- `2449 / 2026-05-22` → candidate failure `2026-06-08` → confirmed reclaim `2026-06-22`;
- `2449 / 2026-06-18` → candidate failure `2026-07-14` → no reclaim;
- development `2026-06-24` remains a `missing_price=true` gap and was not compressed or imputed.

### Broker semantics regression

Closeout run `33317813525` reran `scripts/test_histock_broker_status_policy_regressions.js` and passed.

Protected positive:

`1598 / 2026-05-07`

- `凱基-汐止`: net `-74`, avg `20.49`;
- `兆豐-大同`: net `+206`, avg `20.76`.

The legacy ~69.9 KB HTTP 200 / `table_rows=1` degraded response remains ambiguous/retryable and is not negative evidence.

Protected `7791` incomplete-source dates remain `source_rows_incomplete`, non-negative, coverage-unusable, with no zero imputation:

- `2026-04-07`;
- `2026-04-28`;
- `2026-04-30`;
- `2026-05-13`;
- `2026-05-22`.

### Independent untouched classification rebuild

The closeout verifier independently rebuilt the exact Prompt A horizon through `2026-08-27` using the frozen five stocks and source-derived calendar.

Fresh counts:

- source-derived sessions: `102`;
- TDCC anchors: `105`;
- Broker available anchors: `52`;
- feature-complete anchors: `52`;
- analysis-eligible anchors: `17`;
- freshly classified `fragile_distribution`: **`0`**.

Per-stock analysis-eligible rows:

- `1598`: `6`;
- `1616`: `3`;
- `1809`: `3`;
- `6257`: `3`;
- `7791`: `2`.

The fresh result was `17` eligible rows, all classified `other`. Therefore the canonical zero-event result is reproducible and is not caused by post-hoc event exclusion.

Observed source OHLCV gaps during the independent holdout rebuild remained real gaps:

- `1598 / 2026-06-24`;
- `1809 / 2026-06-24`;
- `6257 / 2026-06-24`.

They were not skipped or imputed to complete a horizon.

---

## Canonical Batch 1 validation artifacts

Canonical paths:

- `data_research/institutional-flow/validation/validation-outcomes-v1.json`;
- `data_research/institutional-flow/validation/validation-metrics-v1.json`.

Artifact identity:

- lifecycle methodology: `institutional-withdrawal-lifecycle-v1`;
- frozen development methodology: `v6.0-v6.5`;
- sample kind: `untouched_stock_holdout`;
- batch: `batch-1`;
- stocks: `1598,1616,1809,6257,7791`;
- anchor range: `2026-04-01` through `2026-08-21`;
- source-derived outcome data through: `2026-08-27`;
- historical TDCC caveat remains explicit;
- `production_no_lookahead_safe=false`.

Canonical counts:

- durable-failure events: `0`;
- resolved lifecycle events: `0`;
- `failure_plus_reclaim`: `0`;
- `failure_plus_no_reclaim`: `0`;
- unresolved recovery follow-up: `0`.

`validation-outcomes-v1.json` contains `events=[]`.

Because no lifecycle event resolved, there are no early/middle/late resolved event rows to spot-check. Prompt B instead independently rebuilt **all 105 anchors / all 17 eligible classifier rows** and confirmed that none became fragile under the unchanged classifier.

### Outcome-clock / metric contract

`scripts/test_institutional_withdrawal_validation_v1.js` passed both Prompt A and Prompt B and protects the preregistered contract that:

- resolution-date logic is lifecycle-state specific;
- outcomes begin on the next exact source-derived session after resolution;
- 20D/30D returns use exact source-derived horizons;
- 20D/30D maximum drawdowns use the preregistered windows;
- a missing OHLCV row invalidates only the dependent metric instead of being skipped/imputed;
- incomplete follow-up is `unresolved_for_metric` for the affected denominator;
- structural repair is post-resolution descriptive evidence only;
- group metrics remain separated by `failure_plus_reclaim` / `failure_plus_no_reclaim`;
- bootstrap CIs are emitted only when both groups meet the meaningful-resampling gate.

With zero resolved events, all metric Ns are `0`, numerical summaries are `null`, and every between-group bootstrap CI is correctly `not_emitted` rather than fabricated from empty groups.

---

## Preregistered Batch 1 validation conclusion

Minimum production-promotion count gate from `validation-plan-v1.md`:

- required resolved durable failures: `>=30`; observed `0`;
- required reclaim: `>=8`; observed `0`;
- required no-reclaim: `>=8`; observed `0`;
- count gate: **NOT MET**.

Directional criteria cannot be evaluated with zero events and are therefore **underpowered/unresolved**, not passed and not failed:

1. lower mean 20D return for no-reclaim: **underpowered/unresolved**;
2. lower mean 30D return for no-reclaim: **underpowered/unresolved**;
3. lower median 20D return for no-reclaim: **underpowered/unresolved**;
4. lower median 30D return for no-reclaim: **underpowered/unresolved**;
5. deeper mean max drawdown 20D for no-reclaim: **underpowered/unresolved**;
6. deeper mean max drawdown 30D for no-reclaim: **underpowered/unresolved**;
7. higher negative-return rate 20D for no-reclaim: **underpowered/unresolved**;
8. higher negative-return rate 30D for no-reclaim: **underpowered/unresolved**;
9. lower 30D structural-repair rate for no-reclaim: **underpowered/unresolved**.

This result must be retained as evidence. It is **not** permission to add stocks to Batch 1, drop quiet stocks, lower classifier thresholds, relax Broker completeness, tune v6.0-v6.5, or promote a production strategy.

---

## Exact implementation / verification entry points

Do not rediscover these paths in future rounds.

### Frozen lifecycle chain

- `scripts/analyze_institutional_withdrawal_v6_distribution_absorption.js` — canonical frozen `classify(row)` structure classifier;
- `scripts/analyze_institutional_withdrawal_v6_1_events.js` — development-only diagnosis/regression anchor; future-outcome labels are forbidden as holdout classifier inputs;
- `scripts/analyze_institutional_withdrawal_v6_2_failure_transition.js` — frozen immediate failure transition;
- `scripts/analyze_institutional_withdrawal_v6_3_delayed_failure.js` — frozen sessions 11–20 delayed failure;
- `scripts/analyze_institutional_withdrawal_v6_4_durable_failure.js` — frozen 3-session durability confirmation;
- `scripts/analyze_institutional_withdrawal_v6_5_recovery_reclaim.js` — frozen sessions 4–15 recovery/reclaim.

Frozen specs:

- `data_research/institutional-flow/v6-distribution-absorption-spec.md`;
- `data_research/institutional-flow/v6-2-failure-transition-spec.md`;
- `data_research/institutional-flow/v6-3-delayed-failure-spec.md`;
- `data_research/institutional-flow/v6-4-durable-failure-spec.md`;
- `data_research/institutional-flow/v6-5-recovery-reclaim-spec.md`.

Durable development anchors:

- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-distribution-absorption.json`;
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-1-event-diagnosis.json`;
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-2-failure-transition.json`;
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-3-delayed-failure.json`;
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-4-durable-failure.json`;
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-5-recovery-reclaim.json`.

Historical development workflow assertions:

- `.github/workflows/research-institutional-withdrawal-v6-1-event-diagnosis.yml`;
- `.github/workflows/research-institutional-withdrawal-v6-2-failure-transition.yml`;
- `.github/workflows/research-institutional-withdrawal-v6-3-delayed-failure.yml`;
- `.github/workflows/research-institutional-withdrawal-v6-4-durable-failure.yml`;
- `.github/workflows/research-institutional-withdrawal-v6-5-recovery-reclaim.yml`.

### Untouched validation implementation

- `scripts/build_institutional_withdrawal_validation_matrix_v1.js` — hard-locks Batch 1 identity and builds outcome-free contemporaneous matrix;
- `scripts/build_institutional_withdrawal_validation_fragile_bridge_v1.js` — outcome-free bridge into unchanged v6.2+ lifecycle executables;
- `scripts/compute_institutional_withdrawal_validation_outcomes_v1.js` — preregistered resolution/outcome clock, 20D/30D metrics, structural-repair outcome and bootstrap policy;
- `scripts/test_institutional_withdrawal_validation_v1.js` — outcome-clock/metric/missing-session contract tests;
- `.github/workflows/research-institutional-withdrawal-validation-v1.yml` — bounded Prompt A validation workflow;
- `.github/workflows/verify-institutional-withdrawal-validation-closeout-v1.yml` — read-only Prompt B closeout verifier;
- `data_research/institutional-flow/validation/validation-outcomes-v1.json` — frozen Batch 1 outcome artifact;
- `data_research/institutional-flow/validation/validation-metrics-v1.json` — frozen Batch 1 aggregate metrics artifact.

### Coverage / Broker entry points for a future outcome-blind batch

These paths are known, but they are **not authorized to select a Batch 2 sample until a prospective expansion protocol has first been preregistered and closed**:

- `scripts/audit_histock_broker_source_empty_checkpoints.js`;
- `scripts/plan_institutional_withdrawal_validation_expansion_v1.js`;
- `scripts/plan_institutional_withdrawal_validation_broker_batches_v1.js`;
- `scripts/plan_institutional_withdrawal_validation_coverage.js`;
- `scripts/test_histock_broker_status_policy_regressions.js`;
- `.github/workflows/expand-institutional-withdrawal-validation-coverage-v1-recovery.yml`;
- `.github/workflows/validate-institutional-withdrawal-recovery-contract-v1.yml`.

If later coverage collection becomes prospectively authorized, preserve the existing physical-batch architecture:

`plan → freeze bounded queue → explicit batch_size → fresh runner → jitter → cooldown → checkpoint → runner exits → next batch → re-plan`

with `cancel-in-progress:false`, matrix `fail-fast:false`, `max-parallel:1`, one TDCC stock per runner, Broker <=5 exact-source-date requests per runner, latest-main checkout, durable checkpoint before runner exit, and no blind `git pull --rebase`.

---

## Next evidence-driven objective

**Do not start automatically. Begin only when the repository owner explicitly sends Prompt A below or otherwise explicitly asks to continue.**

Batch 1 is closed and cannot be expanded. Because its outcome result is now known, a Batch 2 sample must **not** be constructed simply because Batch 1 was underpowered or produced zero fragile events.

The next scientifically valid step is a **prospective Batch 2+ expansion-protocol preregistration round only**. Before any new candidate identities are selected or any new coverage snapshot is used to freeze a sample, that protocol must predefine the sequential sampling design independently of new holdout outcomes.

The protocol must prospectively specify at least:

- the eligible candidate universe and permanent exclusions;
- deterministic candidate ordering / selection mechanism;
- whether sample construction is one-shot or sequential;
- batch-size rule, if batches are used;
- maximum number of future batches or another finite stopping bound;
- event-count accumulation policy across batches;
- whether and under what rule Batch 1 and later untouched batches may be pooled for descriptive/validation statistics;
- the exact stopping rule for further untouched expansion;
- how a zero-event or underpowered batch is recorded without triggering ad-hoc stock selection;
- the separation between sample-construction evidence and outcome evidence;
- the rule that no already-observed Batch 1 result may be used to rank or cherry-pick specific future stocks.

**This next round must not run the coverage planner to form Batch 2, must not perform Batch 2 collection/normalization, must not freeze Batch 2 identities, and must not generate or inspect Batch 2 outcomes.** Its only research deliverable is the prospective expansion protocol plus any outcome-blind implementation audit needed to prove the protocol can later be executed mechanically.

---

## Prompt A — Prospective Batch 2+ expansion-protocol preregistration

```text
Continue the Institutional Withdrawal Validation work in repository `EasonLiu0913/stock_data`.

This round is protocol-design/preregistration only. Batch 1 outcomes are already known, so further untouched sample expansion is NOT automatically authorized merely because Batch 1 was underpowered or produced zero fragile events.

Before doing any work:

1. Read `AGENTS.md`.
2. Read `docs/project-philosophy.md`.
3. Read `docs/roadmap/current-phase.md`.
4. Read `data_research/institutional-flow/validation-plan-v1.md`.
5. Read the latest canonical handoff at `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`.
6. Verify current `main` and the complete Batch 1 closeout evidence recorded there.
7. Preserve frozen methodology `institutional-withdrawal-lifecycle-v1` / v6.0-v6.5 unchanged.

Permanent known exclusions from any future untouched stock batch are at least:

- development stocks: `2330,2317,2454,2382,2303,2449`;
- frozen Batch 1 stocks: `1598,1616,1809,6257,7791`.

Do NOT use the Batch 1 result (zero fragile events / zero durable failures) to rank, cherry-pick, prioritize, or manually choose specific future stocks.

Create a new prospective Batch 2+ expansion protocol under `data_research/institutional-flow/` before any new candidate sample is selected. Give it a stable canonical repo-relative path and methodology/version identity. The protocol must freeze, prospectively and without new holdout outcomes:

- the future eligible candidate universe definition;
- permanent development + prior-holdout exclusions;
- deterministic ordering / selection mechanism;
- anchor-range/date policy and source-derived calendar policy;
- coverage-quality requirements, including strict Broker semantics;
- whether future validation is one-shot or sequential;
- if sequential, the deterministic batch-size rule;
- the maximum number of future batches or another finite precommitted stopping bound;
- event-count accumulation policy across batches;
- whether Batch 1 and later untouched batches may be pooled, and if so exactly for which preregistered metrics and under what fixed rule;
- a stopping rule that does not depend on whether an individual stock/batch looks favorable;
- treatment of zero-event and underpowered batches as retained evidence rather than a reason for ad-hoc expansion;
- the exact phase boundary between outcome-blind sample construction and outcome generation;
- the rule that future sample identities are frozen before their future outcomes are generated or inspected.

Audit the known existing coverage/planner entry points only enough to determine whether the prospective protocol can later be implemented mechanically:

- `scripts/plan_institutional_withdrawal_validation_coverage.js`;
- `scripts/plan_institutional_withdrawal_validation_expansion_v1.js`;
- `scripts/plan_institutional_withdrawal_validation_broker_batches_v1.js`;
- `scripts/audit_histock_broker_source_empty_checkpoints.js`;
- `.github/workflows/expand-institutional-withdrawal-validation-coverage-v1-recovery.yml`.

Do not execute those planners in a way that selects/finalizes Batch 2 identities in this round. Do not perform new TDCC/HiStock collection or normalization. If an implementation gap is found, document the exact future bounded change needed; do not use candidate-specific results to design around the known Batch 1 outcome.

Preserve strict Broker semantics and existing regressions:

- `source_rows_incomplete` is non-negative and coverage-unusable;
- never zero-impute incomplete Broker rows;
- preserve `1598 / 2026-05-07` and the five protected `7791` source-status regressions;
- degraded HTTP 200 / shrunken HTML / `table_rows=1` remains ambiguous/retryable rather than terminal negative evidence.

Do not use `data_history_sma/trading_days.json` as the research calendar.

Forbidden in this Prompt A:

- selecting or freezing Batch 2 stock identities;
- running new coverage collection/normalization for Batch 2;
- generating or inspecting Batch 2 future returns, drawdowns, lifecycle outcomes, structural-repair outcomes, or validation metrics;
- modifying Batch 1 artifacts;
- tuning v6.0-v6.5;
- production promotion.

Intermediate analysis or audit findings are not Prompt A completion. Continue until the prospective expansion protocol itself is durably committed and its exact path/methodology identity is verified on remote `main`.

Prompt A completion contract:

- prospective expansion protocol exists on remote `main` at an exact documented path;
- protocol has stable methodology/version identity;
- all required sampling/batch/stopping/pooling rules above are explicit rather than left to future discretion;
- no Batch 2 identities or outcomes were opened;
- current `main` is re-fetched and the protocol blob is verified;
- final response explicitly says `Prompt A complete — ready for Prompt B` and lists the commit/path/identity.

After this one bounded protocol-preregistration round finishes, stop and wait for Prompt B. Do not begin Batch 2 sample construction in the same round.
```

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
- Batch 1 is permanently frozen and returned zero fragile events; this is an underpowered validation result, not a reason to modify Batch 1.
- Promotion still requires the preregistered minimum event counts and directional evidence; zero events provide neither.
- v6.1 contains development future-outcome diagnosis and remains regression-only for holdout work.
- Any future Batch 2+ expansion requires a prospectively frozen sampling/batching/stopping protocol before candidate identities are selected or outcomes are opened.