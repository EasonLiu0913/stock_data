# 官方處置股與台指期夜盤資料接入

## 目的

為 `oversold_electronics_rebound_v1` 接入正式處置股硬排除，並為 `oversold_beta_rebound_v1` 接入台指期夜盤訊號。兩者維持獨立：處置股只改變固定個股策略名單；夜盤只重算市場反彈準備度，不修改 V1/V2 原始方向分數。

## 官方來源

### 上市處置有價證券

- TWSE OpenAPI：`announcement/punish`
- 主要欄位：公布日期、證券代號、證券名稱、處置期間、處置措施、處置內容。
- 回傳內容可能包含權證與其他有價證券，策略只使用四位數股票代號。

### 上櫃處置有價證券

- TPEx OpenAPI：`tpex_disposal_information`
- 主要欄位：證券代號、公司名稱、公告日期、處置期間、處置條件、處置措施。
- TWSE 與 TPEx 必須同時成功，才標記 `complete_market_coverage=true` 並執行硬排除。任一來源失敗時保留候選，只顯示覆蓋不完整警告。

### 台指期夜盤

主要來源：

```text
https://www.taifex.com.tw/cht/3/futDailyMarketExcel
  ?commodity_id=TX
  &marketCode=1
  &queryDate=YYYY/MM/DD
```

- `TX`：臺股期貨。
- `marketCode=1`：盤後交易時段。
- 15:00 至次日 05:00 的盤後交易，歸屬於次一一般交易日，因此使用預測日查詢。
- 選擇目標日期、TX、盤後時段、有成交的最近到期月份。
- TAIFEX OpenAPI `DailyMarketReportFut` 只在回傳日期精確等於預測日時作備援，不允許使用舊日期，也不允許退回一般交易時段。

## 固定資料檔

```text
data_market_constraints/YYYYMMDD/disposition.json
data_market_constraints/YYYYMMDD/night-futures.json
data_market_constraints/YYYYMMDD/snapshot.json
```

`disposition.json` 區分：

- `active_record_count`：所有有效公告／措施紀錄。
- `active_stock_record_count`：四位數股票公告紀錄。
- `active_stock_count`：唯一四位數股票代號數。
- `active_stock_codes`：正式排除用唯一代號。

`snapshot.json` 只有在處置股完整覆蓋且夜盤可用時，才標記 `complete=true`。重試時若單一來源短暫失敗，會保留同日期先前已驗證成功的來源元件，避免完整資料被降級覆蓋。

資料檔會保留來源與抓取追蹤欄位，包括：

- `generated_at`
- `source_status.*.fetched_at`
- HTTP status
- 最終查詢網址
- 夜盤來源類型、契約月份與交易時段

## 正式處理流程

1. 晨間抓取 TWSE、TPEx 與 TAIFEX 指定日期資料。
2. 保存固定日期 snapshot。
3. 重新產生 Dashboard 欄位與固定策略標籤。
4. 用夜盤漲跌幅重算 `oversold_beta_rebound_v1`。
5. 只有處置股雙市場完整時，從 `oversold_electronics_rebound_v1` 移除有效處置股票。
6. 同步 `summary.json`、`group-summary.json` 與既有覆盤檔。
7. 驗證候選名單、來源日期、夜盤條件與覆盤名單一致後才提交。
8. 有檔案差異時，自動以 `data: update YYYYMMDD official market constraints (...)` 提交並推送至 `main`。

每日既有 backfill 若找不到官方 snapshot，會安全跳過正式限制，不影響原本預測流程。

## 晨間 workflow

Workflow：`[03 晨間補充] 正式處置股與台指期夜盤`

台灣時間工作日排程：

- 04:30
- 05:05
- 06:06

GitHub cron 使用 UTC，實際設定為：

```text
30 20 * * 0-4
5 21 * * 0-4
6 22 * * 0-4
```

GitHub Actions 可能延遲啟動，因此三個時間是分散式補抓時點。每一次排程觸發都會強制重新查詢官方來源，即使前一輪 snapshot 已標記 complete，也不會直接跳過。這可避免較早一輪抓到尚未定稿的夜盤數值後，後續排程沒有刷新。

若預測摘要尚不存在則跳過。來源尚未全部發布時可保存 partial snapshot；下一次排程會再查詢並補齊。若官方來源短暫失敗，會保留同日期已驗證成功的舊元件，不會用失敗結果覆蓋完整資料。

每次執行會在 Actions Summary 顯示：

- Snapshot 狀態與產生時間
- TWSE、TPEx 抓取時間
- 台指期夜盤漲跌幅
- 夜盤契約月份與交易時段
- 夜盤抓取時間與來源類型

只有檔案內容有差異才會 commit；由於排程刷新會更新來源抓取時間與 snapshot 時間，正常成功刷新時通常會產生新的資料 commit。

## 2026-07-31 實測與回填

- TWSE＋TPEx：54 筆有效處置紀錄。
- 四位數股票公告紀錄：31 筆。
- 唯一處置股票：26 檔。
- 原始跌深反彈電子股候選：238 檔。
- 排除 7 檔：`2483、2492、3026、3055、3090、3532、8028`。
- 正式候選：231 檔。
- TAIFEX 近月：`TX 202608`。
- 夜盤漲跌幅：`+3.90%`。
- 跌深反彈準備度：85 分提升為 100 分。
- 有效資料權重：85% 提升為 100%。
- 覆盤：231 檔候選、226 檔有收盤資料、198 檔嚴格大於 5%，命中率 87.61%。

## 防呆規則

1. 任一處置來源失敗時不做硬排除。
2. 歷史回填只使用該日期保存的 snapshot，不能拿目前名單推回歷史日期。
3. 夜盤回傳日期必須等於預測日。
4. 夜盤交易時段必須為盤後交易時段。
5. 夜盤不存在時維持 `null`／N/A，不能變成 0。
6. 處置股與夜盤不修改 V1/V2 原始方向分數。
7. 覆盤只使用預測時已保存的正式候選資格，不用收盤結果重新篩選。
