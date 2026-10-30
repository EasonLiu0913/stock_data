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
