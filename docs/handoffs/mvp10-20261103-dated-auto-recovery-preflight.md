# MVP10-A — Real-date missing-data recovery preflight implementation

Checked 2026-11-03 Asia/Taipei. Active project `daily-gainers-market-opening-end-to-end`; immutable goal `goal-v3/MVP-10DAY-v1`; A incomplete, B frozen and not eligible.

## Main snapshot and workflow audit
- Main HEAD at start: `b6da689007292cac373445def6f82709c22ef0ef`. Current 20261102 `data_daily_gain_over_5/20261102.json` 29 gainers; `analysis-facts/20261102.json` 29 date-matched stocks, 6 source-status flags `available`; `analysis/20261102.json` 29 retrospective rows.
- Exact main 20261102 `analysis-news`, `research_pending/daily-gainers-ai`, `analysis-ai`, and `video_scripts/daily-gainers` still 404 at check; `market-summary` is preliminary. No source-final, original institution scope or live private upload acceptance.
- Reviewed `AGENTS.md`, `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, owner `docs/policies/daily-gainers-video-editorial-verification-delivery-v1.md`, and `docs/architecture/daily-data-recovery-agent-dispatch-v1.md`. The latter is expressly DESIGN/REFERENCE and not evidence that a live safe dispatcher exists.
- Existing `.github/workflows/publish-daily-gainers-news-summary.yml` uses push/dispatch and writes `main` plus conditional Pages. `publish-daily-gainers-ai-analysis.yml` uses schedule/push/dispatch, upgrades date-matched facts, but requires prior `research_pending/daily-gainers-ai/${date}.json` and can write `main` and invoke Pages; `publish-daily-gainers-unified-analysis.yml` also writes main+Pages. Existing video orchestrator can dispatch the YouTube upload workflow. **None can be used as a safe research-only missing-news crawler**.

## Actual implementation (isolated research branch only)
1. `scripts/research_mvp10_recovery_plan.js` — research-only Node date-scoped read-only planner. Verifies date, numeric 5% raw arithmetic, stock code identity/order, Facts required declared source status, staged news/pending AI/AI completeness, final-only summary and script presence. Encodes strict dependency order `raw -> facts and news -> ai_pending -> ai -> summary -> script -> render`, blocked status, per-date per-stage dedup key, source SHA-256, prior run IDs **as references only**. A recorded old Run ID never implies that today's output was produced. All stages fail closed on wrong dates, invalid JSON, missing required dependencies or missing sources. The render stage cannot auto-trigger; the current research-only dispatch allowlist is deliberately empty.
2. `tests/research_mvp10_recovery_plan.test.js` — six Node tests: new-date missing news and blocked AI/render, next-cycle real-output recheck with old Run ID, full fixture still stops at render lock, wrong date/incomplete facts/preliminary summary, invalid calendar and prior receipt, incorrect stock arithmetic/duplicate code. **Test source committed, not yet independently observed passing remote CI**.
3. `.github/workflows/research-mvp10-recovery-preflight.yml` — branch-filtered push research CI, `permissions: contents:read`; checks out planner/tests from research branch and fresh source snapshots from `main` with `persist-credentials:false`; runs tests, emits 20261102 plan Artifact, records actual `GITHUB_RUN_ID`, attempt, SHA, ref and run URL. No workflow dispatch, git push, Pages, video, YouTube, secrets, or release lock changes. Research trigger is **not** a recurring daily production schedule; GitHub cron on non-default branches cannot be assumed.
- Commits: planner `7d8cf39922ebe71bd8102268c1e0b2765bb4aaaf`; tests `1062663683136d5874254a5cee97ece0c534fd45`; CI workflow `c192eacef1598744fa7901bfd3aa7a85bc685094`; run receipt addition `5ee446b099b4dbb1480538c8e3fb9777613f1dd3`.
- Files read back via GitHub connector. Actual new CI Run/Job/Artifact ID and Node test PASS **not independently retrieved**; never claim remote success until observed.
- This phase is a reproducible foundation for automatic resumption, **not** a working production Daily Data Recovery Dispatcher. No autonomous triggering of missing upstream producer is activated. The next eligible implementation within research A is to identify or create the approved no-side-effect news and AI-draft provider (real ChatGPT/agent execution must be explicitly configured), validate it and the existing guarded flows, and then add a narrowly allowlisted event/run dispatcher with queued/running dedup and timestamped receipts; independently validate B after A complete and user authorization. Keep `main` unmodified until acceptance and authorization.

## Immutable owner requirements
- Only dashboard `TAIWAN_STOCK_TABLE_LIST_20261102_V1`, no four-grid fallback.
- YunJhe zh-TW +15%, spoken percentages `百分之1.95`, display `1.95%`, captions and VTuber from one verified semantic Master.
- Preserve proved 1080p media research CI #41463609661 and MI_INDEX research CI #41468872124; **neither makes the new 20261102 video editorial-final**.
- No Prompt B, production schedule modification, Pages, YouTube upload, credential use or publishing lock change.

research_progress_status: PROGRESS
research_progress_evidence: new isolated planner, six negative tests, read-only CI workflow, run-ID artifact contract
phase_status: MVP10-A INCOMPLETE
b_status: FROZEN_NOT_ELIGIBLE
current_blocker: no verified upstream safe news/AI generator; no actual new research CI run evidence; no full production schedule/agent invocation integration
planned_research: independently observe recovery-preflight CI; complete safe news/AI producer integration and date-based dispatch only after branch permissions and side effects are proven
prior_attempt: only repeated date-specific handoff and blocked publisher workflow inspection; now executable fail-closed planner added
anti_loop: do not repeat BFI82U fetch/network speculation, do not rerun already proven complete research media; do not dispatch unsafe [07] or video workflows
next_action: promptA
plan_changed: NO
publication_authorized: false
youtube_upload_authorized: false
