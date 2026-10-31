# MVP10-A: scene-1 V4 caption and WordBoundary timing audit — 2026-10-31

**Status:** STRUCTURAL_CAPTION_TIMELINE_PASS / independent auditory and rendered-scene QA PENDING. Research branch only; this report is not a production acceptance receipt.

## Reverified inputs

- The previous real-media first-scene PCM splice WAV has SHA-256 `fc5598fcb5a4def1a3a0f1bf5d17609c12a7f065589c27109e8d50ce3ce06bc7`, decoded **43.562s**, mono 24kHz 16-bit PCM. Original source `20261008` legacy Artifact `12953454424`, fourth-line source `20261013` Artifact `13036325288`.
- Four original Edge WordBoundary listening files in local ZIP have archived SHA-256 `167037f2ce4379fa958136ed718319ef2f4d11c40025ef3a01e0475459f16a4c`. Their labels are source metadata **not** independently transcribed words.
- 128 WordBoundary events remain strictly ordered, positive-duration and within the actual 43.562s audio. Exact frozen V4 opening, original `20261008` market narration and normalized **226/226 character coverage** confirmed.

## Strict caption alignment recheck

Research-generated, audio-only SRT preserves each four-line V4 sentence as its own cue, and splits the remaining original market narration without exceeding **30 characters per cue**. The final local study has **12 caption cues**. Reported fourth line `那麼我們開始囉。` cue starts `00:00:07,930` and ends `00:00:09,780`; subsequent `今天是十月八日...` cue starts `00:00:09,780`. Every caption transition aligns with a **real recorded source WordBoundary word-end**, not just an arbitrary character count.

**New failure uncovered:** a first naive 15-cue research split passed text coverage and chronological checks but cut through genuine Edge word tokens `以及` and `公開`. It was explicitly **REJECTED** by a stronger test `caption cut splits a genuine WordBoundary word`. The local research splitter was revised to use source token edges, yielding 12 token-safe cues. Text coverage remained 226/226, and all 11 cue transitions are word-safe. This demonstrates why coverage alone is not sufficient for caption acceptance.

Five negative local tests all PASS_REJECTED: missing fourth-line event, order swap, time out-of-audio, overlapping events, wrong word. Reproduced locally only; **no new GitHub Actions run**.

## Immutable reproducibility digests

- Local verification script `verify_scene1_v4_caption_timing_research.py`: SHA-256 `bec8270266b3cfbe0cba0bed34f6776af5a25698d4b49ed9923df3b2181bcc8b`.
- Generated research-only `20261008_scene1_v4_timing_RESEARCH_ONLY.srt`: SHA-256 `6f94649878ca6cec5f6263e393e8077c375a7a70136c28d5e33adcfdc02120f4`.
- Local machine-readable audit `20261008_scene1_v4_caption_timing_audit_RESEARCH_ONLY.json`: SHA-256 `607a9a5b323d5426a7f4d3e093617898239fb67da732c31af79c8e6b5f50359b`.

These are local working-space outputs, **not committed media or files in the repository**. The research validator uses source-event lexical matching consistent with the approach of `daily_gainers_subtitle_alignment.align_cues`, but is **not** an execution of the production SRT generator nor a guarantee of editorial naturalness/line wrapping.

## Strict remaining acceptance gates

1. Independent hearing verification: audible exactly `那麼我們開始囉。`, no chopped syllables or neighboring speech (original 1.850s WAV and four-event listening ZIP). PENDING.
2. Source genuine recorded per-word timing vs acoustic word onset/offset. PENDING. A whole-phrase RMS envelope pass does **not** certify individual words.
3. Exact production SRT generation, display wrapping, scene start/end, VTuber/render sync, real final MP4 and frozen A/B media QA. NOT ATTEMPTED.
4. No production code changes, main modifications, full render, YouTube, publication-lock or Prompt B promotion. MVP10-A INCOMPLETE, MVP10-B NOT_ELIGIBLE, research PROGRESS, plan_changed NO.
