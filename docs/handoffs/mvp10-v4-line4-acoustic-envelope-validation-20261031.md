# MVP10-A | 20261008 V4 line-4 acoustic envelope audit (2026-10-31)

**Evidence status: acoustic whole-phrase envelope PASS; lexical listening and per-word acoustic alignment PENDING.** Research-only, no deployment or publication authorization. Active project `daily-gainers-market-opening-end-to-end`, Goal `goal-v3/MVP-10DAY-v1`.

## Inputs independently rechecked

- Successful `20261013` Artifact `13036325288` as source; exact fourth brand sentence `那麼我們開始囉。`, `zh-TW-YunJheNeural`, `+15%`, manifest Edge WordBoundary.
- Decoded PCM research candidate `v4_line4_candidate_20261013_pcm.wav`: SHA-256 `059f9403f614b7c83ecffdf625c3a18adaee21af66cf1f4f394dd0c079d71a40`, raw PCM SHA-256 `b523babe9836a524cec541b4d8cdf2d415be235f3db611b1ea73f18814e6a676`; 24 kHz/mono/s16le; **44,400 samples / 1.850 seconds**. Source crop had been verified sample-exact in prior research; old `20261008` source and candidate audio weren't changed.
- Genuine reported Edge WordBoundary events (from source and re-based to crop start 7.6s):
  - `那麼`: **0.330416–0.613041s**
  - `我們`: **0.613041–0.808707s**
  - `開始`: **0.808708–1.080416s**
  - `囉`: **1.080416–1.439124s**
- **Event envelope**: 0.330416–1.439124s; boundaries never reverse or extend beyond WAV samples.

## Independent numerical acoustic audit

A pure local Python audit decoded the exact WAV and computed **10 ms RMS frames**, with four fixed dBFS thresholds. Only frame energy above each threshold is considered sound for the following test (not independent word recognition).

| Threshold | Sound-energy start | End | Active frames | Frames wholly within original Edge event envelope |
| --- | ---: | ---: | ---: | ---: |
| -45 dBFS | 0.490s | 1.360s | 87 | **87/87** |
| -40 dBFS | 0.490s | 1.360s | 87 | **87/87** |
| -36 dBFS | 0.500s | 1.350s | 85 | **85/85** |
| -32 dBFS | 0.500s | 1.350s | 82 | **82/82** |

**Result: whole-phrase acoustic envelope is compatible with the recorded Edge event envelope.** First audible energy starts about 0.16–0.17 seconds after first event offset; last active energy ends about 0.08–0.09 seconds before last event end. Without a phoneme-level hearing/transcription measurement, these remain *unresolved timing discrepancies*, not a certified word-level sync PASS.

## Negative tests

Executed **8/8 offline local Python unit tests PASS**, including exact digest and source PCM digest, fixed four-event sequence, source-vs-crop offset integrity, nonmonotonic events, deliberate event-window +0.300s and -0.250s drift rejection, and multi-threshold energy-envelope coverage. The preceding full-scene sample-exact PCM splice checker was rerun locally and remained **PASS**: output 43.562s, 128 recorded WordBoundary events, exact normalized text **226/226 characters**, unchanged prefix/suffix and unchanged inserted 44,400 samples. No new GitHub Actions run was triggered.

Local evidence reproducibility files (in current research working session, **not committed or published**):
- `research_mvp10_v4_acoustic_envelope_audit.py` SHA-256 `43caafe86cbdfb0124e0f4c01c96103c9c5185b1d95fb6ba7da96a922dfbc815`
- `test_research_mvp10_v4_acoustic_envelope_audit.py` SHA-256 `3c613f503ad94a12c4cfbd3206270a94678e67667ca8fd2774654c2cbe0c7ed6`
- `v4_line4_acoustic_envelope_audit_20261031.json` SHA-256 `8d3337b392a5d31193679950d65422e3f060beb82edb2c076d8645ec39411cab`

## Strict gate / next action

1. **Independent listening** must confirm that the isolated audio fully and clearly speaks the exact original sentence, without adjacent spoken content. Waveform energy and source SRT do **not** establish actual lexical content.
2. **Independent word-level acoustic alignment** (e.g. a reliable alignment assessment with genuine source, not manually invented WordBoundary) must assess whether each event `那麼`, `我們`, `開始`, `囉` is synchronized to the actual speech. Whole-envelope inclusion alone does not imply four individual event alignments.
3. Only if both above pass may an isolated scene-1 audio/subtitle/video sync test be proposed. Do not import old MP4 assets into a new official final video or trigger full Render-only without independent scene/media acceptance.

Research `PROGRESS`, MVP10-A **INCOMPLETE**, MVP10-B **NOT_ELIGIBLE**, plan_changed **NO**. The last live Edge TTS scene1 Pilot `41185747222` still FAILED on new line-4 synthesis; successful local source recovery does not rewrite that result. `main`, formal workflows, YouTube and all release locks untouched.
