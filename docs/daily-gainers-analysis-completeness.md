# 每日漲幅 5% 分析完整性規則

## 目的

避免每日 5% 清單已產生，但原因研究或籌碼 AI 只有部分股票完成時，系統仍把半成品視為成功。

## 強制規則

1. `data_daily_gain_over_5/YYYYMMDD.json` 是當日股票母集合。
2. `data_daily_gain_over_5/analysis/YYYYMMDD.json` 的 `analyses[].code` 必須與母集合完全一致；少一檔或多一檔都視為 coverage 不完整。
3. coverage 不完整時，不得建立新的 `analysis-facts`，也不得把半成品當作「原因研究已完成」。
4. `analysis-ai` 發布前必須與 AI 產生時所依據的 facts 做語意一致性檢查。`generated_at` 等純時間欄位變化不算 facts 改變；實際籌碼、法人、融資融券、分點、技術訊號或股票集合改變才算。
5. 若 facts 語意已改變，舊 pending AI 不得發布，必須重新做 synthesis。
6. 前端可以顯示 deterministic 籌碼資料，即使正式 AI synthesis 尚未發布；兩者狀態需分開顯示。

## 2026-08-21 事故

- 當日 5% 清單：32 檔。
- 上漲原因研究只完成 11 檔，造成其餘 21 檔顯示「分析尚未產生」。
- deterministic 籌碼分析實際已完成 32 檔。
- ChatGPT pending synthesis 亦完成 32 檔，但 facts 後續再次重建；最後一次重建僅更新時間戳，因此發布 gate 必須比較語意內容，而不能只比較時間。

此文件用來固定未來 workflow、回填與頁面部署的判定原則。
