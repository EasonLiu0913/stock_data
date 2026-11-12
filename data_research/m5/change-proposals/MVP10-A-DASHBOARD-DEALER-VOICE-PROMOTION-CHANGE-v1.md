# CHANGE PROPOSAL — Promote Dashboard Dealer + Fish Voice successor; supersede old-format TTS phase

Status: Owner-authorized prospective phase promotion; approval given 2026-11-13 (Asia/Taipei).
Project: `daily-gainers-market-opening-end-to-end`
Goal version: `goal-v3/MVP-10DAY-v1`
Successor phase: `MVP10-A-DASHBOARD-DEALER-FISH-VOICE-0715599C-R1`
Frozen pair (unchanged): `data_research/m5/change-proposals/MVP10-A-DASHBOARD-DEALER-VOICE-0715599C-PAIR-v1.md`
Frozen pair blob at promotion: `9e9da65be76acbe081a2beb1c97cf01adcdca807`
Original feature proposal (unchanged): `data_research/m5/change-proposals/MVP10-A-DASHBOARD-DEALER-VOICE-0715599C-CHANGE-v1.md`
Original proposal blob: `8fd24bb84da305ae8634b184e76627b1f47d4f3e`
Target: `20261104`
Selected Fish identity: `fish:0715599c7277458591efda3ff230a51e`

## Owner decision and route change

The owner directs that the registered dashboard/dealer/new-voice successor be promoted and implemented, and that the old-format video/audio not be used again for new output. This proposal changes phase routing only. It does not edit the frozen successor A/B pair, change its target date or acceptance, or turn any historical result into PASS.

The preceding registered phase `MVP10-A-FISH-TTS-PERSISTENCE-R1-ALL-SCENES-V2` is closed as **SUPERSEDED_BY_OWNER_DIRECTION**, not passed. Its v2 Prompt A did not establish the frozen genuine >3-missing-scene live evidence and its inherited Render gates were not satisfied. Preserve its original proposal/pair, statuses, run IDs (including run #19 / #42836332036 and schedule no-op run #43121558787), checkpoint history, and every prior PASS/FAIL/WAITING result byte-for-byte. Do not claim V2 Prompt B PASS.

Activate only the already registered successor `MVP10-A-DASHBOARD-DEALER-FISH-VOICE-0715599C-R1`; its original frozen Prompt A/B remain the sole acceptance. Prompt A may begin after this promotion is merged to main. Prompt B remains ineligible until Prompt A's full completion contract is met and a later separate owner closeout action is issued. No automatic continuation.

## Prospective output policy

For new or regenerated output under this project, use the promoted row layout and Fish voice identity from the frozen pair. Do not use the legacy voice `fish:e7af89da8abc4fbdacd9a10ab9881933` checkpoint to satisfy the new identity or generate the successor. The old 20261104 video, checkpoint branch `tts-audio-pending-20261104`, commit `8f79344b537b6900fc382a42f85142153c9d9128`, and manifest blob `df2fc0a7ae7cf98d41df8ca42860fa16907b9e30` remain historical evidence and are excluded from successor inputs. They are not deleted or overwritten; the user rejects their use as the desired deliverable. New voice audio must use the identity-scoped branch and fingerprints defined by the frozen pair.

## Unchanged limits

- Preserve exact same-date frozen facts/script/plan requirements and use `flow.dealer.net_lots` only for the individual-stock dealer column; retain separate broker-branch buy/sell.
- Preserve every other source, script, narration, duration, opening, subtitle, QA, visual-review, artifact-hash and provenance gate in the frozen pair.
- No YouTube upload, scheduling, public release, upload/orchestrator, Pages deployment, release-lock change, or checkpoint deletion. YouTube publication lock stays closed.
- Do not modify prior phases' frozen prompts, historic results or acceptance.

## Recovery

After merge, verify current main contains this route, this proposal, and the unchanged pair blob above. Start Prompt A using only its frozen instructions and exact identities. If a frozen input/provider identity or required gate differs, stop at the pair's specified fail-closed condition and report the exact evidence; do not substitute the old format.
