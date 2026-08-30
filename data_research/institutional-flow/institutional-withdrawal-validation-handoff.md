# Institutional Withdrawal Research — Validation Phase Handoff

Canonical handoff: `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`

Paired-prompt checkpoint: 2026-08-30

## Purpose

This is the authoritative continuation point for Institutional Withdrawal Validation in `EasonLiu0913/stock_data`.

Current phase: **outcome-blind validation coverage expansion + evidence reliability hardening**.

The milestone remains coverage/sample readiness. **Do not begin untouched validation outcome scoring yet.**

This handoff has been revalidated against the current repository-level mandatory **Paired implementation + closeout prompts** rule. Every next round must carry both Prompt A and a phase-specific Prompt B before implementation begins.

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

# Handoff execution loop

The required lifecycle is:

```text
Handoff N
│
├─ Prompt A
│   Next-round Implementation Prompt
│
└─ Prompt B
    Next-round Closeout / Verification Prompt
        ↓
Agent executes Prompt A
        ↓
work / workflow completes
        ↓
user sends Prompt B
        ↓
agent performs phase-closeout review
        ↓
problems found?
├─ yes
│   ↓
│   fix / bounded rerun
│   ↓
│   repeat Prompt B verification
│
└─ no
    ↓
update canonical handoff
    ↓
commit handoff
    ↓
verify current main has not made handoff stale
    ↓
produce Prompt A(N+1) + Prompt B(N+1)
    ↓
stop
```

Prompt B must be prepared before Prompt A runs and must be specific to the planned work. If the preregistered coverage/sample-freeze gate is reached, Prompt B must verify and commit the frozen sample state and stop before untouched outcomes are opened.

---

# 1. Frozen methodology / leakage guardrails

Treat v6.0 through v6.5 as frozen development research.

Development stocks:

`2330,2317,2454,2382,2303,2449`

Development period:

`2026-04-01` through `2026-08-21`.

Do not retune thresholds, weights, lifecycle definitions, validation gates, or feature semantics from validation examples.

Mandatory guardrails:

- coverage/sample construction remains outcome-blind;
- use valid TWSE foreign-investor source files for the research calendar, never `data_history_sma/trading_days.json`;
- historical TDCC remains association-only because exact historical publication-time availability is not fully known;
- do not inspect/generate future returns, validation outcomes, drawdowns, or validation metrics before sample/coverage freeze;
- these files MUST NOT exist in the current phase:
  - `data_research/institutional-flow/validation/validation-outcomes-v1.json`
  - `data_research/institutional-flow/validation/validation-metrics-v1.json`

Canonical preregistration:

`data_research/institutional-flow/validation-plan-v1.md`

Both forbidden files were explicitly verified absent at the prior closeout.

---

# 2. Completed Recovery wave and closeout evidence

Completed physical Recovery run:

`33298604998`

Result: **success**.

The run produced the expected linear set of **25 Recovery checkpoint commits**:

- 1 frozen expansion-plan checkpoint;
- 6 TDCC physical-batch checkpoints;
- 1 post-TDCC Broker-plan checkpoint;
- 16 Broker physical-batch checkpoints (`0..15`);
- 1 final coverage refresh checkpoint.

Final Recovery commit:

`138bf957e0d52c88bb27149767a7d8898fcf5872` — `research: refresh physical-batch validation coverage state`

Verified Recovery architecture:

- TDCC stocks `8163,8213,6526,1340,1710,1590` all completed on separate fresh runners;
- TDCC used exactly one stock per fresh runner;
- Broker used 16 separate fresh-runner jobs;
- every Broker physical batch had at most 5 exact-source-date requests;
- `strategy.fail-fast: false` and `max-parallel: 1` were preserved;
- fresh checkout, request jitter, inter-request sleeps, and physical-batch cooldowns were preserved;
- every physical batch checkpointed durable evidence before runner exit;
- `scripts/checkpoint_bounded_research_paths.sh` was used for bounded checkpoint writes;
- no `git pull --rebase` path was present;
- no durable checkpoint was found missing after concurrent `main` updates.

Early, middle, and late Broker jobs were inspected. No sampled response showed the historical degraded signature `HTTP 200 + materially shrunken body + table_rows=1`; normal materialized pages were roughly 88–96 KB with `table_rows=16`.

Dedicated no-collection closeout preflight:

`33301186925`

Result: **success**.

Durable closeout refresh commit:

`f92b362ac57e1e6248d1ecd35b9c729690266b29` — `research: refresh outcome-blind validation coverage preflight`

Final outcome-blind counts at that closeout:

- exact statuses: `241`
- `unsafe_ambiguous_source_empty`: `0`
- confirmed terminal source_empty: `0`
- `confirmed_source_rows_incomplete`: `23`
- `legacy_terminal_source_empty_unverified`: `0`
- TDCC queue remaining: `1018`
- Broker queue remaining: `39`
- `stock_holdout_ready`: `1598,1616,1809,6257,7791`
- newly ready from Recovery: `6257`
- `stock_holdout_needs_broker_normalization`: `[]`
- `time_holdout_ready`: `[]`

These are durable checkpoint values, not hard-coded next-round assumptions. Re-run planners before any new collection.

---

# 3. HiStock source-status semantics

Status policy version:

`histock-broker-source-status-policy-v2`

## Protected known-positive regression

`1598 / 2026-05-07`

The old degraded runner returned about 69.9 KB / `table_rows=1` and falsely treated the page as `source_empty`.

The protected successful regression remains expected to preserve:

- `凱基-汐止`: net `-74`, avg `20.49`
- `兆豐-大同`: net `+206`, avg `20.76`

## Protected 7791 source_rows_incomplete dates

These five exact dates must remain `source_rows_incomplete`:

- `7791@2026-04-07`
- `7791@2026-04-28`
- `7791@2026-04-30`
- `7791@2026-05-13`
- `7791@2026-05-22`

For all five:

- `negative_evidence: false`
- `coverage_usable: false`
- terminal only for that exact acquisition date under frozen strict completeness semantics
- planner skips that unusable exact date and continues alternate dates
- source blanks remain `null` / raw empty values; no zero imputation.

Former legacy `source_empty` checkpoints remain archived for provenance.

## 6754 evidence-quality state

Recovery produced **18 additional confirmed `source_rows_incomplete` dates for `6754`**.

They were not degraded pages. They had HTTP 200, visible date/Broker context, `table_rows=16`, normal stock-specific response sizes around 88–92 KB, but source-side blank/incomplete buy/sell/net fields under frozen strict completeness semantics.

At prior closeout the Broker planner reported for `6754`:

- existing valid days: `22`
- `source_rows_incomplete` dates: `18`
- target: `40`
- still-needed valid days: `18`
- remaining retryable candidate dates: `57`
- not exhausted before target.

Do not relax completeness semantics or impute blank Broker cells to make `6754` pass. Let the planner choose alternate exact dates.

Interpretation remains:

- `source_empty` = trustworthy explicit source-side no-data evidence;
- `suspected_degraded_response` = suspicious non-materialized/header-only response; retryable;
- `source_rows_incomplete` = source rows materialized but no coverage-usable complete Broker record under frozen semantics; exact date terminal, non-negative, planner continues alternate dates.

---

# 4. Checkpoint race architecture

Shared helper:

`scripts/checkpoint_bounded_research_paths.sh`

Required behavior:

1. stage only explicitly bounded paths;
2. commit the bounded local checkpoint;
3. direct push first;
4. if `origin/main` moved, fetch latest main;
5. record bounded changed paths and hard reset to `origin/main`;
6. replay only the required local delta;
7. immutable exact-path artifact already present remotely = remote wins;
8. retry bounded push;
9. never use blind `git pull --rebase`.

The active Recovery workflow uses this helper for plan, TDCC batches, post-TDCC Broker plan, Broker batches, and final coverage refresh.

---

# 5. Supported workflow entry points

## General physical Recovery coverage workflow

`.github/workflows/expand-institutional-withdrawal-validation-coverage-v1-recovery.yml`

Push-trigger marker:

`data_research/institutional-flow/validation/coverage-expansion-recovery-request-v1.json`

Requirements:

- `cancel-in-progress: false`
- TDCC one stock / fresh runner
- Broker <=5 requests / fresh runner
- `max-parallel: 1`
- randomized jitter/cooldown
- durable bounded checkpoint before runner exit
- re-plan after TDCC before Broker
- final outcome-blind coverage refresh.

Do not trigger Recovery merely by editing collector/planner scripts.

## Outcome-blind Recovery contract / closeout preflight

`.github/workflows/validate-institutional-withdrawal-recovery-contract-v1.yml`

Marker:

`data_research/institutional-flow/validation/coverage-recovery-preflight-request-v1.json`

This performs no TDCC/HiStock collection. It may refresh durable audit/planner JSON.

## HiStock source-empty repair

`.github/workflows/repair-histock-broker-source-empty-v1.yml`

Repair-only. Do not dispatch unless audit finds new retryable ambiguous degraded evidence.

## HiStock diagnostic

`.github/workflows/probe-histock-broker-fresh-runner-batches.yml`

Manual-only. Do not repeat the prior 30-request diagnostic without new evidence requiring it.

## Retired legacy coverage workflow

`.github/workflows/expand-institutional-withdrawal-validation-coverage-v1.yml`

Informational/manual-only. Never restore it as a long-running crawler.

---

# 6. Known caveats

- Historical TDCC remains association-only, not exact-time no-lookahead evidence.
- HiStock response-byte baselines are stock/page dependent; do not classify degradation from absolute bytes alone.
- `source_rows_incomplete` is unusable exact-date Broker coverage, not proof of no Broker activity.
- `6754` has substantial incomplete-source density but still had alternate candidates at prior closeout.
- The ready set is an outcome-blind coverage checkpoint, not a performance result.
- No untouched validation outcome scoring is authorized yet.

---

# 7. Next round

**Do not start this round automatically. Begin only after the repository owner explicitly sends Prompt A or otherwise asks to continue.**

Objective: **continue outcome-blind coverage expansion and assess coverage/sample-freeze readiness without opening outcomes**.

Ordered execution:

1. Re-read current repository rules and this handoff; verify latest `main` and forbidden-file absence.
2. Re-run/inspect the outcome-blind source-status audit, expansion planner, Broker batch planner, and validation coverage planner. Do not hard-code prior ready/queue sets.
3. Confirm there is no retryable ambiguous `source_empty` evidence.
4. Preserve all current `source_rows_incomplete` semantics, especially protected `7791` and `6754`; do not zero-impute blanks or relax frozen completeness rules.
5. Assess preregistered coverage/sample readiness before deciding whether collection is warranted.
6. If another substantial collection wave is warranted, run **only one bounded Recovery wave** through the supported marker-gated physical workflow.
7. After that wave, rerun the outcome-blind audit and planners.
8. Assess the preregistered coverage/sample-freeze gate only. Do not inspect untouched outcomes.
9. If sample freeze is reached, document and commit the frozen sample boundary and stop before opening the outcome evidence class.
10. At the meaningful boundary, apply Prompt B below. Only after Prompt B passes may this handoff be updated for the following round.

Prior planner snapshot for orientation only, not a hard-coded queue:

- TDCC surfaced: `6235,1907,1457,2207,0050,2645`
- Broker surfaced: `6754,5306`
- prior Broker plan: 58 exact-date requests across 12 physical batches at <=5 requests/batch.

Always re-plan from current durable state.

---

# 8. Prompt A — Next-round implementation prompt

```text
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
7. Continue strictly from the handoff's `Next round` section.

Preserve all frozen v6.0–v6.5 methodology, thresholds, weights, lifecycle definitions, validation gates, feature semantics, development-stock exclusions, TDCC historical caveats, source-derived calendar rules, and outcome-blind coverage/sample-construction guardrails.

Do not inspect or generate validation outcomes, future returns, drawdowns, lifecycle performance, or validation metrics while coverage/sample freeze is incomplete. Do not use `data_history_sma/trading_days.json` as the research calendar.

First re-run or inspect the current outcome-blind HiStock source-status audit, coverage expansion planner, Broker batch planner, and validation coverage planner. Derive current queues and ready stocks from durable evidence instead of reusing prior hard-coded values.

Confirm the audit remains free of retryable ambiguous source-empty evidence. Preserve all `source_rows_incomplete` states as non-negative and coverage-unusable exact-date evidence. In particular:

- protect the five documented `7791` dates;
- preserve `1598 / 2026-05-07` as the known-positive regression;
- preserve `6754` incomplete-source dates without zero-imputation or relaxed completeness semantics; let the planner choose alternate dates.

Assess preregistered coverage/sample readiness before deciding whether another collection wave is warranted. A non-empty queue by itself is not sufficient reason to collect.

If substantial collection is warranted, execute only one bounded Recovery wave through `.github/workflows/expand-institutional-withdrawal-validation-coverage-v1-recovery.yml` using its marker-gated entry point.

For that wave preserve:

`plan → freeze bounded queue → explicit batch_size → fresh GitHub job/runner → randomized request jitter → cooldown → checkpoint → runner exits → next batch → re-plan`

Requirements:

- `cancel-in-progress: false`
- independent matrix `strategy.fail-fast: false`
- `max-parallel: 1`
- TDCC one stock per fresh runner
- HiStock Broker at most 5 exact-source-date requests per fresh runner
- fresh checkout of latest `main` per physical batch
- request jitter + physical-batch cooldowns
- durable checkpoint before runner exit
- bounded race-safe checkpoint helper semantics
- never use blind `git pull --rebase origin main`.

After the bounded wave finishes, do not immediately start another wave. Stop the implementation round and wait for Prompt B closeout/verification.

If no collection wave is warranted because the preregistered sample/coverage gate is already reached, do not inspect outcomes. Stop and let Prompt B independently verify and document the sample-freeze boundary.

Do not update the next handoff package until Prompt B has independently reviewed this round.
```

---

# 9. Prompt B — Next-round closeout / verification prompt

Use this only after Prompt A's planned work or bounded workflow has finished. Do not start another collection wave before this closeout passes.

```text
The current outcome-blind Institutional Withdrawal Validation implementation round has finished its planned work.

Do not start another research or collection wave yet.

Perform the mandatory phase-closeout review according to the latest `AGENTS.md` and canonical handoff.

Before reviewing results:

1. Re-read `AGENTS.md`.
2. Re-read `docs/project-philosophy.md`.
3. Re-read `docs/roadmap/current-phase.md`.
4. Re-read `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`.
5. Verify current `main` and identify every implementation/data/workflow commit and relevant Actions run created by Prompt A.

First verify leakage/frozen-method invariants:

- planning and sample construction remained outcome-blind;
- `data_history_sma/trading_days.json` was not introduced as the research calendar;
- no v6.0–v6.5 threshold, weight, lifecycle definition, validation gate, or feature semantic was retuned from validation evidence;
- no validation future-return, drawdown, lifecycle-outcome, or metric evidence was inspected or generated.

Explicitly verify these files still DO NOT exist:

- `data_research/institutional-flow/validation/validation-outcomes-v1.json`
- `data_research/institutional-flow/validation/validation-metrics-v1.json`

Re-run or inspect the current outcome-blind:

- HiStock source-status audit;
- coverage expansion planner;
- Broker batch planner;
- validation coverage planner.

Derive the current ready set, Broker queue, TDCC queue, normalization state, and source-status counts from current durable repository evidence. Do not reuse old hard-coded counts.

Verify HiStock source-status invariants:

- `unsafe_ambiguous_source_empty` remains zero unless new evidence explicitly explains otherwise;
- all confirmed `source_rows_incomplete` states remain `negative_evidence:false` and `coverage_usable:false`;
- the five protected `7791` dates retain their documented exact-date status and no blank-cell zero imputation;
- `1598 / 2026-05-07` still passes the known-positive regression and is not reclassified as source-empty;
- `6754` incomplete-source dates have not been made successful by relaxing frozen completeness semantics;
- any newly observed incomplete-source dates are distinguished from degraded responses using HTTP status, response bytes relative to stock/page context, requested date/context visibility, table materialization, row counts, and incomplete-record diagnostics.

If Prompt A ran a Recovery wave, verify the entire wave end-to-end:

- it was exactly one bounded wave based on a freshly derived planner queue;
- all planned TDCC jobs completed on separate fresh runners;
- TDCC used exactly one stock per fresh runner;
- Broker jobs, if any, were true separate fresh-runner physical jobs;
- every Broker physical batch contained no more than 5 exact-source-date requests;
- `strategy.fail-fast: false`, `max-parallel: 1`, fresh checkout, request jitter, inter-request pacing, and randomized batch cooldowns were preserved;
- every physical batch checkpointed durable evidence before runner exit;
- every expected batch has a durable checkpoint/commit or a clearly documented no-op reason;
- `scripts/checkpoint_bounded_research_paths.sh` or equivalent bounded remote-wins semantics were used for checkpoint writers;
- no `git pull --rebase` path was reintroduced;
- compare the final commit chain with expected physical batches and verify no checkpoint/data silently disappeared because another writer advanced `main`.

Inspect early, middle, and late HiStock Broker batches if Broker collection occurred. Specifically look for:

- HTTP 200 with materially shrunken response relative to the relevant stock/page baseline;
- `table_rows = 1`;
- header-only or non-materialized Broker tables;
- unexpected `source_empty`;
- unexpected `extraction_incomplete` / suspected degraded responses;
- regression of `source_rows_incomplete` handling;
- blank cells being converted to zero.

If any important failure, missing checkpoint, unexplained source degradation, planner/audit invariant regression, or leakage violation is found:

- DO NOT close the phase;
- DO NOT produce the following round's Prompt A/Prompt B yet;
- investigate/fix only the bounded problem;
- rerun only bounded work necessary;
- then repeat this entire Prompt B verification.

After technical verification, assess the preregistered coverage/sample-freeze gate.

If the gate is NOT reached:

- document the durable current coverage state and why another round is or is not warranted;
- define the next evidence-driven objective without executing it.

If the gate IS reached:

- do not inspect or generate untouched validation outcomes in this same round;
- freeze and document the sample/coverage state and the exact gate evidence;
- update the canonical handoff to declare the phase boundary;
- prepare the next-phase paired Prompt A and Prompt B for the explicitly separate outcome-validation phase;
- stop.

Only after all closeout checks pass:

1. update `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md` with completed work, evidence, commits/runs, changed understanding, durable audit/coverage state, entry points, caveats, and exact Next round;
2. prepare both Prompt A(N+1) and a phase-specific Prompt B(N+1) BEFORE the following implementation begins;
3. commit the canonical handoff to `main` using a clear checkpoint commit;
4. re-fetch current `main` after the handoff commit and verify no later workflow/data commit has made the handoff stale;
5. respond with the phase-closeout summary, canonical handoff path, final handoff commit SHA, next-round objective, Prompt A(N+1), and Prompt B(N+1).

Do not begin the following Prompt A unless the repository owner explicitly asks you to continue.
```
