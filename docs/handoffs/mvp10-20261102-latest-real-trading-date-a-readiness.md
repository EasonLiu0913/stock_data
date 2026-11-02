# MVP10-A 2026-11-02 real-trading-date readiness checkpoint (research only)

Project `daily-gainers-market-opening-end-to-end`; goal `goal-v3/MVP-10DAY-v1`, active phase `MVP10-A INCOMPLETE`. Frozen `MVP10-B` not eligible. Check performed 2026-11-03 00:17 Asia/Taipei against current remote `main` and isolated branch `research/daily-video-mvp10-a-20261029`.

## Primary, bounded GitHub checks
- `main` HEAD at check: `b71299a4fd1cc975512c0eedcf1e96dc0f34a5c8` (recheck before subsequent action). Main `data_daily_gain_over_5/20261102.json`: exists, Git blob `b1d34e90b4e40b6f1ced8da54a6ac1390cd5d89b`, target 20261102, previous 20261030, threshold 5%, 29 raw candidates.
- Main `data_daily_gain_over_5/market-summary/20261102.json`: exists, Git blob `e8a8498ec52092057861bbf29d915fe86acdfd79`, **status: preliminary**, `summary_stage: news_theme`, `coverage.overall: missing`, raw complete but news, facts, analysis and funding missing, `analyzed_stock_count: 0`, semantic source `none`. This is NOT video-final.
- Main `data_daily_gain_over_5/analysis-ai/20261102.json`: NOT_FOUND. Main `video_scripts/daily-gainers/20261102.json`: NOT_FOUND. No current-date full dated video semantic Master. Do NOT synthesize a 20261102 MP4 from partial raw alone, or silently fall back to 20261013.
- Isolated research branch did NOT have any of those four current-date files, because it diverged from main; missing on research branch alone is not evidence of source outage on main.
- Research branch `video_scripts/daily-gainers/20261013.json`: old **25 stock** source, not equivalent to approved *20-candidate* research preview. `scripts/research_mvp10_20261013_preview_plan.js` explicitly marks 7 scenes, 20 candidate research-only, `source_final_approved:false`, `original_video_validator_pass:false`, `publication_authorized:false`; do not promote to original A/B.
- Verified GitHub video Run `41463609661`: success, seven-scene YunJhe +15%, 1920x1080 complete hardburn MP4, locked Dashboard `TAIWAN_STOCK_TABLE_LIST_20261102_V1`, but RESEARCH_PREVIEW_NOT_PUBLISHABLE. MI_INDEX source scope Run `41468872124`: success for its partial audit only.
- BFI82U dated original CI: independent Push Run ID not available in current GitHub connector; prior commit-run operation only lists PR runs. No new run result or original 20261013 raw TWSE BFI82U receipt certified. Existing script/workflow must not be modified without a specific reproducible defect.

## Prioritized A-stage readiness (no gate relaxation)
| Stage | Evidence | Status |
| --- | --- | --- |
| Dated raw 20261102 5% candidate extraction | Main raw 29 candidates + previous date | RAW_AVAILABLE, identity/arithmetic independent validation not yet certified |
| Dated 20261102 fact/news/analysis/funding | Main preliminary summary explicitly marks missing | BLOCKED_MISSING_INPUT |
| Dated 20261102 AI semantic Master / video script | Both official paths 404 | BLOCKED_MISSING_INPUT |
| Market opening source scope | Real 20261013 MI_INDEX stock counts verified; BFI82U 3 groups/HTTP not certified | PARTIAL_ONLY |
| Render-only full media technology | Run 41463609661; correct single table Dashboard, hardburn captions, TTS | RESEARCH_PREVIEW_PASS (NOT_A_COMPLETE) |
| True current-date reusable render | No final/current-date source, isolated branch missing 20261102 | BLOCKED |
| Private YouTube pilot | Explicit separate owner permission required; no authorization | WAITING_OWNER; NEVER_UPLOAD_NOW |
| Independent original Prompt B | A not complete; original frozen B not run | NOT_ELIGIBLE |

## Concrete next A action
Prioritize **existing missing-data recovery** for the latest valid trading date, after auditing each workflow's triggers, token permissions and side effects; aim to complete same-day news, facts, analysis, funding and final market summary, then script and isolated render. Read-only inspection of recovery entrypoints first. If recovery has upload/Pages/production side effects, do NOT dispatch it. Do not fake status final, bypass editorial/source gates, or keep cycling on BFI82U provenance without new primary evidence.

This is an A-stage workflow prioritization, not an owner-approved change of frozen acceptance. No main/cron/Pages/YouTube/upload/publication writes and no Prompt B. The 2026-11-08 private pilot goal remains unmet; it also separately requires owner upload authorization.

research_progress_status: PROGRESS (new date-specific main-vs-branch readiness audit, concrete missing stage)
phase_status: MVP10-A INCOMPLETE
blocker: 20261102 preliminary/incomplete source package and missing AI/script, original BFI82U and video A/B
next_action: promptA
plan_changed: NO
publication_authorized: false
youtube_upload_authorized: false

## 2026-11-03 00:17+08 — Fresh source and workflow side-effect audit

- Rechecked remote `main`: `75526ad20f8ad09ab1e3ff4c90896cbb92c8bbf8` (point-in-time snapshot; recheck before writes).
- `data_daily_gain_over_5/analysis/20261102.json` **NOW EXISTS**, Git blob `70a89aeffc73f282c8b118359c0946b1daf4b07a`, generated `2026-11-02T16:20:54.143Z`, source date `20261102`, `stock_count:29`, `retrospective:true`. Earlier "analysis missing" line above is historically correct at that prior check, but is **superseded for the current remote main**. This is an intermediate retrospective analysis, not final editorial authorization.
- Still absent from `main` via exact GitHub content lookup: `analysis-news/20261102.json`, `analysis-facts/20261102.json`, `analysis-ai/20261102.json`, and `video_scripts/daily-gainers/20261102.json`. Existing `market-summary/20261102.json` remains **preliminary** with original snapshot `coverage.overall:missing`; do not infer that its coverage dynamically reflects the new analysis until regenerated and validated.
- `.github/workflows/daily-gainers-video-upload-orchestrator.yml` on `main`: `workflow_dispatch`, weekday scheduled and `main` `video_scripts/daily-gainers/*.json` push listener; `permissions: actions:write`. Explicitly invokes `gh workflow run generate-upload-daily-gainers-video.yml --ref main` on decision `render`, and `retry-upload-daily-gainers-video.yml` on `retry`. `generate-upload-daily-gainers-video.yml` has `contents:write` and performs YouTube upload. **UNSAFE for research/recovery; DO NOT DISPATCH**.
- `scripts/decide_daily_gainers_video_upload.sh` confirms `main` receipts, GitHub artifact discovery and dispatch decisions; this is *not* a no-upload data recovery workflow.
- Likely guessed standalone recovery workflow names did not resolve via exact connector lookup, and GitHub code search produced no matching results. This does **not** establish that safe data recovery does not exist; exact existing trigger and side effects remain unverified. **No workflow dispatch this round**.
- Next bounded A step: locate the actual canonical data-recovery runner via original workflow documentation or an authenticated tree/listing-capable GitHub surface, then review exact dispatch/event permissions, all output destinations, and direct downstream listeners. Recover 20261102 news/facts/AI and recompute summary only if verified isolated safe. Original B is NOT_ELIGIBLE.
- No changes to `main`, production schedules, Pages, secrets, YouTube or release locks. Preserve only table-led Dashboard `TAIWAN_STOCK_TABLE_LIST_20261102_V1`, successful media research Run `41463609661`; do not permit the 20-candidate research preview to stand for complete final 29-stock daily video.
- Distinct progress: new actual 29-stock retrospective `analysis` arrived, and real upload side-effect confirmed; no new CI, no media, no new source-final certification.

research_progress_status: PROGRESS
phase_status: MVP10-A INCOMPLETE
b_status: NOT_ELIGIBLE
blocker: absent 20261102 news/facts/AI/script, preliminary stale summary, verified safe data recovery entrypoint not yet located
next_action: promptA
plan_changed: NO
publication_authorized: false
youtube_upload_authorized: false

## 2026-11-03 — Exact existing publishing workflows and live facts arrival

Research-only current-main inspection; prior dated checkpoints above remain historical:
- Latest main observed `fe96ef952816a3ca377f29751634dd5878c2d766`, commit message `analysis: refresh 5% AI facts 20261102` at 2026-11-02 16:24:04 UTC. Verified `data_daily_gain_over_5/analysis-facts/20261102.json` now exists, blob `cb59b77f9f4ffff611ee07429e89f24b026709ba`, schema v3, target_date 20261102, generated_at 2026-11-02T16:24:03.067Z, and named date-specific margin, broker, MI_INDEX, foreign, trust and dealer input paths. This **supersedes** earlier "facts missing" finding. Complete per-source row-level readiness was not independently validated.
- Main `analysis/20261102.json` exists (blob `70a89aeffc73f282c8b118359c0946b1daf4b07a`), 29 retrospective analyses; legacy/mixed status does not imply AI-final.
- Latest checked `analysis-news/20261102.json` and `analysis-ai/20261102.json`: 404; `market-summary/20261102.json` (blob `e8a8498ec52092057861bbf29d915fe86acdfd79`) remains `status:preliminary`, its embedded old coverage reports facts/analysis missing because it predates the recent source commits. `video_scripts/daily-gainers/20261102.json` not available on main at check.
- Found canonical `docs/architecture/daily-data-recovery-agent-dispatch-v1.md`; **explicitly DESIGN/REFERENCE ONLY**, not an installed daily recovery dispatcher. It mandates separate exact workflow/inputs and side-effect audit, and expressly warns that publishing workflows are NOT generic crawlers.
- Inspected `.github/workflows/publish-daily-gainers-news-summary.yml` blob `8c0c979d5a22d0f7d2e910976e8febbe65567330`: `workflow_dispatch` date input, main writer, `contents:write`, `pages:write`, `id-token:write`; builds and pushes `analysis-news` and `market-summary` and then calls `deploy-pages.yml`. Not a safe research-only missing-news crawler; it expects validated news input or a specific legacy migration path.
- Inspected `.github/workflows/publish-daily-gainers-ai-analysis.yml` blob `cd17379e04d5d5371fcd10deab9f8df7f46593a3`: `workflow_dispatch` date input, schedule, main writes to AI/unified/summary; `contents:write`, `pages:write`, `id-token:write`, calls `deploy-pages.yml`. Uses `research_pending/daily-gainers-ai/DATE.json` pending approval file; it is not guaranteed to generate a missing AI draft from nothing.
- Inspected `.github/workflows/publish-daily-gainers-unified-analysis.yml` blob `b26307276a76d04988341ece99a303baaa6406a2`: workflow_dispatch/date, main writer, `contents:write/pages:write/id-token:write`, pushes unified and market-summary and calls `deploy-pages.yml`. Requires valid AI input; does not repair absent news/facts itself.
- Separate `.github/workflows/daily-gainers-video-upload-orchestrator.yml` explicitly dispatches upload workflows from `main`; forbidden research entrypoint. No existing safe-only callable workflow was yet independently identified.
- Connector provides no native workflow_dispatch for a new run (only PR-filtered commit-runs and existing-run retry); no dispatch was invoked. No extra unapproved GitHub push used to provoke main-side effects.
- Next focused A task is identifying upstream **draft producer** for `analysis-news/20261102.json` and `research_pending/daily-gainers-ai/20261102.json` by repository docs/commit lineage. If missing, report dependency and do not manufacture filler content or dispatch publication. Once genuine same-day AI/news and final summary exist, use locked 20261102 table-led Dashboard through research-only Render-only with independently reviewed final source.
- Preserved only `TAIWAN_STOCK_TABLE_LIST_20261102_V1`, no old quadrants, no edits to main, Pages, YouTube, scheduled flows or release locks; MVP10-A INCOMPLETE, original B NOT_ELIGIBLE.

research_progress_status: PROGRESS
phase_status: MVP10-A INCOMPLETE
research_progress_reason: actual 20261102 facts newly committed and three real production publish workflows classified as unsafe for isolated data recovery
current_blocker: missing 20261102 news and AI draft plus original gated market summary/script; safe existing draft producer/invocation not yet verified
planned_research: find upstream draft-producer entrypoints through commit history and inspect exact no-upload/no-Pages trigger before any bounded isolated recovery
prior_attempt: prior readiness checkpoint lacked facts, and guessed workflow names did not resolve
anti_loop: do not dispatch any of the three publishing workflows or video orchestrator; do not repeat BFI82U HTTP loop
next_action: promptA
plan_changed: NO
publication_authorized: false
youtube_upload_authorized: false

## 2026-11-03 — Upstream AI draft-producer lineage check
- Exact current-main `research_pending/daily-gainers-ai/20261102.json` returned 404. Publisher `.github/workflows/publish-daily-gainers-ai-analysis.yml` expects a valid pending AI draft; cannot create this missing upstream draft by simply dispatching publish.
- Historic commit `60e97ab4bc983fe7bf176b57c40377dbc6cc402c` introduced `scripts/synthesize_daily_gainers_ai_from_complete_facts.js`, but this script returns 404 from **current main**. Historic one-shot workflow `.github/workflows/one-shot-synthesize-daily-gainers-ai-20260827.yml` was introduced by `13585edbf7f3494c149fb4581d9987a7adaceba8` and **removed** by `b3e1ab8e96e1123b51a20a0aa5e17bdce701ee24`. Do NOT try to dispatch the removed workflow or assume that historic file is active.
- Historic `analysis: research daily 5% news themes 20261013` commit `0d72df3e1a22ae04f5b85bdeae3ecc9b46aed5c5` wrote `data_daily_gain_over_5/analysis-news/20261013.json`, but this does NOT identify an existing safe 20261102 news crawler or confer publishing authorization.
- Concrete unresolved dependency: existing **safe upstream news and AI synthesis producer** for 20261102 not verified on current main. Do not use empty commits to cause workflow triggers; inspect canonical current producer first, and stop when capability/side effects unknown.

research_progress_status: PROGRESS
phase_status: MVP10-A INCOMPLETE
next_action: promptA only when a distinct upstream producer discovery or new dated source evidence is available; otherwise WAITING_SOURCE
plan_changed: NO
publication_authorized: false
