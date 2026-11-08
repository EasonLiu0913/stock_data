# MVP10-A TTS Cross-Run Recovery — Frozen Prompt A/B Pair v1

Phase ID: MVP10-A-TTS-PERSISTENCE-R1
Change proposal: data_research/m5/change-proposals/MVP10-A-TTS-CROSS-RUN-RECOVERY-CHANGE-PROPOSAL-v1.md
Canonical handoff: docs/handoffs/daily-gainers-market-opening-end-to-end.md
Owner-authorized: 2026-11-08
Status: registered; Prompt A has not started.

This pair preserves all frozen MVP10-A requirements outside the TTS implementation. It does not mark MVP10-A-R2 PASS or change its historical WAITING_TTS result. The new phase must prove a resumable TTS path and complete the same date's remaining Render-only/visual acceptance before closeout.

## Prompt A — implement and produce durable evidence

Continue EasonLiu0913/stock_data.

Before work:
1. Read repository-root AGENTS.md.
2. Read docs/agent-prompts/goal-anchored-handoff-v3.md.
3. Read the canonical handoff at docs/handoffs/daily-gainers-market-opening-end-to-end.md.
4. Read this exact registered pair and the change proposal above.
5. Verify current main, active project, phase identity, the 20261104 official opening, final script/news inputs, existing TTS runs, and current workflow definitions. Do not rely on this prompt alone for current data.
6. Preserve the R2 WAITING_TTS history and the TTS request-shape experiment's independent PASS. Do not rerun unchanged failed inputs before fixing the persistence path.

Objective:
Implement TTS recovery that persists verified per-scene MP3 and WordBoundary outputs across separate GitHub Actions runs, retries only missing or invalid scenes, and makes the completed audio consumable by date-scoped Render-only.

Implementation requirements:
- Keep the frozen narration in the repository under research_pending/daily-gainers-render-scripts/YYYYMMDD.json only after the latest formal source/script/news validators pass. Never put it under video_scripts/daily-gainers/ because that path triggers the upload orchestrator.
- Keep text manifests/status on main under research_pending/daily-gainers-tts/YYYYMMDD.json. Record main/source commit, final script SHA-256, scene IDs/order, normalized text SHA-256, voice, rate, TTS package/pipeline versions, artifact/checkpoint branch identity, per-scene MP3 SHA-256/size, WordBoundary, workflow run, and outcome timestamps. Do not include secrets.
- Store per-date MP3 and WordBoundary on tts-audio-pending-YYYYMMDD. Checkpoint every successful scene immediately. Do not put MP3 on main, force-push, or rewrite history.
- Add a date-scoped TTS-only workflow with schedule and workflow_dispatch. It must process the earliest eligible FIFO date unless an explicit valid date is supplied, and cap each invocation at three missing scenes. Each scene runs on a fresh Runner; strategy.max-parallel is 1; use randomized request pacing, bounded attempts, and cancel-in-progress: false. Earlier successful scenes survive later failures.
- Re-plan from the latest committed manifest/checkpoint before each fresh Runner job. Use deterministic scene order. A subsequent run must not request already verified matching scenes again.
- Bind reuse to final script SHA, scene ID/order, normalized speech-text SHA, voice, rate, pinned TTS engine/client, and pipeline contract version. If inputs change, invalidate only affected scenes and record the reason.
- Implement a complete-audio validator. PASS requires exact scene coverage/order, nonempty MP3s, matching file hashes, expected voice/rate/version, and WordBoundary structure suitable for the existing SRT/lipsync pipeline.
- Update .github/workflows/daily-gainers-date-render-only.yml to download the exact checkpoint branch/ref and fail before any render step unless the complete-audio validator passes. Render-only must consume saved audio and must not call Edge TTS.
- Keep upload, schedule, publish and release-lock behavior unchanged and closed. Do not invoke YouTube. Add a cleanup routine guarded by a verified receipt matching target date + final script SHA + audio manifest SHA; test only with fixtures. Do not integrate or execute cleanup against a real upload in this phase.
- Add regression tests for: partial success then second-run resume; no repeat request for successful matching scenes; missing/corrupt audio; invalid/missing WordBoundary; changed script/voice/rate/TTS version; out-of-order/duplicate scene IDs; concurrent/racing checkpoint writers; failed run retaining earlier scene output; incomplete manifest blocking Render; complete manifest accepted; cleanup requiring a matching upload receipt.
- Read all relevant project philosophy, daily-video delivery policy, existing TTS scripts/workflows and uploader path before implementation. Keep the change limited to this registered objective.
- Use a reviewable branch/PR. Verify every expected path, commit, Actions run/job/log, and durable checkpoint remotely. A green CI without remote checkpoint artifacts is incomplete.
- For the 20261104 date, run the TTS-only recovery over separate workflow runs until all scenes are complete. Verify that the next run reuses successes and requests only missing scenes. Then, only after the exact frozen script, all existing gates, and complete-audio validator pass, run the native date-scoped Render-only and verify MP4, SRT, thumbnail, 1080p Dashboard, VTuber, 21px captions, safe-area pixels, QA, SHA, and provenance. Do not use a PRIVATE video as substitute.
- Do not run YouTube upload/scheduling/publishing or change any lock. Do not claim project/MVP10-A complete until all frozen acceptance checks are satisfied.

Prompt A completion contract:
A is COMPLETE only after the cross-run recovery implementation is on latest main; 20261104 has exact durable script/audio checkpoints with complete per-scene WordBoundary evidence; at least two distinct workflow run IDs prove remote checkpoint reuse with zero TTS requests for already-valid scenes; a deterministic partial-failure regression test proves that a later invocation requests only missing or invalid scenes even if the live service happens to succeed completely on the first run; the Render-only workflow consumes those checkpoints without TTS requests; and the actual Render-only artifacts pass every frozen MVP10-A requirement. Otherwise checkpoint exact state as WAITING_* or BLOCKED, keep A incomplete, and stop. Never auto-run Prompt B.

## Prompt B — independent closeout

Run only after Prompt A reports COMPLETE and the owner invokes Prompt B for this exact phase.

Independently fetch current main and verify:
1. Active task, phase, proposal and pair identities are unchanged; MVP10-A-R2 remains preserved as not PASS; no history or frozen acceptance was overwritten.
2. The exact final narration file exists at research_pending/daily-gainers-render-scripts/20261104.json, passes current formal validators, and its commit/blob/source SHA matches the text manifest.
3. The TTS manifest and date checkpoint branch exist remotely. All scene IDs are present once and in order; each MP3 is nonempty and its bytes match its recorded SHA/size; each WordBoundary matches that scene's frozen normalized text and the existing alignment contract; voice, rate, engine and pipeline versions match.
4. At least two distinct Actions run IDs show a remote checkpoint restored by a later fresh Runner and zero TTS requests for already-valid scenes. If the live run had missing scenes, verify logs show only those scene IDs were requested; independently verify the fault-injection regression test forces a partial checkpoint and a later invocation requests only missing/invalid scenes. Confirm workflow/job/log identities and checkpoint commits/ref.
5. Failure tests show successful earlier scenes survive, corrupted or mismatched records are retried only for affected scenes, and concurrency cannot lose a committed scene.
6. The date Render-only workflow reads the exact complete checkpoint, does not call Edge TTS, fails closed on incomplete input, and its run produces real MP4, SRT, thumbnail, Dashboard/VTuber/caption/visual QA and provenance artifacts that satisfy the original frozen MVP10-A checks.
7. Upload-cleanup code refuses absent, mismatched, or unverified receipts. No cleanup ran against a real upload; no YouTube/upload/scheduling/publishing workflow or release lock changed.
8. All expected files, commits, runs/jobs/logs/artifacts are durable on remote main or the documented checkpoint ref; no uncommitted-only or expired-artifact evidence substitutes for them.

If any check fails, return FAIL/WAITING with exact evidence, preserve all durable successes, and request only a bounded repair within this frozen pair. Do not lower acceptance, change scope, start MVP10-B, or rewrite MVP10-A-R2 history. Prompt B PASS closes this phase only and makes the owner-authorized MVP10-A progression decision eligible; it does not enable YouTube publishing.
