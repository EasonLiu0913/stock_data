# Institutional Withdrawal Research — Validation Phase Handoff

Canonical handoff: `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`

Last checkpoint: 2026-08-30

## Purpose

This document is the authoritative continuation point for Institutional Withdrawal Validation in `EasonLiu0913/stock_data`.

Research objective: infer from public market/chip data whether large long-term holders may be persistently reducing exposure, whether the market is still absorbing that supply, and when absorption fails or later repairs.

Working lifecycle:

`persistent ownership transfer → fragile distribution → candidate failure → short durability → recovery/reclaim`

This is **Validation Phase**, not a new in-sample threshold-tuning version.

---

# 0. Mandatory startup sequence for every new agent

Before doing any implementation or running any workflow:

1. Read repository root `AGENTS.md`.
2. Read `docs/project-philosophy.md`.
3. Read `docs/roadmap/current-phase.md`.
4. Read this canonical handoff.
5. Verify current `main` still matches the commits, workflows, files, and assumptions listed below.
6. Continue from **Next round** only after that verification.

This handoff is a ready-to-continue state, not a restriction on fresh investigation. Re-check implementation details and challenge prior conclusions when evidence warrants it.

At every meaningful phase boundary, update this file and commit it. A phase is not considered cleanly handed off until the canonical handoff reflects the durable repository state.

---

# 1. Frozen methodology and leakage guardrails

Treat v6.0 through v6.5 as **frozen development research**.

Do not change thresholds, weights, lifecycle definitions, validation gates, or feature semantics based on inspected validation outcomes.

Development stocks:

- `2330`
- `2317`
- `2454`
- `2382`
- `2303`
- `2449`

Development period:

`2026-04-01` through `2026-08-21`

Development stocks/dates may be used for regression tests and pipeline contract tests, but not as untouched validation evidence.

Validation leakage guardrails:

- Coverage/sample construction must be outcome-blind.
- Research calendar must come from valid TWSE foreign-investor source files, not `data_history_sma/trading_days.json`.
- Historical TDCC remains association-only because exact historical publication-time availability is not fully known.
- Do not inspect or generate future-return/outcome artifacts while coverage/sample freeze is incomplete.
- These files MUST NOT exist during the current phase:
  - `data_research/institutional-flow/validation/validation-outcomes-v1.json`
  - `data_research/institutional-flow/validation/validation-metrics-v1.json`
- The milestone is coverage/sample readiness, not finding favorable lifecycle outcomes.

Canonical preregistration:

`data_research/institutional-flow/validation-plan-v1.md`

---

# 2. Current phase

Current phase: **outcome-blind validation coverage expansion and evidence reliability hardening**.

Do not begin untouched outcome scoring yet.

Latest verified `stock_holdout_ready` set at this checkpoint:

- `1598`
- `1616`
- `1809`
- `7791`

Treat this list as a checkpoint, not a hard-coded sample. Re-run the outcome-blind planner after new source evidence lands.

---

# 3. Mandatory network / backfill execution architecture

For substantial network collection, do not use one long-running job containing many logical batches.

Required architecture:

`plan → freeze bounded queue → explicit batch_size → physical GitHub job/runner boundary → request jitter → batch cooldown → checkpoint → runner exits → next batch → re-plan`

Operational rules:

- `cancel-in-progress: false`
- `strategy.fail-fast: false` where matrix batches are independent
- `max-parallel: 1` for the current TDCC/Broker validation collection unless deliberately revalidated
- Fresh checkout of latest `main` at the start of each physical batch
- Broker physical batch: at most 5 requests per fresh runner under current evidence
- TDCC physical batch: one stock per fresh runner in the current Recovery workflow
- Preserve bounded randomized delays and cooldowns
- Every physical batch checkpoints durable evidence before exit
- Never substitute a `for` loop inside one long-lived runner for physical batching when source behavior is sensitive to session/request history

Checkpoint race rule:

- Never use blind `git pull --rebase` for append/checkpoint writers.
- Try direct push first.
- If the push loses a race: fetch `origin/main`, record the bounded local changed paths, reset to `origin/main`, and replay only the required local delta.
- For immutable exact-path artifacts, remote existing path wins.
- Re-run/re-plan from current durable state instead of manufacturing merge conflicts.

---

# 4. Active and retired workflow entry points

## Active coverage expansion

`.github/workflows/expand-institutional-withdrawal-validation-coverage-v1-recovery.yml`

This is the supported general coverage workflow at this checkpoint.

Its intended physical model is:

- planner freezes coverage-driven work;
- TDCC: one stock per fresh `ubuntu-latest` runner, `max-parallel: 1`;
- post-TDCC Broker re-plan;
- Broker: each batch is at most 5 exact-source-date requests on a fresh runner, `max-parallel: 1`;
- cooldown/jitter/checkpoint between physical batches;
- final outcome-blind coverage refresh.

Before modifying or dispatching it, verify its checkpoint implementation still follows the race-safe rule above. If any direct push path can lose ordinary repository races without bounded replay, harden that path before scaling collection.

## Retired legacy runner

`.github/workflows/expand-institutional-withdrawal-validation-coverage-v1.yml`

Commit `e1b4f429931c5e0bf5f7ac7166e2a5179a76011b` retired the old single-runner crawler.

It now exists only as a manual guard/information workflow and MUST NOT be restored as a network crawler.

## HiStock ambiguous source_empty repair

`.github/workflows/repair-histock-broker-source-empty-v1.yml`

This workflow is repair-only and uses the same coverage-writer concurrency group. It plans only audited ambiguous `source_empty` tasks and uses fresh physical Broker runners. Current durable audit has no ambiguous degraded-signature tasks left to repair.

## HiStock fresh-runner diagnostic

`.github/workflows/probe-histock-broker-fresh-runner-batches.yml`

Diagnostic only; do not treat it as production coverage collection.

---

# 5. HiStock false source_empty incident — resolved degraded-signature class

## Original false negative

Known-positive anchor:

`1598 / 2026-05-07`

Old long-running runner response:

- HTTP 200
- response bytes about `69876`
- date visible
- broker keywords visible
- `table_rows = 1`
- incorrectly recorded as `source_empty`

Manual/fresh-runner evidence proved the date has Broker data.

Fresh-runner diagnostic repeatedly returned:

- HTTP 200
- response bytes `90926`
- `table_rows = 16`
- Broker trace links present
- known rows visible

Known anchors:

- `凱基-汐止`: sell 74, net `-74`, avg `20.49`
- `兆豐-大同`: buy 206, net `+206`, avg `20.76`

This strongly supports a degraded-response/session/request-history problem in the old long-running environment. It does **not** prove the exact server mechanism (IP throttling, session state, WAF, etc.).

## Current source-status policy

Relevant implementation:

- `scripts/lib/histock_broker_status_policy.js`
- `scripts/backfill_histock_broker_exact_source_date.js`
- `scripts/audit_histock_broker_source_empty_checkpoints.js`
- `scripts/plan_institutional_withdrawal_validation_broker_batches_v1.js`

Policy:

- reduced/header-only HTML such as HTTP 200 + suspiciously shrunken response + no materialized Broker rows is **not** trusted `source_empty`;
- it is retryable `extraction_incomplete` / degraded-response evidence;
- only an explicit trusted source-side no-data marker may become confirmed terminal `source_empty`;
- valid daily payload wins over an old status checkpoint;
- legacy unsafe source-empty checkpoints are not allowed to remain terminal merely because the old runner called them empty.

Regression for `1598@2026-05-07` includes the `-74` and `+206` anchors.

## Durable 1598 result

Current checkpoint:

`data_research/institutional-flow/histock/1598/batch-status/exact-source-date-20260507.json`

is `success` with:

- response bytes `90926`
- `table_rows = 16`
- daily file `data_research/institutional-flow/histock/1598/daily/20260507.json`

The daily payload preserves source blanks as provenance/incomplete fields rather than inventing zeros. The known net values remain available in the raw/source-aware records.

---

# 6. Current source_empty audit checkpoint

Durable audit:

`data_research/institutional-flow/validation/histock-source-empty-audit-v1.json`

Current counts after repair audit refresh:

- exact statuses: `163`
- source_empty statuses currently present: `5`
- unsafe ambiguous degraded-signature source_empty: `0`
- confirmed terminal source_empty: `0`
- legacy terminal source_empty unverified: `5`
- unsafe requeue: empty

Important interpretation:

The degraded-signature false-negative class that motivated this round has been cleared from the repair queue.

The remaining 5 legacy checkpoints are **not confirmed no-data evidence**. They have a different signature (for example full-size page / 16 table rows with incomplete parsed records) and are retained only as `legacy_source_empty_unverified_but_not_degraded_signature` until specifically investigated.

Do not use those 5 as strong negative evidence in methodology or validation claims.

Do not automatically merge them into the old degraded-response repair class without evidence.

---

# 7. Important commits in this phase

Foundation / lifecycle / coverage:

- `417a6621262a99e18cf10f506cecab351cb2cd96` — lifecycle classifier foundation
- `ad97a05528a7cb46a4867e31eb43336231d54825` — preregistered validation plan
- `3a5fa0b207e7d78c306d5db09a87f9c5c1798979` — outcome-blind expansion planner
- `c9a3526c36ca189cb561649ba539b3a5af2bdf2e` — coverage runner/orchestrator foundation
- `81972d1011eeefc55cec50a56cf51edf8a4477b1` — concurrency-safe coverage checkpoint helper pattern

Broker source-status hardening:

- `2b7704cfc54951c9ee51a07f78dcd10205e8acdb` — initial Broker source-empty retry classification
- `75d89574eebefa51eac677338267173ec0bf850b` — Broker planner terminal-date handling
- `c4282a7d11fc7f95260ab2f5813978f835e2af04` — fresh-runner HiStock probe script
- `a2fa5d03274324104ce4d860fdee0066fbae539f` — fresh-runner diagnostic workflow
- `897c0faf...` — audit unsafe legacy HiStock source_empty checkpoints
- `7ec5bc84...` — requeue ambiguous HiStock source_empty dates / known-positive regression
- `c0c0da884cd503c9030f7ad8dd9049c446f62988` — isolate source-empty repair physical batches

Round-closing commits:

- `3b024da909b2b6bb58c6c7f3777c816768e65e2d` — remove unsafe repair `git pull --rebase`; add race-safe bounded replay semantics
- `37689f49055a55299c7c7de9c21155aaa1cef5d4` — complete repair workflow contract; fix audit summary parser; managed schedule summary
- `f937d4c6996f723e7a2bfdf32d181cffb8c08305` — durable outcome-blind source-empty repair audit refresh
- `e1b4f429931c5e0bf5f7ac7166e2a5179a76011b` — retire legacy single-runner validation coverage workflow

---

# 8. Verified workflow result for this closeout

HiStock repair workflow run:

`33297133249`

Result: **success**.

The planner found no remaining `unsafe_requeue`, so no unnecessary HiStock repair requests were issued. The workflow completed contract checks and refreshed the durable outcome-blind audit.

The first attempted repaired workflow run had failed before network collection because of a Node local-path `require()` mistake; that contract bug was fixed before the successful run. No research evidence was corrupted by that failed attempt.

---

# 9. Next round

The degraded HTTP-200/header-only HiStock false-negative incident is now closed as a repair class. Do **not** reopen it merely to collect more examples.

Next agent should proceed in this order:

1. Verify current `main` against this handoff and the successful repair/retirement commits.
2. Verify `validation-outcomes-v1.json` and `validation-metrics-v1.json` still do not exist.
3. Audit the active physical Recovery workflow's checkpoint paths end-to-end. Its physical runner separation is correct; harden any remaining plain `git push` path that can lose an ordinary concurrent `main` update without bounded fetch/reset/replay.
4. Investigate the **5 `legacy_source_empty_unverified_but_not_degraded_signature` checkpoints** as a separate evidence-quality question. Determine why a page with materialized rows/incomplete records became legacy `source_empty`. Keep the investigation outcome-blind.
5. Only after that evidence policy is clear, re-run the outcome-blind coverage planner and continue physical-batch coverage expansion.
6. Keep batches small and checkpoint each physical runner. Do not fall back to the retired workflow.
7. Continue until a meaningful coverage/sample-freeze milestone is reached; do not inspect validation outcomes early.
8. At the next meaningful phase boundary, update this canonical handoff and commit it before ending the conversation.

The next round is primarily **evidence reliability + physical checkpoint hardening + coverage expansion**, not threshold tuning and not outcome scoring.

---

# 10. Ready-to-paste prompt for a fresh conversation

Continue the Institutional Withdrawal Validation work in repository `EasonLiu0913/stock_data`.

Before doing any work:

1. Read repository-level instructions in `AGENTS.md`.
2. Read `docs/project-philosophy.md`.
3. Read `docs/roadmap/current-phase.md`.
4. Read the canonical handoff at `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`.
5. Verify current `main` still matches the commits, workflows, files, evidence counts, and assumptions referenced by the handoff.
6. Continue from the handoff's `Next round` section.

Preserve all frozen v6.0–v6.5 methodology, validation leakage guardrails, development-stock exclusions, TDCC historical caveats, outcome-blind coverage rules, and the repository's mandatory physical-batch architecture.

Do not create or inspect validation outcome/metric artifacts before the coverage/sample-freeze gate allows it.

For network collection, use planner-frozen bounded work with explicit batch sizes, fresh GitHub runner/job boundaries, randomized request jitter, batch cooldowns, checkpoint commits, race-safe fetch/reset/replay semantics, and re-planning. Do not restore the retired single-runner validation crawler and do not use `git pull --rebase` for checkpoint writers.

Immediate focus: audit/harden remaining checkpoint race paths in the active physical Recovery workflow; separately investigate the 5 `legacy_source_empty_unverified_but_not_degraded_signature` HiStock checkpoints without using outcomes; then continue outcome-blind physical-batch coverage expansion.

At the next meaningful phase boundary, update and commit the canonical handoff before ending the conversation.