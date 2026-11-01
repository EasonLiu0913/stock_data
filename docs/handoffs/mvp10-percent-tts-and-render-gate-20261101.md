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


## 2026-11-01 — No-write dated regeneration dependency preflight

research_progress_status: PROGRESS
phase_status: MVP10-A INCOMPLETE; MVP10-B FROZEN/NOT_ELIGIBLE
research_progress_evidence:
- Research code `scripts/research_mvp10_rebuild_preflight.js`, regression `tests/research_mvp10_rebuild_preflight.test.js`, isolated read-only workflow `.github/workflows/research-mvp10-rebuild-preflight.yml`; GitHub Run [#41312188482](https://github.com/EasonLiu0913/stock_data/actions/runs/41312188482), commit `54505a502183d7763f062e1cbfb3a68c51fa6b26`, conclusion **success**, Node tests **4/4 PASS**.
- Artifact `13086211063`: `20261008-rebuild-dependency-map.json`, report SHA256 `f98d5522ac8d627db6fb5bc5ebb0b45e95d6892898dd4908308dc9bca404d3ff`. Independent artifact zip digest `sha256:b87e94abec1040a123bde8d82215474f9ac373ac8e8663d86b2f96cd570d8f31`.
- Seven inputs from the same 20261008 chain: raw, analysis-news, analysis-facts, analysis-ai, published analysis, market-summary, video script. The raw/news/facts/AI/published code order and count all match **the original invalid 35-stock universe**, not the required new eligible universe. Changes to original inputs are prohibited in preflight; the test confirms byte-for-byte preservation. Stage order: type/date evidence -> regenerated raw >=5% candidates -> facts -> news -> AI -> published analysis -> market-summary -> editorial script -> **only then** Render-only.
- Existing video scenes needing editorial revalidation/redraft are 1, 2, 3 and 9, including original `9103` in scenes 2/3 and counts/theme/catalyst coverage in opening/closing. This is a minimal set of direct known impacts, not certification that other scene claims are source-valid.
- The existing `build_daily_gainers_market_summary.js` derives a final result only when published analysis exactly matches the raw code order; `validate_daily_gainers_market_summary.js` separately checks news, summary coverage and lineage. Neither validator can certify simply removing 9103 from the narration. Original code/figures need fully reconciled research artifacts.
- Prior evidence: archived TWSE category snapshots show Stock=32, InnovationBoard=2, TDR=1, ETF=0; InnovationBoard classification/date acceptance needs evidence before choosing whether eligible. Same-day MI_INDEX quote archive matches 35/35 source codes but does not certify ordinary security identity.
- `main` and all production, upload, Pages and release flags unchanged. No full 1080p media or private YouTube test claimed.

current_blocker: actual dated ordinary-stock eligibility for InnovationBoard and full semantic/AI/editorial regeneration, not further smoke testing of the TTS parser.
planned_research: next distinct executable A action is an isolated **no-write draft-plan/script reconciliation** driven by the frozen dated source and exact affected claims, including source-specific numeric counts and explicit unsupported-claim omissions. Stop before sending a new script to render unless raw/analysis/news/facts/summary and hard eligibility are all date-aligned and independently validated. No repeated archive category inventory.
prior_attempt: full render failed because 9103 TDR included; now actual 7-source dependency chain and affected scene IDs are recorded with source hashes, confirming rebuild sequence.
anti_loop: do not repeat TTS smoke, DR rejection or archive roster audits with unchanged inputs; do not retry original Render-only with unchanged legacy raw/script. Concentrate next A on concrete claim-aware replacement draft and input proof, or report BLOCKED if authorization/date evidence is missing.
next_action: promptA
plan_changed: no
publication_authorized: false


## 2026-11-01 — Conditional date-bound editorial rewrite draft produced

research_progress_status: PROGRESS
phase_status: MVP10-A INCOMPLETE / MVP10-B FROZEN_NOT_ELIGIBLE
research_progress_evidence:
- Source-preserving `scripts/research_mvp10_conditional_editorial_drafts.js`, `tests/research_mvp10_conditional_editorial_drafts.test.js`, and isolated workflow `.github/workflows/research-mvp10-conditional-editorial-drafts.yml`. GitHub CI [#41312522919](https://github.com/EasonLiu0913/stock_data/actions/runs/41312522919), head `ab51eeb4e26d74d872bebee312ba5b5120ddf910`, **SUCCESS**, 3/3 Node regression tests PASS, job `124865701127`.
- CI emitted a genuine, no-write research Artifact `13085921275` / `20261008-conditional-drafts.json`; JSON SHA256 `f838b8f1b18c343b743a9e4177652830079c10369594a9e3ad7abc69dd5eb3a2`, archive SHA256 `e51c9ef5abf249fdc7cf19ba1b9c16366b9a32c85fb753ac1d5ab072ebbdb02a`. Contains **two alternative research-only scripts** for affected scenes 1, 2, 3 and 9. Both explicitly forbid render/publication and preserve all original source JSON bytes.
- Derived solely from dated raw + published/news analysis, NOT a freshly verified post-exclusion unified synthesis. If Stock-category only is provisionally retained: 32 candidates, 3 `biotech` cause-tagged stocks (9919, 1325, 6504), mean gain 9.89%, 11/32 direct-or-corroborated evidence (34.4%). If InnovationBoard inclusion later independently proven: 34 candidates, 4 tagged stocks (plus 6645), mean 9.86%, 12/34 such evidence (35.3%). This is conditional math, NOT a verified publishable market statistic.
- Draft scene 3 replaces nonordinary 9103 with existing researched ordinary Stock-class candidate 9919 康那香. Frozen 20261008 published analysis supports foreign net -18 lots and margin -327 lots and warns no verified new order. These are preliminary transferred facts pending source/date verification in rebuilt facts/analysis; no unverified causation asserted.
- Draft scenes 1,2,3,9 explicitly say conditional research and prohibit silently treating estimates as certified market claims. They are **not** installed as `video_scripts/daily-gainers/20261008.json`, and cannot be consumed by the actual video validator until all raw/news/facts/AI/published/summary and stock eligibility evidence are reconciled.
- No main edits, no YouTube/Pages/cron actions, no released flags.

current_blocker: date-effective TWSE common-stock type/InnovationBoard inclusion decision plus complete source/claim-preserving regeneration of raw, news, facts, AI, published analysis and market summary; editorial rewrites alone cannot clear those gates.
planned_research: focus next A on building an isolated candidate workspace from original actual-date inputs, with strict classification proof and independent validation of 32/34 scenario choice. Recalculate source-linked semantic analysis before promoting even research Render-only. Do not do additional generic TTS or historical roster scans.
prior_attempt: after original DR candidate rejection and 7-input dependency preflight, now source-derived affected-scene alternate drafts have passed isolated GitHub CI.
anti_loop: do not repeat conditional math or rerun original invalid render; go to actual non-destructive end-to-end source regeneration / explicit honest BLOCKED.
next_action: promptA
plan_changed: no
publication_authorized: false


## 2026-11-01 — Real isolated row-level dated candidate workspaces

research_progress_status: PROGRESS
phase_status: MVP10-A INCOMPLETE; MVP10-B FROZEN_NOT_ELIGIBLE
research_progress_evidence:
- New script `scripts/research_mvp10_isolated_candidate_workspace.js`, regression `tests/research_mvp10_isolated_candidate_workspace.test.js`, research-only workflow `.github/workflows/research-mvp10-isolated-candidate-workspace.yml`.
- GitHub CI [#41312843847](https://github.com/EasonLiu0913/stock_data/actions/runs/41312843847), head `8561f4a485fd830a3e939f6eecbe0c4a1a173845`, job `124866656527`, conclusion **SUCCESS**, Node tests **4/4 PASS**. Tests verify unchanged source bytes, ordering, duplicate output refusal and no output inside original repository.
- Artifact #`13086456247`, `mvp10-isolated-20261008-source-candidates`, ZIP SHA256 `dde7fd87e8bef9a2d2dbb55a18da290bd5aa432a64fe875dc10bd3d125c5406a`, size 92,906 bytes.
- Runner-temp scenario `stock-category-only`: 32 provisional stocks, excluded 9103, 6645, 7740. Manifest SHA256 `69f348abc11f6c2b82bb6be0fb01ded0e83be741d64c79e4f490a718b028ea23`.
- Runner-temp scenario `innovation-conditional`: 34 provisional stocks, excluded 9103 only. Manifest SHA256 `59a82e9b1d828d80d1c4fea34ad67ed8f450cad8fac0abfbb0e9869da8b8b0f5`.
- Each workspace contains five separate noncanonical date-matched per-security record sets: raw, facts, news, AI, published, in exact common code order, with source file SHA256 provenance. Frozen source files unchanged. No old market-summary, priority watchlist or global/market aggregate copied.
- All row outputs carry `canonical_daily_video_input:false` and `record_carry_forward_status:UNVERIFIED_REQUIRES_NEW_SOURCE_RECONCILIATION`. Manifests carry `all_aggregate_statistics_invalidated:true`, `classification_archive_publisher_effective_date_verified:false`, `stock_identity_scope_certified:false`, `summary_regenerated:false`, `editorial_script_rebuilt:false`, `video_render_authorized:false`, `publication_authorized:false`.
- Actual date/quote and pre-date TWSE category snapshot evidence established in preceding CI rounds, but date-effective ordinary-stock classification and InnovationBoard inclusion are **not yet certified**. Do not represent candidate row extraction as real regenerated published analysis or a validated MP4.
- No main change, Pages, production, cron, YouTube upload or release-lock changes.

current_blocker: ordinary common-stock effective-date eligibility, plus full source/claim-valid aggregate analysis, market-summary and narrative reconstitution; draft stock records themselves now physically exist.
planned_research: next A should use provisional stock-category-only records in isolation, recompute source-linked aggregate counts and editorial draft from scratch, and flag any dependent causal/news or scope facts still unverified. Then run mandatory validation only after all original gates and dated identity checks are satisfied. Do NOT repeat generic snapshot/classification inventory or the already successful row extraction.
prior_attempt: previous A had conditional script numbers and drafts but no candidate workspace; now both 32/34 source-preserving candidate workspaces are emitted.
anti_loop: do not retry original DR-inclusive render or present 32/34 scenarios as certified publishing inputs.
next_action: promptA
plan_changed: no
publication_authorized: false


## 2026-11-01 — Recomputed source-linked research aggregates from real isolated candidate rows

research_progress_status: PROGRESS
research_progress_reason: Generated fresh per-security-derived aggregate reports in runner-temp independent workspaces, instead of copying legacy 35-security market-summary or only proposing calculations.
phase_status: MVP10-A INCOMPLETE / MVP10-B FROZEN_NOT_ELIGIBLE
research_progress_evidence:
- New research-only script `scripts/research_mvp10_candidate_aggregate.js`; tests `tests/research_mvp10_candidate_aggregate.test.js`; isolation workflow `.github/workflows/research-mvp10-recalculated-aggregates.yml`.
- GitHub Actions CI [#41313328210](https://github.com/EasonLiu0913/stock_data/actions/runs/41313328210), head `f5abe2589a27b0310cad97a8392b2652c746d225`, job `124868093638`, **SUCCESS**, 4/4 regression tests PASS. Tests check real source-backed 32/34 denominators, changed source-byte rejection, per-security digest tamper refusal and non-overwriting workspace.
- Artifact #`13085513383`, `mvp10-20261008-recalculated-aggregates-research`, archive digest `sha256:70dd9093dc61bd70ff925d7bf442c8e028e1de129aaf5bea1141ae00c8f65b79`, size 95,445 bytes.
- Report SHA256 `stock-category-only`: `b6d516c70d2469a6c2872f8409f52405939ca4e052172c6cc972049d22a9c67e`; `innovation-conditional`: `3dcedf81118cb05df0c1c3f74c02423cfb7e02d1fb8760d95909430063e16ab4`.
- Actual derived conditional results remain stock-only 32 / 11 direct-or-corroborated / 34.4%; innovation-conditional 34 / 12 / 35.3%. Additional independently recomputed arithmetic includes raw 5–7, 7–9.5 and ≥9.5 price bands, evidence-strength counts, theme grouping according to explicit taxonomy aliases, original published institutional/margin signals and 9919 price/flow cross-field equality to same-day facts. The report retains the upstream source receipts and candidate row file digest checks.
- **Do not mistake arithmetic PASS for new evidence verification:** all per-security claims were carried from frozen date inputs, not independently re-researched. `semantic_evidence_reverified:false`, `institutional_external_source_reverified:false`, `date_effective_stock_type_reverified:false`, `complete_final_analysis:false`, `market_summary_final:false`, `render_authorized:false`, `publication_authorized:false`. Legacy 35-stock summary is NOT copied or promoted. No old video script or render was run.
- No main branch writes, production, Pages, schedules, YouTube authorization, upload or release-lock changes.

current_blocker: independently verified 20261008 effective common-stock eligibility (especially 6645/7740 InnovationBoard), checked individual news/AI and market-summary/scene claims under the chosen scope, final source/date gate, and audio/SRT/1080p MP4 end-to-end.
planned_research: now perform a bounded **source-claim verification review** using existing same-day official input receipts and the 32-stock temporary candidate as baseline, then regenerate final research-only semantic/market-summary/scene claims with actual validators. Do not repeat aggregate math, DR rejection, categorical-history inventories or TTS smoke. Stop with precise unsupported claims if primary evidence is absent. Full render remains prohibited until all original acceptance gates pass.
prior_attempt: physically created 32/34 per-security candidate workspaces; now separately recomputed new aggregate arithmetic and checked cross-source consistency with CI.
anti_loop: do not call already-known aggregate re-computation without new evidence; prioritize actual 1080p media, but no bypass of stock type/date/claim validity.
next_action: promptA
plan_changed: no
publication_authorized: false


## 2026-11-01 — 9919 independently checked same-day numeric source evidence

research_progress_status: PROGRESS
phase_status: MVP10-A INCOMPLETE; MVP10-B FROZEN_NOT_ELIGIBLE
research_progress_evidence:
- Isolated source verifier `scripts/research_mvp10_9919_official_claim_gate.js`, tests `tests/research_mvp10_9919_official_claim_gate.test.js`, research-only workflow `.github/workflows/research-mvp10-9919-source-claims.yml`.
- GitHub CI [#41314443932](https://github.com/EasonLiu0913/stock_data/actions/runs/41314443932), head `cdadb738b762883e7a6e3c29a09066e271552f1a`, job `124871409522`, status **SUCCESS**, **2/2 PASS**, including a deliberately date-mutated official institutional source fail-closed check.
- Artifact #`13086905517`, ZIP sha256 `f3e6c8325b092770a9549fb7d63c6f3fc631bfbce84d19929ac413f79abe5cf6`, JSON sha256 `0f91e646028a8cf17c4ba8ed4ef5bef1ca7a2f675f2e3a23f9150d588b1d3f00`.
- Verifier **directly** checks 20261008 original TWSE MI_INDEX price and day change for 9919 康那香 against raw/Facts, official TWSE foreign/trust/dealer net shares against per-security facts with true no-record as null (not zero), and original TWSE margin CSV previous/current amount against day delta. Frozen raw 9919 source has 16.1 close; foreign net -18,000 shares / -18 lots and margin delta -327 lots were source-matched. Checks record date, joins, nonempty input and source SHA256. This is genuinely new official-source numeric consistency evidence beyond the previous self-consistency of published/facts.
- Check **does not** certify original market transaction-type comparability, date-effective common-stock eligibility, exchange-archive acquisition chain, or independent causation of influenza/new company orders. These remain false in output (`date_effective_ordinary_identity_verified:false`, `external_news_catalyst_verified:false`, `independent_publication_scope_verified:false`, `render_authorized:false`, `publication_authorized:false`). Do not treat this as fully verified narrative or a valid video script.
- Production/main, YouTube, Pages, schedules and publication locks untouched. Prior 32/34 research workspaces/aggregate outputs not promoted.

current_blocker: recoverable dated stock eligibility evidence and independent company catalyst/news validation, then regenerate consistent published 32-stock analysis, market summary and all affected video claims. The 9919 numeric fact source is now independently cross-checked and should not be re-tested absent new evidence.
planned_research: next A should use 9919 independently source-checked numeric items to assemble a **guarded draft** 32-stock-only video narrative, excluding unsupported causal assertions, while validating the date-specific scope and remaining story claims. Deliver a new actual research-only date-aligned analysis/script package without bypassing canonical validators; only then initiate 1080p Render-only. If eligibility proof is unavailable, keep phase blocked with precisely identified missing evidence.
prior_attempt: prior isolated aggregate recalculation checked published facts against each other but not original official source; this CI independently read actual quote, institutional and margin archives with date tamper rejection.
anti_loop: do not repeat 9919 source check, percentage TTS, or 32/34 aggregation with identical inputs. Prioritize the source-bound complete editorial package and full render after hard gate.
next_action: promptA
plan_changed: no
publication_authorized: false


## 2026-11-01 — Full 9-scene source-bound editorial research draft

research_progress_status: PROGRESS
phase_status: MVP10-A INCOMPLETE; MVP10-B FROZEN_NOT_ELIGIBLE
research_progress_evidence:
- `scripts/research_mvp10_full_editorial_storyboard.js` now composes a **complete nine-scene 20261008 research-only storyboard** using the independently materialized 32-stock Stock-category candidate, re-derived summary arithmetic, prior conditional scene rewrites, and the independent same-day source-numeric verification for 9919. This produces an actual JSON draft in a runner-temp research workspace, not a canonical/production video script.
- Isolated GitHub Actions [#41314916698](https://github.com/EasonLiu0913/stock_data/actions/runs/41314916698), head `610b7e04bdb859859b1306445737cd650f47756f`, job `124872797829`, **SUCCESS**, **3/3** tests PASS. Actual nine scenes checked for 1100–5500 aggregate narration characters, V4 opening, presentation contract, only in-scope candidate stock codes, removal of 9103 references, no CC opening, privacy/private and retention of original immutable 35-stock script bytes.
- GitHub Artifact `13086916303` (`mvp10-20261008-full-nine-scene-research-draft`) ZIP digest `sha256:a5f8a3ff6ce99c9ea3ceba78b4ce3d877b2adc2f996db4891a860dcb5d202022`, size 100403 bytes. `full-nine-scene-editorial-draft.json` SHA256 `4bcf2fee4b6615eeba99a9723f9c492c91049c303b370a1f2dc464272ca08467`.
- Scenes 1,2,3,9 use conditional Stock-category-only figures and rewritten risk-oriented narration; 3 uses the separately checked numeric 9919 data; scene 8 low-liquidity count corrected from three to two under the 32-stock candidate. Scenes **4,5,6,7** retain original 20261008 prose and are explicitly tagged `LEGACY_PROSE_NEEDS_FULL_SOURCE_CLAIM_REVALIDATION`; no unsupported institutional/news company claims are certified by this artifact. All scenes require final source/policy signoff.
- The actual independent 20261008 effective ordinary-stock eligibility proof remains missing, as does a complete 32-stock published AI/facts/market-summary reconciliation and official original date/source claim validation for surviving story references. Thus `market_summary_final:false`, `upstream_ai_semantic_reverified:false`, `eligible_stock_identity_verified:false`, `render_authorized:false`, `publication_authorized:false`. No fully playable 1080p MP4 is claimed, and **the original strict Render-only workflow was NOT invoked or weakened**.
- All scripts and workflows only on isolated research branch, `main` unchanged; production cron, Pages, YouTube/YouTube credentials and all publishing locks remain untouched.

current_blocker: verify remaining four editorial scenes' numerical claims against dated official originals; independently verify their company-specific catalyst claims or replace with source-safe narration; reconcile date-effective stock-type and 32-stock final analysis/market summary before source-gated full 1080p video.
planned_research: next distinct A should be **bounded multi-scene claim reconciliation for 4/5/6/7** (6672,2305,1301,3416,2428), using dated actual source archives and disclosure records, then revise them without unverified causal claims. Run a single script-level CI on the full nine-scene narrative rather than more single-security smoke tests. Stop if actual official inputs unavailable; state exactly which claim lacks source.
prior_attempt: only partial four-scene conditional redrafts existed and 9919 had independent numeric validation. Now a complete nine-scene draft artifact exists with explicit remaining unverified scenes.
anti_loop: do not rerun the successful nine-scene structure test without new source evidence, don't repeat 9919 or DR/percentage smoke, and don't describe a storyboard as the full 1080p render. No artificial pass on failed official source/date gates.
next_action: promptA
plan_changed: no
publication_authorized: false


## 2026-11-01 — Batch original-source audit and fully revised nine-scene storyboard

research_progress_status: PROGRESS
phase_status: MVP10-A INCOMPLETE; MVP10-B FROZEN_NOT_ELIGIBLE
research_progress_evidence:
- Research original-source multi-code verifier `scripts/research_mvp10_multi_security_source_claims.js`, tests `tests/research_mvp10_multi_security_source_claims.test.js`, isolated workflow `.github/workflows/research-mvp10-multi-scene-source-claims.yml`. CI [#41316626830](https://github.com/EasonLiu0913/stock_data/actions/runs/41316626830), head `f6ef4929f4365107ade5fdf21e8c1d95f4baa622`, job `124877934100`, **SUCCESS**; 3/3 test cases PASS including 5 security source reconciliations, backward-compatible 9919 and falsified-date rejection.
- Evidence Artifact ID `13087621647`, archive SHA256 `e8f3867f387902f8a3230bccef2edcc314a7623e30efb3884d6b77bdb82e3da4`, JSON SHA256 `613e431e8c3016bf03165fa32ddd31360feeb96cc400e5dce5bdad03d5e2a1c1`. Source-crosschecked per-security actual 20261008 exchange quote, foreign/investment trust/dealer rows and margin CSV for codes `6672,2305,1301,3416,2428`. Confirmed 6672 close 555, foreign 251196 shares, margin -178; 2305 close 64.7, foreign 3697975 shares, margin +529; 1301 close 81.3, foreign 14225022 shares, margin +10542; 3416 close 182, foreign 652889 shares, margin +193; 2428 close 282, foreign 39918 shares, margin -82. These are original-source **numeric checks only**, NOT independently verified news catalysts/earnings causality, final market universe approval or video permissions.
- New `scripts/research_mvp10_evidence_safe_nine_scene_script.js` rewrites previously unverified scenes 4/5/6/7 into cautious original-source numeric commentary, deliberately **removing** source-unproven revenue growth attribution, sale price change, contract claims and business causes. Retains nine scenes with immutable V4 four-line introduction, research candidate 32-stock numbers, 9919 numerical evidence, scene 8 corrected low-liquidity count and strict unknown-causality warning.
- Single integrated research-only workflow `.github/workflows/research-mvp10-source-reconciled-storyboard.yml`: [#41316788470](https://github.com/EasonLiu0913/stock_data/actions/runs/41316788470), head `1682913e569befdc792b8bb018f024a8bb8a3ee9`, job `124878416703`, **SUCCESS**, 3/3 tests PASS. All nine scenes present, 1504 narration characters, numeric verified codes `9919,6672,2305,1301,3416,2428`, no DR stock code or unsupported 35-stock narrative, original 35-stock video script preserved byte-for-byte, no direct production writes.
- Artifact `13086994819`, name `mvp10-source-reconciled-nine-scene-research-draft`, archive digest `sha256:00d6d9eb101aeb86d1f714e1148bf9885bc1ce61ad700022e70be8d315fd390d`; JSON `source-reconciled-full-nine-scene-research-draft.json` SHA256 `593fb575f1520147cf4eb14673ca5b53233106b3048d7dfd7af3aa90d62b839b`.
- This is **a complete revised noncanonical storyboard, NOT a canonical validated script, final market summary, TTS, SRT, 1080p MP4 or uploaded video**. `eligible_stock_identity_verified:false`, `upstream_ai_semantic_reverified:false`, `market_summary_final:false`, `independent_news_causality_verified:false`, `render_authorized:false`, `publication_authorized:false`. Original strict Render-only workflow NOT triggered, production/main unchanged, no YouTube/Pages/cron/release-lock effects.

current_blocker: 20261008 date-effective eligible TWSE common-stock type for the chosen 32 Stock-class candidates; complete date-bound vetted 32-stock final facts/news/AI/published/market-summary chain; unverified remaining research narration and final visual/audio source claims. A genuinely output MP4 requires those original hard gates first.
planned_research: next Prompt A should move from noncanonical research drafts toward **one fully date-aligned source-sufficient canonical-format candidate in isolated temp checkout**, keeping strict validation and no main/YouTube. Identify exact required input schemas, regenerate research market-summary from correctly scoped facts/news/published with independent original source checks, and trial original strict script validator before launching actual 1080p Render-only. Do not repeat single-stock audits, scenario statistics or cosmetic draft revision without changing gate evidence. If date-effective ordinary-identity cannot be supported, report explicit blocker and do not forge an official final status.
prior_attempt: previous A produced a nine-scene storyboard retaining 4–7 old company-causality prose, with only 9919 checked. Now 5 additional company source files are independently matched and all nine scenes have been revised under original-source numeric restrictions.
anti_loop: No new isolated CI for already-verified percentages, DR guards, scenario denominators or same six security numeric facts without new evidence. Favor actual full-media acceptance path, not extra receipt research. Maintain immutable A/B.
next_action: promptA
plan_changed: no
publication_authorized: false
