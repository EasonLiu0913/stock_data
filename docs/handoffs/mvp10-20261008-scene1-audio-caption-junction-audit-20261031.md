# MVP10-A | 20261008 isolated scene-1 PCM splice junction and caption QA

**Research status:** STRUCTURE_PASS / independent lexical listening **PENDING** / genuine word-acoustic alignment **PENDING** / actual rendered subtitle picture **NOT TESTED**. This is not a full video or Prompt B acceptance.

## Verified immutable inputs

- Reopened actual research files and recomputed digests locally: 20261008 isolated 43.562-second, 24kHz mono 16-bit PCM WAV SHA-256 `fc5598fcb5a4def1a3a0f1bf5d17609c12a7f065589c27109e8d50ce3ce06bc7`; frozen line-4 1.850-second source WAV SHA-256 `059f9403f614b7c83ecffdf625c3a18adaee21af66cf1f4f394dd0c079d71a40`; existing 14-cue research SRT SHA-256 `adf0c086bc5c73cf0a3cb9604adad90c2112264381f5b3517dcbba919cfb9024`.
- Exactly **128 source-attributed WordBoundary events**, **226/226 normalized written speech characters**, no transcript/word-event drift, zero word overlap or events outside audio.
- **14** candidate cues, approximate source formatter <=18-unit/line with no more than 2 lines/cue; no more than 30 source characters/cue; duration >= **1.850 seconds**, max normalized characters/sec approximately **8.07**; all transitions align with authentic existing source WordBoundary event starts at SRT millisecond resolution.
- Original V4 fourth cue retains text `那麼我們開始囉。`, SRT **7.930–9.780 seconds**. This is source-label and text coverage validation, **not independent word recognition**.

## Audio-only joins: sample-level non-discontinuity

The 1.850s/44,400-sample original source line is inserted at source old-scene sample index 182,400 (7.600s) and the original scene is resumed at new-scene sample index 226,800 (9.450s).

**At both joins** (7.600s and 9.450s), the inter-sample jump was exactly 0/32768 full scale. Both the preceding and subsequent 20ms window RMS values were zero (reported -240 dBFS floor for computational representation, not physical -240dB measurement). Exact sample equality verifies unchanged original scene prefix/suffix and inserted source. This is strong evidence against a splice-edge click from abrupt PCM discontinuity, **not a perceptual hearing PASS**.

## Negative/fail-closed local tests

New **9/9 local Python unittest tests PASS** on real scene1 research files:
1. valid baseline text/WordBoundary/subtitle/audio contract;
2. deliberately wrong WAV SHA-256 refused;
3. forged event word label refused;
4. deliberately overlapping word-event offsets refused;
5. caption beginning within an existing word refused;
6. modified cue that renders 3 lines / exceeds layout budget refused;
7. missing frozen fourth sentence refused;
8. 20ms-duration caption refused;
9. 150ms shift of all word-event timestamps refused.

Actual local evidence:
- `audit_scene1_audio_caption_boundaries_20261031.py` SHA-256 `0e08adc45b7ccba11f58042731dde0863b30586563ebe4f145f9d3375a34d0a0`
- `test_scene1_audio_caption_boundaries_20261031.py` SHA-256 `80188ccde4f2300817f1cd26f0a09948519bdf8d055bb153138b23dfe3383d97`
- `20261008_scene1_v4_strict_display_acoustic_structure_audit_20261031.json` SHA-256 `944c41e17f9cb42f059957bfc23cea0674e6d67b7c2a3e068e93ea7eccf8b6ed`

These are **local**, not GitHub Actions CI. Files reside in working environment; GitHub repository is updated with research documentation only.

## What the actual rendering code establishes, and does not

Repository `scripts/render_daily_gainers_video.js` contains a **1920x1080** composition, progress overlay y=815..928, reserves bottom **152px** for external YouTube captions (y=928..1080); VTuber overlay is anchored at `H-h-235` and its bottom is y=845. The timer's ASS placement is set by its own right-aligned `MarginV=186`. The source video renderer does **not burn** the external SRT into the MP4. The separate `scripts/build_daily_gainers_srt.py` approximates east-Asian line wrapping for subtitle text, but **does not guarantee specific viewer/device rendering**. The present <=2-line finding is a structural display heuristic, **not per-frame screenshot proof**, nor a guarantee the external YouTube subtitle renderer respects font/position/pixel reservation.

## Strict stop conditions

- Original fourth-line source events cover an overall acoustic energy envelope; independent human hearing has NOT yet confirmed exact words or possible clipped phonemes. Word-by-word acoustic alignment also remains unverified. **Keep these gates PENDING** even though word labels and energy are present.
- No scene-1 rendered MP4, player caption screenshot, actual presenter/overlay collision test, new GitHub CI, YouTube upload, main modification or publication lock change was performed. Do not promote the 14-cue research SRT to production on these results alone.
- Before proceeding: independently confirm audible exact four-phrase sequence and per-word timing; then isolate one scene-1 picture/subtitle/media QA with the 14-cue research SRT and preserve all original Phase A/B checks. Under goal `goal-v3/MVP-10DAY-v1`, research PROGRESS, MVP10-A INCOMPLETE, MVP10-B NOT_ELIGIBLE, plan_changed NO.
