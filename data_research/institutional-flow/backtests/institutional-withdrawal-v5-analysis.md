# Institutional Withdrawal v5 Analysis

- Eligible TDCC-anchored rows: **54** / 126
- Broker+TDCC pressure rows: **9**
- Untouched validation ready from currently archived TDCC history: **no**

## Combination results

| Variant | Obs | 5D n / mean | 10D n / mean | 20D n / mean | 10D edge vs pressure |
|---|---:|---:|---:|---:|---:|
| v4_like_orange | 8 | 8 / 4.61% | 7 / 11.13% | 6 / 7.7% | 0pp |
| broker_tdcc_pressure | 9 | 8 / 4.61% | 7 / 11.13% | 6 / 7.7% | 0pp |
| pressure_plus_foreign | 5 | 5 / 3.07% | 4 / 9.56% | 3 / 9.65% | -1.57pp |
| pressure_plus_tdcc_persistence | 4 | 3 / 5.04% | 3 / 4.53% | 2 / 1.1% | -6.6pp |
| pressure_plus_price_volume | 3 | 3 / 3.47% | 3 / 11.23% | 2 / 7.21% | 0.1pp |
| pressure_plus_two_independent | 4 | 4 / 5.35% | 4 / 9.56% | 3 / 9.65% | -1.57pp |
| pressure_plus_all_three | 1 | 1 / 4.31% | 1 / 0.43% | 0 / n/a% | -10.7pp |

## Research interpretation

- This table is a **development-sample diagnostic**, not a production scorecard.
- Candidate confirmation families are pre-registered in `data_research/institutional-flow/v5-research-spec.md`; outcomes are kept in a separate matrix object and do not construct features.
- A combination with very few observations is not considered validated even if its average return looks strongly bearish.
- v4 remains a distribution-pressure alert until a candidate survives untouched/walk-forward validation.

## Untouched validation readiness

Minimum archived official TDCC observations before the development range per stock: **0**.
Minimum archived official TDCC observations after the development range per stock: **0**.

Current archived TDCC history does not yet provide a sufficiently broad untouched window for all six stocks. Do not promote any v5 candidate from this development study.
