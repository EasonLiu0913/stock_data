# Daily Gainers Video Automation

Canonical handoff: `docs/handoffs/daily-gainers-video-automation.md`

## Current phase
First end-to-end proof: render and privately upload the 2026-10-07 daily 5% gainers video.

## Objective
Turn the already-published daily gainers research package into a 5-10 minute narrated video and upload it to the authorized YouTube channel as a private video.

## Frozen decisions / constraints
- Do not change the existing daily-gainers research, market-summary, or Pages production chain in this proof.
- Reuse final research artifacts; do not re-synthesize market claims during rendering.
- Initial YouTube uploads are always forced to `private` in code.
- Video QA requires 300-660 seconds and a non-trivial MP4 size.
- TTS preference: `zh-TW-HsiaoChenNeural`; fallback to gTTS, then espeak-ng.
- OAuth secrets remain only in GitHub Actions secrets:
  - `YOUTUBE_CLIENT_ID`
  - `YOUTUBE_CLIENT_SECRET`
  - `YOUTUBE_REFRESH_TOKEN`

## Completed
- `scripts/build_daily_gainers_video_package.js` builds plan, metadata, and SVG slides from raw + analysis-ai + final market-summary.
- `scripts/synthesize_daily_gainers_tts.py` creates narration audio with bounded fallbacks.
- `scripts/render_daily_gainers_video.js` renders 1080p scene videos and concatenates the final MP4.
- `scripts/upload_youtube.js` refreshes OAuth directly and uses YouTube resumable upload.
- `.github/workflows/generate-upload-daily-gainers-video.yml` performs full render, QA, private upload, and artifact retention.

## Evidence / validation
Pending first natural/manual trigger for `20261007`.

Expected inputs are already final and complete:
- `data_daily_gain_over_5/20261007.json`
- `data_daily_gain_over_5/analysis-ai/20261007.json`
- `data_daily_gain_over_5/market-summary/20261007.json`

## Current repository state
The video pipeline is isolated from production daily-gainers publication. It runs only on `workflow_dispatch` or a file under `video_jobs/daily-gainers/*.json`.

## Known problems / rejected approaches
- Do not upload public videos in this phase.
- Do not use the prior `googleapis` OAuth test path; raw OAuth refresh was proven by the owner and is the uploader implementation here.
- First proof uses deterministic static information-card scenes rather than generative video.

## Entry points
- `scripts/build_daily_gainers_video_package.js` — content plan / storyboard / YouTube metadata
- `scripts/synthesize_daily_gainers_tts.py` — narration
- `scripts/render_daily_gainers_video.js` — MP4 rendering and QA artifact
- `scripts/upload_youtube.js` — private YouTube upload
- `.github/workflows/generate-upload-daily-gainers-video.yml` — end-to-end runner
- `video_jobs/daily-gainers/20261007.json` — first proof trigger

## Next round
1. Trigger `20261007`.
2. Inspect the workflow job and logs.
3. If render/TTS/upload fails, repair only the bounded video pipeline and retrigger.
4. Close only when YouTube returns a video ID and the workflow summary reports PASS.
5. After proof, decide whether to connect video jobs to the normal daily schedule.

## Safety / stop conditions
- Never print OAuth secret values.
- Never publish as public/unlisted in this phase.
- Never modify research conclusions solely to satisfy video rendering.
- Do not mark proof PASS without a real returned YouTube video ID.

## Prompt A — Next-round implementation prompt
Verify remote main and this handoff, then execute the current 20261007 proof. Repair bounded video-pipeline failures until the workflow reaches a real private YouTube upload with a returned video ID. Do not alter existing daily-gainers research or Pages production behavior.

## Prompt B — Next-round closeout / verification prompt
Independently verify the successful 20261007 workflow run: final MP4 duration is 300-660 seconds, video artifact exists, TTS manifest records a successful engine for every scene, YouTube upload returned a video ID, uploader forced privacy=private, and no research/Pages production workflow behavior was changed. Record run ID and video ID here before closing.
