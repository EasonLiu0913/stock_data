# Scheduled Workflow Date Semantics Migration

Canonical handoff: `docs/handoffs/scheduled-workflow-date-semantics.md`

## Current phase

### Completed round — sixth-wave residual scheduled-date audit

Round identity: `sixth-wave-residual-scheduled-date-audit`

- Prompt A baseline: `6f2401f9b66c91ffd93411a14a228b2205aecaee`
- Prompt A audit findings commit: `ce419d0640603cada035ea4e915381bb42b2a462`
- Prompt B closeout checkpoint: `82077179f4e785d49230667385ba1c15972890cc`
- Prompt B closeout: PASS

The sixth wave re-accounted the residual scheduled workflows and promoted exactly two production candidates for the seventh wave: MOPS monthly revenue automatic target month and VIX automatic target market date. Post-sixth-wave warrant hardening is preserved through `d1275ce13a2adfdb24fe11c8d74b493ca40528fc`.

### Completed round — seventh-wave MOPS + VIX scheduled target migration

Round identity: `seventh-wave-mops-vix-scheduled-target-migration`

Prompt A startup baseline: `a18279c017d14902bbc0d8909927d31eebf0a7fd`.

Prompt A implementation/test commits:

- `f059a9e982fd8e3c3d54780bcdd33ec2e42390f6` — `fix: anchor scheduled MOPS month to occurrence`
- `fb42bbe6587bd879a2eca38d7862464924da803b` — `fix: anchor scheduled VIX date to occurrence`
- `039f3188e63b7051b0f8653d6b6c42299ee1dcd1` — `test: cover delayed MOPS scheduled month`
- `27f5ec983f379b3b2b0ec59d13a94eac7b53a28e` — `test: cover delayed VIX scheduled target`
- `396e8975517bbe0fc687bf9f8226825b35dacd40` — `test: regress seventh-wave scheduled targets`

Prompt A handoff checkpoint: `a78357435bdb80bee37ab38d6d4effbe98e33da1`.

Prompt B identity source: durable pre-Prompt-A handoff at `a18279c017d14902bbc0d8909927d31eebf0a7fd`, section `Preregistered Prompt B — seventh-wave MOPS + VIX scheduled target migration closeout`.

Prompt B closeout: **PASS**.

Prompt B closeout checkpoint: `9345f1173e4be8261bf0112b7337fe64e796b7f2`.

#### Seventh-wave closeout evidence

1. **Bounded scope — PASS**
   - Compare `a18279c017d14902bbc0d8909927d31eebf0a7fd...a78357435bdb80bee37ab38d6d4effbe98e33da1` contains exactly six changed files:
     - `.github/workflows/crawl-mops-monthly-revenue.yml`
     - `.github/workflows/crawl-vix-index.yml`
     - `.github/workflows/test-scheduled-collection-date.yml`
     - `tests/mops_monthly_revenue.test.js`
     - `tests/crawl_vix_index.test.js`
     - `docs/handoffs/scheduled-workflow-date-semantics.md`
   - No third production workflow was migrated.
   - No production crawler script, prediction/replay script, source-owned control, data file, or unrelated workflow changed in the round.

2. **MOPS occurrence semantics — PASS**
   - Manual explicit `revenue_month` remains first-priority and authoritative in `.github/workflows/crawl-mops-monthly-revenue.yml`.
   - Scheduled runs reconstruct `scheduled_at_utc` through `scripts/resolve_scheduled_collection_date.js` and feed that intended occurrence into existing `scripts/crawl_mops_monthly_revenue.js::autoRevenueMonth(now)`.
   - Automatic scheduled target is therefore the previous Taipei calendar month relative to intended occurrence, not runner actual start time.
   - Manual no-date behavior remains the pre-existing runner-Taipei `autoRevenueMonth()` path.
   - `scripts/crawl_mops_monthly_revenue.js` blob remained unchanged at `89d5d68d2a9238905b672798e5b286f157646422`, proving baseline/rebuild, source `report_date`, first/last-seen semantics, completeness, source URL, persistence, and snapshot behavior were not changed.
   - Deterministic delayed Taipei month-boundary and normal same-month delay tests pass.

3. **VIX occurrence semantics — PASS**
   - Manual explicit `date` remains first-priority and authoritative in `.github/workflows/crawl-vix-index.yml`.
   - Scheduled runs reconstruct `scheduled_at_utc` and feed that intended occurrence into existing `scripts/crawl_vix_index.js::resolveAutomaticTargetDate(now)`.
   - Existing `America/New_York` 17:00 cutoff / previous-weekday rule remains the domain policy.
   - Manual no-date behavior remains the pre-existing runner-time `--resolve-date` path.
   - `scripts/crawl_vix_index.js` blob remained unchanged at `e1f08ed959cb30fd22b369892ffed24a3b7f2be3`, preserving exact Yahoo source-row validation, no silent fallback, source-row canonical artifact date, isolated output, safe publish, `force`, plan-only, refresh-indexes, and range/backfill behavior.
   - No US holiday calendar was added.
   - Deterministic delayed New York cutoff/date-boundary and normal-delay tests pass.

4. **Shared resolver / protected invariants — PASS**
   - `scripts/resolve_scheduled_collection_date.js` remained unchanged at blob `7f081771527ecf3b395d8f864aad93ac94c26325`; cron grammar was not broadened.
   - Exact-head regression verified first-, second-, third-, and fifth-wave workflow contracts.
   - Warrant source-title/date fail-closed behavior remained intact; `scripts/extract_warrant_data.js` blob at closeout was `f2e2d89096a48dddffa497acdaf9331cc3443fea` and `.github/workflows/warrant-scraper.yml` blob was `bb210ebc555b3dbca8dad83db0179070a32a163d`.
   - Prediction/replay protected files were unchanged by the bounded round; current blobs at closeout:
     - `scripts/resolve_latest_complete_prediction_base.js` — `61800be23d488bdf67874e87db492e8dc947b110`
     - `scripts/resolve_prediction_replay_date.js` — `9dd7c74bbe73c4088138b7b1262a8fed71608ff7`

5. **Exact-head regression identity — PASS**
   - Workflow: `.github/workflows/test-scheduled-collection-date.yml`
   - Run ID: `33374612312`
   - Regression job ID: `99433173161`
   - Workflow head SHA: `396e8975517bbe0fc687bf9f8226825b35dacd40`
   - Materialized/tested SHA: `396e8975517bbe0fc687bf9f8226825b35dacd40`
   - Conclusion: `success`
   - Deterministic tests: 51 pass, 0 fail
   - The job explicitly materialized files from `${github.sha}`, verified seventh-wave MOPS/VIX wiring, prior-wave contracts, warrant fail-closed behavior, and confirmed `TESTED_SHA == MATERIALIZED_SHA`.

6. **Durable completion — PASS**
   - Remote `main` was freshly read at `a78357435bdb80bee37ab38d6d4effbe98e33da1` before closeout; there were no concurrent commits after the Prompt A checkpoint at the start of Prompt B.
   - All Prompt A commits are ancestors of the current closeout state.
   - Expected workflow/test blobs are present on remote `main`.
   - Bounded changed-file set holds.
   - The seventh-wave completion evidence and the already-preregistered eighth-wave paired prompts are durable in this canonical handoff.

Known limitation retained: `github.event.schedule` is not an immutable occurrence timestamp. If a later identical cron occurrence has already passed, reconstruction is ambiguous without an independent durable occurrence identifier. No broader scheduler was introduced to hide this limitation.

### Active / next round — eighth-wave final scheduled-date verification and retirement audit

Round identity: `eighth-wave-final-scheduled-date-verification-and-retirement-audit`

Status: **promoted only after seventh-wave Prompt B PASS; Prompt A has not started.**

Promotion baseline: seventh-wave Prompt B closeout checkpoint `9345f1173e4be8261bf0112b7337fe64e796b7f2`. The next agent must still freshly fetch current remote `main` before execution and treat any later concurrent change under the freshness rules below.

This round is a final verification/retirement audit, not a new production migration wave.

## Objective

Make scheduled collection/business dates delay-safe while preserving each workflow's true domain policy and source-of-truth date semantics, then retire the migration project when the complete current scheduled-workflow inventory is accounted for and no unresolved runner-clock-owned target defect remains.

Architecture remains intentionally small:

1. reconstruct intended scheduled occurrence only when schedule ownership truly determines an expected business date;
2. map the occurrence through the domain-specific date policy;
3. preserve source/API-derived dates when the upstream payload owns the business date;
4. preserve repository/latest-complete-data ownership when repository state is authoritative;
5. do not turn the bounded resolver into a general scheduler framework.

## Frozen decisions / constraints

- Manual explicit dates remain authoritative.
- Source/API-derived canonical dates remain source-derived.
- Repository/latest-complete-data workflows remain repository-driven.
- Do not silently fall back to an older trading date unless that fallback is an explicit preserved domain policy.
- Prediction/replay stale-data safety gates must not be weakened.
- Preserve crawler outputs, validation gates, persistence, and plan + fresh-runner physical-batch architecture.
- `scripts/resolve_scheduled_collection_date.js` remains a verified bounded cron subset, not a general cron engine.
- `github.event.schedule` occurrence ambiguity remains a known limitation.
- TDCC source `observed_date` remains source-derived; `available_at` remains conservative first successful archive capture time and must not be backdated.
- CNN source `fear_and_greed.timestamp` / `dataDate` remains source-derived.
- TAIFEX futures/options artifact naming remains payload-date derived through `getPayloadDate(csvText)`; scheduled date is expected-date validation only.
- Warrant artifact date remains source-title-derived; missing/malformed source date must fail closed and extractor failure must not be ignored.
- MOPS seventh-wave scheduled target remains intended-occurrence anchored while manual explicit/no-date behavior and MOPS domain policy stay unchanged.
- VIX seventh-wave scheduled target remains intended-occurrence anchored while manual explicit/no-date behavior and the New York 17:00 / previous-weekday domain policy stay unchanged.
- Do not migrate prediction/replay without separate preregistration.
- Do not invent a new production candidate merely to keep this project active.

## Prior completed waves

- First wave implementation/test head: `53a32a03f5fd340c09876dc94ea22360f17359f4`; regression run `33353663345`; handoff checkpoint `5704095d91b7456af97f70d3a96fd88ca4e7ab56`.
- Second wave implementation/test head: `27ce0b0e1eb8eb9beabe2a8a087571bc4cd47bb1`; regression run `33354868624`; closeout checkpoint `89a2ade5cbe15e9e0858cb607cc699fc7fbf9878`.
- Third wave implementation/test head: `63c2c4a2867944cb6522c0f14715a1c23dd19109`; exact-head regression run `33365436045`; job `99404991901`; success.
- Fourth wave audit findings commit: `303bd5b4342a6825f16dd22992378a4850707b25`; closeout checkpoint `2642a232b8cdee947e9120920a9dab3c4c61ae1b`; Prompt B PASS.
- Fifth wave final implementation/test head: `5f3b3b3060319c2758166894e2f0ca8bdf41f2d6`; exact-head regression run `33369408473`; job `99416854795`; 34 pass / 0 fail; Prompt B PASS.
- Sixth wave audit findings commit: `ce419d0640603cada035ea4e915381bb42b2a462`; closeout checkpoint `82077179f4e785d49230667385ba1c15972890cc`; Prompt B PASS.
- Seventh wave final implementation/test head: `396e8975517bbe0fc687bf9f8226825b35dacd40`; exact-head regression run `33374612312`; job `99433173161`; 51 pass / 0 fail; Prompt B PASS.

## Sixth-wave residual inventory carried into final audit

The sixth wave re-accounted 36 scheduled workflows total: 22 already covered by waves 1–5 plus 14 residual scheduled workflows. The residual set was:

| Workflow | Ownership / disposition after seventh-wave closeout |
| --- | --- |
| `.github/workflows/analyze-daily-gainers-margin-flow-2200.yml` | source/repository-owned; no migration |
| `.github/workflows/crawl-mops-monthly-revenue.yml` | seventh-wave intended-occurrence migration complete |
| `.github/workflows/crawl-pocket-00981a.yml` | source/API-owned; no migration |
| `.github/workflows/crawl-sma.yml` | already migrated/covered |
| `.github/workflows/crawl-twse-quarterly-financial-quality.yml` | source/API-owned; no migration |
| `.github/workflows/crawl-vix-index.yml` | seventh-wave intended-occurrence migration complete |
| `.github/workflows/daily-gainers-over-5.yml` | repository/latest-data-owned; no migration |
| `.github/workflows/daily-prediction-replay.yml` | repository/latest-data-owned; protected |
| `.github/workflows/daily-stock-prediction.yml` | repository/latest-complete-data-owned; protected |
| `.github/workflows/momentum-history-replay.yml` | repository/versioned-snapshot-owned; no migration |
| `.github/workflows/update-non-trading-days.yml` | date-irrelevant |
| `.github/workflows/update-official-market-constraints.yml` | repository-owned; no migration |
| `.github/workflows/update-twse-industry.yml` | date-irrelevant |
| `.github/workflows/warrant-scraper.yml` | source-title/date-owned and fail-closed |

The eighth wave must independently re-enumerate the *current* scheduled workflow set and reconcile it against all first-through-seventh-wave evidence rather than assuming this historical count is still current.

## Entry points

Repository rules / canonical state:

- `AGENTS.md`
- `docs/project-philosophy.md`
- `docs/roadmap/current-phase.md`
- `docs/handoffs/scheduled-workflow-date-semantics.md`

Shared scheduled-date infrastructure / regression:

- `scripts/resolve_scheduled_collection_date.js`
- `scripts/resolve_forecast_dates.js`
- `scripts/resolve_taifex_scheduled_date.js`
- `tests/resolve_scheduled_collection_date.test.js`
- `tests/scheduled_date_third_wave.test.js`
- `tests/scheduled_date_fourth_wave.test.js`
- `.github/workflows/test-scheduled-collection-date.yml`
- `data_history_sma/non_trading_days.json`

Seventh-wave contracts to re-check:

- `.github/workflows/crawl-mops-monthly-revenue.yml`
- `scripts/crawl_mops_monthly_revenue.js`
- `tests/mops_monthly_revenue.test.js`
- `.github/workflows/crawl-vix-index.yml`
- `scripts/crawl_vix_index.js`
- `tests/crawl_vix_index.test.js`
- `tests/refresh_dataset_indexes.test.js`

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

- Freshly fetch current remote `main` before the eighth-wave audit.
- If current `main` contains later changes, classify whether they materially affect the scheduled workflow inventory, regression contract, entry points, protected blobs, or baseline before continuing.
- Do not silently absorb a newly added/changed scheduled workflow into old evidence.
- Do not add a US holiday calendar, scheduler/DAG/plugin framework, or new fallback policy.
- Do not migrate prediction/replay in this project without a separate preregistered implementation + closeout pair.
- If a genuinely new scheduled target defect is found, do not implement it during the clean retirement audit unless a bounded correctness/freshness repair is required by repository rules; otherwise preregister separate paired work.
- Intermediate audit/regression PASS is not Prompt A completion; all stages must complete.

## Prompt A — eighth-wave final scheduled-date verification and retirement audit

Continue the Scheduled Workflow Date Semantics Migration in repository `EasonLiu0913/stock_data`.

Active round identity: `eighth-wave-final-scheduled-date-verification-and-retirement-audit`.

Before doing any work:
1. Fetch current remote `main`; do not rely on local or conversation state.
2. Read `AGENTS.md`, `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, and this canonical handoff.
3. Verify the seventh-wave Prompt B PASS checkpoint exists on current remote `main` and that this eighth-wave round is explicitly active/promoted.
4. Re-read exact audit entry points:
   - `docs/handoffs/scheduled-workflow-date-semantics.md`
   - `.github/workflows/test-scheduled-collection-date.yml`
   - `scripts/resolve_scheduled_collection_date.js`
   - `.github/workflows/crawl-mops-monthly-revenue.yml`
   - `scripts/crawl_mops_monthly_revenue.js`
   - `tests/mops_monthly_revenue.test.js`
   - `.github/workflows/crawl-vix-index.yml`
   - `scripts/crawl_vix_index.js`
   - `tests/crawl_vix_index.test.js`
   - `tests/refresh_dataset_indexes.test.js`
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
- For each scheduled workflow, classify actual target-date ownership as one of: already migrated intended occurrence, source/API-owned, repository/latest-data-owned, date-irrelevant, explicit/manual/range, or separately protected policy.
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
- The next closeout contract below remains the preregistered eighth-wave Prompt B.
- Then report exactly `Prompt A complete — ready for Prompt B` and stop.

Do not execute Prompt B automatically.

## Prompt B — eighth-wave final scheduled-date verification and retirement closeout

Perform phase-closeout verification for round `eighth-wave-final-scheduled-date-verification-and-retirement-audit` in repository `EasonLiu0913/stock_data`.

Before verification:
1. Fetch current remote `main` and read `AGENTS.md`, `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, and this canonical handoff.
2. Recover the eighth-wave Prompt A baseline, audit findings commit/head, and this preregistered Prompt B from durable pre-Prompt-A history.
3. Verify seventh-wave Prompt B had already passed before eighth-wave Prompt A began.
4. Do not use any later future Prompt B as the eighth-wave acceptance contract.

Verify independently:

1. **Round identity and scope**
   - This was the promoted eighth-wave final audit, not a prematurely executed future round.
   - Clean retirement should change only this canonical handoff; any additional change must be a strictly justified bounded verification repair recorded in the handoff.

2. **Complete scheduled-workflow accounting**
   - Independently enumerate all current `.github/workflows/*.yml` files containing `schedule:`.
   - Confirm every current scheduled workflow is accounted for with actual target-date ownership evidence.
   - Confirm no workflow was omitted merely because it had been classified in an older wave.
   - Confirm any workflow newly added or materially changed after seventh-wave closeout was explicitly separated from historical evidence.

3. **No unresolved scheduled target defect**
   - Confirm no remaining scheduled workflow selects a schedule-owned business target from runner actual start time where intended-occurrence reconstruction is required.
   - Confirm MOPS and VIX seventh-wave semantics remain correct.
   - Confirm source/API-owned and repository-owned dates were not incorrectly converted to scheduled dates.

4. **Protected invariants and regression**
   - Exact-head scheduled-date regression passes on the recorded tested SHA and materializes that SHA rather than moving `/main`.
   - Shared resolver cron grammar remains bounded.
   - TDCC, CNN, TAIFEX, warrant fail-closed source ownership, prediction/replay, and prior migration contracts remain intact.
   - No US holiday calendar, scheduler framework, or new fallback policy was introduced.

5. **Retirement decision durability**
   - If no unresolved candidate remains, the handoff explicitly marks the migration as retired/monitor-only and does not preregister speculative production work.
   - If a genuine new defect was found, it has a separate preregistered paired implementation/closeout contract with exact entry points and evidence; it was not silently implemented beyond an allowed bounded freshness/correctness repair.
   - Re-fetch current remote `main` after all writes and verify the final handoff, tested SHA, findings, changed-file set, and retirement/new-defect decision are durable.

If any criterion fails, fix only the bounded eighth-wave audit/verification defect and repeat this Prompt B from criterion 1.

If closeout passes:

- update and commit this canonical handoff with eighth-wave Prompt B PASS evidence;
- mark the migration project retired/monitor-only if no unresolved candidate exists;
- if a separately preregistered defect round exists, promote only that already-preregistered pair;
- re-fetch current remote `main` and verify durability/staleness;
- stop. Do not start another Prompt A automatically.
