# TSMC equipment-demand daily AI research contract

Canonical research contract: `data_research/tsmc-equipment-demand/ai/README.md`

## Purpose

Keep public-market evidence separate from AI interpretation so analysis can be rerun later without silently changing the evidence set.

## Daily identity

The daily identity is the **Asia/Taipei calendar date when the search starts**, formatted `YYYYMMDD`.

The research date is not the same concept as the latest stock-price trading date. A report may therefore legitimately contain:

```text
report_date: 20260903
price_trading_date: 20260902
```

## Storage

Raw evidence is a research artifact and is not a frontend dependency:

```text
data_research/tsmc-equipment-demand/ai/raw/YYYYMMDD.json
```

AI interpretation is a public dashboard artifact:

```text
data_prediction_analysis/tsmc-equipment-demand/ai/analysis/YYYYMMDD.json
```

The deterministic price/fact payload remains independent:

```text
data_prediction_analysis/tsmc-equipment-demand/dashboard.json
```

## Contracts

Watchlist and company-specific research targets:

```text
config/tsmc-equipment-demand-ai-watchlist.json
```

Raw evidence schema:

```text
config/schemas/tsmc-equipment-demand-ai-raw.schema.json
```

Analysis schema:

```text
config/schemas/tsmc-equipment-demand-ai-analysis.schema.json
```

Validator:

```text
scripts/validate_tsmc_equipment_demand_ai_report.js
```

Validation command:

```bash
node scripts/validate_tsmc_equipment_demand_ai_report.js \
  --raw data_research/tsmc-equipment-demand/ai/raw/YYYYMMDD.json \
  --analysis data_prediction_analysis/tsmc-equipment-demand/ai/analysis/YYYYMMDD.json
```

## Frozen separation rules

1. Raw evidence contains search/query results and source metadata, not an overall stock recommendation or thesis conclusion.
2. Analysis may use only the selected raw evidence artifact plus deterministic facts from `dashboard.json`.
3. Analysis records the exact SHA-256 of the raw JSON bytes it used.
4. Analysis must preserve `dashboard.json` price-state facts; the validator rejects a different per-stock price state.
5. Price weakness alone must not rewrite the fundamental demand state.
6. Failure to find negative evidence does not prove that no negative change exists. Use explicit insufficient-evidence language.
7. A failed search, incomplete durable write, schema failure, or missing required input must not produce a false PASS report.
8. The dashboard requests only the current Asia/Taipei research date. If that report is missing, it shows a pending state instead of silently using yesterday's analysis.

## Daily workflow intent

One ChatGPT research run per day, initially scheduled for 20:30 Asia/Taipei:

```text
current remote main
  -> watchlist contract
  -> deterministic dashboard facts
  -> public web / official evidence search
  -> raw/YYYYMMDD.json
  -> analysis from raw + facts
  -> validate raw + analysis + deterministic identity
  -> durable repository write
  -> Pages publishes analysis JSON
```

The cadence may be changed later only after observing actual evidence publication times.
