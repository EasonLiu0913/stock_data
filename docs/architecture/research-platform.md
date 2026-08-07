# Research Platform Architecture

## Goal

`stock_data` is designed as a reusable quantitative research platform, not as a collection of one-off strategy scripts.

Every new data source should pass through the same research lifecycle before it can affect production prediction logic.

## Research lifecycle

```text
Data Source
  -> Data Normalization
  -> Historical Event / Dataset
  -> Historical Factor Study
  -> Factor Ranking
  -> Factor Stability
  -> Industry Breakdown
  -> Market Regime Analysis
  -> Candidate Factors
  -> Strategy Promotion
```

Stages must not be skipped merely because an early backtest looks attractive.

## Research layer

The research layer may:

- Build historical datasets.
- Calculate D1/D3/D5/D10/D20 or other explicitly defined horizons.
- Compare factor samples with appropriate baselines.
- Analyze stability, industries, and market regimes.
- Produce research JSON and dashboards.
- Maintain candidate and rejected-factor records.

The research layer must not silently modify production prediction rules.

## Production layer

The production layer includes:

- Daily prediction generation.
- Versioned strategy/tag evaluation.
- Replay and validation.
- Prediction/replay dashboards.
- Deployment.

A research result reaches this layer only after an explicit strategy-promotion decision.

## No look-ahead bias

Historical studies must only use data that would have been available at the study timestamp.

If an exact historical publication timestamp is unavailable, use a documented conservative availability rule rather than pretending a more precise timestamp is known.

## Reproducibility

All research output must be regenerable from stored raw/normalized data and explicit methodology.

Manual edits to research result JSON are not an acceptable source of truth.

## Market environment

Market regime is research context, not a production gate.

It may explain whether a factor performs differently in strong, weak, or range-bound markets, but it must not make a strategy disappear or exclude otherwise matching stocks.

See `../decisions/ADR-002-market-environment.md`.

## Strategy promotion

A factor should normally complete all of the following before promotion:

- Sufficient sample size.
- Multiple historical months/years.
- Baseline-relative uplift.
- Stability analysis.
- Industry-relative analysis where applicable.
- Multiple market-regime observations.
- Reproducible results.
- Explicit versioned production rule design.

Candidate does not mean production strategy.
