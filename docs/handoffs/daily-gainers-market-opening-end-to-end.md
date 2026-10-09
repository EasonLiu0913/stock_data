# TAIWAN STOCK — Daily 5% Video Market Opening (Goal-Anchored Handoff)

Canonical handoff: `docs/handoffs/daily-gainers-market-opening-end-to-end.md`
Task id: `daily-gainers-market-opening-end-to-end`
Project routing status: **ACTIVE** (owner-authorized v3 activation 2026-10-09); previous `institutional-accumulation` preserved as pending. Activation does NOT execute Prompt A.
Plan version: `goal-v1`, authored 2026-10-09.
Ultimate goal status: **NOT COMPLETE**. Round 0 evidence inspection **PASS**; all subsequent rounds **PENDING**.

## A. Immutable Project Charter — WHY

Build a trustworthy, reusable **TWSE-only market-opening segment** for the daily TAIWAN STOCK 5%-gainers YouTube video and, after evidence-backed verification, integrate it into the existing daily automation without duplicate work. A final success is not merely a green CI run or a JSON sample: the segment must appear correctly in a real end-to-end daily video, with factually valid market interpretation, aligned narration/TTS/Traditional Chinese subtitles, visual preview, and durable daily replay/upload behavior.

The first three spoken lines, exactly in order, must be:
1. 大家好，歡迎來到 TAIWAN STOCK！
2. 追蹤資金，解讀行情。
3. 錢在哪，我們就在哪！

The **entire market-opening segment**, including those brand lines, must be **60–90 seconds** measured with actual TTS. Style: 70% professional financial anchor, 30% incisive analyst. Spoken content, display cues, and Traditional Chinese SRT must have one semantic source; SRT must not omit spoken sentences. Do not use unverified facts, invented figures, or assert retail/institutional counterparty trades without evidence.

## B. Scope and frozen acceptance conditions — WHAT

- Market and breadth: TWSE listed **ordinary common stock only**. Exclude TPEx, ETFs, ETNs, warrants, DRs, preferred shares, and other non-common instruments. Never infer identity from code length.
- Report official TAIEX O/H/L/C, point/% change; *separately scoped* official TWSE trading value/volume/count and 5-trading-day average; common-stock advancers/decliners/unchanged/no-trade and >=5% gainers; three institutional groups' **TWD** buy/sell/net; defensible industry turnover and market mood with evidence and explicit uncertainty.
- No conflation of TWSE whole-market turnover with ordinary-stock-only turnover. No conflation of individual-stock **shares** with institution **TWD** net flows, or sector turnover with net capital inflow.
- Daily source dates and versioned source manifests must be checked; no silent prior-day fallback on missing data or non-trading days.
- The project must not alter V1/V2 predictions, existing market-summary, protected workflow routing, existing YouTube upload/resume behavior, or all other tasks except through separately accepted scoped changes.
- Fail closed if classifications or critical dates are unproven. `partial` is NOT final publication authorization. Do not silently drop missing fields from the required feature contract to claim success.
- Reuse current daily video source and script/TTS/caption architecture. Production automation integration only after real preview/video evidence and explicit scoped verification.
- Every round must document actual outcome and current remote main, not infer PASS from commits or conversation.

## C. Goal-driven roadmap and statuses

The following plan is **preapproved for sequencing and analysis only**. Each phase's exact Prompt A/Prompt B pair must be preregistered at promotion time **before** that Prompt A begins; do not fabricate detailed future acceptance requirements with unknown evidence. Preserve the ultimate charter on all rounds.

| Phase | Small goal | Acceptance/exit | State |
|---|---|---|---|
| M0 | Existing MI_INDEX full-file inspection and test gate | [Evidence #12](https://github.com/EasonLiu0913/stock_data/actions/runs/37909179708) passes 41/41 tests and MI_INDEX inspection | COMPLETE (gate only) |
| M1 | Historically evidenced TWSE ordinary-share roster and actual breadth for 20261008 | Real point-in-time provenance, explicitly classified eligible/excluded rows, price-sign validation, reproducible counts; no guessed roster | PENDING — **NEXT** |
| M2 | Finish market-opening financial facts | Official TWSE institution TWD totals, sector turnover/mapping, 5-day history, breadth; date/unit/scope evidence and snapshot validation | PENDING |
| M3 | Research and validate market-regime phrasing | Transparent, conservative criteria with test cases, evidence/uncertainty and no unsupported flows | PENDING |
| M4 | Produce spoken market-opening script and single-source captions contract | Brand 3 lines exact; all facts cited internally; spoken/screen/SRT parity; defensible 70/30 voice | PENDING |
| M5 | Real 60–90s TTS and video preview proof | Timed TTS incl. brand, segment UI, presenter, 1080p presentation, subtitles not blocking UI; actual artifact comparison | PENDING |
| M6 | Daily workflow integration + YouTube pilot + durable acceptance | Real daily-run/video/subtitle+upload evidence; retry/reuse semantics, non-trading days, no duplicate renders; guarded rollout | PENDING |
| M7 | Final project closeout | All M1–M6 PASS with durable paths, evidence and end-to-end successful video; explicitly mark project COMPLETE | PENDING |

Do not mark M1 complete merely because the source JSON contained 36,699 rows; this is a mixed-instrument quote table, not the ordinary-stock count.

## D. Execution state, single routing source

Global task state is from `docs/agent-prompts/task-routing.json`. Global invariant: **one** active task at most. This project is currently **active**, as verified in the routing registry on 2026-10-09; future changes must follow the registry. Activation alone never executes work.

Within this project, follow phase identity and paired-prompt state:
- Current phase: M1 **ACTIVE / PROMOTED; Prompt A BLOCKED on historical master provenance**. A previous `promptA` performed bounded source investigation and checkpointed the blocker; it did NOT meet the A completion contract.
- M0: COMPLETE, accepted evidence only for tests and raw MI_INDEX inspection, NOT overall Phase 1 completion.
- M1 Prompt A: PREREGISTERED, STARTED, BLOCKED; eligible for **same-round source-evidence recheck and bounded resumption** on bare `promptA`, not for completion claims.
- M1 Prompt B: PREREGISTERED, NOT ELIGIBLE until A is durably COMPLETE; bare `promptB` must explain the blocker and recommend `promptA` or owner action, not execute B.
- Later phases: PENDING ROADMAP ONLY, no implied permission to execute early.
- Project status COMPLETE only after M7 closeout; any intermediate green CI is NOT sufficient.

Now that the project is active: bare `promptA` picks only the earliest promoted phase whose Prompt A is not complete and previous Prompt B passed; bare `promptB` verifies the same phase whose Prompt A has durable completion but Prompt B is pending. Keep pairing immutable after A starts. If blocked, record BLOCKED and the precise missing evidence instead of pretending COMPLETE or jumping ahead.

## E. Observed evidence and existing entry points

- Last known research gate: Workflow `.github/workflows/research-twse-market-opening-phase1.yml`, run `37909179708` / job `113749904834` on commit `e30413e9b764df92d8bb5281aea76b5f81797644`: 41/41 tests PASS; MI_INDEX inspection PASS; 10 top-level tables, candidate quote table index 8, **36,699 mixed-instrument rows**; input SHA256 `c93be0a5fae5a9aa4ee9a02c83e7a7354fb1a3e715a09cc0f2d3cfe7e76709a5`. This does NOT prove classifications or complete opening data.
- `data_twse_mi_index/20261008_twse_mi_index.json` — original large archived TWSE MI_INDEX.
- `scripts/inspect_twse_mi_index_breadth.js` — compact table-layout evidence tool.
- `scripts/build_twse_common_stock_breadth.js`, `tests/build_twse_common_stock_breadth.test.js` — breadth and unit regressions.
- `scripts/normalize_twse_security_master.js`, `tests/normalize_twse_security_master.test.js` — classified historical master conversion and archive byte digest verification. **SHA matches do not independently prove that the purported original was genuinely obtained from TWSE**; source acquisition provenance remains the M1 blocker.
- `scripts/run_twse_common_stock_breadth.js` — snapshot for verified breadth only.
- `scripts/merge_daily_gainers_market_opening_breadth.js`, `tests/merge_daily_gainers_market_opening_breadth.test.js` — bounded merge, no premature promotion.
- `scripts/validate_daily_gainers_market_opening.js`, `tests/daily_gainers_market_opening.test.js` — contract gate.
- `scripts/build_daily_gainers_market_opening_phase1.js`, `tests/daily_gainers_market_opening_real_snapshot.test.js` — real source based partial snapshot.
- `data_daily_gain_over_5/market-opening/20261008.json` — **partial**, no verified breadth. `data_daily_gain_over_5/20261008.json` preliminary gainers count not certified TWSE-only.
- `docs/daily-gainers-market-opening-phase1.md` — Phase 1 source scope/fields decisions; carry its constraints forward. `scripts/daily_gainers_brand_opening.js` — frozen brand source.
- `AGENTS.md`, `promptA.md`, `promptB.md`, `docs/agent-prompts/prompt-a-runner.md`, `docs/agent-prompts/prompt-b-runner.md`, `docs/agent-prompts/task-routing.json` — canonical runner and global selection policies.

## F. Scope-change and plan-version governance (proposal implemented within THIS task handoff)

All AI agents shall uphold the Charter and roadmap. If an unanticipated requirement, missing authoritative source, new security risk, or technical constraint arises, agent must:
1. Log `CHANGE_PROPOSAL`: observed evidence, why original plan fails, affected phases, options, tradeoffs, requested acceptance change, no speculative commitments.
2. Classify as `implementation detail` (within frozen goal and acceptance) or `scope/goal/acceptance change`.
3. Minor implementation detail may be handled within the active paired contract with durable record and Prompt B recheck; it must not silently alter outcomes.
4. Scope/goal/acceptance change requires owner discussion and explicit approval **before** rewriting the Charter or phase acceptance. Append `decision log`, bump plan version, preserve prior contract/history. Do not retroactively relax an active round's preregistered Prompt B; close as BLOCKED/SUPERSEDED with owner approval and a new pair.
5. A new phase must link back to a specific Charter requirement and prove it is necessary. No open-ended research tangents or unapproved production rollout.
6. Every closeout must report `ultimate goal progress`, `finished stages`, `remaining blockers`, `next phase id` and `whether roadmap changed`.

## G. Phase M1 — Preregistered Prompt A (implementation and evidence)

Continue repository `EasonLiu0913/stock_data` ONLY if the owner has explicitly activated task `daily-gainers-market-opening-end-to-end` in `docs/agent-prompts/task-routing.json` and M1 Prompt A is eligible.

Before work: fetch newest remote `main`; read `AGENTS.md`, global Prompt A runner, routing file, this entire canonical handoff, `docs/daily-gainers-market-opening-phase1.md`, relevant source/validator scripts listed above; recover the fixed preregistered M1 Prompt B from this pre-A handoff.

M1 objective: obtain **auditable point-in-time classification** for the 2026-10-08 TWSE listed ordinary-share universe and use the actual archived MI_INDEX, not code-length inference, to calculate reproducible ordinary-stock breadth. Audit what the historical classification source actually guarantees; do not assume a live/current ISIN list is an exact 20261008 archived roster. Capture official source URL, acquisition mechanism/time, original archive bytes and hash, source-effective dates, listing/delisting semantics, issuer/instrument classification, and quote-row coverage/omissions. If the authoritative source lacks a historical as-of view, do not falsely mark data verified: evaluate official archival alternatives and checkpoint `BLOCKED_ON_HISTORICAL_MASTER_PROVENANCE` with concrete candidate evidence and minimum owner decision needed.

Once historically verified: normalize with `scripts/normalize_twse_security_master.js`; calculate with `scripts/run_twse_common_stock_breadth.js`; validate with `scripts/validate_daily_gainers_market_opening.js` and merge with `scripts/merge_daily_gainers_market_opening_breadth.js`. Reconcile every relevant row and classification, including suspended/no trade, unusual sign glyphs, noncommon instruments and duplicate securities; save durable same-day classified counts and provenance. Do not certify source-derived preliminary 5% count unless it passes the new TWSE common-stock classification.

Scope boundary: M1 does not begin M2 institutions, sector flows, video, SRT, or YouTube; existing `partial` stays partial. Add exact tests/CI evidence for real source. Current `main` may have advanced; verify it first.

Prompt A completion contract: (a) authoritative historical coverage proven and reproducible breadth artifact durably verified on remote main, **OR** (b) blocked state with genuine exhausted bounded provenance investigation, candidate source findings and concrete next action; explicitly report **BLOCKED, not complete** in case (b). Commit/checkpoint this handoff with evidence, preserve identical M1 Prompt B and mark A COMPLETE / B PENDING only in case (a). Report `Prompt A complete — ready for Prompt B` only after (a) and remote durability check. Stop, never execute B automatically.

## H. Phase M1 — Preregistered Prompt B (independent closeout)

Only after M1 Prompt A is durably COMPLETE and the owner invokes `promptB` for this active task, recover THIS exact preregistered Prompt B from pre-A history. Fetch current remote main and independently verify:

1. The task remains globally active, M1 round identity is unchanged, M0 evidence claims are correct.
2. TWSE security type universe is backed by authentic, reproducible as-of 2026-10-08 archival provenance, not a guessed current roster, a placeholder URL, or unchecked SHA claim.
3. Archived bytes' hash, source date, roster effective listing/delisting dates, symbol identities and classification are consistent, with unknown cases explicit/blocking.
4. `data_twse_mi_index/20261008_twse_mi_index.json` date/hash match the source evidence; stock quote table is correctly identified among the 10 tables; table rows are not equated to common-stock count.
5. All intended TWSE common-share quote rows are classified and reconciled; noncommon and TPEx are excluded, missing/no-trade and trade sign semantics audited. Breadth advancers+decliners+unchanged+no-trade=eligible and 5%-gainers are a verified advancing subset.
6. Recompute outputs in a fresh checkout; focused tests and workflows PASS. Record run IDs, SHA, data paths and schema.
7. The merged artifact is `partial`, not `complete`, and other facts/stages have not been silently promoted. V1/V2, existing video workflows, protected outputs and routing stay unchanged.
8. The handoff records immutable evidence, M1 Prompt B PASS (only when all eight criteria pass), M2 preregistered paired A/B with M2-boundary contract, decision log/plan version, and remote committed state.

On any failure: keep M1 blocked, repair only the bounded fault and rerun full closeout; do not promote M2 or alter acceptance without explicit owner change approval. On PASS: mark M1 COMPLETE, preregister/promote M2 internally, preserve unique globally active task, commit and verify, stop without auto-running M2 Prompt A.

## I. Decision log

- 2026-10-09, `goal-v1`: established explicit immutable ultimate video outcome, whole-project milestones, and phase pairing. Initially registered PENDING, then **owner-authorized ACTIVE** under repository-wide Goal-Anchored Handoff v3. No Prompt A execution occurred during migration.
- 2026-10-09, Goal-Anchored v3 rollout: `AGENTS.md`, canonical Prompt A/B runner protocols, `docs/agent-prompts/goal-anchored-handoff-v3.md`, and task routing registry upgraded; internal M1 is promoted for the NEXT owner-issued `promptA`. All other incomplete projects retain their checkpoint state.

## J. M1 Prompt A provenance investigation checkpoint — 2026-10-09

**M1 status: BLOCKED_ON_HISTORICAL_MASTER_PROVENANCE. This is NOT Prompt A success, NOT Prompt B eligibility, and NOT M1 PASS.** The originally preregistered M1 Prompt A and M1 Prompt B in sections G/H remain unchanged; no subsequent phase is promoted.

### Verified candidate official sources

1. TWSE Data E-Shop **每日證券市場概況資訊 / TRANISIN**: `https://eshop.twse.com.tw/zh/product/detail/000000006f6a5e3401702de5988d004b`. Official listing documents daily production (07:00), XLS, market, security code, security type, security name, ISIN, listing date, industrial group, etc.; historical ordering is offered and subject to subscription/usage restrictions. This is the strongest identified candidate for point-in-time 20261008 classification, but the actual dated archive has NOT been obtained or independently authenticated. Subscribing/ordering is NOT authorized by this checkpoint.
2. TWSE Data E-Shop **證券主檔 / BFI85U**: `https://eshop.twse.com.tw/zh/product/detail/000000006f6a5e34017033452c8d0070`. Official daily security master (produced 22:00 for next day's reference) includes security category code and trade information. Temporal applicability to 20261008 requires rigorous production/effective-day reconciliation. No dated original file obtained.
3. TWSE public **ISIN list**: `https://isin.twse.com.tw/isin/e_C_public.jsp?strMode=4`. Page displays a current update timestamp/listing dates, not a provable archived as-of 20261008 full historical master. It cannot independently verify historical presence/delisting on target date. No historical snapshot claimed.
4. TWSE public **暫停交易證券**: `https://www.twse.com.tw/zh/trading/historical/twtawu.html`. Historical suspension evidence could supplement coverage, but cannot independently provide full ordinary-stock roster and instrument type for target day.

### Code and artifact scope reviewed

- `scripts/normalize_twse_security_master.js` verifies declared archive digest against supplied bytes and listing windows, but does not attest original acquisition provenance; a self-generated archive + digest is insufficient.
- `scripts/run_twse_common_stock_breadth.js` intentionally fails without a date-specific digest-verified master; `scripts/build_twse_common_stock_breadth.js` fails on unknown instruments, so do not substitute current ISIN or four-digit codes.
- Prior MI_INDEX inspection run `37909179708` (41/41 test gate) gives 36,699 mixed-instrument rows, not ordinary common stock identities. No breadth counts or certified 5%-gainers are recorded here.
- `data_daily_gain_over_5/market-opening/20261008.json` remains `partial`; no new certified breadth artifact or publication authorization.

### Blocking evidence and bounded next action

**Missing:** authentic 20261008 effective-dated TWSE ordinary share classification file / independently verifiable archival provenance, original bytes/hash, acquisition time, coverage and effective-date semantics. Until present, fail closed: no guessed roster, no `complete`, no M2/video/upload/Prompt B.

**Next source-verification options (owner decision required if purchase or licensed data use is necessary):** obtain licensed 20261008 TRANISIN original XLS with lawful permitted use and dated delivery proof; alternatively identify and independently validate a freely available official dated archived master with identical coverage. Cross-check BFI85U temporal semantics and suspension history before claiming the market universe complete. Document file hashes and acquisition chain, reconcile every MI_INDEX quote security, then run the existing normalization, breadth, validator, merge and focused tests. Preserve original M1 Prompt B; this checkpoint does not alter acceptance or the Goal `goal-v1` charter.

### Goal v3 roll-up

- Ultimate goal progress: M0 inspection gate complete; M1 historical security coverage blocked; no real video acceptance yet.
- Completed versus remaining phases: M0 complete; M1 blocked; M2–M7 pending.
- Current blocking evidence: missing independently authenticated 20261008 official instrument classification archive.
- Next phase ID: M1 (resume evidence acquisition); M2 is not promoted.
- Plan changed? **No**; investigation checkpoint only, no relaxation to preregistered Prompt B.

## K. State-aware v3 handoff guidance — 2026-10-09

- This project remains the unique globally Active task unless the owner switches it. **NEXT_COMMAND: `promptA`**, after checking for a newly available authentic as-of 20261008 classification archive; bare command suffices, no `resume M1` suffix required.
- On `promptA`, re-read the official-source evidence and J blocker, perform only bounded original M1 work, reuse already accepted M0 inspection, and stop with exact source/permission action if no verifiable dated archive can be obtained without owner-approved access. Do **not** force a paid order or falsely accept today's ISIN list as historical.
- On `promptB` before A COMPLETE, report `B_NOT_ELIGIBLE; NEXT_COMMAND: promptA`, the source-specific blocker, and owner action if necessary; no fake B failure/PASS.
- Awaiting official data is not background work. A later `promptA` or owner-authorized automation checks the condition again. The paired acceptance in H and Goal `goal-v1` remain unchanged; M2–M7 stay pending. `Plan changed? no`.
