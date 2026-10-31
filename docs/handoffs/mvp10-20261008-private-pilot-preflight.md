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

## 2026-10-31 MVP10-A post-V4 research render evidence

- Isolated workflow commit: `002aa831fcd4be3ccfab6610253adfc7e5a37b06` on `research/daily-video-mvp10-a-20261029`, Workflow `.github/workflows/research-mvp10-render-only.yml`. Its read-only checkout and render-only artifact steps contain no YouTube upload. No main/release change.
- **Actual Push CI recovered**: Run `41182709089`, Job `124483232656`, completed `success`. Prior commit workflow-run listing is pull-request-only and returned empty; run ID was recovered from the open GitHub Actions job URL and verified through GitHub Connector.
- **Important date distinction**: dispatch input was blank; workflow picked latest available dated script `20261013`, **not** golden `20261008`. So no new 20261008 V4 render is certified.
- Actual Artifact `13036325288` (`daily-gainers-video-20261013`); ZIP digest `sha256:fabeb1ca1464163dd072d5a5089c2c345f9527905a75de282c144bab86ab5ea6`, independently recomputed from downloaded ZIP. 12 entries include MP4, zh-TW SRT, QA, plan and metadata. MP4 SHA-256 `47b27163fc74289373eedaf311897b44b651af83430018a0b2f07be1b6d9a474`. ffprobe: H.264 1920x1080, duration 311.082667 s. QA: 7 scenes, 14.75 MiB.
- Independently inspected `plan.json` scene 1 narration and actual SRT: all four V4 fixed opening lines including `那麼我們開始囉。` are present. SRT has 91 cues; max 30 characters per caption line, none over 30; no old CC reminder in SRT. This is text/media-structure verification, NOT independent listening certification of actual four spoken lines, nor frame-by-frame M8VIS occlusion PASS.
- YouTube duplicate reconciliation remains unresolved: 7 existing owned videos read in OAuth CI `41026509106` attempt 3, but no candidate-aware video-title/date/video-ID inventory. No upload or captions API write.
- Research progress verdict `PROGRESS`; phase `MVP10-A INCOMPLETE`; `MVP10-B NOT_ELIGIBLE`; current blocker: independent 20261008 golden V4 render, D4/Market Master/M8VIS provenance and visual acceptance, owner-channel duplicate reconciliation, independent caption/privacy and owner authorization for any pilot. Next step: safe date-scoped 20261008 isolated rerender and inspect; do not treat 20261013 as 20261008 acceptance. Plan changed? NO.

## 2026-10-31 MVP10-A Golden 20261008 TTS failure and bounded diagnosis

- Date pin commit `f92a0045a07cf1174b8b4a4d35a42fc7cf7feb49` produced research Run `41183855354`, original Job `124486635969` FAILURE; one bounded rerun Job `124487078154` also FAILURE. Both confirmed date `20261008`, script/date/package/subtitle preflight PASS, then failed at the first Edge TTS scene with `NoAudioReceived` across four internal retries. No MP4/render QA was executed.
- Original run artifacts `13036560702` (5331 bytes) and rerun artifact `13035779454` (5328 bytes) are partial manifests, **not** usable MP4 proof. Preserve old successful `20261008` Artifact `12953454424` and successful newer cross-date `20261013` Artifact `13036325288`.
- 20261008 source first-scene narration has 204 chars before opening; successful 20261013 source first-scene narration has 314 chars before opening. **Do not infer length is the root cause.** The cause is not yet confirmed as source-specific versus transient upstream availability.
- New isolated, bounded no-upload diagnostic Workflow `.github/workflows/research-mvp10-tts-diagnostic.yml` at commit `1d82b87475cbe37c169b3f334e5603f057de476c`: two probes, same `zh-TW-YunJheNeural` +15%, `edge-tts==7.3.1`, `WordBoundary`: one short greeting and the actual V4 + 20261008 scene 1. Each is limited to 25 seconds, no credential/YouTube, no media artifact, no production trigger. Workflow code readback confirmed; new Push Run ID not independently verified yet.
- Stop repeated full rendering until diagnostic evidence is available. If both probes fail investigate service connectivity/voice; if only scene fails investigate source-specific content and bounded sentence-level synthesis without losing WordBoundary/time semantics. Preserve fail-closed output and all release locks.
- research_progress_status: PROGRESS; phase_status: MVP10-A INCOMPLETE; Prompt B: NOT_ELIGIBLE; plan_changed: NO.

## 2026-10-31 MVP10-A bounded Edge TTS diagnostic result and follow-up

- Exact completed diagnostic: Run `41184500720`, Job `124488518930`, commit `69acf2e05e962f286f9d6a7f61f3d4a5a0c186c1`, conclusion FAILURE. Short greeting: PASS (17280 audio bytes, 6 WordBoundary); V4 four-line joined opening: FAIL `NoAudioReceived`, zero bytes/boundaries; narration first 90 chars: PASS (91008 audio bytes, 44 WordBoundary); full joined V4 opening + 20261008 scene 1: FAIL `NoAudioReceived`, zero bytes/boundaries.
- This is a reproducible input-dependent failure within one CI job, not evidence that all Edge TTS service access is down. Nor does it prove length alone causes failures. Retry of full render is withheld.
- Narrow diagnostic Workflow now tests fourth line by itself, joined first three lines, joined all four, and four lines with real newline separators, with bounded times and the same YunJhe +15% / WordBoundary; only research Workflow changes, no upload/render. Diagnostic final commit `e7a0fcfcde577dfb6f8873d3a4687da07c4326d8`; source remote-readback verified for change preceding final newline correction. **No run result for latest commit has been verified**.
- Preserve V4 exact four spoken lines and natural SRT sentence parity. If joined punctuation is the issue, propose minimal segmentation or TTS-safe text processing that preserves spoken content, ordered word boundary offsets, durations, hash binding, and no fabricated media. Do not loosen original Prompt B criteria.
- progress: PROGRESS, MVP10-A INCOMPLETE, MVP10-B NOT_ELIGIBLE, plan_changed: NO.

## 2026-10-31 MVP10-A four-line isolation diagnosis

- Run `41184589213` Job `124488783667` and Run `41184601478` Job `124488819644` both completed FAILURE. All four probes (`line_4_only`, `first_three_joined`, `all_four_joined`, `all_four_newlines`) returned `NoAudioReceived` and zero audio/word boundaries within a few seconds; this is not a 25/40-second timeout.
- Earlier Run `41184500720` had same voice/rate/version with two PASS probes (`short`: 17,280 bytes/6 WordBoundary and `narrative_lead`: 91,008 bytes/44 WordBoundary), while joined V4 and full scene returned zero audio. Current evidence **does not distinguish intermittent upstream availability from input dependence** because the later failing runs lacked a same-run known-good control.
- Research-only workflow updated at `04970958eb62b5fdfee03016e465acaea392534e` to bracket line 4 and newline-separated V4 text with `control_before`/`control_after` using the exact earlier successful opening greeting. Bounded probes 25/25/50/25 seconds, unchanged `zh-TW-YunJheNeural`, +15%, `edge-tts==7.3.1`, WordBoundary; no YouTube/credentials, no MP4 or release. Remote readback confirmed. **New Run ID/result unverified**, do not assert PASS.
- If controls fail as well, classify service-level intermittency and stop altering frozen V4 wording; if both controls pass while target fails, isolate text format and propose bounded audio segmentation while preserving exact spoken lines, timing, and original B criteria.
- research_progress_status: PROGRESS; phase_status: MVP10-A INCOMPLETE; B NOT_ELIGIBLE; plan_changed: NO.

## 2026-10-31 MVP10-A same-run Edge TTS controls

- Run `41184676174` Job `124489049927` completed failure on commit `04970958eb62b5fdfee03016e465acaea392534e`. Same-run control_before PASS (17,280 audio bytes and 6 WordBoundary); fourth-line exact `那麼我們開始囉。` FAIL `NoAudioReceived` (0 bytes and 0 boundaries), four-line real-newline joined text FAIL same, control_after PASS (17,280 bytes and 6 WordBoundary). Therefore this is not blanket Edge service unavailability during this CI or a 25-second test timeout. It still does not isolate character or punctuation mechanisms definitively.
- Next bounded diagnostic research-only commit `3ba11f3fa3d9744c2b856857e5d07d532c95d266`: bracket original fourth line, no period, inserted comma, exclamation, and short phrase omitting interjection with known-good first-line controls. Voice `zh-TW-YunJheNeural`, rate +15%, WordBoundary remain fixed. This is a research probe, not permission to alter brand line or narration. Follow-up CI run remains unverified.
- No full render rerun, no YouTube, no changes to main or publishing. Progress PROGRESS; MVP10-A INCOMPLETE, B NOT_ELIGIBLE; plan_changed: NO.

## 2026-10-31 MVP10-A punctuation-negative TTS findings

- Run `41184741133` Job `124489252640` completed FAILURE, commit `3ba11f3fa3d9744c2b856857e5d07d532c95d266`. Same-run first and last known-good greetings PASS (17280 bytes, 6 WordBoundary each). Original fourth V4 line, no-terminal-period, comma, exclamation, and shorter interjection-free variant all FAIL `NoAudioReceived`, zero bytes/word boundaries. The issue is not fixed by those punctuation substitutions.
- Follow-up research-only diagnostic commit `8a4dcb6dd006689544e3a0ea29ca4d4c3f2e5873` compares second, third and fourth fixed V4 lines against a neutral Mandarin sentence, bracketed by the greeting control. No rewrite to original script, no media/publication, and new CI run has NOT been verified yet.
- Continue only with credible same-run evidence. Do not equate an interim TTS failure to a permanent rejection of V4 content. Keep MVP10-A INCOMPLETE, MVP10-B NOT_ELIGIBLE; research PROGRESS, plan_changed NO.

## 2026-10-31 MVP10-A other-lines TTS controls and prefix diagnosis

- Verified completed run `41184808327`, Job `124489469450`: same-run control_before PASS (17280 audio bytes, 6 WordBoundary), second V4 line PASS (16560 bytes, 4 WordBoundary), third V4 line PASS (14976 bytes, 7 WordBoundary), fourth V4 line FAIL `NoAudioReceived` (0 bytes/boundaries), unrelated neutral sentence FAIL `NoAudioReceived` (0 bytes/boundaries), control_after PASS (17280 bytes, 6 WordBoundary). Source commit `8a4dcb6dd006689544e3a0ea29ca4d4c3f2e5873`. This contradicts hypotheses that all Mandarin content is unavailable or only the V4 fourth line can fail.
- Research-only TTS diagnosis workflow was changed in commit `041d547a03fb7966bfea88d6e214ddc4f911705f` to compare the known-good greeting, its concatenation with the fourth line, its concatenation with a neutral sentence, and the original greeting again, using unchanged YunJhe +15% WordBoundary. Remote readback confirms the change; no Push Run ID/result has yet been validated. No changes to original text, render, production voice or upload.
- Next decision: read same-run prefix probes. If only prefixed requests fail, investigate synthesis text construction and WordBoundary-safe bounded segmentation in isolation; if even controls fail, classify service-level unreliability. Do not infer a root cause without log evidence or resume full render prematurely.
- research_progress_status: PROGRESS; phase_status: MVP10-A INCOMPLETE; B NOT_ELIGIBLE; plan_changed: NO.

## 2026-10-31 MVP10-A prefixed TTS control findings

- Verified Run `41184906397`, Job `124489756482`, commit `041d547a03fb7966bfea88d6e214ddc4f911705f`: `control_before` PASS 17,280 bytes / 6 WordBoundary; first brand greeting prefixed to V4 fourth line `prefixed_fourth` FAIL `NoAudioReceived` 0 bytes; greeting prefixed to unrelated neutral sentence `prefixed_neutral` PASS 33,120 bytes / 11 WordBoundary; `control_after` PASS 17,280 bytes / 6 WordBoundary. Thus a fixed greeting prefix is NOT a reliable solution to fourth line, although it did rescue neutral text. Exact fourth V4 line preserved.
- Last bounded phrase-isolation research-only diagnostic commit `a39fa193bef3c1d0ebf6ac0cb878468a75db5f04` tests `那麼`, `我們開始`, `開始囉。`, `我們開始囉。`, `那麼我們開始`, bracketed by known-good greeting. Actual Run ID/result not yet verified.
- Stop exploring unbounded punctuation/text variants after this one. On repeated negative evidence design WordBoundary-safe short segment synthesis with faithful voice/line playback and merged offsets, validate offline/isolated before full 20261008 render. No YouTube, main changes, or release unlock.
- Goal progress PROGRESS; MVP10-A INCOMPLETE, B NOT_ELIGIBLE; plan_changed NO.
