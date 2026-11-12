# MVP10-A R2 Render Duration Minimum-Only — Change Proposal v1

Status: Owner-approved for versioned registration; implementation not started.
Owner decision: 2026-11-12 — “不保留5–10 分鐘門檻，改成5 分鐘以上即可”
Registration base main: ed3863d6d1625462f7f058fc595381d84ba4a7d7
Active project: daily-gainers-market-opening-end-to-end
Goal: goal-v3/MVP-10DAY-v1
Successor phase: MVP10-A-R2-FISH-RENDER-DURATION-MIN-5M-R1
Predecessor round: MVP10-A-R2-FISH-RENDER-SUCCESSOR-R1

## Observed failure

Render-only run #43147301096, job #130948007616, ran against main head 6682c06c2e04d78ea863b2969563524599bd0a40. Its 17 Fish scenes rendered to an MP4 measured at 636.831224 seconds (10.61 minutes). The renderer wrote duration_pass=false and exited at scripts/render_daily_gainers_video.js:327 because the current implementation requires 300–600 seconds. Earlier input, script, checkpoint, and materialization gates passed. The run remains a historical failure; its artifact 13912818516 is partial evidence and is not relabeled PASS.

## Owner-approved prospective change

Replace only the whole-video duration predicate:
- Before: 300 <= final MP4 duration <= 600 seconds.
- After: final MP4 duration >= 300 seconds; no maximum duration gate.

This is the owner's explicit acceptance decision. It does not change the market-opening requirement: the complete spoken opening must still measure 60–90 seconds in actual media. It does not change script/source/coverage, subtitle parity, Fish identity/checkpoint, 1080p, thumbnail, visual QA, provenance, artifact, or publication gates. No historical run, artifact, frozen pair, or prior outcome is rewritten.

## Implementation boundary

The successor Prompt A may change the current renderer and focused tests only for the whole-video maximum-duration rejection. The QA manifest must continue recording actual measured duration and set duration_pass from the 300-second minimum. Add focused regression coverage proving 636.831224 seconds passes and a duration below 300 seconds fails. Do not weaken unrelated checks or remove measured-duration verification.

A new post-change date-scoped Render-only run on main is required; the old run cannot be reused as acceptance evidence because it executed the old predicate. Reuse the exact validated 20261104 Fish checkpoint without synthesis. Do not modify the checkpoint or freeze-plan identity.

## Safety

No YouTube upload, scheduling, public release, release-lock change, Pages deployment, or checkpoint deletion is authorized. The private-upload permission gate remains unresolved and must be reported as WAITING_OWNER/WAITING_PERMISSION if reached. This proposal changes one Render acceptance rule only.
