# MVP10-A | 20261008 scene-1 SRT display and WordBoundary study (2026-10-31)

**Status: ISOLATED_TWO_LINE_SRT_STRUCTURE_PASS; audible words and word-level acoustic timing PENDING.** Project `daily-gainers-market-opening-end-to-end`, goal `goal-v3/MVP-10DAY-v1`, research branch `research/daily-video-mvp10-a-20261029`. These are **local research** tests, not a new CI, production generator change, or full video QA.

## Frozen source re-check
- 20261008 scene 1 V4 PCM/WAV SHA-256 `fc5598fcb5a4def1a3a0f1bf5d17609c12a7f065589c27109e8d50ce3ce06bc7`, duration **43.562 seconds**, mono 24kHz/16 bit.
- Source-bound `WordBoundary` count **128**, strictly positive and in order, all events within audio; normalized fixed V4 four-line + original scene-1 narration **226/226 characters** (100%).
- Fourth source phrase exact text `那麼我們開始囉。`, original Edge event starts 7.930416s; next daily spoken event begins at 9.780416s. **Reported events are not independently word-acoustic calibrated**.
- Review ZIP `v4_line4_word_boundary_listening_pack_20261031.zip` SHA-256 `167037f2ce4379fa958136ed718319ef2f4d11c40025ef3a01e0475459f16a4c` verified with all four .wav clips present; labels are source metadata, **NOT independent auditory identification**.
- Previous first-scene research SRT `20261008_scene1_v4_timing_RESEARCH_ONLY.srt` has 12 cues, <=30 chars, 11 edges constrained to source WordBoundary, text unaltered. SHA-256 `6f94649878ca6cec5f6263e393e8077c375a7a70136c28d5e33adcfdc02120f4`.

## New stricter on-screen layout audit
The actual `build_daily_gainers_srt.py` research reference displays text with approximate 18-column visual width, using East Asian fullwidth=1, ASCII/narrow=.55, punctuation-preferred line breaks. Re-applying this algorithm to 12-cue SRT exposed **two cues that wrap to three rows**: original cue 5 (date and market opening narration) and cue 10 (risk/evidence sentence). Consequently **12-cue structural PASS alone is insufficient for a two-line subtitle layout.** It is not a verified video-frame screenshot.

In local research only, the two offending cues were each split exactly at a genuine **existing WordBoundary**; all text remains unchanged and no manufactured speech event was added. **14 research cues** now meet:
- No more than **30 characters per cue**.
- No more than **two display lines** at the same approximate <=18-column wrapping criterion.
- 100% original character coverage and all SRT transitions at real recorded `WordBoundary` event starts; no subtitle gap/overlap >1ms rounding tolerance.
- Frozen fourth V4 cue exactly unchanged, and next market speech still begins at **9.780416s**.
- Minimum cue duration approximately **1.850s**, maximum approximately **4.609s**.
- The updated SRT is **research-only**, not written to any video/render directory and not a production script update.

## Local reproducibility / negative tests
- Re-ran previous `verify_scene1_v4_caption_timing_research.py` with 5 fail-closed negative cases PASS, and prior `test_research_mvp10_v4_acoustic_envelope_audit.py` **8/8 PASS**; these are old evidence, no new GitHub CI.
- New `test_refine_scene1_srt_display_research.py` **8/8 PASS locally**, validating exact V4/text and two-line layout; original two >2-line cue detection; source event-edge constrained splits; monotonic cue timing; fail-closed if valid cut points are absent; sample-bound audio digest; isolated output paths.
- Research-only outputs in session:
  - `20261008_scene1_v4_timing_TWO_LINE_RESEARCH_ONLY.srt` SHA-256 `adf0c086bc5c73cf0a3cb9604adad90c2112264381f5b3517dcbba919cfb9024`
  - `20261008_scene1_v4_two_line_caption_audit_RESEARCH_ONLY.json` SHA-256 `19419a492c61e64c6dee21eab85b4ee3542bd556be68b0ce3975c7b46e39fac0`
  - `audit_scene1_srt_display_research.py` SHA-256 `c5ed87f78a0f517c7276e1fc8bf43223f56e06b9217690f56a217db751a4e3ee`
  - `refine_scene1_srt_display_research.py` SHA-256 `8ec3704f40a702d1ef53d22ef2ee3a4ed47f2d5dac56d58b9e8667eb8d6568a0`
  - `test_refine_scene1_srt_display_research.py` SHA-256 `c0211444eb75ce0e64e2ca584926ea13be4bd0f631b7825a72cd535f831285cb`
- No new GitHub CI, no MP4 render, and no source audio modification. All five local files remain working-container research artifacts, not committed binary media. This handoff doc records exact hashes and results.

## Speech acoustic caveat
Four reported source WordBoundary windows have independently measured nonzero audio energy (approximately -22.29, -20.58, -22.22, -23.28 dBFS RMS by window); this only says sound is present. It **does not prove each event speaks the word in its metadata**. Existing whole-phrase energy envelope is compatible, but first event begins about 0.16–0.17s before strong sound; final event extends around 0.08–0.09s after. Independent human lexical listening and genuine word-level acoustic alignment remain **PENDING**.

## Acceptance gates & next step
1. Independently hear complete `v4_line4_candidate_20261013_pcm.wav` and four source WordBoundary clips, checking full frozen phrase, accurate labels, no adjacent words or clipped phonemes. Record a separate immutable review decision; **do not self-approve from waveform or metadata alone**.
2. Verify per-word acoustic timing independently; retain source offsets unless confirmed evidence justifies a versioned correction.
3. Only after both gates pass, preregister isolated scene-1 audio/subtitle/video overlay QA using 14-cue research SRT as a **candidate**, not as production pass. Avoid opaque audio codec delay and three-line subtitle overlap.
4. MVP10-A remains **INCOMPLETE**; B **NOT_ELIGIBLE**, research `PROGRESS`, plan_changed `NO`; main, production workflows, YouTube and all publication locks unchanged.
