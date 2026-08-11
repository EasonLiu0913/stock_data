# Fundamental Event Timeline — Phase 2 Latest-Known State

Last updated: 2026-08-11

## Status

**Phase 2 implementation complete at the shadow-state layer. Production FAS/FQ is intentionally unchanged.**

Phase 2 starts from the accepted Phase 1 event schema and adds two capabilities:

1. historical availability reconstruction from traceable evidence sources;
2. deterministic `latest-known fundamental state` resolution at an arbitrary historical cutoff.

The central question is no longer:

> What is the newest quarter in the database?

It is:

> What financial/fundamental information was actually available to the market by this cutoff?

## Canonical implementation

```text
scripts/fundamental_state_resolver.js
scripts/build_latest_known_fundamental_state.js
scripts/crawl_mops_historical_fundamental_events.js
tests/fundamental_state_resolver.test.js
config/fundamental-state-schema.v1.json
.github/workflows/build-fundamental-state-phase2.yml
```

Evidence roots consumed by the resolver:

```text
data_fundamental_events/             # Phase 1 live/current official evidence
data_fundamental_events_historical/  # historical MOPS adapter output
data_fundamental_events_verified/    # verified official company IR/press evidence
```

Generated state output:

```text
data_fundamental_state/YYYYMMDD/{stock_id}.json
data_fundamental_state/YYYYMMDD/summary.json
```

All Phase 2 outputs remain shadow-only.

## Historical evidence policy

Historical reconstruction is evidence-ranked rather than completeness-at-any-cost.

Confidence order:

```text
official_timestamp
> official_date
> verified_company_ir
> curated_supplemental
> aggregate_snapshot_date
> fallback_deadline
> unknown
```

A missing historical official event must remain missing/fallback. It must not be replaced by a guessed publication timestamp.

### Historical MOPS adapter

`scripts/crawl_mops_historical_fundamental_events.js` uses Playwright against the official MOPS historical material-information view and normalizes visible company/date/time/title rows into the Phase 1 event schema.

It can identify:

```text
monthly_revenue
preliminary_earnings
investor_conference
material_information
```

and derives `fiscal_period` / revenue `period` only from information visible in the historical row.

Coverage is observable in:

```text
data_fundamental_events_historical/build-summary.json
```

Zero historical rows for a company/year is not silently treated as full coverage.

### Verified company IR evidence

Official company IR/press sources are allowed when they provide independently traceable event dates and the source URL is persisted.

They are not considered stronger than an official exchange timestamp, but they are stronger than aggregate/fallback availability.

Current acceptance evidence includes 2330 / 2026Q2 from official TSMC sources.

## 2330 Q2 acceptance case

Official TSMC evidence establishes:

```text
2026-07-16
TSMC Reports Second Quarter EPS of NT$27.25
```

Known metrics include:

```text
Q2 revenue       NT$1,270.38bn
Q2 net income    NT$706.56bn
Q2 EPS           NT$27.25
gross margin     67.7%
operating margin 60.3%
net margin       55.6%
```

Official IR also records the Q2 earnings conference on:

```text
2026-07-16 14:00–15:30 Asia/Taipei
```

The verified events are stored under:

```text
data_fundamental_events_verified/2330/2026.json
```

Daily anti-lookahead semantics make both events effective on:

```text
2026-07-17
```

Therefore, at cutoff `2026-07-17`, the latest financial information for 2330 must resolve to:

```text
fiscal_period = 2026Q2
event_type = preliminary_earnings
availability_confidence = verified_company_ir
EPS = 27.25
```

It must **not** remain on the older 2026Q1 formal report merely because the Q2 conservative filing deadline has not passed.

This is the key Phase 2 acceptance condition.

## Latest-known state rules

### Monthly revenue

Choose the latest available `period=YYYYMM` independently of quarterly financial information.

For equal periods, prefer higher-confidence availability evidence.

### Quarterly financial information

Choose the latest available fiscal period first.

This means:

```text
newer Q2 preliminary
> older Q1 formal
```

Once a formal report for the same Q2 period becomes available:

```text
Q2 formal
> Q2 preliminary
```

The resolver therefore preserves both the stage of information and the fiscal recency.

### Investor conference

Conference events are retained independently because they may contain forward-looking guidance that should not be confused with realized FQ metrics.

### Cutoff semantics

For a date-only daily cutoff, availability follows `effective_trading_date`.

For an exact timestamp cutoff, exact `published_at` events may be evaluated directly against that timestamp.

This preserves Phase 1 anti-lookahead behavior while allowing later intraday research without changing stored events.

## Regression coverage

Phase 2 tests cover:

- intraday disclosure not leaking into the same daily signal;
- exact timestamp cutoff behavior;
- newer preliminary quarter beating an older formal quarter;
- formal report superseding preliminary information for the same fiscal period;
- independent latest monthly-revenue resolution;
- deterministic fiscal-period extraction from historical MOPS titles;
- deterministic revenue-period extraction from historical MOPS titles.

## Workflow

Manual workflow:

```text
[07 研究] Fundamental Event Timeline－Phase 2 State Build
```

The workflow:

1. installs Playwright Chromium;
2. syntax-checks Phase 1/2 components;
3. runs Phase 1 and Phase 2 regression tests;
4. attempts historical MOPS reconstruction for the selected stocks/years;
5. builds a 2330 acceptance state at `2026-07-17`;
6. validates that Q2 preliminary EPS 27.25 is the latest-known financial information;
7. builds the current shadow state;
8. commits only historical-event/state shadow artifacts.

It is `workflow_dispatch` only. It does not use `workflow_run`, deploy Pages, change Strategy Registry, or alter prediction output.

## What Phase 2 completes

Phase 2 completes the information-availability abstraction needed before FQ migration:

```text
raw/current/historical evidence
        ↓
normalized fundamental events
        ↓
confidence-aware availability
        ↓
resolveFundamentalStateAt(stock, cutoff)
        ↓
latest-known monthly / financial / conference state
```

This removes the architectural dependence on one universal `conservative_known_date`.

## What Phase 2 deliberately does not do

Phase 2 does not yet:

- replace production `latest-known FQ`;
- recalculate the FAS >= 8 + FQ >= 10 historical study;
- promote preliminary earnings directly into production strategy logic;
- compute guidance/NLP scores;
- pretend historical MOPS coverage is complete when an official page does not expose a usable row.

These are migration/research tasks after the state layer is accepted.

## Production migration gate

The next phase must:

1. compute FQ from the latest-known state rather than the conservative deadline alone;
2. distinguish preliminary FQ from formal FQ provenance;
3. rerun the complete dual-confirmation research with the revised historical availability timeline;
4. compare old vs event-driven signal dates and performance;
5. only then version/promote the prediction strategy if evidence still supports it.

Until that is complete:

> Phase 2 is a shadow information-state layer, not a production strategy source.
