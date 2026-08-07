# ADR-008: Framework Abstraction Evolves from Real Use Cases

**Status:** Accepted  
**Date:** 2026-08-07

## Context

The Task Framework discussion surfaced many potentially useful abstractions:

- hooks
- event bus
- plugins
- middleware
- capabilities
- dependency injection
- streaming item sources
- schedulers
- parallel workers

All are plausible, but only a small subset is required to solve the current MOPS backfill reliability problem.

Building speculative abstractions before multiple real users exist would violate the repository philosophy of evidence before abstraction and increase maintenance cost before value is demonstrated.

## Decision

Framework abstractions must be promoted incrementally from repeated real use cases.

The rule is:

> **Build platforms from proven patterns, not predicted needs.**

The first implementation should solve the first user's real problem with the smallest maintainable contract.

A second and third real user may then reveal which behaviors are genuinely shared and deserve promotion into platform capability.

## Expected evolution

Initial evidence path:

```text
MOPS historical backfill
  ↓
Task Runner MVP
  ↓
validate checkpoint / resume / retry in production use
  ↓
second real long-running use case
  ↓
compare actual duplicated requirements
  ↓
extract the next proven abstraction only
```

Potential future users such as TWSE historical backfill or incremental research are useful hypotheses, not requirements that MVP must pre-implement.

## Abstraction promotion test

Before adding a new generic framework capability, answer:

1. Which current real use case requires it?
2. Is the behavior repeated in another real use case?
3. What concrete duplication or reliability problem does the abstraction remove?
4. Can the current simpler contract remain maintainable without it?
5. What new complexity and migration cost does the abstraction introduce?

If the evidence is weak, keep the behavior domain-specific or postpone it.

## MVP boundary

The first Task Framework may include only what is needed to make the MOPS long-running backfill reliable:

- item execution
- resume with revalidation
- retry
- persistent manifest
- checkpoint callback
- clear logging / summary
- lightweight hooks needed to keep side effects outside the runner

The following are explicitly deferred until real evidence requires them:

- EventEmitter/event bus
- plugin registry
- middleware pipeline
- capability container
- dependency injection framework
- streaming source abstraction
- scheduler
- DAG
- distributed execution
- parallel worker pool
- generic automation platform

## Consequences

### Positive

- Smaller first implementation and test surface.
- Lower migration risk.
- Framework design is shaped by actual failure modes rather than imagined ones.
- Future abstractions have concrete evidence and acceptance criteria.
- Domain teams are not forced into generic APIs before the APIs are proven useful.

### Trade-offs

- Some code may be duplicated temporarily before the second use case proves an abstraction.
- The framework API is expected to evolve carefully as evidence accumulates.
- A later abstraction may require small migrations instead of being predicted perfectly in advance.

These are preferred over premature generic architecture.

## Broader project principle

This decision mirrors the research pipeline:

```text
Research:
idea -> evidence -> candidate -> production

Architecture:
need -> implementation -> repeated evidence -> platform capability
```

Both systems allow evidence to drive evolution.

## Related documents

- `docs/project-philosophy.md`
- `docs/architecture/task-framework.md`
- `docs/decisions/ADR-000-project-philosophy.md`
- `docs/decisions/ADR-007-task-framework-hooks.md`
