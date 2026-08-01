# 個股跌深反彈成功／失敗特徵比較

## 目的

第二階段不建立正式選股分數，而是對每檔股票自己的歷史事件進行比較：

- 成功事件：5 個交易日內盤中最大反彈至少 10%。
- 失敗事件：已完成 5 日觀察期，但盤中最大反彈未達 10%。
- 尚未驗證：歷史資料尾端尚未走完 5 個交易日，不放入成功或失敗分母。

研究 ID：`historical_oversold_rebound_pattern_analysis_v1`

## 商品分類

原始事件庫保留所有有價量資料的商品，但規律分析預設只分析一般股票：

- `listed_equity`：存在於 `data_twse/twse_industry_Stock.json`。
- `stock_like_equity`：四位數且不是 `00` 開頭，主要用於上櫃、興櫃及其他股票型代碼。
- `fund_or_index_product`：`00` 開頭，例如 ETF、主動式 ETF。
- `non_equity_or_unclassified`：其他代碼形狀。

ETF 等商品仍保留在 `events/` 與 `profiles/`，但預設不產生股票規律候選。分類結果輸出於：

```text
data_research/oversold-rebound/security-universe.json
```

## 比較特徵

### 價量與技術

- 1、3、5、10 日報酬
- 20、60 日回撤
- RSI14
- SMA5、SMA20、SMA60 乖離
- 5、20 日量比
- 當日開收盤報酬
- 當日振幅
- 連跌日數
- 20 日已實現波動

### 法人

- 外資當日買賣超占成交量
- 外資近 3、5 日累積買賣超
- 外資是否由賣轉買
- 投信當日買賣超占成交量
- 投信近 3 日累積買賣超
- 投信是否由賣轉買

### 融資融券

- 融資當日、3 日、5 日增減
- 融券當日、3 日增減

### 券商分點

- 合計淨買賣超
- 前 5 大買方淨買超
- 前 5 大賣方淨賣超
- 前 5 大分點淨集中差

## 候選規律門檻

單一特徵必須同時符合：

- 成功事件至少 2 筆
- 失敗事件至少 2 筆
- 該特徵在已驗證事件的覆蓋率至少 50%
- 成功與失敗組皆可計算標準化平均差異

個股證據層級：

- `insufficient`：未達 6 筆已驗證事件，或成功／失敗任一組少於 2 筆。
- `exploratory`：至少 6 筆已驗證事件，且成功／失敗各至少 2 筆。
- `pattern_ready`：至少 10 筆已驗證事件，且成功／失敗各至少 3 筆。

即使是 `pattern_ready`，仍只代表有足夠資料進行探索，不代表規律已通過樣本外驗證。

## 輸出

```text
data_research/oversold-rebound/
├── pattern-summary.json
├── security-universe.json
└── patterns/
    ├── 2330.json
    ├── 6443.json
    └── ...
```

每檔股票的 pattern 檔包含：

- 主要結果的成功、失敗與尚未驗證筆數
- 所有特徵的成功組與失敗組統計
- 平均數、中位數、標準差與範圍
- 成功減失敗的平均／中位數差
- 標準化平均差異
- 最多 10 個探索性候選規律

`pattern-summary.json` 只統計不同股票中反覆出現的研究線索，不會把它們直接解讀為所有股票共通規律。

## 執行

```bash
node scripts/oversold_rebound_pattern_analysis.js --dry-run
```

只分析指定股票：

```bash
node scripts/oversold_rebound_pattern_analysis.js \
  --stocks 2330,6443 \
  --dry-run
```

包含 ETF 等非一般股票：

```bash
node scripts/oversold_rebound_pattern_analysis.js \
  --include-non-equity \
  --dry-run
```

正式 workflow 會先重建事件資料，再產生規律比較，確保 patterns 不會引用舊事件庫。
