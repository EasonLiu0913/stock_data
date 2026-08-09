# 成品油緊張程度因子（Refined Product Tightness Factor）

Methodology version: `refined_product_tightness_v1`

## 目的

建立一個可重現、可回測的市場環境研究因子，用來描述「中間餾分油相對原油的供需緊張程度」。

此因子目前只屬於 **research / market context**，不得直接作為固定策略的 gate、不得隱藏股票、不得直接改變正式預測方向。

## 為什麼不是只看 Brent

Brent 同時受到原油供給、地緣政治、OPEC+、庫存與金融市場等因素影響。成品油裂解價差則提供 downstream 供需與煉油環節的額外資訊。

但裂解價差也不是純需求指標：煉油廠停工、煉油產能不足、戰爭、制裁、季節性與區域供給都可能讓價差擴張。因此本因子名稱是「成品油緊張程度」，而不是「工業景氣指數」。

## 官方資料來源

使用 U.S. Energy Information Administration (EIA) Open Data API：

- Jet fuel：`PET.EER_EPJK_PF4_RGC_DPG.D`
- ULSD / Diesel：`PET.EER_EPD2DXL0_PF4_RGC_DPG.D`
- Brent：`PET.RBRTE.D`

Jet 與 Diesel 單位為 USD/gallon；Brent 為 USD/barrel。

## 裂解價差

```text
Jet crack = Jet spot (USD/gal) * 42 - Brent spot (USD/bbl)
Diesel crack = ULSD spot (USD/gal) * 42 - Brent spot (USD/bbl)
```

只有 Jet、Diesel、Brent 三個系列在同一天都有資料時，該日才進入 aligned history。

## v1 分數

不採用固定 `$15` / `$40` 美元門檻，因為不同年代、煉油產能與供應事件會改變合理區間。

改用 trailing approximately 5-year percentile：

```text
level_score
  = average(Jet crack 5y percentile, Diesel crack 5y percentile)

momentum_score
  = average(
      Jet 20-trading-day crack change 5y percentile,
      Diesel 20-trading-day crack change 5y percentile
    )

refined_product_tightness_score
  = 70% * level_score
  + 30% * momentum_score
```

輸出範圍為 `0–100`。

### 描述性區間

- `<20`: 非常寬鬆 `very_loose`
- `20–39.9`: 偏鬆 `loose`
- `40–59.9`: 中性 `balanced`
- `60–79.9`: 偏緊 `tight`
- `>=80`: 非常緊張 `very_tight`

這些只是描述性分箱，不是買賣門檻。

## 同步確認

另外輸出 Jet / Diesel 20 日方向：

- `both_rising_20d`
- `both_falling_20d`
- `mixed_20d`

同步方向比單一產品更有研究價值，因為 Jet 可能受航空旅行需求影響，而 Diesel 更直接反映陸運、工業、建築與其他中間餾分油需求。

## 輸出欄位

每次產生：

```text
data_refined_product_tightness/YYYYMMDD/refined_product_tightness.json
```

包含：

- 0–100 score
- state / label
- level score
- momentum score
- Jet crack / Diesel crack
- 5 年 percentile
- 5 / 20 / 60 交易日價差變化
- Jet / Diesel 20 日同步狀態
- Brent spot
- EIA series identity
- methodology version
- interpretation warning

並維護：

```text
data_refined_product_tightness/files.json
data_refined_product_tightness/manifest.json
```

## 執行方式

EIA API 需要免費 API key，Repository Actions secret 名稱固定為：

```text
EIA_API_KEY
```

本機可直接執行：

```bash
EIA_API_KEY=... node scripts/crawl_refined_product_tightness.js --date 20260807
```

未指定 `--date` 時，使用目前 UTC 日期作為查詢上限；實際輸出日期使用三個 EIA 系列最後一個共同有效交易日。

## GitHub Actions 自動收集

Workflow：

```text
.github/workflows/crawl-refined-product-tightness.yml
```

顯示名稱：

```text
[02 外部市場] EIA－成品油緊張程度
```

排程為台灣時間週二至週六約 07:20，每日檢查一次 EIA 是否已出現新的共同 observation date。

EIA APIv2 的資料庫持續更新，不假設所有產品都有共同固定發布時間。因此 workflow 採「每日檢查、日期不變則不寫入」模式：

- 新 observation date：產生新 snapshot、更新 manifest 並 commit 到 `main`。
- observation date 已存在：預設保留既有 immutable research snapshot，不產生 commit。
- EIA 後續修訂同一天資料：手動執行 workflow 並設定 `force_overwrite=true` 才覆寫。
- `date` 可指定歷史查詢上限，支援日後研究與回填。

這個 workflow 不使用 `workflow_run`，也不串接 Prediction、Replay 或 Pages deployment。

## 下一階段研究

先累積／回填歷史資料，再驗證：

1. Score 對台股大盤 D+1 / D+5 / D+20 是否有穩定解釋力。
2. 對台塑化等煉油股的解釋力是否高於只看 Brent。
3. 對航空、貨櫃、散裝、塑化、原物料、景氣循環股是否存在方向差異。
4. `Brent ↑ + crack ↓` 是否比單獨 Brent 對需求轉弱更早出現。
5. Jet 與 Diesel 同步下降是否比單一 crack 更穩定。
6. 供給事件（煉油廠停工、戰爭、制裁）期間是否需要另外標記 regime，而不是誤判成需求改善。

只有在歷史證據充分後，才考慮把它升級成 production strategy input。
