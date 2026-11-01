# MVP10-A — 2026-11-01 percentage TTS / render-only checkpoint

Canonical project: `docs/handoffs/daily-gainers-market-opening-end-to-end.md` on remote main.
Goal: `goal-v3/MVP-10DAY-v1`, phase `MVP10-A` incomplete; frozen `MVP10-B` not eligible.

## Verified progress
- Original Render-only CI [#41309775842](https://github.com/EasonLiu0913/stock_data/actions/runs/41309775842), head `2baefc8178bd6592cfffb409a4169b98946a4639`, **FAILURE** at `Validate ChatGPT script against final analysis`. Job `124857519758` log rejects `9103 美德醫療-DR` in the 20261008 common-stock universe, referenced by scenes 2 and 3. This is an intentional fail-closed guard; do not skip it or silently filter the stock. A 20261013 inventory also contains the DR in its raw input, so a date switch is not a verified solution.
- Percentage narration text normalizer on research branch maps `跌幅百分之1.95% percent` to `跌幅百分之1.95` without touching the caption `1.95%`.
- Independent isolated TTS CI [#41310588052](https://github.com/EasonLiu0913/stock_data/actions/runs/41310588052), head `fef390396ab3b2cd102218a9539af2d23ae1457f`, **SUCCESS**, job `124859931569`: Python regression 6/6 PASS, YunJhe `zh-TW-YunJheNeural` +15% actual MP3 generation and diagnostic report. Artifact ID `13084399166`, GitHub artifact digest `sha256:d31c7349dc68e05f2a6409b9724500644e1baa6fd907c9c609fa7284604ce83c`.
- Synthesized long contextual numeric sentence `今天加權指數跌幅百分之1.95，請留意市場波動。` **PASS** with MP3 SHA256 `20f64ff72eb456e2fae1c3b586dfbf9b97a75b4db14ab01e43a688dfa467ac9e`. A spaced short numeric case succeeded on retry; an unspaced short case failed; Mandarin-words-only short case was inconsistent between runs. **Do not infer deterministic TTS behavior or that the voice has been acoustically reviewed.**
- No YouTube upload, main edits, publication permission, or release-lock changes. This report is research-only; not A completion.

## Next permitted research
1. Rebuild and validate a full date-matched **TWSE ordinary-stock-only** raw/analysis/script bundle, or identify another genuinely verified trading date meeting every original source/date/claim gate; do not silently exclude DR from raw only or keep stale stock count/claims.
2. Re-run the existing research Render-only workflow only after input reconciliation. Inspect true CI job log, audio, burned/external SRT, 1080p MP4, source/date manifest, artifacts and SHA; no YouTube operation.
3. Independently listen to numeric percentage audio in full context and check subtitle timing. Do not treat an MP3 hash or an isolated successful TTS request as acoustic validation.

research_progress_status: PROGRESS
phase_status: MVP10-A INCOMPLETE
current_blocker: 20261008 candidate includes non-ordinary depositary receipt; no certified full dated ordinary-stock replacement.
planned_research: dated source/analysis/script regeneration with unchanged fail-closed gates.
prior_attempt: smoke CI now green; Render-only CI fails before TTS due to ordinary-stock scope gate.
anti_loop: Do not retry the identical Render-only input without reconciliation or repeat standalone percentage smoke tests without new evidence.
plan_changed: no
publication_authorized: false


## MVP10-A next bounded Prompt A — upstream ordinary-stock DR root cause and regression (2026-11-01)

research_progress_status: PROGRESS
phase_status: MVP10-A INCOMPLETE; original preregistered MVP10-B frozen/not eligible.
- Verified direct cause: `scripts/generate_daily_gainers_over_5.js` previously selected all `data_fubon` SMA symbols satisfying the >=5% price arithmetic without a security-type gate. Frozen 20261008 raw includes `9103 美德醫療-DR` with 9.91% gain; `analysis-facts` and `analysis-ai` include this security and script scene 2 references it while scene 3 is devoted to it. Market headline/breadth/sector counts and narrative also depend on the uncorrected 35-stock scope. Silently deleting one row or altering the stock_count would invalidate multiple dated artifacts and editorial claims.
- Research-only upstream producer `scripts/generate_daily_gainers_over_5.js` now fails closed on recognized `-DR/－DR` suffixed candidates, without filtering or writing a new date payload. This is a **minimum known-DR exclusion guard only**, NOT complete common-stock classification; do not classify `-KY`, `-創` or other instruments without evidence. Original 20261008 source evidence remains unchanged.
- New test `tests/daily_gainers_mvp10_candidate_generator.test.js` covers known DR, actual frozen 20261008 snapshot preservation, missing universe and non-DR naming exceptions.
- Independent isolated CI [#41311100419](https://github.com/EasonLiu0913/stock_data/actions/runs/41311100419), job `124861467951`, head `54b25d320aa0222c66d9cb13bf87c6ad03fbf4fc`, **SUCCESS**. Logs: original scope tests 4/4 PASS, new generator tests 5/5 PASS, original dated validation rejects 9103 in scenes 2 and 3, original dated video builder refuses to write a plan/slides. Research push-only workflow with `contents:read`, no YouTube, Pages or main writer.
- Available frozen dated ChatGPT scripts on this research branch: `20261008.json` and `20261013.json` only. Both associated raw universes contain `9103 美德醫療-DR`; simply switching date is not a verified path to a complete MP4.
- A/B scope unchanged: original dated raw, fact/AI, summary and script must be rebuilt/revalidated together from date-bound ordinary-stock evidence before running Render-only. All mandatory official-source/date/claim gates remain active. No authentic ordinary-only replacements are claimed; no full MP4, YouTube or owner publishing authorization.

current_blocker: no complete provenance-checked ordinary-stock-only daily analysis/script bundle for either available dated video script; required source/date/claim cross-field reconciliation.
planned_research: build an isolated explicit, reversible 20261008 ordinary-stock regeneration candidate with valid dated security classification and recompute all dependent facts, AI, summary and narration, then run validators and the existing no-upload render workflow; do not mutate frozen source files or invent AI causal claims.
prior_attempt: upstream generator previously lacked a security-type guard; now a reproducible real-date fail-closed regression passes CI.
anti_loop: do not rerun either original DR-inclusive video script unchanged, and do not spend another turn proving the already-confirmed DR rejection. Move to independently supported regeneration only.
next_action: `promptA` for focused source classification and complete dated source/analysis/script regeneration with tested evidence; stop if required source cannot be proven.
plan_changed: no
publication_authorized: false


## 2026-11-01 — Pre-date TWSE classification inventory + same-date quote evidence

research_progress_status: PROGRESS
phase_status: MVP10-A INCOMPLETE
research_progress_evidence:
- Research category CI [#41311638487](https://github.com/EasonLiu0913/stock_data/actions/runs/41311638487) SUCCESS, 4/4 regression tests, Artifact #13086180087.
- Pinned pre-date category CI [#41311796623](https://github.com/EasonLiu0913/stock_data/actions/runs/41311796623) SUCCESS, integrity checks against pinned Git blobs, Artifact #13085314000.
- Same-date official quote cross-check CI [#41311913862](https://github.com/EasonLiu0913/stock_data/actions/runs/41311913862) SUCCESS, source quote SHA256 `c93be0a5fae5a9aa4ee9a02c83e7a7354fb1a3e715a09cc0f2d3cfe7e76709a5`, 35/35 raw candidate codes found in `20261008` TWSE MI_INDEX table. This is **quote-presence**, NOT a security-type or complete equity-identity certification. Artifacts #13086125663 and #13085184969.
- GitHub snapshots predating 20261008 used by CI: Stock commit `8ec4711cac2ac570218f4d57b5c078a06a59b7cc` (2026-09-04), InnovationBoard `496c52cd2d5da9e8e9672f9ff55811eecd7bb2b3` (2026-09-22), TDR `9e65f777b89eccf1fb4bd192966aed5541a66293` (2026-01-24), ETF `b9501de8b08b0732d47b2e13bcac28705a8dc89c` (2026-10-05). Original CSV blobs match existing pinned checksums in `scripts/audit_twse_isin_category_snapshot.js`. These are **pre-date archive snapshots only**, not proof that the official issuer roster remained unchanged through 20261008.
- Every one of the 35 frozen 20261008 raw candidates matches exactly one pinned category with an exact matching code and name: Stock=32, InnovationBoard=2 (6645 金萬林-創; 7740 熙特爾-創), TDR=1 (9103 美德醫療-DR), ETF=0, mismatch=0. Do **not** call all 34 non-TDR names automatically certified eligible ordinary common shares; InnovationBoard needs a specific eligibility check and date verification. No legacy raw/AI/facts/summary/script was overwritten.
- Scoped read-only research implementation: `scripts/research_mvp10_dated_universe_classification.js` and `tests/research_mvp10_dated_universe_classification.test.js`. Tests refuse duplicate, absent and conflicting classifications, and do not authorize rendering.
- Existing main production code and all release locks remain unchanged. No upload / publication authorization.

current_blocker: Need an editorially consistent 20261008 ordinary-common candidate bundle with exclusions/eligibility justified by dated source evidence; remove DR references from scene 2/3 and recompute market/sector/catalyst statistics in source AI/facts/summary/script, not simply edit 35 to 34. Current exchange quote proves trade presence only.

planned_research: next Prompt A should make a **bounded isolated non-destructive regeneration plan**, identify complete dependencies and actual regeneration commands. Prioritize a real valid renderable dated script over further master classification research. For InnovationBoard, establish eligible ordinary-equity classification and original-date basis, otherwise keep unknown as a BLOCKER. Fail closed if missing, rather than assume eligibility. Next only after evidence: derive/revalidate raw, facts, analysis, market-summary and new editorial script together in a separate research output directory, run original gates and then original research Render-only workflow.
prior_attempt: old 20261008 and 20261013 both include DR. Now independent GitHub history and dated quote evidence distinguish known TDR from unresolved innovation/common-stock eligibility.
anti_loop: do not rerun old invalid full Render-only video; do not recertify historic full-roster master endlessly; use evidence to reconstruct narrow dated production bundle or stop with precise source gap.
next_action: promptA — bounded dated candidate/claims dependency mapping and non-destructive regeneration without release effects.
plan_changed: no
publication_authorized: false
