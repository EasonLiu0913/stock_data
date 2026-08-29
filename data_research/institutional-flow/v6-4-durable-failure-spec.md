# Institutional Withdrawal v6.4 — Durable Failure Confirmation

## Status

Pre-registered development-sample diagnostic. v6.2 and v6.3 candidate-failure rules remain frozen.

## Research question

Can persistence after a candidate failure distinguish durable absorption failure from a temporary shakeout?

## Frozen inputs

- v6.3 candidate lifecycle: `institutional-withdrawal-v6-3-delayed-failure-transition-v1`
- v6 weekly ownership / Broker state: `institutional-withdrawal-v6-persistent-transfer-distribution-absorption-v1`
- daily price-volume: `institutional-withdrawal-v5-price-volume-features-v3-source-derived-calendar-gap-preserving`
- daily foreign-flow: `institutional-withdrawal-v5-foreign-flow-features-v2-source-derived-calendar`

No v6.1 outcome label may construct the rule. Outcome labels are attached only after durability classification.

## Candidate population

Evaluate only events already classified by frozen v6.3 as either:

- `immediate_failure_preserved`, or
- `confirmed_delayed_failure`.

Events without a candidate failure are not promoted by v6.4.

## Persistence window

For each candidate failure date, inspect the **next 3 source-derived trading sessions after the candidate day**. The candidate day itself does not count as a persistence vote.

If fewer than 3 future trading sessions exist, classify as `insufficient_persistence_followup`.

## Broken-state definition

Use the frozen candidate path and anchor close.

A post-candidate session is considered `broken_state=true` when either:

1. **anchor breakdown persists**: close remains at least 2% below the fragile anchor close; or
2. **failed-rebound structure persists**: the event previously achieved at least +5% running peak gain from the fragile anchor, and the current close remains at least 8% below that established post-anchor running peak while not recovering above +1% versus the fragile anchor.

The running peak is frozen from data available through the candidate date and may only increase with subsequent observed prices; no future extrema are backfilled into prior sessions.

## Supply confirmation during persistence

A persistence-window session has `supply_confirm=true` if at least one contemporaneously available family is active:

- foreign 5-session total net < 0 and sell ratio >= 0.6; or
- latest available v6 Broker score >= 3; or
- latest available v6 persistent ownership transfer remains true.

## Durable confirmation rule

`durable_failure_confirmed` requires both:

- at least **2 of the next 3 sessions** have `broken_state=true`; and
- at least **1 of those 3 sessions** has `supply_confirm=true`.

Otherwise classify as `candidate_failure_not_durable`.

## Primary diagnostic target

Descriptively compare frozen v6.1 labels after classification:

- desired: preserve 2317/2026-06-18, 2454/2026-06-12, 2382/2026-06-18, and 2449/2026-06-18;
- desired false-positive filter: reject the v6.3 candidate from 2449/2026-05-22;
- do not alter thresholds if the desired separation is not achieved.

## Guardrails

- Development-sample research only.
- Historical TDCC remains association-only because original publication timestamps are unknown.
- No production promotion without untouched / walk-forward validation.
- v6.4 may validate or reject durability of an existing candidate only; it cannot create a new failure candidate.
