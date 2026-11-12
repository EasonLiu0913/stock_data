# MVP10-A Dashboard Dealer Column + Fish Voice — Change Proposal v1

Status: Owner-requested versioned registration; implementation not started.
Owner request: register a paired A/B for adding an individual-stock dealer-flow column, retaining broker-branch buy/sell, verifying the rendered layout, and changing the Fish voice to `fish:0715599c7277458591efda3ff230a51e`.
Registration base main: ff8fc7f6a6dc76024596f0954e0b887afb04b561.
Project: `daily-gainers-market-opening-end-to-end`
Goal: `goal-v3/MVP-10DAY-v1`
Candidate phase / round: `MVP10-A-DASHBOARD-DEALER-FISH-VOICE-0715599C-R1`
Canonical handoff: `docs/handoffs/daily-gainers-market-opening-end-to-end.md`
Frozen pair: `data_research/m5/change-proposals/MVP10-A-DASHBOARD-DEALER-VOICE-0715599C-PAIR-v1.md`

## Why this change is needed

The individual-stock dashboard currently displays target/code, gain, foreign flow, investment-trust flow, margin change, and broker-branch buy/sell. The same-date facts already expose per-stock dealer flow as `flow.dealer.net_lots`; for 20261104 stock 2330, the recorded value is -11 lots in facts blob `75e0573aa2fb394712f40cb9b115096b3e136c07`. The current row renderer does not display that field. The market-opening dashboard's market-wide dealers amount is a different measure and does not satisfy this individual-stock column.

The current renderer is `scripts/build_daily_gainers_list_dashboard_slides.js` (main blob `358034b6180178420b24658eab2ccb557bf38970`); its regression test is `tests/daily_gainers_list_dashboard_slides.test.js` (blob `4c76e20b55931df83666ee0b6b078c6283868974`). The facts producer is `scripts/build_daily_gainers_ai_facts.js` (main blob `ce27cbbc0b47b2110bab15d0104b9cad6e315505`).

## Owner-authorized prospective scope

1. Add an individual-stock `自營商(張)` column sourced only from that row's same-date `flow.dealer.net_lots`.
2. Preserve the existing `分點買／賣` column and both top-buy/top-sell branch data. Do not replace, merge, or relabel branch data as dealer flow.
3. Rebalance the row layout and verify the actual rendered 1080p output for readable headers and values with no overlap, clipping, or loss of branch names/values.
4. Set the Fish voice to the exact user-selected identity `fish:0715599c7277458591efda3ff230a51e`. Keep the existing Fish model, endpoint, format, sample rate, bitrate, normalization, language, timestamp parser, pipeline version, and rate `1.15` unchanged unless the registered files prove a prior explicit owner-approved value differs; any discrepancy is a stop condition, not permission to improvise.
5. Because voice and reference identity participate in each scene fingerprint, retain the old checkpoint unchanged and create an isolated checkpoint namespace for this voice. Do not reuse or rewrite the old voice's MP3/WordBoundary as evidence for this voice.

## Predecessor and sequencing boundary

At registration, the active phase remains `MVP10-A-R2-FISH-RENDER-DURATION-MIN-5M-R1`. Its Render-only run `#43158687674` completed successfully and produced artifact `#13917708845`, but its recorded static/pixel visual-review status remains pending. Its Prompt A is not closed and Prompt B is not eligible. The already preregistered next phase `MVP10-A-FISH-TTS-PERSISTENCE-R1-ALL-SCENES-V2` is not displaced.

This candidate is dormant. Do not change the active project, current phase, its A/B, existing phase order, or `next_phase_id`. Do not start this candidate until all earlier registered gates/rounds are closed and the canonical handoff explicitly promotes it. This registration does not dispatch a workflow or authorize YouTube, Pages, upload, publication, lock changes, or checkpoint deletion.

## No historical rewrite

Keep the existing voice checkpoint branch `tts-audio-pending-20261104`, commit `8f79344b537b6900fc382a42f85142153c9d9128`, manifest blob `df2fc0a7ae7cf98d41df8ca42860fa16907b9e30`, prior renderer, and prior runs/artifacts unchanged. Any prior success or failure remains attached to its original input identity.

## Acceptance boundary

The frozen paired prompt defines the exact dashboard, TTS identity, isolated checkpoint, Render-only, evidence, failure, and stop conditions. If the exact voice is unavailable, a required same-date source/facts value is absent, a provider identity changes, or the exact frozen plan cannot be validated, fail closed and record the blocker; do not substitute a voice, invent zero flow, weaken the layout/media gates, or rewrite predecessor evidence.
