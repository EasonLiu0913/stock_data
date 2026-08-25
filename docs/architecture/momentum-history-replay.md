# 動能飆股歷史與覆盤 v1

## 目的

把每日 Momentum Score 從單日標籤升級為可長期驗證的時間序列研究資料，同時嚴格區分：

- **T 日可得訊號**：Momentum Score、A/B/C、五構面分數、共振/風險標籤、score acceleration。
- **T 日之後才知道的結果**：T+1、T+3、T+5 報酬、期間最大漲幅、期間最大回撤、是否達 +4/+7/+10%、隔日是否直接轉弱。

結果資料不得回寫成 T 日因子。

## 日期定義

History 的檔名使用 `base_trade_date`，也就是實際訊號交易日，不使用 prediction folder 的 forecast date。

例如：

- prediction folder：`20260824`
- `base_trade_date`：`20260821`
- history：`data_prediction_analysis/momentum-history/v1/20260821.json`

這可避免週末、假日或下一交易日預測日期讓 acceleration 與 T+n 對錯交易日。

## 目錄

```text
data_prediction_analysis/
  momentum-history/
    v1/
      manifest.json
      YYYYMMDD.json
  momentum-replay/
    v1/
      manifest.json
      YYYYMMDD.json
```

模型版本放在目錄層級；未來 Momentum v2 不覆蓋 v1 歷史。

## History

每檔至少保存：

- `momentum_score`
- `momentum_grade`
- `momentum_previous_score`
- `momentum_acceleration`
- 價格／量能／趨勢／籌碼／突破五構面分數
- 量價共振／籌碼共振／強勢突破
- 動能過熱／疑似爆量出貨
- 當時計分 inputs

`momentum_acceleration = T score - 前一個已存在的交易訊號日 score`。

若沒有前一期 history，previous score 與 acceleration 必須為 `null`，不能用 0 代替。

## Replay

以訊號日收盤價為基準，依真正後續交易資料計算：

- T+1 return
- T+3 return
- T+5 return
- 各 horizon 期間 max gain
- 各 horizon 期間 max drawdown
- 五日內是否曾達 +4%、+7%、+10%
- T+1 是否 <= -2%（`next_day_weakening`）

不足 horizon 的資料保持 `null`。

週五訊號的 T+1 是下一個有效交易日，不是星期六。

## 每日刷新

Workflow：`[07 研究] 動能飆股歷史與覆盤`

- 台北時間週二至週六 03:30 排程執行，承接前一交易日晚間至凌晨資料。
- 預設建立最新有效 prediction summary 的 history。
- 每次刷新最近 10 個訊號日 replay，讓 T+1/T+3/T+5 隨資料成熟自動補齊。
- 只 commit `momentum-history` 與 `momentum-replay`，不觸發或改寫 Pages 部署流程。
- 不使用 `workflow_run`，避免 Unknown event 類型的串接問題。

## 手動回填

Workflow dispatch 支援：

- `date`：單日
- `start` + `end`：區間
- `replay_lookback`：要重新刷新最近多少個訊號日

區間依 prediction date 升冪處理，因此同一輪回填時 acceleration 會自然使用前一個已寫入的 signal history。

## 研究原則

1. v1 歷史不可被未來 v2 模型覆蓋。
2. Replay 結果不得參與 Momentum Score。
3. 缺資料 = `null`，不是 0，也不是 false。
4. 門檻調整先做歷史分組與 OOS 驗證，再新增模型版本。
5. 市場牛熊可做切片分析，但不改變動能標籤 eligibility。
