# MVP10-A-R2 TTS Request-Shape Experiment Pair v1

Status: FROZEN BEFORE IMPLEMENTATION
Proposal: `data_research/m5/change-proposals/MVP10-A-R2-TTS-REQUEST-SHAPE-EXPERIMENT-CHANGE-PROPOSAL-v1.md`
Owner-authorized: 2026-11-08, TTS-only request-shape test in GitHub Actions.
Parent phase: `MVP10-A-R2-INCLUSIVE-ELIGIBILITY`; parent acceptance and R2 Prompt A/B remain unchanged.

## Prompt A — isolated experiment

1. Read current remote `AGENTS.md`, this proposal and pair, the canonical handoff, Task State and current main.
2. Implement one isolated TTS-only Action experiment using the exact 20261104 pending candidate blob `f690c703058a4367ac1f619dd786d61f9d55eab0`; do not materialize the production video or use the Render-only workflow.
3. Compare one combined MP3 with ten MP3 outputs generated from the same ordered narration. Pin Edge TTS 7.3.1, `zh-TW-YunJheNeural`, `+15%`. Record the actual WebSocket connection count because edge-tts may split text at 4,096 bytes.
4. Keep requests serial, no retries, at most 15 actual WebSocket connections total, 2.5-second spacing within the ten-output case and 15 seconds between variants. If preflight predicts more than 15, stop before contacting TTS.
5. Add deterministic offline tests for exact text coverage/order, ten-way partitioning, expected connection cap and payload-free telemetry.
6. The GitHub Actions workflow must auto-run on `pull_request` to `main` when only its bounded experiment paths change. Grant `contents: read`; upload diagnostic JSON and temporary audio as an Actions artifact. No Render, Pages, YouTube, deploy, or write step.
7. Create a draft PR from a separate branch so the PR event auto-triggers the experiment without pushing implementation to main. Observe the actual run and artifact. Treat TTS provider failure as an experimental observation, not a successful audio result; the diagnostic workflow may complete while reporting failed synthesis, provided all observations are retained and the hard cap is respected.
8. Checkpoint exact run/job/artifact, source blob, connections, timing and outcomes on the branch. Do not merge the PR or execute the parent Prompt B automatically.

Prompt A is complete only when code and the frozen pair are durably available on the PR branch, offline tests pass, the automatic Actions run completes, and its artifact verifies both variants' actual connection counts and outcomes (or records a precise external block). This does not complete parent MVP10-A.

## Prompt B — independent closeout

After explicit owner command, independently verify:
- the frozen pair predates implementation and no proposal/acceptance drift occurred;
- exact source blob and ordered narration coverage in both variants;
- actual WebSocket connection counts, timestamps, delays, no retries, and the 15-connection hard cap;
- no transcript or payload in diagnostic JSON; audio exists only in the Actions artifact;
- automatic PR trigger, actual run/job/log/artifact, and absence of Render, Pages, YouTube, publication, or release-lock actions;
- PR remains unmerged; parent MVP10-A remains incomplete and its original acceptance unchanged.

Close only this experiment subround. Never infer a provider request quota from one experiment or alter the production TTS behavior based on it.
