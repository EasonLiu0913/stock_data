# MVP10-A research: verifiable reuse candidate for V4 fourth line (2026-10-31)

Status: **CANDIDATE / NOT APPROVED FOR PRODUCTION**, research only. Goal `goal-v3/MVP-10DAY-v1`; active project `daily-gainers-market-opening-end-to-end`. This is evidence of a real voice source, not a successful 20261008 replacement or completion of A/B acceptance.

## Original source and integrity

- Existing independently successful research Render-only CI **#41182709089**, artifact **#13036325288** `daily-gainers-video-20261013`, source branch `research/daily-video-mvp10-a-20261029`, source commit `002aa831fcd4be3ccfab6610253adfc7e5a37b06`.
- Artifact ZIP SHA-256: `fabeb1ca1464163dd072d5a5089c2c345f9527905a75de282c144bab86ab5ea6`. Source `daily-gainers-20261013.mp4` SHA-256: `47b27163fc74289373eedaf311897b44b651af83430018a0b2f07be1b6d9a474`. Independently recomputed from artifact bytes in working container.
- Artifact `tts-manifest.json`: `voice=zh-TW-YunJheNeural`, `rate=+15%`, `engine=edge-tts`; original scene 1 spoken text begins with all four unchanged frozen V4 sentences. It carries **155 genuine reported Edge WordBoundary events** for scene 1. The Artifact contains MP4, SRT, TTS manifest, QA and timing data, **not raw individual scene MP3 files**.
- The same Artifact SRT has the fourth sentence exactly `那麼我們開始囉。` from **00:00:07,930 to 00:00:09,778**. The four consecutive original TTS WordBoundary events for that sentence are:
  - `那麼`: offset `79304160`, duration `2826250` (100-ns ticks)
  - `我們`: offset `82130410`, duration `1956660`
  - `開始`: offset `84087080`, duration `2717080`
  - `囉`: offset `86804160`, duration `3587080`
- Previous word `哪` finishes at approximately **7.202166 seconds**; next word `今天` begins at **9.778250 seconds**. Source waveform silence detection found quiet stretches approximately **7.098–8.098** and **8.954–9.936** seconds (threshold -36dB and 0.12s duration); these support a possible bounded crop but are not a human listening/transcription certification.
- Historical `20261008` Artifact **#12953454424** supplies a nine-scene valid MP4 and matching `zh-TW-YunJheNeural` `+15%` Manifest for the **three-line** V3 opening; the **first 17 WordBoundary entries are byte-for-byte equal** to the first 17 events in the 20261013 four-line source. The historical 20261008 video does **not** contain the added V4 fourth sentence. Do not present it as V4 PASS.

## Bounded local extraction candidate (research evidence only)

- Source: `daily-gainers-20261013.mp4` AAC mono 24 kHz. Using FFmpeg, extract audio starting at **7.60 seconds**, requested length **1.85 seconds**, encode as MP3 mono 24 kHz 128 kb/s. This includes silence padding around the reported fourth line.
- Candidate output MP3: measured `ffprobe` duration **1.92 seconds** (includes codec padding), SHA-256 `b46c07dc7ec8bfa5c61c6efbb378a3af7de0acca3e9d43627d79c4120300fd14`. Independent recorded candidate lives only in the research working container; **it has not been uploaded to GitHub, published, or inserted into a video**.
- Independent decoded MP3 waveform check: non-silent sound is present (mean volume **-24.9 dB**, peak **-8.8 dB**). FFmpeg `silencedetect=noise=-36dB:d=0.12` found leading silence **0–0.498s** and trailing silence **1.354–1.850s**. These measurements support isolation of the utterance but cannot by themselves establish the words audibly spoken; listening/text audit is still required.
- Adjust event timestamps relative to 7.60 seconds by subtracting **76,000,000 ticks**. First genuine event begins at `3,304,160` ticks (0.330416s), last event ends at `14,391,240` ticks (1.439124s); all four events remain inside the measured 1.92s MP3.
- Local JSON evidence record includes original + relative events, hashes and caveats. It is not a replacement for listening or independent audio-content verification.

## Acceptance blockers before any integration

1. Independently review cropped audio for complete, audible exact original sentence **and absence of adjacent spoken text** (not merely matching SRT). Review how encoded silence and AAC-to-MP3 delay affect offsets.
2. For source reuse, bind source Artifact ID, source MP4 and manifest hashes, immutable spoken line and four real WordBoundary entries into a verified reuse receipt. No generic date rewrite or substitution for daily analysis.
3. If attempting scene-1 assembly, preserve exact existing 20261008 original narration for all other sentences; independently verify absolute timing, duration, subtitle coverage, VTuber, render scene count, and complete final MP4 against frozen A/B. This is **new media** requiring new acceptance.
4. **Do not** automatically import a cropped MP3 into the current TTS producer, run full Render-only, upload YouTube, change `main`, release locks or declare MVP10-A complete without proper revalidation/authorization. Only the exact immutable fourth sentence is cross-date reusable, never date-specific analysis.

## Additional official-compatible research route (not executed)

Microsoft Azure AI Speech documentation lists `zh-TW-YunJheNeural`, supports SSML prosody rate `+15%` and emits `WordBoundary` with audio offsets in 100-nanosecond ticks. Azure Speech SDK can therefore be evaluated as a distinct **same named voice** source, but requires its own Azure Speech resource credentials, permitted service use, matching text and audio/WordBoundary validation. No Azure credentials were accessed or supplied, and **no Azure test has been run**. Rate and voice label parity alone do not prove byte-identical audio.

## Governance

Research `PROGRESS` (genuine voice reuse candidate identified). **MVP10-A INCOMPLETE**, **MVP10-B NOT_ELIGIBLE**, `plan_changed=NO`. Earlier scene-1 pilot `41185747222` remains truly FAILED for direct Edge synth of line 4; this evidence offers a candidate recovery path, **not** a retroactive PASS.

## 2026-10-31 independent PCM-exact source/crop revalidation

- Rechecked locally from actual archived Artifact `13036325288` ZIP, rather than from prose alone: ZIP SHA-256 `fabeb1ca1464163dd072d5a5089c2c345f9527905a75de282c144bab86ab5ea6`; contained MP4 SHA-256 `47b27163fc74289373eedaf311897b44b651af83430018a0b2f07be1b6d9a474`; original `tts-manifest.json` SHA-256 `65e862d4bcec00c13c9aafa9541a8059440ad64261c35ad1e10a51ada7b0f0e9`. Original V4 fourth sentence is exactly the standalone SRT cue `00:00:07,930 --> 00:00:09,778`, with four consecutive manifest events indexed 17–20 (zero-based).
- A **lossless-in-decoded-PCM 24 kHz mono 16-bit WAV** was derived directly from the original MP4 AAC via `ffmpeg -i source_20261013.mp4 -vn -af 'atrim=start=7.6:duration=1.85,asetpts=PTS-STARTPTS' -ac 1 -ar 24000 -c:a pcm_s16le`. WAV SHA-256 `059f9403f614b7c83ecffdf625c3a18adaee21af66cf1f4f394dd0c079d71a40`; exactly **44,400 samples = 1.850 seconds**. The entire 44,400-sample WAV decoded PCM sequence is **bit-for-bit identical** to the independently decoded original source MP4's sample indices 182,400–226,799. PCM SHA-256 for BOTH is `b523babe9836a524cec541b4d8cdf2d415be235f3db611b1ea73f18814e6a676`. This establishes perfect source-sample identity for a research reuse candidate, NOT independently verified spoken semantics.
- Earlier MP3 candidate SHA-256 `b46c07dc7ec8bfa5c61c6efbb378a3af7de0acca3e9d43627d79c4120300fd14` decodes to **44,400 samples = 1.85s** despite MP3 container metadata duration **1.92s**. Comparing MP3 decoded speech region against original MP4 decoded speech gave an acoustic waveform correlation of about **0.999983** with best-match source origin **7.600 seconds** (no detected origin displacement). Use decoded PCM/sample count for exact timing, NOT MP3 `ffprobe` container length alone.
- Four source WordBoundary events rebase by subtracting 76,000,000 ticks, yielding offsets 3,304,160; 6,130,410; 8,087,080; 10,804,160 (100-ns ticks). Their durations are 2,826,250; 1,956,660; 2,717,080; 3,587,080 ticks. First event starts at **0.330416s**; last ends at **1.439124s**, both within the 1.850s WAV. The 20-ms frame RMS energy threshold -36dBFS finds primary audible energy roughly **0.50–1.36 seconds**. This offset between acoustic energy and nominal first/last event means **per-word acoustic alignment remains UNVERIFIED**. No fabrication of `WordBoundary` values; do not shift them to match energy without new independent evidence.
- Machine-readable, source-digest-bound GitHub research receipt is `docs/handoffs/mvp10-v4-line4-source-reuse-receipt-20261031.json`, first committed `5f148d59edb730466b57a332e9d349e70da2f578`. It records source, original/crop events, all hashes, PCM equality, pending independent listening and alignment gates. Media files were produced only in session working space and were **not uploaded to GitHub or inserted into production**.
- Verdict: **SOURCE_AND_PCM_CROP_VERIFIED / REUSE_PENDING**. Independent listening to the isolated WAV must verify intelligible exact V4 line 4 with no neighboring spoken words; separate timing review must decide whether original Edge event offsets align to this decoded AAC-derived waveform adequately for preregistered caption QA. Only then may one design an isolated 20261008 scene-1 composition; do NOT auto-run it now.
