# Institutional Withdrawal v6.5 — Recovery / Reclaim Diagnosis

- Frozen v6.4 durable candidates: **5**
- Confirmed reclaim: **1**
- No reclaim within 15 sessions: **4**
- Insufficient recovery follow-up: **0**

## Candidates

| Stock | Fragile anchor | Candidate | v6.1 diagnosis | Recovery status | Reclaim date | Price repair | Relief families | Trough vs anchor | Max rebound from trough | End vs anchor |
|---|---|---|---|---|---|---|---:|---:|---:|---:|
| 2317 | 2026-06-18 | 2026-06-26 | persistent_withdrawal_consistent | no_reclaim_within_15_sessions | - | - | - | -12.85% | 0.21% | -12.66% |
| 2454 | 2026-06-12 | 2026-07-08 | persistent_withdrawal_consistent | no_reclaim_within_15_sessions | - | - | - | -24.64% | 2.7% | -22.61% |
| 2382 | 2026-06-18 | 2026-07-17 | persistent_withdrawal_consistent | no_reclaim_within_15_sessions | - | - | - | -25.8% | 8.96% | -20.74% |
| 2449 | 2026-05-22 | 2026-06-08 | absorbed_or_false_positive | confirmed_reclaim | 2026-06-22 | 2/3 | 2 | -8.11% | 24.63% | 14.02% |
| 2449 | 2026-06-18 | 2026-07-14 | persistent_withdrawal_consistent | no_reclaim_within_15_sessions | - | - | - | -34.04% | 20.64% | -20.42% |

## By v6.1 diagnosis

| Diagnosis | Candidates | Reclaimed | No reclaim | Insufficient | Reclaim rate | Mean reclaim session |
|---|---:|---:|---:|---:|---:|---:|
| persistent_withdrawal_consistent | 4 | 0 | 4 | 0 | 0 | n/a |
| absorbed_or_false_positive | 1 | 1 | 0 | 0 | 1 | 9 |

## Guardrails

- Reclaim requires repeated price repair and at least two supply-relief families in the same 3-session window.
- v6.1 outcome labels do not construct the rule.
- Development-sample research only.
