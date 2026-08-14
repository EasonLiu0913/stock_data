# EPS 估值公式適用性政策研究

## 背景

`yoy_scaled_remaining`（已公布 YTD + 去年剩餘季度 × 今年 YTD 年增倍率）在歷史回測中曾出現 `10^15%` 以上的平均區間誤差。研究確認這不是單純 UI 格式問題，而是兩種不同的數值/財務適用性問題疊加：

1. 去年同期 YTD EPS 接近 0，YoY 倍率失去經濟意義，甚至受浮點誤差影響把理論上的 0 當成極小正數。
2. TTM EPS 接近 0 時，事件日/歷史 P/E 可膨脹至數百～數千倍，P/E 本身不再適合作為合理價乘數。

## 第一輪：YoY 倍率異常值

研究母體：2,595 個可還原 growth context 的事件；15,900 個公式列。

Growth multiplier 分布：

- P50：1.10x
- P90：2.86x
- P95：4.68x
- P99：21.77x
- Max：1.787e17x

最極端案例為 2534 2025Q3：去年前三季 EPS `0.10 - 0.12 + 0.02` 理論上為 0，但浮點累加留下極小正數，導致 growth 約 `1.787e17x`。

Growth cutoff 敏感度顯示 `<= 3x` 可保留約九成事件，同時把病態平均誤差恢復到可解讀範圍；`<= 2x` 雖更乾淨，但排除事件明顯增加。

因此採用：

- prior YTD EPS 必須 `> 1e-6`
- growth 必須 `> 0`
- growth 必須 `<= 3x`

## 第二輪：Shadow Study

在不修改原始研究輸出的前提下套用 `epsilon + growth<=3x`：

- 原始事件：2,658
- Shadow 有效事件：2,362
- 保留率：88.86%
- 原始平均 Range Error：被極端值推至約 `3.56e15%`
- Shadow 平均 Range Error：約 31.01%
- Range Error P50：19.18% -> 16.13%
- P95：143.64% -> 92.47%
- P99：667.37% -> 167.81%
- 最大值：`1.78e19%` -> 3,921.23%

Shadow 後殘餘最大值主要來自動態 P/E 爆高，而不是 YoY growth。

## 第三輪：P/E 適用區間

先固定上述 EPS guard，再研究三個動態 P/E 方法：

- `current_pe20`
- `hist_p20`
- `hist_q25_q75`

Guarded sample 的 P/E anchor 分布：

- P50：約 20.85x
- P75：約 32.72x
- P90：約 56.94x
- P95：約 85.57x
- P99：約 242.61x
- Max：5,570x

P/E 上限 100x 約落在 P95 以上，仍保留約 95% 或更多樣本，同時排除 3060、3043、6112 等 near-zero-EPS 導致的千倍 P/E 病態區域。30～50x 雖能得到更低的尾端誤差，但會排除太多仍可能具有合理高估值特性的股票，因此不採作全市場硬上限。

因此採用：

- 三個動態 P/E 方法的 P/E range 上緣不得超過 100x
- 固定 10–20、15–25、20–30 倍基準組不受此限制

## 顯示與排名政策

Arithmetic mean 對長尾極端值非常敏感，因此公式排名不應再以平均區間誤差作為第一排序鍵。

頁面預設排名改為：

1. Median Range Error
2. P95 Range Error
3. Hit Rate

同時保留：

- Mean Range Error：診斷用
- P99 Range Error：尾端風險
- Median Center Error：合理價中心偏差

Pages 部署階段會讀 `valuation-applicability-policy.json`，在不改動原始歷史研究檔的前提下產生政策過濾後的 `valuation-summary.json` 與 per-stock lazy-loading payload。下一次完整 EPS 回測則由正式產生器直接套同一套政策。

## Source of truth

- 正式公式：`scripts/generate_eps_valuation_lab.js`
- Pages 適用性政策：`data_prediction_analysis/eps-valuation/valuation-applicability-policy.json`
- Pages splitter：`scripts/prepare_eps_valuation_pages_payload.js`
- 異常研究：`yoy-scaled-outlier-study.json`
- Shadow Study：`yoy-scaled-shadow-study.json`
- P/E Study：`pe-applicability-study.json`

若未來調整門檻，應先新增研究證據，再同步更新正式公式與 Pages policy，避免兩邊規則漂移。
