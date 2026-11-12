# MVP10-A R2 Fish Render Successor — Change Proposal v1

Status: Owner-approved for versioned registration; Prompt A not started.
Owner approval: 2026-11-12 — “yes，批准上述 Fish 版本化後續 pair”
Repository: EasonLiu0913/stock_data
Registration base: remote main df449190c0834b47f00db501af4847e38543a324
Active project: daily-gainers-market-opening-end-to-end
Goal: goal-v3/MVP-10DAY-v1
Successor phase: MVP10-A-R2-FISH-RENDER-SUCCESSOR-R1
Predecessor round: MVP10-A-R2-INCLUSIVE-ELIGIBILITY, whose Prompt A remains incomplete at WAITING_TTS / render-provider mismatch.

## Purpose and evidence

The owner approved a versioned successor pair because the immutable MVP10-A-R2 pair requires actual YunJhe TTS at +15%, while current main's only date-scoped Render-only workflow consumes the Fish Audio checkpoint. The original R2 pair cannot be silently edited, and Fish output cannot be recorded as YunJhe evidence.

Current date-specific durable inputs on main:
- TWSE source list 20261104, blob c54f39112e957a672ddb4725e3d8d6338eaf5c87: 44 rows, all >=5%.
- R2 candidate blob f690c703058a4367ac1f619dd786d61f9d55eab0: complete 44/44 unique source coverage.
- Official opening blob 3578047ff03548e2bcb65d908228e9753deb434b, scope TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN.
- Facts blob 75e0573aa2fb394712f40cb9b115096b3e136c07; News blob c31055e4c0f3e60899be5e8e4fe9358c923190a6; AI v3 blob 24cf09ade6b98488b792aebc5036db9240c58a30; Market Summary blob 5560810319b843c1b5e57c3ddbf009ff51946bc4.
- SEO input blob 273b67878d52b3abbb10bd69c48025c953a18383 references the exact raw/Facts/News blobs.
- Fish checkpoint branch tts-audio-pending-20261104, commit 8f79344b537b6900fc382a42f85142153c9d9128, manifest blob df2fc0a7ae7cf98d41df8ca42860fa16907b9e30: target date 20261104, 17/17 successful scenes, script SHA-256 de2ea3550050ad5a8ec1d5b988fbe91b9344ce98cdebe74272ee4cd7678546f3, voice fish:e7af89da8abc4fbdacd9a10ab9881933, rate 1.15.
- Historical YunJhe Render run 42472929875/job 128707732752 remains a NoAudioReceived failure; no MP4/SRT/visual QA was produced. Preserve it unchanged.

## Sole prospective acceptance substitution

For this successor only, use the current-main Fish checkpoint and provider identity instead of the predecessor pair's YunJhe TTS requirement. Require exact same-date frozen plan and script SHA, complete scene coverage, MP3 and WordBoundary hashes, Fish voice/reference/model/rate/pipeline identity, and fail-closed Render-only consumption.

All other predecessor R2 eligibility and production-evidence gates remain unchanged:
- TWSE only; date-matched candidates across supported instrument types with source-faithful labels and independently supported gain >=5%.
- Preserve raw 44-row source list; no ordinary-common-only exclusion, no TPEx expansion, no ticker-shape inference.
- Opening breadth remains TWSE_MI_INDEX_OFFICIAL_STOCK_COLUMN.
- Reuse verified facts/news/AI/market summary/official receipt by exact identity; no repeated 44-stock research or source rewrites.
- Formal script, narration/news attribution, opening duration, thumbnail, MP4, SRT, burn proof, visual QA, provenance and source/hash checks remain required.
- The private-upload permission gate remains exactly as in the predecessor R2 pair. Missing authorization is WAITING_OWNER/WAITING_PERMISSION, never PASS. No upload is authorized.
- YouTube upload/scheduling/public release, release-lock changes, Pages deployment and checkpoint deletion remain prohibited.

The original R2 proposal/pair, prior WAITING_TTS state, YunJhe failure, run IDs and artifacts are historical and immutable. This proposal does not retroactively turn any result into PASS.

## Registration and stop boundary

Register this proposal and its paired A/B on remote main before Prompt A. Update the existing canonical handoff and Task State; keep the globally active project unchanged. Registration does not run Prompt A, dispatch a workflow, synthesize audio, render, upload, publish, or promote another phase automatically.

After registration, a separate owner-issued promptA is required. Prompt B runs only after the same-round A completion contract is durably met and a separate owner promptB arrives. The ordered next steps remain: complete this eligibility/render successor; then the registered TTS phase Render-only threshold; then genuine >3-missing-scene live evidence only when a real eligible date exists.
