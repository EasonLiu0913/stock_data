# Institutional Withdrawal Research — Validation Phase Handoff

Canonical handoff: `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`

Phase-closeout checkpoint: 2026-08-30

## Purpose

This is the authoritative continuation point for Institutional Withdrawal Validation in `EasonLiu0913/stock_data`.

Current phase: **outcome-blind validation coverage expansion + evidence reliability hardening**.

The milestone remains coverage/sample readiness. **Do not begin untouched validation outcome scoring yet.**

---

# 0. Mandatory startup sequence

Before any implementation, workflow dispatch, or data collection:

1. Read repository root `AGENTS.md`.
2. Read `docs/project-philosophy.md`.
3. Read `docs/roadmap/current-phase.md`.
4. Read this canonical handoff.
5. Verify current `main` still matches the commits, workflows, files, evidence counts, and assumptions below.
6. Continue from **Next round** only after that verification.

At every meaningful phase boundary, update and commit this file again.

---

# 1. Frozen methodology / leakage guardrails

Treat v6.0 through v6.5 as frozen development research.

Development stocks remain:

`2330,2317,2454,2382,2303,2449`

Development period remains:

`2026-04-01` through `2026-08-21`.

Do not retune thresholds, weights, lifecycle definitions, validation gates, or feature semantics from validation examples.

Mandatory guardrails:

- coverage/sample construction is outcome-blind;
- use valid TWSE foreign-investor source files for the research calendar, never `data_history_sma/trading_days.json`;
- historical TDCC remains association-only because exact historical publication-time availability is not fully known;
- do not inspect/generate future returns, validation outcomes, drawdowns, or validation metrics before sample/coverage freeze;
- these files MUST NOT exist in the current phase:
  - `data_research/institutional-flow/validation/validation-outcomes-v1.json`
  - `data_research/institutional-flow/validation/validation-metrics-v1.json`

Both forbidden files were explicitly verified absent during the 2026-08-30 phase closeout.

Canonical preregistration:

`data_research/institutional-flow/validation-plan-v1.md`

---

# 2. Completed Recovery wave

Completed physical Recovery run:

`33298604998`

Result: **success**.

The run produced the expected linear set of **25 Recovery checkpoint commits** between the wave request checkpoint and final Recovery coverage refresh:

- 1 frozen expansion-plan checkpoint;
- 6 TDCC physical-batch checkpoints;
- 1 post-TDCC Broker-plan checkpoint;
- 16 Broker physical-batch checkpoints (`0` through `15`);
- 1 final coverage refresh checkpoint.

No Recovery checkpoint writer used `git pull --rebase`.

Final Recovery commit:

`138bf957e0d52c88bb27149767a7d8898fcf5872` — `research: refresh physical-batch validation coverage state`

Late Broker checkpoints include:

- `c99df16c06c438b3fa34159087e9457806684dbb` — Broker batch 14
- `ecea6bd9f4a874c8c37f01639fcb92d2a82c6d3e` — Broker batch 15

Representative middle checkpoints include:

- `104f80dfc345972b036f382627014c3ad252a03e` — Broker batch 6
- `e01577b5944ee7d129dd758b47759fee385a11dc` — Broker batch 5
- `7371b8d18416ced90177989911a312154c22c697` — Broker batch 4
- `179f59eb7da9df7d309204ef8045fcdce22dd744` — Broker batch 3

The complete compare from the Recovery wave request to `138bf957...` was verified to be exactly 25 commits, matching the 25 expected checkpoint writers above; there was no missing physical-batch checkpoint in that chain.

## TDCC execution verified

Planned TDCC stocks:

`8163,8213,6526,1340,1710,1590`

All six completed successfully in separate GitHub-hosted jobs. Each physical job handled exactly one stock.

Architecture verified:

- `strategy.fail-fast: false`
- `max-parallel: 1`
- fresh checkout of current `main` for each job
- batch 1+ uses randomized physical-batch cooldown
- TDCC collector retains request delay + jitter
- each job checkpoints durable stock evidence before runner exit.

## Broker execution verified

The run created 16 separate Broker matrix jobs, batches `0..15`, all successful.

Architecture verified:

- true fresh-runner physical jobs;
- `strategy.fail-fast: false`;
- `max-parallel: 1`;
- each physical batch contained at most 5 exact-source-date requests;
- batch 1+ randomized cooldown: `45..90s`;
- collector request jitter preserved (`--delay-ms 1800 --jitter-ms 1200`);
- short randomized inter-request sleep preserved;
- each physical batch checkpointed durable evidence before runner exit.

Early, middle, and late Broker jobs were inspected directly. No sampled response showed the historical degraded signature (`HTTP 200` + materially shrunken body + `table_rows=1`). Normal pages were approximately 88–96 KB with `table_rows=16`.

No unexpected terminal `source_empty`, header-only Broker page, or regression to the old false-negative behavior was found.

---

# 3. Checkpoint race architecture

Shared helper:

`scripts/checkpoint_bounded_research_paths.sh`

Required behavior is implemented and active:

1. stage only bounded paths;
2. commit local bounded checkpoint;
3. direct push first;
4. if `origin/main` moved, fetch it;
5. record/replay only the bounded local delta after hard reset;
6. immutable exact-path artifact already on remote = remote wins;
7. retry bounded checkpoint;
8. never use `git pull --rebase`.

The active Recovery workflow uses this helper for:

- initial expansion plan;
- each TDCC physical batch;
- post-TDCC Broker plan;
- each Broker physical batch;
- final coverage refresh.

Recovery run `33298604998` formed a complete linear 25-checkpoint chain. No durable batch evidence was found missing after the run.

---

# 4. Final outcome-blind closeout state

A dedicated no-collection closeout preflight was run after Recovery:

`33301186925`

Result: **success**.

It reran:

- HiStock status-policy regressions;
- HiStock source-status audit;
- coverage expansion planner;
- Broker batch planner;
- validation coverage planner;
- forbidden-file checks.

Durable closeout refresh commit:

`f92b362ac57e1e6248d1ecd35b9c729690266b29` — `research: refresh outcome-blind validation coverage preflight`

Final source-status audit counts:

- exact statuses: `241`
- `unsafe_ambiguous_source_empty`: `0`
- confirmed terminal source_empty: `0`
- `confirmed_source_rows_incomplete`: `23`
- `legacy_terminal_source_empty_unverified`: `0`

Final coverage expansion counts:

- source-derived sessions: `98`
- TDCC queue remaining: `1018`
- Broker queue remaining: `39`
- ready stocks: `5`

Final `stock_holdout_ready`:

- `1598`
- `1616`
- `1809`
- `6257`
- `7791`

Newly ready from Recovery run `33298604998`:

- `6257`

Final `stock_holdout_needs_broker_normalization`:

- none (`[]`)

`time_holdout_ready` remains empty.

---

# 5. HiStock source-status semantics

Status policy version:

`histock-broker-source-status-policy-v2`

## Known degraded false-negative anchor remains protected

`1598 / 2026-05-07`

The old bad runner produced approximately 69.9 KB / `table_rows=1` and incorrectly called the page `source_empty`.

The protected known-positive regression continues to parse the expected source anchors:

- 凱基-汐止: net `-74`, avg `20.49`
- 兆豐-大同: net `+206`, avg `20.76`

The successful durable 1598 daily/status evidence remains protected. The regression suite passed during closeout.

## Five protected 7791 legacy dates

These five dates remain classified exactly as `source_rows_incomplete`:

- `7791@2026-04-07`
- `7791@2026-04-28`
- `7791@2026-04-30`
- `7791@2026-05-13`
- `7791@2026-05-22`

For all five:

- `negative_evidence: false`
- `coverage_usable: false`
- terminal only for that exact acquisition date under frozen strict completeness semantics
- planner action is to skip the unusable exact date and continue alternate dates
- source blanks are preserved as `null` / raw empty values, never imputed to zero.

Their former legacy `source_empty` checkpoints remain archived for provenance.

## New understanding from Recovery: 6754

Recovery produced **18 additional confirmed `source_rows_incomplete` dates for `6754`**.

These were not degraded-page failures. They had:

- HTTP 200;
- date and Broker context visible;
- `table_rows=16`;
- normal stock-specific full response sizes around 88–92 KB;
- source-side blank/incomplete buy/sell/net cells under frozen strict completeness semantics.

Therefore the final audit total is `23` = protected 5 for 7791 + 18 new 6754 dates.

This strengthens the distinction between:

- `source_empty`: trustworthy explicit source-side no-data;
- `suspected_degraded_response`: suspicious non-materialized/header-only response and retryable;
- `source_rows_incomplete`: source rows materialized, but no coverage-usable complete Broker record under frozen semantics; exact date is terminal for acquisition, non-negative, and planner continues alternate dates.

Do not convert blank Broker cells to zero to make 6754 pass.

At closeout the Broker planner reports for `6754`:

- existing valid days: `22`
- `source_rows_incomplete` dates: `18`
- target: `40`
- still-needed valid days: `18`
- remaining retryable candidate dates: `57`
- not exhausted before target.

So 6754 can continue through alternate exact dates without changing feature semantics.

---

# 6. Supported workflow entry points

## General physical Recovery coverage workflow

`.github/workflows/expand-institutional-withdrawal-validation-coverage-v1-recovery.yml`

Push-trigger entry is deliberately marker-gated:

`data_research/institutional-flow/validation/coverage-expansion-recovery-request-v1.json`

Do not trigger it merely by editing collector/planner scripts.

Current requirements remain:

- `cancel-in-progress: false`
- TDCC one stock / fresh runner
- Broker <=5 requests / fresh runner
- `max-parallel: 1`
- randomized jitter/cooldown
- durable bounded checkpoint before runner exit
- re-plan after TDCC before Broker
- final outcome-blind coverage refresh.

## Outcome-blind Recovery contract / closeout preflight

`.github/workflows/validate-institutional-withdrawal-recovery-contract-v1.yml`

Marker:

`data_research/institutional-flow/validation/coverage-recovery-preflight-request-v1.json`

This is a no-research-collection validator. It may refresh durable audit/planner JSON but does not perform TDCC/HiStock collection.

The closeout invariant now protects the original 5 `7791` dates while allowing additional legitimately confirmed `source_rows_incomplete` dates.

## HiStock source-empty repair

`.github/workflows/repair-histock-broker-source-empty-v1.yml`

Repair-only. Do not dispatch unless the audit produces new retryable ambiguous degraded cases.

## HiStock diagnostic

`.github/workflows/probe-histock-broker-fresh-runner-batches.yml`

Manual-only. Do not repeat the 30-request diagnostic without new evidence requiring it.

## Retired legacy coverage workflow

`.github/workflows/expand-institutional-withdrawal-validation-coverage-v1.yml`

Informational/manual-only. Never restore it as a long-running network crawler.

---

# 7. Known caveats

- Historical TDCC is still association-only, not exact-time no-lookahead evidence.
- HiStock response-byte baselines are stock/page dependent. Do not classify a page as degraded merely because it is smaller than another stock's page; combine stock-specific baseline/context/table materialization evidence.
- `source_rows_incomplete` means unusable exact-date Broker coverage, not no Broker activity.
- `6754` currently has substantial incomplete-source density but still has enough alternate candidate dates to pursue target coverage without changing frozen semantics.
- The current ready set is only an outcome-blind coverage checkpoint. It is not a performance result.
- No untouched validation outcome scoring is authorized yet.

---

# 8. Next round

**Do not start this round automatically.** Begin only after the user explicitly asks to continue.

Objective: **continue outcome-blind coverage expansion and assess coverage/sample-freeze readiness without opening outcomes**.

Proceed in this order:

1. Re-read `AGENTS.md`, project philosophy, current-phase roadmap, and this handoff; verify current `main` and forbidden-file absence.
2. Run/inspect the outcome-blind planners first. Do not hard-code the current ready or queue sets.
3. Confirm the source-status audit remains free of retryable ambiguous source-empty evidence.
4. Pay special attention to `6754`: preserve its existing 18 `source_rows_incomplete` dates as non-negative unusable exact-date evidence and let the Broker planner choose alternate dates; do not impute blanks or relax frozen Broker completeness semantics.
5. If substantial collection is warranted, run only one bounded Recovery wave using the marker-gated physical workflow. Preserve TDCC one stock/fresh runner, Broker <=5 requests/fresh runner, `max-parallel:1`, jitter, cooldown, checkpoint, and re-plan architecture.
6. After that wave, rerun the outcome-blind source-status audit, Broker planner, expansion planner, and validation coverage planner.
7. Evaluate **coverage/sample readiness only** against the preregistered validation plan. Do not inspect lifecycle outcomes, future returns, drawdowns, or validation metrics.
8. Do not create `validation-outcomes-v1.json` or `validation-metrics-v1.json` until the preregistered sample/coverage freeze is explicitly reached and documented.
9. At the next meaningful phase boundary, update and commit this canonical handoff again.

Likely next planner checkpoint at this closeout, for reference only and **not a hard-coded queue**:

- TDCC planner currently surfaced: `6235,1907,1457,2207,0050,2645`
- Broker planner currently surfaced: `6754,5306`
- Broker plan would require 58 exact-date requests across 12 physical batches at <=5 requests/batch.

Always re-plan from durable current state before dispatching; do not dispatch based solely on this handoff snapshot.

---

# 9. Ready-to-copy prompt for the next agent

Continue the Institutional Withdrawal Validation work in repository `EasonLiu0913/stock_data`.

Before doing any implementation, workflow dispatch, or data collection:

1. Read repository-level instructions in `AGENTS.md`.
2. Read `docs/project-philosophy.md`.
3. Read `docs/roadmap/current-phase.md`.
4. Read the canonical handoff at `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`.
5. Verify current `main` still matches the handoff's workflows, durable evidence, audit counts, coverage counts, commits, and assumptions.
6. Verify these forbidden files still do not exist:
   - `data_research/institutional-flow/validation/validation-outcomes-v1.json`
   - `data_research/institutional-flow/validation/validation-metrics-v1.json`
7. Continue strictly from the handoff's **Next round** section.

Preserve all frozen v6.0–v6.5 methodology, thresholds, weights, lifecycle definitions, validation gates, feature semantics, development-stock exclusions, TDCC historical caveats, source-derived calendar rules, and outcome-blind coverage/sample-construction guardrails.

Do not inspect or generate validation outcomes, future returns, drawdowns, lifecycle performance, or validation metrics while coverage/sample freeze is incomplete. Do not use `data_history_sma/trading_days.json` as the research calendar.

For any substantial network collection, preserve the repository's physical architecture:

`plan → freeze bounded queue → explicit batch_size → fresh GitHub job/runner → randomized request jitter → cooldown → checkpoint → runner exits → next batch → re-plan`

Requirements remain:

- `cancel-in-progress: false`
- independent matrix `strategy.fail-fast: false`
- current validation `max-parallel: 1`
- TDCC one stock per fresh runner
- HiStock Broker at most 5 exact-source-date requests per fresh runner
- fresh checkout of latest `main` per physical batch
- durable bounded checkpoint before runner exit
- no long-running logical for-loop batches replacing physical jobs
- never use blind `git pull --rebase origin main`; use bounded direct-push → fetch/reset → local-delta replay with immutable remote-wins semantics.

Current focus is outcome-blind coverage expansion and sample-readiness assessment. Preserve all protected `source_rows_incomplete` evidence as non-negative/unusable exact-date states; especially do not retry or zero-impute the five protected `7791` dates, and do not relax semantics to force `6754` incomplete dates to pass. Re-run planners from durable state before deciding what to collect.

Do not begin untouched outcome scoring until the preregistered coverage/sample-freeze gate is explicitly met and documented.

At the next meaningful phase boundary, update and commit `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md` again so the next agent receives a durable continuation point.
