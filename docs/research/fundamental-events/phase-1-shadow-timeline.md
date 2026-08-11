# Fundamental Events — Phase 1 Shadow Timeline

Date: 2026-08-11

## Research question

Can the project replace one quarter-level `conservative_known_date` with an event timeline that preserves when different kinds of fundamental information actually become available, without introducing look-ahead bias?

## Conclusion

Yes, at the **shadow-data architecture** level.

The project now has enough verified source structure to normalize:

- monthly revenue;
- material disclosures;
- investor-conference disclosures;
- preliminary/self-reported earnings disclosures;
- formal financial values with explicit fallback availability.

The key result is not that every historical exact timestamp is already complete. The key result is that the data model now distinguishes:

```text
actual timestamp/date
vs
fallback availability date
```

and therefore no longer needs to pretend that one legal deadline represents every financial-information event.

## Evidence incorporated

Official source families verified before implementation:

- TWSE OpenAPI monthly revenue and material information;
- TPEx OpenAPI monthly revenue and material information;
- MOPS disclosure categories for financial reports, self-reported earnings, investor conferences, and material information;
- company IR as a supplemental official source when exchange/MOPS data lacks a needed event.

Current Phase 1 live builder calls:

```text
TWSE t187ap05_L
TWSE t187ap04_L
TPEx mopsfin_t187ap05_O
TPEx mopsfin_t187ap04_O
```

## Important negative finding

A provider having a quarterly financial value does **not** prove that the market knew that value on the provider record date.

Therefore:

- FinMind remains useful for normalized financial values;
- its current `conservative_known_date` is retained only as an explicit fallback;
- production FQ must not silently treat that fallback as an actual filing timestamp.

## Anti-lookahead decision

Phase 1 daily-event availability is conservative:

- exact disclosure before 09:00 on a trading day: same trading date;
- exact disclosure during/after the market session: next trading date;
- date-only disclosure: next trading date;
- fallback deadline: next trading date.

This prevents a daily backtest from using information disclosed after the assumed daily entry point.

## Phase 1 implementation

```text
scripts/fundamental_event_timeline.js
scripts/build_fundamental_event_timeline.js
tests/fundamental_event_timeline.test.js
.github/workflows/build-fundamental-event-timeline.yml
docs/architecture/fundamental-information-timeline.md
```

Generated dataset location:

```text
data_fundamental_events/{stock_id}/{year}.json
```

## Current limitations preserved explicitly

Phase 1 intentionally does not claim complete historical actual filing timestamps for all companies/quarters.

Still required before production migration:

1. historical MOPS material-information/disclosure backfill;
2. a reliable actual formal-filing event adapter;
3. repeatable IR adapters only where official exchange/MOPS records are insufficient;
4. extraction/validation of preliminary earnings metrics;
5. shadow comparison of preliminary vs formal FQ;
6. rerun of the FAS + FQ research using actual event availability.

## Production decision

Do **not** switch the current `財報品質訊號` production strategy to the new timeline during Phase 1.

The current strategy remains unchanged until the new availability layer passes shadow coverage and historical reconstruction checks.

This preserves the project's research-first rule: the new data model is evidence infrastructure first, a production dependency later.
