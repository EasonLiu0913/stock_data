# MVP10-A execution-order change v1 — eligibility, Render, then live all-scenes proof

Status: **Owner-approved order; registration PR pending.**  
Owner decision: 2026-11-12, Asia/Taipei — “ok，按這順序執行”。  
Registration base main: `399b4e7e85d7a98d8df51bb3abc95c65140a612c`.  
Active project: `daily-gainers-market-opening-end-to-end`.  
Goal: `goal-v3/MVP-10DAY-v1`.

## Purpose

Record the owner's chosen execution order across already registered work. This is a sequencing decision only. It does not edit or replace either frozen pair, lower a gate, convert a failure/wait into PASS, or authorize YouTube/Pages actions.

## Ordered execution

1. **Resume the already registered eligibility round MVP10-A-R2.** Use its unchanged pair at `data_research/m5/change-proposals/MVP10-A-INCLUSIVE-ELIGIBILITY-PAIR-R2-v1.md` and proposal at `data_research/m5/change-proposals/MVP10-A-INCLUSIVE-ELIGIBILITY-CHANGE-PROPOSAL-v1.md`. The old Prompt A checkpoint `WAITING_TTS` is historical and not complete. Current main has the all-scenes implementation merged (PR #103, merge `4ebe48739ea1f1a44b6846859a76ebd5c4b98fd8`) and the exact 20261104 Fish checkpoint on branch `tts-audio-pending-20261104`, commit `8f79344b537b6900fc382a42f85142153c9d9128`, manifest blob `df2fc0a7ae7cf98d41df8ca42860fa16907b9e30`, 17/17 successful scenes. Resume only after a fresh `promptA` turn and revalidate every R2 input and gate. Run #25 / `43121558787` was a natural-schedule no-op: complete checkpoints meant no Fish request; it is not render or >3-missing synthesis evidence.
2. **Complete the registered TTS phase's Render-only threshold** after the eligibility round's frozen A/B closeout permits progression. Reuse the exact date-scoped Render artifact produced by R2 only when its target date, frozen script SHA, Fish manifest/checkpoint SHA, provider/voice/rate fingerprint, workflow/head identity, and full MP4/SRT/QA/provenance evidence exactly satisfy the TTS pair. Otherwise perform the already-authorized date-scoped Render-only once after all required gates pass. Do not call Fish as a render fallback.
3. **Then obtain genuine live evidence for a >3-missing all-scenes recovery.** The current 20261104 checkpoint is complete and must not be modified to manufacture missing scenes. Use only a real eligible date with more than three genuinely missing/invalid scenes, after fresh source and identity gates pass. If no such date exists, record the exact waiting condition and stop; do not infer live proof from PR tests or run #25.

## Frozen contracts and stop gates

- Do not edit `MVP10-A-INCLUSIVE-ELIGIBILITY-PAIR-R2-v1.md` or `MVP10-A-FISH-TTS-PERSISTENCE-PAIR-v2.md`. Their Prompt A/B criteria, event requirements, and historical outcomes remain immutable.
- The global project currently prohibits YouTube upload, scheduling, public release, release-lock changes, and Pages deployment. R2's Prompt B says a missing separate private-upload authorization is `WAITING_OWNER/WAITING_PERMISSION`, not PASS. Therefore if that frozen R2 gate prevents B PASS, stop at that state; do not upload or advance to step 2 by bypassing phase governance. A separate owner-approved versioned acceptance decision would be required before changing that gate.
- The existing TTS v2 Prompt A remains in progress and Prompt B remains ineligible until its original completion contract is met. This order record does not mark either A or B complete.
- Current sequence requires one phase at a time: finish eligible R2 A, then invoke its original B only after A is durably complete. The following phase requires a new owner command at its boundary; no automatic A/B chaining.
- Preserve prior Edge TTS R1 failure, Fish timestamp migration R2 PASS, all existing run IDs, and all 17 matching scene checkpoints.

## Evidence at registration

- Latest main: `399b4e7e85d7a98d8df51bb3abc95c65140a612c`; its newest commit changed only `data_prediction_analysis/momentum-history/**`, `data_prediction_analysis/momentum-replay/**`, and `data_prediction_analysis/momentum-research/v1/summary.json`, unrelated to this video route.
- R2 pair remains preregistered and unchanged; its prior attempt is checkpointed as `WAITING_TTS`, A incomplete, B ineligible.
- TTS all-scenes run #25 is `schedule` success at head `2fb938ca115c662198945a5977811ba5cd6cf982`; prepare found every FIFO candidate with a complete identity-valid checkpoint; synthesize was skipped. The checkpoint above remains 17/17 with no pending scenes.
- TTS run #25 does not prove the >3-missing live case. No files in the date checkpoint may be deleted or altered to create such a case.

## Next action

After this proposal, canonical handoff, and machine Task State are merged to main, a new explicit `promptA` owner turn resumes R2 from its first incomplete step. This registration itself runs no TTS, Render, Pages, upload, or publication workflow.
