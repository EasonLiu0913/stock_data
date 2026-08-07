# stock_data Documentation

This directory is the long-term architecture, research, decision, and roadmap knowledge base for `EasonLiu0913/stock_data`.

## Recommended reading order

1. `/AGENTS.md`
2. `/docs/README.md`
3. `/docs/architecture/research-platform.md`
4. `/docs/architecture/prediction-pipeline.md`
5. `/docs/architecture/github-actions.md`
6. `/docs/roadmap/current-phase.md`
7. Relevant `/docs/research/<topic>/` documents
8. `/docs/decisions/`

## Project philosophy

`stock_data` is a research-first quantitative research and prediction platform.

New data must not go directly into a production strategy. The intended lifecycle is:

```text
Data Source
  -> Normalize
  -> Historical Event / Dataset
  -> Historical Study
  -> Ranking
  -> Stability
  -> Industry Breakdown
  -> Market Regime Analysis
  -> Candidate
  -> Strategy Promotion
```

## Documentation structure

```text
docs/
├── README.md
├── architecture/
│   ├── research-platform.md
│   ├── prediction-pipeline.md
│   └── github-actions.md
├── roadmap/
│   └── current-phase.md
├── research/
│   └── monthly-revenue/
│       ├── methodology.md
│       ├── discoveries.md
│       ├── candidate-factors.md
│       └── rejected-ideas.md
└── decisions/
    ├── ADR-001-research-first.md
    ├── ADR-002-market-environment.md
    ├── ADR-003-price-provider.md
    ├── ADR-004-workflow-orchestration.md
    ├── ADR-005-backfill-checkpoint-incremental.md
    └── ADR-006-baseline-hierarchy.md
```

Existing historical documents directly under `/docs` remain valid historical records and should not be deleted merely because the structured hierarchy exists.

## Maintenance rules

- Architecture documents describe system boundaries and long-term design.
- ADRs record decisions and the reasons behind them.
- Research documents record methodology, findings, candidates, and rejected ideas.
- `roadmap/current-phase.md` must remain concise and reflect the active development phase.
- Significant research or architecture changes should update the corresponding documentation in the same development cycle.
- Research findings are not production strategy rules until explicitly promoted through the documented process.
