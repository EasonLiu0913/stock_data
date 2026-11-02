# MVP10-A — 20261013 BFI82U revision/version reconciliation (research only)

Canonical project: `daily-gainers-market-opening-end-to-end`; goal `goal-v3/MVP-10DAY-v1`, active phase `MVP10-A` (INCOMPLETE); paired `MVP10-B` FROZEN/NOT ELIGIBLE.
Date of this bounded audit: 2026-11-02. Scope: source/version conflict only, **not publication-quality BFI82U certification**.

## Durable repository observation (verified)
- Research-branch source: `data_research/m5/mvp10-20261013-research/market-opening-source-audit.json`, status `MI_INDEX_STOCK_BREADTH_RECONCILED_INSTITUTIONS_PARTIAL`, with `publication_authorized: false`.
- The market-chart snapshot `data_twse_market_chart/market_chart.json` identifies its foreign series as `TWSE BFI82U 外資及陸資(不含外資自營商)` and contains the 20261013 net amount **-165,290,508,085 TWD**.
- Conversion (integer TWD / 100,000,000): **-1,652.90508085 億元**, displayed to two decimals **-1,652.91 億元**.
- This exact rounding matches a **later secondary report**, while a same-day historical repost uses **-1,653.42 億元**. Difference of rounded observations **0.51 億元** (approx. TWD 51 million). This is **not by itself evidence of when or why TWSE changed its table**.

## External dated evidence, separately graded
1. Same-day 2026-10-13 forum repost citing TWSE BFI82U, **secondary transcription, not TWSE bytes**: https://disp.cc/b/Stock/ihxl — foreign -1653.42 億, trust +238.72 億, dealer own -92.47 億, dealer hedge -477.29 億, dealer total about -569.76 億, grand total -1984.46 億. Rounded to 0.01 億; do **not** treat as original unrounded BFI82U.
2. Revised report dated 2026-10-18: https://baomazai.com/market/2026/10/14/market01/ — records 20261013 revised foreign -1652.91 億, trust +246.25 億, grand total -1976.41 億 (previously -1653.42 / +238.72 / -1984.46); it attributes a possible after-the-fact correction but original TWSE publication revision log has **not** been verified.
3. Later 2026-10-16 market analysis https://sixdusts.com/newsroom_daily_20261016.html uses foreign -1652.91 億. This is corroborating secondary evidence, not an official receipt.
4. TWSE BFI82U official endpoint format: https://www.twse.com.tw/rwd/zh/fund/BFI82U?type=day&dayDate=20261013&response=json (GET target only; **this audit did not receive or hash its actual 20261013 response**). TWSE report scope explanatory page: https://www.twse.com.tw/fund/BFI82U?response=html&type=day — definition of own/dealer hedge, trust, foreign, total, intraday classifications; the nondated page must **not** be used as if it were the 20261013 table.

## Reconciliation and hard gates
- Proven from saved numeric snapshot: foreign **-1652.90508085 億** (= -165290508085 TWD), **NOT** a wholly authenticated BFI82U source receipt.
- Plausible revised foreign -1652.91 億 is consistent with the snapshot. Revised trust +246.25 億, dealers -569.76 億 and grand total -1976.41 億 are **SECONDARY ONLY**; rounding the three groups gives -1976.42 億, so do not treat 0.01 億 difference as exact arithmetic conflict absent original unrounded rows.
- The independently verified 20261013 `MI_INDEX` stock-column breadth and 1080p table-led Dashboard media are **unchanged** (successful research Runs 41468872124 and 41463609661); their success does **not** certify institutional totals.
- There is **NO** original 20261013 BFI82U HTTP status, headers, URL/time, response-body SHA-256, individual buy/sell amounts or verified postrevision history. Do not fill official numerical fields from secondary reporting, overwrite original media, claim market opening complete, or soften the frozen paired Prompt B.
- Official `T86`/per-security net SHARES must never be mistaken for market-wide `BFI82U` net TWD amounts.

## Shortest next technical action
Fetch original dated `BFI82U` JSON over an independently reachable research-only runner, preserve HTTP metadata and original raw bytes/SHA-256, verify `date=20261013`, each original buy/sell/net monetary row, own/hedge/foreign-dealer classification and recomputed total. Compare original present-day response with same-day historical transcript and exact saved foreign -165290508085 TWD. If official bytes inaccessible or inconsistent, preserve all monetary fields `NOT_CERTIFIED` and avoid narrative release. Do not spend another round rechecking already-PASS MI_INDEX or visual layout.

research_progress_status: PROGRESS (new explicit secondary source revision/version distinction and exact foreign conversion)
phase_status: MVP10-A INCOMPLETE
b_status: NOT_ELIGIBLE
blocker: independently retrieved original dated BFI82U response + source history and authoritative trust/dealer rows
next_action: promptA (bounded source acquisition or evidence-first reconciliation)
plan_changed: NO
publication_authorized: false
upload_authorized: false
main_modified: false
