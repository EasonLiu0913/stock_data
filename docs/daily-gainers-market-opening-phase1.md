# TAIWAN STOCK｜每日 5% 影片市場開場 Phase 1：上市市場資料契約

狀態：Phase 1 research / contract draft。僅資料研究，不啟動影片生成或 YouTube 上傳。實際歷史交易日資料及端到端驗收尚未通過。

## 固定不變的影片條件
- 開場品牌三句由 `scripts/daily_gainers_brand_opening.js` 控制，不可改寫：「大家好，歡迎來到 TAIWAN STOCK！」「追蹤資金，解讀行情。」「錢在哪，我們就在哪！」
- 市場開場共 60–90 秒，包含上述品牌三句。語氣：專業主播 70%＋犀利分析師 30%。
- 講稿是唯一語意來源；speech、captions、display 必須由同一組語意 cue 產生，不可單獨摘要字幕。實際時長待 TTS 驗證。

## 市場範圍（不可妥協）
- `market = TWSE`：僅台灣證券交易所上市，不使用 TPEx（上櫃）行情、成交或法人數據。不得混入上櫃個股。
- 大盤指數：TAIEX（加權股價指數）。
- 官方「上市市場成交金額」依來源資料既有官方統計口徑標示；**不可宣稱與普通股成交金額完全相同**。
- 計算上漲家數、下跌家數、5% 強勢股數時，限定「上市普通股」。ETF、ETN、權證、存託憑證、特別股等均須有正式證券主檔分類證據才能納入或排除，不以股票代碼長度單獨判斷。
- 同一筆輸出須保留 `market_scope`、`instrument_scope` 和 `source_scope`，並驗證不含 TPEx。

## 已確認現有程式與來源（main 2026-10-09）
| 用途 | 來源／路徑 | 單位與注意 |
|---|---|---|
| TAIEX OHLC | `scripts/build_twse_market_chart.js` -> TWSE `MI_5MINS_HIST` | 指數點 |
| 上市成交股數、成交金額、筆數 | 同上 -> TWSE `FMTQIK` | 股、TWD、筆 |
| 外資整體買進／賣出／淨額 | 同上 -> TWSE `BFI82U`（外資及陸資，不含外資自營商） | TWD |
| 外資個股資料 | `scripts/crawl_twse_foreign_investors.js` -> `TWT38U` | 股數，不可直接當作金額 |
| 投信個股資料 | `scripts/crawl_twse_investment_trust.js` -> `TWT44U` | 股數，不可直接當作金額 |
| 自營商個股資料 | `scripts/crawl_twse_dealers.js` -> `TWT43U` | 股數、含自行買賣／避險分組 |
| 強勢股主資料 | `data_daily_gain_over_5/YYYYMMDD.json` | 需要核對個股 TWSE 普通股身分 |
| 非交易日判定 | `scripts/lib/twse_fund_crawler.js` / `data_history_sma/non_trading_days.json` | 不得取舊交易日冒充當日 |

以上為「程式已存在」，**不代表指定日期資料已確認完整**。現有市場圖表已驗證 OHLC 收盤與 FMTQIK 官方指數一致性。

## 待研究的資料缺口
1. TWSE 上市普通股的權威證券主檔和當日上市有效性：不能僅以 4 碼代碼推斷。
2. TWSE 上漲、下跌、平盤家數與當日交易普通股母體；明確處理停牌／無成交。
3. 投信／自營商整體買賣**金額**：優先查同日 BFI82U 正式分組，不能將 TWT44U/TWT43U 的股數加總冒充金額。
4. 上市普通股的產業別與成交金額，才能做資金流向；法人個股股數淨額不等於資金流入額。
5. 檢查每日 5% 原始名單是否混入上櫃，影片市場開場必須獨立 TWSE-only 過濾與完整性驗證。
6. 判讀市場熱度的歷史 5/20 日基準值是否可取得，及歷史行情修正時的版本規則。

## 建議輸出契約（尚未建立）
建議路徑：`data_daily_gain_over_5/market-opening/YYYYMMDD.json`。與既有 `market-summary/` 分開，避免混用強勢股新聞摘要及大盤行情。

必備欄位：
- `schema_version`, `target_date` (YYYYMMDD), `market` (=TWSE), `status` (`complete|partial|blocked`), `generated_at`
- `taiex`: `open, high, low, close, previous_close, change_points, change_pct`
- `market_trading`: `turnover_twd, shares, transactions, turnover_ma5_twd, turnover_ratio_ma5`, 及官方來源口徑
- `breadth`: `scope=TWSE_COMMON_STOCK, advancers, decliners, unchanged, eligible_count, suspended_count, gainers_5pct_count`
- `institutional`: `foreign, investment_trust, dealers`。各自 `buy_twd, sell_twd, net_twd, consecutive_net_days`，來源須與當日同口徑。
- `sector_flows`: 至少包含 `sector, turnover_twd, return_pct`；其他衍生欄位另註定義，避免將 turnover 誤稱「淨流入」。
- `source_manifest`: 每項 `source_name, source_path_or_endpoint, source_date, unit, market_scope, verified`。
- `quality`: `missing_fields, warnings, blocking_reasons`。
- `market_regime`: `label, evidence, confidence, methodology_version`，先保留欄位，分類門檻待 Phase 2 研究校準。

## 強制資料驗證規則
1. 所有必備數據對齊同一 `target_date`；不可用前一日實績補今日缺口。
2. 所有數值單位明確。金額一律內部用 TWD，輸出講稿時才換算「億元」；指數用點、成交股數用股。
3. 指數漲跌百分比 = (今日收盤 / 前一交易日收盤 - 1) × 100，前收需來自實際交易日，不以日曆昨天代替。
4. 股票／產業統計必須以 TWSE 上市普通股證券主檔過濾；混入 TPEx 即 `blocked`。
5. 法人來源、分組、金額/股數必須一致，買 - 賣 = 淨額；自營商注意避險與自行買賣是否重複計算。
6. 缺少大盤指數、官方成交金額、交易日校驗或市場範圍證據：`blocked`；其他非必要欄位缺少可 `partial`，但講稿不得提及其結論。
7. 法人淨賣不等於「倒貨給散戶」；此類行為推論須有額外 TDCC、價格、成交量、連續交易日等資料，並以假說而非事實呈現。
8. 無資料時不得輸出虛構數字；保留警示與 provenance。非交易日不得回退舊日期做新影片。

## 下一關／驗收
- 確認 TWSE 普通股證券主檔與漲跌家數來源。
- 解析一個實際交易日各原始資料的日期、欄位、單位和證券市場範圍，製作真實 sample JSON。
- 針對同日性、資料缺口、金額股數混用、上櫃混入、重複法人分組建立自動測試。
- Phase 1 PASS 後才進行 60–90 秒市場開場與語音／字幕同步驗收。

## 2026-10-10 Owner-approved M1 scope amendment — official market breadth (goal-v2)

**Acceptance change owner-approved**: daily opening market breadth uses the date-matched official TWSE MI_INDEX `漲跌證券數合計` **股票** column (not `整體市場`) with all five separate buckets `上漲 / 下跌 / 持平 / 未成交 / 無比價`. These figures are narrated as **「證交所官方股票欄位統計」**, not as independently audited `TWSE_COMMON_STOCK` or a computed 1,085-member securities master. Preserve exact date, official field/scope, raw archive digest, units, and source manifest. Keep `無比價` distinct from `未成交`, no reclassification or invented per-stock breakdown. When source unavailable or date/scope verification fails, omit the assertion or mark the segment partial; do not fabricate.

For the Oct08 verified archived MI_INDEX `tables[7]` official stock column, counts are up 425, down 540, unchanged 109, no trade 3, no comparison 5 (**1,082** aggregate stock rows under the exchange's published grouping). This aggregate **must not** be equated to 1,085 identity items. Source historical identity completeness work remains retained under a **non-blocking research backlog**; its 2026-10-08 legal/board/CFI roster is not certified.

**Separation of guarantees:** `scripts/verify_daily_gainers_official_market_breadth.js` is a *narrow*, research-only official-aggregate validator; it never certifies individual securities nor publication of a full market-opening snapshot. The strict `scripts/validate_daily_gainers_market_opening.js`, `scripts/build_twse_common_stock_breadth.js`, `scripts/reconcile_twse_stock_breadth.js` remain unchanged as guards for security-by-security evidence. The daily >=5% stock list MUST use actual same-day TWSE common stock classification, individual moves, exclusions, and required data-quality gates, without resort to code length, aggregate shortcuts or post-dated evidence. Retain factual financial analysis, brand lines, spoken/caption/SRT parity, and no prior-day fallback. Never treat aggregate breadth verification as 5%-gainers or end-to-end video PASS.

**Phased transition:** Original M1 goal-v1 Prompt A/B are historical contracts preserved, but **owner-superseded for market breadth only**; new M1-v2 requires the separate official five-bucket validation on archived authentic MI_INDEX and independent test/review before declaring M1 PASS. M2 can be preregistered and scheduled only after its own Prompt B eligibility and independent closeout. No production/caption/video/YouTube/deployment/cron changes are approved here.
