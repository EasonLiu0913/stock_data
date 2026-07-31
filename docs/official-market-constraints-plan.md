# 官方處置股與台指期夜盤資料接入規劃

## 目的

為 `oversold_electronics_rebound_v1` 補上正式處置股排除，並為 `oversold_beta_rebound_v1` 補上台指期夜盤訊號。兩者仍維持獨立：處置股只影響固定個股策略；夜盤只影響市場反彈準備度。

## 官方來源

### 上市處置有價證券

- 來源：TWSE OpenAPI `announcement/punish`
- 主要欄位：公布日期、證券代號、證券名稱、處置期間、處置措施、處置內容。
- 注意：回傳內容包含權證與其他有價證券。策略判斷只使用四位數股票代號，並在正式接線時再與預測股票 universe 交集。

### 上櫃處置有價證券

- 來源：TPEx OpenAPI `tpex_disposal_information`
- 主要欄位：證券代號、公司名稱、公告日期、處置期間、處置條件、處置措施。
- 完整性規則：TWSE 與 TPEx 必須同時成功，才能標記 `complete_market_coverage=true`。任一來源失敗時，不可宣稱已完成全市場處置股排除。

### 台指期夜盤

- 來源：TAIFEX OpenAPI `DailyMarketReportFut`
- 契約：`TX`
- 交易時段：盤後交易時段，不允許退回一般交易時段。
- 日期歸屬：15:00 至次日 05:00 的盤後交易，歸屬於次一一般交易日；因此預測日 `YYYYMMDD` 直接查同一個資料日期。
- 契約選擇：目標日期、TX、盤後時段、有成交，選最接近到期月份的契約。
- 分數欄位：優先使用官方漲跌百分比；若缺少才以 `漲跌價 / (最後成交價 - 漲跌價)` 重建。

## 建議資料格式

### `data_market_constraints/YYYYMMDD/disposition.json`

- `complete_market_coverage`
- `source_status.twse`
- `source_status.tpex`
- `active_stock_codes`
- `active_records`
- `warnings`

### `data_market_environment/YYYYMMDD/night_futures.json`

- `contract=TX`
- `target_date`
- `trading_session`
- `selected_contract_month`
- `open/high/low/last`
- `change/change_percent`
- `volume`
- `source_status`

## 接入策略

### 處置股

1. 在每日 V1 產生前或策略標籤計算前抓取 snapshot。
2. `oversoldElectronicsDecision` 先跑核心條件與流動性條件。
3. 若代號存在 `active_stock_codes`，加入 `active_disposition_security` 原因並排除。
4. 若兩個市場來源未完整成功，保留資料警告；不可把「查不到」當成「不是處置股」。
5. 策略 metadata 記錄 disposition snapshot 路徑與覆蓋狀態，確保覆盤可重現。

### 夜盤

1. 個股預測與固定候選仍使用前一交易日收盤資料產生，不因夜盤重建候選。
2. 預測日 05:00 盤後時段結束後，於約 06:30 至 07:30 重新抓取 TAIFEX 日報。
3. 只重算 `oversold_beta_rebound_v1`，不修改 V1/V2 方向分數與個股候選。
4. 若官方日報尚未更新，夜盤維持 N/A，排程可在 20 分鐘後重試，最多三次。

## 時程與 workflow 建議

- `prepare-official-market-constraints.yml`
  - 工作日 06:40、07:00、07:20 條件式重試夜盤。
  - 每次也刷新處置股資料。
  - 成功後重算 readiness 與固定策略標籤。
- 每日預測 workflow 仍執行一次來源抓取作為防呆。
- 歷史回填不可使用「今天抓到的目前名單」推回歷史日期；必須使用當日保存的 snapshot，或另走官方歷史查詢／付費歷史檔。

## 驗收條件

1. 解析器 fixture 單元測試全部通過。
2. GitHub-hosted runner 能取得三個官方來源。
3. 真實資料可辨識 TWSE、TPEx 欄位與 TAIFEX 交易時段欄位。
4. 20260731 夜盤結果必須來自 TX 盤後時段，不能使用一般盤。
5. 任一處置來源失敗時，`complete_market_coverage=false`。
6. 夜盤不存在時，`change_percent=null`，不能變成 0。
