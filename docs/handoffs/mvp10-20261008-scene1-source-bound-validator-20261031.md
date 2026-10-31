# MVP10-A | Research-only source-bound scene1 import contract (2026-10-31)

## Goal identity and no-release boundary

Project `daily-gainers-market-opening-end-to-end`; goal `goal-v3/MVP-10DAY-v1`. Active A still **INCOMPLETE**; B **NOT_ELIGIBLE**, research `PROGRESS`, plan_changed `NO`. User accepted the actual isolated 43.562s first-scene preview as visually acceptable. This approval does not imply full-video, lip sync or publisher acceptance, nor does it change the immutable paired A/B gates.

## Concrete implementation

- A stand-alone, research-only Python validator `scripts/research_verify_20261008_scene1_source.py` committed on `research/daily-video-mvp10-a-20261029` commit `bf04ebdfe712d044bba8cc7c8f8832e6b89911fd`. It is NOT imported by the production TTS/subtitle renderer or workflow.
- Opt-in fixture tests committed `scripts/test_research_verify_20261008_scene1_source.py` at `3468a54b1380fa0957db154ca32d722e7b0f7c00`, run only with both explicit local fixture path environment variables. They intentionally SKIP without appropriate original artifact inputs. **No GitHub Actions run executed**, so remote tests **NOT VERIFIED**.
- Independently built a more exhaustive container-local fail-closed reference checker `verify_source_bound_scene1.py`, SHA-256 `04cbffdd950df0900ad815998e646dc08d141e33d2de152944af97f9b5079e37`, alongside 12 local positive/negative tests `test_source_bound_scene1.py`, SHA-256 `b394b9f0143ed2ed79c424f89f961376dcaf91702b6a00dbd1684f6bfa91c1a6`. **12/12 local tests PASS against actual available input files**, including wrong date, publication flag, spoofed Edge synthesis, missing/shifted word boundary, altered MP3 or SRT, voice drift and absent owner approval. These tests run the local checker, **not the separately committed GitHub branch script**, so the remote script is source-reviewed but not independently executed; do NOT conflate these.
- Local receipt `source_contract_verified_RESEARCH_ONLY.json` SHA-256 `5560005bdfa778fc2ba10bb783bd564040468c57ffd2824e9a5e9ca5a7564411`.
- Local reproducible package `mvp10_source_bound_contract_RESEARCH_ONLY.zip` SHA-256 `0e2ce67849ac9422a87f5cfe7347e420d9a465720b988d6c66533d8aec7bf89f`.
- Verified historical source: source WAV SHA `fc5598fcb5a4def1a3a0f1bf5d17609c12a7f065589c27109e8d50ce3ce06bc7`, 43.562s/1045488 samples/24kHz mono; derived MP3 SHA `3721fc4e80f2ab875499fdb9faf68c382c8775dfb9397000f150de5474c043e6`, measured 43.632s (+70ms encoder padding); audited 14-cue SRT SHA `adf0c086bc5c73cf0a3cb9604adad90c2112264381f5b3517dcbba919cfb9024`; 128 recorded source WB, frozen V4 fourth line, voice `zh-TW-YunJheNeural` +15%.
- Crucially, `tts-manifest.json` retains top-level `engine=edge-tts` for historical source metadata but per-scene `engine=edge-tts-reused-pcm-research-only`, never fraudulently claiming a new Edge TTS synthesis. Validator rejects any change in provenance or frozen digests.
- All approval flags are explicit `publishable=false`, `research_only=true`, `publication_authorized=false`, `frozen_ab_complete=false`. Code neither uploads nor renders. No new CI.

## Remaining blocker and next controlled action

1. **Verify the exact committed branch validator against true pinned input artifacts via an explicit research-only CI or isolated downloaded fixture**, because local 12/12 tests did not execute the committed script.
2. Only if the branch's validator passes, consider an isolated one-scene rendering entry that can import verified audio without forging TTS events; explicitly preserve 14 original SRT cues and measured render duration (+70ms MP3 padding), fix the real footer collision without hiding production UI, and review V4 presenter freeze. This is a scoped research proposal, NOT permission to dispatch the full 9-scene Render-only workflow.
3. Historical full 9-scene inputs are incomplete locally (source Artifact contains MP4/manifest but not independently downloadable later scene MP3s); no full video integration success may be claimed.
4. Keep owner-approved original fourth-line lexical confirmation, frozen A/B, main, YouTube and every release lock unchanged.

Current phase A PROGRESS, B NOT_ELIGIBLE, plan_changed NO; automatic continuation only within original isolated A scope, and no background execution.
