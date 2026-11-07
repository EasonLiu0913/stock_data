# TAIWAN STOCK｜Date Opening Pipeline Repair R2 — CHANGE_PROPOSAL v1 (DRAFT)

**Status:** Owner-approved for versioned registration and execution on 2026-11-08, based on the owner's explicit request to complete R2 safety acceptance and repair the 20261104 44-stock narration attribution. R2 does not revise or pass R1.
**Repository:** `EasonLiu0913/stock_data`
**Project / goal:** `daily-gainers-market-opening-end-to-end` / `goal-v3/MVP-10DAY-v1`
**Predecessor:** `MVP10-OPENING-PIPELINE-REPAIR-v2` R1
**Canonical handoff:** `docs/handoffs/daily-gainers-market-opening-end-to-end.md`
**Machine state:** `docs/handoffs/state/daily-gainers-market-opening-end-to-end.json`
**Review baseline:** remote `main` `7686dd6c716dfbdedb42878230f6693ebd14e3e0`

## Purpose

Propose a minimal, separately versioned recovery round after v2 R1 Prompt B failed. R2 would record the R1 failure faithfully, verify the already-authorized trigger-safety repair against new evidence, and address the independently diagnosed News Narration producer-contract gap using existing verified inputs. R2 must not reclassify R1 as PASS, erase historical workflow runs, change original MVP10-A/B acceptance, or authorize video rendering or publication.

## Immutable R1 history — not eligible for retroactive repair

The pre-registered v2 R1 Prompt B criterion requires confirming that no prohibited workflow was triggered. Commit `28aaaad96c61ede33d12f4ede8144aab3c593cde` did trigger:

- Render-only run `42401534137` for 20261102 by push; it failed before render and produced no artifacts.
- Render-only run `42401534168` for 20261103 by push; it failed before render and produced no artifacts.
- Pages run `42401534231`; the Pages artifact was created/uploaded, but the Deploy to GitHub Pages step failed.

These facts are the durable R1 Prompt B failure. R2 cannot deem R1 compliant after the fact, reinterpret the trigger criterion, or remove these IDs from the record.

## Verified post-failure repair evidence

Owner-approved minimal trigger-safety repair is in commit `b09f7c07389a54d78229b1a95b8fe6bd9194359e`: the 20261102 and 20261103 render workflows are manual-dispatch-only; Pages excludes opening/BFI82U data and no longer watches its own workflow file. Its bounded regression run passed 38/38 locally. The docs/state checkpoint is commit `7686dd6c716dfbdedb42878230f6693ebd14e3e0`; no Pages or Render-only runs were observed for that docs-only commit. This is evidence that the fix is present and no observed recurrence occurred; it does not erase or cure the earlier R1 failure.

## Proposed R2 scope — requires owner approval and a new frozen pair

1. Preserve v2 R1 as `FAILED` in handoff and task state, with its original acceptance text and all three run IDs.
2. Independently verify current remote workflow triggers and paths. R2's prevention acceptance should require no `push` trigger on the date-specific Render-only workflows, no Pages path match for opening/BFI82U evidence, and no Render/Pages runs caused by R2's own documentation or bounded changes. Do not create test pushes or dispatch Render/Pages to prove this.
3. Reuse, by exact remote identity, the existing 20261104 opening (blob `3578047ff03548e2bcb65d908228e9753deb434b`), official numeric Receipt run `42231051247`, and News analysis blob `c31055e4c0f3e60899be5e8e4fe9358c923190a6`. Do not regenerate or overwrite these verified artifacts.
4. Repair the Agent-authored News Narration candidate contract only within an approved paired A/B. Producer: Codex/ChatGPT scheduled author of `research_pending/daily-gainers-video-scripts/YYYYMMDD.json`; the deterministic dual-track materializer passes through those fields and adds the official opening. The current candidate blob `da3b4a47ebb187135f6ec4933dd7c5bb93c9148c` lacks `editorial_quality` and has zero `news_attributions` across 15 stock scenes.
5. Preserve the existing formal validator `scripts/validate_daily_gainers_news_narration.js` and regression contract `tests/daily_gainers_news_narration.test.js`. The producer must emit `editorial_quality.version = news-to-narration-v1` only as a declaration of the actual output contract, plus per-stock source attribution grounded in same-date News: exact stock code, URL, publication timestamp, source/publisher label matching the source title, and a spoken event anchor present in the narration. Respect after-close separation and unique full stock coverage. A version string by itself is insufficient. Run the current validator and tests without weakening them; repair only factual content and producer instructions, never add synthetic PASS metadata.
6. R2 closeout may report these repairs and whether the new R2 acceptance passes. It must not claim v2 R1 Prompt B PASS or original MVP10-A/B PASS. Any change to the successor phase or original acceptance requires explicit owner approval and its own versioned contract.
7. No Render, Pages deployment, TTS/media generation, YouTube upload, schedule, public release, or release-lock change in R2. The original MVP10-A remains unpromoted until an explicit governance decision establishes its next eligible phase and unchanged criteria.

## Proposed R2 acceptance outline (not yet frozen)

- Remote task state and canonical handoff agree: v2 R1 Prompt B is FAILED; R2 remains proposed until approved/registered.
- Historical R1 workflow evidence is retained and linked; no retroactive PASS language appears.
- Trigger repair remains present on current main, and scoped trigger/path inspection finds no recurrence. Verification does not trigger Render or Pages.
- Existing official Opening, Receipt, News analysis, and 44-stock research identities are reused unchanged.
- Agent producer contract and candidate satisfy the existing News Narration validator and tests using source-grounded attributions; if source support is absent, leave that attribution unknown and fail the gate truthfully.
- All output paths, commit/blob identities, and test/validator results are reread from current remote main.
- R2 completion, if approved and passed, only presents the evidence for a separate owner decision on the next original MVP10 phase. It does not auto-promote, render, or publish.

## Explicit exclusions and stop conditions

No history rewrite; no ordinary-stock archive loop; no re-running successful Opening research; no lowering or bypassing validator/A-B criteria; no automatic Prompt A/B; no Render or Pages deployment; no YouTube upload, schedule, public release, or unlocking publication.

## Owner decision required

Review this draft and either approve creating a separate immutable R2 paired A/B contract for registration, request changes, or decline it. Until explicit approval and durable registration of the pair, R2 is not active and no implementation or Prompt B may start.


## Post-draft trigger incident (2026-11-08)

The draft itself was committed in `e08be67c34f8716056bf71e87d42a741238906e7`; because `.github/workflows/deploy-pages.yml` matched the broad `data*/**` path, Pages run 42403883893/job 128497329873 started. Last observed in progress during “Audit every frontend data dependency”; no artifact or deployment step had begun at that observation. Cancellation was unavailable through the active GitHub connector, and the available browser session was logged out. This event is recorded, not hidden. Follow-up mitigation excludes `data_research/**` from Pages deployment paths. This draft remains unregistered and no R2 A/B execution is authorized.


## Owner authorization — 2026-11-08

The owner explicitly directed: complete R2 safety acceptance and repair news attribution in the 20261104 44-stock script. This authorizes only the bounded R2 scope registered in `DATE-OPENING-PIPELINE-REPAIR-PAIR-R2-v1.md`. It does not authorize Render, Pages, TTS/media generation, YouTube actions, or changing the original MVP10 acceptance. R1 remains failed.
