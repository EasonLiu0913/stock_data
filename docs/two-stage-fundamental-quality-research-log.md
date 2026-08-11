# 基本面雙確認研究總誌

> 研究主題：電子股 `FAS >= 8 + FQ >= 10` 的 **財報品質訊號**，以及其進場時機、回檔、分批進場、timing 因子與 production execution。
>
> 維護原則：正式結論只引用 anti-lookahead 已校正、且價格 coverage 足以支持的結果。被 superseded 的舊研究可以保留在歷史 artifact，但不得再當作 production evidence。

---

## 0. 2026-08-11 重大更正：舊 199-event baseline 作廢

Phase 3 corrected revalidation 發現舊研究存在 mixed-date-format look-ahead bug：

- `conservative_known_date` 使用 `YYYY-MM-DD`
- monthly signal event date 使用 `YYYYMMDD`
- 舊程式直接做 lexicographic string comparison
- 因此可能把未來季度 FQ 誤判為訊號當時已知

正式修正：

> 所有 known date / event date 一律先正規化為 `YYYYMMDD`，再要求 `known_date <= event_date`。

因此：

- 舊 199-event Round 1～5 數字全部標記為 **superseded**。
- 修正後 `202401～202606` 真正符合 `電子股 + FAS >= 8 + as-of FQ >= 10` 的候選事件為 **131 筆**。
- Regression 已鎖定 mixed-format date 不得造成 future-quarter leakage。

---

## 1. 2026-08-11 可執行進場價 Revalidation

本輪直接驗證 production V1 真正能成交的價格：

1. `signal_close`：訊號日收盤，**benchmark only**
2. `next_open`：下一交易日開盤，最早可執行
3. `next_close`：下一交易日收盤，可執行

研究窗：`202401～202606`  
Universe：corrected anti-lookahead 的電子股 `FAS >= 8 + latest-known FQ >= 10`

### Coverage

- corrected candidates：**131**
- signal / next-session OHLC 完整：**130**
- execution price coverage：**99.2366%**
- D60 實際 price-complete trades：**104**

### 為什麼不再引用舊 +26.1619% headline

舊 Phase 3 corrected workflow 採 sparse checkout，沒有完整 checkout TWSE MI_INDEX / legacy price sources。舊 summary 雖寫 `eligible_events = 106`，但 artifact 中 D60 direct 實際只有 **23 trades**。

因此舊：

- 平均 `+26.1619%`
- 中位 `+17.4917%`
- 正報酬率 `78.2609%`

只能視為 **sparse-price historical evidence**，不得再解讀成 106 筆完整價格樣本。

正式 execution evidence 改以本輪完整 OHLC coverage 為準。

### D60 完整價格結果

| 執行方式 | 角色 | Trades | 平均報酬 | 中位報酬 | 正報酬率 | Median MFE | Median MAE |
|---|---|---:|---:|---:|---:|---:|---:|
| 訊號日收盤 | benchmark only | 104 | 11.2474% | 2.7665% | 53.8462% | 24.6789% | -16.6803% |
| 隔日開盤 | 最早可執行 | 104 | 10.1624% | 1.0775% | 50.9615% | 22.6944% | -17.1253% |
| **隔日收盤** | **production** | **104** | **10.5160%** | **1.7659%** | **51.9231%** | **25.4262%** | **-16.2930%** |

主要 horizons：

| Horizon | Next Open median / 勝率 | Next Close median / 勝率 |
|---|---:|---:|
| D5 | 0.5841% / 51.1628% | **0.7018% / 55.0388%** |
| D20 | 1.9588% / 53.3333% | **2.5371% / 55.0000%** |
| D60 | 1.0775% / 50.9615% | **1.7659% / 51.9231%** |

### Production execution 結論

> **正式 execution policy：`next_close`（下一交易日收盤）。**

這不是新策略，也不改：

`two_stage_fundamental_quality_direct_entry_v1`

的 strategy ID / version。選股規則與 execution policy 分開管理。

正式設定檔：

`config/strategy-execution-policies.json`

研究輸出：

`data_prediction_analysis/quarterly-financial-quality/fundamental-quality-execution-revalidation.json`

---

## 2. Overnight gap 結論

整體：

- 平均 gap：**+0.5272%**
- 中位 gap：**+0.4979%**
- `gap > 5%` 比例：**0.7692%**

Next-open D60 呈現值得觀察的梯度：

- `gap <= 0`：median 約 **+7.7938%**、勝率 **59.3750%**
- `gap 2～5%`：median 約 **-0.4219%**、勝率 **48.0000%**

目前結論：

> 高 gap 不宜在開盤盲目追價的跡象存在，但 `gap > 5%` 成熟樣本不足，因此 **不建立 gap 硬 gate**。

先採 `next_close` 作 production execution，未來待 gap-up 樣本增加後再做 OOS threshold 驗證。

---

## 3. 目前有效研究結論

截至 2026-08-11：

1. **`FAS >= 8 + FQ >= 10` 仍保留為財報品質訊號的選股核心。**
2. corrected candidate universe：**131 筆**。
3. signal / next-session OHLC coverage：**130 / 131 = 99.2366%**。
4. D60 完整價格樣本：**104 筆實際 trades**。
5. signal-close 只作 benchmark：D60 平均 **+11.2474%**、中位 **+2.7665%**、正報酬率 **53.8462%**。
6. production `next_close`：D60 平均 **+10.5160%**、中位 **+1.7659%**、正報酬率 **51.9231%**。
7. `next_close` 在 D5 / D20 / D60 的中位報酬與勝率皆優於 `next_open`，因此正式採用。
8. 回檔仍不適合作為 universal entry gate；舊 pullback 研究須在 corrected universe 重新驗證後才能升級為正式證據。
9. historical event-driven preliminary FQ coverage 仍不足，不切換 production FQ resolver。
10. **next-day execution 已驗證完成。**

---

## 4. Production V1 訊號規則

正式策略：

- Strategy ID：`two_stage_fundamental_quality_direct_entry_v1`
- 顯示名稱：**財報品質訊號**
- Atomic tag：`fundamental_two_stage_signal_day_v1`
- Universe：電子股
- FAS：`>= 8`
- FQ：`latest-known financial_quality_score >= 10`
- 訊號日期：monthly signal event 的 `base_trading_date`
- 最早可執行日：下一交易日
- 正式 execution：**下一交易日收盤 `next_close`**

資料層保存：

```json
{
  "fundamental_signal": {
    "strategy_id": "two_stage_fundamental_quality_direct_entry_v1",
    "label": "財報品質訊號",
    "signal_date": "2026-08-11",
    "execution_date": "2026-08-12",
    "fas_score": 9,
    "fq_score": 12,
    "financial_period": "2026Q2"
  }
}
```

未命中股票必須寫成：

`fundamental_signal: null`

避免 stale metadata 殘留。

---

## 5. Corrected Phase 3 的正式定位

Phase 3 的主要價值仍然成立：

- 修掉 mixed-date-format look-ahead。
- corrected conservative candidates = **131**。
- event-driven candidates = **131**。
- 當時可 score 的 historical preliminary event 只有 **1 筆**，不足以支持 production migration。

但 Phase 3 的舊 D60 `+26.1619%` headline 已被本輪完整 OHLC execution revalidation **取代**，不再列入目前有效績效結論。

Production gate：

- corrected conservative as-of logic：**必須使用**
- event-driven production migration：**暫不切換**
- next-day execution：**validated**
- production execution：**`next_close`**

---

## 6. 舊 Round 1～5 的定位

舊 Round 1～5 保留研究歷程，但共同使用舊 199-event universe，因此具體績效數字不得當成 production evidence。

仍可保留的方法論方向：

- Paired counterfactual
- Pullback policy backtest
- Staged entry
- Pullback predictor factors
- Walk-forward / OOS

未來若重啟 timing 研究，必須在 corrected 131-event universe 與真實 execution timestamp 上重建。

---

## 7. 目前 production / research 架構

### Layer 1 — Selection

- 電子股
- `FAS >= 8`
- corrected as-of `FQ >= 10`

作用：判斷是否命中 **財報品質訊號**。

### Layer 2 — Signal visibility

- `signal_date`：訊號形成日
- `execution_date`：下一交易日

作用：清楚區分「知道訊號」與「可以交易」的時間。

### Layer 3 — Execution

正式 production：

> **`next_close`**

`signal_close` 僅作 benchmark，不視為使用者可成交績效。

### Layer 4 — Timing / Position sizing

回檔、gap threshold、staged allocation 目前仍屬 research / risk-management layer，不作必要 entry gate。

---

## 8. 下一輪研究優先順序

Priority 1：**Corrected timing / staged-entry 重跑**

- 使用 corrected 131-event universe
- 使用真實可執行 timestamp
- 重建 pullback predictor / walk-forward / staged allocation

Priority 2：**Gap OOS 累積**

- 特別觀察 `gap 2～5%` 與 `gap > 5%`
- 樣本足夠前不建立硬 threshold

Priority 3：**Event-driven historical coverage 擴充**

- 補更多 historical actual preliminary earnings / filing events
- 再比較 corrected conservative vs event-driven universe

---

## 9. 研究紀律

後續每輪必須遵守：

1. Anti-lookahead：日期先正規化，只使用當時已知資訊。
2. Signal knowledge time 與 execution time 分開。
3. V1 實際可執行性優先。
4. 等待策略必須計入 missed winners。
5. 相同成熟樣本比較。
6. 避免 in-sample threshold hunting。
7. 先 OOS 再 production。
8. 市場環境不作未驗證硬 gate。
9. 被發現有 leakage / coverage 問題的舊結果必須明確 superseded。
10. 每輪研究完成後更新本文件。

---

## 10. 一句話版本

> **Corrected anti-lookahead 後，財報品質訊號共有 131 個候選；完整價格 revalidation 顯示 104 筆 D60 trades 中，訊號日收盤 benchmark 平均 +11.25%，真實可執行的隔日收盤平均 +10.52%。因此 production execution 正式採 `next_close`，signal-close 只保留作 benchmark；高 gap 暫只作警示，不設硬 gate。**
