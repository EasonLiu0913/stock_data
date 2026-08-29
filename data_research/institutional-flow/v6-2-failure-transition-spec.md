# Institutional Withdrawal v6.2 — Fragile → Failure Transition

## Goal

Identify the earliest **daily** date after a frozen v6 `fragile_distribution` anchor when contemporaneous evidence supports the interpretation that market absorption is failing while institutional supply remains present.

This is a research-only development diagnostic. It does **not** change v6 classifications and it is not production-safe.

## Frozen inputs

- v6.1 fragile events: `institutional-withdrawal-v6-1-event-diagnosis.json`
- v6 ownership/supply states: `institutional-withdrawal-v6-distribution-absorption.json`
- daily price/volume features: `price-volume-v5.json`
- daily foreign-flow features: `foreign-flow-v5.json`

No future outcome field may construct a failure transition.

## Daily price-failure states

For each fragile anchor, inspect the next **10 source-derived trading sessions** (excluding the anchor session):

1. `price_breakdown`
   - close return from fragile-anchor close <= **-5%**.

2. `failed_rebound`
   - the post-anchor running peak first reached at least **+3%** versus the fragile-anchor close; and
   - current close is <= **-2%** versus the fragile-anchor close; and
   - current close is at least **5% below** that post-anchor running peak.

These conditions are frozen before reviewing v6.2 outcomes.

## Supply confirmation

A price-failure state is not enough by itself. At least one contemporaneous supply confirmation must also be present:

- `foreign_supply`:
  - foreign 5D net < 0; and
  - foreign 5D sell ratio >= **0.6**.

- `ownership_supply_state`:
  - the latest available v6 TDCC anchor on or before the daily date still has `persistent_transfer = true`; and
  - latest Broker score >= **3**.

The latest weekly TDCC state may remain the fragile anchor until a newer TDCC observation exists; it is never forward-filled from a future observation.

## Failure transition

The earliest daily date is `failure_transition_date` when either:

- `price_breakdown && (foreign_supply || ownership_supply_state)`; or
- `failed_rebound && (foreign_supply || ownership_supply_state)`.

A transition is classified as:

- `confirmed_failure_transition`: rule triggered within available 10-session window.
- `no_failure_within_10_sessions`: ten future sessions exist but no rule triggered.
- `insufficient_followup`: fewer than ten future sessions exist and no rule triggered.

## Diagnostic outputs

For each fragile event report:

- fragile anchor date and close;
- earliest transition date;
- trading-session lead from fragile anchor to transition;
- trigger type (`price_breakdown`, `failed_rebound`, or both);
- foreign supply state at transition;
- latest available TDCC transfer streak / Broker score at transition;
- close return from fragile anchor at transition;
- running peak gain and drawdown from that peak;
- v6.1 descriptive outcome label (reported after classification, never used to construct it).

## Research questions

1. Do the four v6.1 `persistent_withdrawal_consistent` events produce a transition earlier/more often than absorbed or false-positive events?
2. Does `failed_rebound` distinguish cases such as 2454/2449 where price initially rallies after fragile distribution?
3. For 2449, what is the earliest date when supply plus price failure coexist?

## Guardrails

- Broker branches do not identify beneficial owners.
- Historical TDCC publication timestamps are unknown; TDCC remains association-only historical research.
- The same development sample has already been inspected. No v6.2 rule may be promoted without untouched/walk-forward validation.
