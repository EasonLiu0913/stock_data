# stock_data

> **An evidence-driven quantitative research platform for Taiwan equities.**
>
> **Let evidence drive evolution.**  
> Evidence before Strategy. Evidence before Abstraction.

`stock_data` collects, normalizes, studies, validates, and presents Taiwan-equity market data. Prediction is one production application of the platform; the longer-term goal is to accumulate reproducible evidence and turn validated knowledge into maintainable strategies.

The project follows two core maxims:

> **Let evidence drive evolution.**  
> **Build platforms from proven patterns, not predicted needs.**

Before a research idea becomes a production strategy, the intended lifecycle is:

```text
Idea
  -> Historical Evidence
  -> Ranking
  -> Stability
  -> Industry Validation
  -> Market Context Validation
  -> Candidate
  -> Explicit Strategy Promotion
```

Before a repeated implementation becomes a shared platform abstraction, it should first be proven by real use cases.

## Project documentation

Start here when working on the repository:

1. [`docs/project-philosophy.md`](docs/project-philosophy.md) — project principles and long-term direction.
2. [`AGENTS.md`](AGENTS.md) — mandatory repository rules for coding agents.
3. [`docs/README.md`](docs/README.md) — documentation map and reading order.
4. [`docs/roadmap/current-phase.md`](docs/roadmap/current-phase.md) — current active development phase.
5. [`docs/decisions/`](docs/decisions/) — Architecture Decision Records.

Architecture and research details live under `docs/architecture/` and `docs/research/`.

## Platform areas

The repository currently spans several connected areas:

- Taiwan market and chip-flow data collection.
- Prediction generation and replay/validation.
- Historical quantitative research.
- Strategy registry and versioned strategy evaluation.
- Market and industry context analysis.
- GitHub Pages dashboards and research tools.
- Reusable platform capabilities such as the unified historical Price Provider.

The project is intentionally research-first: new data or an attractive backtest must not directly alter production prediction behavior.

## Main dashboards and tools

### Stock Data Browser

[Stock Data Browser](https://easonliu0913.github.io/stock_data/public/stock-data-browser.html)

Provides daily chip-flow ranking data and multiple filtering/sorting views.

### Foreign Investors Tracker

[Foreign Investors Tracker](https://easonliu0913.github.io/stock_data/public/foreign.html)

Tracks consecutive foreign-investor buying and related ranking views.

### Tool index

[All published tools](https://easonliu0913.github.io/stock_data/public/index.html)

The public index is the preferred entry point for prediction, replay, research, market, and other dashboards as the project evolves.

## Development principles

Substantial changes should answer four questions before implementation:

1. What real problem does this solve now?
2. Is this the first use case, or is there repeated evidence of the same need?
3. Should the solution remain domain-specific, or has it earned promotion into a platform capability?
4. Which architecture, research, roadmap, or ADR document must be updated with the change?

Additional fixed principles include:

- Market environment is research/dashboard context, never a strategy gate.
- Historical price research uses the unified Price Provider rather than adding new direct legacy price dependencies.
- Long-running historical work should support checkpoint/resume and eventually incremental rebuilds.
- GitHub Actions chaining uses reusable workflows and `workflow_call`; do not introduce `workflow_run` chaining.
- Prefer maintainability, observability, and reproducibility over cleverness.

See [`docs/project-philosophy.md`](docs/project-philosophy.md) for the complete rationale.

## Local use

Clone the repository:

```bash
git clone https://github.com/EasonLiu0913/stock_data.git
cd stock_data
```

Most published dashboards are static HTML under `public/`, but many runtime pages expect repository-root data directories to be served alongside `public/`. Follow the data-path and Pages rules in `AGENTS.md` when testing or changing frontend loading behavior.

## Data and automation

The repository contains multiple source-specific data directories rather than a single `data_fubon/` source of truth. Data is collected through GitHub Actions and supporting Node.js scripts, then consumed by prediction, replay, research, and dashboard layers.

Workflow architecture and deployment rules are documented in:

- [`docs/architecture/github-actions.md`](docs/architecture/github-actions.md)
- [`docs/architecture/prediction-pipeline.md`](docs/architecture/prediction-pipeline.md)

## Long-term direction

The project should accumulate trustworthy evidence across monthly revenue, institutional investors, brokers, margin data, ETFs, financial statements, market context, and future data sources.

The goal is not to maximize the number of strategies. The goal is to maximize the quality and reproducibility of the knowledge from which strategies are promoted.
