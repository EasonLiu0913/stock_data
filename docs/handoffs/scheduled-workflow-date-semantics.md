# Scheduled Workflow Date Semantics Migration

Canonical handoff: `docs/handoffs/scheduled-workflow-date-semantics.md`

## Current phase

### Completed round — fifth-wave TAIFEX futures/options expected-date migration

Round identity: `fifth-wave-taifex-futures-options-expected-date-migration`

Prompt A starting baseline: `2642a232b8cdee947e9120920a9dab3c4c61ae1b`

Prompt A implementation commit: `bf50cf55330fb3d7d6325643a972b9b96ea58471`

Prompt A final implementation/test head: `5f3b3b3060319c2758166894e2f0ca8bdf41f2d6`

Prompt B closeout: PASS

Exact-head regression:

- workflow: `.github/workflows/test-scheduled-collection-date.yml`
- run ID: `33369408473`
- regression job ID: `99416854795`
- `head_sha`: `5f3b3b3060319c2758166894e2f0ca8bdf41f2d6`
- materialized/tested SHA: `5f3b3b3060319c2758166894e2f0ca8bdf41f2d6`
- conclusion: `success`
- deterministic tests: 34 pass, 0 fail

### Active / next round — sixth-wave residual scheduled-date audit

Active round identity: `sixth-wave-residual-scheduled-date-audit`

Status: preregistered; Prompt A not started by this closeout.

This next round is audit/classification only. It must determine whether any scheduled workflow with business/source-date semantics remains outside the already migrated or explicitly no-migration set. It must not perform production migration in the same round.

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
- A green workflow is not completion unless the tested implementation is the intended implementation head and durable remote state is verified.
- `scripts/resolve_scheduled_collection_date.js` remains a verified cron subset, not a general cron engine. Supported shapes are wildcard, integer, comma-separated integers, and simple integer ranges in five-field expressions.
- `github.event.schedule` is not an immutable occurrence timestamp. If a later identical cron occurrence has already passed, reconstruction is ambiguous without an independent durable occurrence identifier.
- TDCC source `observed_date` must remain source-derived; `available_at` remains conservative first successful archive capture time and must not be backdated.
- CNN source `fear_and_greed.timestamp` / `dataDate` must remain source-derived.
- TAIFEX futures/options artifact naming remains payload-date derived through `getPayloadDate(csvText)`; scheduled date is expected-date validation only.
- Do not migrate prediction/replay in this project without separate preregistration.

## Completed

### First wave

Implementation/test head: `53a32a03f5fd340c09876dc94ea22360f17359f4`

Regression run: `33353663345`

Handoff checkpoint: `5704095d91b7456af97f70d3a96fd88ca4e7ab56`

Shared entry points:

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

Conclusion: success.

Third-wave production scope included:

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

### Fourth wave — source-derived semantics audit

Audit baseline: `e355f828935c5d45cee5d099dca0ab9aa6e51c63`

Audit findings commit: `303bd5b4342a6825f16dd22992378a4850707b25`

Closeout checkpoint: `2642a232b8cdee947e9120920a9dab3c4c61ae1b`

Prompt B closeout: PASS

Classifications:

- TDCC shareholding snapshot: `no_migration`
- CNN Fear & Greed: `no_migration`
- TAIFEX futures/options source payload: `needs_migration_next_round`

### Fifth wave — TAIFEX futures/options expected-date migration

Prompt A baseline: `2642a232b8cdee947e9120920a9dab3c4c61ae1b`

Implementation commit: `bf50cf55330fb3d7d6325643a972b9b96ea58471`

Bounded regression-fix commit / final implementation-test head: `5f3b3b3060319c2758166894e2f0ca8bdf41f2d6`

Exact changed-file set from fifth-wave baseline to final head:

- `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml`
- `scripts/crawl_taifex_major_institutional_traders_futures_options.js`
- `tests/scheduled_date_fourth_wave.test.js`
- `.github/workflows/test-scheduled-collection-date.yml`

The crawler change is the preregistered strictly necessary test seam: existing payload-date extraction and expected-date mismatch behavior were factored into `resolvePayloadArtifact(csvText, expectedDateValue)` and exported for deterministic tests. Production behavior remains latest-only and payload-date canonical.

## Evidence / validation — fifth-wave Prompt B closeout

Correct Prompt B identity was recovered from durable pre-Prompt-A handoff checkpoint `2642a232b8cdee947e9120920a9dab3c4c61ae1b`.

### 1. Bounded scope — PASS

Production scope was limited to the TAIFEX futures/options workflow plus the preregistered strictly necessary crawler test seam. Test/regression scope was limited to the new deterministic suite and the scheduled-date regression workflow.

TDCC production workflow blob remains:

- `.github/workflows/crawl-tdcc-shareholding-snapshot.yml`: `c6a5d2f6a8bd9720d75e2f6fd0c0d102d0d5b417`

CNN production workflow blob remains:

- `.github/workflows/crawl-cnn-fear-and-greed.yml`: `7c7b9d3f9575365b7c79dd6391418586b9a45ee4`

Protected prediction/replay blobs remain:

- `scripts/resolve_latest_complete_prediction_base.js`: `61800be23d488bdf67874e87db492e8dc947b110`
- `scripts/resolve_prediction_replay_date.js`: `9dd7c74bbe73c4088138b7b1262a8fed71608ff7`

### 2. Scheduled occurrence semantics — PASS

Current workflow blob:

- `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml`: `91b0724db5fb28c768dd2bb563e1232aef84d636`

Verified contract:

- scheduled branch is gated by `github.event_name == 'schedule'`;
- `${{ github.event.schedule }}` is passed to `scripts/resolve_scheduled_collection_date.js`;
- resolver uses `--policy same_calendar_date --time-zone Asia/Taipei`;
- occurrence target date is passed to `scripts/resolve_taifex_scheduled_date.js --base-date ...`;
- previous-or-same TAIFEX trading date is exported as `TAIFEX_EXPECTED_DATE`;
- scheduled crawler invocation uses `--date "$TAIFEX_EXPECTED_DATE"`.

A delayed runner therefore does not substitute actual runner current date within the verified resolver's bounded occurrence-reconstruction limits.

### 3. Source-date preservation — PASS

Current crawler blob:

- `scripts/crawl_taifex_major_institutional_traders_futures_options.js`: `560c42e82338629e2af5a3203a37b9a64571c945`

Verified contract:

- `getPayloadDate(csvText)` still parses the payload source date;
- `resolvePayloadArtifact()` compares optional expected date against the payload date;
- mismatch throws instead of renaming/backdating/silently accepting;
- output filename remains `${payloadDate}_taifex_major_institutional_traders_futures_options.csv`.

### 4. Manual behavior — PASS

- manual explicit `workflow_dispatch.inputs.date` still invokes the crawler with `--date` as expected-date validation;
- manual no-date still invokes the crawler without `--date`, preserving latest-source behavior;
- the crawler error text explicitly states the open-data URL only returns the latest available file, so no historical-query capability is claimed.

### 5. Regression coverage — PASS

Current deterministic test blob:

- `tests/scheduled_date_fourth_wave.test.js`: `fef19e2e46777fabd27700ae2b25a3a328d63401`

Coverage includes:

- delayed 17:21 Taipei occurrence;
- delay crossing into next trading day / newer source payload;
- weekend rollback;
- configured non-trading weekday rollback;
- unchanged manual explicit expected-date behavior;
- payload-date filename preservation;
- mismatch failure.

Exact-head regression also ran the existing scheduled-date suites. Result: 34 pass, 0 fail.

### 6. Exact-head CI identity — PASS

Regression workflow current blob:

- `.github/workflows/test-scheduled-collection-date.yml`: `9a8d146ee58444aaecffb7f07491860fdf0a46d8`

Exact-head run evidence:

- run ID `33369408473`
- regression job ID `99416854795`
- run `head_sha`: `5f3b3b3060319c2758166894e2f0ca8bdf41f2d6`
- materialization `TESTED_SHA`: `5f3b3b3060319c2758166894e2f0ca8bdf41f2d6`
- `MATERIALIZED_SHA`: `5f3b3b3060319c2758166894e2f0ca8bdf41f2d6`
- regression job conclusion: `success`

The regression materializes files from the exact tested SHA, not moving `/main`.

### 7. Durable remote verification — PASS

Fresh remote `main` before handoff closeout commit was `5f3b3b3060319c2758166894e2f0ca8bdf41f2d6`, and both fifth-wave commits are reachable from it.

Required workflow, crawler, deterministic test, and exact-head regression workflow are present on remote `main` with the blob identities recorded above.

No concurrent commit appeared between Prompt A completion and Prompt B verification that changed fifth-wave entry points, tested SHA, protected blobs, or baseline assumptions.

Known limitation retained: `github.event.schedule` cannot uniquely recover an original occurrence once a later identical cron occurrence has also passed without an independent durable occurrence identifier. Fifth-wave tests prove only the bounded delay cases preregistered for this round.

## Current repository state

Fifth-wave Prompt B closeout: PASS.

Fifth-wave final implementation/test head: `5f3b3b3060319c2758166894e2f0ca8bdf41f2d6`.

The next active round is audit-only: `sixth-wave-residual-scheduled-date-audit`.

No sixth-wave production work has started.

## Entry points

### Repository rules / canonical state

- `AGENTS.md`
- `docs/project-philosophy.md`
- `docs/roadmap/current-phase.md`
- `docs/handoffs/scheduled-workflow-date-semantics.md`

### Shared scheduled-date infrastructure

- `scripts/resolve_scheduled_collection_date.js`
- `scripts/resolve_forecast_dates.js`
- `scripts/resolve_taifex_scheduled_date.js`
- `tests/resolve_scheduled_collection_date.test.js`
- `tests/scheduled_date_third_wave.test.js`
- `tests/scheduled_date_fourth_wave.test.js`
- `.github/workflows/test-scheduled-collection-date.yml`
- `data_history_sma/non_trading_days.json`

### Fifth-wave completed implementation

- `.github/workflows/crawl-taifex-major-institutional-traders-futures-options.yml`
- `scripts/crawl_taifex_major_institutional_traders_futures_options.js`

### Source-derived no-migration controls

TDCC:

- `.github/workflows/crawl-tdcc-shareholding-snapshot.yml`
- `scripts/crawl_tdcc_shareholding_snapshot.js`
- `tests/tdcc_shareholding_snapshot.test.js`

CNN:

- `.github/workflows/crawl-cnn-fear-and-greed.yml`
- `scripts/crawl_cnn_fear_and_greed.js`

### Prediction/replay safety gates — do not weaken

- `scripts/resolve_latest_complete_prediction_base.js`
- `scripts/resolve_prediction_replay_date.js`

### Sixth-wave audit boundary

- `.github/workflows/` — inspect only workflow YAML files containing a `schedule` trigger and date/business-date logic not already classified by this handoff.
- `docs/handoffs/scheduled-workflow-date-semantics.md` — the only file that may be changed in the sixth-wave audit round unless freshness repair is strictly necessary.

## Remaining scope / conservative classification

All previously identified implementation candidates have now either been migrated or explicitly classified as no-migration.

No additional production migration candidate is promoted by this closeout.

Residual risk remains that a scheduled workflow outside the already examined set may contain runner-clock or ambiguous date semantics. Therefore the next round is a repo-wide residual **audit-only** inventory over `.github/workflows/`, not another implementation wave.

The sixth wave must classify residual scheduled workflows into one of:

- `already_migrated_or_covered`
- `no_migration_source_or_repository_owned`
- `needs_separate_preregistered_migration`
- `date_irrelevant`

Any `needs_separate_preregistered_migration` finding must be recorded with exact repo-relative workflow/script/test entry points and deferred to a later paired Prompt A + Prompt B. Do not implement it in the sixth-wave audit round.

## Safety / stop conditions

- If current `main` materially changes an audited entry point before sixth-wave work begins, refresh the handoff before classification.
- Sixth wave is audit-only; do not edit production workflows/scripts/tests unless a freshness/correctness defect in the audit itself makes that strictly necessary.
- Do not infer migration need merely from presence of `schedule:` or multiple cron probes.
- Preserve all source-derived and repository-owned dates.
- Do not change prediction/replay.
- Do not broaden `scripts/resolve_scheduled_collection_date.js` cron grammar.
- If a residual workflow's exact domain semantics cannot be established from durable code/source evidence, classify it as unresolved and stop short of implementation.

## Preregistered Prompt A — sixth-wave residual scheduled-date audit

Continue the Scheduled Workflow Date Semantics Migration in repository `EasonLiu0913/stock_data`.

Active round: `sixth-wave-residual-scheduled-date-audit`.

This round is a bounded **audit/classification-only** round. Do not implement another production migration in the same round.

Before doing any work:
1. Read `AGENTS.md`.
2. Read `docs/project-philosophy.md` and `docs/roadmap/current-phase.md`.
3. Read the canonical handoff: `docs/handoffs/scheduled-workflow-date-semantics.md`.
4. Fetch current remote `main`; do not rely on local or conversation state.
5. Verify the fifth-wave closeout checkpoint and current blobs/entry points have not materially changed.
6. Inspect `.github/workflows/` and enumerate workflow YAML files that contain a `schedule` trigger.
7. Exclude only workflows already explicitly classified or migrated in this handoff after confirming their current paths still exist.

Audit only:

1. Build a deterministic residual inventory of scheduled workflows not yet explicitly classified by this handoff.
2. For each residual workflow, inspect its exact repo-relative workflow path plus every exact script/config/test path that materially determines its date/business-date behavior.
3. Classify each as exactly one of:
   - `already_migrated_or_covered`
   - `no_migration_source_or_repository_owned`
   - `needs_separate_preregistered_migration`
   - `date_irrelevant`
4. Record the evidence for each classification in `docs/handoffs/scheduled-workflow-date-semantics.md`.
5. For every `needs_separate_preregistered_migration`, list exact known workflow/script/test/config entry points and the preserved domain policy, but do not implement it.
6. Preserve TDCC, CNN, TAIFEX, prediction/replay, and all prior migrated contracts unchanged.
7. If no residual workflow requires migration, record that the migration project has no currently identified production candidate and preregister a final verification/retirement round rather than inventing new implementation work.

Bounded write scope:

- expected repository change: `docs/handoffs/scheduled-workflow-date-semantics.md` only;
- production workflow/script/test changes are forbidden unless a directly relevant freshness/correctness defect makes a bounded repair necessary and is documented.

Stop conditions:

- If exact date ownership cannot be established for a residual workflow, mark it unresolved; do not guess or implement.
- If current `main` changes materially during the audit, refresh affected evidence before completion.
- Do not turn audit findings into same-round production changes.

Prompt A completion contract:

- every residual scheduled workflow has an explicit classification or an explicit unresolved status with exact paths;
- any future migration candidate has exact entry points and preserved policy recorded;
- bounded changed-file set is proven;
- current remote `main` is re-fetched and the audit handoff is durable;
- paired next-round Prompt A + Prompt B are preregistered in the handoff before reporting completion;
- then report exactly `Prompt A complete — ready for Prompt B` and stop.

## Preregistered Prompt B — sixth-wave residual scheduled-date audit closeout

Perform closeout verification for active round `sixth-wave-residual-scheduled-date-audit` in repository `EasonLiu0913/stock_data`.

Before verification:
1. Read `AGENTS.md`.
2. Read `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, and `docs/handoffs/scheduled-workflow-date-semantics.md` from current remote `main`.
3. Fetch current remote `main` and recover the sixth-wave Prompt A baseline and audit findings commit from durable repository history.
4. Use this preregistered Prompt B from the pre-Prompt-A handoff checkpoint as the only closeout version.

Verify independently:

1. **Bounded scope**
   - The audit changed `docs/handoffs/scheduled-workflow-date-semantics.md` only, unless a strictly necessary freshness repair is explicitly documented and bounded.
   - No production scheduled-date migration was performed in the audit round.
   - Prediction/replay protected blobs remain unchanged.

2. **Residual inventory completeness**
   - Re-enumerate `.github/workflows/` workflow YAML files containing a `schedule` trigger from current remote `main`.
   - Verify every residual workflow not already classified/migrated by the handoff appears in the sixth-wave audit table or is explicitly accounted for as already covered.
   - No workflow may be omitted merely because its date logic is indirect.

3. **Classification quality**
   - Every residual item is exactly one of `already_migrated_or_covered`, `no_migration_source_or_repository_owned`, `needs_separate_preregistered_migration`, `date_irrelevant`, or explicitly unresolved.
   - Each classification cites exact repo-relative workflow/script/config/test entry points that establish date ownership.
   - No migration need is inferred solely from cron presence or multiple probes.

4. **Protected invariants**
   - TDCC `observed_date` / conservative `available_at` semantics remain unchanged.
   - CNN source timestamp / `dataDate` semantics remain unchanged.
   - TAIFEX futures/options payload-date artifact identity and mismatch failure remain unchanged.
   - `scripts/resolve_scheduled_collection_date.js` cron grammar was not broadened.
   - Prediction/replay safety gates remain unchanged.

5. **Future-candidate preregistration**
   - Every `needs_separate_preregistered_migration` candidate has exact known workflow/script/test/config entry points, frozen domain policy, stop conditions, a bounded Prompt A, and a phase-specific Prompt B preregistered before any implementation.
   - If there is no candidate, the next paired prompts must be a final verification/retirement round rather than speculative implementation.

6. **Durable evidence**
   - Re-fetch current remote `main` after any audit write.
   - Verify the audit findings and paired next-round prompts are present in the canonical handoff on remote `main`.
   - Verify the audit commit is reachable from current `main`.
   - Treat a local summary or green unrelated workflow as insufficient evidence.

If any criterion fails, fix only the bounded audit/freshness defect and repeat this Prompt B from criterion 1.

If closeout passes:

- update the canonical handoff with sixth-wave closeout evidence;
- mark `Prompt B closeout: PASS`;
- promote only the already-preregistered next round;
- commit the handoff;
- re-fetch current remote `main` and verify the handoff is durable and not stale;
- then stop. Do not start the next Prompt A automatically.
