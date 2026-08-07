# stock_data Documentation

This directory is the long-term architecture, research, decision, and roadmap knowledge base for `EasonLiu0913/stock_data`.

> **Let evidence drive evolution.**  
> **Build platforms from proven patterns, not predicted needs.**

## Recommended reading order

1. `/docs/project-philosophy.md`
2. `/AGENTS.md`
3. `/docs/README.md`
4. `/docs/architecture/research-platform.md`
5. `/docs/architecture/prediction-pipeline.md`
6. `/docs/architecture/github-actions.md`
7. `/docs/architecture/task-framework.md` when working on long-running tasks/backfills
8. `/docs/roadmap/current-phase.md`
9. Relevant `/docs/research/<topic>/` documents
10. Applicable `/docs/decisions/ADR-*.md`

For a new session or coding agent, `project-philosophy.md` explains **why**, `AGENTS.md` defines mandatory rules, and `roadmap/current-phase.md` explains **what to do next**.

## Project philosophy

`stock_data` is an evidence-driven, research-first quantitative research and prediction platform.

The durable asset of the project is reproducible knowledge rather than the number of strategies or generated files.

New data must not go directly into a production strategy. The intended evidence lifecycle is:

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
  -> Explicit Strategy Promotion
```

Architecture follows the same principle: abstractions should emerge from repeated real needs, not predicted future requirements.

See `/docs/project-philosophy.md` and `/docs/decisions/ADR-000-project-philosophy.md`.

## Documentation structure

```text
docs/
├── README.md
├── project-philosophy.md
├── architecture/
│   ├── research-platform.md
│   ├── prediction-pipeline.md
│   ├── github-actions.md
│   └── task-framework.md
├── roadmap/
│   └── current-phase.md
├── research/
│   └── monthly-revenue/
│       ├── methodology.md
│       ├── incremental-pipeline.md
│       ├── discoveries.md
│       ├── candidate-factors.md
│       └── rejected-ideas.md
└── decisions/
    ├── ADR-000-project-philosophy.md
    ├── ADR-001-research-first.md
    ├── ADR-002-market-environment.md
    ├── ADR-003-price-provider.md
    ├── ADR-004-workflow-orchestration.md
    ├── ADR-005-backfill-checkpoint-incremental.md
    ├── ADR-006-baseline-hierarchy.md
    ├── ADR-007-task-framework-hooks.md
    └── ADR-008-incremental-framework-evolution.md
```

Existing historical documents directly under `/docs` remain valid historical records and should not be deleted merely because the structured hierarchy exists.

## Documentation roles

### Project philosophy

Defines the highest-level principles used to evaluate research and architecture decisions.

### Architecture

Describes durable system boundaries, dependencies, pipelines, and shared platform capabilities.

`architecture/task-framework.md` defines the intentionally small long-running task runner used first to make MOPS backfill reliable. It is not a generic workflow engine and must evolve only from proven repeated use cases.

### Roadmap

`roadmap/current-phase.md` is the concise source of truth for the active development phase and the next validated step.

### Research

Records methodology, validated findings, candidate factors, rejected ideas, uncertainty, and evidence gaps.

For MOPS monthly revenue research, `research/monthly-revenue/incremental-pipeline.md` defines which monthly detail artifacts may be reused, which aggregate artifacts are rebuilt, and the fingerprint/invalidation rules used by the Phase 2 incremental workflow.

### Decisions

ADRs record important decisions and the reasons behind them. When a later design conflicts with an accepted ADR, explicitly revisit the decision rather than silently implementing a contradictory path.

## Maintenance rules

- Architecture documents describe system boundaries and long-term design.
- ADRs record decisions and their rationale.
- Research documents record methodology, findings, candidates, rejected ideas, and unresolved evidence gaps.
- `roadmap/current-phase.md` must remain concise and reflect the active development phase.
- Significant research or architecture changes should update the corresponding documentation in the same development cycle.
- Research findings are not production strategy rules until explicitly promoted through the documented process.
- A major reusable abstraction should be justified by proven repeated use cases.
- Prefer maintainability, observability, reproducibility, and small evolution over speculative generic architecture.
