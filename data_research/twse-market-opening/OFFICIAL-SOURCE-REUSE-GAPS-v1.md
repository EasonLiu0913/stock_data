# Official source reuse and missing contracts (Prompt A, research only)

Date: 2026-10-19. Scope: existing isolated branch. This is a source inventory, **not** approval to fetch, render or publish. No changes to production collectors.

| Dataset | Existing reusable component | Actual currently checked evidence | Unresolved before automated recovery / certified Master |
| --- | --- | --- | --- |
| BFI82U | `research_date_to_video_bfi82u_archive.js`, `research_date_to_video_bfi82u_v1.js`, `research_official_data_recovery_v1.js` | Date-specific immutable six-row raw response and SHA-256 manifest; bounded retrieval approved in research Registry | Do not extrapolate market-wide totals to ordinary-share-only scope |
| FMTQIK | `research_official_fmtqik_provenance_v1.js`, `research_date_to_video_market_base.js` | `data_twse_market_chart/market_chart.json` date row, chart source label, units and chart SHA-256 | Original date-specific HTTP response, endpoint/date contract, raw units/schema, immutable archive and independent validator; derived chart is not raw proof |
| MI_INDEX | `research_official_mi_index_provenance_v1.js`, `research_market_opening_mi_index_breadth.js`, `parse_twse_official_stock_aggregate.js` | `data_twse_mi_index/{YYYYMMDD}_twse_mi_index.json` dated repository payload, actual `漲跌證券數合計` / `股票` schema and payload SHA-256 | Original dated HTTP response provenance, approved endpoint, immutable archive, independent validator; do not claim ordinary-share universe certification |
| BFIAMU | Registry candidate only | No approved dated validator/archiver in Registry | Confirm source identity, endpoint, date semantics, scope, units and schema before any automated retrieval |

## Next implementation order

1. Reuse existing FMTQIK and MI_INDEX collectors, if present, to identify their actual HTTP endpoint and date query from source code and run evidence; record an independently verifiable source contract, not an inferred URL.
2. Build date-scoped raw archiver and validator for one source at a time with invalid-date, stale-response, schema, immutable-manifest and unavailable-source tests. Promote Registry status only after review.
3. Connect only verified same-date Manifest entries to the single D4 Market Master. Keep partial observations labeled partial, never silently replace missing official evidence with chart derivatives or a different date.
4. Complete a second date's independently reviewed original analysis, TTS/SRT/M8VIS research MP4 and acceptance artifacts before proposing successor B.

Existing `research_date_to_video_official_entry_v1.js` remains a research-only evidence/diagnostic entry, **not** a full Date-to-Video render pipeline. `render_authorized=false`, `publication_authorized=false`.

## Verified repository collector contracts (code inspection, not raw-archive certification)

- FMTQIK: `scripts/build_twse_market_chart.js` calls `https://www.twse.com.tw/rwd/zh/afterTrading/FMTQIK?date={YYYYMM01}&response=json` once per month, with `date` set to the first day of the month. It checks `stat=OK` and required fields `日期`, `成交股數`, `成交金額`, `成交筆數`, `發行量加權股價指數`; it converts each response row's ROC date to Gregorian YYYYMMDD and filters to the requested range. `mergeVolumeRows` currently stores a derived row, not the original monthly HTTP bytes, response URL/headers, or immutable raw Manifest. The same collector obtains index OHLC separately from `TAIEX/MI_5MINS_HIST?date={YYYYMM01}&response=json` and checks index close against FMTQIK close. The FMTQIK date contract is **monthly query with individual dated rows**, not a per-day HTTP endpoint.
- MI_INDEX: `scripts/crawl_twse_mi_index.js` calls `https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?date={YYYYMMDD}&type=ALL&response=json&_=<request timestamp>`; it validates `stat=OK`, `date`, `tables`, and rejects a mismatched returned date after bounded retries. It writes a parsed/reformatted JSON file at `data_twse_mi_index/{YYYYMMDD}_twse_mi_index.json` and refreshes `files.json`. `scripts/run_twse_mi_index_range_batch.js` already implements reuse-first validation and paced historical backfill. This is a reusable collection path, but not yet an immutable original HTTP byte archive with source metadata/Manifest. The breadth parser validates the actual `股票` column, **not** ordinary-share universe identity.
- Neither collector is to be invoked from the new research date entry merely because its URL is known. First add independent immutable archive/validator tests, review the source contract and Registry approval, then add bounded research-only recovery. Keep the existing production collectors untouched.
