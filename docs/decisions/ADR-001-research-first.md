# ADR-001: Research Before Strategy Promotion

- Status: Accepted
- Date: 2026-08-07

## Context

`stock_data` continuously adds new sources and candidate signals. A newly available field or a short successful backtest can easily be mistaken for a production-ready strategy.

That creates overfitting risk, unstable daily behavior, and strategy definitions that change faster than they can be validated.

## Decision

New data and candidate factors must remain in the research layer until they pass an explicit promotion process.

Expected path:

```text
Data
  -> Historical study
  -> Baseline-relative ranking
  -> Stability
  -> Industry analysis
  -> Market-regime analysis
  -> Candidate
  -> Explicit strategy promotion
```

Research output must not silently modify production strategy definitions.

## Consequences

- Attractive one-off results remain research findings.
- Production strategies are more stable and versionable.
- Rejected or weak ideas are documented rather than repeatedly rediscovered.
- Strategy promotion becomes an explicit repository decision.

## Related

- `../architecture/research-platform.md`
- `../research/monthly-revenue/methodology.md`
