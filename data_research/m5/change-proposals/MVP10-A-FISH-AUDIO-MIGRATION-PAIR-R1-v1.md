# MVP10-A Fish Audio timestamped migration — preregistered paired prompts R1

Change proposal: `data_research/m5/change-proposals/MVP10-A-FISH-AUDIO-MIGRATION-CHANGE-PROPOSAL-v1.md`  
Parent: `MVP10-A-TTS-PERSISTENCE-R1` (incomplete; provider superseded prospectively only)  
Phase / round: `MVP10-A-FISH-AUDIO-TIMESTAMP-MIGRATION-R1`  
Owner authorization: explicit in the 2026-11-09 conversation; scope change and merge-after-checks authorization recorded in the proposal.  
This pair is frozen before Prompt A work starts.

## Prompt A — implementation and evidence

Continue the `daily-gainers-market-opening-end-to-end` project. Read `AGENTS.md`, the canonical handoff, task routing, proposal above, and verify current remote `main` before changing anything. Keep the historical Edge contracts and failures immutable.

1. Implement an isolated Fish timestamped TTS migration test for the exact frozen 20261103 scene 1. The test must send the explicitly specified model, reference ID and speed, save MP3/alignment/provenance evidence as a short-retention artifact, and never commit, render, deploy, or publish.
2. Add deterministic parser regressions for multiple SSE events, audio concatenation, latest-wins alignment replacement, chunk offsets, no-alignment failure, text coverage failure, and invalid timing. Run the focused tests and repair any verified defects without weakening acceptance.
3. Merge only after required PR checks are complete and passing, under the owner's standing merge authorization. Then manually dispatch the dedicated test workflow once. Inspect the actual run, job logs, request manifest and artifact; verify every proposal acceptance field. Preserve all failed runs and artifacts.
4. If the test API call fails, inspect its new log and response metadata, locate the failing boundary, change a real input/code defect, then perform one bounded test on the changed input. Never replay an identical failed request to create a green run.
5. After API test PASS, continue the Fish integration within this same Prompt A: update the production synthesizer and date-scoped recovery/checkpoint path to use the new provider identity and alignment conversion; preserve successful Edge checkpoints without treating them as Fish-compatible. Add focused integration tests and make required existing tests pass without lowering their assertions. Ensure there is no Edge fallback. Production Render dispatch remains gated by its existing authorization and all original formal inputs.
6. A completes only when the Fish test artifact passes the proposal's duration/audio/alignment checks, the production migration is integrated and hash-identified, focused and required regression checks pass, and all expected code/handoff artifacts are durable on remote `main`. Otherwise record exact blocker and continue only when its external dependency changes. Stop before Prompt B.

Forbidden: rewriting old A/B acceptance or failures; changing official facts; reusing Edge audio as Fish; changing publication locks; YouTube actions; Pages deployment; unauthorized Render dispatch; secrets in code/logs/artifacts.

## Prompt B — independent closeout (pre-registered before A)

Run only after Prompt A reports durable completion, then fetch current `main` and independently verify:

1. Proposal and pair identities remain unchanged; parent Edge acceptance/history and original FAILED/R2 records remain present and unmodified; owner-authorized phase transition is recorded in canonical handoff and task state.
2. Dedicated workflow is `workflow_dispatch` only, has no write/deploy/publish permissions, uses the exact plan blob/text identity, model `s2.1-pro-free`, reference ID, speed `1.15`, one request, and never prints the key.
3. The successful live run's `text/event-stream`, MP3 codec/sample-rate/channel/duration, request manifest fingerprints, artifact contents and SHA-256 values independently satisfy every migration-test threshold. The artifact exists remotely and has seven-day retention.
4. SSE parsing appends all audio transport chunks, replaces alignment per `chunk_seq`, adds chunk offsets once, fails closed on missing/invalid/gapped/low-coverage alignments, and converts timestamps correctly for downstream captions. Focused regressions and production workflow validation pass.
5. Fish production manifests fingerprint provider/endpoint/model/reference/speed/format/parser, source plan and scene text; mismatched Fish or legacy Edge records cannot be reused. Existing Edge checkpoints remain preserved and are not mislabeled. Only missing/invalid Fish scenes are requested with serial fresh-runner bounds; successful matching scenes are reused across runs.
6. Render-only reads the exact date checkpoint, validates full scene coverage and MP3/alignment hashes, makes no TTS request, and fails closed on a mismatch. Any actual render is allowed only if the date's existing official gates and trigger authorization are already satisfied; verify output MP4/SRT/media QA/provenance if such an authorized run exists. Do not invoke YouTube, Pages, public release, or change the release lock.
7. All expected files, tests, commits and workflow run/artifact identities are on remote `main`; no green-but-incomplete persistence. Record plan changed yes, remaining project phases, and precise next phase or stop dependency.

On any failure, repair only the cause within this pair and rerun the changed test once; preserve the original failing run. If a required source/permission gate is unavailable, record WAITING_* and stop without weakening criteria.
