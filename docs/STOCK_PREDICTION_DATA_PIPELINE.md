# 股票預測資料流程

這份文件整理執行 `Generate all stock predictions` 前需要準備哪些來源檔案、這些檔案由哪個 GitHub Action 產生，以及各 workflow 的排程時間。

範例：如果要產生 `2026-07-27` 的預測，基準交易日是 `2026-07-24`，因此每日來源檔通常要有 `20260724` 這批資料。

## 必要來源檔案

| 必要檔案 | 在預測中的用途 | 來源 workflow | 排程時間 |
|---|---|---|---|
| `data_fubon/fubon_YYYYMMDD_sma.json` | 個股 OHLC、成交量、SMA5、SMA20、SMA60。這是最核心的價格資料。 | `Crawl SMA Data`<br>`.github/workflows/crawl-sma.yml` | 每天台北時間 13:32、14:27<br>UTC 05:32、06:27 |
| `data_twse_institutional_investors/YYYYMMDD_twse_institutional_investors.json` | 三大法人資料：外資、投信、自營商、合計。 | `Crawl TWSE Institutional Investors`<br>`.github/workflows/crawl-twse-institutional-investors.yml` | 平日台北時間 16:11、17:33、18:17、19:19、20:23、21:29、22:31<br>UTC 08:11、09:33、10:17、11:19、12:23、13:29、14:31 |
| `data_twse_margin_balance/YYYYMMDD_twse_margin_balance.csv` | 融資餘額變動。 | `Crawl TWSE Margin Balance`<br>`.github/workflows/crawl-twse-margin-balance.yml` | 平日台北時間 20:17、21:23、22:29<br>UTC 12:17、13:23、14:29 |
| `data_fubon_broker_details/fubon_YYYYMMDD_券商分點進出明細.json` | 券商分點與主力買賣超。 | `Crawl Fubon Broker Details`<br>`.github/workflows/crawl-fubon-broker-details.yml` | 平日台北時間 21:17、22:17<br>UTC 13:17、14:17 |
| `data_twse_mi_index/YYYYMMDD_twse_mi_index.json` | 大盤收盤指數與漲跌百分比。預測流程會抽出 `發行量加權股價指數`，寫入 `data_predictions/YYYYMMDD/market-snapshot.json`。 | `Crawl TWSE MI Index`<br>`.github/workflows/crawl-twse-mi-index.yml` | 平日台北時間 14:37、15:23、16:29、17:31、18:41、19:43、20:47<br>UTC 06:37、07:23、08:29、09:31、10:41、11:43、12:47 |
| `data_market_news/YYYYMMDD/market_news.json` | 新聞面資料庫；先廣泛收集台股、法人、半導體/ADR、海外風險、亞股、匯率、信用交易等消息，後續再分類與回測有效性。 | `Crawl Market News`<br>`.github/workflows/crawl-market-news.yml` | 台北時間 07:40、15:50<br>UTC 23:40、07:50 |
| `data_external_market/YYYYMMDD/external_market_indicators.json` | 外部市場指數：Nasdaq、S&P 500、Dow、SOX、TSM ADR、USD/TWD、WTI 與 Brent 油價期貨。 | `Crawl External Market Indicators`<br>`.github/workflows/crawl-external-market-indicators.yml` | 台北時間 07:20<br>UTC 23:20 |
| `data_market_risk/YYYYMMDD/market_risk_snapshot.json` | 市場新聞與外部指數合成風險分數；prediction 會讀取這份資料並寫入每檔 features。 | `Crawl Market News`、`Crawl External Market Indicators`、`Generate all stock predictions` 都會嘗試產生 | 依上述 workflow 執行時間 |
| `data_normalized/institutional_investors/YYYYMMDD.json` | 三大法人正規化副本，供 prediction 穩定讀取；不覆蓋原始 TWSE 爬蟲資料。 | `Generate all stock predictions` 內的 `prepare_and_verify_forecast_inputs.js` | 隨預測 workflow 執行 |
| `data_normalized/broker_details/YYYYMMDD.json` | 券商分點正規化副本，供 prediction 穩定讀取；不覆蓋原始富邦券商分點資料。 | `Generate all stock predictions` 內的 `prepare_and_verify_forecast_inputs.js` | 隨預測 workflow 執行 |
| `data_twse/twse_industry_Stock.json` | 股票母體、股票名稱、產業分類。 | `Update TWSE Industry Lists`<br>`.github/workflows/update-twse-industry.yml` | 每天台北時間 10:52<br>UTC 02:52 |
| `data_history_sma/non_trading_days.json` | 交易日曆；用來判斷下一交易日並跳過週末與假日。 | `Update Non-Trading Days`<br>`.github/workflows/update-non-trading-days.yml` | 每年 12/27、12/30、12/31 台北時間 10:21<br>UTC 02:21 |

## 預測輸出

預測 workflow 會把每一批結果寫到：

```text
data_predictions/YYYYMMDD/
```

重要產出檔案：

| 產出檔案 | 用途 |
|---|---|
| `data_predictions/YYYYMMDD/股票代號.json` | 單檔股票完整預測 payload。 |
| `data_predictions/YYYYMMDD/market-snapshot.json` | 這批預測實際使用的大盤資料。 |
| `data_predictions/YYYYMMDD/summary.json` | Dashboard 使用的聚合資料。 |
| `data_predictions/YYYYMMDD/industry-summary.json` | 產業 dashboard 使用的聚合資料。 |
| `data_predictions/YYYYMMDD/group-summary.json` | 策略分類 dashboard 使用的聚合資料。 |
| `data_predictions/YYYYMMDD/missing-data-stocks.json` | 缺少輸入資料的股票清單。 |
| `data_predictions/YYYYMMDD/manifest.json` | 單批次 metadata。 |
| `data_predictions/manifest.json` | 前端讀取最新批次用的入口檔。 |

## 新聞資料庫

新聞 workflow 會寫入：

```text
data_market_news/YYYYMMDD/market_news.json
```

目前收集範圍定義在：

```text
config/market_news_sources.json
```

目前先收集以下主題，不在爬取階段做強判斷：

| 主題 | 目的 |
|---|---|
| `taiwan_market` | 台股大盤、大跌、重挫、外資賣超等盤勢消息。 |
| `institutional_flows` | 三大法人、外資、投信、自營商買賣超。 |
| `semiconductor_adr` | 台積電 ADR、費城半導體、Nasdaq、科技股。 |
| `global_risk` | 美股、科技股、中東、油價、美債殖利率、關稅。 |
| `oil_futures` | WTI、Brent、原油期貨、中東、能源與通膨。 |
| `asia_markets` | 亞股、日股、韓股、港股與區域風險。 |
| `fx_rates` | 新台幣、匯率、股匯雙殺、外資匯出入。 |
| `credit_margin` | 融資、維持率、借券賣出、信用交易。 |

新聞資料會再產生市場風險快照：

```text
data_market_risk/YYYYMMDD/market_risk_snapshot.json
```

目前已納入：

- 新聞關鍵字風險。
- 外資賣超新聞權重。
- ADR / 費半 / Nasdaq 新聞風險。
- 油價與能源新聞風險。
- 簡單主題聚類，降低重複新聞放大效果。
- 個股別名與產業關鍵字關聯，設定檔是 `config/stock_news_aliases.json`。

`generate_all_stock_predictions.js` 會把這份 market risk 寫進每檔股票的 `features`，並在高風險時提高 `risk_score`、降低偏多方向分數。

## 外部市場指數

外部市場 workflow 會寫入：

```text
data_external_market/YYYYMMDD/external_market_indicators.json
```

追蹤範圍定義在：

```text
config/external_market_indicators.json
```

目前追蹤：

| 指標 | Symbol | 用途 |
|---|---|---|
| Nasdaq Composite | `^IXIC` | 美股科技股風險。 |
| S&P 500 | `^GSPC` | 美股大盤風險。 |
| Dow Jones | `^DJI` | 美股傳產與整體情緒。 |
| PHLX Semiconductor Index | `^SOX` | 半導體循環與台股電子權值風險。 |
| TSM ADR | `TSM` | 台積電 ADR 隔夜風險。 |
| USD/TWD | `TWD=X` | 匯率與外資匯出入風險。 |
| WTI Crude Oil Futures | `CL=F` | 油價期貨風險。 |
| Brent Crude Oil Futures | `BZ=F` | 國際油價期貨風險。 |

## 預測 workflow

Workflow：

```text
Generate all stock predictions
.github/workflows/generate-all-stock-predictions.yml
```

觸發條件：

- 手動執行 `workflow_dispatch`。
- push 到 `main`，且變更檔案命中 workflow 的 `paths` filter。

它不是每次 push 都會跑。它也會跳過 `github-actions[bot]` 自己產生的 commit，避免無限循環。

目前執行步驟：

1. `npm ci`
2. `node scripts/resolve_forecast_dates.js --github-env`
3. `node scripts/resolve_forecast_dates.js`
4. `node scripts/prepare_and_verify_forecast_inputs.js`
5. `node scripts/generate_market_risk_snapshot.js --date "$FORECAST_BASE_DATE"`
6. `node scripts/normalize_non_trading_days.js`
7. `node scripts/generate_all_stock_predictions.js`
8. 若有變更，commit `data_normalized`、`data_market_risk`、`data_predictions` 和 `public/index.html` 回 `main`。

## 手動執行建議順序

正常每日手動補跑時，建議照下面順序跑 workflow，並等每個 workflow commit 回 `main` 後，再跑下一個相依步驟：

1. `Crawl SMA Data`
2. `Crawl TWSE MI Index`
3. `Crawl Market News`
4. `Crawl External Market Indicators`
5. `Crawl TWSE Institutional Investors`
6. `Crawl TWSE Margin Balance`
7. `Crawl Fubon Broker Details`
8. `Generate all stock predictions`

低頻 workflow：

- `Update TWSE Industry Lists`：股票母體、名稱或產業分類可能變動時再跑。
- `Update Non-Trading Days`：交易日曆需要更新時再跑；通常是年底更新新年度行事曆，或發現預測日期判斷異常時。

## 注意事項

- `Build TWSE Market Chart`（`.github/workflows/build-twse-market-chart.yml`）是給大盤 K 線圖頁面使用，會寫入 `data_twse_market_chart/market_chart.json`。每日股票預測已不再需要先跑這個 workflow。
- `generate_all_stock_predictions.js` 現在會優先讀 `data_twse_mi_index/YYYYMMDD_twse_mi_index.json` 作為大盤資料來源；只有每日 MI index 檔不可用時，才 fallback 到 `data_twse_market_chart/market_chart.json`。
- `prepare_and_verify_forecast_inputs.js` 會驗證基準交易日的 TWSE 法人檔與富邦券商分點檔，並把正規化副本寫到 `data_normalized/`。它不會覆蓋原始爬蟲資料。
- `generate_market_risk_snapshot.js` 產生的市場風險分數是啟發式，仍需累積更多大跌日與非大跌日，用 `scripts/calibrate_market_risk_weights.js` 逐步校準。
- 如果 `data_predictions/YYYYMMDD/missing-data-stocks.json` 的數量很高，應先檢查缺少哪些資料類別，再解讀 dashboard。
