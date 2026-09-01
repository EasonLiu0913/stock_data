# Institutional Withdrawal Research — Validation Phase Handoff

Canonical handoff: `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`

Checkpoint: 2026-09-01

## Current phase

**Prospective Batch 2+ expansion-protocol closeout PASSED. The next promoted round is outcome-blind Batch 2 sample construction under the frozen expansion protocol.**

Completed round identity:

`institutional-withdrawal-expansion-protocol-v1-preregistration`

Prompt B closeout: **PASS**

New active round identity:

`institutional-withdrawal-batch-2-outcome-blind-sample-construction-v1`

Do not open Batch 2 lifecycle outcomes, future returns, drawdowns, structural-repair outcomes, or validation metrics in the active round. The active round ends at durable Batch 2 sample freeze only.

---

## Frozen methodology and prior evidence

Lifecycle methodology under validation:

`institutional-withdrawal-lifecycle-v1`

Frozen development methodology:

`v6.0-v6.5`

Development stocks:

`2330,2317,2454,2382,2303,2449`

Development period:

`2026-04-01` through `2026-08-21`

Frozen untouched Batch 1:

`1598,1616,1809,6257,7791`

Batch 1 sample-freeze commit:

`84cc5ea7585b94598e25262d35ae97557ad3ab53`

Batch 1 outcome commit:

`9f2a5339346e2e2260b2d7802da9a68f3dfebb90`

Batch 1 closeout run:

`33317813525` — PASS

Batch 1 result remains underpowered/unresolved:

- fragile lifecycle events: `0`
- durable-failure events: `0`
- resolved lifecycle events: `0`
- `failure_plus_reclaim`: `0`
- `failure_plus_no_reclaim`: `0`

Protected Batch 1 artifact blobs at this closeout:

- `data_research/institutional-flow/validation/validation-outcomes-v1.json` → blob `82fefaa25becce30a461c36cb85eba36dda44b8f`
- `data_research/institutional-flow/validation/validation-metrics-v1.json` → blob `709eb1772bfbb0040257fc78d84adeda3626e98c`

These files may not be read for candidate ranking/sample selection and may not be rewritten, staged, deleted, or replaced during Batch 2 sample construction.

---

## Prospective expansion protocol — CLOSED / FROZEN

Canonical protocol:

`data_research/institutional-flow/institutional-withdrawal-expansion-protocol-v1.md`

Methodology identity:

`institutional-withdrawal-untouched-expansion-protocol-v1`

Initial Prompt A protocol commit:

`fee0622dbd8f5e12f0769215514adc7db47816af`

Prompt A handoff checkpoint:

`03c6c72730991122c7db89c23675e575ec4b3e65`

Prompt B bounded protocol-repair commits:

- `df4e4c8454c885020fdbc9a4ebd3f24396211a3d` — document workflow incompatibility with existing Batch 1 outcome artifacts and missing protocol checkout;
- `7c33a2af408eb32c0fe172d0c6154db605da93c1` — freeze deterministic terminal coverage-resolution / exhaustion rule.

Prompt B independently verified the pre-Prompt-A checkpoint at `e0ed2acbf6d313f2772a708ff072a38793b13792` contained the same phase-specific Prompt B before Prompt A began.

Changed-file audit from pre-Prompt-A checkpoint through final protocol repair showed only:

- `data_research/institutional-flow/institutional-withdrawal-expansion-protocol-v1.md`
- `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`

No frozen lifecycle scripts/specs, Batch 1 outcomes/metrics, coverage artifacts, workflow code, TDCC/Broker research data, or production strategy files changed in the completed protocol round.

### Frozen protocol rules

Candidate universe:

- all 4-digit stock codes observed in valid TWSE foreign-investor daily rows or valid Fubon OHLCV rows over `2026-04-01..2026-08-21`;
- then apply permanent exclusions.

Permanent exclusions:

- development stocks `2330,2317,2454,2382,2303,2449`;
- Batch 1 stocks `1598,1616,1809,6257,7791`;
- any stock already frozen into a later untouched batch.

Deterministic candidate order:

`sha256("institutional-withdrawal-validation-expansion-v1|" + stock)` ascending, stock code ascending tie-break.

Coverage gate:

- official historical TDCC observations >=3;
- common Foreign + valid OHLCV sessions >=40;
- common ratio >=0.80;
- normalized Broker research days >=40.

Deterministic coverage states:

- `coverage_ready`
- `coverage_pending_tdcc`
- `coverage_pending_broker`
- `coverage_terminal_ineligible_common_source`
- `coverage_terminal_ineligible_tdcc`
- `coverage_terminal_ineligible_broker`

A pending earlier candidate cannot be leapfrogged by a later ready candidate. A candidate may be skipped only after durable terminal coverage-ineligible evidence exists under the protocol.

Broker exhaustion:

- common source dates processed in ascending date order;
- valid normalized rows count first;
- strict persisted terminal statuses remain terminal for that date;
- degraded/ambiguous HTTP 200 responses remain retryable;
- stop when 40 valid Broker days are reached or every common source date is durably exhausted;
- fewer than 40 after complete exhaustion → `coverage_terminal_ineligible_broker`.

Batch design:

- Batch 2 through Batch 5 only;
- 10 stocks per batch except a smaller terminal batch only after the remaining ordered universe is fully resolved;
- at most 40 additional untouched stocks.

Stopping rule after a completed outcome-closeout batch:

- stop before opening another batch when cumulative untouched stock-holdout counts reach >=30 resolved durable failures, >=8 reclaim, and >=8 no-reclaim; or
- stop unconditionally after Batch 5.

Directional favorability never controls whether another batch is added.

Pooling rule:

Batch 1 + later untouched stock-holdout batches may be pooled only for the exact preregistered `validation-plan-v1.md` event metrics, while per-batch results remain visible. Time holdout is never pooled into untouched stock-holdout production-gate statistics.

---

## Prompt B closeout findings

The completed protocol satisfies the required prospective design gates:

- universe definition: PASS
- development/prior-holdout exclusions: PASS
- deterministic ordering: PASS
- source-derived calendar/date policy: PASS
- strict Broker semantics: PASS
- sequential design and batch size: PASS
- finite maximum batch count: PASS
- cumulative event-count rule: PASS
- pooling/separation rule: PASS
- outcome-independent expansion rule: PASS
- zero-event/underpowered retention rule: PASS
- exact sample-freeze-before-outcome boundary: PASS
- deterministic terminal coverage resolution: PASS after bounded Prompt B repair
- mechanically implementable with exact bounded gaps recorded: PASS after bounded Prompt B repair

Prompt B found two pre-sample implementation gaps and recorded them prospectively before any Batch 2 identity was opened:

1. existing `.github/workflows/expand-institutional-withdrawal-validation-coverage-v1-recovery.yml` still asserts Batch 1 outcome/metrics files must be absent, which is obsolete after Batch 1 closeout;
2. old expansion/physical-batch planners do not encode prior holdout exclusions, protocol identity, terminal/pending coverage states, or the no-leapfrog rule.

These are implementation gaps only; they do not reopen protocol methodology. They must be fixed/superseded outcome-blind in the active sample-construction round.

---

## Exact entry points

Frozen classifier/lifecycle:

- `scripts/analyze_institutional_withdrawal_v6_distribution_absorption.js`
- `scripts/analyze_institutional_withdrawal_v6_1_events.js`
- `scripts/analyze_institutional_withdrawal_v6_2_failure_transition.js`
- `scripts/analyze_institutional_withdrawal_v6_3_delayed_failure.js`
- `scripts/analyze_institutional_withdrawal_v6_4_durable_failure.js`
- `scripts/analyze_institutional_withdrawal_v6_5_recovery_reclaim.js`

Frozen specs:

- `data_research/institutional-flow/v6-distribution-absorption-spec.md`
- `data_research/institutional-flow/v6-2-failure-transition-spec.md`
- `data_research/institutional-flow/v6-3-delayed-failure-spec.md`
- `data_research/institutional-flow/v6-4-durable-failure-spec.md`
- `data_research/institutional-flow/v6-5-recovery-reclaim-spec.md`

Protocol / validation documents:

- `data_research/institutional-flow/validation-plan-v1.md`
- `data_research/institutional-flow/institutional-withdrawal-expansion-protocol-v1.md`
- `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`

Current legacy coverage/planning entry points to inspect/supersede:

- `scripts/plan_institutional_withdrawal_validation_coverage.js`
- `scripts/plan_institutional_withdrawal_validation_expansion_v1.js`
- `scripts/plan_institutional_withdrawal_validation_broker_batches_v1.js`
- `scripts/audit_histock_broker_source_empty_checkpoints.js`
- `scripts/test_histock_broker_status_policy_regressions.js`
- `.github/workflows/expand-institutional-withdrawal-validation-coverage-v1-recovery.yml`
- `.github/workflows/validate-institutional-withdrawal-recovery-contract-v1.yml`

Preferred versioned active-round implementation paths:

- `scripts/plan_institutional_withdrawal_validation_sample_v2.js` — new protocol-aware candidate/coverage/sample-state planner;
- `scripts/plan_institutional_withdrawal_validation_broker_batches_v2.js` — new protocol-aware Broker physical-batch planner if changing v1 in place would weaken historical reproducibility;
- `.github/workflows/construct-institutional-withdrawal-stock-holdout-batch-v2.yml` — new outcome-blind sample-construction workflow;
- `data_research/institutional-flow/validation/batch-2-coverage-state-v1.json` — durable protocol-aware ordered coverage state;
- `data_research/institutional-flow/validation/batch-2-sample-freeze-v1.json` — canonical Batch 2 sample-freeze artifact created only when membership is mechanically determined.

If implementation evidence shows one of these versioned paths should be renamed before first use, keep the role/version identity explicit in the handoff and do not overwrite historical v1 semantics silently.

Physical-batch architecture remains mandatory:

`plan -> freeze bounded queue -> explicit batch_size -> fresh runner -> jitter -> cooldown -> checkpoint -> runner exits -> next batch -> re-plan`

with:

- `cancel-in-progress:false`
- matrix `fail-fast:false`
- `max-parallel:1`
- one TDCC stock per fresh runner
- Broker <=5 exact-source-date requests per fresh runner
- latest-main checkout
- durable checkpoint before runner exit
- no blind `git pull --rebase`

---

## Next round

Active round: **outcome-blind Batch 2 sample construction only**.

The round must first implement/supersede the old expansion plumbing so the frozen protocol can execute mechanically. It may then run bounded coverage resolution in deterministic order until exact Batch 2 membership is known and durably frozen.

The round ends immediately after Batch 2 sample freeze is committed and remotely verified. It must not open Batch 2 lifecycle/outcome evidence.

---

## Prompt A — Outcome-blind Batch 2 sample construction

```text
Continue the Institutional Withdrawal Validation work in repository `EasonLiu0913/stock_data`.

This is the active round `institutional-withdrawal-batch-2-outcome-blind-sample-construction-v1`.

Before doing any work:
1. Fetch current remote `main`.
2. Read repository-root `AGENTS.md`.
3. Read `docs/project-philosophy.md` and `docs/roadmap/current-phase.md`.
4. Read `data_research/institutional-flow/validation-plan-v1.md`.
5. Read the frozen prospective protocol at `data_research/institutional-flow/institutional-withdrawal-expansion-protocol-v1.md`.
6. Read the canonical handoff at `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`.
7. Verify the protocol closeout is PASS and this round is the promoted active round.

Frozen constraints:
- do not modify v6.0-v6.5 classifier/lifecycle rules or specs;
- do not inspect or consume Batch 1 outcomes/metrics for candidate ranking or sample construction;
- protect `data_research/institutional-flow/validation/validation-outcomes-v1.json` blob `82fefaa25becce30a461c36cb85eba36dda44b8f`;
- protect `data_research/institutional-flow/validation/validation-metrics-v1.json` blob `709eb1772bfbb0040257fc78d84adeda3626e98c`;
- do not generate Batch 2 future returns, drawdowns, lifecycle-resolution outcomes, structural-repair outcomes, or validation metrics;
- do not run v6.1 diagnostic outcome labels over future candidates;
- research calendar remains source-derived from valid TWSE foreign-investor daily files; never use `data_history_sma/trading_days.json`.

Implement the frozen expansion protocol mechanically before freezing any Batch 2 identity.

Preferred versioned paths:
- `scripts/plan_institutional_withdrawal_validation_sample_v2.js` — protocol-aware ordered candidate/coverage/sample planner;
- `scripts/plan_institutional_withdrawal_validation_broker_batches_v2.js` — protocol-aware Broker physical-batch planner if v1 cannot be safely reused without changing historical semantics;
- `.github/workflows/construct-institutional-withdrawal-stock-holdout-batch-v2.yml` — outcome-blind physical-batch/sample-freeze workflow;
- `data_research/institutional-flow/validation/batch-2-coverage-state-v1.json` — durable ordered coverage-state artifact;
- `data_research/institutional-flow/validation/batch-2-sample-freeze-v1.json` — canonical sample-freeze artifact.

You may reuse existing code, but do not silently change historical v1 semantics when a versioned v2 path is safer.

The protocol-aware planner/workflow must:
1. encode methodology `institutional-withdrawal-untouched-expansion-protocol-v1`;
2. use candidate universe and anchor range exactly as frozen;
3. permanently exclude development stocks `2330,2317,2454,2382,2303,2449` and prior holdout stocks `1598,1616,1809,6257,7791`;
4. order candidates by ascending `sha256("institutional-withdrawal-validation-expansion-v1|" + stock)`, stock-code tie-break;
5. emit exactly these outcome-blind states: `coverage_ready`, `coverage_pending_tdcc`, `coverage_pending_broker`, `coverage_terminal_ineligible_common_source`, `coverage_terminal_ineligible_tdcc`, `coverage_terminal_ineligible_broker`;
6. enforce the fixed coverage thresholds from the protocol;
7. prevent a later ready candidate from leapfrogging an earlier `coverage_pending_*` candidate;
8. resolve TDCC and Broker coverage exactly by the protocol's deterministic exhaustion procedure;
9. preserve strict Broker status-policy regressions and never zero-impute incomplete rows;
10. prove the old Batch 1 outcome/metrics files are not planner dependencies and remain blob-identical;
11. preserve physical batches: one TDCC stock per fresh runner, Broker <=5 exact-source-date requests per fresh runner, jitter/cooldown, checkpoint before runner exit, max-parallel=1, fail-fast=false, cancel-in-progress=false;
12. never require existing Batch 1 outcome artifacts to be absent.

Before network collection, add deterministic contract tests/fixtures that prove:
- exact ordering is stable;
- permanent exclusions work;
- common-source terminal ineligibility works without network calls;
- pending TDCC blocks leapfrogging;
- terminal TDCC ineligibility permits deterministic progression;
- pending Broker blocks leapfrogging;
- ambiguous degraded Broker status remains retryable;
- fully exhausted Broker coverage <40 becomes terminal ineligible;
- first 10 ready candidates are selected only after every earlier candidate is resolved;
- no outcome/metric file is read by the sample planner.

Then execute outcome-blind coverage/sample construction under the fresh-runner physical-batch architecture. Continue deterministic re-plan/bounded collection waves until one of these preregistered sample-construction boundaries occurs:

A. exactly 10 Batch 2 `coverage_ready` stocks are mechanically determined; or
B. the entire remaining deterministic candidate universe is durably resolved and fewer than 10 ready stocks remain, in which case the smaller terminal Batch 2 is mechanically determined; or
C. a genuine source/tool failure prevents further deterministic coverage resolution after bounded retries/checkpointing. In case C, do not fabricate a sample freeze; record the blocking candidate/state/evidence and stop as blocked rather than skipping it.

When A or B occurs:
- write `data_research/institutional-flow/validation/batch-2-sample-freeze-v1.json` with methodology/protocol identity, exact stock list, deterministic-order positions/keys, fixed anchor range, per-earlier-candidate resolution evidence, coverage-state artifact blob, protected Batch 1 artifact blobs, and `generated_without_outcomes=true`;
- commit/push the sample freeze and all required bounded implementation/coverage artifacts;
- fetch current remote `main` again;
- verify the sample-freeze path/blob and every exact Batch 2 identity on remote main;
- verify Batch 1 outcome/metrics blobs are unchanged;
- update this canonical handoff to state Prompt A complete / Prompt B pending while preserving the preregistered Prompt B below;
- stop.

Forbidden in this round:
- Batch 2 lifecycle classification/output generation;
- future return/drawdown/repair metrics for Batch 2;
- production promotion;
- changing the frozen protocol because coverage is inconvenient;
- skipping a pending earlier candidate to reach 10 stocks faster.

Intermediate planner/test/physical-batch PASS is not Prompt A completion. Prompt A completes only at a durable, remotely verified Batch 2 sample freeze (A/B) or stops explicitly BLOCKED under condition C.

On successful sample freeze, final response must say `Prompt A complete — Batch 2 sample frozen; ready for Prompt B` and list the sample-freeze commit/path/blob and exact frozen identities. Do not execute Prompt B automatically.
```

---

## Prompt B — Batch 2 sample-freeze closeout / verification

```text
The active outcome-blind Batch 2 sample-construction Prompt A has finished.

Do not open Batch 2 lifecycle outcomes, future returns, drawdowns, structural-repair outcomes, validation metrics, or production promotion yet.

Perform mandatory independent sample-freeze closeout.

Before verification:
1. Fetch current remote `main`.
2. Re-read `AGENTS.md`.
3. Re-read `docs/project-philosophy.md` and `docs/roadmap/current-phase.md`.
4. Re-read `data_research/institutional-flow/validation-plan-v1.md`.
5. Re-read frozen protocol `data_research/institutional-flow/institutional-withdrawal-expansion-protocol-v1.md`.
6. Re-read canonical handoff `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`.
7. Recover this exact Prompt B from the pre-Prompt-A handoff checkpoint if any future prompt pair has since been appended.

If Prompt A stopped BLOCKED rather than producing a sample freeze:
- verify the blocking candidate is earlier than every candidate that would otherwise enter the sample;
- verify its state is genuinely `coverage_pending_tdcc` or `coverage_pending_broker` rather than terminally resolvable;
- verify bounded retries/checkpoints were preserved;
- do not close or promote outcome validation; keep the round blocked and fix only the bounded collection/plumbing defect if possible.

If a sample freeze exists, independently verify all of the following:

Phase separation / protected evidence:
- Batch 1 remains exactly `1598,1616,1809,6257,7791`;
- `validation-outcomes-v1.json` blob remains `82fefaa25becce30a461c36cb85eba36dda44b8f`;
- `validation-metrics-v1.json` blob remains `709eb1772bfbb0040257fc78d84adeda3626e98c`;
- frozen v6.0-v6.5 scripts/specs are unchanged from the protocol-closeout boundary;
- no Batch 2 future return, drawdown, lifecycle-resolution outcome, structural-repair outcome, or validation metric was generated/inspected;
- no Batch 1 outcome content influenced candidate ordering/sample selection.

Implementation contract:
- protocol-aware planner methodology is exactly `institutional-withdrawal-untouched-expansion-protocol-v1`;
- candidate universe/date/calendar policy matches the protocol;
- permanent exclusions include all development + Batch 1 stocks;
- deterministic order is exact SHA-256 seed/order from the protocol;
- all six coverage states are implemented with the frozen semantics;
- no later ready candidate can leapfrog an earlier pending candidate;
- TDCC/Broker terminal exhaustion follows the frozen rules;
- Broker regressions pass, including protected `1598 / 2026-05-07`, five protected `7791` incomplete-source dates, and ambiguous degraded HTTP 200 retryability;
- physical batches satisfy one TDCC stock per fresh runner and <=5 Broker exact-source-date requests per fresh runner, with `fail-fast:false`, `max-parallel:1`, `cancel-in-progress:false`, jitter/cooldown, and durable checkpoint before runner exit;
- planner/tests contain no dependency on validation outcomes/metrics or v6.1 diagnostic labels.

Sample identity verification:
- independently recompute the deterministic candidate order and coverage-state transition logic from outcome-blind inputs;
- verify every candidate before the last selected Batch 2 member is either permanently excluded, already prior-frozen, selected `coverage_ready`, or durably `coverage_terminal_ineligible_*`;
- verify there is no earlier `coverage_pending_*` candidate that was skipped;
- verify the frozen Batch 2 has exactly 10 stocks unless the entire remaining deterministic universe was durably resolved and fewer than 10 ready stocks exist;
- verify every frozen stock satisfies TDCC>=3, common sessions>=40, common ratio>=0.80, normalized Broker days>=40;
- verify `batch-2-sample-freeze-v1.json` has `generated_without_outcomes=true`, exact protocol identity, anchor range, deterministic order evidence, coverage-state artifact identity, and protected Batch 1 blobs;
- verify all required artifacts/commits are durable on current remote `main`, not merely green workflow outputs.

If any criterion fails:
- DO NOT open outcomes;
- DO NOT close the sample-freeze phase;
- fix only the bounded outcome-blind planner/coverage/sample-freeze defect;
- restart this Prompt B verification from criterion 1.

Only after every criterion passes:
1. record `Prompt B closeout: PASS` for Batch 2 sample freeze in the canonical handoff;
2. mark the exact Batch 2 identities immutable;
3. preregister/promote the next paired round: Prompt A for untouched Batch 2 lifecycle/outcome validation under unchanged v6.0-v6.5, and a phase-specific Prompt B outcome closeout;
4. commit the handoff;
5. fetch current remote main again and verify the handoff/sample/protected blobs are durable and not stale;
6. respond with closeout evidence, handoff commit SHA, exact frozen Batch 2 identities, and both next prompts.

Do not execute Batch 2 outcome validation in this closeout round.
```

---

## Safety / stop conditions

- Frozen protocol rules may not be changed after this Prompt B closeout merely because deterministic coverage resolution is slow or produces few ready candidates.
- Batch 2 identities do not exist until the active Prompt A mechanically resolves and durably freezes them.
- Once Batch 2 outcomes are opened in a later round, Batch 2 membership is immutable.
- Historical TDCC remains association-only and `production_no_lookahead_safe=false`.
- Missing OHLCV remains a true source gap.
- `source_rows_incomplete` remains non-negative and coverage-unusable.
- degraded HTTP 200 / shrunken HTML / `table_rows=1` remains ambiguous/retryable.
- no production promotion occurs from sample construction or sample-freeze closeout.
