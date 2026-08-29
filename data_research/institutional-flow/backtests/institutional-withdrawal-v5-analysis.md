# Institutional Withdrawal v5 Analysis

- Eligible TDCC-anchored rows: **72** / 126
- Broker+TDCC pressure rows: **13**
- Untouched validation ready from currently archived TDCC history: **no**

## Combination results

| Variant | Obs | 5D n / mean | 10D n / mean | 20D n / mean | 10D edge vs pressure |
|---|---:|---:|---:|---:|---:|
| v4_like_orange | 11 | 8 / 1.96% | 6 / 12.91% | 6 / 7.7% | 0pp |
| broker_tdcc_pressure | 13 | 8 / 1.96% | 6 / 12.91% | 6 / 7.7% | 0pp |
| pressure_plus_foreign | 10 | 5 / -1.18% | 3 / 12.61% | 3 / 9.65% | -0.3pp |
| pressure_plus_tdcc_persistence | 8 | 4 / -3.04% | 2 / 6.57% | 2 / 1.1% | -6.34pp |
| pressure_plus_price_volume | 4 | 2 / 3.06% | 2 / 16.63% | 2 / 7.21% | 3.72pp |
| pressure_plus_two_independent | 9 | 5 / -1.18% | 3 / 12.61% | 3 / 9.65% | -0.3pp |
| pressure_plus_all_three | 2 | 0 / n/a% | 0 / n/a% | 0 / n/a% | n/app |

## Research interpretation

- This table is a **development-sample diagnostic**, not a production scorecard.
- Candidate confirmation families are pre-registered in `data_research/institutional-flow/v5-research-spec.md`; outcomes are kept in a separate matrix object and do not construct features.
- A combination with very few observations is not considered validated even if its average return looks strongly bearish.
- v4 remains a distribution-pressure alert until a candidate survives untouched/walk-forward validation.

## Untouched validation readiness

Minimum archived official TDCC observations before the development range per stock: **0**.
Minimum archived official TDCC observations after the development range per stock: **0**.

Current archived TDCC history does not yet provide a sufficiently broad untouched window for all six stocks. Do not promote any v5 candidate from this development study.
