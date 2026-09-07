# FinMind Quarterly Financial Quality Freshness

Canonical handoff: `docs/handoffs/finmind-quarterly-financial-quality-freshness.md`

## Current phase

Active round: `due-pending-refresh-and-master-rebuild-v1`

Round state: **Prompt A complete / ready for Prompt B**

Global routing task id: `finmind-quarterly-financial-quality-freshness`

## Objective

Close the proven production freshness gap where a FinMind quarterly financial-quality coverage file can be created before a quarter's conservative availability date, record that quarter as `pending_not_yet_available`, and then remain permanently treated as complete after the pending date passes.

The round is complete only when due pending quarters can be refreshed automatically and the refreshed per-stock timeline is propagated into the canonical production input:

`data_prediction_analysis/quarterly-financial-quality/financial-quality-master.json`

without changing the proven FAS/FQ strategy thresholds or introducing look-ahead.

## Evidence already established

### 8021 regression case

The August 2026 monthly-revenue stale-artifact defect was fixed separately and is not part of this round.

Durable evidence:

- `cc14223c7df18e51f5ee64da28de0eec2107a6aa` — stale monthly-signal refresh logic.
- `b120e0bec4cc906faf6e840242b5410ce8ed91ff` — stale-artifact regression tests.
- `bd16f426029e01c8ab6bc4ad81f4e51ec0cd09ba` — 202608 monthly-signal rebuild, 3 → 121 events.
- `977f34e443e0c164eac6863268f54c9f426cbb0f` — 8021 point-in-time regression fixture.
- GitHub Actions `[99 測試] Node Regression Suite #2`, run id `34109353194`: PASS.
- 8021 signal semantics are frozen for this round:
  - 202608 FAS = 8.
  - latest-known production FQ on 2026-09-07 is 2026Q1, FQ = 12.
  - signal day = 2026-09-07.
  - production execution day under the current next-close policy = 2026-09-08.

Do not reinterpret or change these dates/thresholds in this round.

### Proven quarterly freshness defect

`data_finmind_quarterly_financial_quality/8021/coverage-status.json` was generated on 2026-08-10 and contains:

- requested end quarter: `2026Q2`
- missing `2026Q2`
- `conservative_known_date: 2026-08-14`
- reason: `pending_not_yet_available`

As of 2026-09-07 this pending date has passed, but the durable 8021 timeline still ends at 2026Q1.

Current root cause in:

`scripts/backfill_finmind_quarterly_financial_quality_batch.js`

Function:

`coverageMatches(stockId, startQuarter, endQuarter)`

currently treats a stock as complete when:

1. coverage requested start/end quarters match; and
2. the timeline file exists.

It does **not** invalidate a coverage record whose `pending_not_yet_available` row has become due.

A second automation gap exists in:

`.github/workflows/backfill-finmind-quarterly-financial-quality-batch.yml`

The workflow is currently `workflow_dispatch` only.

A third propagation risk must be closed:

`scripts/build_financial_quality_master.js`

is the canonical builder for:

`data_prediction_analysis/quarterly-financial-quality/financial-quality-master.json`

A due-quarter refresh is not production-complete if only per-stock source/timeline files are updated but the master remains stale.

## Frozen decisions / constraints

1. Preserve anti-lookahead. A quarter must never be considered known before its stored `conservative_known_date`.
2. Do not change:
   - FAS threshold `>= 8`;
   - FQ threshold `>= 10`;
   - `two_stage_fundamental_quality_direct_entry_v1`;
   - next-close production execution policy.
3. Do not refetch all 551 candidates merely because one or a few pending quarters become due.
4. Do not add a generic scheduler, DAG engine, plugin system, or new shared framework.
5. Keep the solution domain-specific to FinMind quarterly financial-quality freshness unless repeated evidence requires a shared abstraction.
6. Manual `workflow_dispatch` must remain supported.
7. Respect FinMind quota protections already present in the workflow. A scheduled refresh must not blindly reserve/consume a full batch worth of requests when no stocks are due.
8. Never treat `pending_not_yet_available` as a failure before its conservative known date.
9. Once its conservative known date is on or before the run's `as_of_date`, that pending row is stale coverage and must become eligible for refresh.
10. Durable completion means remote `main`, not a green runner alone.

## Exact entry points

### Runtime / data

- `scripts/backfill_finmind_quarterly_financial_quality.js`
  - owns per-stock quarter fetch, conservative availability dates, and coverage output.
- `scripts/backfill_finmind_quarterly_financial_quality_batch.js`
  - owns candidate batching, `coverageMatches(...)`, per-stock skip/refetch behavior, and timeline generation.
- `scripts/generate_financial_quality_score_timeline.js`
  - rebuilds per-stock FQ timelines.
- `scripts/build_financial_quality_master.js`
  - rebuilds canonical `financial-quality-master.json`.
- `.github/workflows/backfill-finmind-quarterly-financial-quality-batch.yml`
  - current quota-guarded writer workflow; manual only at this checkpoint.
- `data_finmind_quarterly_financial_quality/8021/coverage-status.json`
  - frozen representative stale-pending fixture.
- `data_finmind_quarterly_financial_quality/8021/financial-quality-score-timeline.json`
  - representative timeline currently ending at 2026Q1.
- `data_prediction_analysis/quarterly-financial-quality/financial-quality-master.json`
  - production-consumed master.
- `scripts/two_stage_fundamental_quality_signal.js`
  - production FAS/FQ consumer; protected unless a minimal compatibility fix is proven necessary.
- `scripts/sync_fundamental_signal_metadata.js`
  - production metadata/pool consumer; protected in this round.

### Existing tests / CI

- `tests/mops_quarterly_financial_quality.test.js`
- `tests/fundamental_quality_8021_regression.test.js`
- `.github/workflows/test-node-regression-suite.yml`

## Active round — due-pending-refresh-and-master-rebuild-v1

### Prompt A completion contract

Prompt A is complete only when all of the following are durable on remote `main`:

1. Due-pending coverage semantics are implemented and deterministic.
2. Tests prove:
   - pending date in the future => existing coverage remains reusable/skippable;
   - pending date equal to or before `as_of_date` => coverage is stale and the stock is eligible for refresh;
   - no pending rows + matching range + timeline present => remains reusable;
   - missing/corrupt coverage/timeline remains safely refreshable.
3. Scheduled automation exists, but it is bounded to genuinely due work. Do **not** implement a cron that blindly runs/refetchs all candidates.
4. Existing FinMind quota guard is preserved and scheduled no-op behavior is cheap.
5. After any refreshed stock timelines are written, `scripts/build_financial_quality_master.js` is run once for the completed refresh wave and its output is included in the durable write set.
6. Workflow validation must fail if refreshed per-stock timelines are durable but the rebuilt master is missing/stale relative to those refreshed outputs.
7. The existing 8021 signal regression remains green and no production strategy threshold/date semantics change.
8. Canonical handoff is updated with implementation commit(s), tests, workflow run evidence if available, changed-file set, and any remaining known limitation.
9. Re-fetch current remote `main` and verify the expected files/markers are durable.
10. Report exactly: **“Prompt A complete — ready for Prompt B”** and stop. Do not execute Prompt B.

If a real FinMind refresh run is available and safe within quota, use a bounded run to prove the path. If repository/tool permissions do not permit dispatching such a run, do not fabricate evidence: complete deterministic implementation/tests and record the missing real-run evidence for Prompt B to resolve.

## Prompt A — Next-round implementation prompt

Execute round `due-pending-refresh-and-master-rebuild-v1` from this canonical handoff.

Before modifying anything:

1. Fetch current remote `main`; do not reuse prior local/chat state.
2. Read `AGENTS.md`.
3. Read `docs/agent-prompts/task-routing.json` and verify this project is the unique active task.
4. Read `docs/project-philosophy.md` and `docs/roadmap/current-phase.md`.
5. Read this canonical handoff:
   `docs/handoffs/finmind-quarterly-financial-quality-freshness.md`
6. Re-read the exact entry points listed above.
7. Verify current remote still contains the frozen 8021 regression evidence and that no concurrent change has already solved or materially changed this defect.

Implement only the bounded quarterly-FQ freshness round described here.

Required behavior:

- Replace the current simplistic completion check in `scripts/backfill_finmind_quarterly_financial_quality_batch.js` with an `as_of_date`-aware freshness decision.
- A stored `pending_not_yet_available` quarter is reusable only while its `conservative_known_date` is later than `as_of_date`.
- Once due, that stock must be eligible for refetch even when requested start/end quarter and timeline file otherwise match.
- Keep fresh completed stocks skipped.
- Preserve unsupported-financial-model handling and existing quota/error semantics.
- Add deterministic regression coverage for future-pending, due-pending, truly-complete, and missing/corrupt cases.
- Add bounded scheduled automation in `.github/workflows/backfill-finmind-quarterly-financial-quality-batch.yml` or a minimal FinMind-specific companion workflow only if that produces a materially safer due-only path.
- Scheduled execution must avoid blind full-universe refetch and avoid unnecessary full-batch quota reservation when no stocks are due.
- Preserve manual dispatch.
- Rebuild `data_prediction_analysis/quarterly-financial-quality/financial-quality-master.json` once after the refresh wave, not once per stock.
- Add a final verification step proving any refreshed per-stock/timeline changes are represented in the rebuilt master before the workflow may report success.
- Do not change production FAS/FQ thresholds, strategy IDs, signal-day semantics, or execution policy.
- Do not modify monthly-revenue signal logic in this round.

Run the relevant deterministic tests, including the 8021 regression. If a bounded real workflow run is available and safe, use it and record run/job/commit evidence. Otherwise explicitly record that real API refresh remains a Prompt B evidence item.

Before declaring completion, update this handoff with durable Prompt A evidence while preserving the exact preregistered Prompt B below.

## Prompt A completion evidence — 2026-09-07

Prompt A implementation is durable on remote `main` and is ready for independent Prompt B closeout.

### Implementation commits

- `fae2f020b67fe2da2d7bf0f45e193f5b77e71362` — make FinMind quarterly coverage freshness `as_of_date` aware.
- `e3043c1f1b3b6658405d4a12fc57904c082ce5b0` — add future-pending / due-pending / complete / corrupt freshness regressions.
- `4ce31114857da6e933f29b4094aaec635429bb8d` — add canonical master propagation verifier.
- `0437c8a337de68c7222339574816bd0bc399bf34` — stabilize bounded due-only execution / per-stock targeting.
- `0aaf2be48e0e14142e068d2b41e7e913317eba27` — expose bounded due queue outputs.
- `d4f2cb594d39a5ad4ea451dd409494a9ec3e9a69` — add FinMind-specific scheduled due refresh workflow.
- `187db01f54bcaf19686175ffa8f3dbb296965dd8` — normalize the new workflow to the repository-managed schedule-summary contract.
- `ee4fce4ef8e9b00958abdb977d308c3afbc3d274` — add fail-fast master propagation regressions.
- `95aa63ae48d1e4d9d0bc418a13bb6f88b2d07761` — register scheduled FinMind refresh in the scheduled-output audit.
- `9e4cd0e3685562b56fa4b3c86e450805197d73b2` — lock the scheduled-output registry regression.

### Durable changed-file set for this round

- `scripts/backfill_finmind_quarterly_financial_quality_batch.js`
- `scripts/verify_financial_quality_master_propagation.js`
- `.github/workflows/refresh-finmind-quarterly-financial-quality-due.yml`
- `scripts/audit_scheduled_workflow_outputs.js`
- `tests/finmind_quarterly_freshness.test.js`
- `tests/financial_quality_master_propagation.test.js`
- `tests/audit_scheduled_workflow_outputs.test.js`
- this canonical handoff

Concurrent data-only commits under `data_fubon/` and unrelated scheduled collection outputs were observed while Prompt A was running. They were classified as unrelated and do not alter this round's FinMind freshness assumptions.

### Implemented behavior

1. Coverage reuse is now deterministic and `as_of_date` aware.
   - A `pending_not_yet_available` quarter remains reusable only while its stored `conservative_known_date` is later than `as_of_date`.
   - On or after that date the coverage becomes stale and the stock is eligible for refresh.
   - Matching complete coverage remains reusable.
   - Missing/corrupt coverage or missing timeline fails safe toward refresh.
2. Scheduled automation is bounded and FinMind-specific.
   - A local planner determines genuinely due stocks before API work.
   - The scheduled wave is capped by `max_due_stocks`.
   - Each selected stock runs on an independent fresh runner with `max-parallel: 1`.
   - No due stocks => cheap no-op with no FinMind API quota consumption.
   - Existing FinMind token/quota checks remain in force.
3. Durable writes are race-safe and bounded.
   - Per-stock refreshed data/status are replayed onto the latest remote `main` before push rather than blindly rebasing a stale working tree.
4. The canonical master is rebuilt exactly once after the completed refresh wave.
5. `scripts/verify_financial_quality_master_propagation.js` fails the workflow if a refreshed stock/quarter is missing from the master or if its conservative known date / FQ score does not match.
6. The scheduled-workflow output audit now knows this maintenance workflow and treats its durable contract as the repository-versioned canonical `financial-quality-master.json`.
7. No production FAS/FQ threshold, strategy id, signal-day semantics, monthly-revenue logic, or next-close execution policy was changed.

### Deterministic test / CI evidence

- `[99 測試] Node Regression Suite` run **34110636864** on `0aaf2be48e0e14142e068d2b41e7e913317eba27`: **PASS**.
- A later regression run on `ee4fce4ef8e9b00958abdb977d308c3afbc3d274` correctly exposed that the newly scheduled workflow had not yet been registered in the scheduled-output audit. That was a real CI finding, not ignored.
- The registry defect was fixed in `95aa63ae48d1e4d9d0bc418a13bb6f88b2d07761` / `9e4cd0e3685562b56fa4b3c86e450805197d73b2`.
- Final `[99 測試] Node Regression Suite` run **34111883168** on implementation SHA `9e4cd0e3685562b56fa4b3c86e450805197d73b2`: **PASS**.
- The frozen 8021 regression is included in the Node regression suite and remains green under the final implementation SHA.

### Repository-wide guard classification

Two repository-wide maintenance guards exposed pre-existing state outside this Prompt A scope:

- Node 24 audit reports `.github/workflows/build-tsmc-equipment-demand-dashboard.yml` still using `actions/download-artifact@v6`.
- The workflow-summary normalization audit reports broad pre-existing normalization drift across older workflows. The new `refresh-finmind-quarterly-financial-quality-due.yml` itself is normalized to the current managed summary block.

These are not FinMind freshness implementation failures and were not expanded into this bounded round.

### Real API refresh evidence

No real FinMind API refresh was dispatched from this agent because the available GitHub connector does not expose a workflow-dispatch operation. No API-run evidence is fabricated.

Per the preregistered contract, this does not block Prompt A completion because deterministic implementation and CI evidence are complete. Prompt B must independently verify the bounded real-run requirement if dispatch/secret access is available.

### Prompt A closeout

**Prompt A complete — ready for Prompt B**

## Preregistered Prompt B — Closeout / verification prompt

Close out round `due-pending-refresh-and-master-rebuild-v1`.

This Prompt B was preregistered before Prompt A implementation and must not be rewritten to fit the implementation.

Startup:

1. Fetch current remote `main`.
2. Read `AGENTS.md`.
3. Read `docs/agent-prompts/task-routing.json`; verify this is still the unique active project unless the owner explicitly changed routing.
4. Read this canonical handoff and recover this exact Prompt B from the pre-Prompt-A checkpoint if necessary.
5. Independently inspect current implementations at:
   - `scripts/backfill_finmind_quarterly_financial_quality_batch.js`
   - `.github/workflows/backfill-finmind-quarterly-financial-quality-batch.yml` and any explicitly documented minimal companion workflow
   - `scripts/build_financial_quality_master.js`
   - relevant tests
   - `data_finmind_quarterly_financial_quality/8021/coverage-status.json`
   - `data_prediction_analysis/quarterly-financial-quality/financial-quality-master.json`

Acceptance criteria — all must PASS:

1. **Due-pending semantics**
   - future pending remains reusable;
   - due pending is stale;
   - truly complete coverage remains reusable;
   - missing/corrupt state fails safe toward refresh.
2. **Anti-lookahead**
   - no quarter becomes eligible before its stored conservative known date;
   - `as_of_date` is explicit/deterministic and not replaced by ambiguous runner-local date logic where reproducibility matters.
3. **Bounded refresh**
   - scheduled path does not blindly refetch all candidates;
   - no-op scheduled run is cheap;
   - quota preflight/request accounting is proportional to due work rather than unconditional batch size wherever the implementation can determine due count.
4. **Propagation**
   - refreshed timeline(s) cause exactly one master rebuild per completed refresh wave;
   - final workflow verification proves refreshed rows are represented in `financial-quality-master.json`;
   - green-but-stale-master is impossible under the new workflow contract.
5. **Production invariants**
   - FAS >= 8 unchanged;
   - FQ >= 10 unchanged;
   - `two_stage_fundamental_quality_direct_entry_v1` unchanged in meaning;
   - next-close execution semantics unchanged;
   - 8021 regression remains PASS.
6. **CI**
   - relevant deterministic tests PASS on the implementation SHA;
   - `[99 測試] Node Regression Suite` PASS if its path filters cover the changed files;
   - any specialized workflow test added by Prompt A also PASS.
7. **Real refresh evidence**
   - if Prompt A produced a safe bounded real FinMind run, verify run/job conclusion, refreshed durable paths, master rebuild, and remote-main commit.
   - if no real run was possible because dispatch/secret permissions were unavailable, do not fail solely for lack of tool permission; instead verify deterministic dry-run/fixture evidence and leave a clearly bounded manual real-run requirement before declaring production rollout fully proven.
8. **Durability / concurrent changes**
   - re-fetch current `main`;
   - classify concurrent changes;
   - verify all required implementation/test/handoff files are durable and assumptions are not stale.

If any criterion fails, fix only the bounded defect and restart this same Prompt B from criterion 1. Do not promote another round.

If all criteria pass:

- record `Prompt B closeout: PASS` in this handoff;
- record commit/run/job/test evidence;
- decide from evidence whether the project is complete/monitor-only or whether a narrowly scoped next round is genuinely required;
- only then preregister/promote any next Prompt A + Prompt B;
- commit the handoff and stop.

## Safety / stop conditions

- Do not expand into a generic financial-data scheduler.
- Do not change model thresholds because 8021 happened to perform well.
- Do not use 2026Q2 values before their conservative known date in historical replay.
- Do not claim a real API refresh occurred unless durable workflow/API evidence proves it.
- Do not mark this round complete from a green CI alone if master propagation or remote persistence is unverified.
