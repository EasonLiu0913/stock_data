# Institutional Withdrawal v6.3 — Delayed Failure Transition Spec

## Purpose

v6.2 is frozen as an immediate-failure study over sessions 1–10 after a `fragile_distribution` anchor. v6.3 tests a separate hypothesis: some persistent institutional-withdrawal cases pass through an absorption/rebound phase and only fail during sessions 11–20.

This is development-sample research only. The v6.1 outcome labels are diagnostic targets and MUST NOT construct the delayed-failure rule.

## Eligible events

Only v6.2 events with status `no_failure_within_10_sessions` are eligible for delayed-transition classification. Existing v6.2 `confirmed_failure_transition` events remain immediate failures and are not reclassified. Events without enough future sessions are reported as insufficient follow-up.

## Frozen observation window

- Immediate window: sessions 1–10 (owned by frozen v6.2).
- Delayed window: sessions 11–20 after the fragile anchor.
- Missing OHLCV rows remain missing; sessions are based on the frozen source-derived trading calendar and are never compressed or imputed.

## Supply confirmation

At a candidate delayed-transition date, at least one contemporaneous supply condition must be true:

1. `foreign_supply`: frozen daily foreign 5-session rolling total net < 0 AND sell ratio >= 0.60; OR
2. `broker_supply`: latest available weekly v6 Broker score >= 3; OR
3. `ownership_supply`: latest available weekly v6 state still has `persistent_transfer=true`.

The original fragile anchor establishes regime context but does not, by itself, satisfy delayed supply confirmation.

## Delayed-failure paths

A candidate in sessions 11–20 is classified as `confirmed_delayed_failure` when supply confirmation is true and either path A or B is true.

### Path A — delayed breakdown

- return from fragile-anchor close <= -10.0%.

### Path B — rebound failure

All must be true:

- running post-anchor peak gain >= +5.0%;
- drawdown from that running peak <= -10.0%;
- current return from fragile-anchor close <= -2.0%.

This path is intended to detect an absorption/rebound phase that later fails rather than treating the rebound itself as confirmation.

## Earliest-date rule

For each eligible event, record the earliest session 11–20 satisfying the frozen rule. Do not choose a later date because it produces a larger subsequent decline.

## Diagnostic comparison

After classification, compare delayed transitions against frozen v6.1 labels:

- `persistent_withdrawal_consistent`
- `absorbed_or_false_positive`
- `mixed_short_horizon`
- `insufficient_followup`

The key descriptive question is whether delayed failure improves sensitivity for persistent-withdrawal cases without promoting the known absorbed/false-positive cases.

## Guardrails

- No v6.1 outcome field may be read by the rule-construction path.
- No future return beyond the candidate transition date may construct a trigger.
- Historical TDCC remains association-only because original publication timestamps are unknown.
- No production promotion from this development sample; untouched/walk-forward validation remains mandatory.
