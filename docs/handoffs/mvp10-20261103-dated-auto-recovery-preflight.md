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

## 2026-11-03 continuation — original-validator receipts and two-cycle readiness (supersedes earlier shallow planner behavior)
- Inspected original current-main `scripts/validate_daily_gainers_news_analysis.js`, `scripts/validate_daily_gainers_ai_analysis.js`, and the video/market validators. Discovered an actual fail-open risk in initial research planner: it treated date+code/shape only as `VERIFIED` for news/AI/script, despite original validators requiring source links, evidence strength, confidence, and semantic consistency.
- Research correction `e4d37eb31a58310603e747ac1850456d78fbaada`: those stages now `VALIDATION_REQUIRED` unless genuine original validator attestation matches same file/date/main commit; no shallow completeness or fake editorial PASS.
- Research tests `2980c3059092d635799e4c91c033adcaa216dfc4`: adds non-promotion negative case (7 tests at this intermediate commit).
- Read-only research workflow `5d196d584066634c49e2c1f66045761fae8f5a7b`: checkout current main original `scripts`, `config` and date-specific sources; only **execute validators**, never publisher/crawler workflows. Check AI, news, facts, summary and script when files exist; record explicit `MISSING_INPUT`, `PRELIMINARY_NOT_FINAL`, `ORIGINAL_VALIDATOR_PASS` or `ORIGINAL_VALIDATOR_FAIL`.
- Subsequent commit `a245e9ab3ab970b7bbd5e7685f27c8a4e32ed21d`: each original-validator PASS includes raw source SHA-256. Commit `e434dd133a986be1d77e444a7ee8e6267fc0d295`: planner accepts optional `--validators` receipt only if exact date, 40-character source main SHA and input path/file SHA match. Incorrect or stale receipts never turn a stage VERIFIED. Any missing upstream dependencies still block downstream.
- Test commit `cffe3c524e049a9f6245dffb24bcc0bc1832f446`: 9 total tests including matching receipt progression to `render` (still BLOCKED), wrong date, wrong main SHA, old digest and absent proof. These tests are **committed but real CI execution not independently verified**.
- Research CI `679eeed07e4e57e0caf91a9447bbf468ac5ba9f8`: after the initial plan, invokes original validators, writes `original-validator-results.json` and runs a second plan with `--validators` and `--previous`, preserving `20261102-rechecked-plan.json`, the exact GitHub Runner ID and all statuses. Branch-only push, `contents:read`, `persist-credentials:false`, no `gh workflow run`, git push, Pages, YouTube or downstream listeners.
- GitHub connector only exposes PR-filtered commit workflow runs; it did not expose actual push Run ID. Container direct GitHub networking also DNS failed. **DO NOT claim CI SUCCESS or a tested live dispatcher.** Actual GitHub Actions run/status/artifact remains the next independent proof point.
- The auto-dispatch allowlist remains empty because no independently verified safe agent/news producer exists on main and any three `[07]` publisher workflows can write `main`/deploy Pages. This is an intentional safety hold, not implementation of end-to-end automatic recovery or background ChatGPT execution. Future integration must use a real permitted Agent runtime and actual existing data workflow, with exact per-date queued/running dedup and verified post-run artifact; explicit original A/B retained.

research_progress_status: PROGRESS
research_progress_evidence: original validator source audit; corrected fail-closed planner; 9 committed tests; source-bound validator receipts; second-cycle CI code
phase_status: MVP10-A INCOMPLETE
current_blocker: no independently observed new research CI run; no verified safe automated news/AI agent runtime and allowlisted producer
planned_research: independently confirm 20261102 preflight run and its 9 tests, then implement only approved research-safe original news/AI producer
prior_attempt: 6-test shallow planner and one-pass read-only CI
anti_loop: do not claim pass from committed tests, no unsafe publisher dispatch, no bare-retry for missing external CI run; reuse fixed table Dashboard and old successful media proof
next_action: promptA after checking actual CI/new source evidence
plan_changed: NO
publication_authorized: false
youtube_upload_authorized: false

## Further hardening — facts original validation and 10-test CI
- Commit `8504238bd887a5ea7133ec258a446d4f26d33f26` also marks **Facts** `VALIDATION_REQUIRED` until original `daily_gainers_ai_contract_cli.js assert-facts` proof matches exact target date, `main` SHA, file path and SHA-256. This closes a second source-flag-only readiness bypass.
- Tests commit `8f9624a1aefb37fca2ada74bacc1c0395ff33cbb` now contains **10 committed tests**; intended real CI test PASS still not independently observed. Research CI label reconciled by `81695838c448b43971289bc1d4a8e23f0f1771dd`.
- Original validator success is an existing schema/semantic gate, **not proof of truth of external reporting, date-effective listed ordinary stock classification or full owner editorial approval**. The status `VERIFIED` in the research preflight is explicitly scoped to exact bytes passing the invoked original validator; final production A/B remains false.
- **No safe crawler or true ChatGPT Agent runtime connected.** State receipts and next-cycle verification exist only as research CI code. Never claim self-running daily or source repair dispatch in current research branch.

research_progress_status: PROGRESS
phase_status: MVP10-A INCOMPLETE
b_status: FROZEN_NOT_ELIGIBLE
ci_acceptance_verified: false
next_action: promptA (independently inspect real CI run; then identify an explicitly authorized safe source/agent producer)
publication_authorized: false

## 2026-11-03 01:29+08 — Agent task contracts; still no live invocation
- Fresh main observed `713b92102e997709cc6fa8dfed283cc5fd6f68af`; unique active routing still `daily-gainers-market-opening-end-to-end`. Exact `research_pending/daily-gainers-ai/20261102.json` still 404.
- GitHub `fetch_commit_workflow_runs` only covers pull-request runs. `get_commit_combined_status` returned empty classic status checks for research SHAs, **not** evidence of failed or absent Actions runs. Public GitHub Actions page was not accessible from current web tool. No real Run ID or 12-test PASS confirmed.
- A new agent handoff contract has been implemented in `scripts/research_mvp10_recovery_plan.js` at commit `67270bd88b9afd084f6d9d4e84d60442f1e465f5`. Planner output now includes `agent_tasks` for `news`, `ai_pending`, `script`, each with exact target date, deterministic stage key, required verified input paths/SHA-256, observed main SHA, output file, original validator command, evidence-focused writing instructions and `auto_invoke_authorized:false`, `writing_to_main_authorized:false`, `pages_deploy_authorized:false`, `youtube_upload_authorized:false`.
- News Agent task may be `READY_FOR_APPROVED_AGENT` when exact-date raw is ready; downstream AI must wait for genuinely validated Facts and News, and script for final summary plus AI. It is an **invocation envelope only**, not an AI runtime or an authorized dispatch. No hardcoded news claims, no generated fake AI files.
- Research tests committed `4afa50e595a572e35ab01dbe985472c69a7fd374`: 12 authored tests including date-bound news task source receipt, dependency hold and all no-invoke flags; **test PASS still unverified**.
- Read-only CI commit `6680df3446454414c3093c33b8bdcf2ddcab99c6` checks Agent tasks have no auto-invoke/Main/Pages/YouTube authorization in both first and second cycle. Existing `contents:read`, research-branch-only push and source attestation remain.
- Next meaningful A work is **real CI evidence**, then review and implement a real no-release, narrowly authorized Agent execution boundary (with actual provider/credentials and audit) or a specific owner-approved event contract. No hidden automatic ChatGPT dialogue invocation is implied. Do not repeatedly add detached documentation or make artificially successful source files.

research_progress_status: PROGRESS
phase_status: MVP10-A INCOMPLETE
ci_acceptance_verified: false
current_blocker: no independently observed recovery CI or safe Agent execution provider; news/AI date-specific sources incomplete
planned_research: inspect real CI Run/Job evidence; then wire task envelope to authorized safe agent provider with original source validators and no side effects
next_action: promptA when a distinct executable CI or provider integration step is available
plan_changed: NO
publication_authorized: false
youtube_upload_authorized: false
