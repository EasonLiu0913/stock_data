# 基本面雙確認研究總誌

> 研究主題：電子股 `FAS >= 8 + FQ >= 10` 基本面雙確認訊號，以及其進場時機、回檔、分批進場與 timing 因子研究。
>
> **維護規則：這是一份持續更新文件。每完成一輪與本研究主題相關的實驗、回測或 OOS 驗證，都必須回來更新本文件，而不是只留下 JSON / workflow 結果。**
>
> 更新時至少補充：研究問題、方法、樣本、關鍵結果、結論是否改變、哪些假設被淘汰、下一輪建議。

---

## 1. 目前研究結論摘要

截至 2026-08-11，目前證據最支持以下架構：

1. **`FAS >= 8 + FQ >= 10` 是目前最重要的選股 alpha。**
2. **-5% / -10% 回檔本身對「有觸發回檔的股票」確實能改善進場價格與後續持有品質。**
3. 但如果把 -5% / -10% 當成所有股票的必要 entry gate，會漏掉大量「不回檔直接走強」的股票。
4. 分批保留資金等回檔可以降低 MAE、提高持有穩定性，但目前沒有提高總資金報酬。
5. 因此回檔更適合作為 **risk management / 加碼訊號**，不是主要選股訊號。
6. 選股因子與 timing 因子應拆開：
   - 選股：FAS / FQ
   - Timing：前 20 日波動、前 5 日漲幅、前 20 日漲幅、距 20 日高點
7. 下一階段不應繼續微調固定分批比例，而應以 OOS 驗證決定 timing 是否值得進入分流策略。
8. **Timing 四因子的 in-sample 辨識力未能穩定通過 OOS / walk-forward；目前維持 100% 訊號日直接進場為預設，timing 僅保留研究用途。**

---

## 2. 核心研究 Universe

目前主要研究 Universe：

- 電子股
- `FAS >= 8`
- `latest-known FQ >= 10`
- 所有因子與訊號 membership 僅使用當時可得資料，避免 look-ahead bias

主要研究區間：

- `start_month = 202401`
- `end_month = 202606`

目前基本候選事件約 199 筆；部分 timing 因子研究因價格歷史完整性，實際可用樣本為 187 筆。

---

## 3. 目前有效度排名

### 3.1 選股 / 報酬 Alpha 排名

| 排名 | 指標 / 規則 | 目前評價 | 主要證據 |
|---|---|---|---|
| 1 | **FAS >= 8 + FQ >= 10** | **目前最強核心訊號** | 100% 訊號日直接進場 D60：平均約 +30.68%、中位約 +19.77%、正報酬率約 79.39% |
| 2 | **-10% 回檔後進場** | 成交後品質非常強，但不能當 entry gate | 觸發後 D60 中位約 +27.34%，但參與率只有約 36% |
| 3 | **-5% 回檔後進場** | 有效，但同樣會漏掉強勢股 | 觸發後 D60 中位約 +24.22%，參與率約 59% |
| 4 | 50% 訊號日 + 50% 等 -5% | 較穩，但犧牲報酬 | D60 平均約 +24.63%，MAE 改善但總報酬低於直接買 |
| 5 | 其他分批進場配置 | 主要是風控，不是 alpha enhancement | 越多資金留給回檔，MAE 越低，但總資金報酬越低 |
| 6 | 等回檔後再 fallback 追價 | 效果不好 | D5 / D10 / D20 fallback 多數仍輸直接買 |

目前最重要的總結：

> **FAS + FQ 是 alpha；回檔不是主要 alpha，而是進場價格與風險管理工具。**

---

### 3.2 回檔 Timing 因子排名

目標：預測訊號後 20 個交易日內是否觸發相對 base close 的 -5% / -10% 回檔。

整體基準：

- -5% 回檔率：約 61.50%
- -10% 回檔率：約 36.90%

| 排名 | Timing 因子 | -5% 最大分桶 spread | -10% 最大分桶 spread | 目前評價 |
|---|---|---:|---:|---|
| 1 | **前 20 日波動度 `pre20_vol_pct`** | 29.73pp | **37.84pp** | **目前最強 timing 候選** |
| 2 | **前 20 日報酬 `pre20_return_pct`** | 19.70pp | **29.73pp** | 深回檔辨識力強 |
| 3 | **前 5 日報酬 `pre5_return_pct`** | **24.96pp** | 20.27pp | 型態直觀、實務性高 |
| 4 | **距 20 日高點 `dist_from_20d_high_pct`** | 14.37pp | **24.96pp** | 適合作輔助 timing |
| 5 | 大盤前 20 日報酬 | **31.77pp** | 21.56pp | spread 大，但型態不單調，疑似 regime effect |
| 6 | FQ score | 29.66pp | 18.98pp | 有差，但沒有穩定單調方向 |
| 7 | FAS total | 18.43pp | 18.49pp | 有些辨識力，但不是核心 timing 因子 |
| 8 | FAS YoY score | 15.70pp | 16.59pp | 弱到中等 |
| 9 | FAS MoM score | 16.90pp | 11.58pp | 偏弱 |
| 10 | FAS persistence | 13.94pp | **3.81pp** | 對深回檔幾乎無效 |
| 11 | Revenue high score | **4.46pp** | **2.42pp** | 幾乎無效於 timing |
| 12 | **FAS acceleration** | **3.79pp** | **0.40pp** | **目前最無效的回檔 timing 因子** |

注意：

- 「最無效」只代表 **不適合拿來預測回檔 timing**。
- 不代表該因子對基本面選股沒有價值。
- 特別是 FAS acceleration、revenue high 仍可能是選股成分，只是目前無法告訴我們「會不會先跌」。

---

## 4. 各輪研究紀錄

### Round 1 — Paired Counterfactual：同一股票直接買 vs 回檔買

研究問題：

> -5% / -10% 回檔本身到底有沒有改善進場，還是只是那群股票本來就比較會漲？

方法：

- 只比較同一個 stock-event
- -5% / -10% 於 20 個交易日內首次觸發
- 比較兩種模式：
  - `same_holding`：直接買與回檔買，各自持有同樣交易日數
  - `same_exit_date`：兩者在相同日曆退出日結算

關鍵結果：

- -5% / -10% 回檔後進場，在已觸發回檔的樣本中，endpoint / MFE / MAE 多數顯著優於直接進場。
- -10% 尤其明顯：同樣持有期間下，endpoint 改善率約 91%～94%，MAE 改善率約 97%～98%。

但重要限制：

- -5% 觸發率約 64%
- -10% 觸發率約 41%

因此此輪只回答：

> **「如果之後真的有回檔，等回檔買是不是比較好？」答案：是。**

尚未回答：

> **「所有訊號都應該等回檔才買嗎？」**

---

### Round 2 — Policy Backtest：全部訊號層級比較

研究問題：

> 把沒有觸發回檔的股票也算回來，等待 -5% / -10% 是否仍然比直接買好？

比較策略：

- 訊號日直接買
- 等 -5%，沒等到放棄
- 等 -10%，沒等到放棄
- 等 -5% / -10%，第 5 / 10 / 20 日 fallback 收盤進場

關鍵 D60 結果：

- 直接買：平均約 +30.68%、中位 +19.77%、正報酬率 79.39%
- -5% 等不到放棄：平均約 +34.61%、中位 +24.22%，但參與率僅約 59%
- -10% 等不到放棄：平均約 +37.99%、中位 +27.34%，但參與率僅約 36%

最重要發現：

**沒有回檔的股票本身往往就是強勢股。**

- 沒等到 -10% 的 105 個事件，如果直接買：
  - 約 83.81% 最後 D60 為正報酬
  - 約 45.71% D60 >= +30%
  - 約 48.57% 曾 MFE >= +50%
- 沒等到 -5% 的 67 個事件，如果直接買：
  - 約 83.58% D60 為正報酬
  - 約 47.76% D60 >= +30%
  - 約 52.24% 曾 MFE >= +50%

結論：

> **不能把回檔當必要 entry gate。等待會系統性漏掉不回檔直接走強的股票。**

Fallback 也無法補救：先錯過強勢股、之後再追，整體仍多數輸直接進場。

---

### Round 3 — Staged Entry：分批進場

研究問題：

> 如果訊號日先買部分部位，再保留資金等 -5% / -10%，是否能同時吃到不回檔強勢股與回檔價格優勢？

比較：

- 100% 訊號日
- 50% 訊號日 + 50% -5%
- 50% 訊號日 + 50% -10%
- 50% + 25% -5% + 25% -10%
- 33% + 33% -5% + 34% -10%
- 25% + 25% -5% + 50% -10%

規則：

- 未觸發加碼資金保持現金
- 不追價
- 所有部位使用相同訊號日起 D20 / D40 / D60 日曆退出日
- 報酬以總資金計算，現金部位報酬為 0

D60 核心結果：

| 策略 | 平均投入資金 | 平均報酬 | 中位報酬 | 正報酬率 | MAE 中位 |
|---|---:|---:|---:|---:|---:|
| 100% 訊號日 | 100% | +30.68% | +19.77% | 79.39% | -9.96% |
| 50% + 50% -5% | 79.70% | +24.63% | +17.26% | 80.61% | -6.70% |
| 50% + 50% -10% | 68.18% | +21.59% | +13.64% | 81.21% | -4.98% |
| 25% + 25% -5% + 50% -10% | 58.03% | +18.56% | +11.15% | 82.42% | -3.35% |

結論：

> **越多資金留給回檔，勝率與 MAE 越漂亮，但總資金報酬越低。**

因此：

- 若追求最大化總資金成長：目前 100% 訊號日直接進場最好
- 若重視持有體驗 / 回撤：50% 訊號日 + 50% 等 -5% 是目前比較合理的折衷
- -10% 適合「遇到時加碼」，但不適合預留太大比例資金專門等待

---

### Round 4 — Pullback Predictor Factors：回檔機率單因子研究

研究問題：

> 能不能在訊號當下，利用事前可得資料，分辨哪些股票 20 日內比較可能回檔 -5% / -10%？

樣本：

- 187 個具完整價格特徵事件
- 整體 -5% 回檔率：約 61.50%
- 整體 -10% 回檔率：約 36.90%

核心候選：

#### 1. 前 20 日波動度 `pre20_vol_pct`

目前最強單因子。

- 約 14.95%～18.19% 波動區間：
  - -5% 回檔率約 81.08%
  - -10% 回檔率約 62.16%
- 較低波動 12.25%～14.95%：
  - -5% 約 51.35%
  - -10% 約 24.32%

注意：型態非單調，不能直接把「波動越高」當規則。

#### 2. 前 5 日報酬 `pre5_return_pct`

型態最直觀。

- 前 5 日約 -2%～+3%：-5% 回檔率約 51.35%
- 前 5 日約 +15.5%～+38.2%：-5% 回檔率約 76.32%，-10% 約 50%

初步解讀：

> **短線已大漲的基本面雙確認股，更容易在接下來 20 日出現回檔。**

#### 3. 前 20 日報酬 `pre20_return_pct`

- 前 20 日約 +18.6%～+31.4%：-10% 回檔率約 54.05%
- 前 20 日約 +6.0%～+18.5%：-10% 約 24.32%

同樣非完全單調，因此不能直接固定門檻上線。

#### 4. 距 20 日高點 `dist_from_20d_high_pct`

有輔助辨識力。

- 距高點約 -10.6%～-6.6%：-10% 回檔率約 48.65%
- 已遠離高點約 -28.8%～-11.2%：-10% 約 23.68%

初步顯示「已經跌很多」並不代表後面更容易再深跌。

#### 大盤前 20 日報酬

spread 很大，但分桶不單調，疑似受到市場 regime / 月份集中影響。

目前只保留為輔助觀察，不列入第一輪核心 timing classifier。

#### FAS / FQ 子因子

- FAS total、FAS YoY、FAS MoM：有些差異，但不如價格 timing 因子穩定
- FAS persistence：對 -10% 幾乎無辨識力
- revenue high：幾乎沒有 timing 能力
- FAS acceleration：對 -10% spread 只有約 0.4pp，幾乎完全無 timing 能力

結論：

> **選股因子與 timing 因子是不同問題。FAS / FQ 決定「這是不是值得買的公司」，價格動能與波動更接近回答「現在是不是容易先回檔」。**

---

## 5. 已被淘汰或降級的假設

### 淘汰：所有基本面雙確認股票都等 -5% / -10% 才買

原因：

- 會漏掉大量不回檔直接走強的股票
- 總策略層級參與率過低

### 淘汰：等不到回檔再第 5 / 10 / 20 日 fallback 追價

原因：

- 大多數 horizon 下仍輸訊號日直接進場
- 本質上是先錯過強勢段，再用較差時點追回

### 降級：固定分批比例作為 alpha enhancement

原因：

- 可以降低 MAE
- 但目前所有分批配置都降低總資金報酬
- 更像風控工具，而不是提高 alpha 的方法

### 降級：FAS acceleration / revenue high 作為 timing 因子

原因：

- 對未來 -5% / -10% 回檔辨識力極低
- 只能保留在基本面選股層，不應拿來判斷進場 timing

---

## 6. 目前最值得保留的研究架構

### Layer 1：選股

目前核心：

- `FAS >= 8`
- `FQ >= 10`

作用：

> 決定「這檔股票是否值得進入候選池」。

### Layer 2：Timing / Positioning

目前核心候選：

1. `pre20_vol_pct`
2. `pre5_return_pct`
3. `pre20_return_pct`
4. `dist_from_20d_high_pct`

輔助：

- `market_pre20_return_pct`

作用：

> 決定「訊號日應該直接買多少、是否值得保留資金等待回檔」。

不要混用：

- FAS / FQ 不應因為 timing 結果不好就被否定
- timing 因子也不應取代基本面選股訊號

---

## 7. 下一輪研究優先順序

### Priority 1 — Walk-forward / OOS timing validation

不要直接用目前 187 筆樣本找固定門檻後原地驗證。

建議：

- Train：較早月份
- Validation：後續完全未見月份
- 或 rolling / walk-forward：以前段資料建立 scoring，預測下一季，再向前滾動

只先使用：

- `pre20_vol_pct`
- `pre5_return_pct`
- `pre20_return_pct`
- `dist_from_20d_high_pct`

要驗證：

- 高回檔機率組 vs 低回檔機率組，OOS 是否仍能拉開 -5% / -10% 發生率
- spread 是否跨不同市場 regime 仍存在
- 樣本是否過度集中在特定月份 / 產業 / 個股

### Priority 2 — 真正的分流進場 Policy

只有 Priority 1 OOS 成立後才做。

可能框架：

- 低回檔機率 → 100% 訊號日
- 中回檔機率 → 50% 訊號日 + 50% -5%
- 高回檔機率 → 更保守初始部位，保留回檔加碼

最終評估必須和 **100% 訊號日直接進場** 比較總資金報酬，不只比較成交後報酬。

---

## 8. 研究紀律與防呆

後續每輪研究必須遵守：

1. **Anti-lookahead**：只使用訊號當下或之前已知資料。
2. **不要只看 triggered subset**：若策略有「等不到就不買」，必須把 missed winners 一併計算。
3. **總資金報酬優先**：若有閒置現金，現金報酬必須以 0 納入，不可只比較已成交部位。
4. **相同成熟樣本**：不同 entry policy 比較時，盡量使用一致成熟條件。
5. **避免 in-sample threshold hunting**：看到某個分桶漂亮，不得直接升級成 production rule。
6. **先 OOS 再組合**：單因子有訊號後，先驗證穩定性，再建立 classifier / scoring。
7. **市場環境不要直接當策略硬 gate**：市場 regime 可做分析與提示，但除非另有研究證據，不應擅自把牛熊市變成選股必要條件。
8. **每輪都更新本文件**：JSON 是結果資料，本文件才是累積研究知識與決策脈絡。

---

## 9. 相關研究輸出與 Workflow

主要輸出：

- `data_prediction_analysis/quarterly-financial-quality/two-stage-fundamental-quality-entry-timing-paired.json`
- `data_prediction_analysis/quarterly-financial-quality/two-stage-fundamental-quality-entry-policy.json`
- `data_prediction_analysis/quarterly-financial-quality/two-stage-fundamental-quality-staged-entry.json`
- `data_prediction_analysis/quarterly-financial-quality/two-stage-fundamental-quality-pullback-predictors.json`

主要 workflows：

- `[07 研究] 基本面雙確認－電子股回檔進場 Paired Counterfactual`
- `[07 研究] 基本面雙確認－電子股回檔進場 Policy Backtest`
- `[07 研究] 基本面雙確認－電子股分批進場 Staged Entry`
- `[07 研究] 基本面雙確認－回檔機率預測因子`

---

## 10. 目前一句話版本

> **先用 FAS + FQ 找出值得買的股票；目前不要因為期待回檔而錯過強勢股。回檔應作為加碼 / 風控工具，而下一個真正值得驗證的是：能否用事前價格波動與漲幅因子，OOS 預測哪些股票比較可能先回檔。**

---

<!-- WALK_FORWARD_OOS_START -->
## Round 5 — Timing Walk-forward / OOS 驗證

研究問題：上一輪挑出的四個 timing 因子（`pre20_vol_pct`、`pre5_return_pct`、`pre20_return_pct`、`dist_from_20d_high_pct`）在未見資料上，是否真的能區分「容易回檔」與「不容易回檔」？

方法：

- 固定 OOS：`202601` 起為測試集。
- 訓練資料截止 `202511`，`202512` 保留為 embargo，避免最近訊號的 20 日回檔標籤尚未成熟。
- 模型只使用上述 4 個 timing 因子；每個因子僅依訓練集 quintile 回檔率形成分數，再對測試集評分。
- 另外使用季度 expanding-window walk-forward，且每折都保留 1 個月 embargo。
- 評估 AUC 與預測 high / low tercile 的實際回檔率差距。

固定 OOS 結果：

| Target | Train | OOS | OOS baseline | AUC | High-Low spread | 結論 |
|---|---:|---:|---:|---:|---:|---|
| -5% | 109 | 65 | 58.4615% | 0.4703 | -1.7316pp | **未通過 OOS 驗證** |
| -10% | 109 | 65 | 32.3077% | 0.6017 | 11.0389pp | **有潛力但未通過** |

Walk-forward 穩定性：

| Target | Folds | Median AUC | Avg AUC | Median high-low spread | 正 spread folds | AUC >= 0.55 folds |
|---|---:|---:|---:|---:|---:|---:|
| -5% | 5 | 0.4091 | 0.5353 | -19.0476pp | 40% | 40% |
| -10% | 5 | 0.5672 | 0.476 | 9.5238pp | 80% | 60% |

本輪結論：

> **四個 timing 因子的 in-sample spread 尚未轉化成足夠穩定的 OOS 優勢；目前沒有證據支持取代 100% 訊號日直接進場。Timing 因子保留研究用途，不應因上一輪漂亮分桶而直接做進場 gate。**

機器判定：

- -5%：`not_validated`
- -10%：`promising_but_not_validated`
- Routed-entry ready：`false`

JSON：`data_prediction_analysis/quarterly-financial-quality/two-stage-fundamental-quality-pullback-walk-forward.json`
<!-- WALK_FORWARD_OOS_END -->

---

<!-- PRODUCTION_DIRECT_ENTRY_SIGNAL_START -->
## Production promotion — 基本面雙確認訊號日

研究結論已正式接到股票預測的 Strategy Registry，但定位仍是「可觀測研究訊號」，不是保證買進建議。

- Strategy ID：`two_stage_fundamental_quality_direct_entry_v1`
- 顯示名稱：**基本面雙確認－訊號日直接進場**
- Atomic tag：`fundamental_two_stage_signal_day_v1` / **基本面雙確認訊號日**
- Universe：電子股
- FAS：`>= 8`
- FQ：`latest-known financial_quality_score >= 10`
- 日期規則：**只在 monthly signal event 的 `base_trading_date` 當日命中**；之後不會因曾經出現過訊號而每天持續掛標籤。
- Anti-lookahead：FQ 沿用 `conservative_known_date <= event date` 的 latest-known join；FAS 沿用原月營收研究 scoring。
- Timing：目前不加入 -5% / -10% 等待 gate。Round 5 OOS 已證實 -5% timing 未通過，-10% 也僅 promising but not validated。
- Production source：`strategy_tag_features.two_stage_fundamental_signal_day`，由 Registry 統一產生預測與覆盤分類，避免 Dashboard 另寫一套條件。

目前 production 決策：

> **FAS >= 8 + FQ >= 10 的電子股，在實際訊號日列入「基本面雙確認－訊號日直接進場」清單；未來若研究門檻改變，必須新增版本，不覆寫 v1 歷史定義。**
<!-- PRODUCTION_DIRECT_ENTRY_SIGNAL_END -->
