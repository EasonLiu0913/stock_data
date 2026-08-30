# Institutional Withdrawal Research — Validation Phase Handoff

Canonical handoff: `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`

## Purpose

This document is the authoritative handoff for continuing the Institutional Withdrawal research in `EasonLiu0913/stock_data`.

The research objective is to infer, from public market/chip data, whether large long-term holders may be persistently reducing exposure, whether the market is still absorbing that supply, and when that absorption fails or later repairs.

The research is **not** a simple next-day price prediction model. The working lifecycle is:

`persistent ownership transfer → fragile distribution → candidate failure → short durability → recovery/reclaim`

The next phase is **Validation Phase**, not another in-sample threshold-tuning version such as v6.6.

---

## Critical instruction for the next agent

First read repository root `AGENTS.md`, then read this canonical handoff.

This handoff is a fast path into the current state, not a restriction on investigation. A new agent may independently search the repository, re-check assumptions, or challenge prior conclusions when useful.

Treat v6.0 through v6.5 as **frozen development research**.

Do not retrospectively change thresholds to improve the already-inspected examples.

---

# 1. Development sample is no longer valid for untouched validation

Development stocks:

- `2330`
- `2317`
- `2454`
- `2382`
- `2303`
- `2449`

Development period:

`2026-04-01` through `2026-08-21`

These stocks and dates have been inspected repeatedly across v4/v5/v6.x.

They may still be used for:

- regression testing;
- reproducing frozen lifecycle states;
- pipeline development;
- contract tests.

They must **not** be used to claim untouched predictive validation.

---

# 2. Main evidence families and source locations

## 2.1 TDCC ownership migration

Purpose:

Detect persistent transfer of ownership from larger holders toward smaller holders.

The important concept is **persistent transfer**, not one weekly change.

Historical caveat:

Original historical TDCC publication timestamps are not fully known. Historical TDCC research therefore remains **association-only** and must not be represented as proof that the observation was available at the exact historical decision time.

## 2.2 Broker branch pressure

Daily research files:

`data_research/institutional-flow/histock/<STOCK>/daily/YYYYMMDD.json`

Example:

`data_research/institutional-flow/histock/2449/daily/20260618.json`

The v5 development-period Broker backfill was completed at:

- 98 source-derived trading sessions
- 6 development stocks
- 588 / 588 valid stock-date tasks

Relevant files:

- `scripts/plan_institutional_withdrawal_v5_broker_coverage.js`
- `.github/workflows/backfill-institutional-withdrawal-v5-broker.yml`

## 2.3 Foreign flow

Frozen feature output:

`data_research/institutional-flow/features/foreign-flow-v5.json`

Builder:

`scripts/build_foreign_flow_research_features.js`

Frozen methodology:

`institutional-withdrawal-v5-foreign-flow-features-v2-source-derived-calendar`

Features include:

- 5D total net flow
- 10D total net flow
- sell-day ratio
- dealer / ex-dealer flow
- acceleration
- foreign confirmation

Development coverage was 588 / 588.

## 2.4 Price / volume

Frozen feature output:

`data_research/institutional-flow/features/price-volume-v5.json`

Builder:

`scripts/build_price_volume_distribution_features.js`

Frozen methodology:

`institutional-withdrawal-v5-price-volume-features-v3-source-derived-calendar-gap-preserving`

Features include:

- 1D / 5D / 10D return
- prior 20-session mean volume
- volume ratio
- close vs prior 20D high
- high-volume-down day
- high-volume-flat day
- distribution days
- absorption days
- `price_volume_confirm`

Known development OHLCV gap:

`2026-06-24`

All six development stocks are missing that OHLCV row.

Correct semantics:

- retain the trading-calendar date;
- do not compress surrounding sessions together;
- do not impute;
- invalidate affected rolling windows.

---

# 3. Trading calendar rule

Do **not** use the legacy file below as the authoritative research calendar:

`data_history_sma/trading_days.json`

It was previously discovered to be stale and ended at `2026-08-04` during v5 research.

The frozen v5/v6 research uses a **source-derived trading calendar** derived from valid TWSE foreign daily source files.

Validation code should preserve the same source-derived-calendar principle.

---

# 4. v5 foundation

Specification:

`data_research/institutional-flow/v5-research-spec.md`

Feature matrix:

`data_research/institutional-flow/backtests/institutional-withdrawal-v5-feature-matrix.json`

Analysis:

- `data_research/institutional-flow/backtests/institutional-withdrawal-v5-analysis.json`
- `data_research/institutional-flow/backtests/institutional-withdrawal-v5-analysis.md`

Important scripts:

- `scripts/build_institutional_withdrawal_v5_matrix.js`
- `scripts/analyze_institutional_withdrawal_v5.js`

Workflow:

`.github/workflows/research-institutional-withdrawal-v5.yml`

Important v5 conclusion:

Simple Broker + TDCC pressure did **not** validate as a detector of large long-term institutional withdrawal. Persistent TDCC transfer and later market-absorption behavior became the key next research direction.

---

# 5. Frozen v6 lifecycle research

## 5.1 v6.0 — Persistent transfer + distribution / absorption

Primary output:

- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-distribution-absorption.json`
- corresponding Markdown report if present in the same directory

Main research finding:

A single Broker/TDCC pressure observation is insufficient.

Persistent ownership transfer improves the description of withdrawal-like behavior.

Important conceptual states include:

- pressure without persistence
- persistent transfer
- withdrawal pressure
- absorbed distribution
- fragile distribution

`fragile_distribution` became the key event type for later failure analysis.

---

## 5.2 v6.1 — Event Diagnosis

Primary output:

`data_research/institutional-flow/backtests/institutional-withdrawal-v6-1-event-diagnosis.json`

Ten fragile events were diagnosed.

Development diagnostic labels:

- 4 `persistent_withdrawal_consistent`
- 2 `absorbed_or_false_positive`
- 1 mixed short horizon
- 3 insufficient follow-up

Known withdrawal-consistent development events:

1. `2317` / fragile `2026-06-18`
2. `2454` / fragile `2026-06-12`
3. `2382` / fragile `2026-06-18`
4. `2449` / fragile `2026-06-18`

Known absorbed/false-positive development events:

1. `2303` / `2026-06-12`
2. `2449` / `2026-05-22`

Important rule:

These v6.1 outcome labels are diagnostic labels only and must **never** become inputs to a future classifier.

---

# 6. 2449 is the key controlled development comparison

Two separate 2449 episodes are especially useful for regression testing.

## First episode

Fragile anchor:

`2026-05-22`

Later diagnosis:

`absorbed_or_false_positive`

This event showed real distribution pressure and even later failure-like price action, but demand eventually returned and repaired the structure.

## Second episode

Fragile anchor:

`2026-06-18`

Later diagnosis:

`persistent_withdrawal_consistent`

This episode later weakened materially and did not reclaim the original fragile structure during the frozen recovery window.

These two episodes are useful as regression cases because they involve the same stock in nearby periods but different lifecycle outcomes.

---

# 7. v6.2 — Immediate Failure Transition

Frozen methodology:

`institutional-withdrawal-v6-2-fragile-failure-transition-v1`

Files:

- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-2-failure-transition.json`
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-2-failure-transition.md`
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-2-conclusion.md`

Frozen principle:

Failure requires **price failure plus contemporaneous supply confirmation**.

A price decline alone is not sufficient.

Institutional selling alone is not sufficient.

Main development result:

The clean immediate failure was:

`2317 / fragile 2026-06-18 → failure 2026-06-26 / session 5`

At transition:

- price breakdown
- foreign supply
- ownership transfer
- Broker pressure

were all present.

v6.2 was high-specificity but low-sensitivity.

---

# 8. v6.3 — Delayed Failure Transition

Frozen methodology:

`institutional-withdrawal-v6-3-delayed-failure-transition-v1`

Files:

- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-3-delayed-failure.json`
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-3-delayed-failure.md`
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-3-conclusion.md`

Frozen delayed window:

sessions `11–20` after fragile anchor.

Two frozen paths:

### delayed breakdown

- return vs fragile anchor `<= -10%`
- supply confirmation remains present

### rebound failure

- prior rebound `>= +5%`
- drawdown from running peak `<= -10%`
- price back below fragile anchor by at least `-2%`
- supply confirmation present

Combined v6.2 + v6.3 captured all four development withdrawal-consistent cases:

1. 2317 — session 5 immediate
2. 2454 — session 17 delayed rebound failure
3. 2382 — session 19 delayed breakdown
4. 2449 June episode — session 16 delayed rebound failure

Specificity problem:

2449 May false-positive was also promoted to delayed failure on `2026-06-08`, session 11.

---

# 9. v6.4 — Durable Failure Confirmation

Frozen methodology:

`institutional-withdrawal-v6-4-durable-failure-confirmation-v1`

Files:

- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-4-durable-failure.json`
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-4-durable-failure.md`
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-4-conclusion.md`

Frozen rule:

Candidate failure day is excluded.

Over the next 3 trading sessions:

- at least `2/3` sessions remain broken;
- at least `1/3` sessions retain contemporaneous supply confirmation.

Development result:

All five candidate failures passed durability.

That included the known 2449 May false-positive:

- broken `3/3`
- supply `3/3`

Important negative conclusion:

**Short-horizon persistence is not the missing discriminator.**

Do not retrospectively lengthen or tighten v6.4 on the same development sample.

---

# 10. v6.5 — Recovery / Reclaim Diagnosis

This is the latest and most important frozen development result.

Frozen methodology:

`institutional-withdrawal-v6-5-recovery-reclaim-diagnosis-v1`

Files:

- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-5-recovery-reclaim.json`
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-5-recovery-reclaim.md`
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-5-conclusion.md`

Workflow:

`.github/workflows/research-institutional-withdrawal-v6-5-recovery-reclaim.yml`

## Frozen reclaim rule

Allow the v6.4 3-session persistence period to finish first.

Then observe candidate-failure sessions `4–15`.

Within any rolling 3-session recovery window, reclaim requires both:

### Price repair

At least `2/3` closes at or above the original fragile anchor.

### Supply relief

At least 2 independent evidence families show relief in the same recovery window:

- Foreign relief
- Broker relief
- Ownership-transfer relief

At least `2/3` families are required.

## Development result

Frozen v6.4 durable candidates: 5.

Result:

| Stock | Fragile | Candidate | v6.1 diagnostic label | v6.5 result |
|---|---|---|---|---|
| 2317 | 2026-06-18 | 2026-06-26 | persistent withdrawal consistent | no reclaim |
| 2454 | 2026-06-12 | 2026-07-08 | persistent withdrawal consistent | no reclaim |
| 2382 | 2026-06-18 | 2026-07-17 | persistent withdrawal consistent | no reclaim |
| 2449 | 2026-05-22 | 2026-06-08 | absorbed / false-positive | confirmed reclaim |
| 2449 | 2026-06-18 | 2026-07-14 | persistent withdrawal consistent | no reclaim |

Descriptive development separation:

- withdrawal-consistent: `0/4` reclaimed
- known absorbed false failure: `1/1` reclaimed

This is promising but **not validated predictive performance** because these cases have been heavily inspected.

---

# 11. Detailed 2449 May reclaim regression case

Fragile anchor:

`2026-05-22`, close `296`

Candidate failure:

`2026-06-08`

Post-candidate trough:

`2026-06-10`, `-8.11%` vs fragile anchor

First one-day anchor reclaim:

`2026-06-18`, session 8

Confirmed reclaim window:

sessions 7–9

Confirmed reclaim date:

`2026-06-22`, session 9

Price repair:

`2/3` closes at or above fragile anchor

Supply-relief families:

- Foreign relief: yes
- Ownership-transfer relief: yes
- Broker relief: no

Relief-family count:

2

Maximum rebound from trough by reclaim:

`+24.63%`

End of session-15 window:

`+14.02%` vs fragile anchor

This is the main frozen regression example of **repaired absorption / false failure**.

---

# 12. Withdrawal-consistent recovery regression cases

## 2317

- trough vs anchor: `-12.85%`
- max rebound from trough: `+0.21%`
- session-15 end vs anchor: `-12.66%`
- no reclaim

## 2454

- trough: `-24.64%`
- max rebound: `+2.70%`
- session-15 end: `-22.61%`
- no reclaim

## 2382

- trough: `-25.80%`
- max rebound: `+8.96%`
- session-15 end: `-20.74%`
- no reclaim

## 2449 June episode

- trough: `-34.04%`
- max rebound from trough: `+20.64%`
- session-15 end: `-20.42%`
- no reclaim

Important conclusion:

**Large rebound magnitude does not equal structural repair.**

The classifier must distinguish price rebound from reclaim of the fragile anchor combined with supply relief.

---

# 13. Frozen lifecycle interpretation

The current lifecycle should be represented approximately as:

1. `persistent ownership transfer`
2. `fragile distribution`
3. `candidate failure`
   - immediate failure
   - delayed breakdown
   - rebound failure
4. `short durability`
5. `recovery / reclaim test`

Development interpretation only:

- `failure + no reclaim` is consistent with durable withdrawal pressure
- `failure + confirmed reclaim` is consistent with repaired absorption / false failure

Do **not** name the final state `institutional_withdrawal_confirmed`.

The identity of the seller is not proven.

Use a research-only name such as:

`durable_withdrawal_candidate`

---

# 14. Validation implementation status

The original handoff sequence has progressed beyond v6.5.

Completed validation foundation:

- frozen unified lifecycle classifier implemented;
- regression tests added for frozen development cases;
- deterministic coverage planner implemented;
- validation plan preregistered;
- development stocks excluded from stock holdout;
- research calendar derived from valid TWSE foreign-investor daily files;
- historical TDCC kept association-only;
- outcome/metrics files remain forbidden until coverage/sample freeze.

Important implementation files now include:

- `scripts/classify_institutional_withdrawal_lifecycle_v1.js`
- `scripts/test_institutional_withdrawal_lifecycle_v1.js`
- `scripts/plan_institutional_withdrawal_validation_coverage.js`
- `scripts/plan_institutional_withdrawal_validation_expansion_v1.js`
- `scripts/plan_institutional_withdrawal_validation_broker_batches_v1.js`
- `scripts/backfill_histock_broker_exact_source_date.js`
- `.github/workflows/expand-institutional-withdrawal-validation-coverage-v1.yml`
- `.github/workflows/expand-institutional-withdrawal-validation-coverage-v1-recovery.yml`
- `data_research/institutional-flow/validation-plan-v1.md`

Frozen development regression anchors include:

- `2317` immediate failure;
- `2454` delayed rebound failure;
- `2382` delayed breakdown;
- `2449 / 2026-05-22` failure then confirmed reclaim;
- `2449 / 2026-06-18` failure then no reclaim.

---

# 15. Physical-batch coverage lesson and current architecture

Repository root `AGENTS.md` now defines the mandatory meaning of **plan + batch** for large external-source fetches:

`plan → bounded queue → fresh-runner physical batches → jitter → cooldown → checkpoint → re-plan/resume`

A small `batch_size` inside one long-running job is not considered a physical batch.

## HiStock incident

Old long-running Broker coverage jobs initially fetched normally but later received degraded pages.

Known-positive regression case:

`1598 / 2026-05-07`

Old degraded response:

- HTTP 200
- response approximately 69 KB
- requested date visible
- `table_rows = 1`
- incorrectly persisted as `source_empty`

Fresh-runner diagnostics repeatedly returned a complete page:

- response approximately 90 KB
- `table_rows = 16`
- expected broker rows present

The recovery workflow was then converted to true physical batches.

Validated production-style recovery run:

- workflow run `33276819812`
- 6 TDCC stocks processed as separate fresh-runner jobs
- Broker work split into 9 separate fresh-runner jobs
- `strategy.max-parallel: 1`
- Broker physical batch size <= 5 exact-date requests
- request jitter retained
- randomized physical-batch cooldown retained
- final coverage refresh succeeded

Representative Broker checks:

- Batch 0 / 7791: 5/5 success, ~94 KB, `table_rows = 16`
- Batch 4 / 1598: 5/5 success, ~90.8–90.9 KB, `table_rows = 16`
- Batch 8 / 1598: 3/3 success, ~90.3–90.8 KB, `table_rows = 16`

No late-run 69 KB / header-only degradation appeared in those checked beginning/middle/end batches.

Therefore the fresh-runner physical-batch architecture is the current safe default for Broker coverage expansion.

Relevant architecture commit:

`309aae817286abee974e5bd4428ca518879b2e82`

Repository-level plan+batch rule commit:

`635eadd14ec469707227110d8b4a549013021c5a`

---

# 16. Current coverage state

After physical-batch run `33276819812`:

Coverage range:

`2026-04-01` through `2026-08-21`

Source-derived trading sessions:

`98`

Final expansion counts from the run:

- non-development universe: `1132`
- coverage eligible before TDCC/Broker: `1062`
- TDCC queue remaining: `1036`
- Broker queue remaining: `23`
- expansion-ready stocks: `3`

Current `stock_holdout_ready`:

- `1598`
- `1809`
- `7791`

Current `stock_holdout_needs_broker_normalization`:

`0`

Current `time_holdout_ready`:

`0`

Important: these are **coverage milestones only**. Do not inspect or generate validation outcomes yet.

The following files must still not exist during the coverage-expansion phase:

- `data_research/institutional-flow/validation/validation-outcomes-v1.json`
- `data_research/institutional-flow/validation/validation-metrics-v1.json`

---

# 17. Known unsafe historical Broker statuses

The old Broker fetcher/workflow produced some historical `source_empty` statuses during long-running runner degradation.

At least one is proven unsafe:

`1598 / 2026-05-07`

The source actually contained broker rows, so the old `source_empty` was a false negative caused by an incomplete/degraded response.

The current fetcher has improved status taxonomy, but historical ambiguous `source_empty` checkpoints from old long-running runs can still poison the Broker planner if treated as terminal negatives.

Do **not** delete those records blindly. Preserve them as audit evidence until they are classified and superseded.

A successful later exact-date fetch should override an earlier ambiguous negative for the same stock/date.

---

# 18. Current phase

**Coverage integrity repair before the next coverage wave.**

The immediate objective is not to inspect lifecycle outcomes.

The next round should first clean up historical Broker false-negative risk so future coverage planning is based on trustworthy source-status evidence.

---

# 19. Next round

Execute this order:

1. Audit historical Broker `source_empty` statuses under:
   `data_research/institutional-flow/histock/*/batch-status/exact-source-date-*.json`.
2. Identify statuses created under the old long-running execution model that are ambiguous/degraded rather than trustworthy terminal negatives.
3. Use diagnostics where available, especially:
   - HTTP status;
   - response bytes;
   - requested date visibility;
   - broker keyword visibility;
   - `table_rows`;
   - any known soft-block structural evidence.
4. Treat cases such as HTTP 200 + materially shrunken response + header-only `table_rows = 1` as suspected extraction/soft-block failures, not confirmed source-empty.
5. Update the status/planner contract so historical ambiguous negatives do not permanently exclude those source dates from the queue.
6. Add a regression fixture for known-positive `1598 / 2026-05-07`, including verification that real broker rows are parsed. Known anchors include:
   - `凱基-汐止`: net `-74`, avg `20.49`;
   - `兆豐-大同`: net `+206`, avg `20.76`.
7. Requeue only the unsafe/ambiguous historical negative dates.
8. Re-fetch them through the current **fresh-runner physical-batch** architecture, with bounded queue, `max-parallel: 1`, jitter, cooldown, checkpoint, and resume semantics.
9. Re-run the coverage planner after repaired checkpoints are committed.
10. Confirm the forbidden validation outcome/metrics files were still not generated.
11. Before beginning the following major round, update and commit this canonical handoff again.

Do not tune frozen lifecycle thresholds during this work.

Do not inspect future-return/outcome files as part of this repair.

---

# 20. Entry points for the next agent

Read repository root instructions first:

- `AGENTS.md`

Then this handoff:

- `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`

Primary implementation entry points:

- `scripts/backfill_histock_broker_exact_source_date.js`
- `scripts/plan_institutional_withdrawal_validation_broker_batches_v1.js`
- `scripts/plan_institutional_withdrawal_validation_expansion_v1.js`
- `.github/workflows/expand-institutional-withdrawal-validation-coverage-v1-recovery.yml`
- `.github/workflows/expand-institutional-withdrawal-validation-coverage-v1.yml`
- `data_research/institutional-flow/histock/*/batch-status/`
- `data_research/institutional-flow/validation/coverage-expansion-v1.json`
- `data_research/institutional-flow/validation/validation-coverage-v1.json`

Useful evidence:

- physical-batch recovery run `33276819812`
- known-positive Broker case `1598 / 2026-05-07`

The agent may search the broader repository or independently re-verify any assumption when useful.

---

# 21. Safety / stop conditions

Until the coverage/sample freeze is explicitly complete:

- do not generate or inspect validation outcome analysis;
- do not create `validation-outcomes-v1.json`;
- do not create `validation-metrics-v1.json`;
- do not tune v6.0–v6.5 thresholds;
- do not hand-pick holdout stocks based on lifecycle success/failure;
- do not convert historical TDCC association into a point-in-time availability claim;
- do not revert Broker fetching to a single long-running runner loop;
- preserve checkpoint/resume and `cancel-in-progress: false` for write-layer workflows.

---

# 22. Copy-paste prompt for the next round

```text
Continue the Institutional Withdrawal Validation work in repository `EasonLiu0913/stock_data`.

Before doing any work:
1. Read the repository-level instructions in `AGENTS.md`.
2. Read the canonical handoff:
   `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`
3. Verify that current `main` still matches the commits, workflows, files, and assumptions referenced by that handoff.
4. Continue from the handoff's `Next round` section.

You may independently search the repository, re-check implementation details, or challenge previous conclusions when useful. The handoff is a ready-to-continue state, not a restriction on fresh investigation.

Preserve all frozen v6.0–v6.5 methodology, validation leakage guardrails, TDCC historical caveats, outcome-blind coverage rules, and the repository's mandatory plan + fresh-runner physical-batch architecture.

Next focus:
Audit historical HiStock Broker `source_empty` checkpoints created under the old long-running runner model, identify ambiguous degraded responses such as HTTP 200 + shrunken HTML + `table_rows = 1`, prevent those false negatives from remaining terminal in the planner, add the `1598 / 2026-05-07` known-positive regression, and requeue/re-fetch only unsafe dates through fresh-runner physical batches.

Do not inspect or generate validation outcomes/metrics yet. Do not tune lifecycle thresholds.

Before starting another major round or phase:
- update this canonical handoff with what was completed;
- record important evidence, commits, workflow runs, failures, and changed understanding;
- update Current phase, Current repository state, Entry points, and Next round;
- update the copy-paste prompt for the following round;
- commit the handoff to the repository.
```
