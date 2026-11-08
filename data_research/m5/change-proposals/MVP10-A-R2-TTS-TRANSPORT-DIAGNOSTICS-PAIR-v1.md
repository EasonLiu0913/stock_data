# MVP10-A-R2 TTS Transport Diagnostics Pair v1

Status: FROZEN BEFORE PROMPT A  
Proposal: `data_research/m5/change-proposals/MVP10-A-R2-TTS-TRANSPORT-DIAGNOSTICS-CHANGE-PROPOSAL-v1.md`  
Owner-authorized: 2026-11-08, narrow diagnostic-only implementation and test.  
Parent phase: `MVP10-A-R2-INCLUSIVE-ELIGIBILITY`; parent R2 acceptance is unchanged.

## Prompt A — bounded implementation

Implement only the proposal above.

1. Read current remote `AGENTS.md`, this proposal/pair, the canonical handoff and Task State; verify `main` before editing.
2. Add opt-in transport telemetry for the existing pinned Edge TTS 7.3.1 call. Record elapsed time, handshake status, WebSocket message type/size counts, close code/error class, yielded audio bytes and WordBoundary count. Never record transcript, audio, full URL/query, headers, or secrets.
3. Preserve existing voice/rate, serial execution, 2.5-second inter-scene gap, retries/backoff, fallback prohibition, file outputs, and all validators. Diagnostic mode must not change control flow or convert a failed synthesis into success.
4. Add the diagnostic JSON to the existing Render-only failure artifact and opt in at the existing TTS workflow step. Do not dispatch/rerun any workflow.
5. Add deterministic mocked tests for handshake/message/close telemetry, exceptions, redaction, and unchanged yielded chunks/control flow. Run the targeted tests.
6. Run no more than three serial low-volume synthetic requests with the production voice `zh-TW-YunJheNeural`, rate `+15%`, and WordBoundary enabled; use at least 15 seconds between calls. Retain only redacted telemetry and aggregate success/chunk/boundary observations. If network access is unavailable, record the exact limitation and do not substitute a full render.
7. Commit the bounded changes to latest `main`, then read back every changed path/blob and test evidence. If remote write is unavailable, stop without claiming durable completion and retain local evidence.
8. Stop when this diagnostic contract is satisfied or a precise external/tool blocker is recorded. Do not execute Prompt B automatically.

Prompt A completion means the diagnostic code and tests are durably committed and remote-verified, targeted tests pass, and the bounded smoke was either completed with redacted evidence or explicitly blocked by a verified external/tool limitation. This does not complete parent MVP10-A.

## Prompt B — independent closeout (must run only after explicit owner command)

Independently verify:
- the registered proposal/pair are unchanged and precede implementation;
- only the four planned files changed (plus handoff/state checkpoint);
- diagnostic records contain no transcript, audio payload, URL/query, headers, or credentials;
- success and failure paths expose the specified transport fields, while synthesis still fails closed;
- targeted test results and bounded smoke evidence (or exact external blocker) are real and match the committed source;
- latest remote `main` contains every expected path/blob and the evidence checkpoint;
- no Render dispatch/rerun, Pages deployment, upload, scheduling, publication, release-lock change, retry/rate/fallback change, or parent acceptance change occurred.

Prompt B PASS closes only this diagnostic subround. Parent `MVP10-A-R2-INCLUSIVE-ELIGIBILITY` remains incomplete and WAITING_TTS unless its original criteria are independently satisfied. A failure remains a failure; repair only within this frozen diagnostic scope and repeat B. No automatic next phase or full render.
