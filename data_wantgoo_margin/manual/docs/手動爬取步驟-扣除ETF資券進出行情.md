已完成並推送到 `main`：

* [normalize_wantgoo_margin_dom.js](https://github.com/EasonLiu0913/stock_data/blob/main/scripts/normalize_wantgoo_margin_dom.js)
* [測試檔](https://github.com/EasonLiu0913/stock_data/blob/main/tests/normalize_wantgoo_margin_dom.test.js)
* 最新提交：[32df575](https://github.com/EasonLiu0913/stock_data/commit/32df575259f2b773cc22924b1a4b1ec669a8cccc)
* 測試結果：7/7 通過

你的操作步驟可以寫成：

1. 開啟
   `https://www.wantgoo.com/stock/margin-trading/exclude-etf/taiex`
2. 將手動擷取指令貼到瀏覽器 Console 執行。
3. 將複製的 JSON 儲存為：

```text
data_wantgoo_margin/manual/raw/日期_wantgoo_margin_dom.json
```

例如：

```text
data_wantgoo_margin/manual/raw/20260728_wantgoo_margin_dom.json
```

4. 在專案根目錄執行：

```bash
node scripts/normalize_wantgoo_margin_dom.js data_wantgoo_margin/manual/raw/20260728_wantgoo_margin_dom.json
```

執行後會自動產生：

```text
data_wantgoo_margin/manual/normalized/20260728_wantgoo_margin_dom_normalized.json
data_wantgoo_margin/manual/files.json
```

腳本會自動檢查：

* 檔名日期是否符合 JSON 日期
* `tradeDate` 與 `tradeDateCompact` 是否一致
* 表格最新日期是否正確
* 表格與 Highcharts 數值是否一致
* `tableRowCount`、`chartRowCount` 是否正確
* 必要數值是否為空
* 同日期是否已有不同內容
* 自動重新整理並排序 `manual/files.json`

如果同日期資料確定需要覆寫，人工確認後才能使用：

```bash
node scripts/normalize_wantgoo_margin_dom.js data_wantgoo_margin/manual/raw/20260728_wantgoo_margin_dom.json --force
```

目前舊檔可以這樣搬移：

```bash
mkdir -p data_wantgoo_margin/manual/raw

mv "data_wantgoo/20260728_扣除ETF資券進出行情.json" \
  "data_wantgoo_margin/manual/raw/20260728_wantgoo_margin_dom.json"
```

然後再執行 normalized 指令即可。
