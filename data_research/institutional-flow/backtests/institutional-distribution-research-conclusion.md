# Institutional Distribution Research Conclusion

## Scope

- Universe: `2330,2317,2454,2382,2303,2449`
- Research range: `2026-04-01` through `2026-08-21`
- TDCC coverage: 21 official historical observations per stock, 126/126 valid stock-date observations.
- HiStock broker coverage: 85 trading days per stock, 510/510 valid stock-date observations.
- Current score: `institutional-distribution-score-v4`.
- Evidence families in v4: Broker branch persistence + TDCC ownership-distribution change only.
- Foreign flow is **not** part of v4 and must not be implied in v4 conclusions.
- Historical TDCC publication timestamps are unavailable. This study is association-only research and is not executable historical P&L.

## Main conclusion

**v4 is not validated as a detector of “large long-term institutions are withdrawing.”**

The evidence supports a narrower interpretation:

> v4 is an **institutional selling-pressure / distribution-risk alert**.

The Orange threshold is sensitive to strong short-term broker selling combined with even mild TDCC deterioration. That combination often identifies pressure, but it does not reliably distinguish persistent long-term distribution from temporary selling pressure or subsequent price recovery.

Broker branches must also not be treated as beneficial-owner identities. A branch-level pattern can support a distribution-risk hypothesis but cannot identify an insurer, foreign institution, or other specific long-term owner by itself.

## Full event sample

The official historical backtest produced 10 independent Orange/Red events.

| Stock | TDCC observed date | Score | Broker | TDCC | 5D | 10D | 20D | Diagnostic class |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| 2317 | 2026-07-03 | 5 | 4 | 1 | -1.66% | -2.49% | +5.20% | temporary_pressure |
| 2382 | 2026-05-22 | 5 | 4 | 1 | +7.28% | +23.58% | +20.25% | false_positive |
| 2382 | 2026-07-31 | 5 | 4 | 1 | n/a | n/a | n/a | insufficient_followup |
| 2303 | 2026-06-05 | 6 | 4 | 2 | +1.52% | +21.67% | +26.24% | false_positive |
| 2303 | 2026-07-24 | 5 | 4 | 1 | -5.47% | n/a | n/a | mixed / short follow-up |
| 2449 | 2026-04-17 | 6 | 4 | 2 | +4.00% | +20.91% | +7.27% | false_positive |
| 2449 | 2026-05-15 | 11 | 4 | 7 | -1.17% | +9.68% | -5.84% | sustained_distribution |
| 2449 | 2026-06-12 | 7 | 3 | 4 | +20.21% | +9.40% | +3.37% | false_positive |
| 2449 | 2026-07-09 | 5 | 3 | 2 | -7.13% | -12.16% | n/a | sustained_distribution |
| 2449 | 2026-07-24 | 8 | 4 | 4 | -17.53% | n/a | n/a | mixed / short follow-up |

Classification counts:

- sustained_distribution: 2
- false_positive: 4
- temporary_pressure: 1
- mixed / insufficient long follow-up: 2
- insufficient_followup: 1

The two outcome-consistent sustained events are both `2449`. Therefore the present sample does **not** demonstrate cross-stock generalization of a long-term-withdrawal detector.

“sustained_distribution” is an outcome label based on subsequent price behavior. It is not proof of beneficial-owner identity or proof that a life insurer was the seller.

## Aggregate behavior

Full v4 event results versus the TDCC-observation baseline:

- 5D: signal mean `+0.01%` vs baseline `+3.21%`, bearish edge `-3.20pp`; negative rate `55.6%` vs `41.2%`.
- 10D: signal mean `+10.08%` vs baseline `+6.06%`, bearish edge **`+4.02pp`**; negative rate `28.6%` vs `37.5%`.
- 20D: signal mean `+9.41%` vs baseline `+13.60%`, bearish edge `-4.19pp`; negative rate `16.7%` vs `32.1%`.

This is not a monotonic withdrawal signature. The dominant observed shape is closer to:

`selling pressure / weak relative behavior → possible sharp rebound → later relative underperformance in some cases`.

The 10D result is especially important: a bearish confirmation system should not be promoted when its signal sample outperforms the baseline by about 4pp at that horizon.

## Factor attribution

### Broker is necessary for the current Orange design but is not discriminative enough

Broker v4 has four one-point conditions:

1. daily negative breadth >= 8
2. daily negative net <= -6000
3. persistent 5D sellers >= 5
4. persistent 5D net <= -8000

At the 10 full-score events:

- 8/10 have Broker score 4/4.
- 2/10 have Broker score 3/4.
- All 10 have a positive TDCC contribution.

Because Broker can contribute at most 4 points while Orange starts at 5, **Broker-only can never create an Orange event under the current threshold**. The full re-detection ablation confirms zero broker-only Orange/Red events.

Strong broker selling therefore says “selling pressure exists,” but it does not separate sustained distribution from rebound-prone pressure. For example:

- `2303 2026-06-05`: Broker 4/4, TDCC 2, then +21.67% over 10D and +26.24% over 20D.
- `2449 2026-04-17`: Broker 4/4, TDCC 2, then +20.91% over 10D.
- `2382 2026-05-22`: Broker 4/4, TDCC 1, then +23.58% over 10D.

### TDCC adds structural information, but one-week change alone is not sufficient

Examples:

- `2449 2026-05-15`: large holders -5.60pp, small holders +5.78pp, TDCC score 7. This is the strongest ownership-transfer event and is outcome-consistent with sustained distribution at the available horizons.
- `2449 2026-06-12`: large holders -2.35pp, small holders +3.01pp, TDCC score 4, yet the stock rose +20.21% over 5D and +9.40% over 10D.
- `2449 2026-07-09`: large holders -1.43pp, small holders +1.41pp, TDCC score 2, followed by -7.13% over 5D and -12.16% over 10D.

Therefore neither “TDCC score >= 4” nor a simple large-holder one-week threshold cleanly separates sustained decline from rebound.

A two- or three-week TDCC decline is also not sufficient by itself: 2449 showed multi-week large-holder deterioration before both successful and false-positive alerts.

## Ablation result

The full re-detection ablation does not reveal one bad Broker subfactor that can simply be removed:

- full: 10 events; 10D mean +10.08%
- broker_only: 0 events by construction under the Orange >=5 threshold
- tdcc_only: 1 event
- without daily breadth: 5 events; 10D mean +15.41%
- without daily net: 6 events; 10D mean +9.90%
- without persistent 5D sellers: 5 events; 10D mean +15.41%
- without persistent 5D net: 5 events; 10D mean +15.41%

Removing a Broker component generally makes the 10D bearish behavior worse rather than better. The core problem is therefore not a single defective Broker factor; it is the semantic leap from “distribution pressure” to “long-term withdrawal confirmation.”

## Red versus Orange

The two Red events are:

- `2449 2026-05-15`, score 11: 5D -1.17%, 20D -5.84%, but with a +13.02% maximum interim gain.
- `2449 2026-07-24`, score 8: 5D -17.53% and a -24.91% maximum drawdown over the seven sessions available after the event; 10D/20D are not yet available in this research window.

Red is therefore a promising **high-risk confirmation candidate**, but the sample is only two events and one is right-censored. It is not sufficient evidence to declare `score >= 8` a validated production withdrawal rule.

## Decision for v4

### Keep

- Keep the score and Orange/Red event construction as a research pressure-alert mechanism.
- Keep Broker persistence and TDCC ownership-transfer evidence separately visible in diagnostics.
- Keep the historical TDCC no-lookahead warning explicit.

### Do not do

- Do not label Orange as “large long-term institution confirmed withdrawal.”
- Do not identify a specific insurer or beneficial owner from broker-branch evidence.
- Do not tune the threshold on these ten events and then claim validation on the same sample.
- Do not promote `score >= 8` directly to production based on two Red observations.

## v5 research architecture

v5 should separate **detection** from **confirmation**.

### Layer A — `distribution_pressure_alert`

Purpose: high recall. Detect that institutional-style selling pressure is present.

Inputs may continue to include:

- Broker daily selling breadth
- Broker daily negative net
- Broker 5D persistent sellers
- Broker 5D persistent net
- TDCC large-holder / small-holder transfer

Orange belongs here.

### Layer B — `long_term_withdrawal_confirmation_candidate`

Purpose: higher precision. This layer must require evidence independent of the current Broker + TDCC combination before it can be interpreted as long-term withdrawal.

Next independent evidence families to validate:

1. Foreign-investor 5D/10D persistent net selling and sell-day ratio.
2. Volume/price distribution behavior: elevated turnover accompanied by failure to make proportional upside progress, or repeated high-volume down/failed-recovery sessions.
3. TDCC persistence / acceleration rather than one-week score alone.
4. Repeated alert regime within the same stock, evaluated prospectively rather than fitted to 2449 after the fact.

No v5 confirmation threshold should be frozen until these added features are tested with walk-forward or a later untouched period.

## Research status

This v4 validation round is complete.

What has been established:

- Data coverage is complete for the fixed six-stock validation range.
- Event-level diagnostics are reproducible.
- Full factor ablation is reproducible.
- v4 has useful short-term selling-pressure information.
- v4 is **not** validated as a general long-term institutional-withdrawal confirmation detector.
- The principal failure mode is rebound after Orange alerts, especially at the 10D horizon.
- The strongest candidate for future confirmation is a separate Layer B using independent foreign-flow and volume-distribution evidence, followed by untouched-period validation.
