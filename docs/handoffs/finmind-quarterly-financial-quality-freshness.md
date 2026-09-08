# FinMind Quarterly Financial Quality Freshness

Canonical handoff: `docs/handoffs/finmind-quarterly-financial-quality-freshness.md`

## Current phase

Completed round: `due-pending-refresh-and-master-rebuild-v1`

Completed round state: **Prompt B closeout: PASS**

Active round: `first-real-refresh-proof-v1`

Round state: **Prompt A preregistered / not started**

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

## Prompt B closeout — due-pending-refresh-and-master-rebuild-v1

**Prompt B closeout: PASS**

Closeout was performed against current remote `main`, using the Prompt B preregistered before Prompt A began.

### Acceptance results

1. **Due-pending semantics — PASS**
   - `coverageFreshnessDecision(...)` preserves future pending coverage, marks due pending stale, keeps truly complete matching coverage reusable, and fails missing/corrupt state safe toward refresh.
   - Deterministic cases are locked in `tests/finmind_quarterly_freshness.test.js`.

2. **Anti-lookahead — PASS**
   - A stored `pending_not_yet_available` row is not stale until `conservative_known_date <= as_of_date`.
   - The scheduled workflow resolves an explicit `as_of_date`; scheduled default is `TZ=Asia/Taipei date +%F`, and the same value is passed through planning and refresh jobs.
   - No production FQ source row becomes known before its stored conservative known date.

3. **Bounded refresh — PASS**
   - `.github/workflows/refresh-finmind-quarterly-financial-quality-due.yml` plans locally before API work.
   - The due queue is capped by `max_due_stocks` (default 5).
   - Refresh jobs target exact planned stock IDs, use fresh runners, and enforce `max-parallel: 1`.
   - Each selected stock performs a one-request quota preflight; no due stocks take the `no-op` job and consume no FinMind API quota.
   - Existing manual `.github/workflows/backfill-finmind-quarterly-financial-quality-batch.yml` remains available.

4. **Propagation — PASS**
   - `rebuild-master` runs only after the completed refresh wave succeeds.
   - `scripts/build_financial_quality_master.js` is run once for the initial wave rebuild, then re-run only inside bounded latest-main push-retry attempts to avoid publishing a stale merge base.
   - `scripts/verify_financial_quality_master_propagation.js` verifies refreshed rows before commit and again after resetting to remote `main`.
   - Push exhaustion fails the job; a green-but-stale master is not accepted by the new workflow contract.
   - `tests/financial_quality_master_propagation.test.js` covers missing quarter, stale known date, and stale score failures.

5. **Production invariants — PASS**
   - The Prompt A implementation range from `70077cce846891f07515e03c21c18bf78e6dc400` through `9e4cd0e3685562b56fa4b3c86e450805197d73b2` did not modify production strategy/FAS/FQ consumer files.
   - FAS >= 8, FQ >= 10, `two_stage_fundamental_quality_direct_entry_v1`, and next-close execution semantics remain unchanged.
   - Frozen 8021 regression remains part of the final passing Node suite.

6. **CI — PASS**
   - Final implementation SHA: `9e4cd0e3685562b56fa4b3c86e450805197d73b2`.
   - `[99 測試] Node Regression Suite` run `34111883168`: **SUCCESS**.
   - Job `101710901122` (`Node regression tests`): **SUCCESS**.
   - Job `101710900956` (`排程時間摘要`): **SUCCESS**.
   - The earlier scheduled-output registry failure was fixed before this final passing SHA.

7. **Real refresh evidence — PASS WITH BOUNDED ROLLOUT REQUIREMENT**
   - No real FinMind refresh run is claimed.
   - The current connector does not expose GitHub workflow dispatch, so Prompt B cannot safely start a secret-backed real refresh itself.
   - As of the 2026-09-08 closeout check, the repository's recent Actions runs also contain no observed run for `.github/workflows/refresh-finmind-quarterly-financial-quality-due.yml` around its first expected 09:35 Asia/Taipei schedule; other scheduled workflows did run in the same general period.
   - Per the preregistered Prompt B rule, absence of dispatch/secret permission does not fail this implementation round by itself. Production rollout remains **not fully proven** until one bounded real run is independently verified.

8. **Durability / concurrent changes — PASS**
   - Routing still has exactly one active task: `finmind-quarterly-financial-quality-freshness`.
   - Current remote `main` advanced through unrelated market/news/data commits after Prompt A.
   - Comparing the final implementation SHA with later remote state shows no FinMind freshness, financial-quality propagation, strategy-invariant, or task-routing changes that stale this closeout.
   - Required implementation/test/handoff files remain durable on remote `main`.

### Closeout decision

The implementation round is closed successfully. The project is **not yet production-rollout-complete** because one bounded real refresh wave still needs durable run/job/output/master evidence.

A narrowly scoped next round is therefore justified: `first-real-refresh-proof-v1`.

That round must not redesign the implementation. Its only purpose is to obtain and verify one real bounded scheduled/manual refresh (or a genuine no-op run if no stocks are due), diagnose any first-run plumbing defect, and prove remote durability.

## Active round — first-real-refresh-proof-v1

### Objective

Obtain the first real GitHub Actions execution evidence for:

`.github/workflows/refresh-finmind-quarterly-financial-quality-due.yml`

and prove the production path is operational without expanding scope.

### Frozen constraints

- Do not change FAS >= 8, FQ >= 10, strategy id, signal-day semantics, or next-close execution policy.
- Do not refetch the full universe.
- Keep `max_due_stocks <= 5`; prefer `1` for a manually dispatched proof.
- Do not bypass FinMind quota/token preflight.
- Do not fabricate a real run when workflow-dispatch/secret permission is unavailable.
- A legitimate scheduled no-op run is acceptable evidence that scheduling/planning works, but it does not prove API write/master propagation; if due work exists, prefer one real due stock.
- Fix only first-run plumbing defects proven by the real run.

### Prompt A completion contract — first-real-refresh-proof-v1

Prompt A is complete only when one of these bounded evidence paths is durable:

**Path A — due work exists**
1. A real run of `.github/workflows/refresh-finmind-quarterly-financial-quality-due.yml` is identified.
2. Planned due count / selected stock IDs are recorded.
3. At most 5 stocks are selected; prefer 1 for manual proof.
4. Refresh job(s), bounded checkpoint(s), master rebuild, durable remote propagation verification, and final workflow conclusion all succeed.
5. The refreshed per-stock paths, batch-status path, canonical master, resulting remote-main commit(s), run ID, and job IDs are recorded in this handoff.
6. 8021/strategy invariants remain unchanged.

**Path B — no due work exists**
1. A real scheduled/manual workflow run is identified.
2. Plan reports `selected_count=0`.
3. No refresh/master writer job consumes FinMind API quota.
4. No-op job succeeds.
5. Run ID/job evidence is recorded.
6. Because API write/master propagation was not exercised, the project moves to monitor-only rather than claiming a real write-path proof.

If no real run can be started or observed because permissions/scheduling evidence remain unavailable, record the blocker and do **not** report Prompt A complete.

## Prompt A — first-real-refresh-proof-v1

Execute only round `first-real-refresh-proof-v1` from this handoff.

Startup:
1. Fetch current remote `main`.
2. Read `AGENTS.md`, `docs/agent-prompts/task-routing.json`, and this handoff.
3. Verify `finmind-quarterly-financial-quality-freshness` is still the unique active project.
4. Inspect `.github/workflows/refresh-finmind-quarterly-financial-quality-due.yml` and the latest Actions history.
5. Do not modify implementation unless a real first-run failure proves a bounded plumbing defect.

Execution:
- First look for an already completed scheduled/manual run of the workflow.
- If a real run exists, inspect plan/refresh/rebuild/no-op jobs and durable remote outputs.
- If no run exists and workflow-dispatch permission is available, dispatch one bounded proof with `max_due_stocks=1` and an explicit current Asia/Taipei `as_of_date`.
- If dispatch permission is unavailable, do not simulate or fabricate the run; record the blocker and stop without claiming completion.
- If the real run exposes a bounded workflow defect, fix only that defect, run relevant regression, and repeat the same bounded proof.
- Preserve all frozen production invariants.

Before completion:
- update this handoff with run ID, job IDs, selected stock(s), durable commits/paths, master/no-op evidence, and any bounded fix;
- re-fetch current remote `main`;
- report exactly `Prompt A complete — ready for Prompt B` only if the completion contract above is actually satisfied.

## Preregistered Prompt B — first-real-refresh-proof-v1

Close out round `first-real-refresh-proof-v1`.

This Prompt B is preregistered before that Prompt A starts.

Verify independently:

1. Current remote `main`, routing, and handoff identity are fresh.
2. The cited run is genuinely `.github/workflows/refresh-finmind-quarterly-financial-quality-due.yml`, not another FinMind workflow.
3. Run event, head SHA, conclusion, and relevant job IDs are recorded.
4. The plan was bounded:
   - selected_count <= 5;
   - manual proof should normally use 1;
   - exact selected stock IDs are known.
5. If due work ran:
   - each refresh job passed quota preflight;
   - durable per-stock and due-refresh status paths exist on remote `main`;
   - bounded checkpoint push succeeded;
   - rebuild-master ran only after refresh success;
   - canonical master contains the refreshed timeline rows;
   - final remote propagation verification passed.
6. If it was a no-op:
   - selected_count=0;
   - refresh and rebuild writer jobs did not run;
   - no-op succeeded;
   - no FinMind API quota was consumed by the workflow.
7. Production invariants and 8021 regression remain unchanged.
8. Any first-run fix is bounded, tested, durable, and does not weaken race/quota/anti-lookahead guarantees.
9. Classify concurrent changes and verify final evidence remains current.

If any criterion fails, repair only the bounded first-run defect and restart this Prompt B from criterion 1.

If all criteria pass:
- record `Prompt B closeout: PASS`;
- decide whether the project is production-proven or monitor-only based on whether the write/master path was actually exercised;
- update/commit this handoff;
- do not invent another implementation round unless new evidence requires one;
- re-fetch remote `main` and verify durable closeout;
- stop.

## Safety / stop conditions

- Do not expand into a generic financial-data scheduler.
- Do not change model thresholds because 8021 happened to perform well.
- Do not use 2026Q2 values before their conservative known date in historical replay.
- Do not claim a real API refresh occurred unless durable workflow/API evidence proves it.
- Do not mark this round complete from a green CI alone if master propagation or remote persistence is unverified.


## Prompt A blocker evidence — first-real-refresh-proof-v1 — 2026-09-08

Prompt A is **not complete**.

Current verification against remote `main` established:

- `docs/agent-prompts/task-routing.json` still routes the unique active task to `finmind-quarterly-financial-quality-freshness`.
- The target workflow remains `.github/workflows/refresh-finmind-quarterly-financial-quality-due.yml`.
- The available GitHub connector in this agent session does not expose workflow dispatch and does not expose a list-runs operation for this workflow, so a bounded manual proof cannot be started and an existing run cannot be authoritatively enumerated from the connector.
- Public web lookup did not surface a verifiable run for this repository/workflow and therefore is not accepted as run evidence.
- Current remote batch-status directory contains only legacy `dual-track-batch*.json` files and no `due-refresh-2026-09-08-<stock>.json` durable status artifact.
- Representative stock `8021` still has coverage generated at `2026-08-10T02:37:25.233Z`, with `2026Q2` recorded as `pending_not_yet_available` and `conservative_known_date=2026-08-14`.
- Representative stock `8021` timeline still ends at `2026Q1`.

Per the preregistered Prompt A contract, lack of a real observable/dispatchable workflow run is a hard completion blocker. Do not report `Prompt A complete — ready for Prompt B` until a real run is observed and the applicable Path A or Path B evidence is durable.
