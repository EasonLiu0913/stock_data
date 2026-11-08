# MVP10-A-R2 TTS Request-Shape Experiment Change Proposal v1

Status: OWNER-AUTHORIZED, diagnostic-only subround
Owner instruction: 2026-11-08 — run only TTS request validation in GitHub Actions, automatically on PR changes; no full production render.

## Evidence and question

The 20261104 Render-only run recorded 48 TTS attempts: 16 succeeded and 32 failed with NoAudioReceived; failures began at scene 12 and scene 17 exhausted 12 attempts. Requests were serial. The artifact does not record inter-request timestamps, so a cumulative request-count threshold is unproven. The owner proposes comparing one combined audio output with ten audio outputs.

## Objective

Use the exact 20261104 private candidate narration as a fixed input. In an isolated GitHub Actions workflow, compare:
1. one MP3 synthesized from all scene narration joined in order;
2. ten MP3s synthesized from the same narration divided into ten contiguous, approximately balanced groups.

Measure actual WebSocket connections, timestamps, inter-connection gaps, message counts, close codes, audio bytes, WordBoundary counts, and success/failure per variant. Do not record narration text or audio payload in JSON logs. Store generated audio only as a temporary Actions artifact.

## Constraints

- Pin Edge TTS 7.3.1, voice `zh-TW-YunJheNeural`, rate `+15%` to match the failed run.
- Keep execution serial; use a 2.5-second gap between requests within the ten-file variant and a 15-second gap between variants.
- No retries. Count every actual WebSocket connection. Preflight expected internal 4,096-byte chunks; hard stop at 15 connections total. Target no more than 10 where the variant permits.
- One MP3 does not necessarily mean one server request: edge-tts may split the full narration into several WebSocket turns. Report the measured connection count and do not claim a one-request result unless exactly one connection occurred.
- No production TTS client/workflow changes, Render, YouTube, Pages, publication, or release-lock changes.
- Trigger automatically only on a PR targeting main when the experiment's paths change. The workflow has contents:read only and has no upload, render, deployment, or repository-write capability.

## Interpretation

This is a bounded feasibility comparison, not a statistically conclusive rate-limit study. Preserve per-request outcomes and elapsed UTC timestamps. TTS service failures are experimental observations; they must not be rewritten as workflow or product PASS. Never infer a provider quota from this single run.
