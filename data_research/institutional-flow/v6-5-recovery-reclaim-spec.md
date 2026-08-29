# Institutional Withdrawal v6.5 — Recovery / Reclaim Diagnosis

## Status

Pre-registered development-sample hypothesis. This study does not modify v6.2, v6.3, or v6.4.

## Research question

After a frozen v6.3 candidate failure has also passed v6.4's 3-session durability check, can subsequent **price reclaim plus supply relief** distinguish a repaired/absorbed structure from durable institutional distribution failure?

The hypothesis is that a genuine recovery requires more than a short rebound. Demand must both repair price structure and coincide with meaningful easing in the contemporaneous supply state.

## Frozen candidate universe

Only the five existing v6.4 `durable_failure_confirmed` candidates are eligible. v6.5 cannot create new failure candidates.

## Observation window

- Candidate failure day = session 0.
- Sessions 1–3 are the frozen v6.4 persistence window and are not eligible to form a reclaim confirmation.
- Recovery/reclaim is searched during sessions **4–15** after the candidate failure.
- If fewer than 15 source-derived trading sessions are available after the candidate, status is `insufficient_recovery_followup` unless a reclaim can already be confirmed from a complete 3-session repair window.

## Price repair rule

For every rolling 3-session window beginning on or after session 4:

- `anchor_reclaim_vote = close >= fragile_anchor_close`.
- A price repair window requires at least **2 of 3** sessions with `anchor_reclaim_vote=true`.

This deliberately requires repeated reclaim rather than a one-day touch.

## Supply-relief families

Each session independently evaluates three current/prior-only relief families:

1. **Foreign relief**
   - rolling 5D total net flow >= 0, OR
   - rolling 5D foreign sell ratio <= 0.4.

2. **Broker relief**
   - latest available frozen weekly Broker score <= 2.

3. **Ownership-transfer relief**
   - latest available frozen weekly v6 `persistent_transfer=false`.

A repair window has `supply_relief_confirmed=true` when at least **2 of the 3 relief families are observed at least once within the same 3-session window**.

## Reclaim classification

`confirmed_reclaim` requires BOTH:

- price repair: at least 2/3 closes at or above the fragile anchor in the same 3-session repair window;
- supply relief: at least 2 of 3 supply-relief families observed within that same window.

The reclaim date is the final date of the first 3-session window satisfying both conditions.

If no such window exists through session 15, classify `no_reclaim_within_15_sessions`.

## Diagnostics

For every candidate record:

- candidate and fragile-anchor dates;
- candidate path and frozen v6.1 outcome label (attached only after classification);
- post-candidate trough and max rebound from trough;
- first one-day anchor reclaim;
- first confirmed 2-of-3 anchor repair window;
- first confirmed reclaim window;
- foreign/broker/ownership relief details;
- close at the end of the observation window relative to the fragile anchor.

## Guardrails

- v6.1 outcome labels never construct a reclaim rule.
- No thresholds are changed after observing results.
- Historical TDCC remains association-only because original publication timestamps are unknown.
- This is development-sample research only and cannot be promoted to production without untouched/walk-forward validation.
