# Monthly Revenue Research Methodology

## Purpose

The purpose of the MOPS monthly-revenue project is to determine whether revenue information has repeatable predictive value. It is not assumed to be a production strategy.

## Source data

Primary source:

- MOPS monthly revenue snapshots.

Supporting data:

- TWSE market data.
- TAIEX benchmark data.
- Unified stock price provider.
- MOPS monthly industry classification.

## Historical availability

Two research modes must remain distinct.

### Live-observed event study

For months observed by this repository in real time, use stored observation metadata such as `first_seen_at` to study market reaction after the information was actually observed.

### Conservative historical factor study

For older months where per-company filing timestamps cannot be reliably reconstructed, do not pretend the exact filing date is known.

Use the documented conservative availability rule: treat the month's complete revenue dataset as safely available from the first TAIEX trading date after the 15th of the following month.

This historical study measures factor selection value, not exact announcement-day reaction.

## Price source

All monthly-revenue research should use the unified price provider rather than directly binding to a legacy Fubon schema.

Priority:

```text
TWSE MI_INDEX
  -> data_history_sma
  -> legacy data_fubon
```

## Return horizons

Current standard horizons:

- D1
- D3
- D5
- D10
- D20

A result should distinguish complete observations, missing stock price, and pending future market data.

## Baseline hierarchy

Three baseline levels are useful:

1. TAIEX return.
2. Same-month listed-stock universe.
3. Same-month, same-industry universe.

For industry-specific conclusions, same-industry uplift is the primary comparison because it separates factor value from industry-wide strength.

See `../../decisions/ADR-006-baseline-hierarchy.md`.

## Research stages

Monthly revenue factors proceed through:

```text
Historical factor results
  -> Factor rankings
  -> Subfactor experiments
  -> Stability analysis
  -> Industry breakdown
  -> Market-regime breakdown
  -> Candidate factors
```

No stage automatically promotes a factor into production.

## Incremental historical research

Historical monthly detail artifacts are now designed for incremental reuse.

Canonical detail artifact:

```text
data_prediction_analysis/monthly-revenue/monthly-signals/YYYYMM.json
```

A complete monthly detail may be reused only when its stored research fingerprint still matches the current inputs.

The current fingerprint covers:

- explicit methodology version;
- stable revenue/factor content relevant to the study;
- the TAIEX rows needed from the conservative base date through D20;
- the unified stock-price-provider implementation.

Operational MOPS metadata such as collection timestamps and snapshot counts are deliberately excluded because they do not change the research meaning of the month.

Any monthly detail containing `pending_market_data` or `missing_stock_price` remains non-immutable and is regenerated on a later run.

Aggregate outputs such as coverage, rankings, stability, industry, and market-regime summaries are rebuilt from the selected monthly details. They are cheap relative to per-stock detail generation and legitimately change when the selected research window gains a new month.

A full rebuild remains available for methodology/schema changes, known historical price corrections, or equivalence validation.

See `incremental-pipeline.md` for the dependency graph and invalidation rules.

## Market regime

Market regime is explanatory research context only.

It must not be used to hide matching stocks or turn a strategy on/off.

Current historical regime studies must use only market information available before the signal effective date.

## Current study period

The first validated historical baseline currently covers 202511 through 202606. The next objective is to extend MOPS history backward in controlled batches, first to 202401, then 202201, then 202001 if source and price coverage remain valid.

## Long-history safeguards

When extending history:

- Do not assume current company count applies to older months.
- Validate each month's actual MOPS company set independently.
- Preserve source snapshots.
- Use checkpoint/resume for long backfills.
- Use incremental detail reuse rather than recalculating unchanged complete monthly research artifacts.
- Keep explicit full rebuild mode available for methodology/schema/version changes and known historical price corrections.
- Do not force every historical month through exact-live-event methodology when historical filing timestamps are unavailable.
- Confirm price and TAIEX coverage before interpreting factor results.
