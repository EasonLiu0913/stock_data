# M7 Chapter Timeline Bug — Handoff v3 addendum

- Active: Prompt A / M7 chapter timeline repair.
- Baseline: Run 38153604549; source original audio 7 MP3, 79.416 seconds; estimated 14-cue SRT unchanged.
- PROGRESS (CI VERIFIED Run 38154655409): added data_research/m5/m7-research-chapters.json, independent chapter_timeline(), chapter-manifest.json render output and test_m7_chapter_timeline.py; CI regression gate added before private rendering.
- Research-only chapter partition: original audio scenes [1,2,3] = chapter 1 opening; [4],[5],[6],[7] = chapters 2–5. Duration is cumulative from source MP3 manifest, never invented 60–90 seconds. Production 14-chapter plan remains separate and must preserve its full 60–90 second opening when the longer narration is produced.
- Run 38154655409 on 23398c753f87a907e24331718193d30305395b14: SUCCESS; M7_CHAPTER_TIMELINE_PASS opening_scenes=1,2,3 chapters=5 audio_seconds=79.416; M6_M7_PRIVATE_1080P_PASS duration=79.514 scenes=7 chapters=5 subtitles=14 acoustic=0/15 release=BLOCKED. New private artifact ID 11708286197, contains MP4, chapter manifest, review proof, estimated SRT and sampled frames. Chapter regression COMPLETE; M7 full visual acceptance still awaits human review.
- Next research direction: inspect the regenerated MP4 at the actual opening MP3 boundaries, presenter, progress layout and subtitle safe area. Do not mark full M7 visual COMPLETE until content review. Keep publication locked.
- Locked: no TTS, original evidence edits, Prompt B, production, cron, Pages, YouTube or publication. Release BLOCKED; acoustic evidence 0/15; TIMING_ESTIMATED_NOT_SYNC_VERIFIED.
