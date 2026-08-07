# Monthly Revenue Research Discoveries

Last updated: 2026-08-07

This file records findings supported by the current historical dataset. Findings must be revisited as longer history is added.

## Data-quality discovery

Early daily `data_fubon/fubon_YYYYMMDD_sma.json` files did not always contain `Price/Open/High/Low/Volume`, even though historical OHLCV existed in `data_history_sma`.

The unified stock price provider fixed this compatibility problem and restored early historical return coverage from near-zero to roughly 97-99% for the affected months.

Conclusion: research code should not bind directly to a historical source schema when a canonical provider exists.

## Universe baseline discovery

A factor's raw percentage of stocks beating TAIEX should not be judged against an assumed 50% threshold.

TAIEX is capitalization weighted, so the count-weighted listed-stock universe may naturally have fewer than 50% of stocks outperforming it.

Useful signal is uplift relative to the same-month universe.

## YoY level

Within the initial 202511-202606 study, YoY >=20% generally provided stronger discrimination than YoY >=10% while retaining substantial sample size.

Increasing the threshold from 20% to 30% did not consistently improve discrimination enough to justify the smaller sample.

Current interpretation: approximately 20% is a useful research threshold, not yet a permanent production rule.

## MoM alone

MoM >0 by itself showed weak or inconsistent discrimination in the initial study.

It remains useful as a conditional feature combined with stronger YoY growth, but is not currently supported as a standalone factor.

## YoY acceleration alone

YoY acceleration alone was weaker and less consistent than sustained high YoY growth in the initial study.

It may still add context when combined with other conditions.

## Subfactor behavior

Promising combinations in the initial sample included:

- YoY >=20% + MoM >0.
- YoY >=20% + revenue 3-month high.
- Consecutive 2 months YoY >=20%.
- Consecutive 3 months YoY >=20%.

Different combinations behaved differently by horizon. Consecutive high growth appeared more like a medium-term signal than an immediate announcement reaction.

## Industry baseline

Industry-relative comparison materially changed conclusions.

Some groups that looked strong against TAIEX did not provide additional selection value once compared against their same-industry universe.

Example: semiconductor revenue factors were not automatically superior merely because semiconductor stocks were strong during the sample.

## Industries worth further observation

Initial D5 industry-relative evidence highlighted several groups, including:

- Computer and peripheral equipment.
- Biotechnology / medical.
- Other electronics.
- Shipping in some factor definitions.

Shipping became less convincing after market-regime segmentation and therefore should remain observational rather than promoted.

## Cross-regime finding

The strongest current cross-regime candidate is:

```text
Computer and peripheral equipment
+ YoY >=20%
+ MoM >0
```

It retained positive same-industry uplift in both strong-market and range-market samples for D5 and D10.

However, the current 202511-202606 history contains no credible weak-market regime sample. This is not enough evidence for a production strategy.

## Main limitation

The current historical window is too short and too favorable to the market to establish robust cross-regime conclusions.

The next research priority is longer-history backfill, not adding more factor combinations.
