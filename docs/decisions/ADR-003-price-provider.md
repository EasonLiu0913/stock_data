# ADR-003: Use a Unified Stock Price Provider

- Status: Accepted
- Date: 2026-08-07

## Context

Historical source files evolved over time. Some legacy `data_fubon/fubon_YYYYMMDD_sma.json` files contain SMA values but no OHLCV, while other historical datasets contain complete prices.

Research code that binds directly to one historical schema can incorrectly report missing prices.

## Decision

Research code should obtain historical stock prices through the unified stock price provider.

Current priority:

```text
TWSE MI_INDEX
  -> data_history_sma
  -> legacy data_fubon
```

TWSE official market data is the preferred canonical raw OHLCV source where available.

## Rationale

- Centralizes historical schema compatibility.
- Reduces duplicated price-reading logic.
- Allows official TWSE data to be preferred without breaking older data.
- Makes future validation/fallback changes transparent to research consumers.

## Consequences

- Research scripts should not add new direct `data_fubon` price dependencies.
- Derived indicators such as SMA should be treated separately from raw OHLCV where practical.
- Provider behavior requires regression tests when new historical schemas are added.

## Related

- `../research/monthly-revenue/methodology.md`
