# MVP10-A R2 Inclusive Eligibility — No-Upload-Gate Successor Change Proposal v1

Status: owner-approved for versioned registration; registration pending PR #123 merge.
Owner decision: 2026-11-12 — “確授權是否建立一份版本化 successor，解除「原 R2」的私有上傳授權前置條件”
Registration base main: 6394ffd6959b5e663a7b2a9fde3a763194e1d6b4.
Active project: daily-gainers-market-opening-end-to-end.
Goal: goal-v3/MVP-10DAY-v1.
Predecessor phase: MVP10-A-R2-INCLUSIVE-ELIGIBILITY.
Successor phase: MVP10-A-R2-INCLUSIVE-ELIGIBILITY-NO-UPLOAD-GATE-SUCCESSOR-R1.
Frozen pair: data_research/m5/change-proposals/MVP10-A-R2-INCLUSIVE-ELIGIBILITY-NO-UPLOAD-GATE-PAIR-v1.md.

## Decision

Create a prospective successor pair for the original R2 eligibility/render closeout. The sole acceptance delta is that private-upload authorization is no longer a prerequisite for Prompt A completion or Prompt B PASS. Record private-upload authorization as false and informational.

This successor preserves, without editing or retroactively closing:
- Original MVP10-A/B and the original inclusive-eligibility R2 pair.
- The original R2 WAITING_TTS and WAITING_PERMISSION observations.
- Historical TTS/Render failures and their original run IDs/heads.
- The already closed no-upload-gate successor and Render-only closeout successor.

## Unchanged acceptance

All other applicable R2 non-upload criteria remain required: date-matched TWSE source and >=5% arithmetic; inclusive instrument eligibility and accurate labels; same-date official opening/breadth; source/research/script/SEO/render-plan identities; Fish checkpoint provider/voice/model/rate/pipeline, scene coverage, MP3 and WordBoundary hashes; real MP4/SRT/subtitle-burn proof; duration minimum of 300 seconds with no maximum; thumbnail, visual-QA and provenance evidence.

Use current remote main artifacts and current workflow/code identities. The existing 20261104 Render run #43158687674/job #130984522584/artifact #13917708845 and Fish checkpoint branch `tts-audio-pending-20261104` may be reused only after their identities and required evidence are independently rechecked. Do not rerun matching TTS scenes or rerender when the existing artifact satisfies the frozen contract.

## Publication and side-effect boundary

This change does not authorize or permit any YouTube upload, upload retry/orchestrator, scheduling, public release, release-lock change, Pages deployment, TTS synthesis, checkpoint deletion, or workflow dispatch. All related permissions remain false. This is a Render-only evidence closeout.

## Phase ordering

The successor is inserted after the original R2's preserved WAITING_PERMISSION checkpoint and before the already registered all-scenes V2 work. No automatic promotion or Prompt A execution follows registration. After this PR is merged, a separate owner-issued `promptA` is required to begin the successor; Prompt B remains ineligible until that successor's Prompt A completes and its evidence is durable.

## Registration evidence and stop

PR #123 carries this proposal, its frozen A/B pair, Task State, and canonical handoff checkpoint. The branch is not yet on main. Do not describe the successor as registered on main or start its Prompt A until the PR is merged and the exact file blobs are re-read from main.