# MVP10-A Dashboard Dealer Column + Fish Voice 0715599C — Frozen Prompt A/B Pair v1

Status: Owner-requested and preregistered as a dormant candidate; Prompt A has not started.
Change proposal: `data_research/m5/change-proposals/MVP10-A-DASHBOARD-DEALER-VOICE-0715599C-CHANGE-v1.md`
Canonical handoff: `docs/handoffs/daily-gainers-market-opening-end-to-end.md`
Project / goal: `daily-gainers-market-opening-end-to-end` / `goal-v3/MVP-10DAY-v1`
Candidate phase / round: `MVP10-A-DASHBOARD-DEALER-FISH-VOICE-0715599C-R1`
Registration base main: ff8fc7f6a6dc76024596f0954e0b887afb04b561
Frozen validation date: `20261104`
Frozen input facts blob: `75e0573aa2fb394712f40cb9b115096b3e136c07`
Old voice checkpoint to preserve: branch `tts-audio-pending-20261104`, commit `8f79344b537b6900fc382a42f85142153c9d9128`, manifest blob `df2fc0a7ae7cf98d41df8ca42860fa16907b9e30`
New voice identity: `fish:0715599c7277458591efda3ff230a51e`

## Eligibility / no-auto-start rule

This pair is preregistered only. The active phase at registration remains `MVP10-A-R2-FISH-RENDER-DURATION-MIN-5M-R1`; its A is still waiting for the required visual review of run `#43158687674` artifact `#13917708845`, and its B is not eligible. The already preregistered `MVP10-A-FISH-TTS-PERSISTENCE-R1-ALL-SCENES-V2` remains in its existing sequence. Do not change `task-routing.json`, the active phase, `next_phase_id`, or any predecessor prompt. Do not execute this candidate until the canonical handoff explicitly promotes it after its predecessors close. A registration merge alone never starts Prompt A.

## Frozen constraints

1. Use the exact 20261104 date-specific script/plan and same-date facts on the current eligible main when this phase is promoted. Recompute and compare hashes before action; any changed script/facts/plan identity is a stop-and-re-register condition, not an in-place frozen-input edit.
2. Add a stock-row field labeled `自營商(張)`, sourced only from `flow.dealer.net_lots` for that exact stock/date. Preserve all existing row fields, especially the separate `分點買／賣` column populated from `flow.broker.top_buy_brokers` and `flow.broker.top_sell_brokers`. Never derive dealer flow from market-wide TWD values or broker-branch values.
3. If dealer flow is unavailable or not verified, render an explicit neutral `—`/existing policy-approved unavailable marker; never turn null/missing into zero. Keep numeric units as lots and existing sign/color semantics.
4. The new Fish voice is exactly `fish:0715599c7277458591efda3ff230a51e`; provider remains `fish.audio`, endpoint remains `https://api.fish.audio/v1/tts/stream/with-timestamp`, model `s2.1-pro-free`, language `zh-TW`, rate/prosody speed `1.15`, format `mp3`, sample rate `44100`, bitrate `128`, normalize `false`, parser `fish-audio-timestamp-stream-v1`, provider pipeline `daily-gainers-fish-tts-v1`, checkpoint pipeline `daily-gainers-tts-checkpoint-v1`. Set both manifest voice and provider reference identity to the requested ID. Any actual main/provider contract mismatch blocks execution until separately versioned; never silently adapt.
5. Every scene fingerprint must bind the exact target date, frozen script SHA, normalized scene text SHA, new voice/reference identity, rate, complete provider identity, engine/parser and pipeline versions. The old voice checkpoint is immutable evidence and cannot satisfy any new-voice scene.
6. Place the new audio and manifest under an isolated branch namespace exactly `tts-audio-pending-${DATE}-fish-0715599c7277458591efda3ff230a51e` (with the concrete target date substituted) and date path `tts-audio/20261104/`. Update [08 TTS] recovery and date-scoped Render-only to read/write the same identity-scoped ref. Do not overwrite/delete `tts-audio-pending-20261104`.
7. Since voice identity changes every scene fingerprint, queue every scene whose new-identity fingerprint has no valid MP3 and WordBoundary pair. Execute serially with the already registered all-missing-scenes v2 contract, conservative request pacing, existing retry safety, and no successful matching new-identity scene synthesis. Do not add an arbitrary scene cap or weaken existing request safety.
8. Preserve all existing source, candidate, narration, official receipt/opening, coverage, QA, subtitle parity/timing, artifact and YouTube-lock gates applicable to the same date. Final measured MP4 duration remains `>=300` seconds with no maximum, and actual spoken market opening remains `60–90` seconds.
9. Fail closed on any date/script/scene/text/voice/reference/model/rate/pipeline/hash/coverage mismatch before rendering. Render-only performs no TTS request. Never invoke Pages, upload/orchestrator, YouTube, release-lock, or checkpoint-deletion behavior.

## Prompt A — implement after explicit promotion

Continue only after this candidate phase is the explicitly active phase on current remote main.

Before work:
1. Read repository-root `AGENTS.md`, `docs/agent-prompts/goal-anchored-handoff-v3.md`, current canonical handoff, this pair, and the change proposal; confirm current main, active route, phase sequence, and preceding A/B closeouts.
2. Confirm the immutable 20261104 script, facts, narration plan and predecessor artifacts still match the frozen identities above. If not, stop and report the exact changed blob/hash and required owner action.
3. Implement only the stock-row dealer column and its regression/visual proof in `scripts/build_daily_gainers_list_dashboard_slides.js` and `tests/daily_gainers_list_dashboard_slides.test.js`. Update caller/manifest/schema only if the current code proves it is required; list any extra exact path in the handoff before editing.
4. Implement the new Fish voice identity and isolated checkpoint namespace through `.github/workflows/daily-gainers-tts-scene-recovery.yml`, `.github/workflows/daily-gainers-date-render-only.yml`, `scripts/daily_gainers_tts_checkpoint.py`, and `scripts/fish_audio_timestamp_stream.py` as required by actual call paths. Preserve the old voice branch/blob. Add regression coverage for identity separation, same-voice reuse, new-voice mismatch recovery, and fail-closed Render-only identity validation.
5. Validate with the repository's documented commands and CI. Do not dispatch a workflow unless it exists on current main, all registered inputs/gates pass, target is still FIFO-eligible and the authorized trigger tool is available. If dispatch is unavailable, report exact workflow URL and date to the owner; never claim background execution.
6. After CI passes and the authorized [08 TTS] all-missing-scenes v2 recovery is actually run, verify the run/job/log, scene queue, checkpoint branch commit, manifest, all MP3/WordBoundary hashes and exact new voice identity. Then run only the registered same-date date-scoped Render-only if authorized and supported; verify MP4, SRT/caption proof, QA, thumbnail, provenance and artifacts. No YouTube/Pages/upload action.

Prompt A completion contract: code and regression coverage are merged to remote main under repository policy; the real new-voice checkpoint is durable and complete for the frozen date; the authorized Render-only artifact passes every inherited same-date gate and contains a visually verified seven-field stock row retaining broker buy/sell. Otherwise Prompt A remains incomplete with exact WAITING_* dependency. Preserve every prior FAIL/run/artifact unchanged.

## Prompt B — frozen independent closeout

After Prompt A claims completion, independently verify on fresh current remote main:
1. The active candidate pair and target inputs remain exactly the registered identities; predecessor durations, inclusive-eligibility gates and all-scenes-v2 evidence are preserved, with no changed historic result or unauthorized phase switch.
2. Diff is limited to the stated dashboard, Fish voice/checkpoint identity and required tests/handoff. Verify facts source is `flow.dealer.net_lots`, missing is not zero, and `分點買／賣` still displays both top-buy and top-sell data.
3. Required CI checks pass on the final PR head; real rendered dashboard at 1080p has all seven columns readable, with no overlap/clipping, and branch names/values intact.
4. The recovery run used `workflow_dispatch` or other event authorized by the promoted pair, targeted `20261104`, used the exact voice ID and all-scenes-v2 serial processing, and wrote its completed manifest/audio to the new identity-scoped branch. Verify all scene IDs/order, script/text/voice/provider identity and MP3/WordBoundary SHA-256s from remote blobs. Confirm old checkpoint branch/commit/manifest are byte-for-byte unchanged.
5. The real date-scoped Render-only run restored that exact new checkpoint, made no Fish requests, passed all existing minimum-duration/opening/media/SRT/visual-QA/provenance checks, and produced a remote artifact whose MP4, SRT, caption proof, QA, thumbnail and manifest can be independently read and hash-checked.
6. No Pages deployment, YouTube/upload/orchestrator action, public release, lock change, checkpoint deletion, synthesized audio under the old voice, or manual PASS/rewriting of a historical FAIL occurred.
7. If any gate is missing, preserve original evidence and keep this phase A incomplete/B not PASS. Make only a bounded repair supported by changed input evidence, then re-run this same frozen B; do not relax acceptance.

Closeout rule: B PASS only with all checks and durable remote evidence above. Update this canonical handoff and Task State, record the final PR/run/job/artifact/blob identities, prepare the next versioned paired prompts without promoting them, and stop. If a required human visual review or owner/permission gate is missing, record the exact dependency as WAITING_* and keep B incomplete.
