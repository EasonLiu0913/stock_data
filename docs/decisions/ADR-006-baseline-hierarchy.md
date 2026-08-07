# ADR-006: Use a Baseline Hierarchy for Factor Evaluation

- Status: Accepted
- Date: 2026-08-07

## Context

A raw factor win rate can be misleading. TAIEX is capitalization weighted, the listed-stock universe is count weighted, and entire industries can outperform or underperform together.

A factor may appear strong simply because its industry was strong during the sample.

## Decision

Research should distinguish three comparison layers.

### Layer 1 — TAIEX

Measures absolute market-relative return.

Useful for understanding whether a stock/factor beat the headline market index.

### Layer 2 — same-month listed-stock universe

Measures whether the factor improves selection versus the typical listed stock available in the same period.

This is the preferred baseline for broad factor ranking.

### Layer 3 — same-month, same-industry universe

Measures whether an industry-specific factor adds value beyond the industry itself.

This is the preferred baseline for industry conclusions.

## Rationale

A fixed 50% "beats TAIEX" threshold is not a valid universal baseline because TAIEX weighting can make the count-weighted stock universe naturally differ from 50%.

Likewise, strong industry performance must not be attributed to a factor without same-industry comparison.

## Consequences

Research JSON and dashboards should label which baseline is being used.

Factor ranking, industry breakdown, and future multi-factor research should report uplift relative to the appropriate baseline rather than relying only on raw win rate.

## Related

- `../research/monthly-revenue/methodology.md`
- `ADR-001-research-first.md`
