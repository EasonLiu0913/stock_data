# CHANGE PROPOSAL — Dashboard/Fish successor with a 40-second minimum market opening

Status: Explicitly owner-approved on 2026-11-13 (Asia/Taipei).
Project: `daily-gainers-market-opening-end-to-end`
Goal version: `goal-v3/MVP-10DAY-v1`
Successor phase: `MVP10-A-DASHBOARD-DEALER-FISH-VOICE-OPENING-MIN-40S-R2`
Predecessor: `MVP10-A-DASHBOARD-DEALER-FISH-VOICE-0715599C-R1`
Target date: `20261104`
New voice: `fish:0715599c7277458591efda3ff230a51e`
Pre-registered pair: `data_research/m5/change-proposals/MVP10-A-DASHBOARD-DEALER-FISH-VOICE-OPENING-MIN-40S-PAIR-v1.md`

## Owner decision

The owner directed: “開場旁白改為 40秒以上皆可通過”. This proposal records the decision as a versioned successor for the current 20261104 dashboard/dealer + new-Fish-voice phase. It changes exactly one acceptance condition prospectively for this successor:

- Previous R1 frozen rule: measured spoken market-opening scene must be 60–90 seconds.
- R2 rule: measured spoken market-opening scene must be **at least 40.000 seconds; there is no maximum**.
- Measurement must come from actual rendered scene/audio timing, not narration character count or an estimate. Non-finite, absent, or unmeasured duration fails closed.

This does not edit or reinterpret R1's frozen pair, its original 50.808-second blocker, or its results. R1 is recorded as superseded by the owner-approved successor, **not PASS**. The 20261104 artifact's measured 50.808-second opening may be considered only as evidence under R2 after its identity, provenance and all other gates are independently rechecked; it does not automatically close R2.

## Unchanged requirements

All other R1 and project gates remain unchanged: exact 20261104 frozen inputs and provenance; 17 ordered Fish scenes on voice `fish:0715599c7277458591efda3ff230a51e`; date/script/text/provider fingerprints; MP3 and WordBoundary hashes; dashboard dealer lots with separate broker buy/sell; actual MP4 total duration >=300 seconds with no maximum; SRT alignment and burned-caption proof; QA, thumbnail and provenance; and required human visual review of the exact new-format artifact.

The legacy voice `fish:e7af89da8abc4fbdacd9a10ab9881933` and its checkpoint remain excluded from successor inputs. No prior result is rewritten and no old-format output is reused as the desired deliverable.

YouTube upload, scheduling, public release, upload/orchestrator, Pages deployment, release-lock changes and checkpoint deletion remain forbidden. No automatic Prompt A/B execution.

## Recovery

Merge the registration PR so this proposal, immutable pair, canonical handoff and Task State are durable on main. Then a separate owner `promptA` may execute only the R2 pair. The A must implement and test the >=40/no-maximum duration guard, verify the existing new-voice checkpoint/artifact identities, and run only the authorized same-date Render-only validation if needed. Render must make no TTS requests when the matching checkpoint is complete. Preserve all predecessor results.
