# ADR-000: Evidence-Driven Project Philosophy

**Status:** Accepted  
**Date:** 2026-08-07

## Context

`stock_data` has grown from a collection of market-data crawlers and dashboards into a research and prediction platform with historical studies, strategy versioning, replay, market context, reusable price access, and increasingly long-running backfill workflows.

As the project grows, there is a risk of two recurring failure modes:

1. promoting attractive ideas directly into production strategies before enough evidence exists;
2. designing generic frameworks in anticipation of future needs before repeated real use cases justify the abstraction.

Both create long-term maintenance cost and make results harder to explain.

## Decision

The project adopts an evidence-driven evolution model.

The primary principle is:

> **Let evidence drive evolution.**

Supporting rules are:

- **Evidence before Strategy.** Research findings require historical validation before explicit production promotion.
- **Evidence before Abstraction.** Shared platform capabilities are extracted from demonstrated repeated needs, not speculative future requirements.
- **Research before Automation.** Correctness, reproducibility, and recoverability come before automation complexity.
- **Platform before duplicated Features.** Once a cross-cutting pattern is proven, prefer one shared capability over multiple independent implementations.
- **One Source of Truth.** Core concepts should have one canonical interpretation and preferred access path.
- **Everything Important Is Versioned.** Historical results must remain traceable to their rules, schemas, and data.
- **Small Evolution.** Prefer small validated steps over large speculative redesigns.
- **Maintainability over Cleverness.** Prefer understandable, observable, repairable designs over technically impressive abstractions.

A second project maxim follows from this decision:

> **Build platforms from proven patterns, not predicted needs.**

## Consequences

### Research

New data and promising factors do not directly alter production strategies. They proceed through the documented evidence pipeline and require explicit strategy promotion.

### Architecture

The first implementation of a new concern may remain domain-specific. Reusable infrastructure should be introduced when multiple real consumers demonstrate a common pattern.

### Task Framework

The planned long-running Task Framework will begin by solving the concrete MOPS checkpoint/resume problem. Its MVP will remain deliberately small. More generic plugin, middleware, capability, DI, event-bus, or streaming abstractions require later real use cases.

### Documentation

Important decisions, findings, rejected approaches, and active roadmap phases must be recorded in repository documentation. Chat history is not the canonical project handoff.

### Development review

Substantial changes should be evaluated by asking:

1. What real problem is being solved?
2. What evidence supports the proposed strategy or abstraction?
3. Is a simpler domain-specific solution sufficient today?
4. Does the change preserve a clear path for later evolution?

## Non-goals

This ADR does not prohibit refactoring, reusable components, automation, or platform design. It requires those decisions to be justified by demonstrated needs and to remain proportionate to the problem being solved.

It also does not imply that every experiment must become production code. Rejected hypotheses are valid and useful project knowledge.

## Related documents

- `docs/project-philosophy.md`
- `docs/architecture/research-platform.md`
- `docs/roadmap/current-phase.md`
- `ADR-001-research-first.md`
- `ADR-005-backfill-checkpoint-incremental.md`
