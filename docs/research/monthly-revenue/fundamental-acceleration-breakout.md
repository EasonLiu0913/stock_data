# Fundamental Acceleration Breakout Research

Status: research-only candidate factor

## Motivation

川湖（2059）在 2026 年春季提供了一個值得系統化研究的案例：市場可能不是單純對「高營收成長」反應，而是對成長斜率改變、月營收跳升與新高突破的組合重新定價。

本研究不把單一股票事後表現直接升級為策略，而是把可在 MOPS 月營收資料中事前觀察的訊號轉成可重現的歷史因子，依照專案的 Evidence before Strategy 原則進行長期驗證。

## First-version hypothesis

第一版只使用月營收資料可以客觀證明的資訊：

- YoY 成長率；
- MoM 成長率；
- YoY 加速度（本月 YoY - 前月 YoY）；
- 3 / 6 / 12 個月營收新高。

不從月營收推論毛利率、EPS、產品組合、急單、空運、產能利用率或客戶拉貨。這些資訊未來必須由財報或營運資料源獨立加入。

## Candidate definitions

### acceleration_base

```text
YoY >= 20%
AND MoM > 0
AND YoY accelerating
```

### acceleration_3m_high / 6m_high / 12m_high

在 `acceleration_base` 上，再要求目前營收為指定回看區間的新高。

### acceleration_breakout

```text
YoY >= 30%
AND MoM >= 10%
AND YoY acceleration >= 10 percentage points
AND 6-month revenue high
```

### acceleration_breakout_strong

```text
YoY >= 50%
AND MoM >= 20%
AND YoY acceleration >= 20 percentage points
AND 6-month revenue high
```

這些門檻是研究切片，不是已驗證的最佳參數。長歷史資料必須比較不同期間、產業與樣本量後才能決定是否保留或調整。

## Evaluation

Output:

```text
data_prediction_analysis/monthly-revenue/monthly-signals/fundamental-acceleration-breakout-experiment.json
```

Generator:

```text
scripts/summarize_mops_revenue_fundamental_acceleration_breakout.js
```

Each candidate is compared against the same-month listed-stock universe for:

- D1;
- D3;
- D5;
- D10;
- D20;
- relative win rate;
- relative-win-rate uplift;
- average excess return;
- excess-return uplift;
- month-level stability;
- ranking score.

The experiment inherits the conservative monthly-revenue availability rule from the historical monthly signal dataset, so it must not be interpreted as an individual filing-day event study.

## Promotion requirements

Do not promote this factor into the production Strategy Registry until at least:

1. staged long-history expansion is complete enough to test multiple market periods;
2. sample size is adequate rather than dominated by a few AI-server names;
3. performance is stable across months rather than driven by one short window;
4. industry-level results are inspected to distinguish a general factor from an industry-cycle effect;
5. threshold sensitivity is tested;
6. financial-statement enrichment can separately test gross-margin/EPS expansion without look-ahead leakage.

## Planned enrichment

A future second layer may test:

```text
Revenue acceleration breakout
+ gross-margin expansion
+ EPS acceleration
+ financial-statement quality / operating leverage
```

Operational signals such as new-product shipment, urgent orders, air freight, customer willingness to absorb freight, and capacity utilization should remain a separate qualitative/structured-operational research layer unless a reliable historical dataset is available.
