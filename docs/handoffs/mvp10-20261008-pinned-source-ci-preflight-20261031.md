# MVP10-A | Pinned-source remote CI candidate (2026-10-31)

## Goal, restrictions, owner state

- Active Project: `daily-gainers-market-opening-end-to-end`; goal `goal-v3/MVP-10DAY-v1`; frozen research date `20261008`.
- Owner already explicitly approved the whole V4 fourth-utterance audio and the overall first-scene isolated AV preview, and directed stopping noncritical individual-word clipping research.
- Current phase remains **MVP10-A INCOMPLETE**; B **NOT_ELIGIBLE**; `plan_changed=NO`. This CI scope is a research-only source-integrity / source-reimport test, NOT a complete video or publication acceptance.
- No `main`, TTS production code, video renderer, release lock, YouTube credential, YouTube upload, Pages or formal schedules changed. No full nine-scene render.

## Pinned artifacts: validated live

GitHub Connector successfully re-downloaded the exact pinned historic artifacts using read-only artifact access:
- `12953454424`, date `20261008`, downloadable original ZIP SHA-256 `f3863f435e9606745562bb8d8513609f4d3a704769f1a390ac340ee921f24a04`; embedded MP4 SHA-256 `587918ab81e2fc111b08aa1a62e5ddf76e2079302c2aed5f5433e79cec410641`.
- `13036325288`, date `20261013`, downloadable original ZIP SHA-256 `fabeb1ca1464163dd072d5a5089c2c345f9527905a75de282c144bab86ab5ea6`; embedded MP4 SHA-256 `47b27163fc74289373eedaf311897b44b651af83430018a0b2f07be1b6d9a474`.
- The two archives were downloaded again independently via connector with identical ZIP SHA-256 hashes. No source relaxation, substitution, or new Edge TTS synthesis.

## Actual new research files and verified local reconstruction

Three files committed to **only** `research/daily-video-mvp10-a-20261029`:
1. `research/fixtures/20261008_scene1_v4_14cues_RESEARCH_ONLY.srt`, commit `79b837b002d5c2c3baff7f4338ac968e9572c46b`, Git blob `bea847aa0b2909ee316fe2dcd1553c6bae0eecf3`. Local reviewed SRT Git blob checked byte-exact equal; original SRT SHA-256 `adf0c086bc5c73cf0a3cb9604adad90c2112264381f5b3517dcbba919cfb9024`.
2. `scripts/research_build_pinned_scene1_fixture.py`, commit `1fd0cc33ba1d2aa1d5b96cef14c1ac68dbef7e0c`, remote Git blob `7fbed7d400a0b829eff9619640a024b46f58234e`. Python reconstructs source scene1 by FFmpeg PCM decoding pinned MP4s, splicing the exact 44,400 source samples at 7.600s into 41.712s original audio, producing 43.562s sample-exact 24kHz WAV SHA-256 `fc5598fcb5a4def1a3a0f1bf5d17609c12a7f065589c27109e8d50ce3ce06bc7`, real 128 source-derived word event timeline, and 14-cue audited SRT. Source ZIP, MP4, original line WAV, reconstructed scene WAV, MP3 and SRT SHA mismatches fail closed. The analogous Python reconstruction **ran locally against exact true ZIPs**, reproducing output WAV SHA and MP3 SHA `3721fc4e80f2ab875499fdb9faf68c382c8775dfb9397000f150de5474c043e6`; the 10 original committed validator unit tests then passed locally.
3. `.github/workflows/research-mvp10-pinned-scene1-ci.yml`, commit `66985500a143ea9623661303548c7b8123a74edb`, Git blob `20253e2df9e50e8a0674e524f4e41d9d128aa315`. Isolated branch on-push to its *own* path only, `contents:read` + `actions:read` minimal permissions, `debian:trixie` container to match source FFmpeg release, read-only `github.token` for the two pinned GitHub artifact download URLs; no external API besides GitHub artifact download, no YouTube code, no upload or formal render, no write permissions. Executes exact committed `scripts/research_verify_20261008_scene1_source.py` and 10 existing negative tests after sample-exact reconstruction.

## Current status — never infer an unseen CI result

The workflow file **was created successfully** on the research branch, and GitHub commit verification found the requested exact path in commit `66985500a143ea9623661303548c7b8123a74edb`. The available GitHub Connector here **cannot list all push-triggered workflow runs**: its commit-workflow-runs action only queries PR-triggered runs, which returned no runs for this push commit, and the standard commit status API gave no statuses. These results **do not establish** whether the push workflow was queued, ran, failed or succeeded.

Therefore:
- `research_CI_workflow_committed=YES`
- `research_CI_actual_run_id=UNKNOWN`
- `research_CI_job_log=NOT_RETRIEVED`
- `research_CI_remote_result=UNVERIFIED`
- `research_CI_test_count_remote=UNVERIFIED`
- `local_pinned_source_reconstruction=PASS`
- `local_committed_validator_fixture_tests=10/10_PASS`
- `publishable=false`, `MVP10-A=INCOMPLETE`, `MVP10-B=NOT_ELIGIBLE`.

The workflow can be viewed on the GitHub Actions page:
`https://github.com/EasonLiu0913/stock_data/actions/workflows/research-mvp10-pinned-scene1-ci.yml`.
This is a workflow page, **not** a fabricated Run ID. If GitHub UI exposes an actual run, re-enter via its ID, fetch Job Log and artifact-specific failure, perform the minimum repair on research branch only. In particular the ZIPs must remain unexpired and FFmpeg/MP3 digest may depend on environment; any drift should fail closed and be diagnosed, not ignored.

## Next highest-value action

Locate the actual workflow Run ID and Job Log, or determine that Actions did not trigger from branch-only workflow creation. If no run was triggered, keep remote result `NOT_RUN` and diagnose triggering permissions before proposing a new owner-authorized isolated execution. If an actual run failed, read logs and repair the narrow research-only fixture or CI environment, then independently reverify. Do not dispatch `research-mvp10-render-only.yml` or call Edge TTS, rerender all nine scenes, change main, or loosen A/B.

Goal progress: true isolated scene1 owner-approved preview + source identity locally validated; full end-to-end frozen 20261008 V4 nine-scene rendering, external SRT placement/VTuber synchronization, private YouTube pilot and final paired-A/B remain undone.
