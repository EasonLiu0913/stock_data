# Institutional Withdrawal v6 — Persistent Transfer & Distribution/Absorption

## Research question

Can persistent ownership transfer in TDCC, combined with broker selling pressure, distinguish long-term institutional withdrawal from temporary selling pressure? When selling pressure is present, does contemporaneous price/volume absorption identify "institutions are exiting but the market is still absorbing supply" before a later breakdown?

## Development sample

- Universe: `2330,2317,2454,2382,2303,2449`
- Range: `2026-04-01` to `2026-08-21`
- Input: frozen v5 TDCC-anchored feature matrix.
- Historical TDCC remains association-only research because original publication timestamps are unknown.
- No v6 result is production-safe without untouched / walk-forward validation.

## Pre-registered feature definitions

All features below use information at or before the TDCC anchor's mapped market feature date. Forward 5D/10D/20D returns are outcomes only and never construct a feature.

### A. Persistent TDCC transfer

`persistent_transfer` is true when all are true:

1. large-holder percentage declined for at least 2 consecutive TDCC observations;
2. small-holder percentage increased for at least 2 consecutive TDCC observations;
3. the 2-observation large-holder change is negative;
4. the 2-observation small-holder change is positive.

`strong_persistent_transfer` additionally requires either:

- 2-observation large-holder change <= -1.0 percentage point, or
- 2-observation small-holder change >= +1.0 percentage point, or
- transfer streak >= 3 observations.

### B. Distribution pressure

`broker_pressure` requires v5 broker pressure confirmation (`broker.score >= 3`).

`withdrawal_pressure` requires both `broker_pressure` and `persistent_transfer`.

### C. Contemporaneous absorption structure

Absorption is evaluated only from pre-anchor / anchor-date price-volume features.

`strong_absorption` requires at least 3 of:

- absorption days over 10 sessions >= 2;
- distribution days over 10 sessions >= 2 (meaning meaningful supply is actually being offered);
- 20-day volume ratio >= 1.0;
- prior 10-session return >= -2%;
- close is within 8% of the prior 20-session high.

`weak_absorption` means `strong_absorption` is false and at least 2 of:

- distribution days over 10 sessions >= 3;
- absorption days over 10 sessions <= 1;
- prior 10-session return <= -5%;
- close is more than 10% below the prior 20-session high.

The structure labels are:

- `absorbed_distribution`: withdrawal pressure + strong absorption;
- `fragile_distribution`: withdrawal pressure + weak absorption;
- `unclassified_distribution`: withdrawal pressure without either state;
- `pressure_without_persistence`: broker/TDCC pressure exists but persistent transfer does not;
- `persistent_transfer_without_broker_pressure`: persistent TDCC transfer without broker-pressure confirmation.

## Diagnostics

For each event, record:

- stock and TDCC / market dates;
- one- and two-observation TDCC changes and transfer streak;
- broker pressure metrics;
- foreign-flow context;
- contemporaneous price/volume absorption inputs;
- structure classification;
- forward 5D/10D/20D outcomes and 20-session path drawdown / gain.

## Comparisons

At minimum compare:

1. all v5 analysis-eligible anchors;
2. v5 broker+TDCC pressure;
3. persistent TDCC transfer;
4. withdrawal pressure (broker pressure + persistent transfer);
5. absorbed distribution;
6. fragile distribution;
7. strong persistent transfer + broker pressure;
8. withdrawal pressure + foreign confirmation.

Report observation counts and 5D/10D/20D mean, median, negative rate, <= -5% rate, and path-based maximum drawdown/gain. Small-n results remain descriptive only.

## Promotion rule

This development study may identify candidates, not promote a production signal. Production promotion requires a separately frozen rule and untouched / walk-forward validation with matching TDCC, broker, foreign-flow and OHLCV coverage.
