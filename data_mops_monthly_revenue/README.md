# MOPS 上市公司月營收資料

資料來源：公開資訊觀測站（MOPS）上市公司每月營業收入統計表。

## 目錄

```text
data_mops_monthly_revenue/
├── files.json
├── manifest.json
└── YYYYMM/
    ├── monthly_revenue.json
    └── snapshots/
        └── YYYYMMDD_HHMMSS.json
```

`monthly_revenue.json` 是該營收月份目前最新的標準化資料；`snapshots/` 保留申報期間實際有變化的版本，用於估計公司資料第一次被觀測到的時間，避免未來做股價反應研究時把所有公司誤視為同一天公布。

## Snapshot 規則

每次爬取都會重新讀取 MOPS，並更新 `monthly_revenue.json`。`force_new_snapshot` 只控制是否一定保留一份新的 snapshot，不影響最新資料是否更新。

- `force_new_snapshot = false`：如果新抓到的 MOPS 原始來源 `source.sha256` 與上一份 snapshot 相同，會刪除本次重複 snapshot，只保留最新 `monthly_revenue.json`。
- `force_new_snapshot = true`：即使來源內容與上一份 snapshot 相同，也強制保留新的 snapshot。
- `collection.snapshot_count` 會依實際保留的 snapshot 檔案數重新校正。

因此一般定期抓取與歷史 backfill 建議維持 `false`，只有需要刻意保存「同內容、不同抓取時間」的觀測點時才勾選 `true`。

## 主要欄位

每家公司保留 MOPS 原始申報值：

- `monthly_revenue_thousand_twd`：當月營收，單位千元。
- `previous_month_revenue_thousand_twd`：上月營收。
- `last_year_month_revenue_thousand_twd`：去年同月營收。
- `mom_pct`：月增率。
- `yoy_pct`：年增率。
- `ytd_revenue_thousand_twd`：本年度累計營收。
- `last_year_ytd_revenue_thousand_twd`：去年同期累計營收。
- `ytd_yoy_pct`：累計年增率。
- `note`：MOPS 備註。
- `first_seen_at` / `last_seen_at`：本專案第一次與最近一次觀測到該公司本月份申報資料的時間。

## 第一階段衍生因子

`derived` 目前只保存不涉及未來資料的月營收因子：

- `yoy_positive`
- `yoy_ge_10`
- `yoy_ge_20`
- `yoy_ge_30`
- `mom_positive`
- `ytd_yoy_positive`
- `yoy_and_mom_positive`
- `previous_month_yoy_pct`
- `yoy_acceleration_pct_points`
- `yoy_accelerating`

其中 `yoy_acceleration_pct_points = 本月 YoY - 上月 YoY`。

## 完整度與 baseline

不以固定公司數或「每月 10 日」直接宣告完整。當前月份公司數會與**緊鄰的上一個營收月份**資料公司數比較。

`collection` 會保存：

- `baseline_month`
- `baseline_company_count`
- `expected_company_count`（相容欄位，等同 baseline company count）
- `coverage_ratio`
- `status`
- `is_complete`
- `status_calculated_at`

狀態規則：

- 緊鄰上一月份尚不存在：`baseline_seed`
- coverage < 98%：`collecting`
- coverage >= 98%：`likely_complete`

`baseline_seed` 是正常的資料邊界狀態，不代表資料錯誤。最早存在的月份可作為 seed；如果日後補入更早月份，原本 seed 會在 metadata 重建後自動改為引用新補入的上一月，而新的最早月份成為新的 `baseline_seed`。

例如最初只有：

```text
202606 → baseline_seed
202607 → baseline=202606
```

之後補入 `202605` 並重建：

```text
202605 → baseline_seed
202606 → baseline=202605
202607 → baseline=202606
```

如果月份中間有缺口，例如只有 `202605`、`202607` 而缺 `202606`，則 `202607` 暫時視為 `baseline_seed`；之後補入 `202606` 再重建，`202607` 會自動改為引用 `202606`。

## Metadata 重建

補抓歷史月份或修正既有月份後，可執行：

```bash
node scripts/rebuild_mops_monthly_revenue_metadata.js --from 202605
```

這個重建只更新可重算的 metadata 與前月衍生因子，不會改寫：

- MOPS 原始營收數值
- snapshot 歷史
- `first_seen_at`
- `last_seen_at`

自動爬取 workflow 每次抓取完成後，也會從本次最早受影響月份開始執行同樣的 metadata 重建，因此後補月份會自動向後修正 baseline chain。

完整度狀態是本專案的資料蒐集判斷，不代表法規上的正式申報完成認定。
