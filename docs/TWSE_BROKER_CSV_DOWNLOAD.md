# TWSE 券商買賣日報表 CSV 本機下載

這個流程使用本機 Playwright 開啟 TWSE 買賣日報表查詢系統。程式會填入股票代碼、等待下載連結並保存 CSV；圖形驗證碼必須由使用者本人在瀏覽器中輸入。

## 第一次安裝

```bash
npm ci
npx playwright install chromium
```

## 執行

```bash
npm run download:twse-broker-csv -- 2330
```

執行後：

1. 程式讀取 TWSE 官方顯示的資料日期。
2. 開啟有畫面的 Chromium 並填入股票代碼。
3. 在瀏覽器中手動輸入 5 碼驗證碼，按「查詢」。
4. 如果驗證碼錯誤，依網頁提示重新輸入；程式會繼續等待。
5. `#HyperLink_DownloadCSV` 出現後，程式驗證股票代碼與筆數並自動點擊。
6. 官方原始 CSV 保存至：

```text
data_twse_broker_trades/raw/YYYYMMDD_股票代碼_twse_broker_trades.csv
```

7. 程式會同步將 TWSE 的 CP950/Big5 CSV 轉成 UTF-8，保存至：

```text
data_twse_broker_trades/utf8/YYYYMMDD_股票代碼_twse_broker_trades.csv
```

`YYYYMMDD` 使用 TWSE 頁面的「資料日期」，不是電腦日期。

## 其他選項

延長手動輸入驗證碼的等待時間：

```bash
npm run download:twse-broker-csv -- 2330 --timeout-ms 600000
```

指定輸出資料夾：

```bash
npm run download:twse-broker-csv -- 2330 --output-dir ./downloads
```

指定 UTF-8 CSV 輸出資料夾：

```bash
npm run download:twse-broker-csv -- 2330 --utf8-output-dir ./downloads_utf8
```

覆蓋同一資料日期與股票代碼的既有有效檔案：

```bash
npm run download:twse-broker-csv -- 2330 --force
```

預設遇到既有有效 raw 檔案會直接停止，不會重新查詢或覆蓋；如果 UTF-8 檔案尚未產生，程式會從既有 raw 檔補轉一份。

## 限制

- TWSE 免費查詢系統只提供集中市場當日資料。
- 每查詢一檔證券都必須人工輸入驗證碼。
- 本腳本不辨識、儲存或繞過驗證碼。
- `raw/` 下載的是官方原始 CSV，通常是 CP950/Big5 編碼。
- `utf8/` 是程式轉碼後的 CSV，建議後續資料解析、diff、GitHub 預覽使用這份。
- 資料正規化與 `files.json` 索引可在確認實際 CSV 格式後另行加入。
