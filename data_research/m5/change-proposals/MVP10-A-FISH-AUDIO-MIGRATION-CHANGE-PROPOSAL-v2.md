# CHANGE_PROPOSAL — Fish Audio zero-duration alignment compatibility v2

Status: **DRAFT — owner decision required; not approved for implementation**
Project: `daily-gainers-market-opening-end-to-end`
Current phase: `MVP10-A-FISH-AUDIO-TIMESTAMP-MIGRATION-R1`
Supersedes: none. This draft does not replace v1 or rewrite its paired Prompt A/B.
Base main: `9ddd3838a33571fd2d65cee923a99bf40f1cfd10`
Date: 2026-11-09 (Asia/Taipei)

## Decision requested

Approve or reject this prospective clarification: a Fish alignment segment with exactly equal finite start/end times is a valid zero-duration alignment point. Preserve the original word and exact offset in Fish alignment and WordBoundary output with duration `0`; never stretch, shift, merge, or silently drop the word to manufacture positive duration. Keep rejecting negative, non-finite, out-of-media, materially out-of-order, and positive intervals collapsed by the adapter.

No code acceptance or historical result changes unless this proposal is explicitly approved and a new paired round is registered before implementation.

## Evidence

- The isolated post-fix migration run #12 (`42644508359`), on main above, failed in synth job `129254107219` with `provider_zero_duration`. The failure is preserved. The following diagnostic-upload step was skipped, so the exact raw values for this run are unavailable.
- Fish's official timestamped endpoint example includes the word `to` with `start=15.6` and `end=15.6`: https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech-stream-with-timestamps
- Main's `scripts/fish_audio_timestamp_stream.py` (blob `dc74fa8b4914a2260e9d1e4834da3c116e12692a`) currently rejects equality in `build_global_timeline()` as `provider_zero_duration` and separately requires `end > start` in `timeline_to_word_boundaries()`.
- The downstream `scripts/daily_gainers_subtitle_alignment.py::align_cues` matches event text for coverage and uses event offsets for cue starts; cue ends are derived from the next cue start or media duration. It does not inherently require every word event to have positive duration. Non-positive generated caption cues remain invalid.

## Proposed Fish-specific acceptance clarification

1. Treat a finite provider interval with `start == end` as a zero-duration alignment point, not as a malformed provider interval.
2. Preserve its text and exact offset in the Fish timeline and WordBoundary record; serialize `duration: 0` in the existing 100 ns tick schema. Do not invent a minimum duration, alter neighboring intervals, or discard the entry.
3. Count the preserved text toward the existing normalized alignment-coverage threshold. Keep the existing minimum coverage unchanged.
4. The SRT consumer must still produce strictly positive, monotonic cue intervals. If an equal-offset boundary would make a caption cue non-positive, fail closed with a distinct cue-transition diagnostic. Do not repair that case by shifting timestamps or dropping spoken text.
5. Continue to fail closed with distinct diagnostics for negative duration, non-finite timestamps, negative starts, invalid chunk/media bounds, start-order violations beyond the existing tolerance, and positive provider intervals collapsed by numeric or 100 ns conversion. Equality must not hide any of those failures.
6. Keep the owner-authorized live test duration floor at 50 seconds with no maximum; do not restore the old 60–90-second test bound. Keep the already selected model, reference ID, speed, format, one-request limit, and frozen scene identity unchanged.
7. Preserve the current R1 proposal, R1 pair, all failed run IDs, and previous artifacts unchanged. This proposal is prospective only.

## Bounded verification required if approved

After the new paired Prompt A/B is frozen and implementation changes are merged, run at most one live timestamped test against the exact frozen scene on changed code. It must verify the audio contract, raw Fish alignment, zero-duration WordBoundary preservation, text coverage, valid SRT cue intervals, and separate diagnostics for provider-zero, provider-negative, adapter-collapse, and cue-transition violations. Preserve the run and short-retention evidence. Do not retry the unchanged failed request, render, deploy, publish, or alter release locks.

## Safety / rollout

This draft authorizes no code change, workflow dispatch, production checkpoint write, Render, Pages, YouTube upload, scheduling, or release-lock change. The original R1 remains incomplete until its owner-governed successor is explicitly approved and the applicable closeout rules are satisfied.
