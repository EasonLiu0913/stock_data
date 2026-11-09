# CHANGE_PROPOSAL — Fish Audio timestamped TTS migration v1

Status: **OWNER-APPROVED SCOPE CHANGE; implementation and verification in progress**  
Project: `daily-gainers-market-opening-end-to-end`  
Parent phase: `MVP10-A-TTS-PERSISTENCE-R1` (preserved incomplete; superseded for provider selection only)  
New phase: `MVP10-A-FISH-AUDIO-TIMESTAMP-MIGRATION-R1`  
Date: 2026-11-09 (Asia/Taipei)

## Owner decision and observed evidence

The owner explicitly authorized a full migration to the Fish Audio API flow, new acceptance rules for the different model and explicit speech speed, and repair of whatever tests are required. The owner also authorized merging PRs after experiments and checks complete without requesting a separate review.

Evidence motivating the proposal:

- The frozen Edge TTS production path repeatedly failed with `NoAudioReceived` after the exact date plan, scene text, voice, and rate identity had been verified. Preserved failures include scheduled recovery runs `42573281885`, `42573991757`, and `42579312709`; none is rewritten as PASS.
- The isolated Fish Audio standard endpoint test succeeded in run `42585154474`, producing a 299,675-byte MP3 artifact `13659261499`. This proved basic MP3 synthesis only; it did not test explicit prosody speed or timestamped alignment.
- The owner supplied reference model ID `e7af89da8abc4fbdacd9a10ab9881933` and confirmed `FISH_API_KEY` is configured as a GitHub Actions secret. The secret value must never be emitted or stored in repository files.
- Official API documentation identifies `s2.1-pro-free` as a supported model header, accepts `reference_id`, and documents `prosody.speed` as a multiplier. The timestamped endpoint streams SSE audio chunks and latest-wins cumulative alignment snapshots. See https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech and https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech-stream-with-timestamps.

## Requested change

Replace Edge TTS as the active provider for this project with Fish Audio's timestamped streaming API, including date-scoped checkpoint generation and the existing Render-only consumer. Keep all established editorial, official-source, transcript, caption, media, and publication safety rules unless this proposal explicitly version-controls a provider-specific field below. This change does not authorize YouTube upload, scheduling, public release, Pages deployment, release-lock changes, or an unapproved Render dispatch.

## New provider-specific contract (v1)

Each scene identity must bind:

1. Frozen date-plan SHA-256, scene ID, normalized narration SHA-256, and exact narration source.
2. Provider `fish.audio`, endpoint `/v1/tts/stream/with-timestamp`, model header `s2.1-pro-free`, voice `reference_id=e7af89da8abc4fbdacd9a10ab9881933`.
3. Explicit `prosody.speed=1.15` (Fish's documented multiplier; selected as a nominal +15% candidate, not assumed acoustically equivalent to Edge's `+15%`), format `mp3`, sample rate 44,100 Hz, bitrate 128 kbps, `normalize=false`, language `zh-TW`, and pipeline/parser version.
4. MP3 SHA-256/byte count and timestamp-alignment SHA-256. Fish alignment is retained as a versioned JSON asset and converted to the project's existing word-boundary consumer schema only after an independently tested conversion.

The test and production path must make exactly one serialized API request per missing scene per physical runner, retain the current maximum of three missing scenes per invocation, use fresh runners for physical batches, and persist per-scene outputs before proceeding. Reuse only when plan, scene text, provider, endpoint, model, reference ID, speed, audio format, parser/pipeline version, MP3 hash, and alignment hash all match. Fish output must never be mislabeled as Edge output. No silent provider fallback is permitted.

## Acceptance rules for the migration test

Use the exact frozen 20261103 market-opening scene 1 from `research_pending/daily-gainers-render-scripts/20261103.json`:

- The request records the frozen plan and spoken-text hashes, correct endpoint/model/reference ID, and explicit speed `1.15`.
- Response is HTTP 200 `text/event-stream`; every base64 audio chunk is concatenated in order; the latest cumulative alignment snapshot replaces earlier snapshots for each `chunk_seq`; global word times add `chunk_audio_offset_sec`.
- Output is decodable mono MP3 at 44.1 kHz/128 kbps, has nonempty audio and alignment, has at least 95% normalized spoken-character coverage, valid monotonic boundaries within media duration, and full text-chunk sequence coverage.
- Actual market-opening audio duration remains 60–90 seconds, preserving the parent charter's duration requirement.
- Workflow uploads the MP3, alignment JSON, request manifest, and media probe report as a seven-day **test-only** artifact. No transcript payload, key, render, commit, deployment, or publication is sent elsewhere.

Passing this isolated test demonstrates API/format/alignment viability for one frozen scene; it does not by itself prove perceptual voice quality, full-script resilience, checkpoint reuse, Render compatibility, or overall project completion.

## Preserved constraints and history

- Original MVP10-A/B frozen pairs, historical FAILED R1/R2 outcomes, Edge diagnostics, and all previous acceptance remain immutable evidence. They are not retroactively passed or erased.
- This proposal is a new prospective provider-specific acceptance version. It does not alter official numerical source gates, source-date FIFO, 60–90-second editorial requirement, transcript/subtitle parity, media QA, or YouTube prohibition.
- Current phase status changes only through this explicit owner-approved supersession. Parent persistence work remains recorded as incomplete, not PASS.

## Options and tradeoffs

- Keep retrying Edge: rejected by owner after repeated transport failures; does not meet the requested provider change.
- Use Fish standard `/v1/tts` only: already proves MP3 creation but has no timestamped alignment in the tested response; insufficient for production captions.
- Use Fish `/v1/tts/stream/with-timestamp`: selected; provides audio plus alignment in one request, with new parser and renderer-compatibility work and a potential MP3 chunk-boundary risk to verify.

## Rollout boundary

The migration is complete only after the preregistered Prompt A implementation/integration gates and independent Prompt B checks pass. Until then, keep the existing production provider behavior and release locks unchanged. Even after migration closeout, only the explicitly authorized date-scoped Render-only path may run after all original production gates pass; publishing stays forbidden.
