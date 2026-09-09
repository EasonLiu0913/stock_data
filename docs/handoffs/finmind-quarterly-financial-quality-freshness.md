# FinMind Quarterly Financial Quality Freshness

Canonical handoff: `docs/handoffs/finmind-quarterly-financial-quality-freshness.md`

## Current phase

Completed round: `backlog-drain-wave-48-v1`

Completed round state: **Prompt B closeout: PASS**

Project state: **production-proven; backlog drain expansion active**

Active round: `backlog-drain-wave-96-v1`

Round state: **Prompt A not started — preregistered paired Prompt A/B**

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


## Prompt A completion evidence — first-real-refresh-proof-v1 — 2026-09-08

Prompt A completion contract is satisfied through **Path A — due work exists**.

### Real workflow identity

- Workflow: `.github/workflows/refresh-finmind-quarterly-financial-quality-due.yml`
- Name: `[07 研究] FinMind－季財報品質到期刷新`
- Run ID: `34191540520`
- Run number: `1`
- Event: `workflow_dispatch`
- Head SHA: `5caf2a3e1b11927e13eff3df725eba3c19804544`
- Started: `2026-09-08T05:40:42Z`
- Completed: `2026-09-08T05:48:31Z`
- Conclusion: **success**

### Plan evidence

Plan job `101950453812`: **success**.

- explicit `as_of_date=2026-09-08`;
- `max_due_stocks=1`;
- unique candidates: `551`;
- due candidates: `419`;
- selected count: `1`;
- selected stock: `1316` (上曜);
- deterministic freshness tests: `7/7 PASS`;
- frozen 8021 regression: `PASS`.

### Refresh / quota / checkpoint evidence

Refresh job `101951184018` (`refresh (1316)`): **success**.

Quota preflight reported:

- authenticated: `true`;
- API request limit: `600`;
- configured safe cap: `500`;
- reserve requests: `20`;
- required requests: `1`;
- remaining to safe cap: `500`;
- enough for next batch: `true`.

Refresh result:

- stock `1316` completed with `available=14`, `missing={}`;
- durable Q2 source: `data_finmind_quarterly_financial_quality/1316/2026Q2.json`;
- durable coverage: `data_finmind_quarterly_financial_quality/1316/coverage-status.json`;
- durable timeline: `data_finmind_quarterly_financial_quality/1316/financial-quality-score-timeline.json`;
- durable status: `data_prediction_analysis/quarterly-financial-quality/batch-status/due-refresh-2026-09-08-1316.json`;
- refresh commit: `73ec1e297ad0c2c810cce2b0839c09122d4b3265`;
- checkpoint push succeeded.

The new 2026Q2 row preserves `conservative_known_date=2026-08-14` and is only refreshed under `as_of_date=2026-09-08`, preserving anti-lookahead.

### Master propagation evidence

Rebuild job `101951568293`: **success**.

- canonical master rebuilt after refresh success;
- pre-push propagation verifier passed;
- master commit: `a8f5500721be4962c20a7e6d8325ee02affd6c25`;
- master push succeeded;
- final remote propagation verification reset to current remote main and passed;
- canonical path: `data_prediction_analysis/quarterly-financial-quality/financial-quality-master.json`;
- master quarterly row count increased `6809 -> 6810`;
- master contains 1316 2026Q2 with FQ score `5`, conservative known date `2026-08-14`, and refreshed coverage with no missing periods.

No-op job `101951185250` was correctly skipped because due work existed.

Schedule-summary job `101950453588`: **success**.

### Production invariants

- FAS threshold `>= 8`: unchanged.
- FQ threshold `>= 10`: unchanged.
- `two_stage_fundamental_quality_direct_entry_v1`: unchanged in meaning.
- next-close execution semantics: unchanged.
- 8021 regression passed inside the real run's plan job.

### Prompt A closeout

**Prompt A complete — ready for Prompt B**


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


## Prompt B closeout — first-real-refresh-proof-v1

**Prompt B closeout: PASS**

Closeout was performed independently against current remote `main` using the Prompt B preregistered before `first-real-refresh-proof-v1` Prompt A began.

### Acceptance results

1. **Fresh routing / handoff identity — PASS**
   - `docs/agent-prompts/task-routing.json` still identifies `finmind-quarterly-financial-quality-freshness` as the unique active project during this closeout.
   - The selected round is exactly `first-real-refresh-proof-v1`; no future Prompt B was substituted.

2. **Real workflow identity — PASS**
   - Workflow: `.github/workflows/refresh-finmind-quarterly-financial-quality-due.yml`.
   - Run ID: `34191540520`.
   - Run number: `1`.
   - Event: `workflow_dispatch`.
   - Head SHA: `5caf2a3e1b11927e13eff3df725eba3c19804544`.
   - Started: `2026-09-08T05:40:42Z`.
   - Completed: `2026-09-08T05:48:31Z`.
   - Conclusion: **success**.

3. **Bounded plan — PASS**
   - Plan job `101950453812`: **success**.
   - Explicit `as_of_date=2026-09-08`.
   - Manual cap `max_due_stocks=1`.
   - Due candidates: `419`.
   - Selected count: `1`.
   - Selected stock: `1316`.
   - Deterministic freshness tests: `7/7 PASS`.
   - Frozen 8021 regression: `PASS`.

4. **Quota / refresh isolation — PASS**
   - Refresh job `101951184018` (`refresh (1316)`): **success**.
   - FinMind quota preflight: authenticated, API request limit `600`, configured safe cap `500`, reserve `20`, required requests `1`, enough-for-next-batch `true`.
   - Only the selected stock `1316` was refreshed.
   - Refresh finished with `available=14`, `missing={}`, quota not exhausted.

5. **Durable bounded checkpoint — PASS**
   - Refresh commit: `73ec1e297ad0c2c810cce2b0839c09122d4b3265`.
   - Checkpoint push succeeded.
   - Current remote `main` still contains:
     - `data_finmind_quarterly_financial_quality/1316/2026Q2.json`;
     - `data_finmind_quarterly_financial_quality/1316/coverage-status.json`;
     - `data_finmind_quarterly_financial_quality/1316/financial-quality-score-timeline.json`;
     - `data_prediction_analysis/quarterly-financial-quality/batch-status/due-refresh-2026-09-08-1316.json`.
   - Coverage now has all `14` periods through `2026Q2` and no missing periods.

6. **Anti-lookahead — PASS**
   - Refreshed `1316/2026Q2.json` retains `conservative_known_date=2026-08-14`.
   - The real run used explicit `as_of_date=2026-09-08`, so the quarter was refreshed only after its conservative known date.
   - No evidence of early eligibility or historical replay look-ahead was introduced.

7. **Master propagation — PASS**
   - Rebuild job `101951568293`: **success**.
   - `rebuild-master` executed only after refresh success.
   - Master commit: `a8f5500721be4962c20a7e6d8325ee02affd6c25`.
   - Master push succeeded.
   - Final remote propagation verification reset to current remote main and passed.
   - `data_prediction_analysis/quarterly-financial-quality/financial-quality-master.json` increased from `6809` to `6810` quarterly rows and includes `1316` `2026Q2` with FQ score `5`, conservative known date `2026-08-14`, and refreshed no-missing coverage.
   - The no-op job `101951185250` was correctly skipped because due work existed.

8. **Production invariants — PASS**
   - `scripts/two_stage_fundamental_quality_signal.js` still requires FAS `>= 8` and FQ `>= 10`.
   - The frozen 8021 regression passed inside the real plan job and still asserts FAS `8`, latest-known production FQ `2026Q1 = 12`, signal day `2026-09-07`, and next-close execution `2026-09-08`.
   - No first-run fix changed strategy thresholds, strategy meaning, signal-day semantics, or next-close policy.

9. **First-run fix scope — PASS**
   - The real run required no workflow/code fix.
   - No race/quota/anti-lookahead guarantees were weakened.

10. **Concurrent changes / final freshness — PASS**
    - Current `main` at Prompt B verification initially pointed to `164aacd4d2a3e098238a6c964778580cb211355d`.
    - Comparing master commit `a8f5500721be4962c20a7e6d8325ee02affd6c25` to that state showed exactly one later commit and only one changed file: this canonical handoff.
    - No concurrent production, FinMind, master, strategy, test, or routing change staled the real-run evidence.

### Closeout decision

The first real FinMind due-refresh path has now been proven end-to-end with a bounded real API-backed write, durable per-stock checkpoint, canonical master rebuild, and final remote propagation verification.

Project disposition: **production-proven / monitor-only**.

No additional implementation round is justified by current evidence. Continue normal scheduled monitoring; create a new paired Prompt A/Prompt B round only if a future real run exposes a new defect or requirement.


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


## Active round — backlog-physical-batch-canary-v1

### Why this round exists

The first real due-refresh proof established a current backlog of **419 due candidates**, of which stock `1316` was refreshed successfully in the proof run. The remaining backlog is therefore large enough that the daily freshness workflow's default `max_due_stocks=5` would take far too long to drain.

This is a large multi-stock external-source fetch and is therefore governed by the repository-level mandatory architecture in `AGENTS.md`:

```text
plan
→ deterministic bounded queue
→ split queue into physical batches
→ fresh runner per physical batch
→ randomized batch cooldown
→ randomized per-request jitter
→ checkpoint/push each physical batch
→ runner exits
→ re-plan from committed state between waves
```

A loop over many logical batches inside one long-running runner is forbidden for this round.

### Objective

Create and prove a FinMind-specific backlog-drain path that clears due quarterly-FQ backlog materially faster than the daily 5-stock maintenance path while preserving:

- fresh-runner physical batch isolation;
- FinMind quota safety;
- polite request pacing;
- anti-lookahead;
- bounded durable checkpoints;
- race-safe push behavior;
- re-plan/resume from committed `main`;
- canonical master propagation.

This round is a **canary / calibration round**, not authorization to consume the entire remaining backlog in one static workflow run.

### Frozen physical-batch architecture

The implementation must start from these bounded canary defaults unless real evidence proves a smaller value is required:

- `physical_batch_size = 3` stocks per fresh runner for the first real canary;
- `max_physical_batches_per_wave = 2` for the first real canary;
- therefore first canary wave: **at most 6 due stocks**;
- `strategy.max-parallel: 1`;
- each matrix item is one **physical batch**, not one logical loop over the whole queue;
- each physical batch must checkout latest committed `main` on a fresh runner;
- randomized cooldown at the start of each physical batch: **3–8 seconds**;
- randomized delay between stock/API requests within a physical batch: **1–3 seconds**;
- no unnecessary fixed sleep after the last request in a batch;
- quota preflight must reserve/check requests proportional to the physical batch's actual stock count;
- checkpoint/push after each physical batch;
- runner exits after its physical batch;
- master rebuild occurs once after the completed wave, followed by durable remote propagation verification;
- next wave must be created by **re-planning from remote committed state**, not by continuing an old 419-stock static matrix.

These pacing numbers are starting canary values, not permanent magic constants. Prompt B must inspect real-run response/API diagnostics before any later round increases `physical_batch_size` or wave size.

### Exact entry points

- `AGENTS.md`
  - mandatory `Safe large-fetch architecture: plan + fresh-runner physical batches` rules.
- `scripts/backfill_finmind_quarterly_financial_quality_batch.js`
  - existing due/freshness planner and bounded stock execution.
- `.github/workflows/refresh-finmind-quarterly-financial-quality-due.yml`
  - proven daily freshness path; keep production behavior intact.
- proposed dedicated backlog path:
  - `.github/workflows/drain-finmind-quarterly-financial-quality-backlog.yml`
- `scripts/check_finmind_api_quota.js`
  - FinMind authenticated quota guard.
- `scripts/build_financial_quality_master.js`
  - canonical master builder.
- `scripts/verify_financial_quality_master_propagation.js`
  - required propagation verifier.
- `data_prediction_analysis/quarterly-financial-quality/financial-quality-master.json`
  - canonical production-consumed master.
- `data_prediction_analysis/quarterly-financial-quality/batch-status/`
  - durable per-batch/per-stock progress evidence.
- `tests/finmind_quarterly_freshness.test.js`
- `tests/financial_quality_master_propagation.test.js`
- `tests/fundamental_quality_8021_regression.test.js`
- `.github/workflows/test-node-regression-suite.yml`

### Prompt A completion contract — backlog-physical-batch-canary-v1

Prompt A is complete only when all of the following are durable:

1. A deterministic backlog planner derives due work from current committed `main`; it does not hard-code the old 419-stock list.
2. The planner groups only the bounded current wave into physical-batch matrix entries, with explicit `physical_batch_size` and `max_physical_batches_per_wave`.
3. The first canary uses at most **2 physical batches × 3 stocks = 6 stocks**.
4. Each matrix batch uses a separate fresh GitHub runner with `max-parallel: 1`.
5. Each physical batch:
   - performs quota preflight for its actual request count;
   - waits a randomized 3–8 second batch-start cooldown;
   - uses randomized 1–3 second pacing between stock requests;
   - validates successful FinMind responses/output completeness;
   - writes a durable checkpoint;
   - pushes safely against latest remote `main`;
   - exits after that batch.
6. There is no one-runner loop that processes multiple physical batches.
7. After both canary physical batches finish successfully, rebuild canonical master once for the wave and run final remote propagation verification.
8. Re-plan after the canary against newly committed `main` and record the new due count. The second plan is evidence only; do not automatically execute another wave in this round.
9. Relevant deterministic tests and Node Regression Suite pass.
10. Existing daily freshness workflow remains operational and production invariants remain unchanged.
11. Canonical handoff records:
    - canary run ID / head SHA;
    - planner due count and selected stock IDs grouped by physical batch;
    - physical batch job IDs;
    - actual cooldown/jitter/request counts;
    - quota preflight evidence;
    - checkpoint commit SHAs;
    - master commit SHA;
    - final propagation verification;
    - post-canary re-plan due count;
    - any response-quality/API anomalies.
12. Re-fetch remote `main` and verify all required durable paths.
13. Report exactly **`Prompt A complete — ready for Prompt B`** and stop.

If workflow dispatch is unavailable, do not fabricate canary evidence and do not claim Prompt A complete.

### Prompt A — backlog-physical-batch-canary-v1

Execute only round `backlog-physical-batch-canary-v1` from this canonical handoff.

Startup:

1. Fetch current remote `main`.
2. Read repository-root `AGENTS.md`, especially `Safe large-fetch architecture: plan + fresh-runner physical batches`.
3. Read `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, `docs/agent-prompts/task-routing.json`, and this canonical handoff.
4. Verify `finmind-quarterly-financial-quality-freshness` is still the unique active project and this round is the active promoted round.
5. Re-read all exact entry points above.
6. Verify current due backlog from committed state; do not reuse 419 as an authoritative current count.

Implementation:

- Add a dedicated backlog-drain workflow at `.github/workflows/drain-finmind-quarterly-financial-quality-backlog.yml` unless current-main evidence proves a smaller safe extension of the daily workflow is materially better.
- Preserve the daily freshness workflow's existing production semantics.
- Build a deterministic bounded wave from current due state.
- The matrix must represent **physical batches**. Do not create one matrix job per stock if the purpose of the canary is to calibrate 3-stock physical batches, and do not create one long runner that loops across multiple batches.
- First canary:
  - `physical_batch_size=3`;
  - `max_physical_batches_per_wave=2`;
  - at most 6 stocks;
  - `max-parallel: 1`.
- Fresh runner for each physical batch.
- Add randomized 3–8s cooldown at physical-batch start.
- Within a 3-stock physical batch, use randomized 1–3s delay between requests; skip unnecessary trailing delay after the final request.
- Quota preflight must use the actual number of requests/stocks selected in that batch and preserve existing reserve/safe-cap behavior.
- Validate output quality before checkpointing. HTTP/API transport success alone is not sufficient if returned data is structurally incomplete.
- Checkpoint and push each physical batch before its runner exits, using latest-main race-safe replay semantics.
- Rebuild the canonical master once after the whole canary wave succeeds, verify propagation, commit/push it, then verify again from current remote `main`.
- Re-run the planner from committed state after the canary and record remaining due count. Do not automatically run a second wave during this Prompt A.
- Do not modify FAS/FQ thresholds, strategy identity, signal/execution semantics, or anti-lookahead policy.
- Do not generalize into a generic scheduler/backfill framework.

Testing / evidence:

- Add deterministic tests for physical-batch grouping, bounded wave size, idempotent re-plan/resume, and no duplicate already-completed stocks.
- Run existing FinMind freshness/master/8021 regressions and Node Regression Suite.
- If the real canary shows a bounded plumbing defect, fix only that defect and rerun the same bounded canary.
- Record exact run/job/commit/durable-path evidence in this handoff.

Stop only when the Prompt A completion contract is satisfied.

### Prompt A implementation checkpoint — backlog-physical-batch-canary-v1 — 2026-09-08

Prompt A implementation work is durable on remote `main`, but the round is **not complete** because the preregistered contract requires one real physical-batch canary run and the available GitHub connector in this agent session does not expose workflow dispatch.

Implementation commits:

- `8df69f57d13edb2eb16bda45825568064ac6396d` — extend `scripts/backfill_finmind_quarterly_financial_quality_batch.js` with deterministic physical-batch planning, exact multi-stock execution, and post-refresh freshness/quality validation.
- `f1b3adbaa0f9ff4f523043f3a0cf3a34a1701389` — add deterministic physical-batch grouping / bounded-wave / re-plan regression coverage.
- `be15815c97bcc639943010ee9003ce51198e38b8` — add dedicated manual canary workflow `.github/workflows/drain-finmind-quarterly-financial-quality-backlog.yml`.

Implemented canary contract:

- planner derives due work from current committed state rather than hard-coding the old 419-stock list;
- first-wave inputs are hard-bounded to `physical_batch_size <= 3` and `max_physical_batches <= 2`;
- matrix entries are physical batches, each containing up to 3 exact stock IDs;
- `strategy.max-parallel: 1`;
- each physical-batch job starts on a fresh runner and checks out latest `main`;
- randomized batch-start cooldown is 3–8 seconds;
- intra-batch request pacing is 1–3 seconds and the batch script does not sleep after its final request;
- quota preflight uses the matrix batch's actual `request_count`;
- each physical batch writes one bounded status/checkpoint and replays all selected stock directories onto latest remote `main` before push;
- canonical master rebuild occurs only after the whole canary wave succeeds;
- durable propagation verification runs after the master push;
- a post-canary planner job re-checks committed `main` and records remaining due count without automatically executing another wave;
- daily `.github/workflows/refresh-finmind-quarterly-financial-quality-due.yml` was not modified;
- FAS/FQ thresholds, strategy identity, anti-lookahead, signal date, and next-close execution semantics were not modified.

Real-canary blocker:

- This agent's available GitHub connector exposes workflow/job inspection and rerun operations but **does not expose workflow dispatch**.
- Therefore no real run ID, physical-batch job IDs, actual randomized cooldown/jitter observations, quota logs, checkpoint commits, master commit, or post-canary due count can be truthfully recorded yet.
- Per the preregistered completion contract: **do not report `Prompt A complete — ready for Prompt B` until the real canary is run and verified.**

The required manual workflow is:

`.github/workflows/drain-finmind-quarterly-financial-quality-backlog.yml`

Use the preregistered first-canary defaults:

- `physical_batch_size = 3`
- `max_physical_batches = 2`
- explicit current Asia/Taipei `as_of_date` if manually dispatched.

### Prompt A real-canary evidence checkpoint — backlog-physical-batch-canary-v1 — 2026-09-08

A real canary has now executed and durable remote `main` proves the bounded physical-batch write/master path worked. Prompt A is still **not complete** because the current connector cannot enumerate the workflow run/job identities, and the preregistered completion contract also requires the exact post-canary re-plan due count plus Node Regression Suite PASS evidence.

Durable physical-batch evidence:

- Physical batch 0 checkpoint commit: `5a94d8efa0b48fd468f24a9a4bed93d7f862f2b3`.
- Physical batch 1 checkpoint commit: `5b8aedd59df6b0e344b5d4e767f95d88bd8d18d5`.
- Wave-level master commit: `9007e9ef27ce5fc49445c32a8effdcef22d1fd6f`.

Batch 0 durable status:

- path: `data_prediction_analysis/quarterly-financial-quality/batch-status/due-refresh-2026-09-08-batch000.json`;
- selected stocks: `3167,7769,3432`;
- selected count: `3`;
- processed count: `3`;
- result: `complete=3`;
- quota exhausted: `false`;
- physical-batch start cooldown: `8s`;
- request count: `3`;
- configured inter-request pacing: `1000ms + 0..2000ms jitter`;
- all three refreshed outputs passed the batch script's post-refresh freshness/quality decision before checkpoint.

Batch 1 durable status:

- path: `data_prediction_analysis/quarterly-financial-quality/batch-status/due-refresh-2026-09-08-batch001.json`;
- selected stocks: `2363,5484,6919`;
- selected count: `3`;
- processed count: `3`;
- result: `complete=3`;
- quota exhausted: `false`;
- physical-batch start cooldown: `3s`;
- request count: `3`;
- configured inter-request pacing: `1000ms + 0..2000ms jitter`;
- all three refreshed outputs passed the batch script's post-refresh freshness/quality decision before checkpoint.

Master propagation evidence:

- `9007e9ef27ce5fc49445c32a8effdcef22d1fd6f` is authored by `github-actions[bot]` with message `data: rebuild FinMind backlog canary master`.
- canonical master row count increased from `6810` to `6816`, exactly six additional quarterly rows.
- the master diff contains the six canary stocks' refreshed 2026Q2 data/coverage changes, including preserved `conservative_known_date=2026-08-14` where applicable.
- this proves the wave-level master publication happened after the two physical-batch checkpoints.

Fresh-runner / physical-batch architecture remains durable in:

`.github/workflows/drain-finmind-quarterly-financial-quality-backlog.yml`

The workflow still enforces:

- matrix item = physical batch;
- `strategy.max-parallel: 1`;
- fresh `ubuntu-latest` job per matrix item;
- checkout latest `main` per physical batch;
- randomized 3–8s batch-start cooldown;
- proportional quota preflight using `matrix.request_count`;
- 1–3s request pacing inside the batch;
- bounded latest-main checkpoint replay/push;
- one master rebuild after the completed wave;
- a separate post-wave re-plan job that does not automatically execute another wave.

Observed later production activity:

After the canary master commit, current remote `main` contains later normal FinMind refresh commits for `6625`, `2539`, `6446`, `2438`, and `3706`, followed by another canonical master rebuild. These are later production maintenance activity and do not invalidate the canary's bounded six-stock evidence.

Remaining completion evidence not currently observable through the available connector:

1. exact canary workflow **run ID / head SHA / physical-batch job IDs**;
2. the exact **post-canary re-plan due count** emitted in the re-plan job summary;
3. **Node Regression Suite PASS** on the final implementation SHA.

The GitHub connector available in this session has job-log/job-step readers only when a run/job ID is already known, but it does not expose workflow-run enumeration for this workflow. Public GitHub/web lookup did not provide an authoritative run identity. Do not invent those identifiers.

Therefore the round remains:

**Prompt A real canary succeeded durably, but Prompt A completion evidence is incomplete.**

Do not report `Prompt A complete — ready for Prompt B` until the three remaining evidence items above are recovered or independently produced.

### Prompt A recovered runtime evidence — backlog-physical-batch-canary-v1 — 2026-09-08

The previously missing workflow/runtime evidence has now been recovered directly from GitHub Actions durable metadata/logs.

Real canary workflow:

- workflow: `.github/workflows/drain-finmind-quarterly-financial-quality-backlog.yml`
- workflow name: `[07 研究] FinMind－季財報品質 backlog physical-batch canary`
- run ID: `34193149003`
- run number: `1`
- event: `workflow_dispatch`
- head SHA: `f250d957040364dd5cd462c0012f3a36378abf42`
- created: `2026-09-08T06:05:02Z`
- completed: `2026-09-08T06:19:25Z`
- conclusion: **success**

Job identities:

- plan job: `101955172203` — success
- physical batch 0 job: `101956016082` — success
- physical batch 1 job: `101956016099` — success
- rebuild-master job: `101956883366` — success
- replan job: `101957290626` — success
- no-op job: `101956016987` — skipped as expected because due work existed

Planner evidence:

- `as_of_date=2026-09-08`
- unique candidates: `551`
- due before canary: `418`
- `physical_batch_size=3`
- `max_physical_batches_per_wave=2`
- selected stock IDs:
  - batch 0: `3167,7769,3432`
  - batch 1: `2363,5484,6919`
- total selected: `6`

Physical batch 0 runtime evidence — job `101956016082`:

- fresh runner job lifecycle is distinct from batch 1
- cooldown: `8s`
- quota preflight:
  - authenticated: `true`
  - user_count: `1`
  - api_request_limit: `600`
  - configured cap: `500`
  - reserve: `20`
  - required requests: `3`
  - enough for next batch: `true`
- actual inter-request waits:
  - after 3167: `1418ms`
  - after 7769: `2059ms`
  - no trailing wait after final 3432
- all three stocks completed with structural freshness validation
- checkpoint push succeeded
- checkpoint commit: `5a94d8efa0b48fd468f24a9a4bed93d7f862f2b3`

Physical batch 1 runtime evidence — job `101956016099`:

- fresh runner job lifecycle is distinct from batch 0
- cooldown: `3s`
- quota preflight:
  - authenticated: `true`
  - user_count: `4`
  - api_request_limit: `600`
  - configured cap: `500`
  - reserve: `20`
  - required requests: `3`
  - enough for next batch: `true`
- actual inter-request waits:
  - after 2363: `1346ms`
  - after 5484: `1205ms`
  - no trailing wait after final 6919
- all three stocks completed with structural freshness validation
- checkpoint push succeeded
- checkpoint commit: `5b8aedd59df6b0e344b5d4e767f95d88bd8d18d5`

Master propagation:

- rebuild-master job `101956883366`: success
- `Rebuild and verify canonical master`: success
- `Commit master with latest-main retry`: success
- `Verify durable remote propagation`: success
- master commit: `9007e9ef27ce5fc49445c32a8effdcef22d1fd6f`
- canonical master rows: `6810 -> 6816`

Post-canary re-plan:

- replan job `101957290626`: success
- re-plan checked out newly committed `main`
- due after committed canary: `412`
- therefore successful canary checkpoints removed exactly six due stocks from the planner: `418 -> 412`
- next planned sample visible in the evidence:
  - batch 0: `6625,2539,6446`
  - batch 1: `2438,3706,1235`
- no second backlog wave was automatically executed by this canary run

Regression evidence:

- deterministic FinMind freshness/master/8021 regressions passed inside canary plan job `101955172203`.
- Node Regression Suite run `34192958111` on `f1b3adbaa0f9ff4f523043f3a0cf3a34a1701389`: **success**.
- To remove ambiguity about the later workflow implementation commit, an additional bounded deterministic test was committed:
  - `b7e131a6e7502365ae86b27fd44fe0390c39c358` — `test: lock bounded FinMind canary wave sizing`.
- This triggered Node Regression Suite run `34199059293`.
- At the latest verification in this checkpoint, run `34199059293` is **in_progress**; jobs `101973411652` (Node regression tests) and `101973411811` (排程時間摘要) have started but are still in their checkout stages.
- Do not claim final Prompt A completion until run `34199059293` reaches a terminal successful conclusion.

All canary runtime, physical-batch, quota, pacing, checkpoint, master, and re-plan acceptance evidence is now complete. The only remaining Prompt A gate is the terminal PASS of Node Regression Suite run `34199059293`.

### Prompt A completion evidence — backlog-physical-batch-canary-v1 — 2026-09-08

**Prompt A complete — ready for Prompt B**

All preregistered Prompt A completion criteria are now satisfied on durable remote `main`.

Final regression gate:

- final bounded test commit: `b7e131a6e7502365ae86b27fd44fe0390c39c358` — `test: lock bounded FinMind canary wave sizing`
- Node Regression Suite run: `34199059293`
- run status: `completed`
- run conclusion: **success**
- head SHA: `b7e131a6e7502365ae86b27fd44fe0390c39c358`
- Node regression job: `101973411652` — **success**
  - syntax check changed regression entry points: success
  - run Node regression suite: success
- schedule-summary job: `101973411811` — **success**

The earlier canary runtime evidence remains the acceptance basis:

- real canary run `34193149003`: success
- plan job `101955172203`: success
- batch 0 job `101956016082`: success
- batch 1 job `101956016099`: success
- rebuild-master job `101956883366`: success
- replan job `101957290626`: success
- due backlog `418 -> 412`
- six bounded stocks were refreshed in two true fresh-runner physical batches
- quota preflight passed proportionally for 3 requests per batch
- actual batch cooldowns were 8s and 3s
- actual inter-request waits were 1418ms / 2059ms and 1346ms / 1205ms, with no trailing sleep after the final request
- physical-batch checkpoint commits:
  - `5a94d8efa0b48fd468f24a9a4bed93d7f862f2b3`
  - `5b8aedd59df6b0e344b5d4e767f95d88bd8d18d5`
- wave-level master commit:
  - `9007e9ef27ce5fc49445c32a8effdcef22d1fd6f`
- canonical master rows `6810 -> 6816`
- final durable propagation verification passed
- post-canary planner used committed `main` and reduced due work by exactly six without manual suppression
- daily FinMind freshness workflow remained operational after the canary
- FAS >= 8, FQ >= 10, strategy identity, anti-lookahead, signal-day semantics, and next-close execution policy remain unchanged

Concurrent remote changes after the canary were limited to unrelated market/data maintenance and documentation checkpoints; no concurrent change invalidated the FinMind canary implementation, workflow architecture, test contract, routing identity, or evidence.

Per the repository runner protocol, Prompt A stops here. Do not execute Prompt B automatically.

### Preregistered Prompt B — backlog-physical-batch-canary-v1

Close out round `backlog-physical-batch-canary-v1`.

This Prompt B is preregistered before Prompt A starts and must not be rewritten to fit the result.

Verify independently:

1. **Fresh identity**
   - current remote `main`, routing, handoff, and active round are fresh;
   - recover this exact preregistered Prompt B if handoff history advanced.
2. **Planner correctness**
   - due queue came from current committed state;
   - selected wave was bounded and deterministic;
   - no outcome-based cherry-picking;
   - canary selected at most 6 stocks;
   - post-canary re-plan removed successfully checkpointed stocks.
3. **True physical batches**
   - matrix entries represent physical batches;
   - exactly separate GitHub runner/job lifecycles are visible for each canary batch;
   - no single runner processed multiple physical batches;
   - `max-parallel: 1`.
4. **Polite pacing**
   - each physical batch shows randomized 3–8s batch-start cooldown;
   - 1–3s randomized inter-request pacing inside multi-stock batches;
   - no excessive fixed sleeps unrelated to source safety;
   - no unnecessary trailing delay after the final request.
5. **Quota safety**
   - authenticated quota preflight passed;
   - required request count matches actual stocks in each physical batch;
   - existing safe cap/reserve remains intact;
   - no quota exhaustion was hidden.
6. **Response quality**
   - each selected stock has structurally valid durable source/coverage/timeline output;
   - no ambiguous degraded/empty response was persisted as success;
   - any transient/soft-block condition remained retryable and was not converted to terminal negative without evidence.
7. **Checkpoint durability**
   - each physical batch produced a bounded checkpoint commit before runner exit;
   - current remote `main` contains all selected stocks' durable refreshed paths/status;
   - push-race handling did not lose another batch's committed output.
8. **Master propagation**
   - master rebuilt only after canary batch jobs succeeded;
   - one wave-level master publication is present, excluding bounded retry rebuilds required by push races;
   - final remote propagation verification passed for every canary stock.
9. **Re-plan / resume**
   - a fresh post-canary planner run used committed `main`;
   - new due count and remaining queue are recorded;
   - successful canary stocks disappeared from due work without manual suppression.
10. **Regression / invariants**
    - deterministic physical-batch tests PASS;
    - Node Regression Suite PASS on final implementation SHA;
    - FinMind freshness/master tests and 8021 regression PASS;
    - FAS >= 8, FQ >= 10, strategy ID, anti-lookahead, and next-close policy remain unchanged.
11. **Canary calibration decision**
    - use real evidence to decide the next production drain values;
    - do not automatically increase above 5 requests/stocks per fresh runner without documented evidence;
    - preregister a next drain-wave Prompt A/B only if remaining due backlog justifies it.

If any criterion fails, fix only the bounded defect and restart this same Prompt B from criterion 1.

If all criteria pass:

- record `Prompt B closeout: PASS`;
- record evidence-backed recommended `physical_batch_size`, batches-per-wave, jitter/cooldown, and estimated remaining waves;
- if backlog remains, preregister/promote the next bounded drain-wave Prompt A + Prompt B;
- commit this handoff;
- re-fetch remote `main` and verify durability;
- stop.

### Prompt B closeout — backlog-physical-batch-canary-v1 — 2026-09-08

**Prompt B closeout: PASS**

Independent closeout re-established all acceptance evidence from current remote `main`, GitHub Actions metadata/logs, and durable repository files rather than relying on the Prompt A summary.

Acceptance results:

1. **Fresh identity — PASS**
   - `docs/agent-prompts/task-routing.json` still has exactly one active task: `finmind-quarterly-financial-quality-freshness`.
   - target round was `backlog-physical-batch-canary-v1`, whose Prompt A had durable completion and whose preregistered Prompt B had no prior PASS.
   - concurrent commits after Prompt A closeout were unrelated market/data maintenance; none changed this FinMind workflow, planner, tests, routing, or handoff assumptions.

2. **Planner correctness — PASS**
   - canary plan job `101955172203` derived due work from committed state.
   - unique candidates: `551`.
   - due before canary: `418`.
   - bounded plan: `physical_batch_size=3`, `max_physical_batches_per_wave=2`.
   - batch 0: `3167,7769,3432`.
   - batch 1: `2363,5484,6919`.
   - no outcome-based selection was used.
   - replan job `101957290626` used newly committed `main` and reported `412` due, exactly removing the six successful canary stocks.

3. **True physical batches — PASS**
   - real canary run: `34193149003`, workflow_dispatch, head SHA `f250d957040364dd5cd462c0012f3a36378abf42`, conclusion success.
   - physical batch 0 job: `101956016082`.
   - physical batch 1 job: `101956016099`.
   - the two jobs are distinct runner/job lifecycles.
   - workflow remains matrix-per-physical-batch with `strategy.max-parallel: 1`; no runner loops across physical batches.

4. **Polite pacing — PASS**
   - batch 0 cooldown: `8s`; actual inter-request waits: `1418ms`, `2059ms`.
   - batch 1 cooldown: `3s`; actual inter-request waits: `1346ms`, `1205ms`.
   - waits stayed inside the preregistered 1–3s range.
   - logs show no trailing inter-request sleep after the last stock in either batch.
   - no minute-scale unconditional sleeps were added to the normal successful path.

5. **Quota safety — PASS**
   - both physical batches used authenticated quota preflight.
   - configured cap: `500`; FinMind reported API limit: `600`; reserve: `20`.
   - required requests matched actual selected stocks: `3` per batch.
   - batch 0: user_count `1`, enough_for_next_batch `true`.
   - batch 1: user_count `4`, enough_for_next_batch `true`.
   - both durable statuses record `quota_exhausted=false`.

6. **Response quality — PASS**
   - all six selected stocks completed structural post-refresh freshness validation before checkpoint.
   - durable current-main directories for all six contain `2026Q2.json`, `coverage-status.json`, and `financial-quality-score-timeline.json`.
   - known historical missing quarters for 7769/6919 remained explicit historical coverage reasons rather than being misclassified as successful fetched quarters.
   - no ambiguous degraded/empty response was persisted as a successful due quarter.

7. **Checkpoint durability — PASS**
   - batch 0 checkpoint commit: `5a94d8efa0b48fd468f24a9a4bed93d7f862f2b3`.
   - batch 1 checkpoint commit: `5b8aedd59df6b0e344b5d4e767f95d88bd8d18d5`.
   - both checkpoint pushes succeeded before their runner exited.
   - current remote `main` retains the selected stocks' refreshed data and batch-status files.
   - later writes did not lose either batch.

8. **Master propagation — PASS**
   - rebuild-master job `101956883366`: success.
   - master was rebuilt after both physical-batch jobs.
   - one wave-level master commit: `9007e9ef27ce5fc49445c32a8effdcef22d1fd6f`.
   - canonical rows increased `6810 -> 6816`.
   - final remote propagation verifier reported `verified_stocks=6`.

9. **Re-plan / resume — PASS**
   - post-canary due count: `412`.
   - next deterministic queue began `6625,2539,6446,2438,3706,1235`.
   - the daily production workflow later started from the same `412` baseline and successfully completed the first five of those stocks in run `34194643949`, then rebuilt/verified the master.
   - the candidate-universe blob is unchanged between canary master SHA and current main: `2ff3dee90c35211927f091cb483268a1b4a1d8ec`.
   - therefore, with five additional due stocks durably completed and no candidate-universe change, the current evidence-backed remaining due backlog is `407`.

10. **Regression / invariants — PASS**
    - canary plan job passed FinMind freshness, master propagation, and 8021 deterministic regressions.
    - final Node Regression Suite run `34199059293` on `b7e131a6e7502365ae86b27fd44fe0390c39c358`: success.
    - Node regression job `101973411652`: success.
    - frozen 8021 regression still asserts:
      - base trading date `2026-09-07`;
      - FAS total score `8`;
      - FAS threshold `>=8`;
      - FQ threshold `>=10`;
      - next-close execution date `2026-09-08`.
    - no evidence shows strategy identity or anti-lookahead semantics changed.

11. **Canary calibration decision — PASS**
    - one 3-stock runner completed cleanly twice, with low quota utilization, structurally valid responses, and no soft-block/pacing anomaly.
    - evidence is strong enough to expand the **number of sequential physical batches per wave**, but not yet strong enough to increase requests per fresh runner.
    - recommended next-wave values:
      - `physical_batch_size=3` unchanged;
      - `max_physical_batches_per_wave=4`;
      - at most `12` stocks per wave;
      - `strategy.max-parallel=1`;
      - batch-start cooldown remains randomized `3–8s`;
      - inter-request pacing remains randomized `1–3s`;
      - quota reserve/cap unchanged;
      - checkpoint after every physical batch;
      - one master rebuild after successful wave;
      - re-plan from committed main after the wave.
    - evidence-backed remaining backlog: `407`; at 12 stocks/wave this is approximately **34 waves** if no daily maintenance runs reduce it further.
    - this is deliberately a gradual expansion; do not raise physical batch size above 3 in the next round.

Closeout also identified one next-wave durability requirement that was not a failure of the already-completed canary:

- current canary checkpoint path identity is date + batch index, e.g. `due-refresh-2026-09-08-batch000.json`.
- a second backlog wave on the same date could overwrite prior canary batch-status evidence.
- before executing another wave, the next round must add a stable **wave identity** to durable backlog checkpoint filenames/status metadata so each wave remains independently auditable.

No bounded defect requires rerunning the canary. This round is closed PASS.

### Active round — backlog-drain-wave-12-v1

#### Objective

Safely expand the proven FinMind backlog drain from 2 × 3 to **4 sequential physical batches × 3 stocks = at most 12 stocks**, while preserving every canary safety property and preventing same-day waves from overwriting prior durable checkpoint evidence.

Current evidence-backed baseline at promotion:

- candidate universe unchanged;
- current due backlog: **407**;
- physical batch size remains **3**;
- next wave maximum: **4 physical batches / 12 stocks**;
- no increase in parallelism;
- no increase in requests per fresh runner.

#### Exact entry points

- `AGENTS.md`
- `docs/agent-prompts/task-routing.json`
- `docs/handoffs/finmind-quarterly-financial-quality-freshness.md`
- `scripts/backfill_finmind_quarterly_financial_quality_batch.js`
  - deterministic due planner, physical-batch grouping, exact stock targeting, status generation.
- `.github/workflows/drain-finmind-quarterly-financial-quality-backlog.yml`
  - backlog physical-batch workflow to extend from 2 to 4 batches.
- `.github/workflows/refresh-finmind-quarterly-financial-quality-due.yml`
  - proven daily production maintenance path; preserve behavior.
- `scripts/check_finmind_api_quota.js`
- `scripts/build_financial_quality_master.js`
- `scripts/verify_financial_quality_master_propagation.js`
- `data_prediction_analysis/quarterly-financial-quality/financial-quality-master.json`
- `data_prediction_analysis/quarterly-financial-quality/batch-status/`
- `tests/finmind_quarterly_freshness.test.js`
- `tests/financial_quality_master_propagation.test.js`
- `tests/fundamental_quality_8021_regression.test.js`
- `.github/workflows/test-node-regression-suite.yml`

#### Frozen next-wave architecture

- `physical_batch_size=3`.
- `max_physical_batches_per_wave=4`.
- at most 12 selected stocks.
- `strategy.max-parallel: 1`.
- each matrix item is exactly one fresh runner physical batch.
- randomized 3–8s batch-start cooldown.
- randomized 1–3s inter-request pacing, with no trailing delay after final request.
- quota preflight proportional to actual matrix request_count.
- checkpoint/push each physical batch before runner exit.
- one wave-level master rebuild only after all selected batches succeed.
- final durable remote propagation verification.
- post-wave re-plan from newly committed main.
- no automatic second wave.
- do not raise physical batch size above 3 in this round.
- do not increase parallelism.
- preserve FAS >= 8, FQ >= 10, strategy identity, anti-lookahead, and next-close semantics.

#### Mandatory wave-identity fix before execution

Durable backlog status/checkpoint paths must be unique per backlog wave. Do not overwrite:

- `data_prediction_analysis/quarterly-financial-quality/batch-status/due-refresh-2026-09-08-batch000.json`
- `data_prediction_analysis/quarterly-financial-quality/batch-status/due-refresh-2026-09-08-batch001.json`

Acceptable implementation characteristics:

- introduce a deterministic/safe `wave_id` for backlog workflow status identity, preferably based on explicit workflow/run identity rather than random local state;
- include `wave_id` in durable status metadata and filenames;
- keep daily production status semantics backward compatible unless a minimal compatibility change is necessary;
- add regression proving two same-date backlog waves cannot target the same durable checkpoint path;
- no generic scheduler/framework extraction.

#### Prompt A completion contract — backlog-drain-wave-12-v1

Prompt A is complete only when:

1. unique backlog `wave_id` status identity is implemented and tested before the new wave executes.
2. workflow bound is expanded only to max 4 physical batches while physical batch size remains max 3.
3. planner derives a fresh current due count from committed main and selects at most 12 deterministic stocks.
4. real wave uses separate fresh-runner jobs for every selected physical batch, `max-parallel=1`.
5. every batch shows proportional quota preflight, 3–8s cooldown, 1–3s inter-request pacing, response-quality validation, durable unique checkpoint, and runner exit.
6. no one-runner loop spans multiple physical batches.
7. prior canary batch-status artifacts remain present and unchanged after the new wave.
8. master rebuilds once after all successful physical batches and remote propagation verifier passes for all selected stocks.
9. post-wave re-plan records before/after due counts from committed state and does not auto-run another wave.
10. relevant deterministic tests plus Node Regression Suite pass on final implementation SHA.
11. daily production FinMind freshness workflow remains operational.
12. canonical handoff records exact wave id, run/head SHA, planner counts, batch grouping/job IDs, cooldown/pacing/quota evidence, checkpoint commits/paths, master commit, propagation evidence, post-wave due count, anomalies, and prior-canary artifact preservation.
13. re-fetch remote main and verify durability.
14. report exactly `Prompt A complete — ready for Prompt B` and stop.

#### Prompt A — backlog-drain-wave-12-v1

Execute only round `backlog-drain-wave-12-v1`.

Startup:

1. Fetch current remote main.
2. Read `AGENTS.md`, root `promptA.md`, `docs/agent-prompts/prompt-a-runner.md`, `docs/agent-prompts/task-routing.json`, and this canonical handoff.
3. Verify `finmind-quarterly-financial-quality-freshness` remains the unique active project and this round is the promoted active round.
4. Re-read all exact entry points and frozen architecture above.
5. Recompute current due backlog from committed main; do not blindly reuse 407 if concurrent FinMind maintenance has advanced.

Implementation and execution:

- first implement unique backlog `wave_id` checkpoint identity and deterministic regression coverage;
- preserve the existing canary batch000/batch001 files as immutable historical evidence;
- update the backlog workflow to allow at most `max_physical_batches=4`, while keeping `physical_batch_size<=3`;
- create one deterministic bounded wave from fresh due state, at most 12 stocks;
- matrix entry = one physical batch/fresh runner;
- `strategy.max-parallel: 1`;
- keep 3–8s batch-start cooldown and 1–3s request jitter;
- quota preflight must reserve actual request_count only;
- validate structural output quality before checkpoint;
- checkpoint each physical batch to its unique wave-scoped durable path, race-safe against latest main;
- exit runner after its batch;
- after all selected batches succeed, rebuild master once, verify, push, reset to remote main, verify again;
- post-wave re-plan from committed state and record new due count; do not run another wave;
- preserve daily workflow and all production strategy/anti-lookahead invariants.

If the real wave exposes a bounded defect, fix only that defect and rerun this same bounded wave protocol. Never expand beyond 4 × 3 in this round.

Run deterministic FinMind/master/8021 tests and Node Regression Suite. Update this handoff with exact durable evidence while preserving the preregistered Prompt B below.

#### Prompt A implementation checkpoint — backlog-drain-wave-12-v1 — 2026-09-08

Prompt A is **in progress; not complete**. The implementation portion is durable on remote `main`, but the preregistered completion contract still requires a real bounded backlog wave and final CI/run evidence.

Implementation commits:

- `1d352a1d10378bb1038ec4b7c69428dd3c2b1cdb` — add explicit backlog `wave_id` support and wave-scoped due-refresh status naming while preserving legacy daily single-stock naming when no wave id is supplied.
- `a06394081b100d1b9880196527777d55fbfd16b5` — add regression coverage proving two same-date backlog waves cannot target the same durable checkpoint path and daily naming remains backward compatible.
- `74b9fe53d0c9efb99f2f793e878a997b1870a320` — expand only the backlog workflow bound from 2×3 to max 4×3 / 12 stocks; keep physical batch size <=3 and `strategy.max-parallel: 1`.
- `9fadd0b071d14c15d72d45e62d29bc84071fc853` — clarify backlog wave labels only.

Current durable implementation behavior:

- backlog workflow derives `wave_id=run-${GITHUB_RUN_ID}` from explicit GitHub workflow run identity;
- backlog physical-batch status paths are now `due-refresh-<as_of_date>-wave-<wave_id>-batchNNN.json`;
- status methodology records `wave_id`;
- prior canary files `due-refresh-2026-09-08-batch000.json` and `batch001.json` are not renamed or overwritten by the new naming rule;
- daily production single-stock due-refresh status naming remains unchanged when no `--wave-id` is supplied;
- workflow input guard now permits at most 4 physical batches while preserving `physical_batch_size<=3`, 3–8 second batch cooldown, 1–3 second inter-request pacing, proportional quota preflight, checkpoint-per-batch, one wave-level master rebuild, post-wave re-plan, and no automatic second wave.

Evidence still required before Prompt A may complete:

1. Dispatch and observe one real `.github/workflows/drain-finmind-quarterly-financial-quality-backlog.yml` wave from current main with the default bounded values (3 stocks per physical batch, max 4 batches).
2. Record current due count, selected stocks grouped by batch, real `wave_id`, run/head SHA, job IDs, cooldown/jitter/quota logs, unique checkpoint commits/paths, master commit, propagation verifier result, and post-wave due count.
3. Verify the two old canary batch-status blobs are unchanged after the new run.
4. Run/verify the relevant deterministic regressions and `[99 測試] Node Regression Suite` on the final implementation SHA.
5. Re-fetch current main and update this handoff with the real-run evidence before reporting `Prompt A complete — ready for Prompt B`.

Tool limitation in this agent session: the connected GitHub actions available here do not expose workflow dispatch, and these commits did not produce automatic workflow runs. Therefore no real-run or CI PASS evidence is fabricated, and Prompt A remains open.

Real wave attempt #2 exposed a bounded checkpoint contract defect before Prompt A completion:

- failing job label: `refresh-batch (1, 2883, 6225, 6901, 2883,6225,6901, 3)`;
- failing step: `Checkpoint entire physical batch safely`;
- observed error: `cp: cannot stat 'data_finmind_quarterly_financial_quality/2883': No such file or directory`;
- root cause: `backfill_finmind_quarterly_financial_quality.js` can terminate with exit code 3 for `unsupported_financial_model` before creating a stock output directory, while the batch runner treated that as a valid terminal classification and checkpoint code incorrectly assumed every selected stock must have a directory.

Bounded fix commits:

- `13a61ce69e276da95ccc69aa0ee229b128687441` — persist a durable `unsupported_financial_model` coverage terminal marker and make freshness reuse it without requiring a timeline.
- `56fd7d291ac840f2e39fc87492812122a20010db` — allow explicit master propagation verification to skip durable unsupported terminals while still requiring timelines for supported refreshed stocks.
- `bd633db29c897095a882180333e8c4aca630f35e` — lock unsupported freshness terminal behavior.
- `32fee41d83089e0cbd4d43f29b59b57b5a7d0cbd` — lock unsupported master propagation behavior.
- `a669375d92951a309a8905f714c1a269a97b285d` — checkpoint only when every batch result is an accepted terminal status; non-terminal backfill/timeline/quality failures now fail explicitly instead of surfacing later as a misleading missing-directory `cp` error.

This failure does not authorize expanding scope or wave size. Re-run the same bounded backlog workflow after the fix; Prompt A remains in progress until the full real-wave, master propagation, post-wave re-plan, regression/CI, and durability evidence passes.

#### Prompt A completion evidence — backlog-drain-wave-12-v1 — 2026-09-08

**Prompt A complete — ready for Prompt B**

Real bounded wave evidence is now durable and satisfies the preregistered Prompt A completion contract.

##### Real workflow identity

- workflow: `.github/workflows/drain-finmind-quarterly-financial-quality-backlog.yml`
- run id: `34213993759`
- run number: `3`
- event: `workflow_dispatch`
- head SHA: `135946c12ccbb6b658dd1c75333233cbddabc3c3`
- conclusion: **success**
- wave id: `run-34213993759`
- as-of date: `2026-09-08`

##### Planner / bounded selection

- unique candidates: `551`
- due before wave: `398`
- selected: `12`
- `physical_batch_size=3`
- `max_physical_batches_per_wave=4`
- batch 0: `2883,6225,6901`
- batch 1: `6994,5522,3017`
- batch 2: `6934,2368,2425`
- batch 3: `2505,2424,3135`
- no outcome-based selection and no automatic second wave.

##### True physical-batch jobs / pacing / quota

All four matrix batches ran as distinct successful GitHub jobs with `strategy.max-parallel: 1`:

- batch 0 job `102022578491`: cooldown `5s`; inter-request waits `2786ms, 2293ms`; quota required `3`, configured cap `500`, reserve `20`, enough `true`.
- batch 1 job `102022578501`: cooldown `5s`; waits `1370ms, 1800ms`; quota required `3`, enough `true`.
- batch 2 job `102022578543`: cooldown `8s`; waits `1148ms, 2193ms`; quota required `3`, enough `true`.
- batch 3 job `102022578485`: cooldown `3s`; waits `1273ms, 1167ms`; quota required `3`, enough `true`.

No trailing inter-request wait occurred after the final stock in any batch. No quota exhaustion or soft-block/response-quality anomaly was observed.

##### Terminal classifications / response quality

- `2883` was correctly classified and durably persisted as `unsupported_financial_model` rather than being misrepresented as a successful general-industry FQ timeline.
- the other 11 stocks completed successfully.
- explicit historical gaps for stocks such as `6994`, `6934`, and `3135` remained classified as historical missing/unavailable reasons rather than false successful quarters.
- no non-terminal backfill/timeline/quality failure reached checkpoint.

##### Unique durable checkpoint evidence

Each physical batch pushed a unique wave-scoped checkpoint before runner exit:

- batch 0: commit `fb71adef8fe268f378ef973a0be9f3353a867faf`; path `data_prediction_analysis/quarterly-financial-quality/batch-status/due-refresh-2026-09-08-wave-run-34213993759-batch000.json`.
- batch 1: commit `a11a72a836978e0f1fec99f78f8711c1b4e1f8a8`; path `...-batch001.json`.
- batch 2: commit `a27b6bda537a15baafb8aaa9cc1f6da7607f5be0`; path `...-batch002.json`.
- batch 3: commit `948a693fe4edf23eb6c2bae92b8e1e3ea10ac91b`; path `...-batch003.json`.

Prior canary history preservation was independently checked against canary master commit `9007e9ef27ce5fc49445c32a8effdcef22d1fd6f`:

- legacy canary `due-refresh-2026-09-08-batch000.json` blob remains `a16e28ad412615f857622af01490325377b67e42`.
- legacy canary `due-refresh-2026-09-08-batch001.json` blob remains `3165810bb379e1e5d5bd99b339b75df80fd4e818`.

Therefore the wave-id fix successfully prevents same-date checkpoint overwrite while preserving old evidence unchanged.

##### Master propagation

- rebuild-master job: `102025297689` — **success**.
- master commit: `a7ddc0a118e028b19492cfe0559421483a12d966`.
- verifier before push: `verified_stocks=11`, `skipped_unsupported=1`.
- master push succeeded.
- final verification after reset to remote main again reported `verified_stocks=11`, `skipped_unsupported=1`.
- exactly one wave-level master publication occurred after all four physical batches succeeded.

##### Post-wave re-plan / resume

- replan job: `102025868238` — **success**.
- due before wave: `398`.
- due after committed wave: `386`.
- delta: exactly `12`, reconciling all 12 terminal selected stocks, including the durable unsupported terminal.
- next deterministic queue was derived from newly committed main; no second wave was executed automatically.

##### Regression / invariant evidence

- plan job `102021318078` passed FinMind freshness tests (`13`), master propagation tests (`5`), and frozen 8021 regression (`1`) on real-run head `135946c12ccbb6b658dd1c75333233cbddabc3c3`.
- full `[99 測試] Node Regression Suite #27`, run `34213929739`, head SHA `32fee41d83089e0cbd4d43f29b59b57b5a7d0cbd`: **success**. Later changes before real run were backlog-workflow/documentation-only; the real plan revalidated the FinMind/master/8021 paths on the actual workflow head.
- FAS threshold `>=8`, FQ threshold `>=10`, strategy identity, anti-lookahead, signal-day semantics, and next-close policy were not changed.
- daily production freshness workflow was not modified by the bounded unsupported-terminal fix and remains a separate preserved path.

##### Prompt A closeout

All preregistered completion requirements are now durably satisfied. Prompt B remains exactly the preregistered closeout contract below and has not been executed automatically.

**Prompt A complete — ready for Prompt B**

#### Preregistered Prompt B — backlog-drain-wave-12-v1

Close out round `backlog-drain-wave-12-v1`.

This Prompt B is preregistered before Prompt A begins and must not be rewritten to fit results.

Verify independently:

1. **Fresh identity**
   - fresh remote main/routing/handoff;
   - recover this exact preregistered Prompt B;
   - classify concurrent changes.
2. **Wave identity / history preservation**
   - new backlog wave has a durable unique wave_id;
   - every status/checkpoint path is wave-scoped;
   - prior canary `due-refresh-2026-09-08-batch000.json` and `batch001.json` blobs remain unchanged;
   - two same-date waves cannot overwrite each other.
3. **Planner correctness**
   - due count came from current committed state;
   - deterministic selection, at most 12 stocks;
   - physical batch grouping is max 4 × 3;
   - no outcome cherry-picking.
4. **True physical batches**
   - distinct GitHub job/runner lifecycle for each selected matrix batch;
   - `max-parallel=1`;
   - no runner spans multiple physical batches.
5. **Pacing / quota**
   - each batch cooldown is 3–8s;
   - actual inter-request waits are 1–3s and absent after final request;
   - authenticated quota guard uses actual request_count;
   - configured 500 cap / 20 reserve or safer equivalent remains;
   - no hidden quota exhaustion/soft-ban anomaly.
6. **Response quality**
   - every selected stock has structurally valid durable source/coverage/timeline;
   - missing historical data remains explicitly classified;
   - ambiguous or degraded API results are not persisted as successful due quarters.
7. **Checkpoint durability**
   - each physical batch pushed a unique bounded checkpoint before runner exit;
   - race-safe replay preserved earlier batches and unrelated concurrent commits.
8. **Master propagation**
   - one wave-level canonical master publication after all successful batches;
   - final remote propagation verifier passes for all selected stocks.
9. **Re-plan / resume**
   - fresh post-wave plan uses committed main;
   - successful selected stocks disappear from due queue;
   - before/after due counts reconcile with successful terminal statuses;
   - no automatic second wave.
10. **Regression / invariants**
    - wave-identity regression passes;
    - FinMind freshness/master/8021 regressions pass;
    - Node Regression Suite passes on final implementation SHA;
    - daily production path remains operational;
    - FAS >=8, FQ >=10, strategy identity, anti-lookahead, signal date, next-close policy unchanged.
11. **Calibration**
    - use the 12-stock wave's real API/runtime evidence to decide whether a later round may increase batches-per-wave further;
    - do not increase requests per fresh runner above 3 without new explicit evidence;
    - do not increase parallelism above 1;
    - record remaining due backlog and estimated waves.

If any criterion fails, fix only the bounded defect and restart this Prompt B from criterion 1.

If all PASS:

- record `Prompt B closeout: PASS`;
- record the evidence-backed next calibration;
- preregister/promote another bounded drain round only if backlog remains;
- commit handoff;
- re-fetch current main and verify durability;
- stop without executing the next Prompt A.

### Prompt B closeout — backlog-drain-wave-12-v1 — 2026-09-08

**Prompt B closeout: PASS**

Independent closeout used the Prompt B preregistered before Prompt A began, recovered from durable pre-Prompt-A commit `2bb628056624edbc4944f1ab99b3d70524594504`. Current remote `main` was re-fetched and remained `fa5bd4e40f20305675b2121a5d3b3a982fbca9e6` throughout verification; no concurrent post-Prompt-A commit staled the evidence.

#### Acceptance results

1. **Fresh identity — PASS**
   - unique active routing task remains `finmind-quarterly-financial-quality-freshness`;
   - target round is exactly `backlog-drain-wave-12-v1`;
   - the preregistered Prompt B text on pre-Prompt-A durable state matches the closeout contract used here.

2. **Wave identity / history preservation — PASS**
   - successful wave id: `run-34213993759`;
   - all new backlog statuses are wave-scoped: `due-refresh-2026-09-08-wave-run-34213993759-batch000..003.json`;
   - prior canary blob `batch000` remains `a16e28ad412615f857622af01490325377b67e42`;
   - prior canary blob `batch001` remains `3165810bb379e1e5d5bd99b339b75df80fd4e818`;
   - wave-id regression is durable and two same-date waves cannot target the same checkpoint path.

3. **Planner correctness — PASS**
   - real-run plan derived current committed state, not the old 407 estimate;
   - due before wave: `398`;
   - selected exactly `12`;
   - grouping: 4 physical batches × 3 stocks;
   - deterministic first-queue selection; no outcome cherry-picking.

4. **True physical batches — PASS**
   - run `34213993759`, conclusion success;
   - distinct successful jobs:
     - `102022578491` batch 0;
     - `102022578501` batch 1;
     - `102022578543` batch 2;
     - `102022578485` batch 3;
   - workflow uses matrix-per-physical-batch with `strategy.max-parallel: 1`;
   - no runner spans multiple physical batches.

5. **Pacing / quota — PASS**
   - cooldowns: `5s, 5s, 8s, 3s`;
   - inter-request waits:
     - batch 0: `2786ms, 2293ms`;
     - batch 1: `1370ms, 1800ms`;
     - batch 2: `1148ms, 2193ms`;
     - batch 3: `1273ms, 1167ms`;
   - no trailing wait after final request;
   - authenticated quota preflight required exactly `3` requests per batch;
   - configured safe cap `500`, reserve `20`;
   - every batch reported enough-for-next-batch true;
   - no quota exhaustion or soft-ban anomaly.

6. **Response quality — PASS**
   - `2883` correctly became durable `unsupported_financial_model`, not a false successful general-industry FQ row;
   - the other 11 stocks completed;
   - historical missing periods remained explicitly classified for examples such as `6994`, `6934`, and `3135`;
   - no ambiguous/degraded result was persisted as a successful due quarter;
   - non-terminal statuses are rejected before checkpoint.

7. **Checkpoint durability — PASS**
   - batch commits:
     - `fb71adef8fe268f378ef973a0be9f3353a867faf`;
     - `a11a72a836978e0f1fec99f78f8711c1b4e1f8a8`;
     - `a27b6bda537a15baafb8aaa9cc1f6da7607f5be0`;
     - `948a693fe4edf23eb6c2bae92b8e1e3ea10ac91b`;
   - every batch pushed before its runner exited;
   - replay-on-latest-main logic preserved prior batches and unrelated state.

8. **Master propagation — PASS**
   - rebuild-master job `102025297689`: success;
   - one wave-level master commit: `a7ddc0a118e028b19492cfe0559421483a12d966`;
   - verifier reported `verified_stocks=11`, `skipped_unsupported=1` before push and again after reset to remote main;
   - no per-batch master rebuild occurred.

9. **Re-plan / resume — PASS**
   - replan job `102025868238`: success;
   - due before: `398`;
   - due after: `386`;
   - delta exactly `12`, matching all terminal selected stocks;
   - next queue was derived from newly committed main;
   - no automatic second wave executed.

10. **Regression / invariants — PASS**
    - real plan job `102021318078` passed FinMind freshness (`13` tests), master propagation (`5`), and frozen 8021 regression (`1`);
    - `[99 測試] Node Regression Suite #27`, run `34213929739`, head `32fee41d83089e0cbd4d43f29b59b57b5a7d0cbd`: success;
    - current production signal code still uses FAS `>=8` and FQ `>=10`;
    - strategy identity, anti-lookahead, signal date, and next-close semantics remain unchanged;
    - daily production path `.github/workflows/refresh-finmind-quarterly-financial-quality-due.yml` remains operational: scheduled run `34194643949` completed successfully with plan, five independent refresh jobs, one master rebuild, and durable propagation verification.

11. **Calibration — PASS**
    - the 4×3 wave completed without quota, pacing, response-quality, checkpoint, propagation, or runner-lifecycle anomalies;
    - evidence supports increasing only the number of sequential fresh-runner batches, not requests per runner;
    - next calibration:
      - `physical_batch_size=3` unchanged;
      - `max_physical_batches_per_wave=8`;
      - at most `24` terminal selected stocks per wave;
      - `strategy.max-parallel=1`;
      - cooldown remains randomized `3–8s`;
      - inter-request pacing remains randomized `1–3s`;
      - quota cap/reserve remain `500/20`;
      - one checkpoint per physical batch;
      - one master rebuild after the wave;
      - one post-wave re-plan and no automatic second wave.
    - current evidence-backed remaining backlog: `386`;
    - at 24 terminal stocks per wave this is approximately **17 waves** if daily maintenance does not reduce it further.

The round is closed PASS. No further change to `backlog-drain-wave-12-v1` is required.

### Active round — backlog-drain-wave-24-v1

#### Objective

Expand the proven backlog drain from 4 × 3 to **8 sequential physical batches × 3 stocks = at most 24 stocks** while preserving the exact safety model proven by the 12-stock wave.

#### Prompt A intermediate checkpoint — 2026-09-08

Prompt A is **not complete**. Implementation-only progress is durable on remote `main`; the required real 8×3 backlog wave has not yet been started from this agent because the available GitHub connection does not expose a new `workflow_dispatch` action.

Durable implementation evidence:

- `6b8ac1be5cb71d6ca3b340ab97f6bb0051589baf` — `ci: expand FinMind backlog wave to 24 stocks`.
- `.github/workflows/drain-finmind-quarterly-financial-quality-backlog.yml` now uses:
  - `max_physical_batches` default/fallback/guard = 8;
  - planner/refresh/re-plan `--max-due-stocks 24`;
  - post-wave re-plan `--max-physical-batches 8`.
- Frozen safety settings were re-read after the commit and remain present:
  - `physical_batch_size=3`;
  - `strategy.max-parallel: 1`;
  - randomized 3–8s batch-start cooldown;
  - randomized 1–3s inter-request pacing via `--delay-ms 1000 --jitter-ms 2000`;
  - quota cap/reserve 500/20;
  - wave-scoped checkpoint identity and one wave-level master rebuild remain unchanged.

Remaining Prompt A work, in order:

1. Dispatch `[07 研究] FinMind－季財報品質 backlog physical-batch wave` from current remote `main` with the promoted defaults (3 stocks × max 8 physical batches).
2. Verify the fresh planner count and selected <=24 stocks from committed state.
3. Let every selected physical batch finish/checkpoint on its own fresh runner; if a bounded defect occurs, fix only that defect and rerun the same max-8×3 round.
4. Verify one master rebuild, durable remote propagation, post-wave re-plan, regressions/Node Regression Suite, daily production path, and all Prompt A completion evidence.
5. Update this handoff with run/head SHA, wave id, jobs, pacing/quota/checkpoint/master/re-plan evidence, then report exactly `Prompt A complete — ready for Prompt B`.


Current baseline at promotion:

- current due backlog: **386**;
- `physical_batch_size=3`;
- next wave maximum: `8` physical batches / `24` stocks;
- `strategy.max-parallel=1`;
- no increase in requests per fresh runner;
- no change to FinMind quota cap/reserve;
- wave-scoped durable checkpoint identity already exists and must remain mandatory.

#### Exact entry points

- `AGENTS.md`
- `docs/agent-prompts/task-routing.json`
- `docs/handoffs/finmind-quarterly-financial-quality-freshness.md`
- `scripts/backfill_finmind_quarterly_financial_quality_batch.js`
- `.github/workflows/drain-finmind-quarterly-financial-quality-backlog.yml`
- `.github/workflows/refresh-finmind-quarterly-financial-quality-due.yml`
- `scripts/check_finmind_api_quota.js`
- `scripts/build_financial_quality_master.js`
- `scripts/verify_financial_quality_master_propagation.js`
- `data_prediction_analysis/quarterly-financial-quality/financial-quality-master.json`
- `data_prediction_analysis/quarterly-financial-quality/batch-status/`
- `tests/finmind_quarterly_freshness.test.js`
- `tests/financial_quality_master_propagation.test.js`
- `tests/fundamental_quality_8021_regression.test.js`
- `.github/workflows/test-node-regression-suite.yml`

#### Frozen architecture — backlog-drain-wave-24-v1

- `physical_batch_size=3`.
- `max_physical_batches_per_wave=8`.
- at most 24 selected terminal stocks.
- `strategy.max-parallel: 1`.
- one matrix item = one fresh runner physical batch.
- randomized 3–8s batch-start cooldown.
- randomized 1–3s inter-request pacing; no trailing delay.
- quota preflight proportional to actual batch request_count.
- configured safe cap/reserve remain 500/20 unless a stricter safe value is required by current API evidence.
- wave-scoped `wave_id` checkpoint filenames/metadata remain mandatory.
- checkpoint/push every physical batch before runner exit.
- one wave-level master rebuild only after all selected batches succeed.
- final remote propagation verification.
- post-wave re-plan from committed main.
- no automatic second wave.
- do not raise physical batch size above 3.
- do not increase parallelism.
- preserve daily workflow and FAS/FQ/anti-lookahead/next-close invariants.

#### Prompt A completion contract — backlog-drain-wave-24-v1

Prompt A is complete only when:

1. current remote main/routing/handoff identity is fresh and this round is active.
2. workflow bound is expanded only from max 4 to max 8 physical batches; physical batch size remains <=3.
3. a fresh current due count is derived from committed main; do not blindly reuse 386 if daily maintenance has advanced.
4. at most 24 deterministic due stocks are selected and grouped into max 8×3 physical batches.
5. every selected matrix batch runs as its own fresh GitHub runner with `max-parallel=1`.
6. every batch proves proportional quota preflight, 3–8s cooldown, 1–3s inter-request pacing, structural response validation, unique wave-scoped checkpoint, race-safe push, and runner exit.
7. unsupported financial models remain durable terminal classifications and disappear from future due plans without requiring a fake timeline.
8. no non-terminal failure is checkpointed as success.
9. all prior wave/canary status artifacts remain unchanged.
10. one master rebuild occurs after the complete successful wave and final remote propagation verification passes for all supported selected stocks while explicitly accounting for unsupported terminals.
11. post-wave re-plan reconciles before/after due counts with terminal statuses and does not auto-run another wave.
12. deterministic FinMind/master/8021 tests and Node Regression Suite pass on the implementation/runtime evidence required by the round.
13. daily production FinMind workflow remains operational.
14. canonical handoff records run/head SHA, wave id, planner counts, exact batch groups/job IDs, cooldowns/jitter/quota evidence, terminal classifications, checkpoint commits/paths, master commit, propagation result, post-wave due count, anomalies, and artifact-preservation evidence.
15. re-fetch current remote main and verify durability.
16. report exactly `Prompt A complete — ready for Prompt B` and stop.

If a bounded defect appears, fix only that defect and rerun the same max 8×3 protocol. Do not increase beyond 24 stocks in this round.

#### Prompt A — backlog-drain-wave-24-v1

Execute only round `backlog-drain-wave-24-v1`.

Startup:

1. Fetch current remote main.
2. Read `AGENTS.md`, root `promptA.md`, `docs/agent-prompts/prompt-a-runner.md`, `docs/agent-prompts/task-routing.json`, and this canonical handoff.
3. Verify `finmind-quarterly-financial-quality-freshness` remains the unique active project and this round is the promoted active round.
4. Re-read all exact entry points and frozen architecture above.
5. Recompute current due backlog from committed main.

Implementation/execution:

- minimally raise the backlog workflow's `max_physical_batches` guard/default from 4 to 8 and `max_due_stocks` bound from 12 to 24;
- do not change `physical_batch_size=3`;
- do not change `strategy.max-parallel=1`;
- preserve wave-id naming and prior artifact immutability;
- create one deterministic bounded wave from current due state, at most 24 stocks;
- one matrix entry = one fresh-runner physical batch;
- keep 3–8s cooldown and 1–3s request jitter;
- quota preflight must use each batch's actual request_count;
- validate structural output quality before checkpoint;
- checkpoint/push each physical batch before runner exit using latest-main race-safe replay;
- after all selected batches succeed, rebuild master once, verify, push, reset to current remote main, verify again;
- re-plan from committed main and record the new due count;
- do not automatically run another wave;
- preserve daily workflow and all production strategy/anti-lookahead invariants.

Run deterministic FinMind/master/8021 tests and Node Regression Suite as required. Update this handoff with durable Prompt A evidence while preserving the exact preregistered Prompt B below.

#### Prompt A completion evidence — backlog-drain-wave-24-v1 — 2026-09-09

**Prompt A complete — ready for Prompt B**

Real bounded runtime wave completed successfully and is durable on remote `main`.

- Workflow: `[07 研究] FinMind－季財報品質 backlog physical-batch wave #5`
- Run id: `34330511902`
- Trigger head SHA: `8fedd79d9ef2e4a1025040748bebb934d0717068`
- Wave id: `run-34330511902`
- Run conclusion: **success**
- Planner due candidates before wave: **352**
- Deterministic selected stocks: **24**
- Physical layout: **8 fresh-runner batches × 3 stocks**
- Post-wave due candidates: **328**
- Reconciled delta: **24**, exactly matching all selected terminal results
- No automatic second wave ran.

Batch groups / jobs / checkpoints:

- batch 0 — job `102399065862` — `1529,2404,6869` — cooldown 8s — waits 2015ms / 2819ms — checkpoint `87a03bf8d3c0aa05350cc3948fbedb321142ef70`
- batch 1 — job `102399065906` — `9945,1522,7740` — cooldown 5s — waits 2615ms / 2395ms — checkpoint `871f9c372375289022c3f32ecc41e5fb997b5bb1`
- batch 2 — job `102399065840` — `3036,3443,1472` — cooldown 6s — waits 1746ms / 1277ms — checkpoint `56e3d7d02d06147ac730bd26492b3fddced01828`
- batch 3 — job `102399065905` — `2442,5534,6533` — cooldown 8s — waits 1890ms / 2152ms — checkpoint `cbba2ec0aaef0e4c9333eed1b05d6c310d8d7dbd`
- batch 4 — job `102399065897` — `6657,6691,2258` — cooldown 5s — waits 1029ms / 2236ms — checkpoint `228fad97c29bd6191bea717fd2cccfd21f70d63c`
- batch 5 — job `102399065868` — `2344,8114,1533` — cooldown 5s — waits 2569ms / 2489ms — checkpoint `0d14343d1b2c9fcb417ed474a8daa8935e58af65`
- batch 6 — job `102399065848` — `3450,6283,2414` — cooldown 8s — waits 2021ms / 2864ms — checkpoint `c7579562d8184087d3a51f4fe52b47480455fb17`
- batch 7 — job `102399065956` — `6139,1439,2485` — cooldown 8s — waits 2061ms / 2234ms — checkpoint `59e12f3b44200e9876a161184ee1cee030730eb4`

Runtime safety / quality evidence:

- every physical batch was a distinct matrix job / fresh runner;
- `strategy.max-parallel=1` remained enforced;
- every quota preflight used actual `request_count=3`;
- configured safe cap/reserve remained `500/20`;
- all batches reported `enough_for_next_batch=true`;
- all 24 selected results were durable terminal `complete`;
- historical missing periods remained explicitly classified where present, e.g. `7740`;
- no non-terminal or ambiguous/degraded result was checkpointed;
- every wave checkpoint uses unique wave-scoped paths:
  `data_prediction_analysis/quarterly-financial-quality/batch-status/due-refresh-2026-09-09-wave-run-34330511902-batch000..007.json`;
- earlier canary / 12-stock-wave artifacts were not reused or overwritten.

Master / re-plan evidence:

- master job `102405321819`: **success**;
- exactly one wave-level master publication commit:
  `ceea1eac9bab16e1dea2b8c643add3b469ff7ec0`;
- master propagation verifier reported `verified_stocks=24` before and after durable remote reset;
- re-plan job `102405927436`: **success**;
- due count `352 -> 328`, delta `24`;
- fresh re-plan still produces max 8×3 only and did not auto-dispatch another wave.

Regression / production-path evidence:

- planner job `102397745726` passed deterministic FinMind freshness, physical-batch identity, unsupported-model, master propagation, and frozen 8021 regressions before runtime execution;
- `[99 測試] Node Regression Suite #33`, run `34330795035`: **PASS**;
- latest daily production FinMind workflow `[07 研究] FinMind－季財報品質到期刷新 #5`, run `34324652707`: **PASS**;
- FAS >= 8, FQ >= 10, strategy identity, anti-lookahead, signal-date semantics, and next-close policy remain unchanged.

Concurrent changes during the wave included unrelated TWSE / Pocket / Pages commits. Race-safe latest-main checkpoint replay preserved them; none invalidated this round's FinMind assumptions.

#### Preregistered Prompt B — backlog-drain-wave-24-v1

Close out round `backlog-drain-wave-24-v1`.

This Prompt B is preregistered before Prompt A begins and must not be rewritten to fit results.

Verify independently:

1. **Fresh identity**
   - fresh remote main/routing/handoff;
   - recover this exact preregistered Prompt B;
   - classify concurrent changes.
2. **Planner / bound**
   - fresh due count from committed state;
   - deterministic selection <=24 stocks;
   - max 8 physical batches × 3 stocks;
   - no outcome cherry-picking.
3. **True physical batches**
   - one distinct job/runner lifecycle per selected matrix batch;
   - `max-parallel=1`;
   - no runner spans multiple batches.
4. **Wave identity / history**
   - every new checkpoint is wave-scoped;
   - prior canary and 12-stock-wave blobs remain unchanged;
   - same-day waves cannot overwrite one another.
5. **Pacing / quota**
   - each cooldown 3–8s;
   - actual inter-request waits 1–3s and absent after final request;
   - authenticated quota guard uses actual request_count;
   - safe cap/reserve remain 500/20 or stricter;
   - no quota/soft-ban anomaly.
6. **Response quality / terminals**
   - supported selected stocks have structurally valid durable source/coverage/timeline;
   - unsupported financial models are explicit durable terminal coverage markers;
   - historical missing data remains explicitly classified;
   - no degraded/ambiguous API result is persisted as success;
   - no non-terminal failure is checkpointed.
7. **Checkpoint durability**
   - every physical batch pushes a unique bounded checkpoint before runner exit;
   - race-safe replay preserves earlier batches and unrelated concurrent commits.
8. **Master propagation**
   - exactly one wave-level master publication after successful batches;
   - final remote verifier passes for all supported selected stocks and accounts explicitly for unsupported terminals.
9. **Re-plan / resume**
   - fresh post-wave plan uses committed main;
   - terminal selected stocks disappear from due queue;
   - before/after due counts reconcile;
   - no automatic second wave.
10. **Regression / invariants**
    - FinMind freshness/master/8021 regressions PASS;
    - Node Regression Suite PASS on the relevant final implementation/runtime evidence;
    - daily production path remains operational;
    - FAS >=8, FQ >=10, strategy identity, anti-lookahead, signal date, and next-close policy unchanged.
11. **Calibration**
    - use the 24-stock real wave to decide whether another increase in sequential batches is justified;
    - do not increase physical batch size above 3 without new explicit evidence;
    - do not increase parallelism above 1;
    - record remaining due backlog and estimated waves.

If any criterion fails, fix only the bounded defect and restart this same Prompt B from criterion 1. Do not promote another round.

If all PASS:

- record `Prompt B closeout: PASS`;
- record evidence-backed next calibration;
- preregister/promote another bounded drain round only if backlog remains;
- commit handoff;
- re-fetch current main and verify durability;
- stop without executing the next Prompt A.

#### Prompt B closeout — backlog-drain-wave-24-v1 — 2026-09-09

**Prompt B closeout: PASS**

This closeout used the phase-specific Prompt B preregistered before Prompt A at durable promotion commit `d1a43dd940d9f1f551a037ba5cbccc59501a5128`. Prompt A implementation began afterward at `6b8ac1be5cb71d6ca3b340ab97f6bb0051589baf`. Current routing still has `finmind-quarterly-financial-quality-freshness` as the sole active task.

Independent acceptance results:

1. **Fresh identity — PASS**
   - current remote main was re-fetched;
   - Prompt B identity was recovered from pre-Prompt-A durable history;
   - the post-Prompt-A concurrent commit `f3a355068091a267dc9615d6d28d49f101872492` is unrelated TAIFEX data and does not stale this round.

2. **Planner / bound — PASS**
   - run `34330511902` planner job `102397745726` derived **352** due candidates from committed state;
   - deterministic selected count was **24**;
   - exactly **8 physical batches × 3 stocks** were planned;
   - no outcome-based selection or cherry-picking was observed.

3. **True physical batches — PASS**
   - eight distinct successful matrix jobs were used:
     `102399065862`, `102399065906`, `102399065840`, `102399065905`,
     `102399065897`, `102399065868`, `102399065848`, `102399065956`;
   - workflow still enforces `strategy.max-parallel: 1`;
   - one matrix item is one runner lifecycle; no runner spans multiple physical batches.

4. **Wave identity / history — PASS**
   - all new checkpoints are wave-scoped under
     `due-refresh-2026-09-09-wave-run-34330511902-batch000..007.json`;
   - legacy canary blobs remain unchanged:
     - `due-refresh-2026-09-08-batch000.json` = `a16e28ad412615f857622af01490325377b67e42`;
     - `due-refresh-2026-09-08-batch001.json` = `3165810bb379e1e5d5bd99b339b75df80fd4e818`;
   - all four prior 12-stock wave blobs match their original checkpoint-commit blobs exactly;
   - same-day wave overwrite protection therefore remains intact.

5. **Pacing / quota — PASS**
   - cooldowns by batch: **8, 5, 6, 8, 5, 5, 8, 8 seconds**;
   - actual inter-request waits:
     - b0 `2015/2819ms`
     - b1 `2615/2395ms`
     - b2 `1746/1277ms`
     - b3 `1890/2152ms`
     - b4 `1029/2236ms`
     - b5 `2569/2489ms`
     - b6 `2021/2864ms`
     - b7 `2061/2234ms`;
   - each three-stock batch produced exactly two waits, so no trailing post-final-request delay occurred;
   - authenticated quota guard used actual `required_requests=3` on every batch;
   - configured cap/reserve remained `500/20`;
   - every batch reported enough quota; no quota or soft-ban anomaly appeared.

6. **Response quality / terminals — PASS**
   - all 24 selected stocks reached durable terminal `complete`;
   - checkpoint code rejects any result outside `complete`, `skipped_complete`, or `unsupported_financial_model`;
   - historical gaps remained explicit where applicable, including `7740`;
   - no non-terminal/degraded result was checkpointed as success;
   - the master propagation verifier independently validated all 24 selected stocks against durable source/timeline/master state.

7. **Checkpoint durability — PASS**
   - eight batch checkpoint commits were pushed before runner exit:
     `87a03bf8d3c0aa05350cc3948fbedb321142ef70`,
     `871f9c372375289022c3f32ecc41e5fb997b5bb1`,
     `56e3d7d02d06147ac730bd26492b3fddced01828`,
     `cbba2ec0aaef0e4c9333eed1b05d6c310d8d7dbd`,
     `228fad97c29bd6191bea717fd2cccfd21f70d63c`,
     `0d14343d1b2c9fcb417ed474a8daa8935e58af65`,
     `c7579562d8184087d3a51f4fe52b47480455fb17`,
     `59e12f3b44200e9876a161184ee1cee030730eb4`;
   - latest-main replay preserved unrelated TWSE/Pocket/Pages commits during the wave.

8. **Master propagation — PASS**
   - rebuild-master job `102405321819`: success;
   - exactly one wave-level master publication commit:
     `ceea1eac9bab16e1dea2b8c643add3b469ff7ec0`;
   - propagation verifier reported `verified_stocks=24` at all three verification points, including after reset to durable remote main.

9. **Re-plan / resume — PASS**
   - re-plan job `102405927436`: success;
   - committed-state due count changed **352 → 328**;
   - delta **24** exactly reconciles all terminal selected stocks;
   - no automatic second wave ran.

10. **Regression / invariants — PASS**
    - real planner job passed FinMind freshness, master propagation, wave identity/unsupported handling, and frozen 8021 regressions;
    - `[99 測試] Node Regression Suite #33`, run `34330795035`: success;
    - daily production `[07 研究] FinMind－季財報品質到期刷新 #5`, run `34324652707`: success;
    - current production signal code still qualifies only at FAS `>=8` and FQ `>=10`;
    - strategy identity, anti-lookahead, signal-date semantics, and next-close policy remain unchanged.

11. **Calibration — PASS**
    - the 24-stock wave showed no runner-lifecycle, quota, pacing, checkpoint, response-quality, propagation, or re-plan anomaly;
    - evidence supports increasing **only sequential fresh-runner batch count** again;
    - next calibration:
      - `physical_batch_size=3` unchanged;
      - `max_physical_batches_per_wave=16`;
      - at most **48 stocks** per wave;
      - `strategy.max-parallel=1` unchanged;
      - cooldown remains randomized 3–8s;
      - per-request pacing remains randomized 1–3s;
      - quota cap/reserve remain 500/20;
      - wave-scoped checkpoint after every physical batch;
      - exactly one master rebuild after the wave;
      - one post-wave re-plan;
      - no automatic second wave.
    - evidence-backed remaining backlog is **328**;
    - at 48 terminal stocks per wave, approximately **7 bounded waves** remain if daily maintenance does not reduce the queue first.

The round is closed PASS. Do not execute another 24-stock Prompt A.

### Active round — backlog-drain-wave-48-v1

#### Objective

Calibrate the proven backlog drain from 8 × 3 to **16 sequential fresh-runner physical batches × 3 stocks = at most 48 stocks**, without changing requests per runner, parallelism, quota reserve, pacing, wave identity, checkpoint semantics, or production strategy rules.

#### Exact entry points

- `AGENTS.md`
- `docs/agent-prompts/task-routing.json`
- `docs/handoffs/finmind-quarterly-financial-quality-freshness.md`
- `.github/workflows/drain-finmind-quarterly-financial-quality-backlog.yml`
- `.github/workflows/refresh-finmind-quarterly-financial-quality-due.yml`
- `scripts/backfill_finmind_quarterly_financial_quality_batch.js`
- `scripts/check_finmind_api_quota.js`
- `scripts/build_financial_quality_master.js`
- `scripts/verify_financial_quality_master_propagation.js`
- `data_prediction_analysis/quarterly-financial-quality/financial-quality-master.json`
- `data_prediction_analysis/quarterly-financial-quality/batch-status/`
- `tests/finmind_quarterly_freshness.test.js`
- `tests/financial_quality_master_propagation.test.js`
- `tests/fundamental_quality_8021_regression.test.js`
- `.github/workflows/test-node-regression-suite.yml`

#### Frozen architecture — backlog-drain-wave-48-v1

- `physical_batch_size=3`.
- `max_physical_batches_per_wave=16`.
- at most 48 selected terminal stocks.
- `strategy.max-parallel=1`.
- one matrix item = one fresh runner.
- randomized 3–8s batch-start cooldown.
- randomized 1–3s inter-request pacing and no trailing delay.
- quota preflight uses each matrix batch's actual request count.
- configured safe cap/reserve remain 500/20 unless current API evidence requires stricter limits.
- wave-scoped checkpoint filename/metadata remains mandatory.
- checkpoint and push every batch before runner exit.
- race-safe replay onto latest committed main.
- one master rebuild only after every selected batch succeeds.
- final remote propagation verification.
- one post-wave re-plan from committed main.
- no automatic second wave.
- do not increase physical batch size above 3.
- do not increase parallelism above 1.
- preserve daily workflow plus FAS/FQ, anti-lookahead, signal-date and next-close invariants.

#### Prompt A completion contract — backlog-drain-wave-48-v1

Prompt A is complete only when:

1. fresh remote main/routing/handoff identifies this as the active promoted round;
2. backlog workflow bound is changed only from max 8 to max 16 physical batches and max due selection from 24 to 48;
3. physical batch size remains <=3 and `max-parallel=1`;
4. fresh due count is computed from committed main rather than reusing 328 blindly;
5. at most 48 deterministic due stocks are selected into max 16×3 batches;
6. every selected batch runs in its own fresh runner and proves 3–8s cooldown, 1–3s request pacing, proportional quota guard, structural validation, wave-scoped checkpoint, push, and runner exit;
7. unsupported financial models remain explicit durable terminal classifications;
8. no non-terminal/degraded result is checkpointed;
9. all old canary, 12-stock-wave, and 24-stock-wave artifacts remain immutable;
10. exactly one master publication occurs after all selected batches succeed and final durable remote verifier passes;
11. committed-state post-wave re-plan reconciles before/after due counts and does not auto-start another wave;
12. FinMind/master/8021 regressions and Node Regression Suite pass;
13. daily FinMind production path remains operational;
14. handoff records run/head SHA, wave id, planner counts, exact batch groups/jobs, pacing/quota evidence, terminals, checkpoint commits/paths, master commit, verifier, re-plan result, anomalies, and historical artifact preservation;
15. current remote main is re-fetched and durable evidence remains fresh;
16. report exactly `Prompt A complete — ready for Prompt B` and stop.

If a bounded defect appears, fix only that defect and rerun the same max-16×3 round. Do not increase beyond 48 stocks in this round.

#### Prompt A — backlog-drain-wave-48-v1

Execute only round `backlog-drain-wave-48-v1`.

Startup:

1. Fetch current remote main.
2. Read `AGENTS.md`, root `promptA.md`, `docs/agent-prompts/prompt-a-runner.md`, `docs/agent-prompts/task-routing.json`, and this canonical handoff.
3. Verify `finmind-quarterly-financial-quality-freshness` remains the unique active project and this round is active.
4. Re-read the exact entry points and frozen architecture above.
5. Recompute current due backlog from committed main.

Implementation/execution:

- minimally raise `.github/workflows/drain-finmind-quarterly-financial-quality-backlog.yml` maximum/default from 8 to 16 physical batches and max due bound from 24 to 48;
- keep `physical_batch_size=3`;
- keep `strategy.max-parallel=1`;
- preserve 3–8s cooldown, 1–3s inter-request pacing, quota cap/reserve 500/20, wave identity, structural validation and latest-main replay;
- produce one deterministic current-state wave of at most 48 stocks;
- one matrix entry must remain one fresh runner;
- checkpoint each physical batch before runner exit;
- after all batches succeed, rebuild master exactly once, verify, push, reset to current remote main, and verify again;
- post-wave re-plan from committed main;
- do not automatically start a second wave;
- preserve daily workflow and production strategy/anti-lookahead invariants;
- run the required deterministic tests and Node Regression Suite.

Update this handoff with durable Prompt A evidence while preserving the exact preregistered Prompt B below.

#### Prompt A progress — backlog-drain-wave-48-v1 — 2026-09-09

Prompt A has started but is **not complete**.

Durable implementation evidence:

- `60953e4fdc24b713ac56e71647d73cf035677eac` — minimally expands `.github/workflows/drain-finmind-quarterly-financial-quality-backlog.yml` from max/default 8 to 16 physical batches and from max 24 to 48 selected due stocks.
- Verified on current remote `main` after the commit:
  - `physical_batch_size` remains capped at 3;
  - `strategy.max-parallel: 1` remains unchanged;
  - randomized batch cooldown remains 3–8s;
  - inter-request pacing remains 1–3s with existing no-trailing-delay behavior;
  - quota cap/reserve remain 500/20 and per-batch request count stays proportional;
  - wave-scoped checkpointing, latest-main replay, one master rebuild, final propagation verification, and post-wave re-plan remain in place.
- Global routing still selects `finmind-quarterly-financial-quality-freshness` as the unique active task.

Blocked completion evidence:

- The connected GitHub toolset available to this agent does not expose a workflow-dispatch operation, so the required real `backlog-drain-wave-48-v1` run cannot be started from this agent.
- Therefore no fresh planner count, 16×3 batch run/job IDs, pacing/quota logs, checkpoint commits, master publication commit, post-wave re-plan, or Node Regression Suite result for this new 48-stock round is fabricated or claimed.
- Prompt A remains active and must continue with the same preregistered contract once the workflow is manually dispatched or another authorized runner can dispatch it.

Do not promote another round and do not execute Prompt B yet.

#### Prompt A completion evidence — backlog-drain-wave-48-v1 — 2026-09-09

**Prompt A complete — ready for Prompt B**

Durable implementation / execution evidence:

- Workflow bound commit: `60953e4fdc24b713ac56e71647d73cf035677eac`.
  - `max_physical_batches` default/ceiling: 8 → 16.
  - `max_due_stocks`: 24 → 48.
  - `physical_batch_size=3` unchanged.
  - `strategy.max-parallel=1` unchanged.
  - 3–8s batch cooldown, 1–3s inter-request pacing, quota cap/reserve 500/20, wave-scoped checkpoints, latest-main replay, one master rebuild, and one post-wave re-plan unchanged.
- Real backlog wave run: `34336822092`.
  - planner job: `102418061360`.
  - planner checked out fresh committed main at `11d48d77cefffbdc51f227d00b2bfc38386c3193`.
  - due candidates: **328**.
  - selected: **48**.
  - physical batches: **16 × 3**.
  - deterministic stock order:
    `2712,2820,1418,1808,2427,2466,2545,3018,6024,1442,1456,2501,6589,2515,6782,4164,6614,6937,8033,2330,2882,5521,2364,2891,3033,7786,9906,2524,6658,6177,3717,2376,2881,2429,2542,6209,2208,2527,2905,6969,7730,2538,6472,6909,8249,3164,2889,3025`.
- True physical-batch runner evidence:
  - batch 0 job `102419504863`
  - batch 1 job `102419504837`
  - batch 2 job `102419504839`
  - batch 3 job `102419504793`
  - batch 4 job `102419504812`
  - batch 5 job `102419504854`
  - batch 6 job `102419504814`
  - batch 7 job `102419504789`
  - batch 8 job `102419504798`
  - batch 9 job `102419504827`
  - batch 10 job `102419504832`
  - batch 11 job `102419506070`
  - batch 12 job `102419506138`
  - batch 13 job `102419506235`
  - batch 14 job `102419506380`
  - batch 15 job `102419506324`
  - all 16 jobs completed successfully and each matrix item was one runner lifecycle.
- Pacing / quota:
  - cooldowns by batch: `3,8,4,3,3,4,3,4,8,8,7,6,3,4,7,8` seconds.
  - actual inter-request waits:
    - b0 `2496/1361ms`
    - b1 `1446/2198ms`
    - b2 `1314/2227ms`
    - b3 `1068/2282ms`
    - b4 `2085/2346ms`
    - b5 `1792/2660ms`
    - b6 `1381/2215ms`
    - b7 `2237/1430ms`
    - b8 `2062/1659ms`
    - b9 `1567/2584ms`
    - b10 `1419/1366ms`
    - b11 `1044/1042ms`
    - b12 `2538/1494ms`
    - b13 `1135/1363ms`
    - b14 `1607/2142ms`
    - b15 `1756/1481ms`
  - every 3-stock batch emitted exactly two waits; no trailing delay.
  - every batch quota preflight used `required_requests=3`, cap/reserve `500/20`, and reported enough quota.
- Terminal results:
  - **41 complete**.
  - **7 unsupported_financial_model**: `2820,6024,2882,2891,2881,2905,2889`.
  - total terminal results = 48.
  - no non-terminal/degraded result was checkpointed.
- Durable batch checkpoint commits:
  - b0 `91d34af8622bebfdbc0c7c602675a0e93a0aada4`
  - b1 `022d1d9820a22ecebd612f3af398b451e86081d7`
  - b2 `3e53172c5de5f69fe01ad2577bdd79823659eada`
  - b3 `c1160e637fb9aa37597004ae95f255b75f735808`
  - b4 `29dbe27bd21643d04706c2fc11f224db6d5e3ae1`
  - b5 `4021c9cc54b910531c31e7755c9bc4546373f1e5`
  - b6 `4395d6972bc357d6ff9c1414f650a534fb11fc97`
  - b7 `c769700ebfdf584b1c9895090957888740d59b96`
  - b8 `2c8d489eb4c79be2a971d1e1e20df165de34ac36`
  - b9 `0eb3ebb80c8fab66e32386ba285b942d0d7146ce`
  - b10 `cae86e5d8a0b9971a66af8c11d45b40fdc82ee78`
  - b11 `51b39b5a4865031525d4235dd0c60af512caeb8b`
  - b12 `d7bb2b3fff60da65902b4b88781669679b1cb821`
  - b13 `65d9ba77112ae2c5c3f6c25fe1b910ce771f2ce5`
  - b14 `aae2b574e044dbfbc123fe21c0d0b8a15052dad7`
  - b15 `9e4ae55a6cd6595f526f709476bb889c9090234e`
  - all new status files are wave-scoped under `due-refresh-2026-09-09-wave-run-34336822092-batch000..015.json`.
  - prior canary / 12-stock / 24-stock status artifacts were not targeted by this run; the new run wrote a distinct wave id and new batch paths.
- Master propagation:
  - rebuild-master job `102430336080`: success.
  - exactly one master publication commit: `0f0d7febdae1d1b6cf5bc5d474d56602528d904a`.
  - verifier passed before publication, during latest-main retry, and again after reset to durable remote main.
  - verifier reported `verified_stocks=41`; the remaining 7 selected stocks were explicit durable unsupported terminals.
- Re-plan / resume:
  - replan job `102430897367`: success.
  - committed due count: **328 → 280**.
  - delta = **48**, exactly reconciling the 48 terminal selected stocks.
  - no automatic second wave executed.
- Regression / invariants:
  - the planner job ran and passed the deterministic FinMind freshness, master propagation, and frozen 8021 regression tests on the current workflow run.
  - no scripts/tests/production strategy files changed in this round; only the backlog workflow bound changed.
  - the most recent applicable full `[99 測試] Node Regression Suite` evidence remains run `34330795035` from the immediately preceding 24-stock calibration, which PASSed the unchanged scripts/tests. The suite was not automatically retriggered by `60953e4f...` because its path filter does not include `.github/workflows/drain-finmind-quarterly-financial-quality-backlog.yml`.
  - an attempted local clone to rerun `npm test` from this agent was blocked by the execution container's lack of GitHub DNS/network access; no false CI result is claimed.
  - daily FinMind production path remains represented by same-day successful run `34324652707` from the prior closeout; this round did not modify the daily workflow or production signal code.
  - FAS>=8, FQ>=10, strategy identity, anti-lookahead, signal-date semantics, and next-close policy were not changed.
- Concurrent changes observed during the real wave included unrelated Stock Rankings and Pocket/TWSE data commits. Latest-main replay preserved them while the 16 FinMind checkpoints and master publication were pushed.

Prompt A is complete for the 48-stock calibration round. Prompt B must independently verify these claims against current remote main and the preregistered acceptance criteria below.

#### Preregistered Prompt B — backlog-drain-wave-48-v1

Close out round `backlog-drain-wave-48-v1`.

This Prompt B is preregistered before Prompt A begins and must not be rewritten to fit results.

Verify independently:

1. **Fresh identity** — fresh remote main/routing/handoff; recover this exact preregistered Prompt B; classify concurrent changes.
2. **Planner / bound** — fresh committed due count; deterministic selection <=48; max 16 physical batches ×3; no outcome cherry-picking.
3. **True physical batches** — one distinct job/runner lifecycle per matrix batch; `max-parallel=1`; no runner spans batches.
4. **Wave identity / history** — new checkpoints wave-scoped; all canary/12/24-wave blobs unchanged; same-day waves cannot overwrite.
5. **Pacing / quota** — each cooldown 3–8s; actual waits 1–3s with no trailing wait; quota guard uses actual request count; cap/reserve 500/20 or stricter; no quota/soft-ban anomaly.
6. **Response quality / terminals** — durable structural source/coverage/timeline for supported stocks; explicit unsupported terminals; historical missing remains explicit; no degraded/non-terminal checkpoint.
7. **Checkpoint durability** — every batch pushes unique checkpoint before runner exit; race-safe replay preserves prior batches and unrelated commits.
8. **Master propagation** — exactly one wave-level master publication; final remote verifier passes for supported selected stocks and accounts for unsupported terminals.
9. **Re-plan / resume** — fresh post-wave committed plan; terminal selected stocks disappear; before/after counts reconcile; no automatic second wave.
10. **Regression / invariants** — FinMind/master/8021 regressions and Node Regression Suite PASS; daily path operational; FAS>=8, FQ>=10, strategy identity, anti-lookahead, signal date and next-close unchanged.
11. **Calibration** — use real 48-stock evidence to decide the next sequential-batch ceiling; never raise physical batch size >3 or parallelism >1 without new explicit evidence; record remaining backlog and estimated bounded waves.

If any criterion fails, fix only the bounded defect and restart this same Prompt B from criterion 1. Do not promote another round.

If all PASS:

- record `Prompt B closeout: PASS`;
- record evidence-backed next calibration;
- preregister/promote another bounded drain round only if backlog remains;
- commit handoff;
- re-fetch current main and verify durability;
- stop without executing the next Prompt A.

#### Prompt B closeout — backlog-drain-wave-48-v1 — 2026-09-09

**Prompt B closeout: PASS**

This closeout used the exact phase-specific Prompt B preregistered before Prompt A in durable promotion commit `1c4e1f81f7c385dc87cc340f660700d554d666ea`. Current global routing still has `finmind-quarterly-financial-quality-freshness` as the unique active project. No future-round Prompt B was substituted.

Independent acceptance results:

1. **Fresh identity — PASS**
   - current remote `main`, routing registry, Prompt B runner, and canonical handoff were re-read;
   - target round was correctly identified as `backlog-drain-wave-48-v1`: Prompt A durable complete, Prompt B not yet closed;
   - post-run concurrent writes were classified as unrelated market/data updates and did not stale the FinMind backlog-wave contract.

2. **Planner / bound — PASS**
   - real workflow run: `34336822092`;
   - planner job: `102418061360`;
   - planner checked out committed main and computed **328** due candidates;
   - deterministic selected count: **48**;
   - grouping: exactly **16 physical batches × 3 stocks**;
   - no outcome-based cherry-picking was observed.

3. **True physical batches — PASS**
   - 16 distinct successful matrix jobs were used:
     `102419504863, 102419504837, 102419504839, 102419504793,`
     `102419504812, 102419504854, 102419504814, 102419504789,`
     `102419504798, 102419504827, 102419504832, 102419506070,`
     `102419506138, 102419506235, 102419506380, 102419506324`;
   - `strategy.max-parallel: 1` remains current on remote main;
   - one matrix entry remained one runner lifecycle; no runner spanned multiple physical batches.

4. **Wave identity / history — PASS**
   - all 48-stock checkpoints are uniquely wave-scoped as
     `due-refresh-2026-09-09-wave-run-34336822092-batch000..015.json`;
   - legacy canary blobs were independently compared against their historical commit state and remain byte-identical:
     - `due-refresh-2026-09-08-batch000.json` blob `a16e28ad412615f857622af01490325377b67e42`;
     - `due-refresh-2026-09-08-batch001.json` blob `3165810bb379e1e5d5bd99b339b75df80fd4e818`;
   - all four prior 12-stock wave checkpoint blobs were compared against their original checkpoint commits and are unchanged;
   - all eight prior 24-stock wave checkpoint blobs were compared against their original checkpoint commits and are unchanged;
   - same-day wave overwrite protection remains proven.

5. **Pacing / quota — PASS**
   - batch-start cooldowns: `3,8,4,3,3,4,3,4,8,8,7,6,3,4,7,8` seconds, all within 3–8s;
   - every 3-stock batch emitted exactly two inter-request waits, all within 1–3s:
     - b0 `2496/1361ms`
     - b1 `1446/2198ms`
     - b2 `1314/2227ms`
     - b3 `1068/2282ms`
     - b4 `2085/2346ms`
     - b5 `1792/2660ms`
     - b6 `1381/2215ms`
     - b7 `2237/1430ms`
     - b8 `2062/1659ms`
     - b9 `1567/2584ms`
     - b10 `1419/1366ms`
     - b11 `1044/1042ms`
     - b12 `2538/1494ms`
     - b13 `1135/1363ms`
     - b14 `1607/2142ms`
     - b15 `1756/1481ms`;
   - no trailing wait occurred after the final stock;
   - each batch quota guard used actual `required_requests=3`, configured cap/reserve `500/20`, and reported enough quota;
   - no quota exhaustion, soft-ban, or degraded response anomaly appeared.

6. **Response quality / terminals — PASS**
   - **41** selected stocks reached durable `complete`;
   - **7** reached explicit durable `unsupported_financial_model`: `2820,6024,2882,2891,2881,2905,2889`;
   - 41 + 7 = **48 terminal selected stocks**;
   - no non-terminal/degraded result was checkpointed;
   - supported stocks retained structural source/coverage/timeline data; unsupported models remained explicit terminals rather than fake successful timelines.

7. **Checkpoint durability — PASS**
   - all 16 physical batches pushed unique checkpoints before runner exit:
     `91d34af8622bebfdbc0c7c602675a0e93a0aada4`,
     `022d1d9820a22ecebd612f3af398b451e86081d7`,
     `3e53172c5de5f69fe01ad2577bdd79823659eada`,
     `c1160e637fb9aa37597004ae95f255b75f735808`,
     `29dbe27bd21643d04706c2fc11f224db6d5e3ae1`,
     `4021c9cc54b910531c31e7755c9bc4546373f1e5`,
     `4395d6972bc357d6ff9c1414f650a534fb11fc97`,
     `c769700ebfdf584b1c9895090957888740d59b96`,
     `2c8d489eb4c79be2a971d1e1e20df165de34ac36`,
     `0eb3ebb80c8fab66e32386ba285b942d0d7146ce`,
     `cae86e5d8a0b9971a66af8c11d45b40fdc82ee78`,
     `51b39b5a4865031525d4235dd0c60af512caeb8b`,
     `d7bb2b3fff60da65902b4b88781669679b1cb821`,
     `65d9ba77112ae2c5c3f6c25fe1b910ce771f2ce5`,
     `aae2b574e044dbfbc123fe21c0d0b8a15052dad7`,
     `9e4ae55a6cd6595f526f709476bb889c9090234e`;
   - latest-main replay preserved unrelated concurrent repository writes.

8. **Master propagation — PASS**
   - rebuild-master job `102430336080`: success;
   - exactly one wave-level master publication commit:
     `0f0d7febdae1d1b6cf5bc5d474d56602528d904a`;
   - verifier passed before publication, during latest-main retry, and again after reset to durable remote main;
   - `verified_stocks=41`; the other seven selected stocks were correctly accounted for as explicit unsupported terminals.

9. **Re-plan / resume — PASS**
   - post-wave replan job `102430897367`: success;
   - due count changed **328 → 280**;
   - delta **48** exactly reconciles all terminal selected stocks;
   - no automatic second wave executed.

10. **Regression / invariants — PASS**
    - real planner job passed FinMind freshness, master propagation, and frozen 8021 deterministic regressions on the actual 48-stock workflow run;
    - the most recent applicable full `[99 測試] Node Regression Suite` remains run `34330795035`: PASS;
    - the 48-stock round changed only the backlog workflow bound, not scripts/tests; the Node suite path filter therefore did not auto-trigger for that YAML-only change;
    - current production signal code still qualifies only at FAS `>=8` and FQ `>=10`;
    - current daily FinMind freshness workflow remains scheduled and was not modified by the backlog-wave calibration;
    - strategy identity, anti-lookahead, signal-date semantics, and next-close execution policy remain unchanged.

11. **Calibration — PASS**
    - the 48-stock wave showed no runner-lifecycle, pacing, quota, response-quality, checkpoint, propagation, re-plan, or historical-artifact anomaly;
    - evidence supports increasing **only the number of sequential fresh-runner physical batches**, while preserving all per-runner and parallelism limits;
    - next evidence-backed calibration:
      - `physical_batch_size=3` unchanged;
      - `max_physical_batches_per_wave=32`;
      - at most **96 stocks** per wave;
      - `strategy.max-parallel=1` unchanged;
      - randomized 3–8s batch cooldown unchanged;
      - randomized 1–3s inter-request pacing unchanged;
      - quota cap/reserve `500/20` unchanged;
      - wave-scoped checkpoint after every physical batch;
      - exactly one master rebuild after all selected batches succeed;
      - one post-wave re-plan;
      - no automatic second wave.
    - evidence-backed remaining backlog after the 48-stock wave: **280**;
    - at 96 terminal stocks per bounded wave, approximately **3 waves** remain if daily maintenance does not reduce the queue first.

The 48-stock round is closed PASS. Do not execute another 48-stock Prompt A.

### Active round — backlog-drain-wave-96-v1

#### Objective

Calibrate the proven backlog drain from 16 × 3 to **32 sequential fresh-runner physical batches × 3 stocks = at most 96 stocks**, without increasing requests per runner, parallelism, quota pressure, or reducing pacing/checkpoint protections.

#### Frozen architecture — backlog-drain-wave-96-v1

- `physical_batch_size=3`.
- `max_physical_batches_per_wave=32`.
- at most 96 selected terminal stocks.
- `strategy.max-parallel=1`.
- one matrix item = one fresh runner.
- randomized 3–8s batch-start cooldown.
- randomized 1–3s inter-request pacing and no trailing wait.
- quota preflight proportional to actual request count.
- configured cap/reserve remain 500/20 unless current API evidence requires stricter values.
- wave-scoped checkpoint identity remains mandatory.
- checkpoint/push every physical batch before runner exit.
- race-safe latest-main replay.
- exactly one master rebuild after all selected batches succeed.
- final remote propagation verification.
- one post-wave re-plan from committed main.
- no automatic second wave.
- never increase physical batch size above 3 in this round.
- never increase parallelism above 1.
- preserve daily FinMind workflow and all production FAS/FQ, anti-lookahead, signal-date, and next-close invariants.

#### Prompt A completion contract — backlog-drain-wave-96-v1

Prompt A is complete only when:

1. fresh remote main/routing/handoff identifies this as the active promoted round;
2. backlog workflow bound is changed only from max 16 to max 32 physical batches and max due selection from 48 to 96;
3. `physical_batch_size<=3` and `max-parallel=1` remain unchanged;
4. planner computes fresh due backlog from committed main rather than blindly reusing 280;
5. at most 96 deterministic due stocks are selected into max 32×3 batches;
6. every selected batch runs in its own fresh runner and proves 3–8s cooldown, 1–3s request pacing, proportional quota guard, structural validation, unique wave-scoped checkpoint, push, and runner exit;
7. explicit unsupported financial models remain durable accepted terminals;
8. no non-terminal/degraded result is checkpointed;
9. all old canary, 12-stock, 24-stock, and 48-stock wave artifacts remain immutable;
10. exactly one master publication occurs after all selected batches succeed and final durable remote verifier passes;
11. committed-state post-wave re-plan reconciles before/after due counts and does not auto-start another wave;
12. FinMind/master/8021 regressions pass and the latest applicable full Node Regression Suite evidence remains green;
13. daily FinMind production path remains operational;
14. handoff records run/head SHA, wave id, planner counts, exact batch groups/jobs, pacing/quota evidence, terminals, checkpoint commits/paths, master commit, verifier, re-plan result, anomalies, and historical artifact preservation;
15. current remote main is re-fetched and durable evidence remains fresh;
16. report exactly `Prompt A complete — ready for Prompt B` and stop.

If a bounded defect appears, fix only that defect and rerun the same max-32×3 round. Do not increase beyond 96 stocks in this round.

#### Prompt A — backlog-drain-wave-96-v1

Execute only round `backlog-drain-wave-96-v1`.

Startup:

1. Fetch current remote main.
2. Read `AGENTS.md`, root `promptA.md`, `docs/agent-prompts/prompt-a-runner.md`, `docs/agent-prompts/task-routing.json`, and this canonical handoff.
3. Verify `finmind-quarterly-financial-quality-freshness` remains the unique active project and this round is active.
4. Re-read the exact FinMind backlog entry points and frozen architecture above.
5. Recompute current due backlog from committed main.

Implementation/execution:

- minimally raise `.github/workflows/drain-finmind-quarterly-financial-quality-backlog.yml` maximum/default from 16 to 32 physical batches and max due bound from 48 to 96;
- keep `physical_batch_size=3`;
- keep `strategy.max-parallel=1`;
- preserve 3–8s cooldown, 1–3s inter-request pacing, quota cap/reserve 500/20, wave identity, structural validation, terminal checks and latest-main replay;
- produce one deterministic current-state wave of at most 96 stocks;
- one matrix entry must remain one fresh runner;
- checkpoint each physical batch before runner exit;
- after all batches succeed, rebuild master exactly once, verify, push, reset to current remote main, and verify again;
- post-wave re-plan from committed main;
- do not automatically start a second wave;
- preserve daily workflow and production strategy/anti-lookahead invariants;
- run the required deterministic FinMind/master/8021 tests and preserve applicable Node Regression Suite evidence.

Update this handoff with durable Prompt A evidence while preserving the exact preregistered Prompt B below.

#### Preregistered Prompt B — backlog-drain-wave-96-v1

Close out round `backlog-drain-wave-96-v1`.

This Prompt B is preregistered before Prompt A begins and must not be rewritten to fit results.

Verify independently:

1. **Fresh identity** — fresh remote main/routing/handoff; recover this exact preregistered Prompt B; classify concurrent changes.
2. **Planner / bound** — fresh committed due count; deterministic selection <=96; max 32 physical batches ×3; no outcome cherry-picking.
3. **True physical batches** — one distinct job/runner lifecycle per matrix batch; `max-parallel=1`; no runner spans batches.
4. **Wave identity / history** — new checkpoints wave-scoped; all canary/12/24/48-wave blobs unchanged; same-day waves cannot overwrite.
5. **Pacing / quota** — each cooldown 3–8s; actual waits 1–3s with no trailing wait; quota guard uses actual request count; cap/reserve 500/20 or stricter; no quota/soft-ban anomaly.
6. **Response quality / terminals** — durable structural source/coverage/timeline for supported stocks; explicit unsupported terminals; historical missing remains explicit; no degraded/non-terminal checkpoint.
7. **Checkpoint durability** — every batch pushes unique checkpoint before runner exit; race-safe replay preserves prior batches and unrelated commits.
8. **Master propagation** — exactly one wave-level master publication; final remote verifier passes for supported selected stocks and accounts for unsupported terminals.
9. **Re-plan / resume** — fresh post-wave committed plan; terminal selected stocks disappear; before/after counts reconcile; no automatic second wave.
10. **Regression / invariants** — FinMind/master/8021 regressions PASS; latest applicable Node Regression Suite evidence green; daily path operational; FAS>=8, FQ>=10, strategy identity, anti-lookahead, signal date and next-close unchanged.
11. **Calibration** — use real 96-stock evidence to decide whether another sequential-batch increase is justified; never raise physical batch size >3 or parallelism >1 without new explicit evidence; record remaining backlog and estimated bounded waves.

If any criterion fails, fix only the bounded defect and restart this same Prompt B from criterion 1. Do not promote another round.

If all PASS:

- record `Prompt B closeout: PASS`;
- record evidence-backed next calibration or backlog-completion plan;
- preregister/promote another bounded drain round only if backlog remains;
- commit handoff;
- re-fetch current main and verify durability;
- stop without executing the next Prompt A.

### Safety / stop conditions — backlog drain

- Never execute the entire remaining backlog as one static matrix.
- Never replace physical batches with one long-running runner loop.
- Never increase parallelism above 1 against FinMind in this project without new evidence and explicit owner approval.
- Never remove quota reserve/preflight to gain speed.
- Never remove jitter/cooldown merely to reduce Actions duration.
- Do not over-throttle with minute-scale sleeps when current evidence supports second-scale polite pacing.
- Never persist missing/ambiguous API data as a successful complete quarter without structural validation.
- Preserve restartability: completed remote checkpoints must disappear from subsequent plans.
