# Institutional Withdrawal v5 Research Spec

## Research question

Separate **institutional selling pressure** from evidence consistent with **persistent long-term capital withdrawal**. This is a research candidate only; it must not identify a beneficial owner or be promoted to production from the development sample.

## Fixed development sample

- Universe: `2330,2317,2454,2382,2303,2449`
- Development range: `2026-04-01` through `2026-08-21`
- Anchor: every official historical TDCC observation in the range.
- Market feature date: latest Taiwan trading day `<= TDCC observed_date`.
- The development range has already been inspected and is **not** an untouched validation sample.

## No-lookahead contract

1. Every feature must use information dated on or before its anchor date / market feature date.
2. Rolling windows are backward-looking only.
3. Forward 5D/10D/20D returns and path excursions are outcome labels only and must never enter candidate features.
4. Historical TDCC original publication timestamps are unavailable. Historical replay is association-only and is not executable P&L.
5. Missing observations are never imputed as zero.
6. Broker branches are transaction venues/rankings, not beneficial-owner identities.

## Evidence families

### A. Broker pressure

Re-use the v4 four-condition pressure representation on the latest market feature date:

- daily negative breadth `>= 8`
- daily negative net `<= -6000`
- persistent 5D sellers `>= 5`
- persistent 5D net `<= -8000`

This family measures selling pressure. It is not sufficient to confirm long-term withdrawal.

### B. TDCC ownership migration

Retain one-observation changes and add persistence:

- large-holder 1-observation change
- small-holder 1-observation change
- large-holder 2-observation change
- small-holder 2-observation change
- consecutive large-holder decline streak
- consecutive small-holder increase streak
- consecutive transfer streak where large holders decline while small holders increase
- change acceleration versus prior observation

### C. Foreign flow

TWSE files contain three repeated buy/sell/net groups. Preserve all three explicitly:

- ex-dealer foreign/land-investor flow: columns 3/4/5
- foreign dealer flow: columns 6/7/8
- combined total flow: columns 9/10/11

Primary research confirmations use combined total flow while retaining the other groups for auditability:

- daily net
- trailing 5D net / sell days / sell ratio
- trailing 10D net / sell days / sell ratio
- 5D net acceleration versus the preceding 5 sessions

### D. Price / volume response

Use Fubon SMA OHLCV history with prior-only baselines:

- 1D / trailing 5D / trailing 10D price return
- current volume versus previous 20-session mean
- high-volume down day: volume ratio `>= 1.5` and 1D return `<= -1%`
- high-volume flat/absorption day: volume ratio `>= 1.5` and absolute 1D return `<= 1%`
- trailing 5D/10D distribution-day count
- close versus prior 20-session high

High-volume flat behavior is recorded as evidence, not automatically treated as bearish; it can represent either absorption or distribution and requires interaction analysis.

## Pre-registered candidate confirmation flags

These are research hypotheses, not production rules.

- `foreign_confirm`: trailing 5D total foreign net < 0, 5D sell ratio >= 0.6, and trailing 10D total foreign net < 0.
- `tdcc_persistence_confirm`: large-holder decline streak >= 2 and small-holder increase streak >= 2.
- `price_volume_confirm`: at least 2 high-volume down/distribution days in the trailing 10 sessions, or current volume ratio >= 1.5 with trailing 5D return < 0.
- `broker_pressure_confirm`: broker pressure score >= 3.

Study combinations:

1. Broker + TDCC deterioration (pressure baseline)
2. Pressure + foreign confirmation
3. Pressure + TDCC persistence confirmation
4. Pressure + price/volume confirmation
5. Pressure + at least 2 independent confirmation families
6. Pressure + all 3 independent confirmation families

No threshold may be promoted solely because it fits the 2026-04-01..2026-08-21 outcomes.

## Required outputs

- standalone foreign rolling feature dataset
- standalone price/volume rolling feature dataset
- full TDCC-anchored feature matrix
- coverage/quality report
- combination/ablation analysis versus the all-anchor baseline
- explicit untouched-validation status

## Promotion gate

A future production `long_term_withdrawal_confirmation` requires an untouched or walk-forward sample with adequate 5D/10D/20D follow-up and broader cross-stock coverage. Until then, v4 remains `distribution_pressure_alert` and v5 remains research-only.
