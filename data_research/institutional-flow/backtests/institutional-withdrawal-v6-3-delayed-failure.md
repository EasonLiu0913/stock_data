# Institutional Withdrawal v6.3 — Delayed Failure Transition

- Fragile events: **10**
- Immediate failures preserved from v6.2: **1**
- Confirmed delayed failures (sessions 11–20): **4**
- No failure within 20 sessions: **1**
- Insufficient follow-up: **4**

## By v6.1 diagnosis

| v6.1 diagnosis | Events | Immediate | Delayed | Total confirmed | Confirmation rate | Mean sessions |
|---|---:|---:|---:|---:|---:|---:|
| persistent_withdrawal_consistent | 4 | 1 | 3 | 4 | 1 | 14.25 |
| absorbed_or_false_positive | 2 | 0 | 1 | 1 | 0.5 | 11 |
| mixed_short_horizon | 1 | 0 | 0 | 0 | 0 | n/a |
| insufficient_followup | 3 | 0 | 0 | 0 | 0 | n/a |

## Event transitions

| Stock | Fragile anchor | v6.1 diagnosis | v6.3 status | Transition | Session | Path | Return | Peak gain | DD from peak | Supply |
|---|---|---|---|---|---:|---|---:|---:|---:|---|
| 2317 | 2026-06-18 | persistent_withdrawal_consistent | immediate_failure_preserved | 2026-06-26 | 5 | - | n/a% | n/a% | n/a% | - |
| 2454 | 2026-06-12 | persistent_withdrawal_consistent | confirmed_delayed_failure | 2026-07-08 | 17 | rebound_failure | -4.43% | 9.09% | -12.39% | foreign |
| 2382 | 2026-06-18 | persistent_withdrawal_consistent | confirmed_delayed_failure | 2026-07-17 | 19 | delayed_breakdown | -13.43% | 1.33% | -14.57% | broker+ownership |
| 2303 | 2026-06-12 | absorbed_or_false_positive | no_failure_within_20_sessions | - | - | - | n/a% | n/a% | n/a% | - |
| 2303 | 2026-08-07 | mixed_short_horizon | insufficient_followup | - | - | - | n/a% | n/a% | n/a% | - |
| 2303 | 2026-08-14 | insufficient_followup | insufficient_followup | - | - | - | n/a% | n/a% | n/a% | - |
| 2303 | 2026-08-21 | insufficient_followup | insufficient_followup | - | - | - | n/a% | n/a% | n/a% | - |
| 2449 | 2026-05-22 | absorbed_or_false_positive | confirmed_delayed_failure | 2026-06-08 | 11 | rebound_failure | -2.53% | 14.36% | -14.77% | broker |
| 2449 | 2026-06-18 | persistent_withdrawal_consistent | confirmed_delayed_failure | 2026-07-14 | 16 | rebound_failure | -5.51% | 13.78% | -16.95% | foreign+broker+ownership |
| 2449 | 2026-08-21 | insufficient_followup | insufficient_followup | - | - | - | n/a% | n/a% | n/a% | - |

## 2449

- 2026-05-22: confirmed_delayed_failure; 2026-06-08 session 11, path=rebound_failure; v6.1=absorbed_or_false_positive.
- 2026-06-18: confirmed_delayed_failure; 2026-07-14 session 16, path=rebound_failure; v6.1=persistent_withdrawal_consistent.
- 2026-08-21: insufficient_followup; v6.1=insufficient_followup.

## Guardrails

- v6.3 is a separately pre-registered delayed-transition hypothesis; v6.2 thresholds remain frozen.
- No v6.1 outcome label constructs a trigger.
- Development-sample research only; no production promotion from this result.
