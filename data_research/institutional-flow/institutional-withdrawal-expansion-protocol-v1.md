# Institutional Withdrawal Untouched Expansion Protocol v1

Status: **prospectively preregistered before Batch 2+ sample construction or outcome inspection**.

Methodology identity: `institutional-withdrawal-untouched-expansion-protocol-v1`

Applies to: future untouched stock-holdout Batch 2+ validation for frozen lifecycle methodology `institutional-withdrawal-lifecycle-v1` / development methodology v6.0-v6.5.

Canonical path: `data_research/institutional-flow/institutional-withdrawal-expansion-protocol-v1.md`

## 1. Purpose and non-adaptivity rule

Batch 1 is permanently closed as `1598,1616,1809,6257,7791`. Its observed zero-fragile / zero-durable-failure result is retained evidence but must not be used to rank, cherry-pick, prioritize, or manually choose any later stock.

Future untouched expansion is allowed only through the deterministic rules in this protocol. No individual stock or batch may be added, removed, substituted, reordered, or repeated because its lifecycle outcome, return, drawdown, structural repair, or directional result looks favorable or unfavorable.

## 2. Permanent exclusions

The following stocks are permanently excluded from every future untouched stock-holdout batch:

- development: `2330,2317,2454,2382,2303,2449`;
- prior untouched Batch 1: `1598,1616,1809,6257,7791`;
- any stock already frozen into a later untouched batch under this protocol.

An exclusion may be added only for a pre-outcome identity error that makes a stock outside the declared universe (for example, an invalid/non-equity code) and must be documented before outcomes are opened. Coverage failure is not a discretionary exclusion: the candidate remains in deterministic order and is simply not eligible for the current freeze until it satisfies the fixed coverage gate.

## 3. Eligible candidate universe

For each future sample-construction round, the candidate universe is all 4-digit stock codes observed in either valid TWSE foreign-investor daily rows or valid Fubon OHLCV rows over the fixed anchor range `2026-04-01` through `2026-08-21`, after applying permanent exclusions.

The research calendar is derived only from valid TWSE foreign-investor daily files. `data_history_sma/trading_days.json` is forbidden as a research calendar.

Historical TDCC remains association-only and `production_no_lookahead_safe=false` remains explicit.

## 4. Fixed coverage gate

A stock is sample-freeze eligible only when all existing validation-plan v1 coverage requirements are satisfied over the anchor range:

- at least 3 official historical TDCC observations;
- at least 40 source-derived sessions with both Foreign and valid OHLCV;
- common Foreign/OHLCV coverage ratio >= 0.80;
- at least 40 normalized per-stock Broker research days.

Broker semantics remain strict:

- `source_rows_incomplete` is non-negative and coverage-unusable;
- incomplete Broker rows are never zero-imputed;
- HTTP 200 + degraded/shrunken HTML + `table_rows=1` remains ambiguous/retryable, not terminal negative evidence;
- the protected `1598 / 2026-05-07` and five protected `7791` source-status regressions remain mandatory.

Missing OHLCV sessions remain real gaps; no session compression or imputation is allowed.

## 5. Deterministic candidate order

Future candidates are ordered by ascending:

`sha256("institutional-withdrawal-validation-expansion-v1" + "|" + stock)`

with stock code ascending as the deterministic tie-breaker.

This is the existing expansion-planner ordering identity and is frozen here as the sample-order mechanism, not merely a network scheduling preference.

The order is computed over the eligible candidate universe after permanent exclusions. Outcomes, classifier hits, returns, drawdowns, industries, liquidity beyond the fixed coverage gate, and Batch 1 results may not alter the order.

## 6. Sequential batch design

Future untouched validation is sequential and bounded.

- Batch size: **10 stocks** per future batch.
- Batch 2 is the first 10 coverage-eligible candidates in deterministic order after permanent exclusions.
- Batch 3 is the next 10 not previously frozen, and so on.
- If fewer than 10 eligible candidates remain at a freeze boundary, the final available set may form a smaller terminal batch only when no additional candidate earlier in deterministic order is merely awaiting already-authorized deterministic coverage completion. Otherwise the sample-construction round remains blocked rather than skipping ahead.
- Maximum future batches under this protocol: **4** (`Batch 2` through `Batch 5`), for at most **40 additional untouched stocks**.

Coverage collection may proceed only in deterministic bounded physical batches and may make earlier ordered candidates eligible; it must never skip an earlier candidate because a later candidate is easier to collect.

## 7. Phase boundary and sample freeze

For every future batch:

1. outcome-blind candidate/coverage state is rebuilt under the frozen protocol;
2. the next batch identities are selected mechanically from deterministic order;
3. exact stock identities, anchor range, coverage evidence, methodology identity, and relevant blobs are committed as a sample-freeze checkpoint;
4. Prompt B independently closes that sample-freeze round;
5. only after that closeout may a separate Prompt A generate lifecycle outcomes for the frozen batch.

No future return, drawdown, lifecycle-resolution outcome, structural-repair outcome, or validation metric for an unfrozen candidate may be generated or inspected during sample construction.

## 8. Event-count accumulation and reporting

Every untouched batch is immutable once outcomes are opened and is reported separately.

For cumulative validation statistics, Batch 1 and all later untouched stock-holdout batches created under this protocol are pooled only for the exact preregistered validation-plan v1 event metrics:

- resolved durable-failure count;
- `failure_plus_reclaim` count;
- `failure_plus_no_reclaim` count;
- 20D/30D mean and median returns;
- 20D/30D mean and median maximum drawdowns;
- 20D/30D negative-return rates;
- 30D structural-repair rate;
- between-group bootstrap 95% CIs when the existing meaningful-resampling gate is met.

Per-batch metrics must remain visible beside cumulative metrics. No time-holdout observations may be pooled into untouched stock-holdout production-gate statistics.

Zero-event and underpowered batches remain in the audit trail and contribute zero events to cumulative counts. They are never removed and never trigger stock-specific replacement.

## 9. Precommitted stopping rule

Evaluation occurs only after a full frozen batch has completed its independent outcome closeout.

Stop untouched expansion before opening the next batch when either condition is met:

1. **count sufficiency stop**: cumulative untouched stock-holdout evidence reaches all validation-plan v1 minimum count gates — at least 30 resolved durable-failure events, at least 8 `failure_plus_reclaim`, and at least 8 `failure_plus_no_reclaim`; or
2. **finite cap stop**: Batch 5 has been completed and closed, regardless of event count or directional result.

The count-sufficiency stop uses only preregistered sample-size sufficiency, not whether directional metrics look favorable. Directional promotion criteria are evaluated only after a stopping condition has been reached; they may pass, fail, or remain unresolved, but they may not cause ad-hoc additional batches beyond this protocol.

If the count gate is first reached inside a batch, the entire already-frozen batch is completed and retained; no event or stock is truncated from that batch.

## 10. Production-promotion separation

Meeting the count-sufficiency stop does not itself promote a strategy. Production promotion remains a separate review requiring every directional criterion in `validation-plan-v1.md` and confirmation that frozen v6.0-v6.5 rules were unchanged after outcomes opened.

If the finite cap is reached while counts remain insufficient, the result is underpowered/unresolved under this protocol. A new expansion protocol would require a separate prospective preregistration round; it cannot be invented after inspecting which specific stocks/batches were promising.

## 11. Mechanical implementation audit

Known entry points are sufficient to implement the protocol with bounded changes, but current code/workflow state is not yet authorized to freeze Batch 2 without those changes:

- `scripts/plan_institutional_withdrawal_validation_coverage.js` already enforces the frozen v1 coverage thresholds and source-derived calendar, but its current `stock_holdout_ready` behavior includes all non-development ready stocks and does not encode Batch 2+ ordering/batch identity.
- `scripts/plan_institutional_withdrawal_validation_expansion_v1.js` already computes deterministic `sha256(seed|stock)` ordering and fixed source/coverage state, but currently excludes only development stocks and describes that order as network-request scheduling only. Before Batch 2 construction it must be boundedly changed to consume this protocol identity, permanently exclude Batch 1/prior holdouts, and expose deterministic sample-order/batch selection without reading outcomes.
- `scripts/plan_institutional_withdrawal_validation_broker_batches_v1.js` remains the Broker physical-batch planner. Its default physical request batch is 5; future workflow invocation must continue to pass/guard `--batch-size-requests 5` so each fresh runner makes no more than five exact-source-date requests.
- `scripts/audit_histock_broker_source_empty_checkpoints.js` remains the strict Broker source-status audit entry point.
- `.github/workflows/expand-institutional-withdrawal-validation-coverage-v1-recovery.yml` preserves `cancel-in-progress:false`, TDCC one-stock fresh runners, Broker fresh runners with `fail-fast:false`, `max-parallel:1`, <=5 exact-source-date requests, jitter/cooldowns, and bounded checkpoints. However, it is still a pre-Batch-1-closeout workflow and has two concrete incompatibilities that must be fixed before Batch 2 sample construction:
  1. its sparse checkout does not include `data_research/institutional-flow/institutional-withdrawal-expansion-protocol-v1.md`, which the future protocol-aware planner must consume or whose identity it must otherwise verify;
  2. its `finalize` step currently asserts `test ! -e data_research/institutional-flow/validation/validation-outcomes-v1.json` and `test ! -e .../validation-metrics-v1.json`. Those Batch 1 canonical artifacts now legitimately exist and must remain immutable, so future outcome-blind expansion must instead prove it does not read, rewrite, stage, or delete them rather than requiring their absence.

Required bounded implementation changes before any Batch 2 sample freeze:

1. make the future sample planner read/encode `institutional-withdrawal-untouched-expansion-protocol-v1`;
2. permanently exclude development + all prior holdout identities;
3. use the frozen SHA-256 order as sample order;
4. select at most the next 10 eligible stocks without outcome inputs;
5. emit durable evidence proving no earlier ordered candidate was improperly skipped;
6. update the recovery workflow sparse checkout/contract checks so the protocol identity is available and validated;
7. replace the obsolete "Batch 1 outcome artifacts must not exist" assertions with bounded immutability/non-consumption checks that allow the existing Batch 1 artifacts to remain present while preventing them from influencing candidate order or sample selection.

These changes must remain outcome-blind. The canonical Batch 1 outcome/metrics files may be checked only for immutable path/blob identity or absence from the planner's dependency/read set; their contents must not be consumed to select or order future candidates.

This audit does not authorize running the planner now to reveal Batch 2 identities.

## 12. Protocol immutability

Once this document is committed and independently closed by Prompt B, its universe, ordering seed/algorithm, batch size, maximum batch count, pooling rule, and stopping rule are frozen for Batch 2-Batch 5. Any change requires a new prospectively preregistered methodology identity before the affected future candidate identities or outcomes are opened.
