# MVP10-A — 20261008 private YouTube pilot preflight (research only)

Status: **NOT AUTHORIZED / NO YOUTUBE ACCESS / NO UPLOAD**. This document is not an execution approval. Never change main or enable research job lock based on this document alone.

## Fixed candidate
- Target date: `20261008` (TWSE only).
- Render run: `41002179152`; successful artifact: `12953454424` (`daily-gainers-video-20261008`).
- Artifact verified: MP4, SRT, metadata.json, qa.json present; QA date `20261008`; 342.330667s; 9 scenes; SRT 97 cues, maximum 30 characters per caption line.
- This artifact has **NOT** been uploaded to YouTube in this research task.

## Minimum read-only evidence before pilot
1. Identify the intended authenticated YouTube channel ID (not a guessed channel) using a narrowly scoped read-only connection **only after separately approved access**.
2. Query owned videos/uploads and relevant existing receipts for the candidate date, rendered title, and source metadata. Record UTC query time, channel ID, API resource and query, matching video IDs, privacy status and explanation of the match. A search with zero results is NOT proof of absence. If unresolved, **block** until human review.
3. For each possible existing candidate, read `videos.list(part=id,snippet,status)` using owner-authorized access; confirm `status.privacyStatus`, owner/channel, and whether that video corresponds to the candidate. Never claim all private videos were searched via public search alone.
4. For any existing video ID with `video_created` receipt, read `captions.list(part=id,snippet,status,videoId=...)`; capture matching `zh-TW` track ID, status and timestamps. An upload API 200/409 is not proof captions finished processing.
5. Store immutable/redacted proof (no OAuth tokens, private URLs, raw credentials) keyed to date, channel, candidate hash, CI run, video ID, and retrieval time. If read access fails or evidence conflicts: fail closed.

## Pilot decision (separate approval)
A *new explicit owner approval* must identify exactly: channel, candidate date `20261008`, artifact ID `12953454424`, **private-only** visibility, whether the approval allows one MP4 upload plus caption and thumbnail, and what to do if evidence shows a preexisting video. Default: **no upload**. A chat instruction to prepare or inspect is not authorization.
- First-upload path allowed ONLY after verified absence, approved channel, required media QA, credential scope checks, one-run concurrency lock, receipt checks and explicit approval. Preserve a durable intent/attempt record prior to upload where feasible, to mitigate unknown outcome if upload succeeds but receipt commit fails.
- Immediately after YouTube confirms `private`, write a **durable `video_created` receipt** with immutable video ID. Receipt commit failure: stop, reconcile YouTube first; NEVER blind-retry MP4.
- Retry with durable `video_created`: captions only; durable `complete`: no action; absent or invalid receipt: block pending reconciliation.
- Set `complete` only after independent read-back confirming same video is private AND `zh-TW` caption status acceptable. Store verified timestamp/evidence, compare-and-swap receipt update.
- Public/scheduled visibility or touching `main` or formal release requires a separate explicit approval; NOT part of this pilot.

## Critical blockers / no-go today
- No owner-authorized YouTube read-only evidence or confirmed channel/duplicate-video decision.
- Private-upload and caption completion are **not** validated against real YouTube; signed-off test-only env flags are not independent proof.
- Existing legacy `retry-upload-daily-gainers-video.yml` in research is **job-level locked** (`if: ${{ false }}`); do not remove.
- Current first-upload shell path uses a date-scoped environment attestation rather than verified YouTube API evidence; cannot use this alone to approve upload.
- Existing production retry workflow on main remains unchanged, and historically uploads MP4 before writing a complete receipt; NEVER dispatch it for this pilot.
- A GitHub receipt write is not atomic with YouTube upload; reconciliation after unknown outcomes remains mandatory.
- The existing no-credential CI validates fail-closed routes, not real API permissions, actual YouTube privacy or caption processing.

## Shortest safe next checkpoint
Owner grants **read-only YouTube inspection only** (no write permission). Inspect channel, duplicates, existing captions and collect evidence. Review the resulting go/no-go with owner; seek separate single-video private pilot consent. Until then: research-only, no YouTube credentials, no upload, no main or release lock changes.

## 2026-10-31 MVP10-A V4 alignment checkpoint (research branch only)

- YouTube read-only CI #41026509106 attempt 3 PASSED OAuth/channel and 7-video inventory GET; channel UCL9fFDhPlFZDTu2AeydDRBw. This is NOT a date-specific duplicate absence proof: previous check searched only literal title `20261008`, whereas actual candidate title begins `10/08`. The seven item identities/titles must be independently reconciled before first upload.
- Render CI #41002179152 Artifact #12953454424 is a real 20261008 MP4/SRT/QA baseline, not final V4 editorial PASS. It used an obsolete 3-line opening and embedded obsolete CC prompt in the card generator.
- Scoped branch-only changes: `scripts/daily_gainers_brand_opening.js` now enforces four approved V4 sentences, upgrades old three-line narration once, rejects conflicting/obsolete CC narration; `scripts/build_daily_gainers_video_package.js` removes obsolete CC visual; `tests/daily_gainers_video_date_gate.test.js` adds V4 positive and negative assertions. Last commit `8ca0bb94943c82540cc7f8515b80ccf478ebc078`.
- GitHub remote readback confirms all three changes. **No post-change CI or regenerated MP4/SRT has been validated**, so A is INCOMPLETE and B is NOT ELIGIBLE. No upload authorization. Existing legacy artifact remains immutable and is not replaced by an unverified new render.
- Next bounded step: run safe research-only date-gate and render verification at the new SHA, inspect actual resulting MP4/SRT/visual QA; compare research D4 and M8VIS source evidence without bypassing their review/authorization gates. Separately gather candidate-aware read-only YouTube duplicate evidence. Keep main, release and upload locks unchanged.
- research_progress_status: PROGRESS; phase_status: MVP10-A INCOMPLETE; plan_changed: NO.
