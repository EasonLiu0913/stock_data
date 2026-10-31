# MVP10-A | 20261008 V4 source-adapter minimal integration study — 2026-10-31

## Decision scope

Owner has reviewed the **actual isolated scene-1 preview**, feedback: `整體可接受，接續最小必要整合研究`. Also explicitly stopped low-value individual-word clipping research. Record **owner qualitative preview acceptance**, not full-production render PASS, pixel-level subtitle/player PASS, or relaxation of original paired A/B gate.

Active project `daily-gainers-market-opening-end-to-end`; goal `goal-v3/MVP-10DAY-v1`. Date `20261008`, isolated research branch `research/daily-video-mvp10-a-20261029`. main, production scheduling, YouTube and all publication locks remain unchanged.

## Independently confirmed current main/research interfaces

- `scripts/synthesize_daily_gainers_tts.py` exactly same GitHub SHA on `main` and research: `f407a516bd42b277311ce6f6013b2823948ef41f`. The regular path **regenerates a whole audio scene through Edge TTS** and does not have a proven source-reuse import interface. Prior pilot `41185747222` failed on a fresh V4 fourth-line TTS request (`NoAudioReceived`).
- `scripts/render_daily_gainers_video.js` exactly same `main`/research SHA `1e2a46dde68c8fca24a73326ae577a997b032476`; renderer expects `audio/01.mp3` and reads actual audio duration, with original VTuber, progress and full-video constraints.
- `scripts/build_daily_gainers_srt.py` currently differs: `main` SHA `d3c429eacc41c4e6b469debdc914aa5fe6db9543` and research SHA `1ca34b9741f7ad8c72f9ac5710726d9fe91c2604`. Research source **explicitly requires** `tts_scene.engine == 'edge-tts'` and `schema_version=1` chooses default `split_text(scene.narration)`. Thus passing a truthful `edge-tts-reused-pcm-research-only` scene provenance **would be rejected**, and the previously audited frozen **14-cue** source-bound SRT is **not automatically emitted** by the default full pipeline. Do not misrepresent the existing import path as ready.
- `research-mvp10-render-only.yml` exists **on research branch only**, not on main, and presently invokes fresh TTS in its main path. Do not dispatch full nine-scene workflow or claim full MVP success.

## Concrete isolated adapter assembled and verified

Built a real single-scene research adapter from the pinned **20261008** historical Artifact `12953454424` (9 real scenes; scene-1 historical audio 41.712s), the 20261013 fixed V4 line4 source crop from Artifact `13036325288`, and the owner-accepted **43.562s** PCM scene-1 splice. Existing PCM SHA-256 `fc5598fcb5a4def1a3a0f1bf5d17609c12a7f065589c27109e8d50ce3ce06bc7`. Existing source-attributed scene-1 WordBoundary count **128**, source-locked research SRT cue count **14**, frozen 226/226 normalized text coverage.

The adapter package (local **only**, no GitHub binary, no published media) includes:
- `isolated-scene1/plan.json`: historical scene 1 only, fixed V4 fourth line, `research_only=true`; does not masquerade as a nine-scene plan.
- `isolated-scene1/tts-manifest.json`: 128 actual source events, `engine='edge-tts-reused-pcm-research-only'` and source Artifact/WAV hashes, `publication_authorized=false`; **not a fabricated live Edge TTS result**.
- `isolated-scene1/audio/01.mp3`: actual FFmpeg-LAME 160kbps conversion from frozen WAV for MP3 interface; SHA-256 `3721fc4e80f2ab875499fdb9faf68c382c8775dfb9397000f150de5474c043e6`, Mutagen measured **43.632 seconds**, which is **+0.070s** relative to frozen 43.562s decoded PCM. **Audio stream is lossy and the original owner listening acceptance belongs to the source WAV**, not automatic acceptance of this reencoded output. Render timings must be measured, never copied blindly from WAV.
- `isolated-scene1/daily-gainers-20261008.zh-TW.srt`: exact existing audited 14-cue candidate SHA-256 `adf0c086bc5c73cf0a3cb9604adad90c2112264381f5b3517dcbba919cfb9024`.
- `isolated-scene1/integration-receipt.json`: transparent source lineage and incomplete approval flags.
- Reproducibility `build_research_scene1_adapter.py` and `test_research_scene1_adapter.py`, eight **local** unit tests pass, including hash tamper, date mismatch, event omission, falsely claiming `edge-tts`, publication=true and exact SRT hash.

Actual local ZIP `mvp10_scene1_integration_RESEARCH_ONLY.zip` SHA-256 `3b1281bbccc844d211ef6e46b6c6cc1b13c5fdac28896e545f01442a6e80016f`. ZIP is working-container evidence, **not** a remote GitHub Artifact; no CI was triggered.

## Highest-value next integration proposal (NOT implemented)

1. Version a **single approved-source reimport path** for this frozen scene and exact voice/rate with input allowlist (date `20261008`, source 20261013 Artifact `13036325288`, exact pinned SHA, 44,400-sample line4 / 1,045,488-sample scene1, owner phrase acceptance). Must require proof original source and reject any altered bytes, date, voice, source, absent event or unknown release status. Do not set `engine='edge-tts'` just to spoof a completed new synthesis. Could instead use an explicit source-provenance field with a strict verified import engine type in a **research-only adapter**.
2. Bind the existing audited **14-cue** external subtitle artifact explicitly to the exact imported scene hash and resulting audio/video offsets. The current `schema_version=1` caption splitter cannot guarantee the reviewed layout. No burning SRT into final upload by default: preview burn-in is **research only**. Resolve the **actual footer collision** with a non-destructive production design change before any acceptance.
3. Assemble full source-verified nine-scene inputs and perform a genuine isolated **end-to-end** render test **only when** preregistered A/B and correct imported sources permit; the downloaded historical ZIP contains MP4+manifest but **not standalone scene2–scene9 MP3s**, so this local adapter **cannot** claim a complete 9-scene pass or invent missing media.
4. Compare actual final rendered scene duration, original 43.562s decoded PCM reference and 43.632s freshly reencoded MP3, validate no cumulative drift, text and source metadata, mouth-motion quality, 1080p layout, external YouTube SRT player behavior and duplicate upload gates (read-only). Keep YouTube upload disabled and all release locks closed.

## Governance

The owner accepted the **overall actual isolated scene-1 preview**, but it has freeze-frame V4 lip sync and only a temporary matte for footer collision. Those facts are not formally resolved. No further unneeded word-edge slicing study. No change to frozen A/B thresholds or official publication. Research progress `PROGRESS`, MVP10-A `INCOMPLETE`, B `NOT_ELIGIBLE`, plan_changed `NO`.

**Next action:** implement the narrow import/caption contract *on isolated research branch only* after checking original paired A/B and recording the smallest auditable versioned difference; do not dispatch full render or modify main without a separate owner-approved promotion.
