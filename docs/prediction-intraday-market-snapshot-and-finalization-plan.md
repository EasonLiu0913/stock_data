# 預測當下市場快照與收盤定稿流程規劃

- 文件狀態：討論與設計紀錄，尚未代表已完成實作
- 建立日期：2026-08-06
- 適用專案：`EasonLiu0913/stock_data`
- 主要時區：`Asia/Taipei`

## 1. 背景

目前股票預測通常由人工在台灣時間晚上至凌晨執行：

- 常見時間：22:00～23:59
- 也可能延後至：00:00～03:00

在這段時間內：

- 台指期夜盤仍在交易。
- 美國股市及其他外部市場可能正在交易。
- 預測執行當下已經存在可使用的最新行情，但尚未形成完整收盤資料。

原本流程主要依賴：

- 期交所盤後交易日報或每日 OpenAPI 資料。
- Yahoo Finance `interval=1d` 的外部市場日資料。

這些來源較適合「收盤後定稿」，不適合表示預測產生當下的盤中狀態，因此容易出現：

> 缺台指期夜盤結構化資料。

這個提示不一定代表市場沒有資料，而可能只是目前流程尚未接入盤中即時快照。

---

## 2. 已確認事項

### 2.1 台指期夜盤時間

TX 夜盤時段為：

```text
15:00 ～ 次日上午 05:00
```

例如，提供 2026/08/06 台股預測使用的夜盤為：

```text
2026/08/05 15:00
～
2026/08/06 05:00
```

它的正式交易歸屬日是 `20260806`。

### 2.2 即時夜盤快照確實可以取得

2026/08/06 02:52 的測試已成功從期交所即時行情端點取得 TX 近月快照，包含：

- 商品與契約月份
- 最新成交價
- 漲跌與漲跌幅
- 買一、賣一
- 夜盤開盤價
- 截至當時最高、最低
- 累計成交量
- 參考價
- 最後成交時間

測試結果保存於：

```text
data_market_constraints/diagnostics/current-night-snapshot.json
```

測試端點：

```text
https://mis.taifex.com.tw/futures/api/getQuoteList
```

因此，預測執行時即時抓取正在交易中的夜盤，在技術上可行。

### 2.3 即時 API 日期與正式交易日不同

即時行情回傳的 `CDate` 是夜盤開始的日曆日期。

例如：

```text
API CDate：20260805
實際時段：2026/08/05 15:00 ～ 2026/08/06 05:00
正式交易歸屬日：20260806
```

因此未來不可直接把 `CDate` 當作 `forecast_date`，必須透過台灣交易日行事曆轉換成下一個有效交易日。

---

## 3. 核心設計原則

資料必須分成兩套，而且不可互相覆寫。

### 3.1 預測當下快照

使用者按下「每日產生股票預測」Action 時，立即取得：

- 當時的 TX 夜盤即時行情。
- 當時的外部市場盤中行情。

這份資料代表：

> 預測產生當下，系統真正看得到的資訊。

必須永久保留，供日後覆盤與研究使用。

### 3.2 收盤後最終資料

夜盤與外部市場收盤後，由自動化 Action 取得：

- TX 夜盤最後即時快照。
- 期交所正式盤後日報。
- 美國市場與其他外部市場的正式收盤日資料。

這份資料代表：

> 當日市場完整結束後的最終結果。

用途是核對、比較與後續研究，不能回頭覆蓋預測當下快照。

### 3.3 防止未來資料洩漏

假設預測於 23:30 產生，隔天 05:00 或 07:00 才取得的最終資料，不能回填成 23:30 時已知資料。

錯誤做法：

```text
23:30 產生預測
→ 隔天以完整夜盤收盤值覆蓋原始市場環境
```

正確做法：

```text
23:30 保存 prediction snapshot
05:10 保存 realtime close snapshot
07:10 保存 official final snapshot
三者並存，互不覆寫
```

---

## 4. 建議資料模型

### 4.1 預測當下市場資料

建議目錄：

```text
data_prediction_context/<forecast_date>/snapshots/<captured_at>/
  manifest.json
  night-futures.json
  external-market.json
```

例如：

```text
data_prediction_context/20260806/snapshots/20260805T233000+0800/
```

`manifest.json` 建議內容：

```json
{
  "schema_version": 1,
  "forecast_date": "20260806",
  "captured_at": "2026-08-05T23:30:00+08:00",
  "prediction_run_id": "...",
  "prediction_stage": "live_snapshot",
  "night_futures_status": "in_progress",
  "external_market_status": "regular_session",
  "is_final": false
}
```

### 4.2 夜盤盤中快照欄位

建議保留：

```json
{
  "source_calendar_date": "20260805",
  "trading_date": "20260806",
  "forecast_date": "20260806",
  "observed_at": "2026-08-05T23:30:00+08:00",
  "session_start": "2026-08-05T15:00:00+08:00",
  "scheduled_session_end": "2026-08-06T05:00:00+08:00",
  "session_status": "in_progress",
  "is_final": false,
  "contract": "TX",
  "contract_month": "202608",
  "last_price": 0,
  "reference_price": 0,
  "change": 0,
  "change_percent_as_of": 0,
  "open": 0,
  "high_so_far": 0,
  "low_so_far": 0,
  "volume_so_far": 0,
  "best_bid_price": 0,
  "best_bid_size": 0,
  "best_ask_price": 0,
  "best_ask_size": 0,
  "quote_time": ""
}
```

盤中資料必須使用：

- `change_percent_as_of`
- `high_so_far`
- `low_so_far`
- `volume_so_far`

避免使用容易被誤解為最終值的 `close`。

### 4.3 外部市場盤中快照欄位

目前外部市場設定包含：

- Nasdaq Composite
- S&P 500
- Dow Jones
- SOX
- TSM ADR
- USD/TWD
- WTI
- Brent

每個指標建議保留：

```json
{
  "id": "nasdaq",
  "symbol": "^IXIC",
  "market_date": "20260805",
  "observed_at": "2026-08-05T23:30:00+08:00",
  "market_status": "regular_session",
  "last_price": 0,
  "previous_close": 0,
  "change": 0,
  "change_percent_as_of": 0,
  "open": 0,
  "high_so_far": 0,
  "low_so_far": 0,
  "volume_so_far": 0,
  "is_final": false
}
```

不同指標可能處於不同市場狀態，不能只設定一個全域狀態。可能值包括：

- `pre_open`
- `regular_session`
- `after_hours`
- `closed`
- `unavailable`

---

## 5. 每日產生預測 Action 的建議流程

現有 Action：

```text
[04 預測覆盤] 每日產生股票預測
```

建議重新排列為：

```text
1. 解析預測目標交易日與基準交易日
2. 判斷目前時間及市場狀態
3. 抓取預測當下 TX 夜盤即時快照
4. 抓取預測當下外部市場即時快照
5. 驗證資料時間不可晚於預測 captured_at
6. 建立不可變 prediction context 與 snapshot hash
7. 產生市場環境
8. 產生 V1
9. 產生 V2
10. 套用標籤與版本化策略
11. 產生 Dashboard
12. 部署 GitHub Pages
```

### 5.1 預測執行時間

使用者目前通常在：

```text
22:00～23:59
或
00:00～03:00
```

執行預測。

建議最佳共同區間為：

```text
22:30～03:00 Asia/Taipei
```

原因：

- TX 夜盤正在交易。
- 美國市場在夏令與冬令時間通常都已進入正常交易。
- Nasdaq、SOX、TSM ADR 等指標較可能已有盤中行情。

22:00 仍可執行，但冬令時間美國現貨市場可能尚未正式開盤，必須標記為 `pre_open`，不可冒充盤中資料。

### 5.2 同一日期重跑預測

同一 `forecast_date` 可能有多次預測執行。

建議每次建立獨立的：

- `prediction_run_id`
- `captured_at`
- `snapshot_hash`

不能只保留最後一次快照，否則無法研究不同預測時間的效果。

---

## 6. 夜盤與外部市場收盤定稿 Action

建議將盤後資料更新定位為：

```text
[03 晨間補充] 夜盤與外部市場收盤定稿
```

這個流程只建立最終市場資料與比較資料，不修改原始預測快照。

### 6.1 台灣時間 05:10：TX 即時收盤快照

排程：

```text
週二～週六 05:10 Asia/Taipei
```

用途：

- TX 夜盤已於 05:00 結束。
- 從期交所即時行情端點取得最後成交資訊。
- 保存為接近最終值的即時收盤快照。

建議狀態：

```json
{
  "session_status": "closed",
  "finalization_status": "realtime_close",
  "official_daily_report_ready": false,
  "is_final": false
}
```

這一筆不應被稱為正式日報定稿。

### 6.2 紐約時間 17:10：外部市場正式收盤

排程：

```text
週一～週五 17:10 America/New_York
```

換算台灣時間約為：

- 夏令時間：05:10
- 冬令時間：06:10

用途：

- 定稿 Nasdaq、S&P 500、Dow、SOX、TSM ADR。
- 更新 USD/TWD、WTI、Brent。
- 驗證主要五個美國市場指標的 `market_date` 一致。
- 產生正式 `data_external_market/<market_date>/external_market_indicators.json`。

現有 `crawl-external-market-indicators.yml` 已使用紐約時間 17:00 後作為安全門檻，其定位應保留為收盤後正式資料，而不是盤中預測快照。

### 6.3 台灣時間 07:10：TX 正式日報定稿

排程：

```text
週二～週六 07:10 Asia/Taipei
```

用途：

- 取得期交所正式盤後交易日報。
- 核對 05:10 保存的即時收盤快照。
- 保存正式完整夜盤資料。

建議狀態：

```json
{
  "session_status": "final",
  "finalization_status": "official_daily_report",
  "is_final": true
}
```

### 6.4 台灣時間 07:40：正式夜盤資料重試

排程：

```text
週二～週六 07:40 Asia/Taipei
```

用途：

- 只有 07:10 尚未取得正式日報時才執行。
- 若資料已完整，直接成功退出。

---

## 7. 建議排程總表

| 時間 | Action | 資料性質 | 是否覆寫預測快照 |
|---|---|---|---|
| 使用者手動執行 | 每日產生股票預測 | TX 與外部市場盤中快照 | 建立新快照，不覆寫 |
| 05:10 台灣 | TX 即時收盤快照 | 夜盤最後即時行情 | 否 |
| 17:10 紐約 | 外部市場正式收盤 | 美國市場正式日資料 | 否 |
| 07:10 台灣 | TX 正式日報定稿 | 期交所正式盤後日報 | 否 |
| 07:40 台灣 | TX 正式日報重試 | 缺資料才補抓 | 否 |

注意：美國市場的 17:10 紐約排程，在台灣時間可能早於或晚於 TX 正式日報流程，兩者不應互相依賴。

---

## 8. 日期歸屬規則

### 8.1 一般週間

預測目標：

```text
2026/08/06 台股
```

預測執行：

```text
2026/08/05 23:30
```

資料對應：

```text
TX 夜盤：
2026/08/05 15:00 ～ 2026/08/06 05:00
正式交易日：20260806

外部市場：
美國市場日期 20260805
```

### 8.2 跨午夜

以下時間都屬於同一段 TX 夜盤：

```text
2026/08/05 22:30
2026/08/05 23:59
2026/08/06 00:30
2026/08/06 03:00
```

不可因為跨過 00:00 就改成另一段夜盤。

### 8.3 週末與休市日

星期五 15:00 至星期六 05:00 的夜盤，通常歸屬下一個台灣交易日，也就是星期一；若星期一休市，則歸屬下一個有效交易日。

因此日期解析必須使用台灣交易日行事曆：

```text
session_start_calendar_date
→ next_twse_trading_date
→ forecast_date
```

不可直接使用：

```text
CDate + 1 個日曆日
```

---

## 9. 盤中訊號如何使用

夜盤尚未收盤時，可以作為預測訊號，但必須表示為「截至目前」。

例如原規則：

```text
台指期夜盤 ≥ +2%
```

盤中應解讀為：

```text
截至 captured_at，台指期夜盤漲幅 ≥ +2%
```

不能解讀為：

```text
完整夜盤最終漲幅 ≥ +2%
```

未來可研究的盤中資訊包括：

- 最新漲跌幅
- 自開盤以來方向
- 截至當時最高與最低
- 從最高點回落幅度
- 從最低點反彈幅度
- 累計成交量
- 買賣價差
- TX 與 Nasdaq、SOX、TSM ADR 是否同方向
- 不同 captured_at 對隔日台股預測力的差異

---

## 10. 收盤資料更新後是否重跑預測

預設不應覆蓋或重跑原始 V1、V2。

建議保留：

```text
prediction_stage: live_snapshot
```

代表晚上或凌晨預測當下的版本。

若未來希望在開盤前再產生一版，可新增：

```text
prediction_stage: preopen_final
```

兩個版本並存：

| 版本 | 使用資料 | 用途 |
|---|---|---|
| `live_snapshot` | 預測執行當下盤中資料 | 真實模擬當時決策 |
| `preopen_final` | 夜盤與外部市場收盤後資料 | 開盤前最終判斷 |

不能用 `preopen_final` 覆蓋 `live_snapshot`。

---

## 11. Dashboard 與研究用途

收盤後可建立比較卡片：

| 指標 | 預測當下 | 最終收盤 | 差異 |
|---|---:|---:|---:|
| TX 夜盤 | -0.32% | +0.18% | +0.50% |
| Nasdaq | +1.10% | +0.55% | -0.55% |
| SOX | +2.30% | +1.42% | -0.88% |
| TSM ADR | +1.80% | +0.91% | -0.89% |

可用來研究：

- 夜盤後半段是否經常翻轉。
- 22:30、23:30、01:00、03:00 哪個時間的快照最有預測力。
- 盤中訊號與最終訊號哪一個更適合隔日台股。
- 預測過早或過晚造成的資訊差異。
- 哪些策略容易受外部市場盤中翻轉影響。

---

## 12. 現有流程與未來角色

### `.github/workflows/daily-stock-prediction.yml`

未來角色：

- 預測主流程。
- 在市場環境產生前，先抓取不可變盤中市場快照。
- V1、V2 必須共用同一個 prediction context hash。

### `.github/workflows/crawl-external-market-indicators.yml`

目前角色：

- 使用 Yahoo Chart `interval=1d`。
- 紐約時間 17:00 後才允許定稿。
- 驗證主要五個市場指標日期一致。

未來角色：

- 保留為外部市場正式收盤定稿流程。
- 不直接充當預測盤中快照。

### `.github/workflows/update-official-market-constraints.yml`

目前角色：

- 抓正式處置股與台指期夜盤日資料。
- 排程為台灣時間 04:30、05:05、06:06。

未來角色：

- 05:10 保存 TX 即時收盤快照。
- 07:10、07:40 取得與重試正式夜盤日報。
- 不依賴預測摘要是否已存在才保存市場資料。

---

## 13. 尚待確認與實作項目

在正式修改流程前，仍需逐項確認：

1. 外部市場盤中資料要使用 Yahoo 即時 quote、chart intraday，或其他來源。
2. 每個來源的延遲、授權及穩定性。
3. 美國夏令／冬令時間的市場狀態判斷。
4. 期交所即時端點是否需要 session cookie、重試與頻率限制。
5. TX 近月契約換月規則。
6. 星期五夜盤、國定假日與補班交易日的日期歸屬。
7. 同一預測日期多次執行時，Dashboard 如何選擇預設快照。
8. `live_snapshot` 與 `preopen_final` 是否都要產生完整 V1、V2。
9. 收盤定稿後是否只更新比較資料，或另外發布開盤前版本。
10. 舊資料缺乏歷史盤中快照時，回測應明確標示不可重建，不可用收盤值冒充。

---

## 14. 目前建議結論

最合理的整體架構是：

```text
使用者手動執行每日預測
    ↓
立即抓 TX 即時盤中快照
立即抓外部市場盤中快照
    ↓
固定 prediction context 與 captured_at
    ↓
產生 V1／V2／策略／Dashboard／Pages

05:10 Asia/Taipei
    ↓
保存 TX 最後即時收盤快照

17:10 America/New_York
    ↓
保存外部市場正式日資料

07:10 Asia/Taipei
    ↓
保存 TX 正式盤後日報
建立 final market context 與比較資料
不覆寫原始預測

07:40 Asia/Taipei
    ↓
正式夜盤日報缺失時重試
```

此設計同時保障：

- 預測當下資訊的真實性。
- 收盤後最終資料的完整性。
- 歷史覆盤不產生未來資料洩漏。
- 同一天不同預測時間可比較。
- 夏令時間、週末與休市日可正確處理。
- 未來可進一步研究最佳預測產生時間。
