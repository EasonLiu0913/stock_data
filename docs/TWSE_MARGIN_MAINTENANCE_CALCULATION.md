# 上市大盤融資維持率自算方式

## 目的

`public/twse-margin-balance.html` 不再依賴 MacroMicro 的瀏覽器擷取資料，而是使用證交所公開資料固定產生上市大盤融資維持率。

目前採用的是跨日期試算後最穩定的實證公式，不是證交所公布的正式指標公式。若未來取得更完整的官方定義，應提高 `formulaVersion` 並保留舊資料，避免歷史數值在沒有紀錄的情況下被改寫。

## 固定公式

```text
大盤融資維持率
=（非 ETF 融資股票市值
  − 當日處置股融資股票市值
  − 當日注意交易第十一款股票融資股票市值）
  ÷ 證交所融資金額今日餘額
  × 100%
```

逐檔市值：

```text
融資股票市值 = 融資今日餘額（張）× 1,000 × 當日收盤價
```

分母使用證交所「信用交易統計」中的 `融資金額(仟元)／今日餘額 × 1,000`，不因 ETF、處置股或注意股而扣減。

公式版本：`exclude-etf-punish-notice-clause-11-v1`

## 排除條件

### ETF

ETF 代號以 `data_twse/twse_industry_ETF.csv` 為準，不以股票代號是否為 `00` 開頭判斷。ETN、TDR、創新板及其他非 ETF 證券不會只因代號或名稱而被排除。

### 處置股

使用證交所當日處置股查詢：

```text
https://www.twse.com.tw/rwd/zh/announcement/punish
```

查詢參數使用相同的 `startDate`、`endDate`，並設定 `querytype=3`。

### 注意交易第十一款

使用證交所當日公布注意股查詢：

```text
https://www.twse.com.tw/rwd/zh/announcement/notice
```

只排除「注意交易資訊」文字包含 `第十一款` 的證券，不排除整份注意股清單。

## 交叉試算結果

以所有非 ETF 證券為基礎，再排除處置股及注意交易第十一款：

| 日期 | 自算結果 | 比對值 | 差距 |
| --- | ---: | ---: | ---: |
| 2026/02/06 | 160.8877% | 約 161.2% | -0.3123 個百分點 |
| 2026/07/20 | 143.1670% | 143.4932% | -0.3262 個百分點 |

兩個日期的誤差方向及幅度接近，因此目前選用此公式。這項吻合仍屬實證結果；「注意交易第十一款」本身不代表證交所正式規定必須從融資擔保品市值排除。

## 已測試但未採用的算法

| 算法 | 2026/07/20 結果或影響 | 判斷 |
| --- | ---: | --- |
| 非 ETF，不做其他排除 | 159.0092% | 過高 |
| 再排除處置股 | 157.5909% | 仍過高 |
| 排除全部注意股 | 140.6960% | 扣除過多 |
| 排除停止融資 `O` | 158.8947% | 影響太小 |
| 排除停止融券 `X` | 154.2895% | 與分子定義無直接關係，且仍不吻合 |
| 排除融資分配 `@` | 158.2245% | 仍過高 |
| 排除全部調整成數股票 | 157.5797% | 仍過高 |
| 依降低融資比率比例折算 | 158.0804% | 無法通過 2026/02/06 驗證 |
| 排除 2026/07/20 當日除息股 | 降低約 0.1042 個百分點 | 影響太小；除息日收盤價亦已反映除息 |
| 排除全部 `-KY` | 153.1545%（2026/02/06） | 扣除過多 |
| 開盤價、最高價、最低價、VWAP | 均無法穩定吻合 | 不採用 |
| 固定除以 1.10 | 只在少數日期接近 | 無法跨日期成立 |

## 產生方式

執行：

```bash
node scripts/calculate_twse_margin_maintenance.js --date YYYYMMDD
```

必要的本機資料：

- `data_twse_margin_balance/YYYYMMDD_twse_margin_balance.csv`
- `data_twse_mi_index/YYYYMMDD_twse_mi_index.json`
- `data_twse/twse_industry_ETF.csv`

腳本另外即時取得證交所的融資金額統計、處置股及注意股資料，並輸出：

```text
data_twse_margin_maintenance/YYYYMMDD_twse_margin_maintenance.json
```

輸出會保存分子、分母、公式版本、排除股票及各股票的融資張數、收盤價和市值，方便日後稽核。

## GitHub Actions

`.github/workflows/calculate-twse-margin-maintenance.yml` 會在台北時間平日 21:05、22:05、23:05 執行，也可以從 GitHub Actions 手動指定日期。workflow 會先確認：

- 同日融資餘額 CSV 已存在
- 同日 MI_INDEX 收盤價 JSON 已存在
- 上市 ETF 清單已存在
- 同日融資維持率 JSON 尚未產生

全部條件成立時才執行：

```bash
node scripts/calculate_twse_margin_maintenance.js --date YYYYMMDD
```

缺少必要檔案或同日結果已存在時會正常略過，讓下一次排程再次檢查。新結果會提交至 `data_twse_margin_maintenance/`。

## 頁面顯示

`public/twse-margin-balance.html` 依日期選單載入同日的自算 JSON，顯示：

- 自算融資維持率日期
- 大盤融資維持率
- 前次已有計算資料的交易日維持率
- 較前次增減百分比

若所選日期沒有自算 JSON，頁面只顯示「尚未產生自算融資維持率」，不會退回使用 MacroMicro 數字。

## 已知限制

- ETF 清單是專案內保存的清單；回算很早的歷史日期時，必須確認清單涵蓋當時存在但後來下市的 ETF。
- 無收盤價但仍有融資餘額的股票，其市值目前按 0 計算，並列在輸出 JSON 的 `dataQuality.missingPrices`。
- 處置及注意資料若證交所端點暫時失敗，腳本會停止且不輸出結果，避免把缺少排除名單的數字當成正式值。
