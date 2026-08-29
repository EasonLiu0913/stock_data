# Institutional Withdrawal v6.2 — Fragile → Failure Transition

- Fragile events: **10**
- Confirmed failure transitions: **1**
- No failure within 10 sessions: **6**
- Insufficient follow-up: **3**

## By v6.1 outcome label

| v6.1 diagnosis | Events | Confirmed | Confirmation rate | Mean sessions to transition |
|---|---:|---:|---:|---:|
| persistent_withdrawal_consistent | 4 | 1 | 0.25 | 5 |
| absorbed_or_false_positive | 2 | 0 | 0 | n/a |
| mixed_short_horizon | 1 | 0 | 0 | n/a |
| insufficient_followup | 3 | 0 | 0 | n/a |

## Event transitions

| Stock | Fragile anchor | v6.1 diagnosis | Status | Transition | Sessions | Trigger | Return at transition | Peak gain | DD from peak |
|---|---|---|---|---|---:|---|---:|---:|---:|
| 2317 | 2026-06-18 | persistent_withdrawal_consistent | confirmed_failure_transition | 2026-06-26 | 5 | breakdown+ownership+broker | -7.45% | 0% | -7.45% |
| 2454 | 2026-06-12 | persistent_withdrawal_consistent | no_failure_within_10_sessions | - | - | - | n/a% | n/a% | n/a% |
| 2382 | 2026-06-18 | persistent_withdrawal_consistent | no_failure_within_10_sessions | - | - | - | n/a% | n/a% | n/a% |
| 2303 | 2026-06-12 | absorbed_or_false_positive | no_failure_within_10_sessions | - | - | - | n/a% | n/a% | n/a% |
| 2303 | 2026-08-07 | mixed_short_horizon | no_failure_within_10_sessions | - | - | - | n/a% | n/a% | n/a% |
| 2303 | 2026-08-14 | insufficient_followup | insufficient_followup | - | - | - | n/a% | n/a% | n/a% |
| 2303 | 2026-08-21 | insufficient_followup | insufficient_followup | - | - | - | n/a% | n/a% | n/a% |
| 2449 | 2026-05-22 | absorbed_or_false_positive | no_failure_within_10_sessions | - | - | - | n/a% | n/a% | n/a% |
| 2449 | 2026-06-18 | persistent_withdrawal_consistent | no_failure_within_10_sessions | - | - | - | n/a% | n/a% | n/a% |
| 2449 | 2026-08-21 | insufficient_followup | insufficient_followup | - | - | - | n/a% | n/a% | n/a% |

## 2449 timeline result

- 2449 fragile 2026-05-22: no_failure_within_10_sessions; v6.1=absorbed_or_false_positive.
- 2449 fragile 2026-06-18: no_failure_within_10_sessions; v6.1=persistent_withdrawal_consistent.
- 2449 fragile 2026-08-21: insufficient_followup; v6.1=insufficient_followup.

## Interpretation guardrails

- A transition requires price failure plus contemporaneous supply confirmation; neither price decline nor institutional selling alone is sufficient.
- v6.1 outcome labels are diagnostic only and do not feed the transition rule.
- This remains development-sample research, not a production signal.
