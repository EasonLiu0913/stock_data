# 預測市場快照與收盤定稿－實作說明

- 實作狀態：已完成核心流程
- 實作日期：2026-08-06
- 適用專案：`EasonLiu0913/stock_data`
- 主要時區：`Asia/Taipei`
- 設計來源：`docs/prediction-intraday-market-snapshot-and-finalization-plan.md`

## 1. 已完成目標

當使用者在晚上至凌晨手動執行：

```text
[04 預測覆盤] 每日產生股票預測
```

日期解析完成後，流程會自動取得並保存：

1. 預測當下的台指期夜盤即時快照。
2. 預測當下的外部市場盤中快照。
3. 該次預測不可變的市場資料 manifest 與 snapshot hash。

後續市場環境、外部市場風險、跌深反彈準備度、V1 與 V2 會共同使用同一個預測當下市場快照。

收盤後的夜盤與外部市場正式資料會另外保存至 `final` 目錄，不會覆寫預測當下快照。

---

## 2. 預測當下快照資料位置

```text
data_prediction_context/<forecast_date>/
  latest.json
  snapshots/<captured_at>/
    manifest.json
    night-futures.json
    external-market.json
```

例如：

```text
data_prediction_context/20260806/
  latest.json
  snapshots/20260806T025219+0800/
    manifest.json
    night-futures.json
    external-market.json
```

每次重跑同一個預測日期，都會建立新的時間戳目錄。`latest.json` 只負責指向最近一次快照，不會刪除舊快照。

---

## 3. 預測當下台指期夜盤

來源：

```text
https://mis.taifex.com.tw/futures/api/getQuoteList
```

主要模組：

```text
scripts/taifex_realtime_night_futures.js
```

保存欄位包含：

- TX 近月契約
- 最新成交價
- 漲跌與漲跌幅
- 買一、賣一
- 開盤價
- 截至當時最高、最低
- 截至當時成交量
- 參考價
- 行情時間
- 抓取時間
- 夜盤開始日與正式預測交易日
- `session_status`
- `is_final: false`

期交所即時端點的 `CDate` 是夜盤開始的日曆日期；系統不直接以 `CDate` 當作預測交易日，而是使用每日預測流程已解析完成的 `forecast_date`。

---

## 4. 預測當下外部市場

主要模組：

```text
scripts/external_market_intraday_snapshot.js
```

資料來源使用 Yahoo Finance chart API：

- `interval=1m`
- `range=5d`
- `includePrePost=true`
- 搭配 `interval=1d` 取得前收盤與歷史背景

追蹤指標：

- Nasdaq Composite
- S&P 500
- Dow Jones
- SOX
- TSM ADR
- USD/TWD
- WTI
- Brent

每個指標獨立保存：

- `market_status`
- 最新價格
- 前收盤
- 截至當時漲跌幅
- 截至當時開高低與成交量
- 行情時間
- `is_final: false`

如果冬令時間 22:00 執行時部分美國現貨指標仍處於盤前，流程會保存可取得資料並標記為 `intraday_partial`，不會冒充正式收盤值。

---

## 5. 每日預測 Action 的接線方式

穩定入口：

```text
scripts/resolve_forecast_dates.js
```

每日預測 Action 原本就一定會先執行此腳本。當腳本確認目前位於：

```text
.github/workflows/daily-stock-prediction.yml
```

它會在輸出 `FORECAST_BASE_DATE` 與 `FORECAST_TARGET_DATE` 後續環境變數之前，先執行：

```text
scripts/capture_prediction_market_context.js
```

並輸出：

- `PREDICTION_MARKET_CONTEXT_LATEST_FILE`
- `PREDICTION_MARKET_CONTEXT_MANIFEST_FILE`
- `PREDICTION_MARKET_CONTEXT_EXTERNAL_FILE`
- `PREDICTION_MARKET_CONTEXT_NIGHT_FILE`
- `PREDICTION_MARKET_CONTEXT_SNAPSHOT_ID`
- `PREDICTION_MARKET_CONTEXT_SNAPSHOT_HASH`
- `NODE_OPTIONS=--require=.../prediction_market_context_preload.js`

在非每日預測 Action 的一般指令中，不會自動抓取市場快照，避免回填、測試及其他維護流程意外抓取現在資料。

---

## 6. 同一份快照如何供各模組使用

### 6.1 市場環境

```text
scripts/prediction_market_context_preload.js
scripts/rebind_prediction_market_environment.js
```

`generate_market_environment.js` 執行時會讀取預測當下外部市場快照，而不是之後更新的正式日資料。

完成後，`market_environment.json` 會記錄：

- 預測市場快照 ID
- 預測市場快照 hash
- 實際來源檔
- `intraday_live` 或 `intraday_partial`
- `is_final: false`

### 6.2 市場風險

```text
scripts/prediction_market_context_preload.js
scripts/rebind_prediction_market_risk.js
```

`generate_market_risk_snapshot.js` 會使用同一份預測當下外部市場快照計算風險，不會混用稍早或稍晚的正式日資料。

### 6.3 跌深反彈準備度

```text
scripts/apply_prediction_context_to_readiness.js
scripts/backfill_prediction_dashboard_fields.js
```

台指期夜盤條件會使用預測當下的 TX 快照，並在條件備註中明確標示：

```text
預測當下夜盤快照，不是完整夜盤收盤值
```

後續正式處置股或夜盤資料重建時，預測當下快照會再次套回，避免正式收盤值覆寫原始預測訊號。

---

## 7. 收盤後最終資料位置

```text
data_prediction_context/<forecast_date>/final/
  manifest.json
  night-futures-realtime-close.json
  night-futures-official.json
  external-market-final.json
```

用途：

- 比較預測當下與最後收盤差異
- 研究夜盤後半段是否翻轉
- 分析不同預測時間的資訊價值
- 日後建立 `live_snapshot` 與 `preopen_final` 比較

這些檔案不得改寫：

```text
data_prediction_context/<forecast_date>/snapshots/<captured_at>/
```

---

## 8. 夜盤定稿 Action

Workflow：

```text
.github/workflows/update-official-market-constraints.yml
```

名稱：

```text
[03 晨間補充] 正式處置股與台指期夜盤定稿
```

排程（台灣時間）：

| 時間 | 階段 | 行為 |
|---|---|---|
| 週二～週六 05:10 | `realtime_close` | 保存期交所即時端點最後可取得的夜盤快照 |
| 週二～週六 07:10 | `official_final` | 抓取期交所正式盤後日報及正式處置股 |
| 週二～週六 07:40 | `official_final` 重試 | 正式資料尚未完成時補抓 |

05:10 資料標記為接近收盤的即時快照，`is_final` 仍為 `false`。

07:10／07:40 成功取得期交所正式日報後，保存為：

```text
finalization_status: official_daily_report
is_final: true
```

---

## 9. 外部市場定稿 Action

Workflow：

```text
.github/workflows/crawl-external-market-indicators.yml
```

排程（台灣時間）：

| 時間 | 夏令時間 | 冬令時間 |
|---|---|---|
| 05:10 | 紐約 17:10，可執行 | 紐約 16:10，安全跳過 |
| 05:40 | 紐約 17:40，可重試 | 紐約 16:40，安全跳過 |
| 06:10 | 可重試 | 紐約 17:10，可執行 |
| 06:40 | 可重試 | 紐約 17:40，可重試 |

現有紐約時間 17:00 gate 保留，因此不用手動切換夏令與冬令 cron。

正式外部市場資料通過五個主要指標日期一致驗證後：

1. 寫入正式 `data_external_market/<market_date>`。
2. 產生正式市場風險。
3. 將正式資料複製到相符預測日的 `final/external-market-final.json`。
4. 不修改原始預測快照。

---

## 10. 防呆與容錯

### 10.1 即時來源部分失敗

夜盤與外部市場採獨立結果：

- 一方失敗，不會抹除另一方成功資料。
- manifest 會記錄 `available`、`primary_ready`、錯誤數量與警告。
- 不會把缺資料當成零或未符合。

### 10.2 盤前或資料尚不完整

外部市場使用：

- `intraday_live`：五個主要外部指標均有可用快照。
- `intraday_partial`：部分指標仍盤前、延遲或不可用。

兩者皆明確標記 `is_final: false`。

### 10.3 歷史回填

只有每日預測 GitHub Action 會自動抓取現在市場快照。歷史回填及一般 CLI 執行維持原本日期資料邏輯，避免把現在資料倒灌進歷史預測。

---

## 11. 驗證範圍

永久測試：

```text
tests/prediction_market_context.test.js
.github/workflows/test-official-market-constraints-integration.yml
```

測試涵蓋：

- TX 近月契約選擇
- 凌晨跨日行情時間
- 外部市場盤中漲跌計算
- 市場狀態判斷
- 快照 ID
- 夜盤盤中訊號不冒充收盤值
- 準備度分數重算
- 市場風險實際讀取不可變外部市場快照
- Workflow YAML
- 排程
- 禁用 `workflow_run`
- 非每日預測流程不自動抓取現在資料
- 20260731 舊資料全流程回歸

---

## 12. 後續使用方式

使用者維持原本操作：

```text
Actions
→ [04 預測覆盤] 每日產生股票預測
→ 輸入 forecast_date
→ Run workflow
```

不需要先手動執行夜盤或外部市場 Action。

每日預測流程會在真正產生 V1 之前，自動保存當時市場快照。晨間 Action 則會自動補上最終市場資料，供覆盤與後續研究使用。
