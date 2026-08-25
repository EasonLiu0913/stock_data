# Institutional data recovery and publication

## Problem

Fubon institutional data can become available gradually. A scheduled crawl may therefore produce only a small subset of the stock universe, while later crawls or retry runs can fill the missing stocks. Partial data is valid evidence and should not be discarded, but the UI must not present it as a complete daily snapshot.

A second failure mode exists at the publication boundary: commits pushed by a GitHub Actions workflow with `GITHUB_TOKEN` must not be assumed to trigger a separate push-based Pages workflow. Data can therefore be complete on `main` while GitHub Pages still serves an older partial snapshot.

## Recovery model

The institutional pipeline is intentionally incremental:

```text
crawl successful rows
  -> merge into fubon_YYYYMMDD_institutional.json
  -> reconcile completeness
  -> persist retry list + status metadata
  -> commit / push main
  -> explicitly call deploy-pages.yml
```

Retry uses the same reconciliation step before and after retrying so that a missing or stale failed-list cannot silently stop recovery.

## Canonical health status

Each target date may publish:

```text
data_fubon/fubon_YYYYMMDD_institutional_status.json
```

The institutional health universe is the four-digit numeric listed-stock codes from `data_twse/twse_industry.csv`. Non-stock instruments such as `01001T` are intentionally excluded because Fubon may permanently return `--` for institutional columns and those instruments must not make stock completeness appear lower than it is.

For every eligible stock, the status validates that the target ROC date exists in all four institutional fields:

- `ForeignInvestors`
- `InvestmentTrust`
- `Dealers`
- `DailyTotal`

The status records:

- universe stock count;
- valid stock count;
- missing stock count;
- completion rate;
- retry reason counts;
- sentinel availability for `1101`, `2330`, `2317`, `2882`;
- comparison with the latest previous institutional snapshot;
- quality flags used to classify the snapshot.

Status values:

- `provider_not_ready`: completion is below 30% and at least 80% of missing eligible stocks are recoverable provider/missing-date conditions;
- `partial`: data is usable but has not reached the ready rule;
- `ready`: no eligible stock is missing, or coverage is at least 98%, the previous reference count has been reached, all sentinels are present, and no recoverable eligible-stock gap remains.

These thresholds are publication/observability semantics, not a write gate. Partial data remains stored so later runs can add to it.

## Retry-list reconciliation

`reconcile_institutional_data.js` rebuilds the failed list from the eligible stock universe and target-date coverage. Existing crawler errors are normalized to reasons such as:

- `DATA_MISSING`
- `NOT_EXPECTED_DATE`
- `EMPTY_DATA`
- `OTHER_ERROR`

Any eligible stock absent from the target-date snapshot is added as `MISSING_TARGET_DATE`, which is recoverable and will be retried. When no eligible stock is missing, the failed list is removed. Non-stock instruments are not placed in the reconciled retry list.

This guarantees that a zero-success crawl can still leave a retryable state instead of silently losing the target date.

## Frontend contract

`public/foreign.html` reads the status file independently from the institutional data file.

Incomplete dates must visibly render, for example:

```text
資料狀態：更新中 4 / 1305（0.3%）
```

Ready dates render the same denominator transparently, for example:

```text
資料狀態：已完成 1305 / 1305（100.0%）
```

A status-only date is still selectable even when the main institutional file has zero successful rows, allowing the page to show `更新中 0 / N` rather than hiding the date. Legacy dates without health metadata are labeled as lacking completeness metadata instead of being guessed complete.

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
