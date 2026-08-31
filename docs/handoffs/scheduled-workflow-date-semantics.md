# Scheduled Workflow Date Semantics Migration

Canonical handoff: `docs/handoffs/scheduled-workflow-date-semantics.md`

## Current phase

### Completed round — sixth-wave residual scheduled-date audit

Round identity: `sixth-wave-residual-scheduled-date-audit`

- Prompt A baseline: `6f2401f9b66c91ffd93411a14a228b2205aecaee`
- Prompt A audit findings commit: `ce419d0640603cada035ea4e915381bb42b2a462`
- Prompt B closeout checkpoint: `82077179f4e785d49230667385ba1c15972890cc`
- Prompt B closeout: PASS

The sixth wave was audit/classification only. No production workflow, script, test, config, or data file changed in Prompt A.

### Post-sixth-wave bounded hardening — warrant source-date fail-closed

A closeout review found one degraded fallback correctness defect in the warrant scraper: normal artifact dates were source-title-derived, but a missing source title could fall back to runner UTC date and the extractor step used `continue-on-error: true`.

Bounded repair commits:

- `5be7eddeb0bb3f90867b64c55d9c85b340803d5a` — `fix: fail closed on warrant source date`
- `2085dfc1f91c94626d96b6cbac3be8c00baf955c` — `test: cover warrant source-date filename contract`
- `2e5a26f7163ab892dd36e795e24bea32d6f9a794` — `fix: stop warrant workflow on unverified source date`
- `d1275ce13a2adfdb24fe11c8d74b493ca40528fc` — `test: guard warrant source-date ownership`

Exact-head regression:

- workflow: `.github/workflows/test-scheduled-collection-date.yml`
- run ID: `33373951803`
- regression job ID: `99431081251`
- tested/materialized SHA: `d1275ce13a2adfdb24fe11c8d74b493ca40528fc`
- conclusion: `success`
- deterministic tests: 38 pass, 0 fail

Hardened warrant contract:

- `.github/workflows/warrant-scraper.yml`
- `scripts/extract_warrant_data.js`
- `tests/extract_warrant_data.test.js`
- canonical dated filename must come from the TWSE source title/date range;
- missing or malformed source date fails closed and must not fabricate a runner-clock artifact date;
- the production extractor step must not ignore source-date failure;
- this is a source-date correctness hardening, not a scheduled-occurrence migration candidate.

### Active round — seventh-wave MOPS + VIX scheduled target migration

Round identity: `seventh-wave-mops-vix-scheduled-target-migration`

Status: **Prompt A complete; pending the preregistered seventh-wave Prompt B closeout below.**

Prompt A startup baseline: `a18279c017d14902bbc0d8909927d31eebf0a7fd`.

Pre-seventh-wave durable hardening head: `d1275ce13a2adfdb24fe11c8d74b493ca40528fc`.

Prompt A implementation/test commits:

- `f059a9e982fd8e3c3d54780bcdd33ec2e42390f6` — `fix: anchor scheduled MOPS month to occurrence`
- `fb42bbe6587bd879a2eca38d7862464924da803b` — `fix: anchor scheduled VIX date to occurrence`
- `039f3188e63b7051b0f8653d6b6c42299ee1dcd1` — `test: cover delayed MOPS scheduled month`
- `27f5ec983f379b3b2b0ec59d13a94eac7b53a28e` — `test: cover delayed VIX scheduled target`
- `396e8975517bbe0fc687bf9f8226825b35dacd40` — `test: regress seventh-wave scheduled targets`

Prompt A exact-head regression evidence:

- workflow: `.github/workflows/test-scheduled-collection-date.yml`
- run ID: `33374612312`
- regression job ID: `99433173161`
- tested/materialized SHA: `396e8975517bbe0fc687bf9f8226825b35dacd40`
- conclusion: `success`
- deterministic tests: 51 pass, 0 fail
- MOPS delayed Taipei month-boundary and normal-delay cases: pass
- VIX delayed New York cutoff/date-boundary and normal-delay cases: pass
- first-, second-, third-, fifth-wave contracts: pass
- warrant source-date fail-closed contract: pass
- exact tested SHA check: pass

Prompt A bounded implementation diff from `a18279c017d14902bbc0d8909927d31eebf0a7fd` through `396e8975517bbe0fc687bf9f8226825b35dacd40` contains exactly five production/test files:

- `.github/workflows/crawl-mops-monthly-revenue.yml`
- `.github/workflows/crawl-vix-index.yml`
- `.github/workflows/test-scheduled-collection-date.yml`
- `tests/mops_monthly_revenue.test.js`
- `tests/crawl_vix_index.test.js`

The canonical handoff is the only additional Prompt A checkpoint file after the implementation/test head.

Unchanged seventh-wave domain/shared blobs verified at implementation/test head:

- `scripts/resolve_scheduled_collection_date.js` — `7f081771527ecf3b395d8f864aad93ac94c26325`
- `scripts/crawl_mops_monthly_revenue.js` — `89d5d68d2a9238905b672798e5b286f157646422`
- `scripts/crawl_vix_index.js` — `e1f08ed959cb30fd22b369892ffed24a3b7f2be3`

Implementation result:

- MOPS manual explicit `revenue_month` remains authoritative.
- MOPS manual no-date behavior remains the existing runner-Taipei `autoRevenueMonth()` behavior.
- MOPS scheduled runs now reconstruct `scheduled_at_utc` with `scripts/resolve_scheduled_collection_date.js` and pass the intended occurrence into the existing `autoRevenueMonth(now)` domain policy, so the target stays the previous Taipei calendar month relative to the occurrence rather than runner start time.
- Existing MOPS `include_previous_month`, baseline/rebuild, source report date, first/last seen, completeness, source URL, crawl, persistence, and snapshot behavior were not changed.
- VIX manual explicit `date` remains authoritative.
- VIX manual no-date behavior remains the existing `--resolve-date` runner-time path.
- VIX scheduled runs now reconstruct `scheduled_at_utc` and pass the intended occurrence into the existing `resolveAutomaticTargetDate(now)` New York 17:00 cutoff / previous-weekday policy.
- Exact Yahoo source-row validation, no silent fallback, source-row canonical artifact date, isolated output, safe publish, `force`, plan-only, refresh-indexes, and range/backfill behavior remain intact.
- No US holiday calendar was invented.
- Shared cron grammar was not broadened.
- No third production migration candidate was added.

**Do not promote the future eighth-wave round until the seventh-wave Prompt B below passes.**

## Objective

Make scheduled collection/business dates delay-safe while preserving each workflow's true domain policy and source-of-truth date semantics.

Architecture remains intentionally small:

1. reconstruct the intended scheduled occurrence only when the schedule logically owns an expected business date;
2. map the occurrence through the domain-specific business-date policy;
3. preserve source/API-derived observation dates as canonical when the upstream payload owns the business date;
4. preserve repository/latest-complete-data ownership where repository state, not runner time, is authoritative.

Do not use the historical D1-D7 audit taxonomy as production policy identifiers.

## Frozen decisions / constraints

- Manual explicit dates remain authoritative.
- Source/API-derived dates remain source-derived when they are canonical business dates.
- Repository/latest-complete-data workflows remain repository-driven.
- Do not silently fall back to an older trading date unless that fallback is an explicit preserved domain policy.
- Prediction/replay stale-data safety gates must not be weakened.
- Preserve crawler outputs, validation gates, persistence, and plan + fresh-runner physical-batch architecture.
- Shared infrastructure must remain small and evidence-driven; do not build a scheduler/DAG/plugin framework.
- Known exact repo-relative entry points must be carried forward in prompts and handoffs.
- `scripts/resolve_scheduled_collection_date.js` remains a verified cron subset, not a general cron engine. Do not broaden its supported grammar without separate evidence/preregistration.
- `github.event.schedule` is not an immutable occurrence timestamp. If a later identical cron occurrence has already passed, reconstruction is ambiguous without an independent durable occurrence identifier.
- TDCC source `observed_date` remains source-derived; `available_at` remains conservative first successful archive capture time and must not be backdated.
- CNN source `fear_and_greed.timestamp` / `dataDate` remains source-derived.
- TAIFEX futures/options artifact naming remains payload-date derived through `getPayloadDate(csvText)`; scheduled date is expected-date validation only.
- Warrant artifact date remains source-title-derived; missing/malformed source title/date must fail closed rather than fabricate a runner date.
- Do not migrate prediction/replay in this project without separate preregistration.

## Prior completed waves

- First wave implementation/test head: `53a32a03f5fd340c09876dc94ea22360f17359f4`; regression run `33353663345`; handoff checkpoint `5704095d91b7456af97f70d3a96fd88ca4e7ab56`.
- Second wave implementation/test head: `27ce0b0e1eb8eb9beabe2a8a087571bc4cd47bb1`; regression run `33354868624`; closeout checkpoint `89a2ade5cbe15e9e0858cb607cc699fc7fbf9878`.
- Third wave implementation/test head: `63c2c4a2867944cb6522c0f14715a1c23dd19109`; exact-head regression run `33365436045`; job `99404991901`; success.
- Fourth wave audit findings commit: `303bd5b4342a6825f16dd22992378a4850707b25`; closeout checkpoint `2642a232b8cdee947e9120920a9dab3c4c61ae1b`; Prompt B PASS.
- Fifth wave implementation commit: `bf50cf55330fb3d7d6325643a972b9b96ea58471`; final implementation/test head `5f3b3b3060319c2758166894e2f0ca8bdf41f2d6`; exact-head regression run `33369408473`; job `99416854795`; 34 pass / 0 fail; Prompt B PASS.
- Sixth wave audit findings commit: `ce419d0640603cada035ea4e915381bb42b2a462`; closeout checkpoint `82077179f4e785d49230667385ba1c15972890cc`; Prompt B PASS.

## Sixth-wave residual inventory

The 22 scheduled workflows already explicitly migrated/classified by waves 1-5 were re-accounted for. The 14 residual scheduled workflows were classified as follows before the seventh-wave implementation:

| Workflow | Classification | Evidence / ownership |
| --- | --- | --- |
| `.github/workflows/analyze-daily-gainers-margin-flow-2200.yml` | `no_migration_source_or_repository_owned` | schedule/manual fallback chooses latest repository `data_daily_gain_over_5/YYYYMMDD.json`; source-push mode derives date from changed source-data paths. |
| `.github/workflows/crawl-mops-monthly-revenue.yml` | `migrated_in_seventh_wave_pending_closeout` | scheduled automatic target is now intended-occurrence anchored; manual explicit/no-date and MOPS domain semantics preserved. |
| `.github/workflows/crawl-pocket-00981a.yml` | `no_migration_source_or_repository_owned` | runner Taipei date is retry/readiness/update-marker metadata; canonical holdings/industry dates come from API rows. |
| `.github/workflows/crawl-sma.yml` | `already_migrated_or_covered` | scheduled branch passes `${{ github.event.schedule }}` to `scripts/resolve_scheduled_sma_target_date.js`. |
| `.github/workflows/crawl-twse-quarterly-financial-quality.yml` | `no_migration_source_or_repository_owned` | fiscal year/quarter comes from TWSE OpenAPI payload. |
| `.github/workflows/crawl-vix-index.yml` | `migrated_in_seventh_wave_pending_closeout` | scheduled automatic target is now intended-occurrence anchored before the preserved NY 17:00 / previous-weekday policy. |
| `.github/workflows/daily-gainers-over-5.yml` | `no_migration_source_or_repository_owned` | automatic target is latest repository SMA artifact; runner Taipei time is a stale-state guard. |
| `.github/workflows/daily-prediction-replay.yml` | `no_migration_source_or_repository_owned` | `scripts/resolve_prediction_replay_date.js` selects newest repository SMA date and requires matching manifests. |
| `.github/workflows/daily-stock-prediction.yml` | `no_migration_source_or_repository_owned` | `scripts/resolve_latest_complete_prediction_base.js` selects latest complete repository base and derives forecast target. |
| `.github/workflows/momentum-history-replay.yml` | `no_migration_source_or_repository_owned` | scheduled/no-input path selects completed/versioned snapshot state. |
| `.github/workflows/update-non-trading-days.yml` | `date_irrelevant` | official holiday rows are fetched/merged; schedule date does not own artifact identity. |
| `.github/workflows/update-official-market-constraints.yml` | `no_migration_source_or_repository_owned` | empty target uses repository prediction dates; cron selects phase only. |
| `.github/workflows/update-twse-industry.yml` | `date_irrelevant` | refreshes current universe; no dated business artifact identity. |
| `.github/workflows/warrant-scraper.yml` | `no_migration_source_or_repository_owned` | canonical artifact filename derives from TWSE source title/date and degraded fallback fails closed. |

No residual scheduled workflow remained unresolved after the sixth-wave audit. The only two promoted production migrations were MOPS and VIX, and both are implemented in Prompt A pending seventh-wave Prompt B closeout.

## Entry points

Repository rules / canonical state:

- `AGENTS.md`
- `docs/project-philosophy.md`
- `docs/roadmap/current-phase.md`
- `docs/handoffs/scheduled-workflow-date-semantics.md`

Shared scheduled-date infrastructure:

- `scripts/resolve_scheduled_collection_date.js`
- `scripts/resolve_forecast_dates.js`
- `scripts/resolve_taifex_scheduled_date.js`
- `tests/resolve_scheduled_collection_date.test.js`
- `tests/scheduled_date_third_wave.test.js`
- `tests/scheduled_date_fourth_wave.test.js`
- `.github/workflows/test-scheduled-collection-date.yml`
- `data_history_sma/non_trading_days.json`

Seventh-wave exact candidate entry points:

- `.github/workflows/crawl-mops-monthly-revenue.yml`
- `scripts/crawl_mops_monthly_revenue.js`
- `tests/mops_monthly_revenue.test.js`
- `.github/workflows/crawl-vix-index.yml`
- `scripts/crawl_vix_index.js`
- `tests/crawl_vix_index.test.js`
- `tests/refresh_dataset_indexes.test.js`
- `scripts/resolve_scheduled_collection_date.js`
- `.github/workflows/test-scheduled-collection-date.yml`

Protected source-derived / repository-owned controls:

- `.github/workflows/crawl-tdcc-shareholding-snapshot.yml`
- `scripts/crawl_tdcc_shareholding_snapshot.js`
- `tests/tdcc_shareholding_snapshot.test.js`
- `.github/workflows/crawl-cnn-fear-and-greed.yml`
- `scripts/crawl_cnn_fear_and_greed.js`
- `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml`
- `scripts/crawl_taifex_major_institutional_traders_futures_options.js`
- `.github/workflows/warrant-scraper.yml`
- `scripts/extract_warrant_data.js`
- `tests/extract_warrant_data.test.js`
- `scripts/resolve_latest_complete_prediction_base.js`
- `scripts/resolve_prediction_replay_date.js`

## Safety / stop conditions

- Preserve all source-derived and repository-owned dates.
- Preserve the warrant fail-closed source-date contract; do not reintroduce a runner-date fallback or ignored extractor failure.
- Do not change prediction/replay without separate preregistration.
- Do not broaden `scripts/resolve_scheduled_collection_date.js` cron grammar without separate evidence and preregistration.
- Do not add another production migration candidate merely to keep this project active.
- The eighth-wave package below is future work only until seventh-wave Prompt B passes.

## Prompt A — seventh-wave MOPS + VIX scheduled target migration

Round identity: `seventh-wave-mops-vix-scheduled-target-migration`.

Prompt A was preregistered before execution and is now complete pending Prompt B. Its bounded contract was:

### Stage 1 — MOPS monthly revenue

- Preserve manual explicit `revenue_month` exactly.
- For scheduled runs only, reconstruct the intended scheduled occurrence using the existing bounded shared resolver or an equally small already-established seam.
- Derive the automatic MOPS target as the previous Taipei calendar month relative to that intended occurrence.
- Do not use runner actual start time to select the scheduled revenue month.
- Preserve `include_previous_month`, baseline/rebuild logic, source `report_date`, first/last-seen semantics, completeness rules, source URL behavior, persistence, and manual no-date semantics.
- Add deterministic tests for at least a delayed run crossing a Taipei month boundary and a normal same-month delay.

Intermediate gate: MOPS tests and syntax checks must pass. This is not round completion; continue to Stage 2.

### Stage 2 — VIX

- Preserve manual explicit `date` exactly.
- For scheduled runs only, reconstruct the intended scheduled occurrence and feed that occurrence into the existing `America/New_York` 17:00 cutoff / previous-weekday rule.
- Do not use runner actual start time to select the scheduled VIX target.
- Preserve exact Yahoo source-row validation, no silent fallback, source-row canonical artifact dates, isolated output + safe publish, `force`, plan-only, refresh-indexes, and range/backfill behavior.
- Do not invent a US holiday calendar or broaden the date policy beyond the existing weekday/cutoff behavior.
- Add deterministic tests for a delayed run crossing the New York 17:00 cutoff/date boundary and a normal delay.

Intermediate gate: VIX tests and syntax checks must pass. This is not round completion.

### Stage 3 — regression and durable verification

- Update `.github/workflows/test-scheduled-collection-date.yml` only as required to cover the two new contracts and exact-head materialization.
- Do not broaden `scripts/resolve_scheduled_collection_date.js` cron grammar.
- Keep TDCC, CNN, TAIFEX, warrant fail-closed source-date behavior, prediction/replay, prior migrated workflows, and unrelated research/data workflows unchanged.
- Run deterministic relevant tests and the exact-head scheduled-date regression contract.
- Re-fetch current remote `main`; prove implementation commits, expected blobs, tests, tested SHA, protected invariants, and bounded changed-file set are durable.
- Update this handoff with Prompt A completion evidence while retaining the preregistered seventh-wave Prompt B below.
- Preregister the following round's Prompt A + Prompt B before declaring completion; if no remaining production candidate exists, preregister a final verification/retirement round.

Prompt A completion evidence is recorded in `Current phase` above. Prompt B has not been executed.

## Pending Prompt B — seventh-wave MOPS + VIX scheduled target migration closeout

Perform phase-closeout verification for round `seventh-wave-mops-vix-scheduled-target-migration` in repository `EasonLiu0913/stock_data`.

Before verification:
1. Fetch current remote `main` and read `AGENTS.md`, `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, and this canonical handoff.
2. Recover the seventh-wave Prompt A baseline, implementation/test head, and this preregistered Prompt B from durable pre-Prompt-A history.
3. Do not use a later future Prompt B as the acceptance contract.

Verify independently:

1. **Bounded scope**
   - Changed files are limited to the preregistered MOPS/VIX entry points, strictly necessary shared regression/seam files, and handoff.
   - No third production workflow was migrated.
   - TDCC, CNN, TAIFEX, warrant fail-closed source-date behavior, prediction/replay, and prior migration contracts are unchanged.

2. **MOPS occurrence semantics**
   - Manual explicit `revenue_month` is unchanged and authoritative.
   - Scheduled automatic target is previous Taipei calendar month relative to intended scheduled occurrence, not runner start time.
   - Delayed month-boundary and normal-delay deterministic tests exist and pass.
   - Baseline/rebuild, source report date, timestamps, completeness, persistence, and source URL behavior remain unchanged.

3. **VIX occurrence semantics**
   - Manual explicit `date` is unchanged and authoritative.
   - Scheduled automatic target is derived from intended occurrence using the existing New York 17:00 cutoff / previous-weekday rule.
   - Exact Yahoo market-row validation and no-silent-fallback behavior remain intact.
   - Source market row remains canonical artifact date.
   - No US holiday-calendar policy was invented.
   - Delayed cutoff/date-boundary and normal-delay tests exist and pass.

4. **Shared resolver / protected invariants**
   - `scripts/resolve_scheduled_collection_date.js` cron grammar is not broadened.
   - Existing first-through-fifth-wave contracts still pass.
   - Warrant source title/date remains canonical; missing/malformed source date still fails closed; extractor failure is not ignored.
   - Prediction/replay protected blobs/behavior remain unchanged unless a separate preregistered freshness repair is explicitly justified.

5. **Exact-head regression identity**
   - Regression tests materialize and test the implementation head SHA, not moving `/main`.
   - Tested/materialized SHA equals the intended seventh-wave implementation/test head.
   - Relevant deterministic tests and scheduled-date regression pass.

6. **Durable completion**
   - Re-fetch current remote `main` after all writes.
   - Verify implementation commits are reachable, expected files/blobs are present, bounded changed-file set holds, and canonical handoff contains seventh-wave completion evidence plus the already-preregistered next pair.

If any criterion fails, fix only the bounded seventh-wave defect and repeat this Prompt B from criterion 1.

If closeout passes:

- update the canonical handoff with seventh-wave Prompt B PASS evidence;
- promote only the already-preregistered next round;
- commit the handoff;
- re-fetch current remote `main` and verify durability/staleness;
- stop. Do not start the next Prompt A automatically.

## Preregistered future Prompt A — eighth-wave final scheduled-date verification and retirement audit

Continue the Scheduled Workflow Date Semantics Migration in repository `EasonLiu0913/stock_data` only after the seventh-wave Prompt B has passed and this round has been promoted.

Future round identity: `eighth-wave-final-scheduled-date-verification-and-retirement-audit`.

Before doing any work:
1. Fetch current remote `main`; do not rely on local or conversation state.
2. Read `AGENTS.md`, `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, and this canonical handoff.
3. Verify the seventh-wave Prompt B PASS checkpoint exists on current remote `main` and that this eighth-wave round has actually been promoted. If seventh-wave closeout is still pending, stop; do not execute this future prompt.
4. Re-read exact audit entry points:
   - `docs/handoffs/scheduled-workflow-date-semantics.md`
   - `.github/workflows/test-scheduled-collection-date.yml`
   - `scripts/resolve_scheduled_collection_date.js`
   - `.github/workflows/crawl-mops-monthly-revenue.yml`
   - `tests/mops_monthly_revenue.test.js`
   - `.github/workflows/crawl-vix-index.yml`
   - `tests/crawl_vix_index.test.js`
   - `.github/workflows/warrant-scraper.yml`
   - `scripts/extract_warrant_data.js`
   - `tests/extract_warrant_data.test.js`
   - `scripts/resolve_latest_complete_prediction_base.js`
   - `scripts/resolve_prediction_replay_date.js`
5. Verify no material current-main change makes the durable inventory stale before auditing.

This is a final verification/retirement audit, not a new production migration wave.

### Stage 1 — full scheduled-workflow re-accounting

- Re-enumerate every current `.github/workflows/*.yml` workflow that contains `schedule:`.
- Reconcile the complete current count against the durable first-through-seventh-wave inventory.
- For each scheduled workflow, classify the actual target-date ownership as one of: already migrated intended occurrence, source/API-owned, repository/latest-data-owned, date-irrelevant, explicit/manual/range, or separately protected policy.
- Do not use cron presence alone as evidence that a workflow needs migration.
- Identify any genuinely new or changed scheduled workflow since seventh-wave closeout separately instead of silently absorbing it into old evidence.

Intermediate gate: complete re-accounting must have no unexplained workflow. This is not round completion.

### Stage 2 — protected-contract regression audit

- Re-run the exact-head `.github/workflows/test-scheduled-collection-date.yml` contract on a known tested SHA.
- Re-check MOPS and VIX scheduled/manual semantics after seventh-wave closeout.
- Re-check TDCC/CNN/TAIFEX/warrant source ownership and prediction/replay repository ownership.
- Confirm `scripts/resolve_scheduled_collection_date.js` remains a bounded cron subset and has not drifted into a general scheduler.
- Do not add a US holiday calendar, scheduler framework, or new fallback policy.

Intermediate gate: deterministic/exact-head regression must pass. This is not round completion.

### Stage 3 — retirement decision and durable handoff

- If all current scheduled workflows are accounted for and no unresolved runner-clock-owned scheduled business-date defect remains, record the migration project as retired/monitor-only rather than inventing another implementation round.
- If a genuinely new defect is found, do not implement it in this audit unless a bounded correctness/freshness repair is required by `AGENTS.md`; otherwise preregister a separate future implementation + closeout pair with exact entry points and evidence.
- Update this handoff with the final inventory, exact-head test evidence, tested SHA, changed-file set, and retirement/new-defect decision.
- Re-fetch current remote `main` and prove the handoff/evidence is durable.

Expected changed-file set for a clean retirement audit is this handoff only. A regression workflow change is allowed only if current-main drift makes exact-head verification impossible and the repair is strictly bounded/documented.

Prompt A completion contract:

- Stages 1-3 are all complete.
- Every current scheduled workflow is explicitly accounted for.
- Exact-head regression passes on the intended tested SHA.
- Protected ownership/invariants are preserved.
- Current remote `main` contains the durable final audit handoff.
- Then report `Prompt A complete — ready for Prompt B` and stop.

Do not execute the future Prompt B automatically.

## Preregistered future Prompt B — eighth-wave final scheduled-date verification and retirement closeout

Perform phase-closeout verification for round `eighth-wave-final-scheduled-date-verification-and-retirement-audit` only after it has been promoted and its Prompt A has completed.

Before verification:
1. Fetch current remote `main` and read `AGENTS.md` plus this canonical handoff.
2. Recover the eighth-wave Prompt A baseline, audit findings commit/head, and this preregistered Prompt B from durable pre-Prompt-A history.
3. Verify seventh-wave Prompt B had already passed before eighth-wave Prompt A began.

Verify independently:

1. **Round identity and scope**
   - This was the promoted eighth-wave final audit, not a prematurely executed future round.
   - Clean retirement should change only the handoff; any additional change must be a strictly justified bounded verification repair.

2. **Complete scheduled-workflow accounting**
   - Independently enumerate all current scheduled workflows.
   - Confirm every one is accounted for with actual date ownership evidence.
   - Confirm no workflow was omitted merely because it had been classified in an older wave.

3. **No unresolved scheduled target defect**
   - Confirm no remaining scheduled workflow selects a schedule-owned business target from runner start time where intended-occurrence reconstruction is required.
   - Confirm MOPS and VIX seventh-wave semantics remain correct.
   - Confirm source/API-owned and repository-owned dates were not incorrectly converted to scheduled dates.

4. **Protected invariants and regression**
   - Exact-head scheduled-date regression passes on the recorded tested SHA.
   - Shared resolver cron grammar remains bounded.
   - TDCC, CNN, TAIFEX, warrant fail-closed source ownership, prediction/replay, and prior migration contracts remain intact.

5. **Retirement decision durability**
   - If the audit found no unresolved candidate, the handoff explicitly marks the migration as retired/monitor-only and does not preregister speculative production work.
   - If a genuine new defect was found, it has a separate preregistered paired implementation/closeout contract with exact entry points; it was not silently implemented beyond allowed bounded freshness repair.
   - Re-fetch current remote `main` and verify the final handoff, tested SHA, findings, and changed-file set are durable.

If any criterion fails, fix only the bounded audit/verification defect and repeat this Prompt B.

If closeout passes, update and commit the canonical handoff with Prompt B PASS and the final retired/monitor-only state, re-fetch current remote `main`, verify durability, and stop.