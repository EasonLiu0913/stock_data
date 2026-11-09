# Proposed paired prompts — Fish zero-duration compatibility R2

Status: **DRAFT ONLY — not eligible to run until Proposal v2 is owner-approved and this pair is committed to main**
Proposal: `data_research/m5/change-proposals/MVP10-A-FISH-AUDIO-MIGRATION-CHANGE-PROPOSAL-v2.md`
Current frozen pair: `data_research/m5/change-proposals/MVP10-A-FISH-AUDIO-MIGRATION-PAIR-R1-v1.md` (immutable)
Project: `daily-gainers-market-opening-end-to-end`
Proposed round: `MVP10-A-FISH-AUDIO-TIMESTAMP-MIGRATION-R2`
Base main when drafted: `9ddd3838a33571fd2d65cee923a99bf40f1cfd10`

## Prompt A — implementation, only after explicit owner approval

Continue only if Proposal v2 is owner-approved, this exact paired prompt is on current main, and the owner explicitly starts Prompt A. First read repository `AGENTS.md`, the canonical handoff, task routing, Proposal v2 and this pair; verify current remote main. Do not edit or reinterpret R1's frozen pair, test thresholds, or failed runs.

1. Implement only the approved zero-duration mapping in `scripts/fish_audio_timestamp_stream.py`. Preserve provider text and exact offsets; emit a zero-tick WordBoundary for an exactly equal provider interval. Do not synthesize duration or move neighbors.
2. Keep separate failure classes for negative/non-finite/out-of-range intervals, backward ordering beyond existing tolerance, positive intervals collapsed by numeric conversion, and positive intervals rounded to zero 100 ns ticks.
3. Verify the consumer path in `scripts/daily_gainers_subtitle_alignment.py::align_cues` and SRT generation. Zero-duration words must remain in text coverage; generated SRT cue intervals must remain positive and monotonic. If a zero offset at a cue transition cannot satisfy that, fail closed with the registered distinct cue-transition error.
4. Add focused offline regressions for the Fish documented `start == end` example, exact text/offset preservation, 100 ns duration zero, cue coverage, valid SRT, and each distinct time violation. Keep existing positive-submicrosecond precision and all unrelated regression assertions.
5. Persist only payload-free diagnostics needed to retrieve the offending timestamp classification after failure. Never log credentials or add unrequested transcript/audio content to failure logs.
6. Run the focused tests and required PR checks. Preserve original run #12. Merge only after all registered checks pass under the owner's standing merge authorization.
7. After merge, perform at most one live test dispatch on the changed main implementation and exact frozen scene. Inspect actual run/job/artifact and confirm the acceptance fields above. Do not dispatch if proposal/pair are not approved and on main. Stop if the single bounded validation fails; analyze its new evidence before proposing any further run.

Prompt A completes only when the approved behavior is implemented, the single bounded live run passes all registered conditions, and the code, tests, proposal/pair identity, and evidence are durable on remote main. Do not run Prompt B in the same turn.

## Prompt B — independent closeout, pre-registered before A

Run only after Prompt A reports completion. Verify current main and independently check:

1. Proposal v2 owner approval and pair identity are on main; R1 proposal/pair and historical Edge/R1/R2 results remain unchanged.
2. `build_global_timeline()` distinguishes zero, negative, non-finite, out-of-range and ordering violations; positive intervals do not collapse from float/rounding conversion.
3. An exactly zero Fish interval is preserved as text plus exact offset and `duration: 0` in WordBoundary; no interval is stretched, shifted, merged, or silently dropped.
4. `align_cues()` retains text coverage using boundary text/offsets and the SRT output remains strictly positive and monotonic. A boundary that cannot produce a valid cue fails with the distinct registered diagnostic.
5. The one changed-code live run used the frozen date/scene and provider identity, made one request, met the 50-second minimum with no upper cap, and produced verifiable short-retention evidence. No unchanged-input retry was run.
6. Required focused tests and workflow safety checks pass. No production checkpoint, Render, Pages, YouTube, upload, scheduling, or release-lock change occurred.

If any criterion fails, preserve original runs and return to the same approved bounded repair scope. Do not weaken criteria, rewrite R1 history, or automatically start another round.
