# M7 Chapter Timeline Bug — Handoff v3 addendum

- Active: Prompt A / M7 chapter timeline repair.
- Baseline: Run 38153604549; source original audio 7 MP3, 79.416 seconds; estimated 14-cue SRT unchanged.
- PROGRESS (CI VERIFIED Run 38154655409): added data_research/m5/m7-research-chapters.json, independent chapter_timeline(), chapter-manifest.json render output and test_m7_chapter_timeline.py; CI regression gate added before private rendering.
- Research-only chapter partition: original audio scenes [1,2,3] = chapter 1 opening; [4],[5],[6],[7] = chapters 2–5. Duration is cumulative from source MP3 manifest, never invented 60–90 seconds. Production 14-chapter plan remains separate and must preserve its full 60–90 second opening when the longer narration is produced.
- Run 38154655409 on 23398c753f87a907e24331718193d30305395b14: SUCCESS; M7_CHAPTER_TIMELINE_PASS opening_scenes=1,2,3 chapters=5 audio_seconds=79.416; M6_M7_PRIVATE_1080P_PASS duration=79.514 scenes=7 chapters=5 subtitles=14 acoustic=0/15 release=BLOCKED. New private artifact ID 11708286197, contains MP4, chapter manifest, review proof, estimated SRT and sampled frames. Chapter regression COMPLETE; M7 full visual acceptance still awaits human review.
- Next research direction: inspect the regenerated MP4 at the actual opening MP3 boundaries, presenter, progress layout and subtitle safe area. Do not mark full M7 visual COMPLETE until content review. Keep publication locked.
- Locked: no TTS, original evidence edits, Prompt B, production, cron, Pages, YouTube or publication. Release BLOCKED; acoustic evidence 0/15; TIMING_ESTIMATED_NOT_SYNC_VERIFIED.


## Artifact 11708286197 direct visual inspection (Run 38154655409)
- Directly downloaded and inspected ZIP, MP4, chapter-manifest.json, review-proof.json, and extracted video frames on both sides of chapter boundaries.
- Actual chapter boundaries in seconds: 0.000, 8.136, 25.080, 38.280, 61.680, 79.416. Actual container duration 79.514323 (approximately 0.098 seconds overhead); H264 1920x1080 and AAC present.
- First three original audio scene panels at approximately 2, 4, and 7–8 seconds all display chapter 1/5 節目開場. 9 seconds is 2/5 資金與行情. Later frames around 25.08, 38.28, 61.68 change in semantic order. Chapter timeline regression is accepted; this does not certify acoustic sentence-level timing.
- Actual visual sampled at seconds 2, 36, 70 plus extracted boundary pairs: no baked subtitle covers progress or presenter because candidate.srt is separate optional CC. Cannot claim external player CC safe-area behavior without playback test.
- Visible VTuber is recognizably clear at 1080p in sampled frames, with changing mouth states, but renderer uses repeating mouth sprites and cannot claim phoneme synchronization.
- Remaining visual defects: segmented progress is binary active/inactive per whole chapter, with no continuous within-chapter fill, chapter elapsed/remaining time readout, or labels above individual segments. Slide layouts have substantial empty space in short opening, and current 79-second research script does NOT satisfy production 60–90-second market opening. These require renderer-only improvements or separate longer authorized narration in a future milestone; NEVER stretch or mislabel source audio.
- M7 disposition: chapter boundary FIX VERIFIED; FULL VISUAL ACCEPTANCE NOT COMPLETE. Research progress PROGRESS, release BLOCKED, acoustic 0/15, no Prompt B.
- Next: renderer-only intrachapter progress/time readout with deterministic timestamps and sampled visual regression; verify player-specific external CC safe area; maintain locked audio/text and do not automatically invoke publication.

## M7 frame-driven intrachapter progress — Prompt A
- PROGRESS (implementation submitted; new CI run and artifact not yet verified).
- Renderer now creates 24fps transparent progress overlays from cumulative original MP3 chapter timeline. Previous full-width active-segment highlight replaced with fractional fill; completed segments remain filled and future segments remain unfilled. Display ordinal/title, elapsed, remaining, and total clip time.
- Tests exercise 0/25/50/75% for each chapter and before/after all four chapter boundaries, including total clock conservation and 79.416 seconds original audio lock.
- CI captures 15 intrachapter progress frames and eight boundary-before/after frames, plus prior three baseline frames. Inspect actual rendered pixels before declaring full visual PASS.
- Original 7 MP3, fixed source narration, 14-cue estimated SRT and sha lock unchanged. Acoustic evidence 0/15, release BLOCKED, no TTS, Prompt B, production, cron, Pages or YouTube.
- Next: dispatch research workflow and inspect new Run logs and artifact. A green compile or mathematical regression alone is NOT proof of full visual acceptance.


## M7 market-opening visual restructure (latest active Prompt A)
- PROGRESS / CI PENDING. Research branch committed renderer and contracts; no new successful run or regenerated artifact claimed yet.
- Seven immutable original MP3 files and 14-cue estimated SRT remain untouched; all scenes 1–7 share sole chapter `市場開場`, with 79.416-second source clock.
- Independent visual plan: brand_opening = audios 1–3, market_cards = audios 4–5, flow_summary = audios 6–7. No verbatim narration as slide body; external CC retains full text. Market figures are fixed to values crosschecked against locked 20261008 narration, not dynamic fabricated data.
- Regression is fail-closed on chapters=1, audio_scenes=7, visual_scenes=3; progress math remains one continuous chapter. CI captures one frame from each visual type and archives both chapter-manifest and visual-scene-manifest plus review-proof.
- Current blocker: dispatch research workflow; inspect CI and actual 1080p MP4 for card typography, presenter overlap and progress before any full visual PASS. Original production locks retained, acoustic 0/15, no TTS or publication.

## M7 final four visual corrections — current Prompt A
- Active status: PROGRESS; source changes committed, new workflow run and MP4 Artifact not yet verified. Do not claim M7 COMPLETE.
- Renderer: market_cards adds 市場狀態：偏弱; flow_summary adds institutional volume reference ratio 9.91% and 3 concise bullet observations (weak market, volume below prior five actual trading days, follow institutional flows and breadth). Locked source narration still sole authority; no invented numbers.
- Regression now checks all required slide labels and explicitly prohibits using scene['display_text'] in renderer main. One chapter, seven audio cuts, three visual types remain fail-closed.
- CI extracts 7 audio-midpoint frames (audio-01 .. audio-07), as well as 3 scene representatives and progress samples; inspect actual frames for shared backgrounds, text placement, and VTuber occlusion before visual acceptance.
- Safety: original 7 MP3 hashes and source text unchanged; 14 SRT blocks retained with TIMING_ESTIMATED_NOT_SYNC_VERIFIED. TTS/Prompt B/production/cron/Pages/YouTube prohibited. release BLOCKED, acoustic 0/15.
- Next action: manual workflow_dispatch on research/m5-r-weight-evidence-20261011 from GitHub UI (current connector lacks dispatch), inspect resulting run logs and artifact, fix any failing research-only rendering.

## Run 38156332562 failure and bounded repair
- Run on commit 5231198 FAILED before M6/M7 rendering. The test incorrectly searched the whole renderer main() for scene['display_text']; that reference is essential to the locked speech/caption/display equality check, not slide painting. No regenerated 1080p MP4 in this run (the uploaded private review artifact is not a successful render).
- Research-only fix commit 9ae7b9267d2f3f9c63a318089c06577e3373a840 limits the no-verbatim-slide check to paint_scene(), and explicitly preserves the original narration integrity guard in main(). No source/MP3/SRT edits.
- Current status PROGRESS; repeat research workflow on latest branch and inspect M7_SLIDE_CONTENT_PASS, M7_OPENING_STRUCTURE_PASS, new review proof and seven midpoint frames. Release BLOCKED; no publication.


## Run 38156510901 — one-chapter/three-visual research acceptance
- Exact run head: 77bee80e74315c0ec4ce12405a81e5bf5b51e49b; workflow COMPLETED SUCCESS.
- CI reports M7_SLIDE_CONTENT_PASS, M7_OPENING_STRUCTURE_PASS chapters=1 audio_scenes=7 visual_scenes=3, M7_PROGRESS_MATH_PASS; renderer PASS movie=79.514323s source=79.416s subtitles=14, acoustic=0/15, release=BLOCKED. Artifact 11708184782 (m6-m7-private-review-38156510901).
- Directly downloaded and inspected archived seven midpoint PNGs in this review: audios 1/2/3 use identical brand visual base; 4/5 market metric cards with market weak status; 6/7 institutional flows, 9.91% reference and three concise observations. Every screenshot displays 1/1 市場開場; time labels and fill advance; male VTuber remains visible in lower-right. Full narration is not copied into slide body.
- Review-proof: 1920x1080; MP4 SHA256 879a3dca8682d188b103b77985b5e4a3b130eb61e45d723dc3cdee735269cdc9; locked SRT SHA256 1daf7a269c0a39ab8c9bab59048c6c36293ce5ee5a9e878bb8971f689126271f; source original MP3 hash check enforced.
- M7 opening-layout visual acceptance PASS for this research-only preview. Does not prove external player CC collision-free across players or actual phoneme alignment. TIMING_ESTIMATED_NOT_SYNC_VERIFIED and publication_authorized=false persist; production/YouTube/Prompt B/cron/Pages forbidden.
