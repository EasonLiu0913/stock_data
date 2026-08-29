# Institutional Withdrawal v6.1 — Event Diagnosis

- Fragile distribution events: **10**
- Outcome labels: persistent_withdrawal_consistent=4, absorbed_or_false_positive=2, mixed_short_horizon=1, insufficient_followup=3

## Event table

| Stock | Anchor | Evidence strength | Outcome diagnosis | 5D | 10D | 20D | Max DD |
|---|---|---:|---|---:|---:|---:|---:|
| 2317 | 2026-06-18 | 3 | persistent_withdrawal_consistent | -7.45% | -10.43% | -12.66% | -12.85% |
| 2454 | 2026-06-12 | 5 | persistent_withdrawal_consistent | 6.82% | -6.46% | -12.44% | -12.44% |
| 2382 | 2026-06-18 | 4 | persistent_withdrawal_consistent | -3.72% | 0.27% | -15.96% | -15.96% |
| 2303 | 2026-06-12 | 4 | absorbed_or_false_positive | 19.85% | 22.85% | 13.11% | 4.87% |
| 2303 | 2026-08-07 | 6 | mixed_short_horizon | 4.31% | 0.43% | n/a% | -0.43% |
| 2303 | 2026-08-14 | 4 | insufficient_followup | -3.72% | n/a% | n/a% | -4.55% |
| 2303 | 2026-08-21 | 4 | insufficient_followup | n/a% | n/a% | n/a% | n/a% |
| 2449 | 2026-05-22 | 6 | absorbed_or_false_positive | 10.98% | 4.56% | 14.53% | -8.11% |
| 2449 | 2026-06-18 | 4 | persistent_withdrawal_consistent | -0.16% | 8.59% | -12.32% | -12.32% |
| 2449 | 2026-08-21 | 5 | insufficient_followup | n/a% | n/a% | n/a% | n/a% |

## 2449 timeline

- First persistent-transfer anchor in frozen v6 sample: **2026-05-22**
- First fragile-distribution anchor in frozen v6 sample: **2026-05-22**

| Date | Structure | Transfer streak | Large 2obs Δ | Small 2obs Δ | Broker | Foreign 5D | Sell ratio | Price 5D into anchor | 20D outcome |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2026-05-15 | pressure_without_persistence | 1 | -3.94pp | 3.98pp | 4 | -48663920 | 0.8 | -3.6977% | -5.84% |
| 2026-05-22 | fragile_distribution | 2 | -6.43pp | 7.31pp | 4 | -11126340 | 0.6 | -1.1686% | 14.53% |
| 2026-05-29 | other | 0 | 1.29pp | -0.69pp | 4 | 57510277 | 0.2 | 10.9797% | -6.09% |
| 2026-06-05 | other | 0 | 2.06pp | -2.3pp | 4 | 22044535 | 0.4 | -5.7839% | 13.41% |
| 2026-06-12 | pressure_without_persistence | 1 | -2.41pp | 2.93pp | 3 | -21626910 | 0.8 | -8.8853% | 3.37% |
| 2026-06-18 | fragile_distribution | 2 | -3.08pp | 3.84pp | 4 | 11919203 | 0.6 | 13.4191% | -12.32% |
| 2026-08-07 | other | 0 | -2.13pp | 2.52pp | 3 | -16446417 | 1 | 8.2774% | n/a% |
| 2026-08-14 | pressure_without_persistence | 1 | -0.67pp | 1.31pp | 4 | -20057982 | 0.8 | 2.0661% | n/a% |
| 2026-08-21 | fragile_distribution | 2 | -1.63pp | 1.71pp | 3 | -87572 | 0.4 | -6.0729% | n/a% |

## Interpretation

- `fragile_distribution` is best treated as a state-transition candidate: persistent ownership transfer plus broker supply with weak contemporaneous absorption.
- Event-level outcome labels are descriptive diagnostics only; they do not alter the frozen v6 rules.
- A later public disclosure date must be independently verified before claiming the signal led that disclosure by N days.
