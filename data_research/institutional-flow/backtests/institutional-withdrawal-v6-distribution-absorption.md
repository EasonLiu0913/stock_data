# Institutional Withdrawal v6 — Persistent Transfer & Distribution/Absorption

- Analysis-eligible TDCC anchors: **54**
- v5 Broker+TDCC pressure anchors: **9**
- Persistent TDCC transfer anchors: **14**
- Withdrawal-pressure anchors (broker + persistent TDCC): **13**
- Absorbed distribution: **1**
- Fragile distribution: **10**

## Comparison

| Group | Obs | 5D n / mean | 10D n / mean | 20D n / mean | 10D edge vs v5 pressure | Mean max DD 20D |
|---|---:|---:|---:|---:|---:|---:|
| all_eligible | 54 | 48 / 2.52% | 42 / 5.14% | 36 / 3.26% | -5.99pp | -5.95% |
| v5_pressure_baseline | 9 | 8 / 4.61% | 7 / 11.13% | 6 / 7.7% | 0pp | -6.22% |
| persistent_tdcc_transfer | 14 | 12 / 3.63% | 11 / 3.2% | 10 / -1.95% | -7.93pp | -6.25% |
| withdrawal_pressure | 13 | 11 / 4.21% | 10 / 3.14% | 9 / -1.72% | -7.99pp | -5.93% |
| absorbed_distribution | 1 | 1 / 15.19% | 1 / 9.73% | 1 / 8.26% | -1.4pp | 6.78% |
| fragile_distribution | 10 | 8 / 3.36% | 7 / 2.83% | 6 / -4.29% | -8.3pp | -7.72% |
| strong_persistent_transfer_plus_broker | 9 | 7 / 7.61% | 6 / 6.62% | 5 / 2.23% | -4.51pp | -3.74% |
| withdrawal_pressure_plus_foreign | 6 | 6 / 6.33% | 6 / 2.23% | 5 / 1.14% | -8.9pp | -5.06% |
| pressure_without_persistence | 5 | 5 / 4.35% | 4 / 16.08% | 4 / 11% | 4.95pp | -5.79% |
| persistent_transfer_without_broker_pressure | 1 | 1 / -2.79% | 1 / 3.84% | 1 / -4.07% | -7.29pp | -9.77% |

## Interpretation guardrails

- This is a development-sample diagnostic. Negative return edge, higher future negative-rate, or deeper future drawdown are consistent with the withdrawal hypothesis, but are not sufficient for production promotion.
- `absorbed_distribution` explicitly means supply is present while contemporaneous price/volume still shows absorption; it is not expected to imply immediate price decline.
- `fragile_distribution` is the candidate structure most consistent with supply overwhelming demand, but small sample sizes must remain descriptive.
- Outcomes never construct the classifications above.

## Descriptive candidate ranking

- withdrawal_pressure_plus_foreign: obs=6, 10D n=6, mean=2.23%, edge vs pressure=-8.9pp, mean max DD20=-5.06%
- fragile_distribution: obs=10, 10D n=7, mean=2.83%, edge vs pressure=-8.3pp, mean max DD20=-7.72%
- withdrawal_pressure: obs=13, 10D n=10, mean=3.14%, edge vs pressure=-7.99pp, mean max DD20=-5.93%
- persistent_tdcc_transfer: obs=14, 10D n=11, mean=3.2%, edge vs pressure=-7.93pp, mean max DD20=-6.25%
- strong_persistent_transfer_plus_broker: obs=9, 10D n=6, mean=6.62%, edge vs pressure=-4.51pp, mean max DD20=-3.74%
- pressure_without_persistence: obs=5, 10D n=4, mean=16.08%, edge vs pressure=4.95pp, mean max DD20=-5.79%
