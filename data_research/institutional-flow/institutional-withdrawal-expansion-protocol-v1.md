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

An exclusion may be added only for a pre-outcome identity error that makes a stock outside the declared universe (for example, an invalid/non-equity code) and must be documented before outcomes are opened. Coverage failure is not a discretionary identity exclusion; it is handled only by the terminal coverage-resolution rule below.

## 3. Eligible candidate universe

For each future sample-construction round, the candidate universe is all 4-digit stock codes observed in either valid TWSE foreign-investor daily rows or valid Fubon OHLCV rows over the fixed anchor range `2026-04-01` through `2026-08-21`, after applying permanent exclusions.

The research calendar is derived only from valid TWSE foreign-investor daily files. `data_history_sma/trading_days.json` is forbidden as a research calendar.

Historical TDCC remains association-only and `production_no_lookahead_safe=false` remains explicit.

## 4. Fixed coverage gate and terminal coverage resolution

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

### 4.1 Deterministic terminal coverage statuses

A candidate earlier in deterministic order may be passed over only after it is durably classified into one of these outcome-blind coverage states:

- `coverage_ready`: all four fixed coverage gates pass;
- `coverage_terminal_ineligible_common_source`: fixed-range common Foreign/OHLCV sessions are <40 or common ratio is <0.80; because the anchor range and source calendar are frozen, later TDCC/Broker work cannot repair this gate;
- `coverage_terminal_ineligible_tdcc`: common-source gate passes, the deterministic official TDCC historical collection attempt for the full fixed anchor range has completed, and fewer than 3 valid official historical observations exist;
- `coverage_terminal_ineligible_broker`: common-source and TDCC gates pass, every common Foreign+OHLCV source date in ascending date order has either a valid normalized Broker row or a durable per-date terminal status under the strict Broker policy, no retryable/ambiguous date remains, and fewer than 40 valid normalized Broker research days exist;
- `coverage_pending_tdcc`: common-source gate passes but the full fixed-range TDCC collection attempt is not yet durably complete;
- `coverage_pending_broker`: common-source and TDCC gates pass but Broker exact-date coverage is not yet at 40 and at least one required date remains missing/retryable/ambiguous rather than terminally exhausted.

Only `coverage_ready` candidates may enter a future batch. `coverage_terminal_ineligible_*` candidates remain permanently recorded in deterministic order but may be skipped for sample membership because the fixed coverage contract cannot be met. `coverage_pending_*` candidates may **not** be skipped in favor of a later candidate merely because the later candidate is easier or already ready.

### 4.2 Deterministic coverage-exhaustion procedure

Candidate coverage is resolved in deterministic candidate order. For each candidate that passes the common-source gate:

1. TDCC: perform the existing official historical query over the entire fixed anchor range using the repository's bounded fresh-runner TDCC collection contract; after the durable range attempt is complete, classify as ready-for-Broker or `coverage_terminal_ineligible_tdcc` solely from the valid official-observation count.
2. Broker: use that stock's `common_source_dates` in ascending source-derived date order. Existing valid normalized rows count first. For remaining dates, preserve persisted terminal statuses, requeue ambiguous/retryable statuses under the frozen Broker policy, and collect bounded exact-source dates until either 40 valid normalized days are reached or every common source date is durably exhausted.
3. If 40 valid Broker days are reached, stop additional Broker requests for that candidate and classify `coverage_ready`.
4. If all common source dates are durably exhausted with fewer than 40 valid rows and no retryable/ambiguous date remains, classify `coverage_terminal_ineligible_broker`.

No classifier event, price outcome after a fragile/lifecycle state, return, drawdown, structural repair, industry behavior, or Batch 1 outcome may influence these coverage states.

## 5. Deterministic candidate order

Future candidates are ordered by ascending:

`sha256("institutional-withdrawal-validation-expansion-v1" + "|" + stock)`

with stock code ascending as the deterministic tie-breaker.

This is the existing expansion-planner ordering identity and is frozen here as the sample-order mechanism, not merely a network scheduling preference.

The order is computed over the candidate universe after permanent exclusions. Outcomes, classifier hits, returns, drawdowns, industries, liquidity beyond the fixed coverage gate, and Batch 1 results may not alter the order.

## 6. Sequential batch design

Future untouched validation is sequential and bounded.

- Batch size: **10 stocks** per future batch.
- Starting from the beginning of deterministic order, resolve candidate coverage using Section 4. The next batch contains the first 10 candidates classified `coverage_ready` after permanently excluded, prior-frozen, and durably `coverage_terminal_ineligible_*` candidates are passed over.
- A `coverage_pending_tdcc` or `coverage_pending_broker` candidate blocks selection of later candidates until its coverage state is mechanically resolved; a later ready stock cannot leapfrog it.
- Batch 3 is formed by continuing the same deterministic order after removing stocks already frozen in Batch 2, and so on.
- If the remaining deterministic universe is fully resolved and fewer than 10 `coverage_ready` candidates remain, those remaining ready candidates form the smaller terminal batch. A smaller batch is not allowed while any earlier non-excluded candidate is still `coverage_pending_*`.
- Maximum future batches under this protocol: **4** (`Batch 2` through `Batch 5`), for at most **40 additional untouched stocks**.

Coverage collection may proceed only in deterministic bounded physical batches and must resolve earlier pending candidates before later candidates are admitted to a sample.

## 7. Phase boundary and sample freeze

For every future batch:

1. outcome-blind candidate/coverage state is rebuilt under the frozen protocol;
2. deterministic coverage-resolution proceeds until the next batch membership is mechanically determined;
3. exact stock identities, anchor range, candidate-order evidence, terminal/pending coverage audit, methodology identity, and relevant blobs are committed as a sample-freeze checkpoint;
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

- `scripts/plan_institutional_withdrawal_validation_coverage.js` already enforces the frozen v1 coverage thresholds and source-derived calendar, but its current `stock_holdout_ready` behavior includes all non-development ready stocks and does not encode Batch 2+ ordering/batch identity or the terminal/pending coverage states in Section 4.
- `scripts/plan_institutional_withdrawal_validation_expansion_v1.js` already computes deterministic `sha256(seed|stock)` ordering and fixed source/coverage state, but currently excludes only development stocks and describes that order as network-request scheduling only. Before Batch 2 construction it must be boundedly changed or superseded by a versioned planner that consumes this protocol identity, permanently excludes Batch 1/prior holdouts, resolves Section 4 coverage states, and exposes deterministic next-batch selection without reading outcomes.
- `scripts/plan_institutional_withdrawal_validation_broker_batches_v1.js` remains the Broker physical-batch planner. Its default physical request batch is 5; future workflow invocation must continue to pass/guard `--batch-size-requests 5` so each fresh runner makes no more than five exact-source-date requests. Its task ordering must be adapted so Broker work resolves earlier deterministic candidates and ascending `common_source_dates` before later candidates can leapfrog them.
- `scripts/audit_histock_broker_source_empty_checkpoints.js` remains the strict Broker source-status audit entry point.
- `.github/workflows/expand-institutional-withdrawal-validation-coverage-v1-recovery.yml` preserves `cancel-in-progress:false`, TDCC one-stock fresh runners, Broker fresh runners with `fail-fast:false`, `max-parallel:1`, <=5 exact-source-date requests, jitter/cooldowns, and bounded checkpoints. However, it is still a pre-Batch-1-closeout workflow and has concrete incompatibilities that must be fixed or superseded before Batch 2 sample construction:
  1. its sparse checkout does not include `data_research/institutional-flow/institutional-withdrawal-expansion-protocol-v1.md`, which the future protocol-aware planner must consume or whose identity it must otherwise verify;
  2. its current scheduling uses limited TDCC/Broker stock queues for network-load expansion rather than the Section 4 deterministic coverage-resolution state machine, so it does not yet prove earlier pending candidates cannot be leapfrogged;
  3. its `finalize` step currently asserts `test ! -e data_research/institutional-flow/validation/validation-outcomes-v1.json` and `test ! -e .../validation-metrics-v1.json`. Those Batch 1 canonical artifacts now legitimately exist and must remain immutable, so future outcome-blind expansion must instead prove it does not read, rewrite, stage, or delete them rather than requiring their absence.

Required bounded implementation changes before any Batch 2 sample freeze:

1. provide a versioned protocol-aware future sample planner that encodes `institutional-withdrawal-untouched-expansion-protocol-v1`;
2. permanently exclude development + all prior holdout identities;
3. use the frozen SHA-256 order as sample order;
4. emit `coverage_ready`, `coverage_pending_tdcc`, `coverage_pending_broker`, and the three `coverage_terminal_ineligible_*` states with durable evidence;
5. drive TDCC/Broker work in deterministic candidate order until the first 10 ready stocks are mechanically known, without allowing pending candidates to be bypassed;
6. select at most the next 10 ready stocks without outcome inputs and emit durable evidence proving every earlier candidate was either excluded, prior-frozen, ready-selected, or terminally coverage-ineligible;
7. update/supersede the recovery workflow so the protocol identity is available and validated, physical-batch constraints remain unchanged, and the Section 4 state machine controls queue progression;
8. replace the obsolete "Batch 1 outcome artifacts must not exist" assertions with bounded immutability/non-consumption checks that allow the existing Batch 1 artifacts to remain present while preventing them from influencing candidate order or sample selection.

These changes must remain outcome-blind. The canonical Batch 1 outcome/metrics files may be checked only for immutable path/blob identity or absence from the planner's dependency/read set; their contents must not be consumed to select or order future candidates.

This audit does not authorize running the planner now to reveal Batch 2 identities.

## 12. Protocol immutability

Once this document is committed and independently closed by Prompt B, its universe, ordering seed/algorithm, terminal coverage-resolution rules, batch size, maximum batch count, pooling rule, and stopping rule are frozen for Batch 2-Batch 5. Any change requires a new prospectively preregistered methodology identity before the affected future candidate identities or outcomes are opened.
