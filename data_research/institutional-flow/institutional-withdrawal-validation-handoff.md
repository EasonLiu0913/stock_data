# Institutional Withdrawal Research — Validation Phase Handoff

Canonical handoff: `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`

Phase-closeout checkpoint: 2026-08-30

## Current phase

**Untouched stock-holdout sample frozen; outcome-validation phase is authorized only as a separate next round.**

The outcome-blind coverage/sample-construction phase is closed. This closeout did **not** open or generate validation future returns, drawdowns, lifecycle outcomes, or validation metrics.

---

## Objective

Validate frozen methodology `institutional-withdrawal-lifecycle-v1` on the preregistered untouched stock holdout without retuning v6.0–v6.5 and without mixing development observations into untouched statistics.

Canonical preregistration:

`data_research/institutional-flow/validation-plan-v1.md`

---

## Frozen methodology / leakage guardrails

Treat v6.0 through v6.5 as frozen development research.

Development stocks:

`2330,2317,2454,2382,2303,2449`

Development period:

`2026-04-01` through `2026-08-21`.

Do not retune thresholds, weights, lifecycle definitions, validation gates, feature semantics, or development-stock exclusions from validation evidence.

Research calendar remains source-derived from valid TWSE foreign-investor daily files. Never use `data_history_sma/trading_days.json` as the research calendar.

Historical TDCC remains association-only because exact historical publication-time availability is incomplete; retain `production_no_lookahead_safe=false` semantics for historical TDCC evidence.

The known `2026-06-24` development OHLCV gap remains a real gap. Do not compress sessions or impute missing OHLCV.

Stock-holdout and any later time-holdout results must remain separate.

---

## Outcome-blind sample-freeze boundary — PASSED

Prompt B closeout independently verified the preregistered coverage gate before opening outcomes.

Frozen stock-holdout Batch 1:

`1598,1616,1809,6257,7791`

Freeze basis:

- range: `2026-04-01` through `2026-08-21`;
- source-derived calendar sessions: `98`;
- all five stocks were returned by `stock_holdout_ready`;
- `stock_holdout_needs_broker_normalization`: `[]`;
- `time_holdout_ready`: `[]`;
- preregistration Section 9 requires freezing **all** returned `stock_holdout_ready` stocks when that set is non-empty;
- remaining TDCC/Broker queues are not a reason to expand Batch 1 after the gate has been reached.

Durable outcome-blind evidence commit:

`f92b362ac57e1e6248d1ecd35b9c729690266b29` — `research: refresh outcome-blind validation coverage preflight`

Durable evidence blobs at the freeze boundary:

- `histock-source-empty-audit-v1.json`: `bfc57294e5a8e027a6786482fd0c4fa8f7fbedb0`;
- `coverage-expansion-v1.json`: `e99ff566dd9ef9afed7248529b8d19c5760dbf6f`;
- `validation-coverage-v1.json`: `a19d0a5c3a2c3acb7b46079a2fbf926e06ef76d5`.

The coverage gate is a sample-construction decision, not a performance conclusion.

---

## Prompt A round closeout evidence

Prompt A was inspection-only after the paired-prompt checkpoint `829524c524bed438bf7fb204fa573e5df94405e2`.

It created:

- no research/data/workflow commit;
- no Recovery marker update;
- no TDCC or HiStock collection run;
- no validation outcome/metrics artifact;
- no outcome-validation workflow run.

The latest repository commit throughout Prompt A remained:

`829524c524bed438bf7fb204fa573e5df94405e2` — `docs: checkpoint institutional withdrawal validation handoff`.

A normal Pages deployment run `33303150965` was triggered by that pre-existing handoff commit; it is not a Prompt A research/collection run.

Because Prompt A did not run Recovery, the Recovery-wave physical-batch verification clauses were not applicable to this implementation round.

---

## Outcome-blind source-status closeout state

The latest no-collection preflight was:

`33301186925` — **success**

It reran/validated:

- HiStock status-policy regressions;
- HiStock source-status audit;
- coverage expansion planner;
- Broker batch planner;
- validation coverage planner;
- forbidden outcome/metrics artifact checks.

Durable counts at the freeze boundary:

- exact statuses: `241`;
- `source_empty_statuses`: `0`;
- `source_rows_incomplete_statuses`: `23`;
- `unsafe_ambiguous_source_empty`: `0`;
- confirmed terminal source_empty: `0`;
- `confirmed_source_rows_incomplete`: `23`;
- `legacy_terminal_source_empty_unverified`: `0`;
- TDCC queue remaining: `1018`;
- Broker queue remaining: `39`;
- `stock_holdout_ready`: `1598,1616,1809,6257,7791`;
- `stock_holdout_needs_broker_normalization`: `[]`;
- `time_holdout_ready`: `[]`.

The Broker planner orientation state at freeze was `6754,5306`, 58 exact-date requests across 12 physical batches, but this queue is **not** part of frozen Batch 1 and must not be collected merely because it is non-empty.

---

## HiStock source-status invariants

Status policy version:

`histock-broker-source-status-policy-v2`

### Known-positive regression

`1598 / 2026-05-07` remains protected and must continue to parse:

- `凱基-汐止`: net `-74`, avg `20.49`;
- `兆豐-大同`: net `+206`, avg `20.76`.

The old degraded approximately 69.9 KB / `table_rows=1` page is a regression fixture for `suspected_degraded_response`, not terminal source-empty evidence.

### Protected 7791 incomplete-source dates

These five dates remain exact-date `source_rows_incomplete`:

- `7791@2026-04-07`;
- `7791@2026-04-28`;
- `7791@2026-04-30`;
- `7791@2026-05-13`;
- `7791@2026-05-22`.

For all five:

- `negative_evidence: false`;
- `coverage_usable: false`;
- source blanks remain `null` / raw empty values;
- no zero imputation;
- no relaxed completeness semantics.

### 6754 incomplete-source evidence

There are 18 confirmed `source_rows_incomplete` dates for `6754` at the freeze boundary.

These were materialized source pages, not degraded pages: HTTP 200, requested date/Broker context visible, `table_rows=16`, stock/page-appropriate response sizes around 88–92 KB, and explicit incomplete-record diagnostics.

They remain non-negative and coverage-unusable. Do not make them successful by zero-imputing blanks or relaxing strict Broker row completeness.

---

## Recovery architecture retained for future coverage work

If a later, separately justified coverage wave is ever needed, the supported workflow remains:

`.github/workflows/expand-institutional-withdrawal-validation-coverage-v1-recovery.yml`

Marker:

`data_research/institutional-flow/validation/coverage-expansion-recovery-request-v1.json`

Mandatory architecture remains:

`plan → freeze bounded queue → explicit batch_size → fresh runner → jitter → cooldown → checkpoint → runner exits → next batch → re-plan`

with:

- `cancel-in-progress: false`;
- matrix `strategy.fail-fast: false`;
- `max-parallel: 1`;
- TDCC one stock per fresh runner;
- HiStock Broker <=5 exact-source-date requests per fresh runner;
- latest-main checkout for every physical batch;
- randomized request jitter and physical-batch cooldowns;
- durable checkpoint before runner exit;
- `scripts/checkpoint_bounded_research_paths.sh` bounded remote-wins semantics;
- no blind `git pull --rebase`.

Completed Recovery evidence remains run `33298604998`, final commit `138bf957e0d52c88bb27149767a7d8898fcf5872`, with 25 expected checkpoint commits and no lost physical-batch checkpoint.

---

## Forbidden artifacts at this phase boundary

Prompt B explicitly verified that these files did **not** exist when sample freeze was declared:

- `data_research/institutional-flow/validation/validation-outcomes-v1.json`;
- `data_research/institutional-flow/validation/validation-metrics-v1.json`.

Their absence at sample-freeze closeout proves the outcome evidence class was not opened in the same round that declared the frozen sample.

In the **next explicit outcome-validation round**, these paths may be created only by code implementing the preregistered outcome contract after re-verifying this frozen boundary. They must never be used to alter the frozen sample or classifier rules.

---

## Frozen lifecycle executable contract and regression anchors

These exact paths are known and must be handed directly to the next agent. Do **not** spend a new round rediscovering them through broad code search.

### Frozen executable chain

- `scripts/analyze_institutional_withdrawal_v6_distribution_absorption.js`
  - canonical v6 structure classifier;
  - the `classify(row)` function contains the frozen persistent-transfer, Broker-pressure, absorption/fragility, and structure rules;
  - classification is constructed from contemporaneous feature fields; the same script also summarizes development outcomes, so validation code must reuse/extract the classifier logic without allowing its outcome-summary code to feed classification.
- `scripts/analyze_institutional_withdrawal_v6_1_events.js`
  - development-only event diagnosis/attachment layer;
  - it identifies frozen `fragile_distribution` events from v6 and attaches development outcome labels;
  - **do not use its future-outcome labels as validation classifier inputs**. It is a regression/development diagnostic anchor, not a permissible holdout feature source.
- `scripts/analyze_institutional_withdrawal_v6_2_failure_transition.js`
  - frozen immediate failure-transition logic and 10-session transition rules.
- `scripts/analyze_institutional_withdrawal_v6_3_delayed_failure.js`
  - frozen delayed-failure logic for sessions 11–20 and immediate-transition preservation.
- `scripts/analyze_institutional_withdrawal_v6_4_durable_failure.js`
  - frozen 3-session durability/persistence confirmation after a candidate failure.
- `scripts/analyze_institutional_withdrawal_v6_5_recovery_reclaim.js`
  - frozen sessions 4–15 reclaim/repair logic after durable failure; confirmed reclaim requires the preregistered price-repair + supply-relief contract.

### Frozen preregistered specs

- `data_research/institutional-flow/v6-distribution-absorption-spec.md`
- `data_research/institutional-flow/v6-2-failure-transition-spec.md`
- `data_research/institutional-flow/v6-3-delayed-failure-spec.md`
- `data_research/institutional-flow/v6-4-durable-failure-spec.md`
- `data_research/institutional-flow/v6-5-recovery-reclaim-spec.md`

v6.1 is a development event-diagnosis layer rather than a new classifier-threshold preregistration; its executable and durable output are listed above/below for regression only.

### Durable development regression anchors

There is no separate standalone `fixtures/` directory for the v6 lifecycle. The durable versioned development outputs themselves are the regression anchors, together with the workflow inline contract assertions:

- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-distribution-absorption.json`
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-1-event-diagnosis.json`
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-2-failure-transition.json`
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-3-delayed-failure.json`
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-4-durable-failure.json`
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-5-recovery-reclaim.json`

Important frozen contracts already encoded in the workflow assertions include:

- v6.1: exactly `10` frozen fragile events plus the `2449` timeline contract;
- v6.2: exactly `10` fragile events, valid methodology identity, forward transition date, price-failure trigger, and supply-confirmation trigger;
- v6.4: frozen 3-session persistence contract with `required_broken_votes=2` and `required_supply_votes=1`;
- v6.5: exactly `5` frozen durable candidates; reclaim cannot start before session 4 and only accepted statuses are the frozen reclaim statuses.

### Existing development regression/contract workflows

- `.github/workflows/research-institutional-withdrawal-v6-1-event-diagnosis.yml`
- `.github/workflows/research-institutional-withdrawal-v6-2-failure-transition.yml`
- `.github/workflows/research-institutional-withdrawal-v6-3-delayed-failure.yml`
- `.github/workflows/research-institutional-withdrawal-v6-4-durable-failure.yml`
- `.github/workflows/research-institutional-withdrawal-v6-5-recovery-reclaim.yml`

These workflows are historical development runners and some still contain legacy push/checkpoint patterns. For the pre-outcome regression gate, use their inline **validation assertions as the expected contract**; do not blindly dispatch old write-producing workflows merely to prove regression. Prefer bounded local/temp-output replay or a new non-writing regression harness that invokes the exact frozen analyzers and compares contract fields while keeping holdout outcomes unopened.

Evidence locating these canonical files includes:

- `943ceb682a461c8e68b28ca5f9611a2f20023841` — added v6 distribution/absorption analyzer;
- `190e936b661d1342db02c5146555c0a04994f630` — added v6.1 event diagnosis analyzer;
- `9ba205ab6904ea0bb8be87d1296c47aee6e3e989` — added v6.2 failure transition analyzer;
- `8c990a735e210c08a8c34845ad262bb642df3beb` — added v6.3 delayed failure analyzer;
- `f11382447f150c29c6f5cda2c419544c18974b64` — added v6.4 durability analyzer;
- `61f1fee575f1fdb317543bd3712f527ec781a34d` — added v6.5 recovery/reclaim analyzer.

---

## Entry points

Read first:

- `AGENTS.md`;
- `docs/project-philosophy.md`;
- `docs/roadmap/current-phase.md`;
- `data_research/institutional-flow/validation-plan-v1.md`;
- this handoff.

Frozen lifecycle implementation and regression entry points are the exact paths in **Frozen lifecycle executable contract and regression anchors** above. Start there; broad code-search rediscovery is unnecessary unless independently verifying those paths.

Coverage/audit regression entry points:

- `scripts/audit_histock_broker_source_empty_checkpoints.js`;
- `scripts/plan_institutional_withdrawal_validation_expansion_v1.js`;
- `scripts/plan_institutional_withdrawal_validation_broker_batches_v1.js`;
- `scripts/plan_institutional_withdrawal_validation_coverage.js`;
- `scripts/test_histock_broker_status_policy_regressions.js`;
- `.github/workflows/validate-institutional-withdrawal-recovery-contract-v1.yml`.

---

## Known caveats

- Historical TDCC remains association-only, not exact historical publication-time no-lookahead evidence.
- HiStock response-byte baselines are stock/page dependent; absolute bytes alone do not classify degradation.
- `source_rows_incomplete` means unusable exact-date Broker coverage, not no Broker activity.
- The five frozen holdout stock identities are now preregistered and must not be changed after outcomes are opened.
- The frozen Batch 1 sample may ultimately contain few or no resolved durable-failure events; that is a valid validation result and must not trigger post-hoc stock addition.
- Promotion requires the preregistered minimum evidence in `validation-plan-v1.md`; failure to reach those event counts or directional gates is not permission to retune v6.0–v6.5 on the same holdout.
- v6.1 contains development future-outcome diagnosis. It is a regression anchor only; do not import its outcome labels into holdout classification.

---

## Next round

**Do not start automatically. Begin only when the repository owner explicitly sends Prompt A below or otherwise explicitly asks to continue.**

Next objective: **run the first separate untouched outcome-validation implementation round on frozen stock-holdout Batch 1 (`1598,1616,1809,6257,7791`) using the frozen lifecycle and preregistered outcome clock/metrics.**

Ordered boundary:

1. Re-read rules, preregistration, and this frozen-sample handoff.
2. Verify current `main` has not changed the frozen sample evidence or methodology.
3. Reconfirm the five-stock sample exactly; do not rerun coverage to add/remove stocks based on outcomes.
4. Use the exact frozen analyzers, specs, durable development anchors, and workflow contract assertions listed above; do not spend time locating them again. Prove frozen development regressions still pass before opening holdout outcomes.
5. Implement or execute the minimum validation pipeline required by `validation-plan-v1.md` for Batch 1.
6. Keep lifecycle classification inputs outcome-free; calculate outcomes only after lifecycle resolution.
7. Generate stock-holdout validation outputs separately from any development or time-holdout evidence.
8. Do not tune thresholds, add stocks, drop adverse events, compress missing sessions, or reinterpret incomplete Broker rows after results are visible.
9. Stop after one bounded outcome-validation implementation round and apply Prompt B. Do not promote a production strategy in the same round.

---

## Prompt A — Next-round implementation prompt

```text
Continue the Institutional Withdrawal Validation work in repository `EasonLiu0913/stock_data`.

This is a NEW evidence phase: the outcome-blind stock-holdout sample was already frozen in the prior Prompt B closeout. Do not reopen sample construction based on observed outcomes.

Before implementation or outcome inspection:

1. Read repository-level instructions in `AGENTS.md`.
2. Read `docs/project-philosophy.md`.
3. Read `docs/roadmap/current-phase.md`.
4. Read `data_research/institutional-flow/validation-plan-v1.md`.
5. Read the canonical handoff at `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`.
6. Verify current `main` still matches the frozen sample boundary, evidence commit/blobs, methodology, and assumptions recorded there.
7. Verify the frozen stock-holdout Batch 1 is exactly:
   `1598,1616,1809,6257,7791`.
8. Before opening holdout outcomes, verify frozen development-regression behavior and ensure no v6.0–v6.5 rule has changed since sample freeze.

Do not search broadly for the frozen lifecycle entry points; their exact locations are already known. Start with these executable files:

- `scripts/analyze_institutional_withdrawal_v6_distribution_absorption.js` — canonical v6 `classify(row)` structure classifier;
- `scripts/analyze_institutional_withdrawal_v6_1_events.js` — development-only diagnosis/expected-event anchor; its future-outcome labels are NOT validation classifier inputs;
- `scripts/analyze_institutional_withdrawal_v6_2_failure_transition.js` — frozen immediate failure transition;
- `scripts/analyze_institutional_withdrawal_v6_3_delayed_failure.js` — frozen delayed failure;
- `scripts/analyze_institutional_withdrawal_v6_4_durable_failure.js` — frozen durability confirmation;
- `scripts/analyze_institutional_withdrawal_v6_5_recovery_reclaim.js` — frozen recovery/reclaim confirmation.

Read the exact preregistered specs:

- `data_research/institutional-flow/v6-distribution-absorption-spec.md`;
- `data_research/institutional-flow/v6-2-failure-transition-spec.md`;
- `data_research/institutional-flow/v6-3-delayed-failure-spec.md`;
- `data_research/institutional-flow/v6-4-durable-failure-spec.md`;
- `data_research/institutional-flow/v6-5-recovery-reclaim-spec.md`.

Use these durable development outputs as regression anchors:

- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-distribution-absorption.json`;
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-1-event-diagnosis.json`;
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-2-failure-transition.json`;
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-3-delayed-failure.json`;
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-4-durable-failure.json`;
- `data_research/institutional-flow/backtests/institutional-withdrawal-v6-5-recovery-reclaim.json`.

The existing workflow files contain the development output-contract assertions. In particular inspect:

- `.github/workflows/research-institutional-withdrawal-v6-1-event-diagnosis.yml`;
- `.github/workflows/research-institutional-withdrawal-v6-2-failure-transition.yml`;
- `.github/workflows/research-institutional-withdrawal-v6-3-delayed-failure.yml`;
- `.github/workflows/research-institutional-withdrawal-v6-4-durable-failure.yml`;
- `.github/workflows/research-institutional-withdrawal-v6-5-recovery-reclaim.yml`.

Do not blindly dispatch those historical write-producing workflows for the gate. Reproduce the frozen development contracts in a bounded non-writing/temp-output replay or a dedicated non-writing regression harness. Required anchors include v6.1 fragile_event_count=10, v6.2 events=10 with valid trigger invariants, v6.4 3-session persistence with required_broken_votes=2 and required_supply_votes=1, and v6.5 durable candidates=5 with reclaim starting no earlier than session 4. If current main cannot reproduce the frozen development contracts, STOP before reading holdout future outcomes and fix only the regression/executable-contract gap without retuning methodology.

Preserve all frozen v6.0–v6.5 thresholds, weights, lifecycle definitions, validation gates, feature semantics, development-stock exclusions, source-derived calendar rules, TDCC historical caveats, missing-session rules, and strict Broker completeness semantics.

Do not use `data_history_sma/trading_days.json` as the research calendar.

Do not add/remove holdout stocks after outcomes are visible. Do not extend Batch 1 because TDCC/Broker queues remain non-empty. Do not use development stocks in untouched stock-holdout statistics.

Implement or execute only the minimum preregistered untouched outcome-validation pipeline required by `validation-plan-v1.md`:

- run the frozen lifecycle classifier on each frozen holdout stock using contemporaneous/current-or-prior evidence only;
- classifier inputs must not include future returns, future drawdowns, structural-repair outcomes, or any validation outcome field;
- preserve the lifecycle resolution definitions for `failure_plus_reclaim` and `failure_plus_no_reclaim`;
- start the outcome clock on the next source-derived trading session after resolution;
- compute preregistered 20-session and 30-session returns, maximum drawdowns, negative-return indicators, and 30-session structural-repair outcome;
- preserve missing OHLCV sessions as gaps; never compress or impute them;
- mark incomplete follow-up as `unresolved_for_metric` only for the affected metric;
- report `failure_plus_reclaim` and `failure_plus_no_reclaim` separately;
- bootstrap 95% between-group confidence intervals only when both groups have enough observations for meaningful resampling;
- keep Batch 1 stock-holdout results separate from development and any future time-holdout results.

If output files are created, use the preregistered canonical paths where appropriate:
- `data_research/institutional-flow/validation/validation-outcomes-v1.json`
- `data_research/institutional-flow/validation/validation-metrics-v1.json`

Record enough methodology/sample identity in outputs to prove they were generated from the frozen five-stock Batch 1 and frozen methodology. Do not let generated outcome files feed back into classifier logic or stock selection.

Run frozen development regressions and outcome-pipeline tests before accepting the result. If implementation disagrees with frozen development cases, fix implementation; do not change frozen rules.

Do not promote or modify any production strategy in this round. Do not retune after seeing holdout results.

After this one bounded implementation round finishes, stop and wait for Prompt B closeout/verification. Do not update the next handoff package before Prompt B independently reviews this outcome-validation round.
```

---

## Prompt B — Next-round closeout / verification prompt

```text
The first untouched Institutional Withdrawal stock-holdout outcome-validation implementation round has finished.

Do not start another validation, tuning, coverage, or production-promotion round yet.

Perform the mandatory phase-closeout review according to the latest `AGENTS.md`, preregistration, and canonical handoff.

Before reviewing result values:

1. Re-read `AGENTS.md`.
2. Re-read `docs/project-philosophy.md`.
3. Re-read `docs/roadmap/current-phase.md`.
4. Re-read `data_research/institutional-flow/validation-plan-v1.md`.
5. Re-read `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`.
6. Verify current `main` and identify every implementation/data/workflow commit and Actions run created by Prompt A.
7. Verify the frozen Batch 1 stock identities are still exactly `1598,1616,1809,6257,7791` and were not modified after outcomes were opened.

First verify anti-leakage and frozen-method invariants independently of whether the results look favorable:

- no v6.0–v6.5 threshold, weight, lifecycle definition, validation gate, feature semantic, development-stock exclusion, or Broker completeness rule changed after sample freeze;
- the research calendar remained source-derived from valid TWSE foreign-investor files and never used `data_history_sma/trading_days.json`;
- the lifecycle classifier consumed no future return, drawdown, structural-repair outcome, or validation metric field;
- development stocks did not enter untouched stock-holdout statistics;
- no holdout stock was added, removed, substituted, or selectively excluded because of its observed outcome;
- historical TDCC caveats remained explicit;
- missing OHLCV sessions were not compressed or imputed;
- `source_rows_incomplete` Broker evidence was not zero-imputed or relaxed into success.

Re-run/independently verify the frozen development regression contract using the exact paths already recorded in the handoff, not broad rediscovery. At minimum compare the current executable chain:

- `scripts/analyze_institutional_withdrawal_v6_distribution_absorption.js`;
- `scripts/analyze_institutional_withdrawal_v6_2_failure_transition.js`;
- `scripts/analyze_institutional_withdrawal_v6_3_delayed_failure.js`;
- `scripts/analyze_institutional_withdrawal_v6_4_durable_failure.js`;
- `scripts/analyze_institutional_withdrawal_v6_5_recovery_reclaim.js`

against the durable development anchors under `data_research/institutional-flow/backtests/institutional-withdrawal-v6*.json` and the explicit output-contract assertions in `.github/workflows/research-institutional-withdrawal-v6-*.yml`. Treat `scripts/analyze_institutional_withdrawal_v6_1_events.js` and `institutional-withdrawal-v6-1-event-diagnosis.json` as development diagnosis/regression anchors only; verify their future-outcome labels did not leak into holdout classification.

Recheck the protected `1598 / 2026-05-07` HiStock regression and five protected `7791` incomplete-source dates so outcome work did not regress source semantics.

Then inspect the generated validation artifacts and implementation contract:

- sample identity/version is explicit and equals the frozen five-stock Batch 1;
- methodology/version identity is explicit and matches frozen `institutional-withdrawal-lifecycle-v1` / v6.0–v6.5;
- every lifecycle event is traceable to contemporaneous evidence and a source-derived session index;
- resolution date follows the preregistered reclaim/no-reclaim definitions;
- each outcome window starts on the next source-derived session after resolution;
- 20D/30D returns and maximum drawdowns use exactly the preregistered session windows;
- incomplete follow-up becomes `unresolved_for_metric` only for the affected denominator;
- no missing session is skipped merely to complete a horizon;
- structural repair is descriptive outcome evidence only and is never fed back into classification;
- group metrics are computed separately for `failure_plus_reclaim` and `failure_plus_no_reclaim`;
- bootstrap confidence intervals are emitted only when meaningful under the preregistered rule;
- stock-holdout results remain separate from development/time-holdout results.

Independently recompute or spot-check representative lifecycle/outcome rows and aggregate denominators from source data. Inspect at least one early, middle, and late resolved event if enough events exist; if fewer exist, inspect all resolved events.

Assess the preregistered validation result without tuning:

- report resolved durable-failure event N;
- report reclaim vs no-reclaim N;
- report the preregistered 20D/30D return, drawdown, negative-return, structural-repair comparisons;
- state whether the minimum production-promotion event-count gate is met;
- state whether each preregistered directional criterion passes, fails, or is underpowered/unresolved;
- if the gate fails or is underpowered, record that result as evidence and do not tune v6.0–v6.5 on this holdout.

If any leakage, sample mutation, frozen-rule change, incorrect outcome clock, denominator bug, session compression, missing-event exclusion, or traceability failure is found:

- DO NOT close the phase;
- DO NOT produce the following round's paired prompts yet;
- fix only the bounded implementation defect without changing frozen methodology/sample membership;
- regenerate only affected validation artifacts;
- repeat this entire Prompt B verification.

Only after closeout passes:

1. update `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md` with exact commits/runs, sample identity, methodology identity, event counts, validation findings, failures/uncertainty, entry points, and next evidence-driven objective;
2. prepare Prompt A(N+1) and phase-specific Prompt B(N+1) before another implementation begins;
3. commit the handoff to `main`;
4. re-fetch current `main` and verify no later workflow/data commit made the handoff stale;
5. respond with the closeout summary, final handoff commit SHA, validation conclusion, and both next prompts.

Do not begin tuning or production promotion unless the repository owner explicitly asks to continue and the preregistered promotion gate supports it.
```