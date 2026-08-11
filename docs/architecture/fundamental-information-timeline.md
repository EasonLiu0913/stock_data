# Fundamental Information Timeline

Last updated: 2026-08-11

## Status

**Phase 1 complete at the shadow-data layer. Production prediction still reads the existing FAS/FQ path.**

This architecture exists because a single `conservative_known_date` cannot correctly represent all information that becomes available around monthly revenue, quarterly earnings, formal financial reports, investor conferences, and other material disclosures.

The core rule is:

> Store what the market could know, when it could know it, and how precisely that availability time is known.

Do not infer information availability merely from the presence of a financial value in a provider dataset.

## Problem being solved

A fiscal quarter may expose information in several stages:

1. monthly revenue;
2. preliminary/self-reported earnings or an earnings release;
3. investor conference and presentation materials;
4. formal financial-report filing;
5. other material-information disclosures.

Those dates are not interchangeable.

For example, a company may publish Q2 operating results through an earnings release and investor conference well before the conservative legal filing deadline. A backtest that waits for the legal deadline unnecessarily delays information. A backtest that uses a provider's newest quarter without an availability event can leak future information.

## Phase 1 scope

Phase 1 creates a **shadow event timeline** only. It does not modify production FQ or prediction behavior.

Implemented event types:

```text
monthly_revenue
preliminary_earnings
formal_financial_report
investor_conference
material_information
```

Canonical implementation:

```text
scripts/fundamental_event_timeline.js
scripts/build_fundamental_event_timeline.js
tests/fundamental_event_timeline.test.js
.github/workflows/build-fundamental-event-timeline.yml
```

Generated shadow data:

```text
data_fundamental_events/{stock_id}/{year}.json
data_fundamental_events/build-summary.json
```

## Source priority

### 1. Official timestamp/date

Preferred sources:

- TWSE OpenAPI;
- TPEx OpenAPI;
- MOPS disclosures when a later adapter supplies historical records;
- official company IR as a supplemental source when its publication event is independently traceable.

Current Phase 1 live endpoints:

```text
TWSE monthly revenue: t187ap05_L
TWSE material information: t187ap04_L
TPEx monthly revenue: mopsfin_t187ap05_O
TPEx material information: mopsfin_t187ap04_O
```

Material-information records can supply an actual disclosure date/time. Monthly-revenue aggregates are treated as date precision unless a more precise source is supplied.

### 2. Supplemental official events

The builder accepts an optional `--supplemental-file` containing normalized events. This is intended for verified MOPS historical-disclosure or company-IR adapters; it is not a license to hand-invent dates.

### 3. Fallback availability

Existing FinMind quarterly files remain usable for financial values. When no actual filing event is available, their `conservative_known_date` is retained explicitly as:

```text
fallback_known_date
availability_confidence = fallback_deadline
timestamp_precision = fallback
```

A fallback date must never be presented as an actual filing timestamp.

## Event schema

Each normalized event includes:

```json
{
  "schema_version": 1,
  "event_id": "...",
  "stock_id": "2330",
  "stock_name": "...",
  "market": "TWSE",
  "event_type": "preliminary_earnings",
  "period": null,
  "fiscal_period": "2026Q2",
  "published_at": "2026-07-16T14:00:00+08:00",
  "published_date": "2026-07-16",
  "timestamp_precision": "minute",
  "effective_trading_date": "2026-07-17",
  "fallback_known_date": null,
  "availability_confidence": "official_timestamp",
  "title": "...",
  "description": "...",
  "metrics": null,
  "source": {},
  "raw": {}
}
```

Allowed timestamp precision:

```text
second
minute
date
inferred
fallback
```

The precision field is mandatory because daily research must distinguish exact timestamps from date-only knowledge.

## Effective trading date

Daily backtests must not use a disclosure before it could have been acted on using the chosen daily-bar entry assumption.

Phase 1 conservative rule:

```text
exact publication before 09:00 on a trading date
  -> same trading date

exact publication at/after 09:00
  -> next trading date

date-only publication
  -> next trading date

fallback availability date
  -> next trading date
```

This deliberately avoids intraday leakage. A later intraday research framework may use a finer execution rule, but must not silently change daily research semantics.

Trading dates are discovered from repository market/price data when available; weekday fallback is used only beyond discovered coverage.

## Material-information classification

Phase 1 uses deterministic text rules only:

```text
法人說明會 / 法說 / earnings conference
  -> investor_conference

自結 / 自結損益 / 初步財務 / earnings release / EPS
  -> preliminary_earnings

財務報告 + 董事會/通過/公告/申報 wording
  -> preliminary_earnings

otherwise
  -> material_information
```

A board approval/material disclosure is **not** automatically treated as the formal filing itself. Formal filing availability remains a separate event.

No NLP sentiment or guidance score is part of Phase 1.

## Formal financial report policy

Phase 1 intentionally separates:

```text
financial values
```

from:

```text
availability event
```

Existing quarterly values can continue to come from FinMind or official normalized financial statements. Actual filing availability should eventually come from an official MOPS filing/disclosure adapter.

Until that adapter is proven reliable, the legal/conservative deadline remains an explicit fallback only.

This means Phase 1 fixes the data model before changing production semantics.

## Shadow build

Manual command:

```bash
node scripts/build_fundamental_event_timeline.js \
  --stock-ids 2330,2317,2454,2059 \
  --as-of-date 2026-08-11
```

Offline/fallback-only build:

```bash
node scripts/build_fundamental_event_timeline.js \
  --stock-ids 2330 \
  --as-of-date 2026-08-11 \
  --offline
```

Optional supplemental normalized events:

```bash
node scripts/build_fundamental_event_timeline.js \
  --stock-ids 2330 \
  --supplemental-file path/to/verified-events.json
```

GitHub Action:

```text
[07 研究] Fundamental Event Timeline－Shadow Build
```

The workflow:

1. syntax-checks the Phase 1 scripts;
2. runs the regression tests;
3. calls TWSE/TPEx live official APIs;
4. builds shadow artifacts;
5. validates that the dataset remains shadow-only;
6. commits only `data_fundamental_events/**` when data changes.

It does **not** deploy Pages, call prediction workflows, use `workflow_run`, or change the Strategy Registry.

## Validation coverage

Regression tests lock down:

- ROC date parsing;
- MOPS-style time parsing;
- ROC monthly period parsing such as `11507 -> 202607`;
- pre-open same-day availability;
- intraday next-trading-day availability;
- date-only conservative availability;
- weekend/trading-calendar behavior;
- material-information classification;
- official monthly-revenue normalization;
- official material-information timestamp normalization;
- explicit fallback semantics;
- duplicate-event preference for higher-quality availability evidence.

## What Phase 1 does not claim

Phase 1 does not yet claim that historical actual filing timestamps are complete for every company and quarter.

Remaining source work belongs to the next phase:

1. reliable MOPS historical filing-event adapter;
2. historical MOPS material-information backfill rather than current/live observation only;
3. repeatable company-IR adapter patterns where official exchange/MOPS data is insufficient;
4. extraction of preliminary earnings metrics from disclosure text/documents;
5. comparison between preliminary FQ and later formal FQ.

Those gaps must not be hidden by rewriting fallback dates as actual dates.

## Production migration gate

Production may switch from `conservative_known_date` to the event timeline only after shadow validation demonstrates:

1. actual events never occur after the information used by a prediction;
2. missing official events fall back conservatively rather than becoming unavailable or leaking data;
3. TWSE and TPEx coverage is observable;
4. historical event reconstruction is sufficiently complete for the research window;
5. FAS + FQ research is rerun using the new availability timeline;
6. the resulting strategy is explicitly re-promoted/versioned if its sample definition changes.

Until then:

> `data_fundamental_events` is evidence infrastructure, not a production signal source.
