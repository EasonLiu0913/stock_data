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

`monthly_revenue.json` 是該營收月份目前最新的標準化資料；`snapshots/` 保留申報期間每次抓取的版本，用於估計公司資料第一次被觀測到的時間，避免未來做股價反應研究時把所有公司誤視為同一天公布。

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

## 完整度

不以固定公司數或「每月 10 日」直接宣告完整。當前月份公司數會與上一個月份標準化資料的公司數比較：

- coverage < 98%：`collecting`
- coverage >= 98%：`likely_complete`
- 尚無上一月 baseline：`baseline_unknown`

這是資料蒐集狀態，不代表法規上的正式申報完成認定。
