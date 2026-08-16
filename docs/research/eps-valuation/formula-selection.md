# EPS 估值公式保留研究

Last updated: 2026-08-16

## Decision

The EPS Valuation Lab no longer presents all 24 formula combinations as equally valid production candidates.

The main surface now contains:

1. **Core valuation — `ttm__hist_p20`**  
   TTM EPS × individual historical P/E median ±20%.
2. **Core valuation — `ttm__hist_q25_q75`**  
   TTM EPS × individual historical P/E Q25–Q75 range.
3. **Benchmark — `ttm__current_pe20`**  
   Event-day price ±20% in algebraic form; retained only as a price benchmark.
4. **Benchmark — `ttm__fixed_10_20`**  
   Simple fixed-P/E baseline.

The full 24-formula matrix remains available as research detail.

Canonical display-policy artifact:

```text
data_prediction_analysis/eps-valuation/formula-display-policy.json
```

Pages summary generation embeds this policy into `valuation-summary.json`; the HTML page must not independently maintain another list of preferred formulas.

## Evidence

Primary research outputs:

```text
data_prediction_analysis/eps-valuation/formula-selection-study.json
data_prediction_analysis/eps-valuation/formula-incremental-value-study.json
```

The guarded selection study used 69,709 valid samples across 24 combinations.

### Structural benchmark

`ttm__current_pe20` has strong apparent accuracy, but:

```text
current P/E = current price / TTM EPS
TTM EPS × current P/E = current price
```

Therefore it is not an independent EPS valuation model. It is retained as an explicit benchmark so other models can be compared against a simple event-day-price band.

### Duplicate EPS method

`seasonal_prior_year` is mathematically equivalent to TTM under the current quarterly definition:

```text
current-year YTD + prior-year remaining quarters
= latest four reported quarters
= TTM
```

Event-matched comparison confirms effectively identical results. These six combinations remain historical research rows but must be labelled `duplicate`, not independent models.

### Forecast EPS methods did not add stable value

`annualized_ytd` and guarded `yoy_scaled_remaining` were compared against event-matched TTM under the same P/E method.

Neither demonstrated stable incremental value. In several historical-P/E comparisons, the forecast method was more often worse than better than TTM.

Therefore:

- `annualized_ytd` → `research_only`
- `yoy_scaled_remaining` → `research_only`

They remain available for future research and should not be deleted from historical evidence.

### Fixed P/E baselines

`fixed_10_20` is retained as the simple fixed baseline.

`fixed_15_25` and `fixed_20_30` remain historical baseline-only rows and are hidden from the default main surface because they do not add enough distinct decision value.

## UI interpretation

The Lab must distinguish roles rather than show a single undifferentiated leaderboard:

```text
Core valuation
  -> answers where the evidence-backed valuation range is

Benchmark
  -> tests whether the model adds information beyond a trivial reference

Research-only
  -> hypothesis retained for future evidence, not promoted

Duplicate
  -> mathematically redundant formula retained only for traceability

Baseline-only
  -> historical comparison row, not a default decision model
```

## Promotion rule

A future formula should not be promoted to the main surface only because it has a good absolute hit rate.

Promotion should require, at minimum:

1. applicability guards for known pathological inputs;
2. robust error statistics such as median and P95 rather than mean alone;
3. event-matched comparison against the relevant baseline;
4. evidence that it adds value rather than reproducing current price or another formula;
5. an explicit update to `formula-display-policy.json` and this research record.

This follows the project rule: **Evidence before Strategy.**
