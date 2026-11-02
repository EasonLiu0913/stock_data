# MVP10-A — 2026-11-02 pivot to dated 20261013 main final sources

## Goal and fixed governance
Owner-approved `goal-v3/MVP-10DAY-v1` deadline 2026-11-08, project `daily-gainers-market-opening-end-to-end`, original immutable pair `data_research/m5/change-proposals/DAILY-VIDEO-MVP-10DAY-PAIR-v1.md`. Prompt A INCOMPLETE, original B FROZEN/NOT_ELIGIBLE; private YouTube pilot needs separate express authorization, all production/publication locks OFF, no main edits, no YouTube/Pages/privileged listeners.

## Meaningful new main source
On 2026-11-02, remote main published actual `20261013` complete unified AI research `f0fb2e44e00e3141a2673a4f6955af47768e5ce9`; `data_daily_gain_over_5/market-summary/20261013.json` reports `status=final`, `coverage.overall=complete`, 25 source and analysed stocks, and `video_scripts/daily-gainers/20261013.json` has 7 original script scenes and 25-stock count. This is **real upstream progress**, unlike the old golden 20261008 preliminary source. It does not automatically satisfy the published video/common-stock or presentation/AI evidence contract.

A fresh literal GitHub Connector lookup of 20261013 pinned source plus stock classification tables independently confirmed exact non-ordinary/special codes in original 25-stock universe:
- 6645 金萬林-創: `InnovationBoard`;
- 7730 暉盛-創: `InnovationBoard`;
- 9103 美德醫療-DR: `TDR`;
- 6924 榮惠-KY創: `InnovationBoard`;
- 1312A 國喬特: special/preferred share, absent from ordinary Stock table.

Therefore **20 provisional Stock-category candidates**, 5 exclusions. This is a current classification inventory, not certified target-date security master. All original 25 raw gain arithmetic independently reproduced within 0.00485 percentage points of published rounded change, with 0 raw rounding conflicts. Do not silently discard five names while keeping a 25-stock analysis, spoken narration and SRT; that changes semantics and breaks date-count hashes.

## Actual implementation this Prompt A
- `scripts/research_mvp10_20261013_preflight.js` commit `5afc91550086d60eca5666dde85ad5061f5d9f60`: research-only immutable snapshot-input SHA ledger, data date/count and gain arithmetic checks, Stock/InnovationBoard/TDR scope inventory, explicit special-share exclusion, detects unsafe referenced scenes, fail-closed output with render/publication false. No source rewriting.
- `tests/research_mvp10_20261013_preflight.test.js` commit `8e2cd5bcde4f185d48f3f1c10341bcb5741382b6`: synthetic final-summary-but-wrong-scope, date mismatch, count mismatch, gain conflicts, security-name conflict, never-promote-success negative cases.
- `.github/workflows/research-mvp10-20261013-preflight.yml` commit `5b254c9ab49ac1c32be220d17a28654c9a0be0a2`: push-only isolated research branch; read-only GitHub permissions, `persist-credentials:false`; checker from research checkout, original upstream main data pinned exactly to `f0fb2e44e00e3141a2673a4f6955af47768e5ce9`; test with Node, invoke real source audit and require **expected exit 2** and exact five exclusions / 20 candidates / final source status; upload bounded JSON evidence. This is **not a rendered MP4 or source approval**. No downstream action, production workflow or YouTube upload initiated. Note new workflow execution itself requires actual Run ID/log verification.

## Correct next stage
1. Verify the new isolated preflight CI run/job/log and its JSON artifact, or repair a real failure. No inference of CI PASS from a committed workflow. Use user-provided run URL if connector cannot enumerate push-based Actions.
2. Pursue coherent, strictly provenance-backed 20261013 **20-stock common-share** source bundle in isolated temp: raw, analysis-news, analysis-facts, analysis-ai, published analysis, summary, 7-scene script, with each numerical figure and narrated *count* updated from one source. Do **not** merely relabel existing 25-stock `final` and do not weaken original validation. Only truthful, original complete builder + original final video validator may authorize production of complete isolated research MP4.
3. Once real original validator and ordinary/date evidence PASS, wire full 1080p TTS +15% YunJhe, V4 four lines, no English percent, 1.95% Arabic subtitle, dashboard/VTuber, SRT, thumbnail, manifest, video QA. Already existing research local 20261013 full video is *not* sufficient as newly verified 20-stock ordinary-share artifact; regenerated spoken counts and timing mandatory.
4. Private/nonpublic pilot/upload remains owner-authorization-gated; original Prompt B remains not eligible.

research_progress_status=PROGRESS
phase_status=MVP10-A INCOMPLETE
next_action=Verify 20261013 research preflight CI then coherent ordinary 20-stock source and original validator
plan_changed=NO
publication_authorized=false

## 2026-11-02 — Follow-up Prompt A: first coherent isolated 20-stock data stage

Fresh remote-main read: `79df47fbdd08ea8351e12329bc0c1bbb8d375208` (current observed main at invocation); globally active project unchanged. The upstream 20261013 date source is intentionally **pinned** at `f0fb2e44e00e3141a2673a4f6955af47768e5ce9` rather than silently mixing main revisions. Core source records were fetched from GitHub and their shapes independently inspected: raw/news/facts/AI each have 25 ordered rows, published unified analysis 25 rows, 7-scene script 25 stocks, original summary says final/complete. Previous preflight identified five nonordinary or special securities (6645, 7730, 9103, 6924, 1312A).

New on isolated research branch:
- `scripts/stage_mvp10_20261013_candidates.js` at `de75dea1543220d5a863a9128570da17361b2e2a`: requires literal pinned 20261013 raw schema and 25 rows, matching code-order across raw/news/facts/AI, current classification table exact names, and five expected exclusions; copies **20 coherent candidate rows** for all four inputs into a **new temporary external directory** with per-component source+output SHA256, `research_only=true`, `source_date_classification_certified=false`, `original_source_semantics_reapproved=false`. Clears AI market-wide summary/watchlist and updates facts candidate gainer count, but does NOT create a published unified analysis or script. Any unverified legacy single-name claims are not reapproved.
- `tests/stage_mvp10_20261013_candidates.test.js` at `8d3858f031a45c268633d5bb04ff27692ff01bfe`: checks missing-source and unsafe output-inside-input rejection. Further real-source CI exercises multi-file count and scope.
- `.github/workflows/research-mvp10-20261013-stage.yml` at `14035f9fb95bdba1cc871f22d5ec1dd84eb44400`: read-only isolated CI with pinned original main SHA, no credentials persisted, original market summary builder+validator copied **byte-identically** into stage, calls both in temp directory. Workflow requires original builder's new summary `status=preliminary` and not overall complete, 20 rows and exact exclusions, no render/publication. Research artifact records stage provenance and actual generated preliminary summary; no MP4/TTS/YouTube.
- Original validator CLI was separately inspected: it **requires** `--date YYYYMMDD`. Corrected workflow invocation in commit `e3a6c12c274d4ef474966b9c8185b605540e529d` before claiming any CI green.
- Fresh GitHub Connector `get_commit_combined_status` still returns empty and GitHub Web fetch of Actions was unavailable. Neither absence proves no run. **No new run/job/artifact ID or test execution is independently confirmed yet**. Prior local full 20261013 render remains historical research evidence only; this stage does not authorize it as 20-stock final video.

Next: verify current research `20261013 coherent-stage` and `20261013 Published Source Scope Preflight` workflow job+logs. If successful, produce genuinely re-reviewed 20-stock unified AI analysis with honest market totals/selected-company claims, regenerate matching narration/master, then unchanged original final/complete and video validators, then a full isolated 1080p render/QA. Never relabel preliminary as final or reuse spoken 25-stock counts. Private YouTube pilot still needs owner approval; Prompt B frozen, publication_authorized=false; `MVP10-A INCOMPLETE`. Plan changed: NO.
