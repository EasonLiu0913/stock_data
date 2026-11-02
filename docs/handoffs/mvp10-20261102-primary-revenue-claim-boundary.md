# MVP10-A — 2026-11-02 official-revenue claim boundary checkpoint

Project: `daily-gainers-market-opening-end-to-end` / `goal-v3/MVP-10DAY-v1`.
Frozen original A/B: `data_research/m5/change-proposals/DAILY-VIDEO-MVP-10DAY-PAIR-v1.md`.
Active project on remotely rechecked main, A INCOMPLETE, B NOT ELIGIBLE.

## Material step
The last verified isolated MOPS historical run #41318622206 (job 124883901900) established exact original official monthly revenue fields for 6672, 2305 and 3416, **not** causal attribution for 2026-10-08 price gains. Earlier 32-stock audit #41317861690 established 31 numeric matches and one explicit no-record margin case (4178). The original strict video validation trial #41317225841 correctly rejects a preliminary summary with `summary not final/complete`. Do not rerun those audits without changed source evidence.

New research-only:
- `scripts/reconcile_mvp10_mops_claims.js` commit `cc6535b9e18377010b8f78ef4f28257437d28297` parses a genuine MOPS receipt; accepts three issuer-reported September revenue facts only after original company, date, URL, exact amount, official rounded YoY, HTTP and row checks; refuses to infer a stock-price catalyst.
- `tests/reconcile_mvp10_mops_claims.test.js` commit `9e5c5431797fd025f0cab0d37f1074c681071808` adds five synthetic contract/regression tests for primary fact binding, unsupported causation, mismatched data, missing/duplicated official rows, wrong date and premature permission.
- The existing research-only MOPS workflow was updated at `a2694dc3bb51fc2d344ea9aa86137d860cc8b747` to run these tests and combine the fresh original official receipt with the frozen published analysis, producing a temporary independent `20261008-primary-revenue-claim-boundary.json` artifact.
- All 3 GitHub file writes were independently fetched and confirmed by blob SHA; no main modifications.

## Status/limitations
This is a scoped research claim-binding improvement, **not a revised 32-stock published analysis**. It deliberately reports eight original legacy strong-claim entries still unresolved; three historical revenue facts do not establish same-day price causation, and it never writes `final/complete` or rewrites original sources. Existing security-date/classification and strict final original validator remain required.

Workflow read-only `contents:read`, exact research push branch, sparse checkout, no secrets/YouTube/upload/Pages/production dispatch. New CI run/job/artifact has **not yet been independently confirmed**, so do not declare tests PASS. Note: an accessible GitHub Connector workflow-run listing for push events is not available here; inability to retrieve a run ID is not evidence that no run happened.

### Correct next step
1. Confirm the NEW `[Research Only] MVP10 Official MOPS Historical September Revenue` run on branch `research/daily-video-mvp10-a-20261029`, inspected against commit `a2694dc3bb51fc2d344ea9aa86137d860cc8b747` or later; inspect actual Job Log and receipt report. If failed, bounded repair without weakening gates.
2. After real PASS, integrate only valid official revenue facts into isolated truthful 32-stock editorial output, downgrade unsupported causes and restore date-correct ordinary-stock proof.
3. Run unchanged original final/complete summary+video validators in a disposable checkout, then run genuine full 1080p Render-only and inspect artifact before A can complete.
4. Owner-only separate authorization required for private pilot, and original Prompt B remains frozen.

research_progress_status: PROGRESS; phase_status: MVP10-A INCOMPLETE; MVP10-B FROZEN_NOT_ELIGIBLE; publication_authorized=false; automatic_continuation=no; plan_changed=no.

## 2026-11-02 — Corrected genuine 35-to-32 claim-scope defect

The first reconciliation version had a real error discovered by independently fetching and parsing frozen `data_daily_gain_over_5/analysis/20261008.json`: there are **13** legacy direct/corroborated claims across all **35** original entries, not 11. Two such claims are in excluded nonordinary securities `9103 美德醫療-DR` and `6645 金萬林-創`; the third excluded innovation-board entry is `7740 熙特爾-創` (not strong). Therefore the provisional `Stock` category research universe contains **32** entries with **11** strong legacy claims, of which 3 are newly bounded official MOPS revenue facts and 8 remain unresolved. The initial 35-stock assertion would have incorrectly failed CI; it was NOT correct to assert the original 35-stock publication had only 11 strong claims.

Minimal isolated updates:
- `scripts/reconcile_mvp10_mops_claims.js` commit `8c500f7509a40318e29debf2526c14692211cc79` now compares frozen legacy exclusions explicitly before computing provisional 32-stock strengths, and emits `provisional_ordinary_scope_certified=false` (these exclusions are research-only and are not proof of date-effective ordinary classification).
- Tests adapted to authentic 35-entry/13-strong shape in commit `b72e9cd521e6d20d2f0ea2c3c84e25e336c90d80`; negative check for excluded securities in commit `d0a1e1dde3a52fc876db768cde0d77bd0b17201e`.
- No source, analysis status, publishability, original validator, main, YouTube, production or release-lock change. The new research CI job/log/artifact acceptance still **PENDING** because push-run listing is not exposed by the current GitHub connector endpoint. Empty PR-filtered `fetch_commit_workflow_runs` and empty combined-status list do not imply that a push workflow did not execute.

research_progress_status=PROGRESS (identified and repaired real scope inconsistency); phase_status=MVP10-A INCOMPLETE / MVP10-B NOT_ELIGIBLE; next_action=confirm newest isolated MOPS research CI and fix any new job-log issue, then draft claim-bounded 32-stock analysis in temp and run original strict validators; plan_changed=NO.

## 2026-11-02 — Next Prompt A: 32-row editorial-claim ledger and run evidence check

An independent fresh remote-main check keeps the same sole active project and frozen `MVP10-A/B`. Latest observed main SHA at startup `5c0f49518e10ed29c7f56857fa8261fc97a7eabb`; main changed separately for market data only. The isolated research branch was at earlier checkpoint `d94e52b1`; this invocation made research-only changes, no main write.

### Workflow/run evidence
- Prior full official MOPS source workflow #41318622206 at SHA `a1a5ee2900f909f864f810242214268488367354` was independently re-read: completed SUCCESS, job `124883901900`, artifact `13088561218`. The actual job logs confirm exactly three official issuer September revenue rows, no inferred stock price causation. This is **historical source evidence**, not latest source-claim-bridge CI success.
- Latest connector `fetch_commit_workflow_runs` only reports PR-triggered runs and `get_commit_combined_status` gave no status records for new pushes. The current GitHub workflow push-run ID/job/log is **NOT CONFIRMED**; do not claim the new reconciliation CI executed, passed, or failed. No speculative retry of old jobs at old code SHAs.

### New bounded implementation
- Commit `280dc50b27925766644a49e8880eecabc8e86042`: `scripts/reconcile_mvp10_mops_claims.js` adds a 32-entry provisional **editorial claim ledger**, with 3 exact issuer-reported revenue facts, date/unit attribution, and 29 no-verified-issuer-revenue rows. Every one carries `supported_stock_price_cause=false`, and original legacy causal narration is not copied. Ledger is not AI-authored final published content, stock-type certification, or render authorization.
- Commit `bf96399cd5706db6659d5f4958e4936afeeff210`, corrected test-string assertion `dc0f8c84079658964f6ad4e743a5c3c5274e2cc9`: added an isolated test ensuring 32 rows, three official 2026-09 revenue statements, exact 3416 95.90%, and zero claimed price causation or release flags.
- Commit `a628b933cb6d82345259aa81f9cae5d1bb1c87fa`: extended the existing read-only source CI's output validation to the 32-row ledger. No new workflow trigger, privileged permissions, production listener or YouTube action introduced. Same limited research push paths; permissions `contents:read`.
- Independently fetched and parsed the actual original `data_daily_gain_over_5/analysis/20261008.json` through the GitHub connector in this turn, confirmed **35 original entries**, **32 provisional Stock-scope candidates**, **13 original direct/corroborated entries**, **11 among 32**, **8 unresolved after 3 official revenue facts**, and explicit exclusions 9103/6645/7740. This is an independent **static data audit** of the classification totals, not execution of Node tests or full date-effective official security classification.

### Actual remaining gate
1. Verify actual newest research MOPS CI for commit `a628b933cb6d82345259aa81f9cae5d1bb1c87fa` or a later head, inspect job logs/retained ZIP; if failed repair minimally (do not declare success from commit or old run).
2. Complete actual source-supported non-templated 32-stock AI published analysis. Only then use isolated temp source with original builder/validator and preserve strict fail-closed final/complete gate; never force status.
3. Once source eligibility and editorial script truly pass, generate current full 1080p MP4 + SRT + thumbnail + source manifest using isolated Render-only. Still no YouTube or main changes. Private pilot is separately owner-gated; B remains frozen.

research_progress_status=PROGRESS (bounded, newly durable 32-stock claim preparation); phase_status=MVP10-A INCOMPLETE; b_status=FROZEN_NOT_ELIGIBLE; next_action=check actual updated MOPS CI then continue source-certified full analysis; publication_authorized=false; plan_changed=no.

## 2026-11-02 Prompt A — exact raw MOPS field reconciliation strengthened

Fresh original official MOPS Python receipt producer `scripts/research_mvp10_mops_september_revenue.py` was inspected directly: full JSON **does** have per-page `url`, `response_sha256`, `target_rows` and proof; the reduced CI log merely displayed summarized page keys (`sha256`, `codes_found`). Do not misdiagnose the summarized log as a receipt incompatibility. Previous official original source CI #41318622206 remains SUCCESS at the old revision only.

An actual remaining source-evidence gap was discovered in `scripts/reconcile_mvp10_mops_claims.js`: its earlier implementation checked the row's presence and top-level verified proof, but did **not** independently compare the row cells to the claimed revenue and official YoY, so a tampered original row could slip into the new research ledger. Minimal fix `30ec1b39bace61ed6298bfd2187b24df0032ebbd` asserts at least 11 columns, source ticker and issuer, numerical column 2 (current monthly revenue in thousand NTD), column 6 (official YoY%), and equality against the independent proof. Test fix `9eb10b18b5d94e202a7268ce3e73a104c6df16e2` uses authentic 11-column synthetic MOPS rows and adds tampered revenue, YoY, issuer, incomplete-row negative tests. The existing research-only workflow has push path triggers for both touched files; no production or YouTube workflow was dispatched manually.

Only code commits and original-source inspection are established. New regression tests have **not** been independently observed as executed in this chat, and the latest Actions push Run ID is unavailable through the PR-filtered connector. This is NOT test PASS, source final, render authorization or a completed MP4. Next step: retrieve newest research workflow job/log and diagnose if failed; then genuinely source-verified 32-stock unified analysis, unchanged original final/complete validator, full isolated Render-only MP4/SRT/thumbnail/manifest. A remains INCOMPLETE, B NOT ELIGIBLE, release locks closed, owner permission required for nonpublic YouTube pilot; plan_changed=NO.
