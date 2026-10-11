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
