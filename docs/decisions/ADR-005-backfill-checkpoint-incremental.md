# ADR-005: Long Backfills Must Support Checkpoint and Incremental Work

- Status: Accepted
- Date: 2026-08-07

## Context

Multi-year historical backfills can run for a long time and depend on external services. A single transient error late in the range should not force all earlier valid months to be downloaded and recomputed again.

Similarly, adding one new month should not require regenerating immutable historical monthly detail artifacts for all prior years.

## Decision

Long-running backfills must be designed around two complementary patterns.

### Checkpoint source backfill

```text
plan missing/forced months
  -> process bounded batch
  -> validate each month
  -> checkpoint commit/push
  -> continue
```

Reruns skip already valid months unless force mode is selected.

### Incremental historical research

- Full rebuild remains available for methodology/schema changes.
- Normal update mode computes only missing or changed monthly detail artifacts.
- Aggregate summaries/rankings may be regenerated from stored monthly detail artifacts.

## Initial monthly checkpoint target

For MOPS monthly-revenue backfill, an initial target of roughly three months per checkpoint is appropriate, subject to actual runtime and external-source behavior.

## Consequences

- Partial valid work survives late failure.
- Recovery is cheaper and easier to reason about.
- Multi-year extensions can be executed in controlled ranges.
- Force/full-rebuild modes remain explicit rather than accidental defaults.

## Related

- `../architecture/github-actions.md`
- `../roadmap/current-phase.md`
