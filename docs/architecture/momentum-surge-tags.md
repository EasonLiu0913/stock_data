# 動能飆股標籤系統 v1

## 目的

把「今天漲最多」改成可每日重現、可回填、可覆盤的動能事實標籤。標籤只描述當下證據，不把市場牛熊當成入選閘門，也不直接等同交易策略。

## Momentum Score

總分 100，固定拆成五個構面：

| 構面 | 上限 | 主要來源 |
| --- | ---: | --- |
| 價格動能 | 30 | 1／3／5 日報酬 |
| 量能 | 20 | 五日量比、當日收盤位置 |
| 趨勢 | 20 | 多頭排列、20 日趨勢品質、SMA20 乖離 |
| 籌碼 | 20 | 法人／券商既有標準化訊號；缺資料時不臆測 |
| 突破 | 10 | 放量突破、20 日市場／產業相對強勢、領先持續性 |

所有輸入均只能來自 `base_trade_date` 當日或以前的資料。缺少某個輸入時該項不加分，不用未來資料補值。

### 價格動能（30）

- 1 日：`>= 7% / 5% / 3% / 1%` → `10 / 8 / 5 / 2`
- 3 日：`>= 12% / 8% / 5% / 2%` → `10 / 8 / 6 / 3`
- 5 日：`>= 18% / 12% / 7% / 3%` → `10 / 8 / 6 / 3`

### 量能（20）

五日量比：

- `>= 3` → 15
- `>= 2` → 12
- `>= 1.5` → 8
- `>= 1.2` → 4
- `>= 1` → 2

收盤位置 `(close-low)/(high-low)`：

- `>= 0.85` → 5
- `>= 0.70` → 3
- `>= 0.55` → 1

### 趨勢（20）

- 多頭排列且均線走升 → 10
- 20 日趨勢品質良好 → 5
- SMA20 乖離 `>= 5% / 0% / -3%` → `5 / 4 / 2`

### 籌碼（20）

優先讀取既有標準化法人與券商訊號。若來源缺少，不把缺資料解讀成偏多，也不阻止其他四構面正常計分。

### 突破（10）

- 放量突破確認 → 5
- 20 日市場相對強勢前 20% → 2
- 20 日產業相對強勢前 20% → 2
- 七日領先至少五日 → 1

舊資料缺明確突破欄位時，只有「3 日漲幅 >= 5% 且五日量比 >= 1.5」可取得最多 4 分的弱 fallback，不冒充正式突破。

## 固定標籤

| 標籤 | 規則 | 用途 |
| --- | --- | --- |
| 動能準備 | 50–64 | C 級，條件開始累積 |
| 動能加速 | 65–79 | B 級，已有明顯共振 |
| 動能飆股 | >= 80 | A 級，每日主要清單 |
| 量價共振 | 價格分 >= 15 且量能分 >= 10 | 可供策略公式組合 |
| 籌碼共振 | 籌碼分 >= 10 | 可供策略公式組合 |
| 強勢突破 | 突破分 >= 5 且量能分 >= 8 | 可供策略公式組合 |
| 動能過熱 | A 級 + RSI >= 80 + 5 日 >= 15% | 觀察風險，不自動剔除 |
| 疑似爆量出貨 | 五日量比 >= 2.5 且收盤位置 <= 0.40 | 觀察風險，不自動剔除 |

A／B／C 三層互斥；一檔股票只會落在其中一層。其他共振與風險標籤可同時存在。

## 分數加速度

`momentum_acceleration = momentum_score - previous_momentum_score`

若前一期分數不存在，值必須是 `null`，不能用 0 或猜測值代替。`動能分數加速度 +10` 是研究用隱藏標籤，不是 A／B／C 的必要條件，因此新版首日或歷史資料未回填時，不會讓每日清單失效。

## Registry 與產出

- 既有主 Registry：`config/strategy-tag-registry.json`
- 動能擴充 Registry：`config/momentum-tag-registry.json`
- 分數引擎：`scripts/momentum_tag_features.js`
- 合併與 snapshot：`scripts/strategy_tag_engine.js`

`loadRegistry()` 會把動能擴充 Registry 合併到既有 Registry；snapshot 仍使用同一套 `tag_registry`、`tag_classifications`、`atomic_tags` 結構，因此策略公式實驗室與覆盤不需要另一套資料格式。

## 歷史與覆盤資料層

Momentum v1 的每日研究資料分為兩層：

```text
data_prediction_analysis/momentum-history/v1/YYYYMMDD.json
  -> 凍結 signal date 當時的分數、等級、五構面、共振事實與 acceleration

data_prediction_analysis/momentum-replay/v1/YYYYMMDD.json
  -> 僅在未來交易日真正發生後加入 T+1 / T+3 / T+5 outcome
```

History 的 canonical source 是 versioned Strategy Snapshot manifest；同日優先有效 live snapshot，否則使用最新且含 Momentum v1 的 historical recalculation。History 不重新計算已凍結的 Momentum Score，只額外串接前一期 signal score 產生 acceleration。

Replay maturity 依市場後續交易日判斷，而不是要求所有股票都有價格。個股缺價只降低 `horizon_coverage`，不能把已發生的整個市場 T+1 誤判成尚未成熟。

## Evidence aggregation v1

下一層研究聚合固定寫入：

```text
data_prediction_analysis/momentum-research/v1/summary.json
```

方法版本：`methodology_version = 1`。

目前比較的研究分組：

- A / B / C；
- Score `50–64 / 65–79 / 80–89 / 90+`；
- Acceleration `<0 / 0–9 / 10–19 / 20+`；
- 單一事實：量價共振、籌碼共振、強勢突破；
- 組合：量價+籌碼、量價+突破、籌碼+突破、三者同時成立。

每個 group 對 T+1 / T+3 / T+5 分別保存：

- 選中樣本數與成熟樣本數；
- coverage；
- 平均與中位報酬；
- 上漲率；
- 平均 MFE / MAE；
- MFE 觸及 +4% / +7% / +10% 的比率。

尚未成熟的 horizon 一律保持空值，不以 0 補值。研究頁面為：

```text
public/momentum-research-dashboard.html
```

## 證據門檻與升版規則

研究聚合只提供 evidence status，不自動改變 production：

- `< 30` 個成熟樣本：`insufficient`；
- `30–99`：`observe`；
- `>= 100`：`research_ready`，代表可以進一步比較，不代表可以直接升版。

任何 Momentum v2 門檻調整仍需另行檢查跨日期穩定性、產業分布、不同市場背景與樣本品質，並以新的 version 保存；不得用當前少量樣本直接修改 v1。

## 版本規則

1. v1 門檻一旦開始觀測，不直接改值。
2. 若回測後要調整權重或門檻，新增 `v2`，保留 v1 可重現性。
3. 不用市場牛／熊做 eligibility gate；市場環境只可作畫面提示或後續人工判斷。
4. 風險標籤是事實標籤，不自動從 A 級清單剔除股票。
5. 覆盤以 T 日分數對 T+1／T+3／T+5 報酬驗證，禁止把事後結果回寫成 T 日因子。
6. Research summary 只能累積證據，不得自動修改 Registry、固定策略或 prediction score。
