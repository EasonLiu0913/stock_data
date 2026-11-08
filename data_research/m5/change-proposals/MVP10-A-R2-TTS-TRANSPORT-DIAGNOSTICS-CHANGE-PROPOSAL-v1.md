# MVP10-A-R2 TTS Transport Diagnostics Change Proposal v1

Status: OWNER-AUTHORIZED, NARROW DIAGNOSTIC SUBROUND  
Owner authorization: user instruction in Codex conversation, 2026-11-08 (Asia/Taipei): “授權一個窄範圍、版本化的 TTS 診斷提案，先加傳輸層診斷再測”.

## Problem evidenced

The frozen MVP10-A-R2 render attempt failed repeatedly with Edge TTS `NoAudioReceived`. Existing logs record the exception but not the per-attempt elapsed time, WebSocket handshake result, close code, or received message types. The current synthesizer awaits one request at a time; the available 2.5-second versus 15-second comparison had the same 1/3 success rate, so neither concurrent flooding nor cumulative throttling is established.

## Objective and bounded scope

Add opt-in, redacted transport diagnostics around the existing pinned Edge TTS 7.3.1 WebSocket call, persist one diagnostic record per attempt (including failures), and expose that record in the existing Render-only diagnostic artifact. Then run automated tests and at most three low-volume, serial same-voice/same-rate synthetic smoke requests.

Capture only:
- attempt number and monotonic elapsed duration;
- Edge TTS/aiohttp versions;
- WebSocket handshake HTTP status when available;
- received WebSocket message type counts and byte counts (never payload text/audio);
- WebSocket close code and exception class when available;
- Edge TTS yielded chunk counts/bytes and WordBoundary count;
- high-level error class, with URLs, query parameters, headers, credentials, transcript, and payload excluded.

## Explicit non-goals and frozen behavior

Do not alter voice, rate, concurrency, inter-request delay, retry count/backoff, fallback policy, scene order, output audio/subtitles, validator thresholds, A/B acceptance, opening, script, eligibility, render scope, or publication locks. Do not dispatch Render-only, rerun the failed workflow, trigger Pages, or perform any YouTube upload/scheduling/publication. Do not infer a provider cause from diagnostics alone.

Parent `MVP10-A-R2-INCLUSIVE-ELIGIBILITY` and its original frozen Prompt A/B remain unchanged. The child round is diagnostic only and cannot make parent A complete or B eligible.

## Planned files

- `scripts/daily_gainers_tts_transport_diagnostics.py` — opt-in, fail-closed-safe telemetry wrapper/helpers.
- `scripts/synthesize_daily_gainers_tts.py` — emit redacted per-attempt observations without changing synthesis semantics.
- `.github/workflows/daily-gainers-date-render-only.yml` — enable diagnostic mode for its existing TTS step and retain the diagnostic JSON in its existing failure artifact; no workflow dispatch.
- `tests/test_daily_gainers_tts_transport_diagnostics.py` — deterministic mocked transport tests.

## Authorization and stop conditions

This owner instruction authorizes only this versioned diagnostic proposal and its diagnostic implementation/test. Stop before any full render, production retry/rate/pacing change, provider switch, fallback, acceptance change, or publication action. Any such change requires a separate versioned proposal and explicit authorization.

## Paired verification

The immutable Prompt A / Prompt B contract is preregistered at `data_research/m5/change-proposals/MVP10-A-R2-TTS-TRANSPORT-DIAGNOSTICS-PAIR-v1.md`. Prompt B independently checks the files, tests, remote commit/blob evidence, telemetry redaction and absence of prohibited side effects. A Prompt B PASS closes only this diagnostic subround and returns to the parent R2 Prompt A, still WAITING_TTS until its original render/artifact acceptance is met.
