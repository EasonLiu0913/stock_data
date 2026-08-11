# Fundamental Event Timeline — Phase 1 Live Acceptance

Last updated: 2026-08-11

## Purpose

Record the live-source acceptance runs for the Phase 1 shadow fundamental-event timeline and preserve the data-semantics corrections discovered from real TWSE/TPEx payloads.

Phase 1 remains shadow-only. Production FAS/FQ and prediction behavior are not changed by this pipeline.

## Test universe

Input stocks:

```text
2330,2317,2454,2059
```

As-of date:

```text
2026-08-11
```

## Official-source health

Both live runs confirmed all four configured official endpoints healthy:

```text
TWSE t187ap05_L monthly revenue   OK
TWSE t187ap04_L material info     OK
TPEx mopsfin_t187ap05_O monthly   OK
TPEx mopsfin_t187ap04_O material  OK
```

The corrected clean run generated 45 normalized events across the four requested stocks.

## Finding 1 — OpenAPI `出表日期` is not company publication time

The first implementation treated the monthly-revenue aggregate field `出表日期` as the company's actual publication date.

Live data proved that assumption unsafe.

Example from 2330:

```text
資料年月: 11506 (2026-06)
出表日期: 1150717 (2026-07-17)
```

`出表日期` is therefore treated as the date of the aggregate/report snapshot, not as evidence of when 2330 itself disclosed the monthly revenue.

Corrected representation:

```text
published_at = null
published_date = null
fallback_known_date = 出表日期
timestamp_precision = fallback
availability_confidence = aggregate_snapshot_date
source.role = official_monthly_revenue_value_snapshot
```

The aggregate API remains authoritative for standardized revenue values, but not for exact company disclosure timing.

## Finding 2 — Material-information payload contains the actual monthly-revenue disclosure timestamp

The live TWSE material-information feed contained this 2330 record:

```text
發言日期: 1150810
發言時間: 135109
主旨 : 台積公司2026年7月營收報告
```

The corrected clean run now normalizes it as:

```text
event_type = monthly_revenue
period = 202607
published_at = 2026-08-10T13:51:09+08:00
published_date = 2026-08-10
timestamp_precision = second
availability_confidence = official_timestamp
effective_trading_date = 2026-08-11
source.role = official_monthly_revenue_disclosure
```

This is the required anti-lookahead behavior for daily research: the disclosure occurred during the 2026-08-10 trading day, so the event is first usable for a full daily signal on 2026-08-11.

Therefore, for current disclosures the material-information feed is preferred for availability timing, while the monthly aggregate feed is preferred for standardized values.

## Finding 3 — Official JSON keys may contain trailing whitespace

The live TWSE payload used:

```text
"主旨 "
```

rather than exactly:

```text
"主旨"
```

The common `pick()` helper now normalizes source keys with `trim()` before matching. This prevents title loss and downstream event misclassification.

## Finding 4 — Monthly revenue is also a material-information event family

The event classifier recognizes monthly-revenue disclosures before falling back to generic `material_information`.

Examples:

```text
月營收
營收報告
monthly sales
monthly revenue
```

When disclosure text contains a recognizable year/month, the normalizer derives `period=YYYYMM` so an exact material-information disclosure can supersede an aggregate snapshot event for the same stock/period.

## Deduplication priority

Availability confidence is ranked:

```text
official_timestamp
> official_date
> curated_supplemental
> aggregate_snapshot_date
> fallback_deadline
> unknown
```

An exact disclosure must replace a lower-quality snapshot/fallback record for the same canonical event identity.

## Historical limitation confirmed

`t187ap04_L` / `mopsfin_t187ap04_O` are useful live feeds, but they do not by themselves reconstruct the historical 2330 2026Q2 investor-conference / earnings event from July that was identified independently through company IR research.

This is intentionally not hidden or filled with guessed timestamps. The next historical-data work is:

1. historical MOPS material-information adapter;
2. historical MOPS filing-time adapter;
3. verified company-IR supplemental adapter where official MOPS history does not expose enough detail.

Do not compensate for this gap by treating legal filing deadlines as actual timestamps.

## Final Phase 1 acceptance

The second live run after the normalization fixes is **PASS**.

Acceptance evidence:

- all four TWSE/TPEx official endpoints returned successfully;
- build completed in `shadow_mode=true` with `production_integration=false`;
- 2330 July 2026 revenue is classified as `monthly_revenue`, not generic material information;
- its actual disclosure timestamp is preserved as `2026-08-10T13:51:09+08:00`;
- its daily `effective_trading_date` is correctly resolved to `2026-08-11`;
- TWSE monthly aggregate `出表日期` is no longer represented as actual company publication time;
- standardized monthly revenue values and actual disclosure availability are stored as distinct evidence roles;
- fallback financial-report availability remains explicitly labeled as fallback rather than actual filing time;
- production FAS/FQ remains unchanged.

Phase 1 is therefore complete at the shadow event-data layer.

## Phase 2 entry condition

Phase 2 should begin from this accepted event schema and focus on historical availability reconstruction and `latest-known fundamental state` resolution before any production FQ migration.
