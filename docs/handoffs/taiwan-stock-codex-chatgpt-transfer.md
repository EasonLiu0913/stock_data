# TAIWAN STOCK — ChatGPT ↔ Local Codex operational transfer

**Operational transfer document:** `docs/handoffs/taiwan-stock-codex-chatgpt-transfer.md`  
**Canonical project handoff (unchanged):** `docs/handoffs/daily-gainers-market-opening-end-to-end.md`  
**Repo:** `EasonLiu0913/stock_data` | **Allowed working branch:** remote `main` only  
**Initial snapshot:** 2026-11-07 00:00 Asia/Taipei (historical observation; **NOT** a live status feed)  
**Purpose:** enable Local Codex, scheduled ChatGPT Agents, and interactive ChatGPT to hand work to each other without restarting research, losing evidence, or weakening gates.

> This is a **non-canonical operational transfer note**, not a new project, branch, Agent, mutable state registry, authorization, or replacement for the original Goal-Anchored Handoff v3 / A/B. If this note conflicts with current `main`, `AGENTS.md`, canonical project handoff, owner-approved policy, original frozen A/B, actual validator/receipt, or fresh GitHub Actions results, follow the higher-priority current evidence. Never update frozen A/B merely to get PASS.

## 1. Startup and truth hierarchy (mandatory on every transfer)

1. Open the repository; inspect `git status --short` and `git branch --show-current`. **Do not discard uncommitted changes**. Fetch `origin main` and compare local HEAD / upstream; do not force-reset or overwrite concurrent work.
2. Read `AGENTS.md`, `docs/agent-prompts/goal-anchored-handoff-v3.md`, `docs/agent-prompts/task-routing.json`, the canonical project handoff above, and the applicable `docs/policies/daily-gainers-video-editorial-verification-delivery-v1.md` before modifying video/validation logic. Read other required architecture/phase/ADR documents if the change becomes substantial.
3. Resolve the oldest unfinished **valid TWSE listed trading date** by current FIFO/date-lock/ledger; do not blindly force `20261104` after it is complete. The 20261104 details below are a **reproducible known failure** only.
4. Check the exact current per-date raw stock list, Facts/News SHA, official numeric Receipt, AI candidate/published file, Unified/Market Summary and actual relevant Workflow Run/Job/Artifact. Distinguish “file exists”, “schema locally checks”, “CI workflow succeeded”, and “all original daily gates and video A/B PASS”.
5. Treat evidence with date, source SHA, Run/Job ID and log as authoritative over older chat summaries. A `main` Commit SHA changes often due to unrelated collectors; avoid treating a prior HEAD as current.

## 2. Frozen project scope and safety

- TWSE **listed** universe only (not TPEx/OTC); do not invent a trading-day snapshot or substitute stale-source figures.
- Existing single pipeline: hourly `TAIWAN STOCK｜整點 Agent v5.0` (:00) and `TAIWAN STOCK｜半點 Agent v5.0` (:30) alternate against the same remote `main`; preserve FIFO, date lock, source/validator SHA, CAS, append-only ledger, checkpoints, attempt caps, and idempotency. Their latest prompt text lives in ChatGPT Automations, **not automatically in the repository**. Request/export it explicitly when needed; do not claim this file is a full copy.
- Keep existing original Goal-Anchored paired Prompt A/B, phase ownership, scope/version approval and unreduced independent acceptance. This operational note does **not** grant permission to start a new phase, relax a failed B, or silently change the current project.
- **NO YouTube upload** of any privacy state; NO release-lock change, OAuth/Secrets access, channel edit or upload trigger. Render-only is the end of the currently authorized media verification path. A Workflow with indirect Pages/deploy/upload side effects must be inspected before dispatch.
- No research branch, duplicate Agent, second workflow pipeline, fake pass, empty triggering Commit, blanket regeneration of valid 44-stock analyses, or destructive `git reset --hard` on the user's working copy.
- If a write races another worker: re-read current `main` and file blob SHA; CAS/minimal commit only, then verify readback. Do not overwrite another worker's successful data. Code corrections and stock-data generation must not write the same path simultaneously.

## 3. Last verified 20261104 evidence (as at initial snapshot)

| Item | Evidence / interpretation |
| --- | --- |
| Official numeric S01 | Receipt `data_daily_gain_over_5/verification/official-numeric/20261104.json` states PASS / 999 checks / 0 errors / 44 stocks; [Run 42231051247](https://github.com/EasonLiu0913/stock_data/actions/runs/42231051247), Job `127936725531`. Reconfirm source SHA before asserting current equivalence. |
| AI candidate | `research_pending/daily-gainers-ai/20261104.json`; 44/44 rows reported, observed blob SHA `24cf09ade6b98488b792aebc5036db9240c58a30`. 44/44 **does not** equal C02/C03/DAILY_VALIDATOR PASS. |
| Published AI | `data_daily_gain_over_5/analysis-ai/20261104.json` previously had the same observed blob SHA; publication is not substitute for matching current formal validator evidence. |
| Market summary | `data_daily_gain_over_5/market-summary/20261104.json`, observed `final/full_synthesis`; check version, SHA, complete coverage and full original gates before reuse. |
| Most recent manually dispatched validator examined | [Run 42246225691](https://github.com/EasonLiu0913/stock_data/actions/runs/42246225691), on `main` SHA `c9b4ec7c38c9e6c6de76aaabf5b0510af5ee41ca`; `completed/failure`. Job `127989039610` failed **before** target-date resolution and before per-stock AI validation. No artifacts. |
| Specific failure | In `Validate central contract`, running Node 24: `Error: Invalid daily gainers AI contract: institutional_verification.required_fields_when_verification_required must include checked_at`. This proves **contract loader vs JSON mismatch**, not that any of the 44 analyses is defective. |
| Automated Agents | 2026-11-06 23:30 half-hour Agent confirmed candidate/published files but had no GitHub Connector workflow-dispatch write action. That is a tool limitation, not a failed validator; the owner manually launched the run above. |
| Video | No new 20261104 Render-only MP4/SRT/QA/SHA success has been verified in this transfer. Do not claim video delivery or YouTube upload. |

### Exact primary entry points

- `config/daily-gainers-ai-contract.json` — latest JSON contract. Under `institutional_verification`, `required_fields_when_verification_required` currently lists `status`, `summary`; `optional_audit_fields` lists `checked_at`, `sources`.
- `scripts/lib/daily_gainers_ai_contract.js` — `loadDailyGainersAiContract()`, currently asserts **all four** fields in `required_fields_when_verification_required`; inconsistent with JSON contract.
- `scripts/validate_daily_gainers_ai_analysis.js` — validates AI analysis fields; `checked_at` and `sources` are optional audit metadata validated **if provided**.
- `scripts/daily_gainers_ai_contract_cli.js` — relevant command `node scripts/daily_gainers_ai_contract_cli.js print`.
- `.github/workflows/publish-daily-gainers-ai-analysis.yml` — **exact workflow name**: `[07 研究] 5% 漲幅 AI 籌碼解讀驗證發布`. Supports `workflow_dispatch` with input `date=20261104`; inspect side effects (including Pages) before any new run.
- `data_daily_gain_over_5/analysis-facts/20261104.json`; `data_daily_gain_over_5/analysis-news/20261104.json`; `data_daily_gain_over_5/analysis/20261104.json` — verify before mutating.
- `research_pending/daily-gainers-ai-checkpoints/20261104/` — directory. Some connector directory reads previously returned `JSONDecodeError`; fallback to known real paths, git tree, candidate entries, ledger and actual Validator error list, not guessed single-file names.
- Relevant render workflow, scripts, tests, actual render artifacts and their exact paths: **re-discover from current main before touching**; do not assume a stale name or old Dashboard implementation.

## 4. Next bounded task — contract repair, not bulk re-research

**Current proven blocker:** formal validator cannot finish the `Validate central contract` startup check. Do not re-interpret this as 44-stock AI C02 failure.

1. Recheck latest `main` and whether another commit already fixed the same assertion. Inspect the JSON contract + loader + per-stock validator **together**.
2. If mismatch remains, make the **smallest loader-only change**: `required_fields_when_verification_required` must require `status` and `summary`, while `checked_at` and `sources` remain optional audit metadata. If supplied, retain timestamp/source shape validation. Do not remove real S01 official-numeric reconciliation, C03 AI/Facts cross-check, C04 news time/source validation, O01/O02 or the original A/B gate. Add a focused regression that checks loader accepts the current approved JSON and rejects an invalid required-field contract, where existing harness permits.
3. Run syntax/contract CLI checks and focused tests locally; capture commands and exact exit statuses. Do not make broad refactors, touch unrelated facts/AI rows, or change immutable frozen test criteria.
4. Re-read `origin/main`, check file blob SHA and concurrent changes, commit only necessary code/tests directly to `main` under existing repo governance; record commit SHA and ensure readback. If permission/owner decision blocks commit, report exact reason rather than making a branch.
5. Use actual [AI publishing/validation workflow](https://github.com/EasonLiu0913/stock_data/actions/workflows/publish-daily-gainers-ai-analysis.yml) with exact date `20261104` **only if safe to run and the intended validation/publishing side effects are authorized**; otherwise provide the owner the precise manual dispatch step. Collect Run ID, Job ID, log, output evidence and source identity. If FAIL, fix only log-confirmed errors; do not report PASS because a run started or prior artifact exists.
6. **Only after every required formal gate passes**, check Unified + Market Summary freshness and source SHA. Then proceed to the existing **Render-only** workflow and real A/B checks, provided it cannot upload YouTube or relax release locks.

### Media target for subsequent *authorized* render-only work

The only accepted visual is the **multi-stock list-row Dashboard** in both opening and stock sections (no old four-quadrant/cross cards). Market opening narration follows index → market turnover → rising/falling → flat/limit-up → foreign/investment-trust/dealers as same-level main figures → institutional total → evidence-based market strength. Preserve V4 branding, male presenter, Edge TTS `zh-TW-YunJheNeural` +15%, original per-stock non-template explanations, actual 1080p MP4/SRT/QA/SHA proof. Embedded Traditional Chinese captions: white, centered, max two lines, dark-gray `#333333` outline ≤4 px; standalone SRT unaffected. Spoken percentage `百分之1.95`, screen `1.95%`. Follow current owner-approved render policy, time limits and frozen original gates; this list is an operational index, not a replacement contract.

## 5. Bidirectional transfer protocol — always leave a usable trail

### Local Codex → ChatGPT / scheduled Agents

At a meaningful phase boundary (investigation → fix → validation → render), update **this operational note's Section 6** with a concise dated checkpoint **only when materially changed**. For day-to-day mechanical progress use commit and CI evidence without spam edits. Preserve historical checkpoints; append an entry rather than rewriting their factual outcomes. Each checkpoint must include:

- UTC and Asia/Taipei time, worker, specific task/date, main HEAD before/after, local dirty state;
- changed paths + commit SHA and verified readback (or NO_COMMIT and why);
- source/Facts/News/AI candidate blob SHA and validator/contract SHA when the result depends on them;
- commands/tests exact PASS/FAIL, Workflow + Run/Job IDs, artifact URLs/hashes where available;
- true gate statuses `PASS|FAIL|RUNNING|UNKNOWN|BLOCKED` for S01/C02/C03/C04/DAILY_VALIDATOR/Render-only; never infer unverifiable statuses;
- conflict/retry/attempt ledger and lock ownership if relevant;
- `NEXT_SINGLE_ACTION`, owner action required yes/no, release/upload locks unchanged;
- whether canonical Goal-Anchored project handoff or frozen A/B was changed (**must not** without appropriate owner authorization).

After pushing the checkpoint to `main`, give the user a message: “請 ChatGPT 讀取 `docs/handoffs/taiwan-stock-codex-chatgpt-transfer.md` 和最新 GitHub main／Run ID，依 NEXT_SINGLE_ACTION 接手；不可從舊聊天推測 PASS。” ChatGPT must refetch current evidence, not blindly trust this note.

### ChatGPT / scheduled Agents → Local Codex

Update Section 6 with exactly the same evidence fields at a meaningful boundary using CAS and current `main`. Preserve the scheduled Agents' existing prompts/automation settings unless the owner requests changes. Give Codex the repo path and this file, ask it to fetch latest main, read canonical rules and confirm effective gate state before any write. If remote main changed, determine whether the note's target date and NEXT_SINGLE_ACTION are now obsolete.

### Race-safe handoff / STOP

Two agents must not write the same date/file concurrently. Check date lease/ledger/attempt limits at start and immediately before a commit. If ownership is ambiguous, stop competing writes, report current SHA and choose non-conflicting read-only validation. No agent may rely on its conversational memory as a lock. No new upload permission is transferred by this document.

## 6. Transfer checkpoints (append at meaningful boundaries)

### 2026-11-07 00:17 Asia/Taipei — loader/contract mismatch repaired locally; formal CI pending

- **Task:** bounded repair of the 20261104 central AI contract startup failure; active project remains `daily-gainers-market-opening-end-to-end`, goal `goal-v3/MVP-10DAY-v1`, phase `MVP10-A PROMOTED / NOT_STARTED`; this operational task does not execute or alter its frozen A/B.
- **Remote baseline:** fetched `origin/main` SHA `f9ba796eaabebe5e161a73e5cba5f6f840c470ef`; local branch `main`, clean before work. Recheck remote immediately before commit/push.
- **Root cause:** actual Run `42246225691`, Job `127989039610`, Node `24.22.2`, failed at `Validate central contract` before target-date resolution. The loader required `checked_at` and `sources` in `required_fields_when_verification_required`, while the JSON contract and per-stock validator classify them as optional audit metadata.
- **Local change:** only `scripts/lib/daily_gainers_ai_contract.js`; core required list now checks `status` and `summary`, while `checked_at` and `sources` remain declared optional audit fields and their supplied-value validation remains unchanged. Loader blob SHA-1 `224a8cf1c52f0b71291c441732f59a680e9ff1d7`. Candidate SHA-1 `24cf09ade6b98488b792aebc5036db9240c58a30`; Facts SHA-1 `75e0573aa2fb394712f40cb9b115096b3e136c07`; News SHA-1 `c31055e4c0f3e60899be5e8e4fe9358c923190a6`.
- **Local checks:** `node --check scripts/lib/daily_gainers_ai_contract.js` PASS; `node scripts/daily_gainers_ai_contract_cli.js print` PASS; `node scripts/check_daily_gainers_ai_contract_consistency.js` PASS; `node scripts/build_daily_gainers_market_summary.js --self-test` PASS; `node scripts/validate_daily_gainers_market_summary.js --self-test` PASS; `node scripts/validate_daily_gainers_ai_analysis.js 20261104` PASS (44 stocks, exact order verified); `git diff --check` PASS.
- **Commit / remote readback:** pending; no commit or push yet. **Formal workflow:** pending; Run/Job IDs and tested SHA must be recorded after completion. Expected safe checker: `.github/workflows/check-daily-gainers-ai-contract.yml` (contents read only). The production AI workflow also listens to loader changes, but this commit changes no pending AI candidate or its workflow; verify its run exits before date resolution/data publication and that Pages job is skipped.
- **Gate state:** S01 historical receipt PASS (reconfirm its source identity before reusing); local AI schema/order check PASS but formal C02 / C03 / C04 / DAILY_VALIDATOR remain UNKNOWN pending fresh evidence; Render-only NOT VERIFIED. FIFO/date locks unchanged; candidate/data untouched. YouTube upload prohibited; release/publication locks unchanged.
- **`NEXT_SINGLE_ACTION`:** re-fetch `origin/main`, commit/push only the loader repair and this checkpoint on `main`; inspect fresh Actions runs on that commit, require read-only contract consistency success and verify AI publication/Pages side effects were skipped. Record commit SHA, run/job IDs, tested SHA, artifact state and final gate statuses in the next checkpoint. Do not claim the video A/B or whole daily delivery passed.
- **Owner action:** not required for the authorized narrow repair and safe CI verification; ask before any workflow with data-promotion, Pages/deploy, production, A/B scope change, or YouTube side effects.
- **Plan changed:** no. Canonical handoff, frozen A/B, FIFO, date lock and upload lock unchanged.

### 2026-11-07 00:00 Asia/Taipei — ChatGPT → Local Codex

- **Task:** repair 20261104 AI contract startup failure without weakening any official or editorial gate.
- **Source baseline:** manually dispatched [Run 42246225691](https://github.com/EasonLiu0913/stock_data/actions/runs/42246225691), Job `127989039610`, failed on old head `c9b4ec7c38c9e6c6de76aaabf5b0510af5ee41ca`.
- **Additional remote activity observed:** subsequent `main` collector Commits, including `e29bfcc10fec13871b4ad4099de23f99fbe68146` updating TPEx data; do **not** use this as a fixed HEAD or infer AI fix. Re-fetch main before any action.
- **Files changed by this handoff:** this new transfer note only; **no validator repair performed here**.
- **Actual gates:** historical S01 receipt PASS (source refresh check required); AI 44/44 candidate exists; Run 42246225691 FAIL before C02/C03; C02/C03/DAILY_VALIDATOR for the current candidate **UNKNOWN**, Render-only **NOT VERIFIED**; YouTube upload prohibited.
- **NEXT_SINGLE_ACTION:** check whether loader/contract mismatch still exists on newest `main`; if yes minimally fix it, locally regress, then obtain a new correctly scoped formal validation run and evidence.
- **Owner action:** not required for local inspection/minimal scope fix; ask if required for dispatch permissions, unsafe deploy side effects, gate/scope changes, publishing or upload.
- **Plan changed:** no. Original canonical project and A/B remain authoritative.

## 7. Copy-paste entry prompts

**Local Codex entry:** “Read `AGENTS.md`, the canonical project handoff `docs/handoffs/daily-gainers-market-opening-end-to-end.md`, and `docs/handoffs/taiwan-stock-codex-chatgpt-transfer.md` from the newest `origin/main`. Preserve my local uncommitted changes. Resume `NEXT_SINGLE_ACTION`, corroborate the precise Run/Job/SHA, minimally patch and test only the proven fault, and append a checkpoint at the next meaningful boundary. Do not upload YouTube or relax original gates.”

**ChatGPT return entry:** “接手 TAIWAN STOCK：先查 GitHub 最新 `main`、`AGENTS.md`、正式 Handoff 與 `docs/handoffs/taiwan-stock-codex-chatgpt-transfer.md` 第6節最新 checkpoint；核對 Commit、Run/Job/Artifact、來源 SHA 與現行 lock，從 `NEXT_SINGLE_ACTION` 接續。不要將舊摘要當成 PASS，不要重做已驗證的研究，不得上傳 YouTube。”

**Note:** This document is a handoff pointer and evidence ledger; it is **not** an authorization for a previously unapproved `promptA`, `promptB`, deployment, private upload, or release.
