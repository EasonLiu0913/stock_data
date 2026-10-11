# M7 Chapter Timeline Bug — Handoff v3 addendum

- Active: Prompt A / M7 chapter timeline repair.
- Baseline: Run 38153604549; source original audio 7 MP3, 79.416 seconds; estimated 14-cue SRT unchanged.
- PROGRESS: added data_research/m5/m7-research-chapters.json, independent chapter_timeline(), chapter-manifest.json render output and test_m7_chapter_timeline.py; CI regression gate added before private rendering.
- Research-only chapter partition: original audio scenes [1,2,3] = chapter 1 opening; [4],[5],[6],[7] = chapters 2–5. Duration is cumulative from source MP3 manifest, never invented 60–90 seconds. Production 14-chapter plan remains separate and must preserve its full 60–90 second opening when the longer narration is produced.
- Blocker: New workflow dispatch and subsequent green CI / regenerated artifact have not been confirmed in this handoff. Do NOT mark M7 COMPLETE on source changes alone.
- Next research direction: manually dispatch .github/workflows/research-m5-r-multimodel-contract.yml on research/m5-r-weight-evidence-20261011; verify M7_CHAPTER_TIMELINE_PASS, inspect chapter-manifest.json and opening frames around each original first-three MP3 boundary, verify audio SHA and estimated external SRT unchanged. If CI fails, fix on research branch and rerun.
- Locked: no TTS, original evidence edits, Prompt B, production, cron, Pages, YouTube or publication. Release BLOCKED; acoustic evidence 0/15; TIMING_ESTIMATED_NOT_SYNC_VERIFIED.
