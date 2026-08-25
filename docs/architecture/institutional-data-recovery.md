# Institutional data recovery and publication

## Problem

Fubon institutional data can become available gradually. A scheduled crawl may therefore produce only a small subset of the stock universe, while later crawls or retry runs can fill the missing stocks. Partial data is valid evidence and should not be discarded, but the UI must not present it as a complete daily snapshot.

A second failure mode exists at the publication boundary: commits pushed by a GitHub Actions workflow with `GITHUB_TOKEN` must not be assumed to trigger a separate push-based Pages workflow. Data can therefore be complete on `main` while GitHub Pages still serves an older partial snapshot.

## Recovery model

The institutional pipeline is intentionally incremental:

```text
resolve eligible stock universe
  -> crawl only target-date incomplete eligible stocks
  -> merge eligible successful rows into fubon_YYYYMMDD_institutional.json
  -> reconcile completeness
  -> persist retry list + status metadata
  -> commit / push main
  -> explicitly call deploy-pages.yml
```

Retry uses the same reconciliation step before and after retrying so that a missing or stale failed-list cannot silently stop recovery.

## One eligible-stock universe

The canonical institutional stock-universe logic lives in:

```text
scripts/lib/institutional_data_common.js
```

`readEligibleStockUniverse()` reads `data_twse/twse_industry.csv` and accepts only four-digit numeric listed-stock codes (`/^\d{4}$/`). This is shared by crawler, retry, and reconcile instead of reimplementing three different CSV filters.

Examples intentionally excluded from this institutional stock universe include:

- `0050` — ETF;
- `00631L` — leveraged ETF;
- `01001T` — special/non-stock instrument.

This exclusion happens before browser requests are queued. It is not only a health-status filter. Existing institutional JSON is also sanitized to the same universe before crawler/retry rewrites it, so obsolete non-stock rows do not persist forever.

`public/foreign.html` applies the same four-digit guard while reading historical JSON. This keeps old snapshots visually consistent even if those files were produced before the canonical universe was introduced.

## Canonical health status

Each target date may publish:

```text
data_fubon/fubon_YYYYMMDD_institutional_status.json
```

For every eligible stock, the status validates that the target ROC date exists in all four institutional fields:

- `ForeignInvestors`
- `InvestmentTrust`
- `Dealers`
- `DailyTotal`

Current status schema is `schema_version: 2`. It records:

- universe stock count;
- valid stock count;
- missing stock count;
- completion rate;
- retry reason counts;
- sentinel availability for `1101`, `2330`, `2317`, `2882`;
- comparison with the latest previous institutional snapshot;
- quality flags and anomaly flags.

Status values:

- `provider_not_ready`: completion is below 30% and at least 80% of missing eligible stocks are recoverable provider/missing-date conditions;
- `partial`: data is usable but has not reached the ready rule;
- `ready`: no eligible stock is missing, or coverage is at least 98%, the previous reference count has been reached, all sentinels are present, and no recoverable eligible-stock gap remains;
- `abnormal`: the snapshot would otherwise be ready, but a universe/reference/sentinel anomaly requires attention.

Current anomaly flags include:

- `UNIVERSE_TOO_SMALL`;
- `UNIVERSE_DROP_GT_10_PERCENT`;
- `SENTINEL_MISSING`;
- `REFERENCE_VALID_DROP_GT_10_PERCENT`.

These thresholds are publication/observability semantics, not a write gate. Partial data remains stored so later runs can add to it.

## Retry-list reconciliation

`reconcile_institutional_data.js` rebuilds the failed list from the eligible stock universe and target-date coverage. Structured crawler/retry reasons include:

- `DATA_MISSING`;
- `NOT_EXPECTED_DATE`;
- `EMPTY_DATA`;
- `PARSE_ERROR`;
- `REQUEST_ERROR`;
- `OTHER_ERROR` for unknown legacy errors.

Any eligible stock absent from the target-date snapshot is added as `MISSING_TARGET_DATE`, which is recoverable and will be retried. When no eligible stock is missing, the failed list is removed. Non-stock instruments are not placed in the reconciled retry list, and retry also rejects stale ineligible failed items before launching Chromium.

This guarantees that a zero-success crawl can still leave a retryable state instead of silently losing the target date.

## Trading-day guard

Crawler, retry, and reconcile use the shared TWSE trading-day helper before doing data work. Known weekends and configured exchange holidays are skipped. A direct CLI invocation of reconcile on a non-trading day is therefore read-only and must not create a fake `0 / N` status or failed list.

## Frontend contract

`public/foreign.html` reads the status file independently from the institutional data file.

Incomplete dates must visibly render, for example:

```text
資料狀態：更新中 4 / 1097（0.4%）
```

Ready dates render the same denominator transparently, for example:

```text
資料狀態：已完成 1097 / 1097（100.0%）
```

The exact denominator is data-driven from the current eligible four-digit stock universe; the numbers above are examples, not hard-coded thresholds.

A status-only date is still selectable even when the main institutional file has zero successful rows, allowing the page to show `更新中 0 / N` rather than hiding the date. Legacy dates without health metadata are labeled as lacking completeness metadata instead of being guessed complete.

The page's table rows are also restricted to the same four-digit eligible stock-code shape, so historical files that contain ETFs or special instruments do not create a mismatch between the visible table and health denominator.

## Actions observability

Both crawler and retry write a GitHub Actions Summary containing current completeness, missing-reason counts, sentinels, reference comparison, and anomaly flags. Retry additionally reports how many eligible missing stocks existed before the retry and how many were recovered in that run.

## Publication boundary

Both institutional writer workflows explicitly call the canonical reusable Pages workflow after the writer job succeeds:

```text
crawl/retry
  -> reconcile
  -> commit / push main
  -> needs: writer
  -> uses: ./.github/workflows/deploy-pages.yml
```

Do not replace this with `workflow_run`, `repository_dispatch`, or reliance on a bot-generated `push` event. The canonical Pages workflow checks out the latest `main`, so the published artifact contains the final committed recovery state.
