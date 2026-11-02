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

## 2026-11-02 Prompt A — Source-row order proof and script/audio invalidation before reuse

Remote current main HEAD rechecked `79df47fbdd08ea8351e12329bc0c1bbb8d375208`, active project remains `daily-gainers-market-opening-end-to-end`. Original source is pinned `f0fb2e44e00e3141a2673a4f6955af47768e5ce9`, and original A/B acceptance unchanged. The 20-stock coherent-stage research workflow remains commit `e3a6c12c274d4ef474966b9c8185b605540e529d` for original validator CLI compatibility; its push-run ID is **still not independently available**. An attempted read of GitHub Actions web page was disabled and available browser session was unavailable; do not represent combined-status empty as CI outcome.

Direct GitHub Connector fetch of frozen 20261013 raw, news, facts and AI files established all four have exact **25 same-code rows in the same original source order**. This independently checks the core order precondition for provisional 20-row staging and avoids speculative sorting.

Independent read of original 7-scene published `video_scripts/daily-gainers/20261013.json` revealed stock count mentions in **scene 1 and scene 2**, requiring rewritten spoken count and scene text for the 20-stock view. Scene 6 also contains “六百二十五張” (a lots count), which is not an “二十五檔” stock-universe claim. Original scenes did not reference known excluded codes in `stock_codes`; nevertheless all 7 scenes need independent editorial/source reassessment before any original media is reused.

New bounded research-only implementation:
- `scripts/audit_mvp10_20261013_script_invalidation.js` created `96a47875c53897447e8ba0210ac2fe3cc0cea214`, fixed stock-count regex `7605dc0487c6ac3bc8571b610e5fd0e95e12c7fb`, detects original stale 25-stock count phrases and excluded stock references, emits per-scene explicit TTS/SRT/MP4 invalidation with `render_authorized=false`, requires 25 original and 20 provisional identities.
- `tests/audit_mvp10_20261013_script_invalidation.test.js` at `79499ca91d6b72ed70b02b30949ab412b1ad8def`: positive/negative cases, prevents mistaking “六百二十五張” for “二十五檔”.
- `.github/workflows/research-mvp10-20261013-stage.yml` integrated the true pinned 20261013 script, test, per-scene audio/caption invalidation artifact at `831aa006c40b6ff17ce750f8e05f397f0da7a4b8`; then added a strict summary `[1,2]` and seven-scenes-invalidation CI assertion `f34265f4a84c59c967cfd0e3945fe715f998ab36`. Research workflow continues with `contents:read`, isolated branch only, no persisted credentials, no release/YouTube automation.

These changes were pushed to **research branch only**. Test source and workflow have been fetched back. No actual post-change CI run/job ID is available through the present Github connector; no new CI PASS, no newly accepted 20-stock final/complete, and no newly rendered complete MP4 may be declared. Prior 20261013 complete 25-stock research MP4 evidence remains a historical research artifact only, not approved for reuse after changing stock coverage.

**Next priority:** Obtain evidence for new read-only coherent-stage CI; then combine the 20 verified source rows with editor-reapproved non-causal AI analysis, rebuild `final/complete` via unchanged original builder/validator, regenerate matching seven-scene oral/display Master and complete 1080p video/SRT/thumbnail, check actual artifacts. Do not regress to generic classification or HTTP evidence research. Private nonpublic YouTube pilot still owner-authorization-gated.

research_progress_status=PROGRESS
phase_status=MVP10-A INCOMPLETE
b_eligibility=NOT_ELIGIBLE
next_action=verify coherent-stage isolated CI and complete reauthored 20-stock semantic source for actual full render
plan_changed=NO
publication_authorized=false

## 2026-11-02 Prompt A — actual 7-scene 20-stock research narration draft wired into read-only CI

Fresh GitHub governance/routing and original market-summary builder reviewed; current known main `79df47fbdd08ea8351e12329bc0c1bbb8d375208`, pinned actual 20261013 main data `f0fb2e44e00e3141a2673a4f6955af47768e5ce9`. Original market-summary builder computes `preliminary` absent exact date-correct final published analysis and is intentionally unchanged. Original raw/news/facts/AI ordering (25/25 identical before filtering) confirmed by four independent file reads.

Research branch commits:
- `277969c9998fe42df9ab89c0d6418b5bda4670ed`: added `scripts/draft_mvp10_20261013_20stock_script.js`. This is a substantive, evidence-bounded, **seven-scene dated spoken narration draft** created solely from the 20-stock isolated staged raw and facts; describes cross-checked foreign/investment-trust/margin/broker direction for selected stocks (天二科技, 國喬, 台塑化, 東聯, 玉晶光, 中揚光, 南亞, 閎暉), and replaces unsupported company-causation narration with explicit uncertainty. Explicitly uses **20 candidate** count and re-derived gain buckets, not legacy 25. Output is separate research draft script and editorial-review JSON, both require source/editorial and historical security-type review. It does **not** mark `final`, pass the original video validator, claim new TTS/SRT/MP4, or authorize upload.
- `d34edd351c0155bd7d2ca8cd5f799057a0cbae93`: tests guard missing source, wrong/false staged permission and reject invalid input.
- `a17bcafc6d8438319700b21a5bb2db08d9ddb1fb`: wire draft generation/tests and date-relevant review artifact into `.github/workflows/research-mvp10-20261013-stage.yml` (read-only on isolated branch, pinned immutable upstream, no YouTube or public actions). Validate source count, 7 scenes, 1100–5500 draft narration characters and release flags. Retain the research JSON draft and review report. Research workflow still runs original market-summary builder/validator on separate 20-stock stage and insists **preliminary**, not fake final.
- Remote GitHub file blobs independently re-fetched and confirmed: draft code `1ef46fff4dec9c127ac50f50531974591eaaff01`, test `ce3f8c37335733f2c6817462b500c6949a0c416d`, workflow `3e700b6913e628c9eb4d9ea133dd57bbd33bddc6`.

**Validation caveat:** GitHub Connector exposes PR-linked workflow lookup but not push-run listing; combined-status API did not return checks. The CI job/log/artifact and actual runtime output for this new 7-scene stage remain **UNVERIFIED**, and no new artifact is asserted as generated. The draft code may still need fixing from actual CI. Previous 25-stock local full movie is not a newly generated, historically classified, current 20-stock output.

**Immediate next action:** retrieve real isolated research CI Job Log/ZIP for the new 20-stock stage and original validator; fix actual failure if present. Then conduct source/editorial review of all 7 candidate scenes, approve a truthful 20-stock complete unified analysis rather than relabeling the original 25-stock analysis, independently meet original unchanged market-summary and video validator, and generate/QA complete 1080p YunJhe +15% two-track TTS, Dashboard, VTuber, hardburned zh-TW subtitles, SRT, thumbnail and manifest. The 2026-11-08 owner goal remains at risk; prioritize media output, not unrelated Receipt micro-research. Prompt B NOT_ELIGIBLE, formal publication and YouTube upload locked, main unchanged, plan_changed=NO.

research_progress_status=PROGRESS
phase_status=MVP10-A INCOMPLETE
next_action=validate actual seven-scene draft CI then source-certified final analysis and full isolated render
publication_authorized=false

## 2026-11-02 Prompt A — original full-video validator fail-closed execution wired

The latest globally active project remains `daily-gainers-market-opening-end-to-end`, latest known main `79df47fbdd08ea8351e12329bc0c1bbb8d375208`. The 20261013 20-candidate staging and 7-scene research draft were already committed but their actual push CI status cannot be discovered through the available GitHub connector (only PR-triggered workflow run listing, empty combined statuses). Current web access to the GitHub Actions workflow URL returned DisabledError. These constraints MUST NOT be interpreted as run failure/success.

An actual functional verification gap was closed in existing research-only `.github/workflows/research-mvp10-20261013-stage.yml` via commit `759a6c36e739954dba6946847078796c632065d4`:
- Sparse checkout includes the **UNCHANGED ORIGINAL** research-branch `scripts/validate_daily_gainers_video_script.js` with its brand opening and DR security gate dependencies. All copied into the temporary 20-candidate workspace only.
- The generated seven-scene draft JSON is staged in temp `video_scripts/daily-gainers/20261013.json`. The original market-summary builder and original summary validator are invoked first, intentionally generating an unapproved `preliminary` market summary for 20 stocks.
- The original video script validator is then actually executed as a shell command and **must exit nonzero with exact message `summary not final/complete`**. An accidental PASS, or failure for an unexpected reason, fails the CI Job. Captures raw validator stderr/stdout in the retained artifact `mvp10-20261013-original-video-validator.log`.
- Research workflow remains read-only, pinned date/branch, no production, no YouTube, no main mutation, no release permission.

The modified workflow was independently fetched from remote GitHub, blob SHA `49285173efd6a351320c96bfc0f99bf7ead7c164`; its three original validator dependency paths, expected rejection message and retained log path were text-verified. **New CI run/job/log actual execution is still UNCONFIRMED; do not claim validator execution PASS until the runner evidence is available.**

Next actual delivery step after verifying this CI: source/editorial certification of the 20-stock coherent analysis, original strict `final/complete` market summary, then actual validator acceptance with the rewritten scene script and a complete isolated 1080p Render-only MP4/SRT/thumbnail/manifest/QA. The existing full film covers 25 mixed securities and cannot substitute. Freeze B and YouTube until owner action.

research_progress_status=PROGRESS
phase_status=MVP10-A INCOMPLETE
next_action=verify newest isolated CI negative original video-validator result, then deliver 20-stock complete analysis and real media
plan_changed=NO
publication_authorized=false

## 2026-11-02 Prompt A — real fixed-source JavaScript executions (not a claimed Actions CI pass)

Repository routing, owner policy and active `goal-v3/MVP-10DAY-v1` were rechecked. The read-only public GitHub Actions URL and the GitHub API workflow-run endpoint were unavailable to the web tool; GitHub Connector `get_commit_combined_status` returned `statuses:[]` and PR-filtered workflow lookup returned no PR runs. **No new Actions run ID, job or artifact evidence was obtained. No new CI PASS is claimed.**

New independent **executable V8-isolate smoke tests** in this turn, with the **exact research-branch source text fetched from GitHub** and actual frozen `f0fb2e44e00e3141a2673a4f6955af47768e5ce9` 20261013 source data, using in-memory Node filesystem/path adapters:
1. Executed the original `stage_mvp10_20261013_candidates.js` function against all four genuine 25-row upstream files and genuine three TWSE classification CSVs. It produced **four 20-row staged files with identical 20-code order**, excluded codes **6645, 7730, 9103, 6924, 1312A**, `render_authorized=false`, and no false final status. This is function execution with mocked filesystem and stubbed hash (not a real SHA-256 receipt), not actual Node CLI or GitHub runner execution.
2. Executed the exact original research `draft_mvp10_20261013_20stock_script.js` function with the real filtered raw/facts sources and the legitimate research staging flags. Generated **7 real populated scene texts**; narration lengths by scene `177,169,183,184,175,179,203`, total **1,270 chars**, all intended codes covered by staged facts. Result `editorial_approved=false`, `render_authorized=false`, no TTS, SRT or MP4 created.
3. Executed the original unmodified `build_daily_gainers_market_summary.js` business function from pinned upstream main with stage payload and emulated filesystem/contract dependencies. Returned **status=`preliminary`**, `summary_stage=`news_theme`**, 20 breadth, `coverage.overall=partial`, news/facts complete, analysis missing. The original `validate_daily_gainers_market_summary.js` exported validator independently returned **true** on this generated summary. No `final` asserted, previous raw source missing in the emulated isolated checkout as expected.
4. Executed the original unchanged research-branch `validate_daily_gainers_video_script.js` against preliminary test inputs using emulated filesystem. It correctly threw `summary not final/complete` (negative/fail-closed). The actual full 20-stock CI job will independently verify this exact failure.

Durable CI regression added to `.github/workflows/research-mvp10-20261013-stage.yml`:
- Commit `5a1e490d64007ac8ecbb09bdbbb98af9fff0e46e`: assert the authentic 20261013 draft contains exact **6834 margin decrease 1831 lots**, **1312 margin increase 9413 lots**, **6668 foreign net sell 845 lots**, **6505 trust net buy 15100 lots**, and no English `percent`, repetitive `百分之百分之` or stale `25檔強勢股` narration. Also assert original summary stage news_theme/news/facts complete, analysis missing and no source-lineage published analysis.
- Corrected regex escaping in commit `a91eecce70a6f70624b3463938ccde55146b501c` so English `percent` token check matches words as intended.

This is a substantive new **function-level runtime verification** of real source data plus stronger future CI acceptance, with an explicit distinction from a real Actions Job Log/ZIP and no fake source or release approval. No main/production/listener/YouTube writes, no original validator weakening, frozen B still ineligible.

Next: Obtain GitHub runner evidence for the new research pipeline. Continue real editorial verification of the 20-stock claim source and advance to an accepted final/complete source bundle before original positive video validation or full 1080p Render-only with regenerated audio and captions. Owner's 2026-11-08 MVP goal remains at risk.

research_progress_status=PROGRESS
phase_status=MVP10-A INCOMPLETE
next_action=verify actual research runner logs and complete source-certified final analysis for full 20-stock render
plan_changed=NO
publication_authorized=false

## 2026-11-02 Prompt A — complete per-stock deterministic 20 candidate analysis produced in research

New current observed main HEAD `3077d25c814bb03bc456d23b227814f034224d59`; source identity remains pinned to `f0fb2e44e00e3141a2673a4f6955af47768e5ce9`. AGENTS.md, owner policy, routing and frozen MVP10 pair rechecked. GitHub Actions website could not be opened via web (DisabledError). The GitHub Connector's combined commit status returns `statuses:[]`, not CI PASS or FAIL. No new actual workflow run ID or artifact was verified.

This Prompt A **created executable 20-stock full-row research analysis candidate**, eliminating repeated classification investigation without weakening original validators:
- `scripts/draft_mvp10_20261013_20stock_analysis.js`, commit `98804fa87e65f10695ad5b9df10d1f3e7d5ebed4`. Consumes dated `20261013` isolated staging raw/facts and strict 20-stock identity/code-order and source-price agreements. Produces `20261013-20stock-analysis-candidate.json` (all 20 rows, deterministic price, foreign, trust, dealer, margin, broker and technical signals; explicit ambiguous/null handling, follow-up, original contract-shaped rows) plus `20261013-20stock-analysis-review.json`, with no original 25-stock AI catalyst narrative inherited; all 20 `cause_type=unknown`, `evidence_strength=none`, `confidence=low`, `sources=[]`, `independently_verified_causal_claim=false`. Candidate is in **a separate temp review directory, NOT `data_daily_gain_over_5/analysis/20261013.json`**, has `research_only`, `summary_final=false`, `render_authorized=false` and `publication_authorized=false`.
- An executable V8-isolate smoke test with the *actual fetched research source* and *actual pinned 20261013 upstream raw/facts filtered to 20* successfully produced 20 candidate rows and a review bundle, 0 promoted causal claims, and no final/permission flags. Original SHA values were stubbed in this in-memory test and are not genuine receipts. GitHub runner will calculate actual SHA-256 hashes with `node:crypto`.
- `tests/draft_mvp10_20261013_20stock_analysis.test.js`, commit `b953cf785790e63fa7275dfc7acb9160078d43d1`, tests reject missing source and premature final/incorrect scope.
- `.github/workflows/research-mvp10-20261013-stage.yml` updated at `1a66929a6f237a78d42d7e5b49b11bd6ad112f4e` to run new tests and source-derived research candidate generation and assert all 20 have no promoted cause or render permission; upload original review JSON with research staged inputs. No privileged tasks, no YouTube upload or main write. Fixed actual output-directory collision in `bf12c8405db2aff98ae4baba623b1d76686d580a`: CLI safely creates its own new review dir; CI must not pre-create it.
- Previously independently executed original market-summary builder/validator business functions with actual 20-stock data correctly produced `preliminary/news_theme` and passed original summary validator. Original video validator independently rejected with `summary not final/complete`. These are **in-memory environment function tests**, not claimed GitHub CI PASS.

Critical distinction: This newest candidate is an auditable complete **research input** for editorial/source review, **not yet a source-certified published final analysis**. Its original contract-shaped fields could cause the old builder to output `final` if copied prematurely into the published analysis path, therefore **NEVER copy it into `data_daily_gain_over_5/analysis/20261013.json` without full editorial and source/ordinary-date approval.** Original builder/validator should remain unchanged and release locks closed.

Next: verify actual research CI run Job Log for `research-mvp10-20261013-stage.yml`, then source/editorial review of 20 stock claims and 7 scenes; after certified final/complete, re-run original positive validator on coherent target-date 20-stock data and full isolated 1080p Render-only. Do not reuse the historic 25 mixed-security movie/voice. Owner's 2026-11-08 MVP deadline at risk. B ineligible; all production and YouTube remain closed.

research_progress_status=PROGRESS
phase_status=MVP10-A INCOMPLETE
next_action=verify actual 20-stock candidate CI and complete final source certification before original positive video validation and full render
plan_changed=NO
publication_authorized=false

## 2026-11-02 Prompt A — actual preserved source-tied 20-stock candidate JSON, not merely generator

At this invocation current remote `main` = `3077d25c814bb03bc456d23b227814f034224d59`; pinned original source remains `f0fb2e44e00e3141a2673a4f6955af47768e5ce9`. Owner-approved `goal-v3/MVP-10DAY-v1` active task, A INCOMPLETE, B NOT_ELIGIBLE. Web Actions page and API URL not accessible. `fetch_commit_workflow_runs` only checks PR-associated runs and returned none; `get_commit_combined_status` returned empty. **No post-change push-run ID/log or CI PASS can be asserted.**

Substantive advancement: **source-derived outputs committed to the RESEARCH branch for immediate review**, not just a code generator:
- `data_research/m5/mvp10-20261013-research/20stock-analysis-candidate.json` commit `6e5a0f99d8b9879f70fe24758f11f7a61f080ebe`; 20 fully populated deterministic analysis entries (date-tied prices, foreign/trust/dealer, financing, broker, technical; no inherited issuer causes, all `cause_type=unknown`, `evidence_strength=none`, `sources=[]`, `editorial_approval=false`, `render_authorized=false`, `publication_authorized=false`). It is NOT `data_daily_gain_over_5/analysis/20261013.json`, NOT `final`, and does not certify 20261013-effective ordinary-share type.
- `data_research/m5/mvp10-20261013-research/20stock-seven-scene-script-draft.json` commit `aaa125a795acadee4481b69be456baf41f0fa30a`; seven complete research narration scenes based on the same 20-stock staged facts, `editorial_approved=false`, media/release flags false, NOT official video script path. All seven oral segments remain subject to independent editing and original validator; no TTS/MP4 produced.
- Commit `9c30195958ee9c695af257940b91f11cd6bad8bd` modified isolated read-only `.github/workflows/research-mvp10-20261013-stage.yml`: sparse-checkout both committed research JSONs, re-generate both from pinned sources, and run byte-level `cmp` against the committed artifacts, fail closed on drift, in addition to existing original summary and video-validator preliminary rejection checks. Paths now also trigger the research CI on research-only commits. No main, upload, Pages, credential, or release side effect.
- **Independent current-turn in-memory V8 execution** of both exact remote generator functions using the actual frozen 20261013 raw/facts (20 eligible entries after exclusion) and simulated Node fs confirmed JSON `JSON.stringify` identical to **both actual newly committed remote JSON files**, counts 20 and 7 respectively. They were re-fetched via GitHub Connector: analysis blob `9b08d1feee81d80387c160532c44e1c4eecd1fad`, scenes blob `d7478e0acf6d6e83cd47f6121f98518250c479e0`; workflow blob `36dfd72dae566e08390b73362b50a5d4a032bb49`. This is a substantive reproducibility check with *in-memory mocked file IO*, **NOT** actual Actions CI `cmp` or real SHA256/provenance certification.

NEXT: Access real research CI run/job logs via user's Actions workflow view if connector does not expose push runs; then review 20-stock source/issuer claims and establish accurate date-effective common-share classification. Produce approved coherent `final/complete` for 20-stock path only after review; pass unchanged original video validator positively; render genuinely new complete 1080p YunJhe +15%, Dashboard/V4, VTuber, burned Arabic display subtitles/SRT, QA and thumbnail. Do not present existing 25-security prior 1080p MP4 as the 20-stock accepted full movie. No Youtube upload until separately authorized. Keep frozen B, no original A/B lowering; 2026-11-08 MVP remains at risk.

research_progress_status=PROGRESS
phase_status=MVP10-A INCOMPLETE
next_action=check actual isolated CI and pursue approved final 20-stock semantic source followed by full video
plan_changed=NO
publication_authorized=false

## 2026-11-02 Prompt A — actual isolated 1080p media preview entry, first direct end-to-end render attempt

Current observed `main` HEAD `3077d25c814bb03bc456d23b227814f034224d59`; original `goal-v3/MVP-10DAY-v1` / A/B unchanged. Frozen main factual 20261013 pinned `f0fb2e44e00e3141a2673a4f6955af47768e5ce9`. GitHub commit status only returned empty statuses and available connector cannot enumerate push-triggered Actions runs; no newest Run ID/log/QA has been obtained. **No claim of actual GitHub CI green or completed MP4**.

This turn deliberately moved from repetitive provisional analysis to a **full read-only media rendering attempt** using two real, committed date-tied 20-stock research JSON artifacts:
- `scripts/research_mvp10_20261013_preview_plan.js`, commit `11c6f9c0eb9b282769e258e7dd397c76c01efbee`, reads the 20-stock analysis candidate and seven-scene narrative draft in `data_research/m5/mvp10-20261013-research` and constructs seven honest **1920×1080 SVG slides**, `output/daily-gainers-video/20261013/plan.json`, and explicit `research-preview-boundary.json`. This plan is **NOT** a published `video_scripts/daily-gainers/20261013.json`, not an accepted summary, and does not invoke or weaken the original final/complete gating workflow. Every slide displays a research-only no-publication warning.
- `tests/research_mvp10_20261013_preview_plan.test.js`, commit `ed6128185783075da94f77d14e5805f404d41831`, checks all seven slides, privacy/no release, and rejection of trusted source/invalid stock references.
- An isolated V8-isolate in-memory execution of exact fetched `research_mvp10_20261013_preview_plan.js` with both **actual committed JSONs** confirmed successful construction of seven scene SVGs, 1270 spoken chars, research `plan.json` and explicit publish-lock evidence. **This is an executed function with mock fs, not a rendered binary video**.
- `.github/workflows/research-mvp10-20261013-preview.yml`, created at `aae254aeabea32eb01f1bca8c44cd3d43baa0a88`, runs on push **only to `research/daily-video-mvp10-a-20261029`**, `contents: read`, checkout `persist-credentials:false`, no YouTube credentials/actions or production jobs. It executes Node preview guards, installs FFmpeg, librsvg, CJK fonts and TTS dependencies, forces `edge-tts==7.3.1`, `zh-TW-YunJheNeural`, rate `+15%`, validates seven genuine EdgeTTS WordBoundary scene receipts, builds VTuber mouth intervals, reuses unmodified `scripts/render_daily_gainers_video.js` to create complete 1080p research MP4, then reuses unmodified `scripts/build_daily_gainers_srt.py` for aligned zh-TW SRT, performs video QA and extracts thumbnail. Captures research media/plan/manifests/QA/MP4/SRT as a 14-day artifact, including partial evidence on failure. No fallback TTS falsely reported as YunJhe; actual engine, boundaries and duration must pass.
- `53b69babca526d149cf9ad76b8a5a13a20ff6c9a` amended this workflow to **hard-burn the actual zh-TW SRT captions into the preview MP4** with FFmpeg (not just external SRT), compare before/after video duration and SHA-256 and record `subtitle-burn-evidence.json` in the CI artifact. This is research rough-cut only; original MP4/QA/media accepted A/B remain unaffected.

**Critical provenance and acceptance boundary:** the new media entry is a clearly visibly watermarked **research-only rough-cut** derived from 20 provisional stock candidates and unapproved narration. This is intentionally NOT the frozen original final/complete positive acceptance, source-date security certification, or publishable 2026/10/13 production video. Even if its new CI renders successfully, `MVP10-A` must remain INCOMPLETE until source/editorial review, original positive validator, full final film QA, and separate owner permission for private YouTube upload. No main/production schedules, secrets, publication flags or original A/B were altered. Watch potential external TTS WordBoundary failure or render duration; do not claim PASS without job logs.

Next: retrieve `research-mvp10-20261013-preview.yml` run/job logs and actual MP4/SRT/QA evidence; if real job fails fix the precise failure; then complete editorial and target-date stock-category approval, regenerate final-approved source master and real accepted complete movie. Keep Prompt B NOT_ELIGIBLE. Delivery goal 2026-11-08 remains at risk.

research_progress_status=PROGRESS
phase_status=MVP10-A INCOMPLETE
next_action=verify actual full 1080p preview workflow and fix real failing media stages then original positive source acceptance
plan_changed=NO
publication_authorized=false
