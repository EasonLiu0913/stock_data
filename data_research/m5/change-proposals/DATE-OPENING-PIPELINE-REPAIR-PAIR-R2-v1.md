# TAIWAN STOCK｜Opening Pipeline Recovery R2 — Frozen Prompt A/B v1

**Status:** Owner-authorized and preregistered on remote main before implementation.
**Project / goal:** `daily-gainers-market-opening-end-to-end` / `goal-v3/MVP-10DAY-v1`
**Phase / round:** `MVP10-OPENING-PIPELINE-REPAIR-R2` / `R2-R1`
**Change proposal:** `data_research/m5/change-proposals/DATE-OPENING-PIPELINE-REPAIR-R2-CHANGE-PROPOSAL-v1-DRAFT.md`
**Canonical handoff:** `docs/handoffs/daily-gainers-market-opening-end-to-end.md`
**Target date:** `20261104`
**Owner authorization:** 2026-11-08 user request to complete R2 safety acceptance and repair the 44-stock script's news attribution.
**Render / Pages / publication:** Explicitly out of scope. Do not dispatch or rerun Render or Pages. No TTS, media, upload, scheduling, publication, or release-lock changes.

## Immutable predecessor

- v2 R1 Prompt B remains **FAILED** because the frozen criterion “verify no prohibited workflow was triggered” was violated by Render-only runs 42401534137 and 42401534168 and Pages run 42401534231.
- Trigger repair commit `b09f7c07389a54d78229b1a95b8fe6bd9194359e` and failure checkpoint `7686dd6c716dfbdedb42878230f6693ebd14e3e0` are historical evidence; no retrospective PASS.
- R2-draft Pages run 42403883893 was canceled before artifact preparation/upload and Deploy; its artifact/deploy steps were skipped. Retain this run and its cancellation evidence.
- Opening, official numeric Receipt and News analysis are reused by identity; do not regenerate or overwrite them.

## Prompt A — bounded recovery and candidate repair

Before work, read remote root `AGENTS.md`, Goal-Anchored Handoff v3, routing registry, current handoff/state, original MVP10 pair, v2 proposal/pair, this R2 proposal/pair, and editorial policy. Confirm latest main and current Actions runs.

1. Keep v2 R1 permanently marked FAILED. Record all R1 workflow run IDs and the trigger-repair commit. Verify Pages run 42403883893 ended cancelled, with artifact preparation/upload and Deploy skipped; do not infer success from step status alone.
2. Inspect current remote triggers and run inventory. Confirm date-specific Render workflows remain workflow_dispatch-only; Pages excludes `data_research/**`, opening/BFI82U evidence, and its own workflow path. Do not push a synthetic test commit or dispatch any Render/Pages workflow. Verify R2 registration/implementation commits did not start those workflows.
3. Reuse exact existing source identities:
   - opening blob `3578047ff03548e2bcb65d908228e9753deb434b`;
   - official numeric Receipt run `42231051247`;
   - News analysis blob `c31055e4c0f3e60899be5e8e4fe9358c923190a6`;
   - 20261104 candidate base blob `da3b4a47ebb187135f6ec4933dd7c5bb93c9148c`.
4. Repair only `research_pending/daily-gainers-video-scripts/20261104.json` and its regression coverage. Preserve the 44 unique stocks, 15 stock scenes, and final closing summary. Do not change the verified opening, numeric Receipt, source list, News file, or AI analysis.
5. The latest News analysis contains source records for exactly four covered stocks: 6933, 3515, 7711 and 7710. Add source attribution only for these verified rows; do not invent news for the other 40. For every attribution, use exact same-date News URL and `published_at`, a source label present in the News title and in the spoken narration, and a specific spoken event anchor present in the narration. Keep all language explicitly non-causal unless the source proves causation; distinguish after-close news.
6. Add the existing `news-to-narration-v1` contract declaration using the same field shape as the passing 20261102 candidate. This field declares the real output contract; it is not a PASS flag. The materializer must not create or fabricate attribution metadata.
7. Update `tests/daily_gainers_news_narration.test.js` with a 20261104 case that calls the unchanged formal verifier against the pending candidate, same-date News and AI data. Preserve existing tests.
8. Run the exact news narration test suite and independently run the formal verifier against the 20261104 pending candidate. Verify full 44-code unique coverage, all four source-bearing codes attributed, source URL/time/title matches, spoken source/anchor, and after-close rules. Do not materialize or run Render/Pages.
9. Commit only the candidate and targeted regression test. Read back latest main and confirm content/blob identities. Mark Prompt A complete only when all above pass; otherwise leave exact gate pending.

## Prompt B — independent R2 closeout

Independently inspect current remote main and verify:

1. v2 R1 still says FAILED; all prior workflow IDs and trigger repairs remain recorded. R2 has not relabeled R1 or changed original MVP10-A/B acceptance.
2. Pages run 42403883893 is terminal cancelled and artifact preparation/upload and Deploy were skipped. R2 runs did not trigger Render-only or Pages deployment.
3. The Pages `data_research/**` exclusion and manual-only 11/02/11/03 Render triggers are present on latest main.
4. Exact source artifacts remain unchanged and the opening/Receipt/News PASS identities are reused.
5. The private candidate has 44 unique stock codes with no omissions/duplicates, 15 stock scenes and a single final closing summary.
6. Four and only four News source-bearing codes are attributed with source-grounded URL/time/title and spoken anchor. Run `node --test tests/daily_gainers_news_narration.test.js` and direct 20261104 verification; both must PASS.
7. Verify candidate and tests are on remote main by exact commit/blob, and check run inventory for forbidden Render/Pages side effects. A passing local test alone is not durable completion.
8. Do not run Render/Pages, do not upload, schedule, publish, or unlock YouTube. A successful R2 closeout cannot pass v2 R1 or MVP10-A/B and does not automatically promote MVP10-A; report the owner decision needed for any later phase.

**Prompt A completion contract:** candidate + targeted test committed and read back, the exact verifier and regression suite pass, all four source-bearing attributions are grounded, and no forbidden workflow was triggered by R2 commits.
**Prompt B PASS:** independently verifies the above R2 contract only. It does not alter R1's FAILED result, complete the ultimate video goal, pass original MVP10-A/B, or authorize downstream rendering/publication.
