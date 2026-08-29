# Institutional Withdrawal v6.4 — Durable Failure Confirmation

- Existing v6.3 failure candidates: **5**
- Durable confirmations: **5**
- Candidate failures rejected as non-durable: **0**
- Insufficient persistence follow-up: **0**

## Candidates

| Stock | Fragile anchor | Candidate date | v6.1 diagnosis | Candidate path | Durability | Broken votes | Supply votes |
|---|---|---|---|---|---|---:|---:|
| 2317 | 2026-06-18 | 2026-06-26 | persistent_withdrawal_consistent | immediate | durable_failure_confirmed | 3/3 | 3/3 |
| 2454 | 2026-06-12 | 2026-07-08 | persistent_withdrawal_consistent | rebound_failure | durable_failure_confirmed | 3/3 | 3/3 |
| 2382 | 2026-06-18 | 2026-07-17 | persistent_withdrawal_consistent | delayed_breakdown | durable_failure_confirmed | 3/3 | 3/3 |
| 2449 | 2026-05-22 | 2026-06-08 | absorbed_or_false_positive | rebound_failure | durable_failure_confirmed | 3/3 | 3/3 |
| 2449 | 2026-06-18 | 2026-07-14 | persistent_withdrawal_consistent | rebound_failure | durable_failure_confirmed | 2/3 | 3/3 |

## By v6.1 diagnosis

| Diagnosis | Candidates | Durable | Rejected | Insufficient | Durability rate |
|---|---:|---:|---:|---:|---:|
| persistent_withdrawal_consistent | 4 | 4 | 0 | 0 | 1 |
| absorbed_or_false_positive | 1 | 1 | 0 | 0 | 1 |

## Guardrails

- Candidate day is not counted as a persistence vote.
- At least 2/3 following sessions must remain broken, and at least 1/3 must retain contemporaneous supply confirmation.
- Outcomes do not construct the rule.
- Development-sample research only.
