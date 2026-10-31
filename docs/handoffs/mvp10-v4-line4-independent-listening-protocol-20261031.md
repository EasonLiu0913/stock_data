# MVP10-A | V4 line 4 independent listening / lexical gate (2026-10-31)

**State: PENDING HUMAN HEARING, NOT APPROVED.** Active `daily-gainers-market-opening-end-to-end`, goal `goal-v3/MVP-10DAY-v1`. Research-only, no main/render/YouTube/lock changes.

## Why prior PASS does not close this

Existing sample-identical source MP4/WAV, 14-cue research SRT, 128 original WordBoundary events, 226/226 text structure, 9/9 local negative tests and source phrase energy envelope establish valid source metadata and numerical timing, **not** a trusted independent identification of the words actually spoken or word-by-word alignment. Edge metadata is not independent transcription, and the presence of sound in four corresponding windows cannot certify individual phoneme boundaries.

Current runtime has no readily available installed locally cached Chinese ASR model; do not relabel a metadata match or infer vocabulary correctness from energy. A fresh speech recognition model might offer a non-independent second opinion but does not replace independent listening.

## One-step review pack: original, slow, and context

An isolated local archive, **not committed to GitHub**, is named `v4_line4_independent_listening_review_20261031.zip`; SHA-256 **`952de1455da9b95738d808f3c1e299d3156cc05c2ec26f3cc730327298d6cdfc`**.

The archive has:
- `01_original_1p850sec.wav`: exact source 1.850s PCM; SHA-256 `059f9403f614b7c83ecffdf625c3a18adaee21af66cf1f4f394dd0c079d71a40`
- `02_whole_phrase_0p75x_REVIEW_ONLY.wav`: pitch-preserving FFmpeg `atempo=0.75` review-only playback; SHA-256 `7e2bc70199ca88fe58a24c6eb6098060d6d90c9266cea5ea57f3154473dcd8bb`. Slow audio is **not** a permissible final-production source.
- Four `word_0[1..4]_with_120ms_context.wav` files: original PCM samples from each Edge source event with exactly up to 120ms surrounding audio. They are **overlapping hearing aids**, not a new alignment or manipulated source:
  - source label `那麼`: clip 0.210417–0.733042s; SHA-256 `c62b4bd7cd7712b22a61add8cbb4465bbe1ae03b415cc84c314aadc71c660524`
  - `我們`: 0.493042–0.928708s; SHA-256 `1eda5efc408ff8c9296a1fe560adbb3deaa1bdbc1ac8049e3e0b535193a6ce67`
  - `開始`: 0.688708–1.200417s; SHA-256 `f12ac6c514785a28087312f1284163fa51cacc640c2231876cc62fb5f257e5ac`
  - `囉`: 0.960417–1.559125s; SHA-256 `52b4f46d505a27658a6634d80f0b84f8334026041304356da110bc0ed8417b21`
- `review_questions_and_original_provenance.json` identifying fixed text, source 20261013 successful Run `41182709089` / Artifact `13036325288`, and **all approval flags false**.

The exact pack creation/reproduction script exists in isolated working environment `build_line4_independent_listening_review.py`; it confirms unchanged SHA-256 and decodes only the already existing sample-exact WAV, without additional network, synthesis, publishing, or production changes.

## Independent reviewer checklist (all mandatory)

1. Listen to **original** 1.850s audio before seeing word labels if possible. Report exactly the heard spoken words, and whether they constitute the unmodified `那麼我們開始囉。` (punctuation not literally spoken). If indeterminate, `UNVERIFIED`, not PASS.
2. Listen to slow version as a **hearing aid only**, then original again. Confirm full syllables, no omitted or added words, no adjacent analysis narration, no abrupt audible joining.
3. For each of the four original Edge event windows, compare the original exact-window clip with the **120ms-context** clip. Flag cut/shifted phonemes and overlap; do not move event offsets based on visual energy alone.
4. A reviewer record should explicitly store reviewer role, reviewed pack SHA-256, verbatim heard phrase, per-word verdict and any uncertainty, as well as whether the original unstretched audio is acceptable. Any non-PASS blocks scene-1 visual integration; do **not** fabricate a human signoff.
5. The remaining independently aligned per-word acoustic acceptance must use independently observed phoneme/syllable bounds, not just re-assert Edge timestamps. If no reliable independent phonetic review is possible, maintain this gate `PENDING`, not FAIL due solely to a missing service.

## Narrow next action after independently documented approval

Only once reviewer confirms exact words and the acoustic boundaries qualify under pre-approved tolerances: run a **single-scene isolated video/subtitle/presenter dry-run** with 20261008 fixed audio, 14-cue research SRT and actual overlay/player screenshots. Do not touch original production or complete 9-scene Render-only workflow without original paired Phase A/B checks and explicit authorization.

Status: `PROGRESS` on evidence, **HUMAN_REVIEW_PENDING**, MVP10-A `INCOMPLETE`, B `NOT_ELIGIBLE`; plan_changed `NO`.
