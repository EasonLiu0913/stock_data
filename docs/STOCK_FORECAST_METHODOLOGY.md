# 個股下一交易日預測方法

版本：`1.1.0`
適用範圍：臺灣證券交易所上市普通股  
預測目標：下一交易日的方向、風險、可能區間與關鍵價位  
核心原則：同一份資料、同一個資訊截止時間及同一版本規則，必須得到相同的核心判斷。

## 1. 為什麼必須規格化

只要求模型「分析價量、籌碼與新聞」無法保證一致。不同模型可能：

- 選擇不同日期或資料來源。
- 對同一則新聞給予不同權重。
- 使用不同的 RSI、ATR 或均線公式。
- 在結果發生後，不自覺加入當時尚未公開的資料。
- 用少量歷史案例產生看似精準、實際不可重現的機率。

因此，本方法將判斷拆成兩層：

1. **核心判斷層**：只使用結構化數據和固定規則計分，決定方向標籤與風險等級。
2. **背景說明層**：公司公告、產業新聞及海外事件只能解釋風險，不得任意改變核心標籤。

若要完全避免模型差異，最終仍應將本文件的規則實作成程式。本文是程式化之前的唯一規格來源。

## 2. 輸出契約

每份預測報告必須先固定以下欄位：

| 欄位 | 說明 |
|---|---|
| `methodology_version` | 本文件版本，例如 `1.1.0` |
| `generated_at` | 報告實際建立時間，須含時區 |
| `prediction_mode` | `prospective` 或 `historical_cutoff_simulation` |
| `stock_code` | 股票代號 |
| `stock_name` | 股票名稱 |
| `forecast_date` | 預測的交易日 |
| `base_trade_date` | 核心數據最後一個交易日 |
| `information_cutoff` | 資訊截止時間，須含時區 |
| `market` | 固定為 `TWSE` |
| `direction_score` | 依第 10 節計算 |
| `raw_direction_label` | 降級前方向 |
| `risk_score` | 依第 11 節計算 |
| `final_direction_label` | 套用風險降級後方向 |
| `data_completeness` | 依第 12 節計算 |
| `missing_data` | 缺少的資料種類 |
| `backtest_rule_id` | 依第 13 節選用的固定回測規則；無適用規則時為 `null` |
| `backtest_status` | `unavailable`、`insufficient`、`exploratory`、`weak`、`supportive` 或 `conflicting` |

報告檔名：

```text
public/predictions/YYYYMMDD-股票代號.html
```

其中 `YYYYMMDD` 是 `forecast_date`，不是報告建立日。

## 3. 時間與交易日規則

### 3.1 預測日期

1. 從 `base_trade_date` 往後找第一個不在 `data_history_sma/non_trading_days.json` 的平日。
2. 該日即為 `forecast_date`。
3. 星期五收盤後做預測時，正常情況下預測日是下週一。
4. 連假期間必須繼續跳過所有非交易日。

### 3.2 資訊截止時間

核心預測預設截止於：

```text
base_trade_date 15:30:00 Asia/Taipei
```

這個時間足以涵蓋台股收盤價量，但部分盤後籌碼資料可能尚未發布。只能使用截止時間前實際取得的資料。

`information_cutoff` 是允許使用資訊的最晚時間，不代表所有資料在該時間已經發布或已被抓取。每種來源應另外保存：

- `source_trade_date`
- `fetched_at`，若原始檔有可靠抓取時間
- 原始檔相對路徑
- 原始檔 SHA-256

若原始檔沒有 `fetched_at`，報告只能宣稱「使用標記為該交易日或更早的資料」，不得宣稱在某個精確時間已完整取得。

如果報告要加入隔夜美股，必須建立另一個明確版本，例如：

```text
forecast_date 08:30:00 Asia/Taipei
```

兩種截止時間不得混用。美國當地星期五的完整收盤，在台北通常已是星期六，不能宣稱它在星期五台股收盤時已知。

### 3.3 禁止偷看未來

不得使用：

- `forecast_date` 的開盤、盤中或收盤資料。
- 截止時間後發布的法人、融資、分點或新聞。
- 事後更新過、但沒有保存原始發布時間的資料。
- 用 `forecast_date` 的結果反過來選擇最有利的指標。

驗證結果必須與預測特徵分開呈現。

### 3.4 事前預測與歷史模擬

只有在 `forecast_date` 開盤前完成並留下可驗證時間戳的報告，才能設定：

```text
prediction_mode = prospective
```

在預測交易日開盤後才建立，或缺少可驗證事前時間戳時，必須設定：

```text
prediction_mode = historical_cutoff_simulation
```

歷史模擬仍須依 `information_cutoff` 過濾輸入，但不能宣稱它已由時間戳證明完全未查看結果。

## 4. 資料來源優先級

同一欄位出現差異時，依下列順序選擇：

1. TWSE 官方結構化資料。
2. 專案內已保存的 TWSE 原始檔。
3. 富邦 MoneyDJ 結構化或爬取資料。
4. 公司官網或公開資訊觀測站公告。
5. 其他財經網站，只能交叉核對。

核心資料路徑：

| 類型 | 路徑 |
|---|---|
| 價格、成交量、均線 | `data_fubon/fubon_YYYYMMDD_sma.json` |
| 大盤指數 | `data_twse_mi_index/YYYYMMDD_twse_mi_index.json` |
| 三大法人 | `data_twse_institutional_investors/YYYYMMDD_twse_institutional_investors.json` |
| 融資融券 | `data_twse_margin_balance/YYYYMMDD_twse_margin_balance.csv` |
| 券商分點 | `data_fubon_broker_details/fubon_YYYYMMDD_券商分點進出明細.json` |
| 股票清單 | `data_twse/twse_industry_Stock.json` |
| 非交易日 | `data_history_sma/non_trading_days.json` |

### 4.1 資料衝突

若高優先級來源存在：

- 使用高優先級來源。
- 在報告註明差異。
- 不得平均兩個來源。

若只有低優先級來源：

- 可以使用，但必須標記 `provisional`。
- 降低資料完整度。

## 5. 股票範圍與公司行動

### 5.1 股票範圍

回測與橫斷面比較只包含 `data_twse/twse_industry_Stock.json` 中的上市普通股。

排除：

- ETF。
- ETN。
- 權證。
- REIT。
- TDR。
- 特別股。
- 創新板中不屬於普通上市股票清單者。

### 5.2 除權息與減資

若 `base_trade_date` 或前一交易日有除權、除息、減資或面額變更：

1. 日報酬優先採 TWSE 官方漲跌百分比或官方參考價計算。
2. 不得直接用未調整的前收與當日收盤計算報酬。
3. 回測時若無法可靠還原參考價，排除該樣本。

回測必須同時檢查前一交易日、訊號日及結果日。任一天發生公司行動而無法可靠還原報酬時，整筆樣本排除並記錄原因。

### 5.3 歷史股票母體

若只有目前的 `data_twse/twse_industry_Stock.json`，可以用於回測，但必須輸出：

```text
universe_mode = current_list
survivorship_bias_warning = true
```

若未來取得逐日上市普通股清單，應改用每個樣本日當時的股票母體：

```text
universe_mode = point_in_time
```

## 6. 資料驗證順序

每次預測必須依序完成：

1. 確認股票代號與名稱相符。
2. 確認 `base_trade_date` 是交易日。
3. 確認 OHLC 價格皆大於零，且 `low ≤ open/close ≤ high`。
4. 確認成交量大於零。
5. 確認 SMA5、SMA20、SMA60 使用同一交易日。
6. 確認法人、融資與分點日期沒有落後。
7. 確認沒有公司行動造成報酬失真。
8. 列出缺少的資料，不得用前一天資料冒充當天資料。

驗證失敗時：

- 價格資料缺失：停止預測。
- 大盤資料缺失：相對強弱不計分。
- 法人、融資或分點缺失：該項計零分並降低完整度。

## 7. 固定計算公式

以下的 `T` 代表 `base_trade_date`。

### 7.1 單日報酬

```text
r1 = (close[T] / close[T-1] - 1) × 100
```

### 7.2 三交易日累計報酬

三個交易日報酬是從三個交易日前的收盤開始：

```text
r3 = (close[T] / close[T-3] - 1) × 100
```

例如 7/22、7/23、7/24 三天的累計報酬，分母是 7/21 收盤。

### 7.3 開盤至收盤報酬

```text
intraday_return = (close[T] / open[T] - 1) × 100
```

### 7.4 成交量倍率

為避免「與前一日相比」和「與近期均量相比」混用，固定拆成兩個欄位：

```text
volume_ratio_1d =
  volume[T] / volume[T-1]

volume_ratio_5d =
  volume[T]
  / average(volume[T-5 ... T-1])
```

第 10 節方向分數只使用 `volume_ratio_1d`。`volume_ratio_5d` 只用於補充說明近期量能，不額外計分。

報告與程式不得再使用未標明期間的 `volume_ratio`。

### 7.5 均線乖離

```text
gap_smaN = (close[T] / SMA_N[T] - 1) × 100
```

### 7.6 大盤相對強弱

```text
relative_strength = stock_r1 - taiex_r1
```

### 7.7 真實波幅與 ATR14

```text
TR[T] = max(
  high[T] - low[T],
  abs(high[T] - close[T-1]),
  abs(low[T] - close[T-1])
)

ATR14 = 最近 14 個交易日 TR 的簡單平均
```

目前方法使用簡單平均，不使用 Wilder 平滑。

### 7.8 RSI14

```text
gain = 最近 14 個單日報酬中正值的總和 / 14
loss = 最近 14 個單日報酬中負值絕對值的總和 / 14
RS = gain / loss
RSI14 = 100 - 100 / (1 + RS)
```

目前方法使用單日百分比報酬的簡單平均，不使用 Wilder 平滑。若 `loss = 0`，RSI14 設為 100。

### 7.9 法人買賣超占量

法人與成交量都換算為「張」：

```text
institutional_net =
  foreign_net + investment_trust_net + dealer_net

institutional_ratio =
  institutional_net / volume[T] × 100
```

### 7.10 五日法人累計占量

```text
institutional_5d_ratio =
  sum(institutional_net[T-4 ... T])
  / sum(volume[T-4 ... T])
  × 100
```

### 7.11 主力買賣超占量

```text
main_net_ratio =
  broker_totals.net / volume[T] × 100
```

### 7.12 融資變動率

```text
margin_change_rate =
  (margin_balance[T] - margin_balance[T-1])
  / margin_balance[T-1]
  × 100
```

## 8. 固定思考與判斷順序

報告及程式都必須按照下列順序，禁止先看新聞再挑指標：

### 步驟 1：凍結預測時間

先寫入：

- `forecast_date`
- `base_trade_date`
- `information_cutoff`
- `methodology_version`

### 步驟 2：驗證資料

依第 6 節檢查日期、OHLC、來源與缺失資料。

### 步驟 3：計算價格與技術特徵

依第 7 節計算：

- `r1`
- `r3`
- `intraday_return`
- `volume_ratio_1d`
- `volume_ratio_5d`
- `gap_sma5`
- `gap_sma20`
- `gap_sma60`
- `ATR14`
- `RSI14`

### 步驟 4：計算相對大盤強弱

比較個股與加權指數同日報酬。

### 步驟 5：計算法人籌碼

依序看：

1. 當日法人買賣超占量。
2. 五日法人累計占量。
3. 外資與投信是否同方向。
4. 當日法人買盤是否比前一日加速或減速。

第 4 項只用於文字說明，不額外計分。

### 步驟 6：檢查融資

判斷股價方向與融資方向是否健康：

- 上漲、融資下降：偏健康。
- 上漲、融資大增：追價風險。
- 下跌、融資增加：籌碼風險最高。
- 下跌、融資下降：槓桿清洗。

### 步驟 7：檢查券商分點

依序看：

1. 當日主力買賣超占成交量。
2. 前三日主力方向是否一致。
3. 前一日主要買超分點是否在當日反轉賣超。

分點代表資金流，不代表單一投資人身分。

### 步驟 8：計算方向分數

只能使用第 10 節的固定分數。

### 步驟 9：計算過熱與波動風險

依第 11 節計算風險分數，必要時將方向降級。

### 步驟 10：執行歷史回測

只能依第 13 節固定規則表，從已存在的 `rule_id` 選擇回測群組。沒有適用規則時，設定：

```text
backtest_rule_id = null
backtest_status = unavailable
```

不得為單一股票臨時拼接條件，也不得測試多組條件後只公布結果最好的一組。

回測只能決定 `backtest_status` 與歷史情境描述，不得修改方向分數、方向標籤或第 14 節固定機率。

### 步驟 11：加入基本面背景

只讀取截止時間前已公開的公司公告或可靠新聞。

基本面不能直接覆蓋價格與籌碼方向。例如：

- 基本面很好、價格與籌碼轉弱：描述為「利多可能已反映」。
- 基本面普通、價格與籌碼轉強：描述為「資金面領先，但基本面尚未確認」。

### 步驟 12：加入海外市場

只有在 `information_cutoff` 已包含完整海外交易時段時才可使用。

### 步驟 13：產生區間與關鍵價位

先用 ATR 產生統計區間，再用近期高低點標記壓力與支撐。

### 步驟 14：輸出報告與檢核

報告必須列出：

- 已知事實。
- 推論。
- 缺失資料。
- 回測樣本數。
- 回測規則 ID、資料期間、有效訊號日期數與排除統計。
- 回測證據狀態。
- 可能推翻判斷的價位或事件。

## 9. 已知事實與推論必須分開

### 已知事實

可以直接驗證的數字，例如：

- 7/24 收盤 179 元。
- 外資買超 32,435 張。
- 加權指數下跌 2.67%。

### 推論

由規則推導的內容，例如：

- 大盤下跌時個股逆勢上漲，代表相對強度偏多。
- 下跌時融資增加，代表槓桿承接風險提高。

### 禁止寫法

- 「外資一定知道內幕。」
- 「主力明天必然拉抬。」
- 「此型態保證上漲。」
- 沒有樣本數卻宣稱精確勝率。

## 10. 方向分數

未取得對應日期資料時，該項為 0 分，不得用前一天代替。

### 10.1 價格與趨勢

| 條件 | 分數 |
|---|---:|
| `r1 ≥ 3%` | +1 |
| `r1 ≤ -3%` | -1 |
| `close > SMA20` | +1 |
| `close < SMA20` | -1 |
| `intraday_return ≥ 3%` | +1 |
| `intraday_return ≤ -3%` | -1 |
| 上漲且 `volume_ratio_1d ≥ 1.2` | +1 |
| 下跌且 `volume_ratio_1d ≥ 1.2` | -1 |
| `relative_strength ≥ 3` | +2 |
| `relative_strength ≤ -3` | -2 |
| `r3 ≥ 8%` | +1 |
| `r3 ≤ -8%` | -1 |

同一列互斥；不同列可累加。

### 10.2 法人

| 條件 | 分數 |
|---|---:|
| `institutional_ratio ≥ 10%` | +2 |
| `3% ≤ institutional_ratio < 10%` | +1 |
| `institutional_ratio ≤ -10%` | -2 |
| `-10% < institutional_ratio ≤ -3%` | -1 |
| `institutional_5d_ratio ≥ 5%` | +1 |
| `institutional_5d_ratio ≤ -5%` | -1 |
| 外資與投信當日同為正 | +1 |
| 外資與投信當日同為負 | -1 |

### 10.3 券商分點

| 條件 | 分數 |
|---|---:|
| `main_net_ratio ≥ 5%` | +2 |
| `2% ≤ main_net_ratio < 5%` | +1 |
| `main_net_ratio ≤ -5%` | -2 |
| `-5% < main_net_ratio ≤ -2%` | -1 |
| 主要分點由賣轉買的合計反轉量占當日成交量至少 5% | +1 |
| 主要分點由買轉賣的合計反轉量占當日成交量至少 5% | -1 |

主要分點只計算前一日買超或賣超前五名，反轉量定義為：

```text
當日淨買賣 - 前一日淨買賣
```

只加總方向相同的反轉，不互相抵銷後重複計分。

### 10.4 融資

| 股價與融資條件 | 分數 |
|---|---:|
| 上漲且 `margin_change_rate ≤ -1%` | +1 |
| 下跌且 `margin_change_rate ≤ -1%` | +1 |
| 上漲且 `margin_change_rate ≥ 1%` | -1 |
| 下跌且 `margin_change_rate ≥ 1%` | -2 |

### 10.5 原始方向標籤

| `direction_score` | `raw_direction_label` |
|---:|---|
| `≥ 5` | 偏多 |
| `2 ～ 4` | 中性偏多 |
| `-1 ～ 1` | 中性 |
| `-4 ～ -2` | 中性偏空 |
| `≤ -5` | 偏空 |

## 11. 過熱與波動風險

方向和風險是兩件事。強勢股可以同時「偏多」及「高風險」。

### 11.1 風險分數

| 條件 | 分數 |
|---|---:|
| `abs(r3) ≥ 15%` | +2 |
| `abs(gap_sma20) ≥ 15%` | +1 |
| `RSI14 ≥ 70` 或 `RSI14 ≤ 30` | +1 |
| 上漲但 `volume_ratio_1d < 1` | +1 |
| `ATR14 / close ≥ 4%` | +1 |
| 距最近明確壓力或支撐小於等於 `0.5 × ATR14` | +1 |

### 11.2 風險等級

| `risk_score` | 風險 |
|---:|---|
| 0 ～ 1 | 低 |
| 2 ～ 3 | 中 |
| ≥ 4 | 高 |

### 11.3 高風險降級

若 `risk_score ≥ 4`，最終方向向中性降一級：

```text
偏多 → 中性偏多
偏空 → 中性偏空
```

原始方向已是「中性偏多」、「中性」或「中性偏空」時不再降級，只附加「高風險」標籤。

這個規則用來避免在急漲末端給出「強烈追價」，或在急跌末端給出「強烈追空」。

## 12. 資料完整度與回測證據

### 12.1 權重

| 資料 | 權重 |
|---|---:|
| 個股價格與成交量 | 30 |
| 大盤指數 | 10 |
| 三大法人 | 25 |
| 融資融券 | 15 |
| 券商分點 | 20 |

```text
data_completeness = 已取得且日期正確的權重加總
```

### 12.2 完整度標籤

| 完整度 | 標籤 |
|---:|---|
| 90 ～ 100 | 高完整度 |
| 70 ～ 89 | 中完整度 |
| 50 ～ 69 | 中低完整度 |
| < 50 | 低完整度，不輸出方向機率 |

基本面與新聞不計入完整度。

資料完整度只表示核心輸入是否齊全，不等於預測命中率或回測勝率。報告不得把 `100%` 寫成「100% 預測信心」。

回測證據強度由第 13.10 節另外決定。報告必須分開顯示：

```text
資料完整度：100%（高完整度）
回測證據：exploratory / weak / supportive ...
```

不得將兩者合併成未定義的單一百分比。

## 13. 歷史回測規格

### 13.1 回測定位

回測回答的是「固定歷史條件出現後，下一交易日結果如何分布」，不是證明未來一定重演。

回測不得修改：

- `direction_score`
- `raw_direction_label`
- `final_direction_label`
- 第 14 節固定情境機率

回測只能影響：

- `backtest_status`
- 歷史類比說明
- 證據是否支持核心方向的文字

### 13.2 防止資料洩漏

- 樣本特徵只能使用樣本日收盤以前資料。
- 結果是下一個交易日收盤報酬。
- `signal_date < base_trade_date`。
- `next_trade_date <= base_trade_date`。
- 不得包含正在預測的結果或 `forecast_date` 資料。
- 只使用上市普通股。
- 排除缺價與公司行動無法還原的樣本。
- 暫時排除 `abs(next_return) > 15%` 的異常資料。

### 13.3 固定回測規則

回測規則使用與股票無關的固定 `rule_id`。不得以股票代號命名回測腳本或規則。

#### A. `bearish_breakdown_below_sma20_v1`

預期方向：`bearish`

```text
r1 ≤ -3%
close < SMA20
volume_ratio_1d ≥ 1.2
```

#### B. `momentum_cooling_above_sma20_v1`

預期方向：`bearish`

```text
r3 ≥ 15%
0% < r1 ≤ 5%
volume_ratio_1d < 1
gap_sma20 ≥ 10%
```

#### C. `momentum_cooling_with_institutional_buy_v1`

預期方向：`bullish`

符合 B，另外：

```text
institutional_ratio ≥ 20%
```

#### D. `bearish_candle_above_sma20_v1`

預期方向：`bearish`

```text
r1 ≤ -3%
intraday_return ≤ -3%
close > SMA20
```

1303 的既有報告是在本規則凍結前、且在預測交易日收盤後建立，因此只能標示為：

```text
prediction_mode = historical_cutoff_simulation
backtest_status 最佳不得高於 exploratory
```

自方法版本 `1.1.0` 起，未來案例可以依固定條件使用 D，不得再為個別股票增刪條件。

### 13.4 交易日連續性

先依市場交易日曆得到：

```text
previous_trade_date
signal_date
next_trade_date
```

三者必須是相鄰交易日。每筆樣本必須在精確日期取得該股票資料。

禁止使用：

```text
同一股票陣列中的上一筆或下一筆可用資料
```

因為資料缺漏時，這會把多日報酬誤當成單一下一交易日報酬。

任一精確日期缺少股票資料時，排除樣本並增加對應計數：

```text
missing_previous_date
missing_signal_date
missing_next_date
```

### 13.5 每日資料完整性

每個交易日計算：

```text
daily_coverage =
  當日有有效價格的普通股數
  / 股票母體普通股數
```

`daily_coverage < 90%` 時，該日標記為 `partial_market_file`。即使整日未直接排除，個股的前日、訊號日或結果日任一天缺資料，該樣本都必須排除。

### 13.6 公司行動與異常資料

每筆樣本同時檢查：

- `previous_trade_date`
- `signal_date`
- `next_trade_date`

若任一天發生除權、除息、減資、分割、合併或面額變更：

1. 優先使用 TWSE 官方參考價或官方漲跌百分比。
2. 無法可靠還原時排除。
3. 增加 `corporate_action` 排除計數。

每筆資料還必須符合：

```text
OHLC > 0
low ≤ open ≤ high
low ≤ close ≤ high
volume > 0
SMA20 是有限數值
abs(next_close_return) ≤ 15%
```

不符合時排除並記錄原因，不得靜默略過。

### 13.7 結果定義

隔日收盤報酬：

```text
next_close_return =
  (close[next_trade_date] / close[signal_date] - 1) × 100
```

只有 `next_close_return < 0` 才能稱為「隔日收盤下跌」。

若要使用「隔日下探」，必須另外計算：

```text
next_intraday_low_return =
  (low[next_trade_date] / close[signal_date] - 1) × 100
```

並在規則中明確定義下探門檻。不得只用隔日收盤報酬宣稱盤中下探。

### 13.8 回測輸出

至少輸出：

- `total_samples`
- `distinct_signal_dates`
- `history_sessions`
- `up_count`
- `down_count`
- `flat_count`
- `directional_hit_rate`
- `average_return`
- `median_return`
- `p10_return`
- `p90_return`
- `minimum_return`
- `maximum_return`
- `max_samples_per_date`
- `date_equal_weighted_directional_hit_rate`
- 依訊號日期群聚的方向命中率 95% 信賴區間
- 依訊號日期群聚的平均報酬 95% 信賴區間
- 每種排除原因與數量

`directional_hit_rate` 依規則的 `expected_direction` 決定：

```text
bearish：next_close_return < 0
bullish：next_close_return > 0
```

樣本明細至少包含：

```text
stock_code
previous_trade_date
signal_date
next_trade_date
close
sma20
規則使用的全部特徵
next_close_return
corporate_action_status
```

### 13.9 交易日群聚與信賴區間

同一交易日出現的多檔訊號高度相關，不得將所有股票樣本視為完全獨立。

主要統計可以維持逐股樣本加權，但不確定性必須以 `signal_date` 為群聚單位。

建議實作固定種子的交易日群聚 bootstrap：

```text
iterations = 10000
seed = SHA-256(
  methodology_version + ":" + rule_id + ":" + as_of_date
) 的前 32 位元
```

每次從唯一訊號日期中有放回抽樣，抽到某日即納入該日全部樣本。輸出第 2.5 與第 97.5 百分位作為 95% 信賴區間。

### 13.10 回測證據狀態

依序判斷：

| 狀態 | 固定條件 |
|---|---|
| `unavailable` | 沒有適用固定規則或無法執行 |
| `insufficient` | `total_samples < 20` 或 `distinct_signal_dates < 10` |
| `exploratory` | `history_sessions < 250`、`total_samples < 100` 或 `distinct_signal_dates < 30` |
| `supportive` | 方向命中率群聚 95% 區間未跨過 50%，平均報酬群聚 95% 區間未跨過 0%，且兩者都支持預期方向 |
| `conflicting` | 上述兩個信賴區間都未跨過中性基準，但方向與規則預期相反 |
| `weak` | 資料量達標，但不符合 `supportive` 或 `conflicting` |

判斷採第一個符合的狀態；`exploratory` 不得因表面樣本數很多而升級。

### 13.11 最低揭露要求

報告至少揭露：

- 規則 ID 與完整條件。
- 預期方向。
- 輸入與樣本日期範圍。
- 股票母體模式與存活者偏差警告。
- 有效樣本數與唯一訊號日期數。
- 所有排除統計。
- 樣本加權結果。
- 交易日等權結果。
- 群聚信賴區間。
- `backtest_status`。

不得只顯示一個勝率或平均報酬。

### 13.12 可重現輸出

回測輸出至少保存：

```text
schema_version
methodology_version
rule_id
expected_direction
as_of_date
outcome_definition
source_date_range
signal_date_range
universe_mode
survivorship_bias_warning
script_git_commit
input_files_sha256
exclusions
statistics
samples
```

可重現性聲明固定為：

> 在相同程式 commit、相同方法版本及相同輸入檔案雜湊下，除執行時間欄位外，樣本與統計輸出必須一致。

為使主要 JSON 可以逐位元比較，`generated_at` 建議放在獨立 run manifest。若保留在同一檔案，驗證時必須明確排除該欄位。

不得宣稱「每次執行產出完全相同檔案」，除非動態時間欄位也已固定。

## 14. 情境機率

情境機率是風險配置，不是精確命中率。固定使用下表，不得由模型自行編造。

第 13 節回測結果不改變本節機率。若 `backtest_status` 為 `weak`、`exploratory`、`insufficient` 或 `conflicting`，只能在文字中揭露證據有限或相反，不得擅自重新分配百分比。

| 最終方向 | 基準整理 | 多方情境 | 空方情境 |
|---|---:|---:|---:|
| 偏多 | 40% | 45% | 15% |
| 中性偏多、風險低或中 | 50% | 35% | 15% |
| 中性偏多、風險高 | 50% | 30% | 20% |
| 中性 | 55% | 22.5% | 22.5% |
| 中性偏空、風險低或中 | 50% | 15% | 35% |
| 中性偏空、風險高 | 50% | 20% | 30% |
| 偏空 | 40% | 10% | 50% |

若資料完整度低於 50，不顯示機率。

## 15. 價格區間

### 15.1 中心估計

依最終方向設定 ATR 位移：

| 最終方向 | 位移 |
|---|---:|
| 偏多 | `+0.35 × ATR14` |
| 中性偏多 | `+0.20 × ATR14` |
| 中性 | `0` |
| 中性偏空 | `-0.20 × ATR14` |
| 偏空 | `-0.35 × ATR14` |

```text
center = close[T] + 方向位移
```

中心估計顯示成最接近中心的兩個合法跳動單位，不得顯示超過小數價格級距的精度。

### 15.2 可能收盤區間

```text
close_range =
  center ± 0.5 × ATR14
```

### 15.3 可能盤中區間

```text
intraday_range =
  center ± 1.0 × ATR14
```

所有價格依 TWSE 股票升降單位取整。

### 15.4 支撐與壓力

依序標記：

1. 當日高點為第一壓力。
2. 當日低點至開盤價為第一支撐區。
3. 向前 60 個交易日尋找距離最近、收盤高於第一壓力的交易日，其低點至收盤為第二壓力候選區。
4. 最近一次放量突破 K 棒的收盤與隔日低點為第二支撐候選區。
5. SMA5 與急漲或急跌起點作為轉弱或轉強確認。

若無法依上述規則找到價位，不得由模型自行畫線。

## 16. 海外市場覆蓋規則

海外資料只有在截止時間已涵蓋完整交易時段時才計分：

| 條件 | 分數 |
|---|---:|
| Nasdaq 日報酬 ≥ 1.5% | +1 |
| Nasdaq 日報酬 ≤ -1.5% | -1 |
| 費城半導體指數日報酬 ≥ 2% | +1 |
| 費城半導體指數日報酬 ≤ -2% | -1 |

海外分數加在方向分數最後，但總調整最多 `±2`。

個別美股新聞不計分，只作背景說明。

## 17. 基本面與新聞規則

### 17.1 允許使用

- 公司官網公告。
- 公開資訊觀測站重大訊息。
- TWSE 公告。
- 截止時間前發布且有明確日期的可靠新聞。

### 17.2 使用方式

基本面只回答：

1. 價格與籌碼方向是否有基本面支持。
2. 市場是否可能已提前反映利多或利空。
3. 是否存在下一交易日前的已知事件。

基本面不加入方向分數，避免不同模型對文字產生不同權重。

## 18. 兩個既有案例

### 18.1 南亞科（2408），預測 2026-07-24

核心已知事實：

- 7/22 收盤 445.5 元。
- 7/23 收盤 426 元。
- `r1 = -4.38%`。
- 7/23 開盤 452、最高 452、最低 415、收盤 426。
- `intraday_return = -5.75%`。
- 成交量由 63,907 增至 89,387 張，`volume_ratio_1d ≈ 1.40`。
- 收盤低於 SMA20 428.4 元。
- 主力淨賣 8,493 張，約占成交量 `-9.5%`。
- 融資由 87,812 增至 90,111 張，增加約 `2.62%`。
- 主要分點由買轉賣。

依第 10 節：

- 單日跌幅：-1。
- 收盤低於 SMA20：-1。
- 開盤至收盤跌幅：-1。
- 下跌放量：-1。
- 主力占量小於 -5%：-2。
- 主要分點負向反轉：-1。
- 下跌且融資增加至少 1%：-2。

即使其他缺失或中性項目計零，方向分數已不高於 `-9`，原始方向為「偏空」。

這可重現報告中的核心結論：

```text
隔日下跌風險顯著升高
```

### 18.2 緯創（3231），預測 2026-07-27

核心已知事實：

- 7/24 收盤 179 元，`r1 = +3.17%`。
- 7/21 收盤 149.5 元，`r3 = +19.73%`。
- SMA20 153.7 元，`gap_sma20 ≈ +16.5%`。
- 7/24 `volume_ratio_1d ≈ 0.825`，上漲量縮。
- 加權指數下跌 2.67%，相對強弱約 `+5.84`。
- 三大法人合計買超 44,453 張，占成交量約 `24.7%`。
- 外資與投信同為買超。
- 五日法人累計占量高於 5%。
- ATR14 約 7.6 元，`ATR14 / close ≈ 4.25%`。

方向分數至少包含：

- 單日上漲至少 3%：+1。
- 收盤高於 SMA20：+1。
- 相對強弱至少 3：+2。
- 三日累計上漲至少 8%：+1。
- 法人占量至少 10%：+2。
- 五日法人占量至少 5%：+1。
- 外資與投信同買：+1。

方向分數至少為 `+9`，原始方向為「偏多」。

風險分數：

- 三日漲幅至少 15%：+2。
- SMA20 乖離至少 15%：+1。
- 上漲量縮：+1。
- ATR14 占收盤至少 4%：+1。

風險分數至少為 `5`，屬高風險，方向降一級：

```text
偏多 → 中性偏多
```

這可重現報告結論：

```text
中性偏多，但高檔震盪風險高
```

情境機率依第 14 節固定為：

- 基準整理：50%。
- 多方情境：30%。
- 空方情境：20%。

## 19. 報告輸出順序

HTML 報告固定使用以下順序：

1. 股票、預測日期與資訊截止時間。
2. 最終方向與風險等級。
3. 中心估計、收盤區間及盤中區間。
4. 主要多空訊號。
5. 法人、融資及分點資料。
6. 三種情境與固定機率。
7. 支撐、壓力與判斷失效條件。
8. 回測規則 ID、資料期間、排除統計、樣本與訊號日期數、群聚信賴區間及證據狀態。
9. 資訊邊界與缺失資料。
10. 資料來源。
11. 非投資建議聲明。

## 20. 最終檢核表

輸出前逐項回答：

- [ ] `forecast_date` 是否真的是下一交易日？
- [ ] 是否記錄 `information_cutoff`？
- [ ] 是否區分 `prospective` 與 `historical_cutoff_simulation`？
- [ ] 是否保存各來源交易日、可用時的抓取時間與輸入雜湊？
- [ ] 是否使用正確日期的價格、法人、融資與分點？
- [ ] 是否列出缺失資料？
- [ ] 是否處理除權息或減資？
- [ ] `r1`、`r3`、`volume_ratio_1d`、`volume_ratio_5d`、均線乖離、RSI、ATR 是否依固定公式？
- [ ] 方向分數是否能逐項重算？
- [ ] 高風險時是否依規則降級？
- [ ] 情境機率是否直接使用固定表？
- [ ] 回測是否排除預測日與未來資料？
- [ ] 回測的前日、訊號日與結果日是否為相鄰交易日？
- [ ] 回測是否排除或調整公司行動、缺價與異常報酬？
- [ ] 是否揭露回測規則 ID、期間、樣本數、唯一訊號日期數與排除統計？
- [ ] 是否輸出中位數、P10、P90、交易日等權結果與群聚信賴區間？
- [ ] 是否分開顯示資料完整度與 `backtest_status`？
- [ ] 新聞是否只作背景，沒有任意改變分數？
- [ ] 已知事實、推論與驗證結果是否分開？
- [ ] 是否寫出推翻判斷的價位或條件？
- [ ] HTML 檔名是否使用預測日期與股票代號？

只要任一核心項目無法回答，報告就必須標記為 `provisional`，不得呈現為完整預測。

## 21. 版本紀錄

### 1.1.0

- 將沒有事前時間戳的報告明確標為 `historical_cutoff_simulation`。
- 將成交量倍率拆成 `volume_ratio_1d` 與 `volume_ratio_5d`。
- 將資料完整度與回測證據狀態分開。
- 將案例導向回測群組改為固定 `rule_id`。
- 新增 `bearish_candle_above_sma20_v1`。
- 規定回測日期必須依市場交易日曆精確相鄰。
- 新增每日覆蓋率、公司行動、異常值與排除統計要求。
- 新增交易日群聚信賴區間與固定證據狀態。
- 新增輸入雜湊、程式 commit 與可重現輸出契約。

既有報告與回測輸出在依本版本重新執行以前，保留原本的方法版本，不得只修改版本字串就宣稱符合 `1.1.0`。
