# 基本面雙確認研究總誌

> 研究主題：電子股 `FAS >= 8 + FQ >= 10` 基本面雙確認訊號，以及其進場時機、回檔、分批進場、timing 因子與 production execution。
>
> **維護規則：這是一份持續更新文件。每完成一輪與本研究主題相關的實驗、回測或 OOS 驗證，都必須回來更新本文件，而不是只留下 JSON / workflow 結果。**
>
> 更新時至少補充：研究問題、方法、樣本、關鍵結果、結論是否改變、哪些假設被淘汰、下一輪建議。

---

## 0. 2026-08-11 重大更正：舊 199-event baseline 作廢

Phase 3 corrected revalidation 發現舊研究存在 mixed-date-format look-ahead bug：

- `conservative_known_date` 使用 `YYYY-MM-DD`
- monthly signal event date 使用 `YYYYMMDD`
- 舊程式直接做 lexicographic string comparison
- 因此可能把未來季度 FQ 誤判為訊號當時已知

修正方式：

> **所有 known date / event date 一律先正規化為 `YYYYMMDD`，再要求 `known_date <= event_date`。**

因此：

- 先前以 **199 個候選事件**為基礎的 Round 1～5 數字，包含 `D60 +30.68%`、187-event timing 樣本、舊 pullback participation 等，均視為 **superseded / 不可再作 production 證據**。
- 舊結果保留作研究歷程，但未來不可引用為正式績效基準。
- 修正後 `202401～202606` 真正符合 `電子股 + FAS >= 8 + as-of FQ >= 10` 的候選事件為 **131 筆**。

Regression 已鎖定：

- event-driven FQ 不得因 `YYYY-MM-DD` / `YYYYMMDD` 混用看到未來季度
- corrected conservative resolver 也不得看到未來季度
- 例如 2330 的 2026Q2 preliminary FQ 只能在其 effective date 之後使用

---

<!-- EXECUTION_REVALIDATION_20260811_START -->
## 0A. 2026-08-11 可執行進場價 Revalidation（正式取代舊 execution headline）

本輪直接驗證 production V1 真正能成交的價格：**訊號日收盤 benchmark vs 隔日開盤 vs 隔日收盤**。研究窗仍為 `202401～202606`，universe 仍為 corrected anti-lookahead 的電子股 `FAS >= 8 + latest-known FQ >= 10`。

### 先修正上一輪一個重要的證據解讀問題

Phase 3 corrected workflow 當時採 sparse checkout，沒有 checkout 完整 TWSE MI_INDEX / legacy price sources。舊 summary 雖寫 `eligible_events = 106`，但 artifact 中 **D60 direct 實際只有 23 trades**；因此舊 `D60 +26.1619% / median +17.4917% / positive 78.2609%` 不可再解讀成 106 筆完整價格樣本。

本輪使用 repository 內完整 OHLC provider 後：

- corrected candidates：**131**
- signal / next-session OHLC 完整：**130**（99.2366%）
- D60 實際 price-complete trades：**104**

因此從現在開始，execution headline 改以本輪完整價格 coverage 為準。

### D60：完整價格樣本結果

| 執行方式 | 角色 | Trades | 平均報酬 | 中位報酬 | 正報酬率 | Median MFE | Median MAE |
|---|---|---:|---:|---:|---:|---:|---:|
| 訊號日收盤 | benchmark only | 104 | 11.2474% | 2.7665% | 53.8462% | 24.6789% | -16.6803% |
| 隔日開盤 | 最早可執行 | 104 | 10.1624% | 1.0775% | 50.9615% | 22.6944% | -17.1253% |
| 隔日收盤 | 可執行 | 104 | 10.5160% | 1.7659% | 51.9231% | 25.4262% | -16.2930% |

### Production execution 結論

**正式建議：`next_close`（隔日收盤）**。它不是新策略，也不改 `two_stage_fundamental_quality_direct_entry_v1` 的 strategy ID/version；它是獨立 execution policy。

主要 horizons 的 next-close 都比 next-open 有更好的中位報酬與勝率：

| Horizon | Next Open median / 勝率 | Next Close median / 勝率 |
|---|---:|---:|
| D5 | 0.5841% / 51.1628% | 0.7018% / 55.0388% |
| D20 | 1.9588% / 53.3333% | 2.5371% / 55.0000% |
| D60 | 1.0775% / 50.9615% | 1.7659% / 51.9231% |

### Overnight gap

- 全樣本平均 gap：**0.5272%**
- 中位 gap：**0.4979%**
- `gap > 5%` 比例只有 **0.7692%**，成熟樣本不足，不建立 >5% 硬 gate。
- 但 next-open D60 有明顯梯度：`gap <= 0` 的 median 約 **7.7938%**、勝率 **59.3750%**；`gap 2～5%` 的 median 約 **-0.4219%**、勝率 **48.0000%**。

因此目前只把「高 gap 不宜開盤追價」保留為觀察提示，**不新增 entry gate**；production execution 直接採隔日收盤，未來等 gap-up 樣本增加後再做 OOS threshold 驗證。

### 本輪狀態

- next-day execution：**validated**
- production execution policy：**`next_close`**
- signal close：**只保留 benchmark，不視為使用者可成交績效**
- strategy ID/version：**不變**
- execution policy config：`config/strategy-execution-policies.json`
- 研究輸出：`data_prediction_analysis/quarterly-financial-quality/fundamental-quality-execution-revalidation.json`

<!-- EXECUTION_REVALIDATION_20260811_END -->

## 1. 目前有效研究結論

截至 2026-08-11，**只以 corrected anti-lookahead 結果為正式證據**：

1. **`FAS >= 8 + FQ >= 10` 仍是值得保留的基本面選股訊號。**
2. 修正後候選事件：**131 筆**；其中 D60 完整成熟事件：**106 筆**。
3. 目前 signal-close direct baseline 的 D60：
   - 平均：**+26.1619%**
   - 中位：**+17.4917%**
   - 正報酬率：**78.2609%**
   - D60 >= +30%：**43.4783%**
4. 等 -5% / -10% 的 conditional fills 報酬較高，但 participation 極低：
   - -5% skip：D60 平均 **+36.388%**，participation **10.3774%**
   - -10% skip：D60 平均 **+47.6607%**，participation **5.6604%**
5. 被等待策略跳過的股票仍有大量贏家：
   - -5% skip missed set：直接買 D60 正報酬率 **75%**
   - -10% skip missed set：直接買 D60 正報酬率 **82.3529%**
6. 因此 **回檔仍不適合做 universal entry gate**。
7. 目前 historical event-driven evidence 只成功 score 到 1 筆 preliminary event；在 `202401～202606` 研究窗內：
   - corrected conservative candidates：131
   - event-driven candidates：131
   - unchanged：131
   - added：0
   - removed：0
8. 所以目前 **不切換 production FQ 到 event-driven**；先擴充 historical actual-event coverage，再做版本化 migration。

### 重要 execution 限制

目前研究程式中的 `訊號日直接進場` 是：

> **在 monthly signal event 的 `base_trading_date` 收盤價進場。**

但實際使用 V1 的流程是：

1. `base_trading_date` 收盤後產生預測
2. 使用者晚上看到 V1
3. 下一個交易日才有機會下單

因此：

> **signal-day close backtest ≠ V1 使用者隔日實際進場。**

目前 `+26.1619%` 只能解讀為「signal-close baseline」；在完成 next-trading-day execution revalidation 前，不得直接當成使用者隔日買進的預期績效。

---

## 2. Production V1 訊號顯示規則

目前 Strategy Registry 已存在正式可觀測訊號：

- Strategy ID：`two_stage_fundamental_quality_direct_entry_v1`
- 顯示名稱：**基本面雙確認－訊號日直接進場**
- Atomic tag：`fundamental_two_stage_signal_day_v1`
- Atomic label：**基本面雙確認訊號日**
- Universe：電子股
- FAS：`>= 8`
- FQ：`latest-known financial_quality_score >= 10`
- 日期規則：**只在 monthly signal event 的 `base_trading_date` 命中**
- 不會因為曾經出現過訊號而後續每天持續掛標籤

V1 Dashboard 頂端目前會顯示：

- `預測日 forecast_date`
- `基準日 base_trade_date`

因此實際判讀方式為：

> 若某檔股票出現在某一個 V1 預測日的「基本面雙確認－訊號日直接進場」清單，則該頁頂端的 **基準日就是它這一輪的訊號日**；預測日則是下一個交易日。

例如：

- 預測日：2026-08-12
- 基準日：2026-08-11
- 股票出現在「基本面雙確認－訊號日直接進場」

代表：

- 2026-08-11 = 訊號日
- 2026-08-12 = 使用者實際最早可執行的預測日

### V1 尚缺的 UX

股票表格目前沒有每檔獨立顯示：

- `fundamental_signal_date`
- `first_signal_date`
- `intended_execution_date`

目前只能由頁面共同的 `base_trade_date` 判讀。

後續 production UX 建議補成顯式欄位，避免切換歷史日期或查看個股時產生誤解。

---

## 3. Corrected Phase 3 — Event-driven / Conservative Revalidation

### 研究問題

1. 修掉 mixed-date-format lookahead 後，原本 FAS + FQ 選股效果是否還存在？
2. Event-driven preliminary earnings 是否會改變候選 universe？
3. `direct` 是否仍是 general baseline？

### 方法

研究窗：

- `start_month = 202401`
- `end_month = 202606`

Universe：

- 電子股
- `FAS >= 8`
- corrected latest-known `FQ >= 10`

Event-driven preliminary FQ：

- 不把正式財報 FQ 分數往前搬
- 必須以 event 當時已知的 revenue / operating income / EPS / gross margin / operating margin 等欄位
- 用同一套 14 分 FQ 公式重新計算
- comparison quarter 也必須在 event date 前已知

### Coverage

- total monthly events：29,466
- electronic FAS >= 8：1,604
- missing as-of FQ：160
- as-of FQ < 10：1,313
- corrected candidates：**131**
- event-driven candidates：**131**
- historical scoreable preliminary events：**1**

### D60 direct

| 指標 | Corrected conservative | Event-driven |
|---|---:|---:|
| Eligible events | 106 | 106 |
| 平均報酬 | +26.1619% | +26.1619% |
| 中位報酬 | +17.4917% | +17.4917% |
| 正報酬率 | 78.2609% | 78.2609% |
| >= +30% | 43.4783% | 43.4783% |

### Conditional pullback

| Policy | D60 avg | Participation | 被跳過股票直接買正報酬率 |
|---|---:|---:|---:|
| -5% skip | +36.388% | 10.3774% | 75% |
| -10% skip | +47.6607% | 5.6604% | 82.3529% |

### 結論

> **修正 anti-lookahead 後，FAS >= 8 + FQ >= 10 仍保有明顯選股效果；等待回檔的成交品質較佳，但 participation 太低且會漏掉大量贏家，因此 signal-close direct 仍是研究 general baseline。**

但：

> **這個 direct baseline 尚未完成「V1 晚上看到訊號、下一交易日才進場」的 execution revalidation。**

Production gate：

- corrected conservative as-of logic：**必須使用**
- event-driven production migration：**暫不切換**
- next-day execution：**尚未驗證，必須補做**

---

## 4. 舊 Round 1～5：保留研究歷程，但績效數字已 superseded

以下研究的思考方向仍有價值，但因共同使用舊 199-event universe，其數字不再作正式證據。

### Round 1 — Paired Counterfactual

原問題：同一股票如果之後真的回檔，-5% / -10% 進場是否改善價格與 MAE？

歷史結論：triggered subset 中回檔買通常較好。

目前狀態：

> **方法概念保留；舊觸發率與報酬數字 superseded，需在 corrected 131-event universe 重跑後才可重新引用。**

### Round 2 — Policy Backtest

原問題：把沒有回檔的股票也算進來，等待是否仍優於直接買？

歷史結論：等待會漏掉不回檔直接走強的股票。

目前狀態：

> **方向已被 corrected Phase 3 再次支持；舊 199-event 的具體百分比不可再引用。**

### Round 3 — Staged Entry

原問題：訊號日先買部分，再保留資金等 -5% / -10%。

歷史結論：可改善 MAE / 持有體驗，但降低總資金報酬。

目前狀態：

> **需要用 corrected universe 重跑，才可比較真實 staged allocation。**

### Round 4 — Pullback Predictor Factors

曾研究：

- `pre20_vol_pct`
- `pre5_return_pct`
- `pre20_return_pct`
- `dist_from_20d_high_pct`
- `market_pre20_return_pct`

歷史結論：價格 timing 因子比 FAS / FQ 子分數更像回檔 timing 因子。

目前狀態：

> **舊 187-event factor spread 已被 supersede；若要繼續 timing 研究，必須先在 corrected universe 重建 feature dataset。**

### Round 5 — Walk-forward / OOS

舊 OOS 曾得到：

- -5%：not validated
- -10%：promising but not validated
- routed-entry ready：false

目前狀態：

> **結論只保留「尚不應把 timing 做 production gate」這個保守決策；舊 AUC / spread 數字不再作正式證據。**

---

## 5. 已淘汰 / 降級假設

### 淘汰：所有基本面雙確認股票都必須等 -5% / -10% 才買

Corrected Phase 3 再次顯示 participation 太低，而且 skipped set 中仍有大量贏家。

### 降級：固定分批比例可提高 alpha

舊研究只支持它可能改善 MAE；在 corrected universe 重跑前，不宣稱其提高總資金報酬。

### 降級：FAS acceleration / revenue high 作為 timing 因子

舊研究辨識力很弱，而且原 factor dataset 已 superseded。未來若重做 timing，仍不列第一優先。

### 暫停：Event-driven FQ 直接升 production

原因：historical actual-event coverage 目前太少，研究窗內只成功 score 1 筆 preliminary event，尚不足以做 migration 決策。

---

## 6. 目前 production / research 架構

### Layer 1 — 選股

目前保留：

- 電子股
- `FAS >= 8`
- corrected as-of `FQ >= 10`

作用：

> 判斷「是否進入基本面雙確認候選池」。

### Layer 2 — Signal visibility

Strategy Registry：

- `two_stage_fundamental_quality_direct_entry_v1`
- 只在 `base_trading_date` 當日成立

作用：

> 讓 V1 使用者知道「哪一天是這一輪基本面雙確認訊號日」。

### Layer 3 — Execution

目前尚未正式驗證：

- next trading day open
- next trading day close
- next trading day VWAP / realistic slippage proxy

在完成之前：

> **不要把 signal-close backtest 的 +26.16% 直接當成 V1 隔日可複製績效。**

### Layer 4 — Timing / Position sizing

回檔與 timing 因子目前只能做 research / risk management，不作必要 entry gate。

---

## 7. 下一輪研究優先順序

### Priority 1 — Next-trading-day execution revalidation

這是現在最重要、也最貼近實際操作的一輪。

必須在 corrected 131-event universe 比較至少：

1. Signal-day close（目前 baseline）
2. Next trading day open
3. Next trading day close

若資料允許，再加入：

4. Next-day realistic execution proxy，例如 open-to-VWAP 或保守滑價情境

D20 / D40 / D60 至少比較：

- average endpoint
- median endpoint
- positive rate
- >= +30% rate
- MFE
- MAE
- gap cost vs signal close
- missed / untradeable events

最終要回答：

> **使用者晚上從 V1 看到訊號，隔天進場，是否仍保留足夠 alpha？**

### Priority 2 — V1 顯式顯示每檔訊號日期

建議增加：

- `fundamental_signal_date`
- `signal_source_month`
- `intended_execution_date`
- FAS score
- as-of FQ score / fiscal period

頁面上不要只靠共同 `base_trade_date` 推論。

### Priority 3 — Corrected timing / staged-entry 重跑

只有 Priority 1 通過後，再重建 corrected 131-event timing feature dataset，重跑：

- pullback predictor
- walk-forward / OOS
- staged allocation

### Priority 4 — Event-driven historical coverage 擴充

補更多公司、季度、actual preliminary earnings / filing events，再比較 corrected conservative vs event-driven universe。

---

## 8. 研究紀律與防呆

後續每輪研究必須遵守：

1. **Anti-lookahead**：日期先正規化；只使用訊號當下或之前已知資料。
2. **Signal knowledge time 與 execution time 分開**：知道訊號的時間不能等同成交時間。
3. **V1 實際可執行性優先**：若訊號晚上才出現，不能用當日收盤成交價冒充可交易價格。
4. **不要只看 triggered subset**：等待策略必須計入 missed winners。
5. **總資金報酬優先**：閒置現金以 0 納入。
6. **相同成熟樣本**：entry policy 比較使用一致成熟條件。
7. **避免 in-sample threshold hunting**。
8. **先 OOS 再 production**。
9. **市場環境不作未驗證硬 gate**。
10. **每輪都更新本文件**。
11. **任何被發現有 look-ahead 的舊結果必須明確標成 superseded，不可靜默沿用。**

---

## 9. 相關輸出與 Workflow

### 目前有效輸出

- `data_prediction_analysis/quarterly-financial-quality/two-stage-fundamental-quality-phase3-corrected-summary.json`

Corrected full artifact 由 CI run 產生；repo 中保存 summary 與可重跑 script / workflow。

### Corrected workflows

- `[07 研究] 基本面雙確認－Phase 3 Corrected Revalidation`

2026-08-11 validation：

- syntax：pass
- event-driven anti-lookahead tests：pass
- conservative anti-lookahead tests：pass
- fundamental state resolver tests：pass
- event timeline tests：pass
- corrected policy backtest：pass
- acceptance：pass

### 舊輸出（superseded baseline，僅留歷程）

- `two-stage-fundamental-quality-entry-timing-paired.json`
- `two-stage-fundamental-quality-entry-policy.json`
- `two-stage-fundamental-quality-staged-entry.json`
- `two-stage-fundamental-quality-pullback-predictors.json`
- `two-stage-fundamental-quality-pullback-walk-forward.json`

在 corrected universe 重跑前，不得將舊績效數字當 production evidence。

---

## 10. 目前一句話版本

> **Corrected anti-lookahead 後，電子股 `FAS >= 8 + FQ >= 10` 仍保有明顯選股效果；signal-close direct D60 約 +26.16%，等待 -5% / -10% 會漏掉大量贏家。但 V1 使用者是晚上看到基準日訊號、下一交易日才能買，因此下一個最重要的研究不是再微調回檔，而是驗證 next-day execution 是否仍保留這個 alpha。**
