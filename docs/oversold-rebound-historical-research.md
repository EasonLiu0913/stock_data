# 個股跌深反彈歷史事件研究

## 目的

這套研究管線不是用來預測隔日市場是否反彈，而是先從每檔股票的真實歷史價量中找出「跌深事件」，再觀察後續 1、3、5、10 個交易日的真實反彈結果，最後逐步比較成功與未成功樣本在成交量、法人、融資融券與券商分點上的差異。

研究 ID：`historical_oversold_rebound_research_v1`

## 研究原則

1. 事件成立只使用事件日與事件日前的個股價量資料。
2. 事件日後的價格只能作為結果標籤，不可反向成為事件日前特徵。
3. SOX、Nasdaq、台積電 ADR、油價與台指夜盤不是事件成立的必要條件。
4. 外部市場資料未來可以加入 `market_optional`，只作事後解釋與分群。
5. 法人、融資與券商資料缺少時保存 `null`，不得視為零買賣超。
6. 成功與失敗事件都保留，不先建立主觀總分。
7. 個股事件不足時，不宣稱已找到該股票的固定規律。

## 第一版跌深條件

單一交易日符合以下任一條件，即成為跌深觀察點：

- 3 日報酬小於等於 -8%
- 5 日報酬小於等於 -10%
- 10 日報酬小於等於 -15%
- 距近 20 日高點小於等於 -15%
- 距近 60 日高點小於等於 -20%
- RSI14 小於等於 25

相近的觀察點會合併為同一事件。預設允許間隔 3 個交易日，單一事件最長 20 個交易日。

每個事件同時保存：

- `signal_date`：第一次符合條件的日期，供未來策略研究使用。
- `deepest_signal_date`：該事件中價格最低的跌深觀察日，只作描述與比較。
- `episode_end_date`：本次跌深事件最後一個觀察日。

## 反彈結果

從 `signal_date` 與 `deepest_signal_date` 分別計算：

- 未來 1、3、5、10 日收盤報酬
- 未來 3、5、10 日最大盤中反彈
- 未來 3、5、10 日最大不利變動
- 首次收盤反彈 5% 所需天數
- 首次盤中反彈 5% 所需天數
- 多組反彈標籤，例如 3 日收盤 +5%、5 日收盤 +10%、5 日盤中 +10%

## 目前讀取的資料

### 必要資料

- `data_fubon/fubon_YYYYMMDD_sma.json`
  - 開高低收、成交量、SMA5、SMA20、SMA60
  - RSI、報酬、回撤、均量與波動率由研究程式重新計算

### 可選特徵

- `data_twse_foreign_investors/`
- `data_twse_investment_trust/`
- `data_twse_dealers/`
- `data_twse_margin_balance/`
- `data_fubon_broker_details/`

券商分點只有在 JSON 非空且含有 `stocks` 結構時才會納入；空檔會記錄在 data quality，不會當作零。

## 輸出

```text
data_research/oversold-rebound/
├── manifest.json
├── summary.json
├── data-quality.json
├── event-index.json
├── events/
│   ├── 2303.json
│   ├── 2330.json
│   └── ...
└── profiles/
    ├── 2303.json
    ├── 2330.json
    └── ...
```

`events/<stock>.json` 保存該股票所有事件與完整特徵；`profiles/<stock>.json` 保存目前可得的個股統計摘要。

個股證據層級：

- 0～2 件：`insufficient`
- 3～5 件：`early_observation`
- 6～9 件：`weak_stock_pattern`
- 10 件以上：`stock_specific`

證據層級只反映樣本數，不代表策略已通過樣本外驗證。

## 執行方式

全期間 dry run：

```bash
node scripts/mine_oversold_rebound_events.js --dry-run
```

指定期間：

```bash
node scripts/mine_oversold_rebound_events.js \
  --from 20251201 \
  --to 20260731
```

測試個股：

```bash
node scripts/mine_oversold_rebound_events.js \
  --stocks 2330,6443 \
  --dry-run
```

GitHub Actions 使用 `[07 研究] Mine Oversold Rebound Events`。指定股票的執行只能 dry run，避免部分股票輸出覆蓋完整事件庫。

## 後續階段

第一版完成事件資料庫後，下一階段再新增：

1. 成功與失敗事件的特徵差異統計。
2. 每檔股票的成交量、法人、融資與券商習性分析。
3. 產業、市值、波動率與流動性相似股票分群。
4. 條件探索 Dashboard。
5. 將穩定規律做時間切割與樣本外驗證後，才轉為正式選股條件。
