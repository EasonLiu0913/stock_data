# Stock Data Dashboard (股票數據儀表板)

這是一個專注於台股籌碼面分析的資料視覺化專案，主要追蹤主力籌碼與外資動向。

## 📊 主要功能

### 1. 股票數據瀏覽器 (Stock Data Browser)
入口：[Stock Data Browser](https://easonliu0913.github.io/stock_data/public/index.html)

提供每日更新的籌碼排行數據，支援多種篩選條件：
- **主力買賣超排行**：支援 1、2、3、4、5、10、20、30 日區間統計。
- **市值/量能排行**：上市值增/值縮、量增/量縮排行。
- **URL 參數連動**：選擇日期或分類時會自動更新 URL，方便分享特定數據頁面。

### 2. 外資連續買超追蹤 (Foreign Investors Tracker)
入口：[Foreign Investors Tracker](https://easonliu0913.github.io/stock_data/public/foreign.html)

專門針對外資動向的進階分析工具：
- **連續買超排行**：找出外資連續多日買進的潛力股（支援顯示完整 10 日數據）。
- **多種排序模式**：
    - 4 日累計買超
    - 短期成長率 (第1天 vs 第2天)
    - 區間佈局 (4天內3天買超)
    - **連續天數排行** (由長到短排序，並顯示 10 日累計與平均)
- **視覺化圖表**：以顏色區分買賣超強度（紅買綠賣）。

### 3. 其他分析工具
- **[分析工具](https://easonliu0913.github.io/stock_data/public/analyze.html)**：個股深入分析工具。
- **[比較工具](https://easonliu0913.github.io/stock_data/public/compare.html)**：多檔股票比較工具。

---

## 🚀 如何使用

### 線上瀏覽 (GitHub Pages)
直接訪問上述連結即可使用。

### 本地開發
1. Clone 此專案：
   ```bash
   git clone https://github.com/EasonLiu0913/stock_data.git
   ```
2. 直接用瀏覽器打開 `public/` 資料夾下的 HTML 檔案即可使用。

---

## 🛠 資料更新 (Data Update)

本專案使用自動化流程每日更新數據：

- **排程執行**：系統會每日自動執行爬蟲腳本更新數據。
- **資料位置**：所有處理後的 JSON/CSV 檔案存放在 `data_fubon/` 目錄中。
- **自動化**：透過 Crontab 每日固定時間自動執行更新。
