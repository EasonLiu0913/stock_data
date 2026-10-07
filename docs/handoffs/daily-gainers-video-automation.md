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
The 20261007 render proof is now complete; YouTube upload is blocked only by the GitHub-stored OAuth client secret.

Concrete evidence:
- Full render run #7: `37669067644`
  - 14 scenes
  - duration: 581.514667 seconds / 9.69 minutes
  - MP4 size: 22.03 MiB
  - TTS: PASS
  - Render: PASS
  - Video QA: PASS
  - YouTube OAuth refresh: FAIL `HTTP 401 unauthorized_client`
- Full render run #8: `37669849128`
  - Render and QA: PASS
  - retained artifact: `daily-gainers-video-20261007`
  - artifact ID: `11503919731`
  - OAuth diagnostic from GitHub runner:
    - client ID prefix: `810401864826`
    - client ID length: 72
    - client secret length: 35
    - refresh token length: 103
  - OAuth refresh still returns `unauthorized_client`
- Upload-only run #1: `37670359664`
  - successfully downloaded the QA-passed 9.69-minute artifact
  - failed only at OAuth refresh with the same `unauthorized_client`

The repository owner independently proved the same OAuth flow locally with HTTP 200, access token PASS, and YouTube channel lookup PASS. Therefore the remaining mismatch is the GitHub-stored OAuth credential value, most likely `YOUTUBE_CLIENT_SECRET`, rather than the uploader implementation or refresh-token flow.

Expected inputs are already final and complete:
- `data_daily_gain_over_5/20261007.json`
- `data_daily_gain_over_5/analysis-ai/20261007.json`
- `data_daily_gain_over_5/market-summary/20261007.json`

## Current repository state
The video pipeline is isolated from production daily-gainers publication.
- Full generation: `.github/workflows/generate-upload-daily-gainers-video.yml`
- Upload-only retry from retained QA artifact: `.github/workflows/retry-upload-daily-gainers-video.yml`
- Full proof trigger: `video_jobs/daily-gainers/20261007.json`
- Upload-only trigger: `video_upload_jobs/daily-gainers/20261007.json`
- YouTube secrets are normalized for whitespace, optional `KEY=` prefixes, and wrapping quotes before token exchange.

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
- `.github/workflows/retry-upload-daily-gainers-video.yml` — upload-only retry from retained artifact
- `video_jobs/daily-gainers/20261007.json` — first proof trigger
- `video_upload_jobs/daily-gainers/20261007.json` — upload-only retry trigger

## Next round
1. Replace GitHub repository secret `YOUTUBE_CLIENT_SECRET` with the exact client secret from the local `.env` combination that already produced HTTP 200 from `https://oauth2.googleapis.com/token`.
2. Do not rerender the video.
3. Update `video_upload_jobs/daily-gainers/20261007.json` to retrigger the upload-only workflow from source run `37669849128`.
4. Verify OAuth refresh PASS, resumable upload PASS, and a real YouTube video ID.
5. Record the successful upload-only run ID and video ID here.
6. Only after that proof, decide whether to connect video jobs to the normal daily schedule.

## Safety / stop conditions
- Never print OAuth secret values.
- Never publish as public/unlisted in this phase.
- Never modify research conclusions solely to satisfy video rendering.
- Do not mark proof PASS without a real returned YouTube video ID.

## Prompt A — Next-round implementation prompt
Verify remote main and this handoff, then execute the current 20261007 proof. Repair bounded video-pipeline failures until the workflow reaches a real private YouTube upload with a returned video ID. Do not alter existing daily-gainers research or Pages production behavior.

## Prompt B — Next-round closeout / verification prompt
Independently verify the successful 20261007 workflow run: final MP4 duration is 300-660 seconds, video artifact exists, TTS manifest records a successful engine for every scene, YouTube upload returned a video ID, uploader forced privacy=private, and no research/Pages production workflow behavior was changed. Record run ID and video ID here before closing.
