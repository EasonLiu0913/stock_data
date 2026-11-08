# TAIWAN STOCK Daily 5% Video — MVP10-A / MVP10-B Inclusive Eligibility Pair R2 v1

Status: **Registered and frozen before execution. Prompt A is eligible but has not started.**

Owner-approved change proposal: data_research/m5/change-proposals/MVP10-A-INCLUSIVE-ELIGIBILITY-CHANGE-PROPOSAL-v1.md  
Registration main before pair: 55c95fba5d4ff71e851a24ba4a9ba2bccfea5db5  
Goal: goal-v3/MVP-10DAY-v1  
Project: daily-gainers-market-opening-end-to-end  
Round: MVP10-A-R2  
Target validation date: 20261104  
Original pair preserved unchanged: data_research/m5/change-proposals/DAILY-VIDEO-MVP-10DAY-PAIR-v1.md

## Governance and immutable history

- This is a prospective successor pair authorized for registration by the owner on 2026-11-08. It changes only the eligibility and opening-breadth contract described in the paired proposal; it does not rewrite the original pair.
- Original MVP10-A-R1 is preserved as WAITING_SOURCE and closed for future execution as SUPERSEDED_OWNER_APPROVED. It is not PASS.
- Original MVP10-B v1 and all historical R1/R2 failures and evidence remain unchanged.
- This pair was registered before its Prompt A. Prompt A and Prompt B below are immutable after A starts.
- This registration does not authorize YouTube upload, scheduling, public release, release-lock changes, Pages deployment, or automatic Prompt A/B continuation.
- No code, production workflow, or date-scoped media workflow is changed by registering this pair.
- One active global project remains selected by docs/agent-prompts/task-routing.json.

## Frozen R2 scope and acceptance changes

1. Keep the project TWSE-only. No TPEx expansion.
2. For dates under the owner-approved editorial policy v1.1, determine featured eligibility using the date-matched TWSE source and independently supported gain >=5%. Do not exclude a supported TWSE-listed candidate solely because it is a DR, ETF, ETN, or another covered instrument type. Accurately label the verified category and never describe funds/DRs as operating companies.
3. Do not infer classification from ticker shape or use a current live instrument page as historical proof. Use the date-matched source fields and only the minimum source evidence needed for featured candidates; a full historical common-stock master is not a gate for this round.
4. Use same-date official TWSE MI_INDEX 股票-column breadth, explicitly scoped as TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN. Do not call it common-stock-only breadth or rename it TWSE_COMMON_STOCK. Do not require an additional ordinary-common-stock breadth.
5. Reuse verified 20261104 Opening, official numeric Receipt, Facts, News, AI v3, final Market Summary, and the R2-passed private candidate by exact source identity/blob. Do not rerun the 44-stock research or overwrite source files.
6. Retain all other applicable same-date, source, unit, arithmetic, provenance, AI/news attribution, formal script, subtitle, thumbnail, media, and visual-QA gates. Use current main validators and schema; do not lower them.
7. Keep the raw 5% source list immutable. The eligible script count must match the date-matched source after applying only the registered TWSE and >=5% criteria, not a common-stock filter.
8. No generated formal script may be committed to video_scripts/daily-gainers/*.json while the upload orchestrator listens to that path. Use the isolated Render-only workflow's local materialization. Do not activate upload or publication.
9. Private YouTube pilot remains separately gated by explicit owner permission. Without that permission, do not upload; report WAITING_OWNER/WAITING_PERMISSION, never PASS. Public release remains separately prohibited.

## Prompt A — MVP10-A-R2 implementation

Continue project daily-gainers-market-opening-end-to-end in EasonLiu0913/stock_data.

Before work:
1. Read repository AGENTS.md.
2. Read docs/agent-prompts/goal-anchored-handoff-v3.md and canonical handoff docs/handoffs/daily-gainers-market-opening-end-to-end.md.
3. Verify current remote main, task-routing.json, Task State docs/handoffs/state/daily-gainers-market-opening-end-to-end.json, this pair, and that MVP10-A-R2 is still the active eligible round.
4. Recheck current workflow triggers and read permissions before any write or dispatch. Preserve all historical run and phase records.

Implementation, in order:
1. Re-read the exact 20261104 files and validators from current main. Reuse these identities unless a source mismatch is found:
   - Official Opening: data_daily_gain_over_5/market-opening-video/20261104.json, blob 3578047ff03548e2bcb65d908228e9753deb434b.
   - Official numeric Receipt: run 42231051247.
   - Facts: data_daily_gain_over_5/analysis-facts/20261104.json, blob 75e0573aa2fb394712f40cb9b115096b3e136c07.
   - News: data_daily_gain_over_5/analysis-news/20261104.json, blob c31055e4c0f3e60899be5e8e4fe9358c923190a6.
   - AI v3: data_daily_gain_over_5/analysis-ai/20261104.json, blob 24cf09ade6b98488b792aebc5036db9240c58a30.
   - Final Market Summary: data_daily_gain_over_5/market-summary/20261104.json, blob 5560810319b843c1b5e57c3ddbf009ff51946bc4.
   - Candidate: research_pending/daily-gainers-video-scripts/20261104.json, blob f690c703058a4367ac1f619dd786d61f9d55eab0.
2. Verify the 20261104 TWSE source list and date/price/change fields. Apply >=5% without an ordinary-common-only restriction. Preserve the 44-row raw input. Keep instrument labels faithful to the source; do not infer a category or cause that the source does not support. Reuse News attribution verification rather than repeating research.
3. If candidate script fields or categories fail the current formal contract, repair only the private pending candidate in research_pending/daily-gainers-video-scripts/20261104.json. Do not write an unverified candidate into formal video_scripts.
4. Run current materializer, official opening validator, formal script validator, News analysis/narration validators and the paired tests required by current main. Verify full eligible-list coverage, no duplicates, accepted scene/count/length bounds, 4 approved brand lines, 30–90 second opening target, narration-to-subtitle source parity, truthful causal attribution and closing summary.
5. Generate research_pending/daily-gainers-seo/20261104.json only from verified same-date sources after the eligible count and official index direction are fixed. Run the existing thumbnail builder/verifier. Inspect actual 1280x720 PNG/JPEG, 3px direction-colored frame, thumbnail text/count, safe area, source hashes and QA. Do not treat mock art as production evidence.
6. Before rendering, verify .github/workflows/daily-gainers-date-render-only.yml still uses an explicit date input, read-only permissions and no YouTube or Pages action. Confirm all required input/script/thumbnail gates pass. Do not rerun an old failed job with unchanged inputs.
7. If this session has a real authorized workflow-dispatch tool, trigger only the native date-scoped Render-only workflow for 20261104 after gates pass. A job rerun is not a dispatch. If dispatch is unavailable, report the exact workflow URL and required date input, mark WAITING_WORKFLOW, and continue any independent work; do not claim a render occurred.
8. Verify the real run/job/logs and artifact contents: playable 1080p MP4, external zh-TW SRT, actual YunJhe TTS at +15%, VTuber, 1080p list Dashboard, opening duration, subtitle parity/legibility, no visual occlusion, thumbnail, safety margins, QA, source/commit SHA and provenance. Run success alone is insufficient.
9. Inspect private-upload feasibility read-only. Do not upload, schedule, publish, alter privacy defaults, or unlock a release gate. If private-upload authorization is absent, mark WAITING_OWNER/WAITING_PERMISSION. Do not start Prompt B automatically.

Prompt A completion contract:
- A is not complete until the registered render-only outputs and all non-upload A evidence are durable and independently inspectable on the current remote main/artifact store, with upload status explicit.
- If required source evidence, actual dispatch capability, render artifacts, visual QA, or separate private-upload permission is missing, record the exact WAITING/BLOCKED state and next action; never claim PASS.
- Checkpoint the canonical handoff and machine Task State at a meaningful boundary. Re-read current main and verify every written path/blob/commit.
- Stop after A; Prompt B requires a new owner command.

## Prompt B — MVP10-B-R2 independent closeout

Run only after MVP10-A-R2's completion contract is durably satisfied and the owner sends promptB. If A is WAITING/BLOCKED or incomplete, report B_NOT_ELIGIBLE and direct the owner to promptA once the named dependency is cleared; do not execute A silently.

Independently:
1. Re-read AGENTS, Goal-Anchored Handoff v3, routing, current Task State, this exact R2 pair and latest main.
2. Verify the candidate universe is exactly the same-date TWSE >=5% source under this registered inclusive rule; validate date/price/change and accurate instrument labels. Confirm no TPEx expansion and no manual raw-list edits.
3. Recompute/verify source identities, official numeric Receipt, MI_INDEX breadth scope and exact official values/units. Confirm the opening is labeled TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN, not TWSE_COMMON_STOCK.
4. Independently inspect all formal validators, source-to-voice claims, complete eligible coverage, scene structure, four brand lines, 30–90 second opening, TTS, actual MP4/SRT, thumbnail, 1080p Dashboard, captions, safe area, QA and provenance.
5. Inspect actual run, job, logs and artifacts. Require the actual MP4, SRT, PNG/JPEG thumbnail, manifests and QA outputs; CI green or pre-existing artifact is insufficient.
6. Verify date-reuse, wrong-date, missing/invalid-source, unsupported-causality, subtitle mismatch, partial-render, duplicate-render and upload-trigger safety cases without invoking any YouTube workflow.
7. Preserve R1 WAITING_SOURCE/SUPERSEDED_OWNER_APPROVED and all prior R1/R2 outcomes. Do not rewrite historical failure or claim a historical round passed.
8. The original private-upload acceptance remains a separate gate. If the owner has not separately authorized one nonpublic test upload and the necessary credentials/visibility proof, do not upload; record WAITING_OWNER/WAITING_PERMISSION, not PASS. Public release remains prohibited.
9. Update and commit the canonical handoff/state with evidence, current main SHA, artifact/run/job IDs, hashes, pass/fail table, remaining roadmap phases, correct next command, automatic-continuation status, and plan-changed status. Independently re-read current main. Stop without auto-starting another phase.

## Stop and safety conditions

- Stop on unverified date/identity/price/change, missing official opening evidence, failed formal validator, source mismatch, unsafe trigger, incomplete artifact, absent dispatch authorization, private-upload permission, or public-release decision.
- Never invent source data, infer security category from a ticker, weaken validators, repurpose a run rerun as a dispatch, or call a draft PASS.
- Never trigger YouTube upload, retry-upload, upload orchestrator, scheduling, public release, Pages deployment, or release-lock change in this registered round.
- Do not use a PRIVATE test video to stand in for Render-only artifacts.
- After Prompt A, stop for explicit Prompt B. After Prompt B, stop; do not promote another phase automatically.
