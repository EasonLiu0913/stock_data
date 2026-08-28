# HiStock 歷史分點研究資料

## 目的

用免費的 HiStock 公開分點頁補足研究期間的歷史券商分點排名，先驗證「持續買進 / 持續倒貨」是否能在延遲揭露之前形成可觀察訊號。

第一個研究案例：`2449`，期間 `2026-04-01` ～ `2026-07-31`。

## 資料定位

- `source`: `histock`
- `source_type`: `third_party_public_page`
- `research_only`: `true`
- 不得宣稱為官方 TWSE BSR 完整逐筆/完整分點資料。
- 不得直接覆蓋或混入 `data_twse_broker_trades` 官方來源路徑。

輸出位於：

```text
data_research/institutional-flow/histock/<stock>/
  manifest.json
  analysis.json
  daily/
    YYYYMMDD.json
```

## 重要限制

HiStock 公開頁面提供的是排名分點，而非完整券商總表。因此：

1. 某分點當天沒有出現在資料裡，代表它沒有進入頁面曝光排名，不代表當天買賣為 0。
2. `sell_days / appearances` 與 `buy_days / appearances` 是「被觀察到的排名日」條件比例，不是所有交易日比例。
3. 累積淨買賣只能用來衡量可見排名分點的持續性，不可解讀為完整市場券商淨部位。
4. 研究結論應與 TDCC 大戶持股、外資、價格/成交量等獨立資料源交叉驗證。

## Rolling persistence

`analysis.json` 對每個成功解析的交易日計算：

- 5 個已解析交易日
- 10 個已解析交易日
- 20 個已解析交易日

每個分點聚合：

- `total_net`
- `total_buy`
- `total_sell`
- `appearances`
- `sell_days`
- `buy_days`
- `sell_ratio = sell_days / appearances`
- `buy_ratio = buy_days / appearances`

Persistent seller 初步定義：

```text
total_net < 0 AND sell_days >= 2
```

Persistent buyer 初步定義：

```text
total_net > 0 AND buy_days >= 2
```

這只是研究分類，不是 production strategy threshold。之後應用 2449 與更多案例校準門檻，再決定是否建立正式因子。

## 使用 workflow

手動執行：

```text
[07 研究] HiStock Broker History Backfill
```

預設：

- stock: `2449`
- start: `2026-04-01`
- end: `2026-07-31`
- request delay: `900ms`
- commit research results: `true`

workflow 只由 `workflow_dispatch` 觸發，不會加入每日 production pipeline。
