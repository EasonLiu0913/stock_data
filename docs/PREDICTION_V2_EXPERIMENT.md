# 股票預測 V2 Shadow Experiment

## 目的

V2 是與正式 V1 並行的實驗版本，不修改、不取代 `scripts/generate_all_stock_predictions.js`，也不覆寫 `data_predictions/`。

- V1 輸出：`data_predictions/<YYYYMMDD>/`
- V2 輸出：`data_predictions_v2/<YYYYMMDD>/`
- 版本比較：`data_prediction_comparisons/<YYYYMMDD>/comparison.json`

## V2 預測調整

1. **P0 對稱門檻**：不單獨提高偏多門檻；偏多與偏空都使用對稱且較保守的門檻。
2. **七日相對強勢非線性化**：移除 V1 的線性 ±2 分；中度強勢只作確認，極端強勢搭配 RSI／均線乖離過熱時加入均值回歸扣分。
3. **籌碼 × 技術四象限**：分成只籌碼、只技術、兩者一致、兩者衝突；只有獨立且足夠強的一致訊號才加交互分數。
4. **資料缺漏動態化**：所有排除代號及理由由當次資料產生，不寫死股票代號。

## 五個新增評估角度

V2 覆盤 `scripts/generate_prediction_replay_v2.js` 會輸出：

1. 市場基準校正：偏多／偏空超額命中率與 Balanced Accuracy。
2. 分數校準：方向分數分桶後的命中率與平均策略報酬。
3. 數字誤差：MAE、MAPE、區間涵蓋率與平均區間寬度。
4. 經濟價值：signed return、30 bps 成本後報酬、Profit Factor；最大回撤保留到跨日資料累積後計算。
5. 相對能力：相對市場／產業報酬，以及方向分數對市場超額報酬的 Spearman IC。

## 自動流程

- `generate-prediction-comparison-v2.yml`：以 2026-07-27 為基準，同時產生 2026-07-28 的 V1 與 V2 預測。
- `replay-prediction-comparison-v2.yml`：結果日行情到齊後，自動覆盤兩版並產生準確度差異。

V2 標記為 `shadow_only_do_not_replace_v1`；在跨多日結果足夠以前，不應直接升級成正式規則。
