# AI 材料瓶頸 Dashboard — 事件／催化劑層

Canonical handoff: `docs/handoffs/ai-material-bottleneck-event-layer.md`

## Current phase

Round 1 — domain-specific event layer implementation.

## Objective

Prevent the AI 材料瓶頸與籌碼觀察 Dashboard from treating stale/lagging chip data as a complete picture when a new fundamental event has just changed the forward outlook.

## Frozen decisions / constraints

- Keep four layers conceptually separate: 基本面／產業瓶頸 → 事件／催化劑 → 籌碼 → 價格確認.
- Event direction/confidence/market confirmation must NOT be added directly into the existing 10-point entry radar.
- Event-day price/chip data must not be treated as post-event confirmation when the event occurs after market close.
- D1/D3/D5 means trading days after the event.
- TDCC is weekly. If no corresponding post-event TDCC observation exists, keep large-holder reaction null/pending; never reuse an older weekly observation as if it were D1/D3/D5.
- Start domain-specific. Do not extract a generic event platform until repeated real use cases justify it.
- Preserve current price/freshness fallbacks and existing score semantics.

## Completed

- Added first event contract at `data_ai_material_bottleneck/events.json`.
- Seeded the first real event: 3016 嘉晶, 2026-09-22 investor conference.
- Dashboard reads and displays latest event direction, confidence, independent market-confirmation status, and D1/D3/D5 reaction slots.
- Added regression coverage for schema and score separation.

## Evidence / validation

The 2026-09-22 嘉晶 investor conference is a real event after market close. Company/news coverage reports full 8-inch silicon epi utilization, Q3 silicon epi revenue growth guidance, improving GaN/SiC, and Ge/Si order visibility extending to 2028. This is exactly the failure mode the prior dashboard could not represent on the event day.

## Current repository state

Primary files:
- `public/ai-material-bottleneck-watchlist.html`
- `data_ai_material_bottleneck/events.json`
- `tests/ai_material_bottleneck_event_layer.test.js`
- `config/public-page-registry.json`

## Known problems / rejected approaches

- Do not hard-add +1/+2 points for a “good” investor conference.
- Do not call event direction “confirmed” before post-event market data arrives.
- Do not fabricate daily TDCC reactions from weekly observations.
- Current Round 1 event ingestion is curated; automatic event discovery/normalization remains next-round work.

## Entry points

- Event contract: `data_ai_material_bottleneck/events.json`
- Dashboard event loader/rendering: `public/ai-material-bottleneck-watchlist.html`
- Existing market data consumed by the dashboard:
  - `data_fubon/files.json`
  - `data_tpex_daily_quotes/compact-history.json`
  - `data_history_sma/<code>.json`
  - `data_tdcc_shareholding/latest.json`
  - `data_tdcc_shareholding/trends.json`
  - `data_institutional/<code>.json`
  - `data_twse_margin_balance/`
  - `data_tpex_margin_balance/`

## Next round

1. Build a small domain-specific updater that fills D1/D3/D5 reaction fields from repository data after each trading day.
2. Add event discovery from existing durable company/MOPS/news sources for watchlist stocks, beginning with investor conferences and monthly revenue.
3. Add deduplication/provenance rules and fail-safe freshness reporting.
4. Only after at least two real event types are working, evaluate whether a shared event normalization component is justified.

## Safety / stop conditions

- Stop rather than silently marking confirmation when source dates are stale or missing.
- Preserve null for unavailable milestone data.
- Never rewrite past event interpretation solely because later price action changed.
- Any automatic directional classifier must retain source evidence and methodology version.

## Prompt A — Next-round implementation prompt

Fetch current remote main, read AGENTS.md and this canonical handoff. Implement the domain-specific D1/D3/D5 reaction updater for `data_ai_material_bottleneck/events.json`. Use trading dates from canonical available price data; calculate post-event price return and volume response, institutional net flow and margin change where corresponding dates exist, and TDCC large-holder change only when a valid post-event weekly observation exists. Preserve null/pending otherwise. Add regression tests, run npm test, commit/push, and checkpoint this handoff before promoting the next round.

## Prompt B — Next-round closeout / verification prompt

Fetch current remote main, read AGENTS.md and this canonical handoff. Verify the exact Prompt A round against durable repository evidence: inspect diff, schema semantics, D1/D3/D5 trading-date selection, after-market handling, TDCC weekly fail-safe behavior, tests and CI. Confirm the 10-point entry radar is unchanged by event direction. Record PASS/FAIL evidence in this handoff and only promote the following round when PASS is durable.
