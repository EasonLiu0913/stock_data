# MVP10-A | 20261008 1080p brand-preserving footer and CC-safe layout experiment — 2026-10-31

## Owner requirements and scope

Active project `daily-gainers-market-opening-end-to-end`, ultimate goal `goal-v3/MVP-10DAY-v1` (automatic genuine TWSE daily 5% video and eventually owner-authorized private YouTube upload). Frozen 20261008 historical date, scene1 only. Owner explicitly approved the 43.562s V4 first-scene preview as acceptable overall and stopped excess word-level clipping work. Original independent pinned-source GitHub CI Run **`41197655187`**, Job **`124526973513`**, 10/10 PASS. Prior research-only 1080p opt-in rendering entry executed locally, pixel output MP4 SHA `5004507086ee002c897744af0c607de7719d8878026e78c8901655e423479939`, byte-identical to independent V4 preview.

## Observed actual user-visible issue and objective

Unmasked original scene1 bottom region (1080p y=928..1080) includes historic footer:
- `TAIWANSTOCK｜每日5%強勢股研究` at left;
- `歡迎打開 CC 中文字幕觀賞` at right;
- `1/9` at far right.

Original progress UI occupies **y=815..928**. The initial external SRT libass player simulation overlapped the progress region. Previous research matte y=928..1080 fixed the subtitle overlap by **hiding the footer**, but this was not production-grade because brand/hint/scene index disappeared. Research exercise is a **brand-preserving replacement layout**, no full 9-scene render, no YouTube.

## Actual non-destructive local experiment

Using existing 1920x1080, 24fps, source-validated V4 43.562s AAC audio + video preview, created a separate transparent overlay PNG which **only replaces the footer panel at y=1040..1080** and redraws the same three original pieces of footer text. Original research MP4, historical MP4, main renderer, external source SRT remain unchanged. This preserves source semantic branding but **redraws the text rather than retaining exact historical pixels**. Reencoded a new **isolated research-only** MP4:
- `20261008_scene1_BRANDED_SAFE_FOOTER_V2_external_srt.mp4`, SHA-256 **`1c67e06f70fd075ea9ca898a5d921503118a6fdef2d79a3309624580a3dbd394`**.
- Full-HD **1920×1080, 24fps, 1045 frames**, video **43.541667s**, audio **43.562s**, ~20.333ms (less than one frame) difference.
- Source AAC `-c:a copy`; no fresh TTS, no new lip movements, captions **NOT burned into the MP4**.
- Recreated footer overlay PNG SHA-256 **`7104747ca37dbc61c93aa0b9e9942fb8f504ebabe11e28f623e282226742a2fe`**. Brand text at left, CC hint at right and `1/9` on far right, all within y=1040..1080.
- Preserved original frozen SRT SHA-256 `adf0c086bc5c73cf0a3cb9604adad90c2112264381f5b3517dcbba919cfb9024`. For *display simulation only* used two-line candidate SRT SHA-256 `0444eee2215449451afe71277e746a564107414b5c56956b83e845d1bac56724`. Independently checked all 14 cue IDs, individual timestamps, and concatenated character text exact-match; derivative breaks lines, not content or times.
- Three real decoded source frames with independent subtitle filter `FontName=Noto Sans CJK TC, Fontsize=14, Alignment=2, MarginV=13, Outline=1`, timestamp **8.4s** (owner-approved V4 phrase), **20.0s** (long two-line cue), **35.0s** (later cue), visually inspected after correcting an earlier FFmpeg `-ss` ordering problem that falsely produced no subtitles. All three sampled frames show subtitle visually separate from progress bar and new footer, brand and CC hint readable. This is **manual sampled LIBASS simulation PASS**, *not* arbitrary-player/YouTube CC PASS.
- Contact sheet `brand_caption_three_frame_contact.jpg` SHA-256 **`6506f20d7352a1ee443094854353323aa12d5d4239ded4b4587a82743ca75066`**.
- Manifest `branded_footer_layout_receipt.json` SHA-256 **`9c101a9712196471709bda1ae383382936bfea0173c58ec9dc4e98009e00003d`**.
- Local bundle `mvp10_brand_preserving_footer_RESEARCH_ONLY.zip` SHA-256 **`62dfdd94c896f3135ae40d37627b144a87f83bc182b83d422bc1efce0def3be3`**, includes research MP4, both SRT variants, 3 sample stills, contact sheet, footer overlay and receipt. No media committed to GitHub or published.
- Local reproduction scripts `/mnt/data/mvp10_footer_layout_research.py` (initial prototype), `/mnt/data/mvp10_footer_layout_research/make_footer_v2.py` (final branded layout), and `make_receipt.py` (14-cue fidelity assertions, output metadata/hashes). The initial `MarginV=65` did not display subtitles in the intended safe region; test snapshots showing no captions were rejected. `MarginV=25` overlapped progress; `MarginV=8` with larger font overlapped footer. Only the smaller `Fontsize=14/MarginV=13` V2 controlled simulation was accepted for **research screenshot layout**.

## Crucial limitations / required future acceptance

1. This is **not an official YouTube external SRT player test**. A video can only guarantee uncontaminated safe area; the actual user's YouTube CC font size/position varies. The `Fontsize=14` simulation is relatively small and readability on mobile requires owner/real-player testing before formal PASS. Do not replace frozen SRT with the derivative without independent confirmation.
2. The historical first scene still shows original `總長 05:44` and `第1/9段` progress for a historical full nine-scene video, while the isolated research clip is 43.562s. This is *historical context*, not valid final per-scene or total-video timing. Full standalone episode progress must be recalculated in integrated renderer.
3. The fourth-line V4 inserted 1.850s is still video-frame-held and does not yet move presenter mouth. Owner's original overall preview acceptance is not a formal face/lip QA PASS.
4. Single scene only. 1080p first-scene research output does not satisfy original 5–10 minute complete video, source-evidenced stock section data, full dynamic progress UI, final caption playback, private YouTube pilot or original immutable A/B criteria.
5. No new GitHub CI; existing real Run `41197655187` tested source re-import only. No `main`, production renderer, production upload/schedule, credentials or release lock changed. Publication explicitly FALSE.

## Next highest-value Goal-Anchored action

The bottom caption/footer conflict is now **resolved in a limited, controlled three-frame visual prototype** while retaining source-brand semantics. The next action is to turn the tiny layout rule into an **opt-in source-verified research-only rendering overlay** with simple positive and negative tests, then validate with real player and branded footer using sufficiently legible two-line subtitles. At owner-authorized transition, integrate only the minimum layout change into the formal full 9-scene flow under frozen A/B; never treat a screenshot prototype as a finished release. Prefer progressing to genuine full-scene evidence and private pilot rather than repeating source/word metadata.

Research status **PROGRESS**, MVP10-A **INCOMPLETE**, Prompt B **NOT_ELIGIBLE**, plan_changed **NO**; automatic continuation allowed only within isolated A scope.
