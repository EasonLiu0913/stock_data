# Project Philosophy

> **Let evidence drive evolution.**
>
> 讓證據推動演化，而不是讓猜測推動設計。

`stock_data` is an evidence-driven quantitative research platform. Prediction is one production application of the platform, not the definition of the platform itself.

The project exists to accumulate reproducible evidence, turn evidence into durable knowledge, and only then promote sufficiently validated knowledge into production strategies.

## Core principles

### 1. Evidence before Strategy

A promising idea or backtest is not a production strategy.

Research should move through historical validation, baseline-relative ranking, stability analysis, industry analysis, market-context analysis, candidate review, and explicit strategy promotion before it changes production prediction behavior.

### 2. Evidence before Abstraction

Do not build abstractions because they may be useful someday.

Shared frameworks and platform capabilities should emerge from proven repeated needs. The first implementation solves a real problem; the second and third real use cases justify extracting reusable abstractions.

> **Build platforms from proven patterns, not predicted needs.**

### 3. Research before Automation

Make the process correct, observable, and reproducible before making it automatic.

Automation must preserve understanding and recoverability. A complicated automated workflow is not an improvement if failures become harder to diagnose or historical results become harder to reproduce.

### 4. Platform before duplicated Features

When the same proven capability is needed by multiple domains, prefer one shared platform capability over separate implementations.

Examples include:

- Unified Price Provider
- Task / long-running execution framework
- Strategy Registry
- Reusable validation and research infrastructure

This principle does **not** justify speculative frameworks. Reuse must be demonstrated by real use cases.

### 5. One Source of Truth

Core concepts should have one canonical interpretation and one preferred access path.

Examples:

- Historical stock prices should be accessed through the unified Price Provider.
- Strategy definitions should be versioned through the Strategy Registry.
- Market environment definitions should not be independently reimplemented by unrelated features.
- Research methodology and conclusions should be documented in the repository rather than existing only in chat history.

Fallback sources may exist, but callers should not independently choose between them.

### 6. Everything Important Is Versioned

Important outputs must remain traceable to the rules and data that produced them.

Version or otherwise record the identity of:

- schemas
- strategy definitions
- registries
- research methodology
- evaluation policy
- generated research artifacts when methodology changes

Historical conclusions must be explainable in terms of the data and rules that generated them.

### 7. Small Evolution

Prefer small, validated evolution over large speculative redesigns.

A useful sequence is:

```text
Real problem
  -> Simple solution
  -> Validation
  -> Second real use case
  -> Shared pattern
  -> Platform capability
```

Keep today's implementation understandable while leaving tomorrow room to evolve.

### 8. Maintainability over Cleverness

Optimize for maintainability, not cleverness.

Prefer code and architecture that future maintainers can understand, verify, repair, and replace. A technically elegant abstraction is not valuable if it obscures the actual business process or makes failures harder to recover from.

## Evidence pipeline

The project uses a common evidence lifecycle:

```text
Idea
  -> Historical Evidence
  -> Cross-validation
  -> Candidate
  -> Long-term Validation
  -> Production
```

For quantitative research this is expanded as:

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

Production prediction is the end of an evidence pipeline, not the beginning.

## Knowledge layer

The durable asset of `stock_data` is not the number of JSON files or the number of strategies. It is the accumulated, reproducible knowledge about what has and has not worked.

Research documentation should therefore preserve:

- methodology
- validated findings
- candidate factors
- rejected ideas
- uncertainty and missing evidence

A rejected idea is useful knowledge because it prevents the same weak hypothesis from being repeatedly rediscovered.

## Architecture philosophy

Applications should focus on their domain logic. Shared infrastructure should handle proven cross-cutting execution concerns only after those concerns are demonstrated across real use cases.

For example, the planned long-running Task Framework begins with one concrete objective:

> Make MOPS historical backfill reliably interruptible, resumable, and checkpointable.

Its first version should not attempt to become a universal workflow engine. Hooks may preserve extension points, but plugin systems, middleware, dependency injection, event buses, streaming task sources, or distributed execution should only appear when real later users require them.

## Development questions

Before a substantial new feature or abstraction, answer:

1. What real problem does this solve now?
2. Is this the first use case, or is there already repeated evidence of the same need?
3. Should this remain domain-specific, or is there enough evidence to become a platform capability?
4. Which architecture, research, roadmap, or ADR document must be updated with the change?

## Long-term vision

The project should accumulate trustworthy knowledge across revenue, institutional investors, brokers, margin data, ETFs, financial statements, market data, and other future sources.

The goal is not to maximize the number of strategies. The goal is to maximize the quality, reproducibility, and usefulness of evidence that can eventually support strategies.

A good architecture is not one that predicts every future requirement. It is one that can evolve naturally as evidence reveals the next requirement.

**Let evidence drive evolution.**
