# Institutional Withdrawal Validation Plan v1

Status: **pre-registered before validation outcomes are generated or inspected**.

Methodology under validation: `institutional-withdrawal-lifecycle-v1`.

Frozen development methodology: v6.0 through v6.5. No v6.6 threshold tuning is permitted in this validation phase.

## 1. Core hypothesis

Among frozen-lifecycle events that reach a durable candidate failure, the post-recovery state:

- `failure_plus_no_reclaim`

should show worse subsequent structure than:

- `failure_plus_reclaim`.

The pre-registered directional expectations are:

1. lower subsequent 20-session return;
2. lower subsequent 30-session return;
3. deeper subsequent maximum drawdown;
4. higher negative-return rate;
5. lower later structural-repair rate.

The seller identity is not assumed to be known. Historical TDCC remains association-only because original publication timestamps are incomplete.

## 2. Frozen classifier contract

The unified classifier must reproduce, without outcome inputs:

`persistent ownership transfer -> fragile distribution -> candidate failure -> short durability -> recovery/reclaim`.

It may read only contemporaneous/current-or-prior evidence used by frozen v6.0-v6.5:

- TDCC-derived persistent ownership-transfer state;
- Broker pressure state;
- Foreign flow state;
- OHLCV / price-volume state;
- source-derived trading calendar.

It must not read:

- v6.1 diagnostic outcome labels;
- forward 5D/10D/20D/30D return;
- future maximum drawdown;
- future maximum gain;
- any validation outcome field.

The source-derived trading calendar is authoritative. `data_history_sma/trading_days.json` is explicitly forbidden as a research calendar.

The known development OHLCV gap on `2026-06-24` must remain a gap. The calendar date remains present; rolling windows touching the missing row are invalid; surrounding sessions are never compressed and no value is imputed.

## 3. Development regression sample

Development stocks:

`2330, 2317, 2454, 2382, 2303, 2449`

Development period:

`2026-04-01` through `2026-08-21`.

These observations are regression-only and cannot contribute to untouched validation statistics.

Required frozen regression cases:

- 10 fragile events total;
- 2317 / 2026-06-18 -> immediate candidate failure on 2026-06-26, session 5 -> durable -> no reclaim;
- 2454 / 2026-06-12 -> delayed rebound failure on 2026-07-08, session 17 -> durable -> no reclaim;
- 2382 / 2026-06-18 -> delayed breakdown on 2026-07-17, session 19 -> durable -> no reclaim;
- 2449 / 2026-05-22 -> candidate failure on 2026-06-08, session 11 -> durable -> confirmed reclaim on 2026-06-22;
- 2449 / 2026-06-18 -> candidate failure on 2026-07-14, session 16 -> durable -> no reclaim.

If implementation and frozen results disagree, implementation is fixed. Frozen thresholds are not changed.

## 4. Validation universe eligibility

Universe selection is coverage-driven, never outcome-driven.

A stock-holdout candidate must:

1. not be one of the six development stocks;
2. have official historical TDCC observations in the requested validation range;
3. have source-derived TWSE foreign-flow sessions;
4. have valid Fubon OHLCV rows aligned to those sessions;
5. have Broker evidence that can be normalized deterministically from repository source data;
6. pass the coverage requirements below before any lifecycle outcome is calculated.

No stock may be manually added because it appears to contain a successful withdrawal episode.

## 5. Coverage requirements

The coverage planner is frozen as `institutional-withdrawal-validation-coverage-planner-v1`.

Minimum stock-level screening requirements before feature construction:

- at least 3 historical TDCC observations;
- at least 40 source-derived daily sessions with both Foreign and OHLCV rows;
- common Foreign/OHLCV coverage ratio >= 80% over the evaluated range;
- at least 40 normalized per-stock Broker research days for direct validation readiness.

If raw Broker source files exist but normalized per-stock Broker research rows do not, the stock is reported separately as `stock_holdout_needs_broker_normalization`; normalization/backfill must be deterministic, coverage-based, and completed before outcomes are inspected.

These are data-coverage gates, not classifier thresholds.

For a fragile event to enter resolved-event validation statistics, it must additionally have enough source-derived future sessions to complete the frozen lifecycle and the requested outcome horizon. A missing OHLCV row invalidates any dependent window and is not skipped to make the horizon fit.

## 6. Holdout design

### 6.1 Primary: stock holdout

Primary untouched validation uses stocks not present in the development universe.

All eligible stocks returned by the coverage planner are included. No post-hoc stock selection is allowed.

### 6.2 Secondary: time holdout / walk-forward

If the repository does not yet contain an eligible stock holdout, the secondary path is a strict time holdout after `2026-08-21`.

Development-stock identities may appear in the time holdout, but only dates strictly after `2026-08-21` may contribute. No event whose fragile anchor is on or before `2026-08-21` can enter time-holdout validation.

The walk-forward set is frozen by coverage and date before outcomes are generated.

Stock-holdout and time-holdout results must be reported separately; they are never pooled to claim untouched stock-level generalization.

## 7. Outcome clock and metrics

Validation outcomes are measured only after the lifecycle state has resolved, so the classifier cannot consume the evaluated outcome window.

Resolution date:

- `failure_plus_reclaim`: reclaim confirmation date;
- `failure_plus_no_reclaim`: candidate-failure session 15 end date used to close the frozen no-reclaim window.

From the next source-derived trading session after resolution, compute:

- 20-session total return;
- 30-session total return;
- maximum drawdown over the next 20 sessions;
- maximum drawdown over the next 30 sessions;
- 20-session negative-return indicator;
- 30-session negative-return indicator;
- structural-repair indicator within the next 30 sessions.

Structural repair is evaluated as a descriptive validation outcome and must not be fed back into the frozen lifecycle classifier.

Group summaries for `failure_plus_no_reclaim` and `failure_plus_reclaim`:

- N;
- mean and median 20D return;
- mean and median 30D return;
- mean and median max drawdown 20D / 30D;
- negative-return rate 20D / 30D;
- structural-repair rate;
- bootstrap 95% confidence interval for between-group differences when both groups contain enough observations to resample meaningfully.

Events with incomplete required follow-up are `unresolved_for_metric` and are excluded only from that metric denominator; they are never silently converted to zero or compressed across missing sessions.

## 8. Production promotion gate

No production promotion is allowed from development regression results.

Promotion requires a completed untouched stock-holdout validation set. Time holdout alone may support continued research but cannot satisfy the production gate.

Minimum promotion evidence:

- at least 30 resolved durable-failure events in untouched stock holdout;
- at least 8 `failure_plus_reclaim` events and at least 8 `failure_plus_no_reclaim` events;
- both 20D and 30D mean return are lower for `failure_plus_no_reclaim` than for `failure_plus_reclaim`;
- both 20D and 30D median return are lower for `failure_plus_no_reclaim`;
- 20D and 30D mean maximum drawdown are deeper for `failure_plus_no_reclaim`;
- 20D and 30D negative-return rates are higher for `failure_plus_no_reclaim`;
- 30D structural-repair rate is lower for `failure_plus_no_reclaim`;
- no frozen classifier threshold was changed after validation outcomes were opened.

If the directional gate fails, the result is a failed validation of `institutional-withdrawal-lifecycle-v1`; it is not a reason to tune v6.0-v6.5 on the same validation sample.

## 9. Current coverage decision rule

The repository is currently known to have historical TDCC stock directories and normalized Institutional Withdrawal Histock research directories only for the six development stocks. Therefore there is no currently demonstrated non-development stock holdout that can be declared untouched-ready from existing normalized research data.

The first validation batch is selected mechanically as follows:

1. run `plan_institutional_withdrawal_validation_coverage.js`;
2. if `stock_holdout_ready` is non-empty, freeze **all** returned stocks as Batch 1 stock holdout;
3. otherwise, if `stock_holdout_needs_broker_normalization` is non-empty, normalize Broker coverage for **all** returned stocks in deterministic batches before computing any outcomes, then freeze the resulting eligible set;
4. if no stock holdout can be formed yet, use `time_holdout_ready` only as a separately reported walk-forward Batch 1; do not call it untouched stock validation;
5. if neither set is ready, Batch 1 remains blocked by coverage and no outcome inspection is permitted.

This rule prevents hand-picking apparent winners after looking at price outcomes.

## 10. Workflow safety

Any workflow that commits or checkpoints validation artifacts must use:

`cancel-in-progress: false`.

Coverage/backfill work should use explicit plans and bounded batches rather than one large request, so retries do not cause server blocking or destroy deterministic progress.
