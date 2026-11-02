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
