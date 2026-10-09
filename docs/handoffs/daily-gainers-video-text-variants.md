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

## Phase 3 real-data regression checkpoint
- Added `tests/daily_gainers_v2_real_data.test.js`: reads actual `data_daily_gain_over_5/20261008.json`, authenticates 35-stock universe and stock mapping for 9103/6672/2305/1301, and verifies full three-way formatting with explicitly labeled synthetic numbers. Commit `009763d383375f73ca0361901f342bb41585d1fe`.
- CI invokes this regression via `.github/workflows/test-daily-gainers-text-variants.yml` commit `588832159055ddda8ad738d732d7b12978efa7a9`.
- No full `v2/20261008/master.json` has been authored: do not claim this test is real 20261008 full narration or voice verification. Actual CI conclusion and MP3/MP4 artifact still unverified.
- Gate before next promotion: produce complete fact-checked tokenized 20261008 Master, run all tests, actual Edge TTS WordBoundary synchronization and rendered MP4 without uploading; examine failures; ensure v2 picture draws display text and router enforces variant hash provenance.

## Phase 4 evidence checkpoint — 20261008 genuine legacy script audit
- Reviewed all nine original narration scenes, plus raw stock universe name mapping; real 9103 name is `美德醫療-DR`, while scene 3 title currently says `南染與防疫概念` (blocker). Other narration still contains code-only spoken references, long Chinese numeric literals, and dates. Do not claim those legacy narratives have been converted.
- Added `scripts/audit_daily_gainers_video_v2_readiness.js` (commit `696eac801c56ac4d019eaea250d1c0b22959f2e8`) and its regression `tests/daily_gainers_v2_readiness_audit.test.js` (commit `c5f36133514e0585b6b95441a7c18659325fdcb2`), included in isolated CI (commit `43b3bd746d422639b0d7cc1dc058e6f3aa2bacd1`). Expected audit result for 20261008 is BLOCKED, not success, until factual inconsistencies and typed numeric narration are repaired.
- No verified CI green result yet. No full nine-scene v2 master, TTS, SRT, MP4, or upload; next agent must not skip those stages or reinterpret audit-test PASS as production-readiness PASS.
- Next focus: author all nine scenes into verified typed cue tokens, correct 9103 visuals only after checking original editorial/source facts, validate full equivalence, then render a non-uploaded MP3/SRT/MP4 sample and independently examine timing and pronunciation.

## Phase 5 checkpoint: complete 20261008 typed Master (2026-10-09)
- All nine authentic legacy scene narrations converted into a 56-cue tokenized Master under `video_scripts/daily-gainers/v2/20261008/master.json` (commit `698e50dcd6927c663214b4462c5fcde713972310`). Source-full-reconstruction check passed at generation, except deliberate verified substitutions of spoken code-only stock references with company names and removal of redundant `台塑，代號一三零一`.
- Source-derived stock labels now included in v2 preview `plan.json`; erroneous legacy scene-3 title is overridden with verified `美德醫療-DR（9103）與防疫概念` (commit `56c00e81ab7e5a3cc836d973e5ba2abaf1755176`). Production SVG renderer does not yet consume these labels; this remains a rollout blocker.
- New full nine-scene regression `tests/daily_gainers_v2_full_20261008.test.js` checks every reconstructed scene and all caption/speech cue concatenations and stock label regression (commits `5e39237f4437114fc5aedaf6d8b562707dc97525` and `092bc5fa1e5702eee2aaf675ac439c4d61139d69`), wired to test workflow commit `3d9eef5f4d9f0661b8ad990b3af5a228079f99e5`.
- Added `month` and reviewed `numeric_phrase` token rendering for provenance-preserving original speech, while displaying Arabic numeric equivalents (commit `1d32c55a0201ad80932464abe6b7b67de573845f`).
- Source was fetched from live remote; no independently confirmed GitHub Actions green run. Local git clone failed due unavailable DNS. Distinguish generated Master and test-written from verified PASS.
- Still pending: run actual full-scene CI and inspect output for ALL numeric forms (especially idioms such as `三成七`), add semantic validation for typed numeric phrases, perform actual MP3/WordBoundary/SRT/MP4 dry-run, update production SVG and upload-compatibility checks. Do not promote production while any of these fail.

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

## Phase 7 media proof run evidence (2026-10-09)
- Fixed erroneous caption `0` from three unit-only `億` typed tokens in full 20261008 Master: commit `70918a1d58c9e4a715ed9d382965d8eaffa80adc`.
- V2 media-proof workflow push-only self trigger added in `039bd0d7cd05c04c778c6b7184054f5cbde15ea3`; Master changes trigger added in `7d9d3357bed3e63d6b21564ed6f597d56fe6df13`.
- Verified two live GitHub Actions run IDs: `37878551084` (older workflow commit) and `37878597628` (new workflow commit). On last inspection, run `37878597628` was `in_progress`, and checkout step was active. No success conclusion, media artifact or synchronized subtitle evidence yet. Only status verified, not a PASS.
- When run ends, inspect job failures/artifacts, fix safely and rerun. Do not upload to YouTube or enable automatic production v2 on the basis of a queued/in-progress run.

## Phase 8 lexical-number gate (2026-10-09)
- Actual prior Media Proof `37878597628` ended success, with media artifact `11593214090`; semantic review of subtitle audit found scene 9 `零星個股` incorrectly rendered as `0星個股`. Thus pipeline green is not semantic-content PASS.
- Fixed `video_scripts/daily-gainers/v2/20261008/master.json` so scene 9 preserves lexical `零星`, not a numeric zero; commit `46ffedf2d7fca6ceea7adafc4978d7fd2ddb10f9`.
- Added explicit regression that scene 9 caption/speech retain `零星個股`, reject `0星個股`, and scene 3 numeric context `缺值當作0` is retained; commit `a141fbf5b83fc1f2f65f7eebe048dc809d22fab3`.
- New isolated full Media Proof `37880158759` auto-triggered from corrected Master and was `in_progress` on last inspection. Must inspect actual completion and subtitle manifest before claiming final PASS. No YouTube actions added.
- Next: confirm successful nine-scene artifact; add reusable lexical contextualization gate for daily input rather than relying only on fixture regression; independently audit captions including numerical-unit/speech equivalence before production promotion.

## Phase 9 strict subtitle coverage checkpoint (2026-10-09)
- Media Proof runs `37880230200` and `37880158759` completed SUCCESS; most recent produced artifact ID `11595105628` (49,216,248 bytes). Job log for latest had correct `零星個股` and no `0星個股`.
- Technical proof passes full Edge TTS, lip sync, MP4, subtitle construction. This does not mean future narration/format semantics fully audited.
- Added `scripts/verify_daily_gainers_v2_media_proof.js` in `879bb5ce6bcde910f2f2ddf5bee64f4a025c554c`: asserts scene and caption count, exact cue-to-SRT content, cue chronology, v2 plan caption+speech complete concatenation, Edge WordBoundary presence and spoken text identity, MP4 existence, no `0星個股`.
- Integrated strict QA as mandatory step before artifact upload in standalone proof workflow (`3dc0f0094e7c36c7189ebe36392937d2b9ffc7b6`), which auto-triggered new run `37886021496` (queued on last check). Wait for concrete result; if failed, inspect logs and fix boundedly. No YouTube uploads and production v1 unchanged.
- Before promotion: review actual subtitle readability (some cues exceed comfortable length), implement audited numeric_phrase equivalence rules, source authenticity/date gates, rule hash-aware upload-orchestrator, and independent Prompt B.

## Phase 10 — V2 Video Preview Dashboard (2026-10-09)
- New standalone local-file browser player: `public/daily-gainers-v2-video-preview.html` in commit `07136a0b9100d287fc53416f0b7a6df0a8f44b2c`. MP4 playback, SRT-to-WebVTT tracks, plan.json chapters, subtitle-manifest timing, caption continuity and lexical-zero warnings; responsive dark design. Local File API means no network uploads, no accidental public MP4. The page is not an authenticated video hosting solution and cannot stream raw Actions Artifact URLs.
- Proof workflow now copies this page to `output/daily-gainers-video/20261008/video-preview.html` before artifact upload; commit `e65ec5912e586fc065b0011bc5753f0c9a4fdaee`. User may download/extract artifact and open video-preview.html, then select local video/JSON/SRT files. No new credentials required.
- Static browser JS syntax and privacy regression `tests/daily_gainers_v2_preview_dashboard.test.js` created commit `b30d0a363e77e10b1eacb2e750a14d4629fb6b82`; added to text variants CI in `18826546af03f046db7a7864259c86ea5dc03ce4`.
- Media Proof run `37886377088` observed in progress after workflow change; dashboard-test run result NOT yet verified. Prior `37880230200` green is for earlier media workflow only; strict QA run `37886021496` was in progress.
- Future authenticated online streaming needs explicit storage/provider authorization (e.g. private bucket and signed playback URLs). Do not upload test MP4 to public GitHub Pages or advertise this static page as private/authenticated. Separate pre-production UI from production upload routing.
