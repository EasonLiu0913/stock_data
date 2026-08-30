# Institutional Withdrawal Research — Validation Phase Handoff

Canonical handoff: `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`

Final closeout checkpoint: 2026-08-30

## Purpose

This is the authoritative continuation point for Institutional Withdrawal Validation in `EasonLiu0913/stock_data`.

Research objective: infer from public market/chip data whether large long-term holders may be persistently reducing exposure, whether the market is still absorbing that supply, and when absorption fails or later repairs.

Working lifecycle:

`persistent ownership transfer → fragile distribution → candidate failure → short durability → recovery/reclaim`

This remains **Validation Phase**, not another in-sample threshold-tuning version.

---

# 0. Mandatory startup sequence for every new agent

Before any implementation, workflow dispatch, or data collection:

1. Read repository root `AGENTS.md`.
2. Read `docs/project-philosophy.md`.
3. Read `docs/roadmap/current-phase.md`.
4. Read this canonical handoff.
5. Verify current `main` still matches the commits, workflows, files, evidence counts, and assumptions below.
6. Continue from **Next round** only after that verification.

This handoff is a fast ready-to-continue state, not a restriction on fresh investigation.

At every meaningful phase boundary, update and commit this file. A phase is not cleanly handed off until the canonical handoff reflects durable `main`.

---

# 1. Frozen methodology / leakage guardrails

Treat v6.0 through v6.5 as **frozen development research**.

Never change thresholds, weights, lifecycle definitions, validation gates, or feature semantics based on inspected validation examples/outcomes.

Development stocks:

- `2330`
- `2317`
- `2454`
- `2382`
- `2303`
- `2449`

Development period: `2026-04-01` through `2026-08-21`.

Development examples may be used for regression and pipeline contract tests, not untouched validation claims.

Mandatory guardrails:

- coverage/sample construction is outcome-blind;
- research calendar comes from valid TWSE foreign-investor source files, never `data_history_sma/trading_days.json`;
- historical TDCC remains association-only because exact historical publication-time availability is not fully known;
- do not inspect/generate future-return or outcome artifacts before coverage/sample freeze;
- these files MUST NOT exist in the current phase:
  - `data_research/institutional-flow/validation/validation-outcomes-v1.json`
  - `data_research/institutional-flow/validation/validation-metrics-v1.json`
- milestone = coverage/sample readiness, not favorable lifecycle results.

Canonical preregistration:

`data_research/institutional-flow/validation-plan-v1.md`

At this closeout both forbidden outcome/metric files were explicitly checked and were absent.

---

# 2. Current phase and coverage checkpoint

Current phase: **outcome-blind validation coverage expansion + evidence reliability hardening**.

Do not begin untouched outcome scoring yet.

Latest verified `stock_holdout_ready` checkpoint:

- `1598`
- `1616`
- `1809`
- `7791`

This list is a checkpoint only. Re-run the outcome-blind planner after new evidence lands.

---

# 3. Mandatory physical-batch architecture

For substantial network collection use:

`plan → freeze bounded queue → explicit batch_size → fresh GitHub job/runner → request jitter → batch cooldown → checkpoint → runner exits → next batch → re-plan`

Rules:

- `cancel-in-progress: false`
- use `strategy.fail-fast: false` for independent matrix batches
- current validation collection uses `max-parallel: 1`
- fresh checkout of latest `main` for every physical batch
- Broker: at most 5 exact-source-date requests per fresh runner under current evidence
- TDCC: one stock per fresh runner in the active Recovery workflow
- preserve randomized request delays and inter-batch cooldowns
- checkpoint durable evidence before each runner exits
- never replace physical batching with a `for` loop inside one long-lived runner for HiStock/other session-sensitive sources

Checkpoint race rule:

- **Never use blind `git pull --rebase` for coverage/checkpoint writers.**
- Direct push first.
- If push loses a race: fetch `origin/main`, record bounded local changed paths, reset to `origin/main`, replay only the required delta, then retry.
- Immutable exact-path artifact already present on remote = remote wins.
- Prefer re-plan/resume from durable state over merge-conflict repair.

---

# 4. Workflow entry points at closeout

## Supported general coverage workflow

`.github/workflows/expand-institutional-withdrawal-validation-coverage-v1-recovery.yml`

Current architecture is physical:

- outcome-blind planner freezes work;
- TDCC = one stock / one fresh runner, `max-parallel: 1`;
- post-TDCC Broker re-plan;
- Broker = each batch <=5 requests / fresh runner, `max-parallel: 1`;
- cooldown/jitter/checkpoint;
- final outcome-blind coverage refresh.

**Next agent must audit its checkpoint paths before scaling another wave.** Physical separation is correct, but any remaining plain `git push` path that can lose an unrelated concurrent `main` update should be hardened to bounded fetch/reset/replay semantics first.

## Retired legacy coverage runner

`.github/workflows/expand-institutional-withdrawal-validation-coverage-v1.yml`

Retired by commit `e1b4f429931c5e0bf5f7ac7166e2a5179a76011b`.

It is now an informational/manual guard and performs no network collection. Never restore the old single-runner TDCC/Broker loops.

## HiStock ambiguous source_empty repair

`.github/workflows/repair-histock-broker-source-empty-v1.yml`

Repair-only physical-batch workflow, serialized with coverage writers. Successful closeout run: `33297133249`.

Current audit has no degraded-signature unsafe tasks left, so it should not issue repair traffic unless a future audit finds new ambiguous cases.

## HiStock fresh-runner diagnostic

`.github/workflows/probe-histock-broker-fresh-runner-batches.yml`

Diagnostic only. Now **manual-only** by commit `6279c6e35f50dd5db6c6f754f50e9232ebef6718` so script/CI maintenance cannot accidentally send 30 repeated requests.

## Frozen validation bootstrap preflight

`.github/workflows/validate-institutional-withdrawal-regression-light.yml`

Now **retired/manual-only** by commit `cec6f5b56705bfe8c67870d733b281636532cbf6` because its old bootstrap assumption (`non-development TDCC == 0`) is no longer true after successful coverage expansion.

Use `.github/workflows/validate-institutional-withdrawal-lifecycle-v1.yml` for frozen lifecycle regression/outcome-blind coverage checks.

---

# 5. HiStock false source_empty incident — closed degraded-signature class

Known-positive anchor: `1598 / 2026-05-07`.

Old long-running runner had returned:

- HTTP 200
- response bytes about `69876`
- date visible
- Broker keywords visible
- `table_rows = 1`
- false terminal `source_empty`

Fresh-runner diagnostic repeatedly returned:

- HTTP 200
- `response_bytes = 90926`
- `table_rows = 16`
- Broker trace links present
- expected Broker rows visible

Known anchors:

- `凱基-汐止`: sell 74, net `-74`, avg `20.49`
- `兆豐-大同`: buy 206, net `+206`, avg `20.76`

This strongly supports degraded-response/session/request-history behavior in the old long-running environment, but does not prove the exact server mechanism.

Current checkpoint:

`data_research/institutional-flow/histock/1598/batch-status/exact-source-date-20260507.json`

is `success` with 90,926 bytes / 16 table rows and points to:

`data_research/institutional-flow/histock/1598/daily/20260507.json`

The daily payload preserves source blanks as provenance/incomplete fields rather than inventing zeros; the net `-74` / `+206` anchors remain available.

---

# 6. Current source_empty policy and audit

Relevant code:

- `scripts/lib/histock_broker_status_policy.js`
- `scripts/audit_histock_broker_source_empty_checkpoints.js`
- `scripts/backfill_histock_broker_exact_source_date.js`
- `scripts/plan_institutional_withdrawal_validation_broker_batches_v1.js`

Policy:

- reduced/header-only response is not trusted `source_empty`;
- suspicious HTTP-200 degraded response stays retryable `extraction_incomplete`;
- only trusted explicit source-side no-data evidence may become confirmed terminal `source_empty`;
- valid daily payload wins over an old status checkpoint;
- old unsafe source-empty checkpoints are not allowed to remain terminal merely because the long-running runner called them empty.

Durable audit:

`data_research/institutional-flow/validation/histock-source-empty-audit-v1.json`

Closeout counts:

- exact statuses: `163`
- current source_empty statuses: `5`
- unsafe ambiguous degraded-signature source_empty: `0`
- confirmed terminal source_empty: `0`
- legacy terminal source_empty unverified: `5`
- unsafe requeue: empty

Interpretation:

The degraded HTTP-200/header-only false-negative class that motivated this round is cleared.

The remaining 5 are classified `legacy_source_empty_unverified_but_not_degraded_signature`. They are **not confirmed no-data evidence** and must not be used as strong negative evidence. They have a different signature (for example full-sized response / 16 table rows with incomplete parsed records) and require a separate outcome-blind evidence-quality investigation.

Do not automatically merge those 5 into the old degraded-response class without evidence.

---

# 7. Important commits

Foundation / validation:

- `417a6621262a99e18cf10f506cecab351cb2cd96` — unified lifecycle classifier foundation
- `ad97a05528a7cb46a4867e31eb43336231d54825` — preregistered validation plan
- `3a5fa0b207e7d78c306d5db09a87f9c5c1798979` — outcome-blind expansion planner
- `c9a3526c36ca189cb561649ba539b3a5af2bdf2e` — coverage runner/orchestrator foundation
- `81972d1011eeefc55cec50a56cf51edf8a4477b1` — concurrency-safe checkpoint replay pattern

HiStock evidence hardening:

- `2b7704cfc54951c9ee51a07f78dcd10205e8acdb` — source-empty retry classification foundation
- `75d89574eebefa51eac677338267173ec0bf850b` — Broker date planner terminal handling
- `c4282a7d11fc7f95260ab2f5813978f835e2af04` — fresh-runner diagnostic probe
- `a2fa5d03274324104ce4d860fdee0066fbae539f` — physical diagnostic workflow
- `c0c0da884cd503c9030f7ad8dd9049c446f62988` — isolate source-empty repair physical batches

Round closeout:

- `3b024da909b2b6bb58c6c7f3777c816768e65e2d` — repair checkpoint race safety; remove repair `git pull --rebase`
- `37689f49055a55299c7c7de9c21155aaa1cef5d4` — complete repair workflow contract
- `f937d4c6996f723e7a2bfdf32d181cffb8c08305` — durable outcome-blind source-empty audit refresh
- `e1b4f429931c5e0bf5f7ac7166e2a5179a76011b` — retire old single-runner coverage workflow
- `bcbf9e919c4e9e0b13168282e3aceb634bf28740` — first closeout handoff checkpoint
- `310782d0af44e5bb3920ccf8b8cf8a6f35609c8d` / `8721d3591a58603f0bc932bc3cbececebf40ca31` and related commits — normalize institutional research schedule summaries
- `cec6f5b56705bfe8c67870d733b281636532cbf6` — retire stale bootstrap preflight assumptions
- `6279c6e35f50dd5db6c6f754f50e9232ebef6718` — make completed HiStock diagnostic manual-only

Repo-wide `Ensure Workflow Schedule Summary` run `33297406589` completed **success** after normalization.

---

# 8. Next round

Do not reopen the resolved degraded-signature HiStock repair merely to collect more examples.

Proceed in this order:

1. Verify current `main` against this handoff.
2. Verify the two forbidden validation outcome/metric files still do not exist.
3. Audit the active physical Recovery workflow checkpoint/push paths end-to-end and convert any remaining race-prone plain push to bounded direct-push → fetch/reset → local-delta replay semantics. Preserve physical runner boundaries.
4. Separately investigate the 5 `legacy_source_empty_unverified_but_not_degraded_signature` checkpoints, outcome-blind. Determine why materialized/full-size rows became legacy source_empty and define evidence-safe treatment before trusting/excluding those dates.
5. Re-run source-empty audit and outcome-blind coverage planner after that policy is resolved.
6. Continue coverage expansion only through the active physical-batch workflow: TDCC one stock/fresh runner and Broker <=5 requests/fresh runner, `max-parallel: 1`, jitter/cooldown/checkpoint/re-plan.
7. Do not inspect validation outcomes until the preregistered coverage/sample-freeze gate permits it.
8. At the next meaningful phase boundary, update and commit this canonical handoff before ending the conversation.

Primary focus next: **checkpoint hardening + the 5 legacy source_empty evidence cases + outcome-blind coverage expansion**.

---

# 9. Ready-to-paste fresh conversation prompt

Continue the Institutional Withdrawal Validation work in repository `EasonLiu0913/stock_data`.

Before doing any work:

1. Read `AGENTS.md`.
2. Read `docs/project-philosophy.md`.
3. Read `docs/roadmap/current-phase.md`.
4. Read the canonical handoff: `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`.
5. Verify current `main` still matches the commits, workflows, files, evidence counts, and assumptions referenced by the handoff.
6. Continue from the handoff's `Next round` section.

Preserve all frozen v6.0–v6.5 methodology, validation leakage guardrails, development-stock exclusions, TDCC historical caveats, outcome-blind coverage rules, and the repository's mandatory physical-batch architecture.

Do not create or inspect validation outcome/metric artifacts before the coverage/sample-freeze gate allows it.

For network collection use planner-frozen bounded work with explicit batch sizes, fresh GitHub runner/job boundaries, randomized request jitter, batch cooldowns, checkpoint commits, race-safe direct-push/fetch-reset-replay semantics, and re-planning. Never restore the retired single-runner coverage crawler and never use `git pull --rebase` for validation checkpoint writers.

Immediate focus: audit/harden the active physical Recovery workflow's remaining checkpoint race paths; separately investigate the 5 `legacy_source_empty_unverified_but_not_degraded_signature` HiStock checkpoints without outcomes; then continue outcome-blind physical-batch coverage expansion.

At the next meaningful phase boundary, update and commit the canonical handoff before ending the conversation.