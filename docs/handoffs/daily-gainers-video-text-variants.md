# Daily gainers video text variants

Canonical handoff: `docs/handoffs/daily-gainers-video-text-variants.md`

## Current phase
Phase 3: v2 cue-paired generator and side-effect-free plan preview integrated, regression CI wired; no production activation or full MP4/WordBoundary verification yet. **Do not claim v2 is production-enabled.**

## Objective
Three independent, versioned text output artifacts for display, caption, speech, backed by one validated semantic source. Captions must show EVERY uttered word and number: Arabic digits (including codes when genuinely spoken), dates M/D, percent symbols. Speech must use natural Taiwan Mandarin pronunciation and primarily verified stock NAME, not stock code. Display must use verified stock name plus code. No summarization or dropped content. Reject semantic mismatches.

## Frozen decisions
- Stock names are obtained via `data_daily_gain_over_5/YYYYMMDD.json` `stocks[].code/name`, not guessed.
- Speech/Caption difference is only orthography and pronunciation; never omissions.
- Caption alignment must preserve Edge TTS WordBoundary; existing `daily_gainers_subtitle_alignment.py` matches after `normalize_spoken_text`, so distinct caption/speech requires a stable token-to-word mapping and fail-closed checks before promotion.
- Legacy v1 `video_scripts/daily-gainers/YYYYMMDD.json` remains usable, and already-uploaded video must not be reuploaded merely because a rules document changed.
- Frozen registry: `video_scripts/daily-gainers/rules/text-presentation.v1.json`.
- Keep voice `zh-TW-YunJheNeural` and rate `+15%`.
- Preserve timing safe area and existing 5–10-minute QA.
- The rules are changeable via new versioned rules+regressions, not silent edits to a historical version.

## Evidence / current source trace (remote main, October 9, 2026)
- `scripts/build_daily_gainers_video_package.js` reads v1 JSON `title`, `subtitle`, `bullets`, `narration` into `plan.json`, renders SVG scenes.
- `scripts/synthesize_daily_gainers_tts.py` uses `normalize_spoken_text(scene["narration"])`.
- `scripts/build_daily_gainers_srt.py` splits `scene["narration"]` and aligns to TTS word boundaries using `normalize_spoken_text`.
- `scripts/build_daily_gainers_lipsync.py` uses normalized narration.
- `.github/workflows/generate-upload-daily-gainers-video.yml` builds package, TTS, VTuber, render, SRT, thumbnail, upload.
- `.github/workflows/daily-gainers-video-upload-orchestrator.yml` dispatches render/retry based on artifacts; `scripts/decide_daily_gainers_video_upload.sh` currently lacks rule/version hash compatibility.
- 20261008 script has `代號九一零三` without company name; raw file maps `9103` to `美德醫療-DR`. A display title `南染與防疫概念` is not a reliable source of stock identity.

## Implementation checkpoint 2026-10-09
- Versioned rules registry, typed generator, isolated tests and CI workflow committed in preceding phase.
- TTS now reads explicit `speech_text` when `plan.schema_version == 2` (commit `eded55d5f1a089db22483f0da4234f1877d50545`).
- VTuber lipsync now reads explicit `speech_text` when `plan.schema_version == 2` (commit `eab54dcd7b9413d17c7249f6c0b7e57c2f718ed0`).
- Python SRT now expects explicit `caption_cues` pairs, verifies concatenated captions/spoken cues equal respective full texts, aligns spoken cues against WordBoundary, and displays caption cues (commit `ae349cac8af71ff804921ed50f31b3c6a3bcea87`).
- No natural workflow validation or runtime proof yet. Do not mark Prompt B PASS or promote production. No existing video was reuploaded.
- Important gap: the current v2 typed generator emits scene text in separate files but does not yet produce complete per-cue pairs or integrate those files into a schema-v2 `plan.json`; the main package builder still emits v1. Implement and independently test these before rollout.

## Phase 3 checkpoint (2026-10-09)
- `scripts/daily_gainers_text_variants.js`: one token stream per cue now creates display/caption/speech and full `cue_pairs`, rejecting untyped ambiguous numbers; source hash includes verified stock code+name mappings and output hashes include cue pairs.
- `scripts/build_daily_gainers_v2_preview.js`: standalone side-effect-free v2 `plan.json` and three-text JSON preview using manually authored typed Master `video_scripts/daily-gainers/v2/YYYYMMDD/master.json` plus validated daily raw and matching visual scene metadata. This is NOT automatically generated for existing v1 scripts and does not replace the production package builder.
- `tests/daily_gainers_text_variants.test.js` adapted to cue tokens; `tests/daily_gainers_v2_preview.test.js` adds temporary-fixture integration assertions; `.github/workflows/test-daily-gainers-text-variants.yml` runs both Node tests.
- Commits: `2175a01fba4d8c8cb4ccc60ce8ec710469747deb`, `d1f40fabd9ac51cc546e612dcb83440e7afa956d`, `e628d00e7aef20dcf22dcfdf5b04d36a4b7e4d4c`, `4447661b4933ac9aad1f07d3a5e49ea05704eb90`, `e8a244f8d6a2ade0f2ad9b63d680c5e7eae4e756`, `700507c44f781f156075f0f0d98b57da0e91ef0c`.
- No verified green CI run, no complete 20261008 master, no audio waveform or rendered sample yet. Never mark Prompt B PASS from these commits alone.
- Remaining gaps: typed Master authoring strategy for entire daily video; display text integration with SVG and stock-name rendering; real Edge WordBoundary alignment test with all full cues; strict v2 package consistency checks, artifact/upload hash-aware routing; regression with 20261008 actual data. Keep production v1 untouched until complete.

## Next round
1. Implement a deterministic shared representation of semantic utterances and verified stock identities.
2. Emit separately persisted `display.json`, `captions.json`, `speech.json`, plus equivalence/alignment provenance manifest and source/rules hashes.
3. Implement dates (10/9 vs 十月九日), numeric formatting (12,500 vs 一萬兩千五百), percent and stock references with tests; unsupported/untrusted conversion fails closed.
4. Make TTS and lip-sync consume speech; SRT consume full caption while aligning against speech using shared semantic/token mapping.
5. Add equivalent checks before render/upload; persist those assets in artifact. Upgrade upload router to check compatible hashes, avoid repeat production.
6. Pilot against 20261008 and a future date without YouTube side effects. Only promote when gates pass; verify remote main and natural schedule.

## Safety / stop
No fresh YouTube upload or automatic rerender as part of rule rollout validation. No unverified financial names/numbers. Reject ambiguous name/code mapping and alignment failures. Do not silently fall back to old caption if a v2 manifest is present. Do not conflate a successful registry commit with production rollout.

## Prompt A — implementation
Fetch latest remote main; read AGENTS.md and this handoff. Implement v2 distinct display/caption/speech with exact semantic equality, verified mapping, token alignment and regression tests. Preserve v1 and avoid uploading videos. Record files/commit/run and update handoff. Do not stop until independent package render validation criteria are satisfied or a concrete blocker documented.

## Prompt B — independent closeout
Fetch latest remote main and this preregistered Prompt B. Check exact rule-hash/provenance, 20261008 fixture, spoken TTS/readable caption date/numbers, stock names and codes, exhaustive no-omission equivalence, WordBoundary coverage, lipsync/audio coherence, upload-router no duplicate, legacy v1 and date gate regression. Inspect actual generated artifact and run evidence; do not mark PASS on CI-only success. If any gate fails, fix boundedly and repeat verification. Only after verified durable PASS promote as authorized; preregister the next prompt pair and commit handoff.
