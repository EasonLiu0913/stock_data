# MVP10-A — BFI82U 2026-10-13 early full-precision secondary transcript

Project: `daily-gainers-market-opening-end-to-end`, `goal-v3/MVP-10DAY-v1`, phase `MVP10-A INCOMPLETE`; `MVP10-B NOT_ELIGIBLE`. Research-only, no official-original certification or release permissions.

## Independent dated secondary trace
- **Source:** E.SUN Securities, https://m.esunsec.com.tw/news/instant-detail.aspx?id=%7B2F5D8A40-169E-4C3D-8A24-348E896E2384%7D
- **Published:** 2026-10-13 15:06:19 (per source). Its article reproduces same-day BFI82U labeled amounts in **integer TWD**, not merely rounded hundred-millions.
- All recorded category triples are exactly `buy_twd / sell_twd / net_twd`:
  - 自營商(自行買賣): `10923022534 / 20170053714 / -9247031180`
  - 自營商(避險): `44729854709 / 92459075853 / -47729221144`
  - 投信: `46936948720 / 23064907906 / +23872040814`
  - 外資及陸資(不含外資自營商): `339066597359 / 504408674294 / -165342076935`
  - 外資自營商: `0 / 0 / 0`
  - 合計: `441656423322 / 640102711767 / -198446288445`
- The rows independently reconcile arithmetically (buy - sell = net; first four category buy/sell/net sum to the displayed total; foreign dealer is excluded to prevent double counting). **This is a SECONDARY republication, not the original TWSE raw BFI82U JSON, original HTTP receipt, or evidence of final table revision.**
- A separate same-day PTT transcript (posted 2026-10-13 15:39) agrees at two-decimal 億 rounding: https://disp.cc/b/Stock/ihxl . These sources add temporal corroboration of early values, not original-data certification.
- Repo market-chart saved foreign net `-165290508085 TWD` differs from the early transcript by `+51568850 TWD` (less negative). It rounds to -1652.91 億 vs early -1653.42 億. Secondary later report: https://sixdusts.com/newsroom_daily_20261019.html lists -1652.91 億. Hypothesis: reporting batch/version/scope differences; **actual reason and official final-version row lineage not established**.
- TWSE officially states 14:50 and 19:40 BFI82U production batches, with differences in institutional comprehensive accounts and block trades, https://eshop.twse.com.tw/zh/product/detail/d31c1b9570ae47058ec83a0bb1ffa419 . These timing facts do not prove which of the two 20261013 numerical versions came from a given batch.
- The presently accessible generic TWSE report https://www.twse.com.tw/fund/BFI82U?response=html&type=day confirms six categories / four monetary fields and foreign-dealer double-count exclusion, **but is NOT a snapshot of 20261013**.
- Search/public-page read could not independently retrieve the specific date's original raw TWSE BFI82U response, and the available GitHub Actions connector does not list push workflow runs via its commit-run action. Thus no justified new Run ID, source-original SHA, or CI PASS.

## Operational boundary / next step
- Do not transfer early third-party monetary data into `market-opening-source-audit.json` official-certified trust/dealer fields. Keep `institutional_BFI82U_amounts_verified=false` until independently fetched, date-checked original BFI82U JSON + HTTP status/headers/URL/raw SHA and validated original numbers are available.
- Continue existing isolated `scripts/research_mvp10_fetch_bfi82u_20261013.py` and `.github/workflows/research-mvp10-bfi82u-original-evidence.yml` unchanged absent an independently diagnosed error. Avoid repetitive harmless CI patches.
- Reuse only owner-approved dashboard `TAIWAN_STOCK_TABLE_LIST_20261102_V1` and existing full research preview CI `41463609661`; preserve main, production/YouTube/release locks and original immutable A/B gates.

research_progress_status: PROGRESS (new dated exact secondary benchmark and reconciliation source)
phase_status: MVP10-A INCOMPLETE
next_action: promptA (locate independently verifiable push CI / original TWSE 20261013 BFI82U response)
plan_changed: NO
publication_authorized: false
youtube_upload_authorized: false
