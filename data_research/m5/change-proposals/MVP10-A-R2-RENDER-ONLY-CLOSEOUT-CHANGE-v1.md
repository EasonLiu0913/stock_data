# MVP10-A R2 Render-only Closeout — Versioned Acceptance Change v1

Status: Owner-approved for registration on 2026-11-12; Prompt A has not started.
Owner decision: “另行核准版本化驗收變更：移除私有上傳授權這項前置門檻，同時維持禁止任何 YouTube 上傳、排程與公開發布。”
Registration base main: 3467492bcba9619fef66cc1e710f9ca4a5993816
Active project: daily-gainers-market-opening-end-to-end
Goal: goal-v3/MVP-10DAY-v1
New phase / round: MVP10-A-R2-FISH-RENDER-DURATION-MIN-5M-RENDER-ONLY-CLOSEOUT-R1
Predecessor round: MVP10-A-R2-FISH-RENDER-DURATION-MIN-5M-R1
Target date: 20261104
Prior implementation: PR #110, merged before this registration
Render-only run: #43158687674 / job #130984522584 / artifact #13917708845

## Reason for this change

The original duration round's frozen Prompt B required private-upload authorization before it could report PASS. That original criterion remains unchanged and its historical WAITING_PERMISSION result is preserved. The owner has now approved a separate, prospective, versioned closeout pair that removes only private-upload authorization as a prerequisite for closing the Render-only artifact evidence.

## Exact acceptance delta

For this new Render-only closeout round only:
- Private-upload authorization is not a prerequisite for a PASS on the Render-only artifact review.
- Record `youtube_upload_authorized: false` and private-upload authorization as absent/unauthorized. This is status evidence, not an action request or publication approval.
- All original render/media acceptance criteria remain in force: actual MP4 duration >=300 seconds with no maximum; actual spoken opening 60–90 seconds; same-date frozen plan and exact Fish checkpoint identity; 17/17 scene coverage; audio and WordBoundary hashes; subtitles and burn proof; dashboard/VTuber; thumbnail and QA; provenance and durable artifact verification; existing owner-confirmed manual visual QA PASS.
- The original duration-round Prompt B and its WAITING_PERMISSION observation are immutable historical records. This new pair does not retroactively mark that original B PASS and does not alter prior failed runs or artifacts.

## Explicit prohibitions

No YouTube upload, scheduling, public release, release-lock change, upload credential use, Pages deployment, TTS synthesis, matching-scene regeneration, or checkpoint deletion is authorized by this change. The publication lock remains closed. This is solely an acceptance change for Render-only artifact closeout.

## Registration and transition

Register the new phase and its immutable paired prompts before Prompt A begins. Do not execute Prompt A in the registration operation. Prompt B may run only after this pair's Prompt A has durably completed. A PASS does not automatically promote or run the all-scenes V2 phase; the next step requires a separate owner command after the closeout is recorded on main.
