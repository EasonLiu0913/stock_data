# Institutional Withdrawal Research — Validation Phase Handoff

## Purpose

This document is the authoritative handoff for continuing the Institutional Withdrawal research in `EasonLiu0913/stock_data`.

The research objective is to infer, from public market/chip data, whether large long-term holders may be persistently reducing exposure, whether the market is still absorbing that supply, and when that absorption fails or later repairs.

The research is **not** a simple next-day price prediction model. The working lifecycle is:

`persistent ownership transfer → fragile distribution → candidate failure → short durability → recovery/reclaim`

The next phase is **Validation Phase**, not another in-sample threshold-tuning version such as v6.6.

---

## Critical instruction for the next agent

Do **not** restart the research from code search or invent a new rule set.

The repository code-search index may be unavailable. If so, do not spend time trying to rediscover the project by keywords. Start from the exact files listed in this handoff and inspect directories/files directly.

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

This is the latest and most important frozen result.

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

# 14. The next phase is Validation Phase

Do not build v6.6 to tune the development examples.

The next work should be:

## Step A — Build a frozen unified classifier

Recommended classifier name:

`institutional-withdrawal-lifecycle-v1`

It should integrate the frozen v6.0–v6.5 lifecycle without using any future outcome label.

It may read contemporaneously available/frozen research features only:

- TDCC
- Broker
- Foreign
- OHLCV

It must not read:

- v6.1 outcome labels
- future 5D / 10D / 20D / 30D returns
- future max drawdown
- any later diagnostic label

Recommended output fields:

```text
stock
date
ownership_state
distribution_state
failure_state
durability_state
recovery_state
lifecycle_state
evidence
methodology_versions
```

Suggested research-only lifecycle states:

```text
no_signal
ownership_transfer
distribution_pressure
fragile_distribution
candidate_failure
durable_failure
confirmed_reclaim
durable_withdrawal_candidate
```

---

## Step B — Regression-test the unified classifier

Use the six development stocks only as regression fixtures.

The unified classifier should reproduce frozen outputs, including at minimum:

- 10 fragile events
- 2317 immediate failure
- 2454 delayed rebound failure
- 2382 delayed breakdown
- 2449 May candidate failure
- 2449 May confirmed reclaim
- 2449 June candidate failure / no reclaim

If reproduction fails:

Fix the unified implementation.

Do **not** change frozen v6.0–v6.5 rules to make the test pass.

---

## Step C — Build a validation universe / coverage planner

Recommended script:

`scripts/plan_institutional_withdrawal_validation_universe.js`

Purpose:

Scan the repository and identify stocks/date ranges with overlapping coverage for all required evidence families:

- TDCC
- Broker
- Foreign
- OHLCV

Do not begin by hand-picking validation winners.

First produce an objective coverage inventory.

Recommended per-stock output:

```json
{
  "stock": "XXXX",
  "tdcc_start": "YYYY-MM-DD",
  "tdcc_end": "YYYY-MM-DD",
  "broker_sessions": 0,
  "foreign_sessions": 0,
  "ohlcv_sessions": 0,
  "common_start": "YYYY-MM-DD",
  "common_end": "YYYY-MM-DD",
  "eligible": true
}
```

Use source-derived trading-calendar semantics.

---

## Step D — Pre-register validation plan before viewing outcomes

Recommended file:

`data_research/institutional-flow/validation-plan-v1.md`

It must be written before validation outcome analysis.

Define in advance:

### Universe eligibility

Examples of items that must be fixed before results:

- minimum TDCC anchors
- minimum common trading sessions
- minimum Broker coverage ratio
- required Foreign coverage
- permitted OHLCV-gap policy
- minimum number of stocks
- industry/universe constraints if any

### Validation split

Prefer both:

1. **Stock holdout** — stocks not used in v6 development
2. **Time holdout / forward validation** — dates after `2026-08-21`

Forward validation is the cleanest future test when enough outcomes become available.

---

## Step E — Pre-register validation metrics

Do not choose metrics after seeing results.

At minimum measure:

### Failure metrics

- candidate failure count
- durable failure count
- failure precision
- failure false-positive rate
- time-to-failure

### Reclaim metrics

- reclaim count
- reclaim rate
- false-reclaim rate
- time-to-reclaim

### Outcome metrics

For lifecycle groups such as:

- fragile only
- candidate failure
- durable failure
- failure + reclaim
- failure + no reclaim

Compare:

- 5D return
- 10D return
- 20D return
- 30D return
- maximum drawdown
- recovery magnitude
- negative-return rate

The central validation hypothesis is:

> `failure + no reclaim` should show materially weaker 20D / 30D outcomes and deeper drawdowns than `failure + reclaim`.

A second key hypothesis is:

> confirmed reclaim should reduce false-failure classification without simply filtering on future return.

---

## Step F — Pre-register production-promotion gate

Before viewing validation outcomes, define conditions that would be required before any daily production monitoring is considered.

At minimum consider:

- enough independent events
- enough distinct stocks
- no concentration in one stock such as 2449
- no concentration in one industry
- acceptable precision
- acceptable false-positive rate
- reclaim filter improves specificity
- 20D / 30D outcome direction is stable
- stock-holdout and time-holdout results are directionally consistent
- no future-information leakage

Until promotion conditions are satisfied:

`production_safe = false`

---

# 15. Recommended first files for a new agent to read

Do not start with broad code search.

Read these files directly in this order:

1. `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`
2. `data_research/institutional-flow/backtests/institutional-withdrawal-v6-5-conclusion.md`
3. `data_research/institutional-flow/backtests/institutional-withdrawal-v6-5-recovery-reclaim.json`
4. `data_research/institutional-flow/backtests/institutional-withdrawal-v6-4-conclusion.md`
5. `data_research/institutional-flow/backtests/institutional-withdrawal-v6-3-conclusion.md`
6. `data_research/institutional-flow/backtests/institutional-withdrawal-v6-2-conclusion.md`
7. `data_research/institutional-flow/backtests/institutional-withdrawal-v6-distribution-absorption.json`
8. `data_research/institutional-flow/backtests/institutional-withdrawal-v5-feature-matrix.json`
9. `data_research/institutional-flow/features/foreign-flow-v5.json`
10. `data_research/institutional-flow/features/price-volume-v5.json`

Then inspect `scripts/` and `.github/workflows/` directly.

Relevant known scripts include:

- `scripts/build_foreign_flow_research_features.js`
- `scripts/build_price_volume_distribution_features.js`
- `scripts/build_institutional_withdrawal_v5_matrix.js`
- `scripts/analyze_institutional_withdrawal_v5.js`
- v6.x analyzers already present under `scripts/`

---

# 16. Workflow rules

Research workflows are under:

`.github/workflows/`

Known examples:

- `research-institutional-withdrawal-v5.yml`
- `backfill-institutional-withdrawal-v5-broker.yml`
- `research-institutional-withdrawal-v6-5-recovery-reclaim.yml`

Recommended validation workflow name:

`research-institutional-withdrawal-validation-v1.yml`

Important repository safety rule:

For workflows that commit/checkpoint data, use:

```yaml
cancel-in-progress: false
```

A previous v5 workflow used `cancel-in-progress: true` and triggered repository safety CI because a newer run could cancel a writer before checkpoint completion.

---

# 17. Validation leakage guardrails

The unified classifier must obey these constraints:

1. No future return may construct lifecycle state.
2. No v6.1 diagnostic outcome label may construct lifecycle state.
3. No max future drawdown may construct lifecycle state.
4. TDCC historical timing limitations must remain explicitly documented.
5. Missing OHLCV sessions must remain gap-preserving.
6. Validation eligibility must be decided before examining validation outcomes.
7. Promotion gates must be written before examining validation outcomes.
8. Development sample may only be used for regression, not validation claims.

---

# 18. Key validation questions

The next research phase should answer these questions rather than further tuning the development set:

1. On stocks never used to design v6, does the lifecycle still occur in the same sequence?
2. Does `failure + no reclaim` produce materially worse 20D / 30D outcomes than `failure + reclaim`?
3. Does the reclaim layer consistently remove false failures?
4. Is the current development separation (`0/4` reclaim among withdrawal-consistent vs `1/1` reclaim among known absorbed false failure) reproduced out of sample?
5. Does the behavior generalize beyond 2449 and beyond the electronics sector?
6. How many events are required before any production-monitoring claim is statistically or operationally credible?

---

# 19. Current stopping point

Latest completed research layer:

**v6.5 Recovery / Reclaim Diagnosis**

Latest conclusion commit before this handoff:

`f596bf301a865fe401b25416cb65c74811a41027`

Current promising development observation:

- withdrawal-consistent durable failures: `0/4` reclaimed
- known absorbed false failure: `1/1` reclaimed

This must remain described as **descriptive development evidence**, not validated performance.

The next sequence is:

`Freeze → Unified Lifecycle Classifier → Regression Test → Coverage Planner → Pre-registered Validation Plan → Untouched / Walk-forward Validation → Promotion Decision`

Do not skip directly from v6.5 development results to production monitoring.
