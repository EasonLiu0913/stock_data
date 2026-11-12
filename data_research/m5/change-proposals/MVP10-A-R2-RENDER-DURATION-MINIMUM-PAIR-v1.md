# MVP10-A R2 Render Duration Minimum-Only Pair v1

Status: Owner-approved and preregistered before implementation.
Change proposal: data_research/m5/change-proposals/MVP10-A-R2-RENDER-DURATION-MINIMUM-CHANGE-v1.md
Goal: goal-v3/MVP-10DAY-v1
Project: daily-gainers-market-opening-end-to-end
Phase / round: MVP10-A-R2-FISH-RENDER-DURATION-MIN-5M-R1
Target date: 20261104
Predecessor: MVP10-A-R2-FISH-RENDER-SUCCESSOR-R1
Predecessor run #43147301096 remains failure under its then-current 5–10 minute predicate.

## Frozen rules

1. Preserve all source, candidate, research, official receipt, opening, script, coverage, news attribution, SEO/thumbnail, Fish checkpoint, Render, SRT, visual-QA, provenance and artifact requirements in the registered R2 Fish successor pair, except the single whole-video maximum-duration change below.
2. Whole-video duration acceptance is actual measured final MP4 duration >=300 seconds. There is no maximum duration gate.
3. The complete spoken market opening including brand lines remains 60–90 seconds measured from actual media. This change does not affect opening duration.
4. Reuse the exact 20261104 frozen plan and Fish checkpoint (17/17 matching scenes), verify all date/script/provider/voice/reference/model/rate/pipeline and MP3/WordBoundary hashes. Do not synthesize or mutate matching scenes.
5. Update only the renderer's whole-video duration predicate/error text and focused regression tests. QA must record actual duration. Test that 636.831224 seconds passes and a value below 300 seconds fails. Preserve file-size and all other media gates.
6. Do not alter the old run, artifact, predecessor pair, or prior A/B outcomes. Run #43147301096 remains FAIL under the old rule and its artifact remains partial.
7. Run the corrected date-scoped Render-only workflow once on current main after the code change is merged and all input gates pass. Inspect its actual run/event/head SHA, logs, Fish request behavior (zero new synthesis for matching checkpoint), MP4, SRT, opening duration, captions, VTuber/dashboard, thumbnail, visual QA, QA JSON, provenance and durable artifact contents.
8. Private-upload feasibility is read-only. No YouTube upload, scheduling, public release, release-lock change, Pages deployment or checkpoint deletion. If private-upload authorization is absent, record WAITING_OWNER/WAITING_PERMISSION, not PASS.

## Prompt A — implementation and bounded validation

Continue this registered phase in EasonLiu0913/stock_data.

Before work:
1. Read AGENTS.md, docs/agent-prompts/goal-anchored-handoff-v3.md, docs/agent-prompts/prompt-a-runner.md, the canonical handoff and Task State, this proposal and exact pair, the predecessor Fish successor pair, and the daily video editorial policy.
2. Verify latest remote main, active route, this pair's registration, and preserved historical run #43147301096. Confirm the working source files match current main before editing.
3. Preserve all existing source identities and the 17-scene Fish checkpoint; do not change narration or regenerate matching audio.

Implementation:
1. In scripts/render_daily_gainers_video.js, change only the whole-video duration predicate from 300–600 seconds to >=300 seconds; update the failure diagnostic to describe only a below-five-minute failure. Keep actual MP4 measurement and duration metadata.
2. Add or update focused renderer regression tests: 636.831224 seconds passes; 299.999 seconds fails; 300 seconds passes. Do not weaken any other QA.
3. Run only the focused tests and relevant current-main checks. Record before/after blob SHA and commit/PR/check evidence.
4. After the corrected implementation is on main, verify all registered 20261104 input and Fish checkpoint identities again. If required gates pass and a supported dispatch capability is available, trigger the date-scoped Render-only once; otherwise provide the exact workflow URL and date input and stop at WAITING_WORKFLOW for owner execution.
5. Inspect the real post-change run and all artifacts against rule 7 above. Do not treat run #43147301096 or an old artifact as post-change proof.
6. Inspect private-upload feasibility read-only; never upload or alter publication locks.

Prompt A completion contract:
A completes only after the corrected >=300-second predicate is on main, focused checks pass, and a new current-main Render-only run produces independently inspectable required artifacts satisfying every unchanged gate. Record unresolved upload permission separately. Preserve run #43147301096 as historical FAIL. Update canonical handoff and Task State with durable evidence, verify remote blobs, then stop for explicit Prompt B. No automatic continuation.

## Prompt B — independent closeout

Run only after this same-round Prompt A completion contract is durable and the owner invokes promptB. Otherwise report B_NOT_ELIGIBLE or the exact WAITING state; do not silently execute A.

Independently:
1. Re-read current main, AGENTS.md, routing, handoff, Task State, this exact proposal/pair and the original predecessor pairs.
2. Confirm only the whole-video upper bound changed: current renderer accepts actual final duration >=300 seconds and imposes no maximum; the 300-second minimum is fail-closed.
3. Verify tests include 299.999 fail, 300 pass, and 636.831224 pass; inspect actual check runs and commit.
4. Confirm run #43147301096 remains unchanged historical failure on its original head and artifact; verify the new post-change Render-only run uses current main and same 20261104 date.
5. Independently inspect exact Fish checkpoint identity and prove no matching scene was synthesized again; inspect MP4, SRT, 60–90 second opening, subtitles/burned-caption proof, VTuber/dashboard, thumbnail, QA, provenance and durable artifacts.
6. Confirm no YouTube, Pages, publication-lock or checkpoint-delete action occurred. Keep private-upload permission status explicit.

Closeout rule: any missing required artifact/gate remains BLOCKED/WAITING; never lower another criterion, rewrite historical evidence, or promote a subsequent phase automatically.
