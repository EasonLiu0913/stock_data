# Scheduled Workflow Date Semantics Migration

Canonical handoff: `docs/handoffs/scheduled-workflow-date-semantics.md`

## Current phase

The repo-wide audit plus first-wave, second-wave, and third-wave migrations are complete.

### Completed round — fourth-wave source-derived semantics audit

Round identity: `fourth-wave-source-derived-semantics-audit`

Prompt A audit baseline: `e355f828935c5d45cee5d099dca0ab9aa6e51c63`

Prompt A durable audit findings commit: `303bd5b4342a6825f16dd22992378a4850707b25`

Prompt B closeout: PASS

The fourth wave was audit/classification only. No production workflow, crawler, regression implementation, prediction/replay script, or unrelated workflow was changed. The only Prompt A repository change from baseline to audit findings commit was this canonical handoff.

Verified classifications:

- TDCC shareholding snapshot: `no_migration`
- CNN Fear & Greed: `no_migration`
- TAIFEX futures/options source payload: `needs_migration_next_round`

### Active / next round — fifth-wave TAIFEX futures/options expected-date migration

Active round identity: `fifth-wave-taifex-futures-options-expected-date-migration`

Status: preregistered; Prompt A not started by this closeout.

The fifth wave is the narrowly bounded scheduled expected-date migration for TAIFEX futures/options. Its Prompt A and Prompt B are preregistered below and are now the active paired prompts.

## Objective

Make scheduled collection/business dates delay-safe while preserving each workflow's real domain policy.

Architecture remains deliberately small:

1. **Scheduled occurrence resolution** — reconstruct the intended triggering cron occurrence when schedule logically owns an expected business date.
2. **Domain date policy** — map the occurrence to the workflow's business/source-date expectation.
3. **Source-derived date preservation** — when the upstream payload is authoritative for the observation/business date, keep that date source-derived and use any scheduled date only as an expected-date validation when justified.

Do not use the audit taxonomy D1-D7 as production policy identifiers.

## Frozen decisions / constraints

- Manual explicit dates remain authoritative.
- Source/API-derived dates remain source-derived when they are the canonical business date.
- Repository/latest-complete-data workflows remain repository-driven.
- Do not silently fall back to an older trading date unless that fallback is an explicit preserved domain policy.
- Prediction/replay stale-data safety gates must not be weakened.
- Preserve existing crawler outputs, validation gates, persistence, and large-fetch plan/fresh-runner physical-batch architecture.
- Shared infrastructure must remain small and evidence-driven; do not build a scheduler/DAG/plugin framework.
- Known exact entry-point paths must be carried forward in handoffs/prompts.
- A green workflow is not completion unless the tested implementation is the exact intended implementation head and required durable files are present on remote `main`.
- `scripts/resolve_scheduled_collection_date.js` is a verified cron subset, not a general cron engine. Supported shapes remain `*`, integers, comma-separated integers, and simple integer ranges in standard five-field expressions.
- `github.event.schedule` is not an immutable occurrence timestamp. If a later identical cron occurrence has already passed, reconstruction is ambiguous; do not claim exactness without an independent durable occurrence identifier.
- TDCC source `observed_date` must not be replaced by scheduled date.
- TDCC `available_at` remains conservative first successful archive capture time and must not be backdated.
- CNN source `fear_and_greed.timestamp` / `dataDate` remains source-derived.
- TAIFEX futures/options artifact naming remains payload-date derived through `getPayloadDate(csvText)`; the fifth wave may add an occurrence-derived expected-date gate, but must not replace payload date as the canonical artifact date.

## Completed

### First wave

Implementation/test head: `53a32a03f5fd340c09876dc94ea22360f17359f4`

Regression run: `33353663345`

Handoff checkpoint: `5704095d91b7456af97f70d3a96fd88ca4e7ab56`

Shared implementation:

- `scripts/resolve_scheduled_collection_date.js`
- `scripts/resolve_forecast_dates.js`
- `tests/resolve_scheduled_collection_date.test.js`
- `.github/workflows/test-scheduled-collection-date.yml`

### Second wave

Implementation/test head: `27ce0b0e1eb8eb9beabe2a8a087571bc4cd47bb1`

Regression run: `33354868624`

Closeout checkpoint: `89a2ade5cbe15e9e0858cb607cc699fc7fbf9878`

### Third wave

Implementation/test head: `63c2c4a2867944cb6522c0f14715a1c23dd19109`

Exact-head regression run: `33365436045`

Regression job: `99404991901`

Conclusion: `success`; deterministic tests: 27 pass, 0 fail.

Third-wave production scope:

- `.github/workflows/crawl-external-market-indicators.yml`
- `.github/workflows/crawl-refined-product-tightness.yml`
- `.github/workflows/crawl-rankings.yml`
- `.github/workflows/crawl-taifex-major-institutional-traders-futures-contracts.yml`
- `scripts/resolve_external_market_session_date.js`
- `scripts/resolve_fubon_ranking_date.js`
- `scripts/resolve_taifex_scheduled_date.js`
- `scripts/scraper_fubon.js`
- `scripts/scraper_fubon_foreign.js`
- `scripts/scraper_fubon_other.js`
- `tests/scheduled_date_third_wave.test.js`
- `.github/workflows/test-scheduled-collection-date.yml`

Protected prediction/replay blobs at third-wave implementation head:

- `scripts/resolve_latest_complete_prediction_base.js`: `61800be23d488bdf67874e87db492e8dc947b110`
- `scripts/resolve_prediction_replay_date.js`: `9dd7c74bbe73c4088138b7b1262a8fed71608ff7`

Third-wave handoff checkpoint before fourth-wave audit: `e355f828935c5d45cee5d099dca0ab9aa6e51c63`.

### Fourth wave — source-derived semantics audit

Audit baseline: `e355f828935c5d45cee5d099dca0ab9aa6e51c63`

Audit findings commit: `303bd5b4342a6825f16dd22992378a4850707b25`

Prompt B closeout: PASS

No GitHub Actions run was required by the preregistered fourth-wave Prompt B because this was a documentation/audit-only round; closeout independently verified durable code/blob identities and the audit-only changed-file boundary instead of treating an unrelated green run as evidence.

## Evidence / validation — fourth-wave Prompt B closeout

Correct Prompt B identity was recovered from durable repository history at pre-Prompt-A checkpoint `e355f828935c5d45cee5d099dca0ab9aa6e51c63`.

That preregistered Prompt B was the mandatory closeout for the fourth-wave source-derived audit and contained seven criteria: bounded scope; TDCC classification; CNN classification; TAIFEX futures/options classification; shared resolver limits; durable evidence; next-round preregistration.

### 1. Bounded scope — PASS

Compare `e355f828935c5d45cee5d099dca0ab9aa6e51c63...303bd5b4342a6825f16dd22992378a4850707b25` contains exactly one changed file:

- `docs/handoffs/scheduled-workflow-date-semantics.md`

Therefore:

- no production date-semantics migration was made in fourth wave;
- no TDCC/CNN/TAIFEX production workflow or crawler was modified;
- no prediction/replay or unrelated workflow was changed.

### 2. TDCC source-date classification — PASS

Current verified blobs:

- `.github/workflows/crawl-tdcc-shareholding-snapshot.yml`: `c6a5d2f6a8bd9720d75e2f6fd0c0d102d0d5b417`
- `scripts/crawl_tdcc_shareholding_snapshot.js`: `3bc0ef36fb1e4fe7d096e9c34948f615cad921e9`
- `tests/tdcc_shareholding_snapshot.test.js`: `bfac615b903efed9d23c4500905ae0d596debe82`

Verified contract:

- `normalizeRows()` reads the source row date through `FIELD.date` and writes `observed_date`;
- all valid rows must resolve to exactly one source observation date;
- canonical weekly path and manifest identity are derived from that source date;
- `capturedAt` defaults to actual `new Date().toISOString()` and records real capture time;
- `available_at` is initialized from first successful capture and preserved on later duplicate/migration runs;
- the probe schedule is therefore distinct from source `observed_date`, `captured_at`, and conservative `available_at`.

Decision: `no_migration`.

### 3. CNN Fear & Greed classification — PASS

Current verified blobs:

- `.github/workflows/crawl-cnn-fear-and-greed.yml`: `7c7b9d3f9575365b7c79dd6391418586b9a45ee4`
- `scripts/crawl_cnn_fear_and_greed.js`: `6c31cd4fad03ceaf664d1b3d01a227a25850bc95`

Verified contract:

- `validatePayload()` requires `fear_and_greed.timestamp`;
- `dataDate` is extracted directly from the source timestamp's `YYYY-MM-DD` portion;
- output path, GitHub outputs, and manifest date are source-derived;
- runner wall clock does not name or validate the official CNN artifact;
- delayed execution may observe a later source snapshot but must not replace source date with scheduled occurrence.

Decision: `no_migration`.

### 4. TAIFEX futures/options classification — PASS

Current verified blobs:

- `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml`: `2c3e1b6af03c7c7ed627a00c62e3858767811034`
- `scripts/crawl_taifex_major_institutional_traders_futures_options.js`: `9a6e1235c145cd2472a6df141f2b04a8fee09ff9`

Verified contract:

- `getPayloadDate(csvText)` parses the first source data row and remains the canonical source/artifact date;
- output filename remains `${payloadDate}_taifex_major_institutional_traders_futures_options.csv`;
- manual `--date` remains an expected-date check against a latest-only endpoint, not a historical query parameter;
- current scheduled runs do not pass `--date`, creating a real occurrence-to-latest-source validation gap if an old occurrence starts after the source has advanced to the next trading date;
- this finding does not copy the futures-contract crawler wholesale and does not replace source payload date with scheduled date.

Decision: `needs_migration_next_round`.

### 5. Shared resolver / occurrence limits — PASS

Current `scripts/resolve_scheduled_collection_date.js` blob: `7f081771527ecf3b395d8f864aad93ac94c26325`.

Verified limitations remain documented:

- supported cron subset is wildcard, integer, comma-separated integers, and simple integer ranges in a five-field expression;
- no unsupported cron grammar was introduced by the audit;
- future occurrence-based TAIFEX validation must preserve the limitation that `github.event.schedule` is not an immutable occurrence timestamp and cannot prove the original occurrence after a later identical occurrence has already passed.

### 6. Durable evidence — PASS

Fourth-wave audit findings and all three classifications are present on remote `main` in commit `303bd5b4342a6825f16dd22992378a4850707b25`.

Current protected prediction/replay blobs remain unchanged:

- `scripts/resolve_latest_complete_prediction_base.js`: `61800be23d488bdf67874e87db492e8dc947b110`
- `scripts/resolve_prediction_replay_date.js`: `9dd7c74bbe73c4088138b7b1262a8fed71608ff7`

### 7. Next-round preregistration — PASS

Every fourth-wave source has an explicit classification. The only migration candidate is TAIFEX futures/options, and the fifth-wave implementation is preregistered to exact paths and deterministic regression cases below.

Paired fifth-wave Prompt A + Prompt B were already preregistered in the fourth-wave audit findings commit before fourth-wave closeout and remain preserved below.

## Current repository state

Fourth-wave Prompt A baseline: `e355f828935c5d45cee5d099dca0ab9aa6e51c63`.

Fourth-wave Prompt A audit findings commit: `303bd5b4342a6825f16dd22992378a4850707b25`.

Fourth-wave Prompt B closeout: PASS.

Fourth-wave closeout handoff checkpoint: this section is committed by the closeout commit immediately following `303bd5b4342a6825f16dd22992378a4850707b25`; after commit, current remote `main` must be re-fetched and this handoff must remain consistent with all active fifth-wave entry points.

No production semantics were changed by either fourth-wave Prompt A or Prompt B.

## Entry points

### Repository rules / canonical state

- `AGENTS.md`
- `docs/project-philosophy.md`
- `docs/roadmap/current-phase.md`
- `docs/handoffs/scheduled-workflow-date-semantics.md`

### Shared scheduled-date infrastructure

- `scripts/resolve_scheduled_collection_date.js`
- `scripts/resolve_forecast_dates.js`
- `tests/resolve_scheduled_collection_date.test.js`
- `tests/scheduled_date_third_wave.test.js`
- `.github/workflows/test-scheduled-collection-date.yml`

### Fourth-wave completed audit entry points

TDCC:

- `.github/workflows/crawl-tdcc-shareholding-snapshot.yml`
- `scripts/crawl_tdcc_shareholding_snapshot.js`
- `tests/tdcc_shareholding_snapshot.test.js`

CNN:

- `.github/workflows/crawl-cnn-fear-and-greed.yml`
- `scripts/crawl_cnn_fear_and_greed.js`

TAIFEX futures/options audited source:

- `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml`
- `scripts/crawl_taifex_major_institutional_traders_futures_options.js`

### Active fifth-wave exact implementation/test entry points

- `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml`
- `scripts/crawl_taifex_major_institutional_traders_futures_options.js`
- `scripts/resolve_scheduled_collection_date.js`
- `scripts/resolve_taifex_scheduled_date.js`
- `data_history_sma/non_trading_days.json`
- `tests/scheduled_date_fourth_wave.test.js` (new in fifth wave)
- `.github/workflows/test-scheduled-collection-date.yml`
- `tests/resolve_scheduled_collection_date.test.js`
- `tests/scheduled_date_third_wave.test.js`

### Prediction/replay safety gates — do not weaken

- `scripts/resolve_latest_complete_prediction_base.js`
- `scripts/resolve_prediction_replay_date.js`

## Known problems / rejected approaches / remaining risks

- Do not automatically migrate a scheduled workflow merely because it has multiple cron probes.
- TDCC `observed_date` is source-derived; `available_at` is conservative first-successful-capture time and must not be backdated.
- CNN `dataDate` is source timestamp-derived and must not become an occurrence-derived artifact date.
- TAIFEX futures/options should not copy the futures-contract crawler wholesale. Reuse only the proven occurrence resolution plus previous-or-same-trading-date expectation; keep the latest-only source payload authoritative for artifact date.
- `--date` on the TAIFEX futures/options crawler is expected-date validation only; do not make it claim historical-query capability.
- The shared resolver cannot recover an original occurrence once a later identical cron occurrence has also passed without an independent durable occurrence identifier. Fifth-wave tests may prove bounded delay behavior, but must not erase this information-theoretic limitation.
- Do not migrate prediction/replay as part of this project without separate preregistration.
- Do not expand fifth wave to TDCC, CNN, or unrelated workflows.

## Next round

Active / next round: `fifth-wave-taifex-futures-options-expected-date-migration`.

Implement only the preregistered scheduled expected-date gate for TAIFEX futures/options.

Meaningful phase boundary:

- scheduled occurrence is converted to the previous-or-same TAIFEX trading date;
- that date is passed as crawler `--date` expected-date validation;
- source `getPayloadDate(csvText)` remains canonical artifact date;
- deterministic regression proves delayed-runner, weekend, holiday, manual-date, and source-date-preservation behavior;
- exact-head GitHub regression succeeds;
- remote durable implementation/test files are verified before Prompt A can be declared complete.

## Safety / stop conditions

- If current `main` materially changes any active fifth-wave entry point before implementation, refresh this handoff before coding.
- Do not replace source-derived payload date with scheduled date.
- Do not change TDCC or CNN production code in the fifth wave.
- Do not change manual explicit TAIFEX expected-date behavior.
- Do not make `--date` claim historical-query capability; the endpoint is latest-only.
- Do not weaken source mismatch failure.
- Do not treat `resolve_scheduled_collection_date.js` as a general cron engine.
- Do not claim exact intended occurrence after a later identical cron occurrence has passed without an independent durable occurrence identifier.
- Do not modify prediction/replay stale fallback behavior.
- Do not expand beyond the preregistered TAIFEX futures/options workflow/test scope.

## Preregistered Prompt A — fifth-wave implementation prompt

Continue the Scheduled Workflow Date Semantics Migration in repository `EasonLiu0913/stock_data`.

Active round: `fifth-wave-taifex-futures-options-expected-date-migration`.

This round is a bounded **TAIFEX futures/options scheduled expected-date migration**.

Before doing any work:
1. Read `AGENTS.md`.
2. Read `docs/project-philosophy.md` and `docs/roadmap/current-phase.md`.
3. Read the canonical handoff: `docs/handoffs/scheduled-workflow-date-semantics.md`.
4. Fetch current remote `main`; do not rely on local/conversation state.
5. Verify the fourth-wave Prompt B closeout checkpoint and these exact entry points have not materially changed. If they have, refresh the handoff before continuing.
6. Read:
   - `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml`
   - `scripts/crawl_taifex_major_institutional_traders_futures_options.js`
   - `scripts/resolve_scheduled_collection_date.js`
   - `scripts/resolve_taifex_scheduled_date.js`
   - `data_history_sma/non_trading_days.json`
   - `.github/workflows/test-scheduled-collection-date.yml`
   - `tests/resolve_scheduled_collection_date.test.js`
   - `tests/scheduled_date_third_wave.test.js`

Implement only:

1. In `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml`, split scheduled and non-scheduled date handling without changing manual explicit behavior.
2. For `schedule`, resolve the intended occurrence from `${{ github.event.schedule }}` using `scripts/resolve_scheduled_collection_date.js` with `Asia/Taipei` calendar semantics.
3. Feed that occurrence date to `scripts/resolve_taifex_scheduled_date.js --base-date ...` so weekends and `data_history_sma/non_trading_days.json` roll back to previous-or-same trading date.
4. Invoke `scripts/crawl_taifex_major_institutional_traders_futures_options.js --date "$EXPECTED_DATE"` for scheduled runs.
5. Preserve the crawler's existing latest-only behavior: `getPayloadDate(csvText)` remains the canonical source/artifact date, and mismatch against `--date` must fail rather than rename the payload.
6. Keep `workflow_dispatch.inputs.date` semantics unchanged. Manual no-date remains latest-source behavior.
7. Add `tests/scheduled_date_fourth_wave.test.js` with deterministic coverage for:
   - delayed 17:21 Taipei occurrence;
   - delay crossing into the next trading day/source payload date;
   - weekend rollback;
   - configured non-trading weekday rollback;
   - unchanged manual explicit expected-date behavior;
   - source payload date remains output filename date;
   - mismatch fails.
8. Wire the new test and TAIFEX futures/options workflow/script paths into `.github/workflows/test-scheduled-collection-date.yml` exact-head materialization and regression checks.

Frozen constraints:

- Do not edit TDCC or CNN production files.
- Do not replace source payload date with scheduled date.
- Do not change `getPayloadDate(csvText)` semantics except for a strictly necessary test seam that preserves production behavior.
- Do not make `--date` into a historical-query promise.
- Do not weaken mismatch failure.
- Do not modify prediction/replay.
- Do not expand to any workflow outside this preregistered TAIFEX futures/options scope.

Required implementation evidence:

- exact starting `main` SHA;
- exact changed-file list proving bounded scope;
- local/deterministic Node syntax/tests for all touched JS/test files;
- exact-head GitHub Actions regression from `.github/workflows/test-scheduled-collection-date.yml` whose `head_sha`, tested SHA, and intended implementation/test head all match;
- remote blob verification for the workflow, new test, regression workflow, and any touched script;
- verification that TDCC/CNN production blobs and protected prediction/replay blobs did not change.

Prompt A completion contract:

- scheduled TAIFEX futures/options runs validate the occurrence-owned expected trading date while preserving source payload artifact date;
- all preregistered regression cases pass;
- exact-head regression is green;
- bounded production/test scope is proven;
- required files/contract markers are present on current remote `main` after a fresh fetch;
- implementation state is durable on remote `main`;
- then report exactly `Prompt A complete — ready for Prompt B` and stop.

## Preregistered Prompt B — fifth-wave closeout / verification prompt

Perform closeout verification for active round `fifth-wave-taifex-futures-options-expected-date-migration` in repository `EasonLiu0913/stock_data`.

Before verification:
1. Read `AGENTS.md`.
2. Read `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, and `docs/handoffs/scheduled-workflow-date-semantics.md` from current remote `main`.
3. Fetch current remote `main` and identify the claimed fifth-wave implementation/test head and exact-head regression run.

Verify independently:

1. **Bounded scope**
   - Production changes are limited to `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml` unless this handoff preregistered a strictly necessary crawler test seam.
   - Test/regression changes are limited to `tests/scheduled_date_fourth_wave.test.js` and `.github/workflows/test-scheduled-collection-date.yml` plus any explicitly preregistered strictly necessary helper change.
   - TDCC and CNN production blobs are unchanged.
   - Prediction/replay protected blobs are unchanged.

2. **Scheduled occurrence semantics**
   - Scheduled branch derives the intended occurrence from `${{ github.event.schedule }}` via `scripts/resolve_scheduled_collection_date.js` in `Asia/Taipei`.
   - The occurrence calendar date is converted through `scripts/resolve_taifex_scheduled_date.js` to previous-or-same trading date using `data_history_sma/non_trading_days.json`.
   - A delayed runner does not substitute actual runner current date.

3. **Source-date preservation**
   - `getPayloadDate(csvText)` remains the canonical source date.
   - Output filename is still based on payload date.
   - Scheduled expected date is validation only.
   - Mismatch fails; it must not rename, backdate, or silently accept a newer payload for an older occurrence.

4. **Manual behavior**
   - Manual explicit input remains authoritative expected-date validation.
   - Manual no-date remains latest-source behavior.
   - The workflow does not claim the latest-only endpoint supports historical date queries.

5. **Regression coverage**
   - Deterministic tests cover delayed 17:21 occurrence, next-trading-day crossing, weekend rollback, configured holiday rollback, manual explicit date, payload-date filename preservation, and mismatch failure.
   - Existing scheduled-date regression suites still pass.

6. **Exact-head CI identity**
   - Regression run `head_sha` equals the claimed implementation/test head.
   - Materialization uses that exact SHA, not moving `/main`.
   - The regression job conclusion is `success`.

7. **Durable remote verification**
   - Re-fetch current `main` after CI/write activity.
   - Verify the expected workflow/test/regression files and required contract markers exist on remote `main`.
   - Verify the implementation commit is actually reachable from current `main`.
   - Treat green-but-missing remote output as failure.

If any important criterion fails, fix or bounded-rerun only what is necessary and repeat Prompt B verification from criterion 1. Do not proceed to a later migration wave until Prompt B passes.

If closeout passes:

- update this canonical handoff with fifth-wave implementation head, exact-head regression run/job, changed-file list, preserved blob identities, and durable remote verification;
- classify remaining scheduled-date audit scope conservatively;
- preregister the next paired Prompt A + Prompt B before any further migration;
- mark fifth-wave `Prompt B closeout: PASS` and promote the next preregistered round only then;
- commit the handoff;
- re-fetch current remote `main` and verify the handoff is durable and not stale;
- then stop. Do not start the next Prompt A automatically.
