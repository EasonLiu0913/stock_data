# Turso TWSE Institutional Migration Design

Canonical design artifact: `docs/handoffs/turso-twse-institutional-migration-design.md`

Status: **design-only / no production migration authorized**

This document converts the bounded Turso POC evidence from Phases 3–8 into a reversible migration design for owner review. It does not authorize production writes, reads, schedules, secret/config changes, deployment changes, PR #52 merge, or source-of-truth changes.

## 1. Evidence basis

The design is limited to the proven TWSE T86 institutional dataset and the current production consumers verified in the repository.

POC evidence:
- frozen population: 20 dates / 21,475 rows / 1,088 four-digit IDs;
- Phase 7 consumer-complete structured table: `turso_poc_equity_structured_v4_phase7`;
- Phase 7 source metadata table: `turso_poc_equity_structured_sources_v4_phase7`;
- nine stored metrics: `foreign_buy`, `foreign_sell`, `foreign_net`, `foreign_dealer_net`, `trust_buy`, `trust_sell`, `trust_net`, `dealer_net`, `total_net`;
- proven current-consumer minimum: `foreign_ex_dealer_net`, `foreign_dealer_net`, `trust_net`, `dealer_net`;
- Phase 8 read-contract parity: exact 21,475-row match on identity plus the four required metrics, repeated-read SHA-256 `401045e819a3f909a515896a2dffedc4658bde49bcd765c191c86e8156a5768f`;
- explicit instrument classification: stock 1,053 IDs, innovation_board 31, TDR 4, unmatched 0, ambiguous 0;
- measured Phase 7 SQLite logical table-family size: 1,982,464 bytes / 484 pages;
- prior v3 logical table-family size: 1,937,408 bytes / 473 pages;
- these sizes are SQLite logical page evidence only, not Turso billing usage.

## 2. Current production source-of-truth flow

### 2.1 Canonical writer

Workflow:
- `.github/workflows/crawl-twse-institutional-investors.yml`
- current schedule contains seven weekday collection attempts at 12:01, 13:23, 14:07, 15:09, 16:13, 17:19, and 18:21 Asia/Taipei-equivalent schedule slots;
- `cancel-in-progress: false`;
- writes repository contents and pushes to `main`.

Crawler:
- `scripts/crawl_twse_institutional_investors.js`
- source endpoint: TWSE T86;
- canonical output directory: `data_twse_institutional_investors/`;
- canonical daily path: `data_twse_institutional_investors/<YYYYMMDD>_twse_institutional_investors.json`;
- writes the raw TWSE-shaped JSON payload;
- refreshes the dataset file list.

Dataset index:
- `scripts/generate_file_lists.js`;
- canonical index: `data_twse_institutional_investors/files.json`.

**Current source-of-truth invariant:** the committed daily JSON file under `data_twse_institutional_investors/` is authoritative. A future Turso shadow write must never replace, delay, gate, or mutate this canonical write before separate owner authorization.

### 2.2 Normalization path

Workflow:
- `.github/workflows/backfill-normalized-data.yml`;
- currently manual/workflow-dispatch repair/backfill path;
- commits `data_normalized/` to `main`.

Normalizer:
- `scripts/backfill_normalized_data.js`;
- institutional source directory: `data_twse_institutional_investors`;
- institutional normalized output directory: `data_normalized/institutional_investors`;
- normalized institutional schema version: 1;
- output shape includes `stock_code`, `stock_name`, `foreign`, `trust`, `dealer`, and `total`;
- `foreign` is derived from foreign cash/ex-dealer plus foreign dealer;
- `total` uses source total when present and otherwise a derived total.

Canonical normalized path:
- `data_normalized/institutional_investors/<YYYYMMDD>.json`.

### 2.3 Proven direct raw-T86 consumers

Phase 6 audit identified these current runtime files as direct consumers of `data_twse_institutional_investors`:

- `scripts/annotate_prediction_data_lineage.js`
- `scripts/apply_pages_size_budget.js`
- `scripts/audit_scheduled_workflow_outputs.js`
- `scripts/backfill_normalized_data.js`
- `scripts/backtest_market_news_risk.js`
- `scripts/build_institutional_accumulation_catalyst_outcome_association_execution.js`
- `scripts/build_institutional_accumulation_catalyst_outcome_association_protocol.js`
- `scripts/check_forecast_required_files.js`
- `scripts/crawl_history_twse_institutional_investors.js`
- `scripts/crawl_twse_institutional_investors.js`
- `scripts/generate_all_stock_predictions.js`
- `scripts/generate_file_lists.js`
- `scripts/plan_twse_institutional_investors_backfill.js`
- `scripts/prepare_and_verify_forecast_inputs.js`
- `scripts/resolve_latest_complete_prediction_base.js`
- `scripts/run_twse_institutional_investors_backfill_batch.sh`
- `scripts/trim_pages_artifact.js`
- `scripts/verify_prediction_data_readiness.js`

### 2.4 Proven normalized institutional consumers

Phase 6 audit identified these current runtime files as consumers of `data_normalized/institutional_investors`:

- `scripts/annotate_prediction_data_lineage.js`
- `scripts/backfill_normalized_data.js`
- `scripts/generate_all_stock_predictions.js`
- `scripts/install_breakout_json_export.js`

### 2.5 Prediction/readiness hard dependencies

Verified current-main examples:

- `scripts/generate_all_stock_predictions.js` defines both:
  - `data_twse_institutional_investors` as the raw institutional directory;
  - `data_normalized/institutional_investors` as normalized institutional input.
- `scripts/verify_prediction_data_readiness.js` requires the raw path
  `data_twse_institutional_investors/<baseDate>_twse_institutional_investors.json`.
- `scripts/check_forecast_required_files.js` also treats that raw file as a required forecast input.
- `scripts/prepare_and_verify_forecast_inputs.js` reads the raw T86 file, normalizes it, and writes normalized institutional output used by forecast preparation.

Therefore a production cutover cannot be modeled as a single reader switch. Raw-file availability, normalized-file production, readiness gates, prediction code, Pages publication, and research consumers all need staged compatibility treatment.

### 2.6 Publication boundary

Workflow:
- `.github/workflows/deploy-pages.yml`.

Current behavior:
- Pages dependency discovery includes `data_twse_institutional_investors`;
- publication copies repository data into the Pages artifact;
- repository historical data remains the source; Pages slimming affects only `_site`;
- deployment itself never commits repository data.

A Turso migration must not make Pages depend on live database availability unless separately designed and authorized. The safest initial design preserves file publication unchanged.

## 3. Proposed ownership and versioning

### 3.1 Canonical ownership during shadow phases

During all design and shadow-validation phases:

1. TWSE T86 fetch result is written to the canonical repository JSON first.
2. Canonical JSON remains the source of truth.
3. Turso is a secondary shadow sink only.
4. A Turso failure may produce diagnostics but must not invalidate or roll back a successful canonical file write.
5. No production reader is allowed to require Turso while the feature flag is default-off.
6. Reconciliation compares Turso with the canonical file/normalized output, never the reverse.

### 3.2 Proposed production table identity

Do not reuse POC table names.

If owner later authorizes a shadow experiment, use a versioned production-shadow namespace, for example:

- `twse_institutional_shadow_v1`
- `twse_institutional_shadow_sources_v1`

Required key:
- `trade_date`
- `stock_id`

Required stored metrics at minimum:
- `foreign_net` representing `foreign_ex_dealer_net`;
- `foreign_dealer_net`;
- `trust_net`;
- `dealer_net`.

The proven nine-metric Phase 7 projection is preferred for the shadow table because it already has exact two-pass parity evidence:
- `foreign_buy`
- `foreign_sell`
- `foreign_net`
- `foreign_dealer_net`
- `trust_buy`
- `trust_sell`
- `trust_net`
- `dealer_net`
- `total_net`.

Schema version must be explicit and immutable once a shadow evidence window starts. A schema change creates a new table/version; it must not silently ALTER evidence already being evaluated.

## 4. Proposed shadow-write design

This section is design only.

### 4.1 Ordering

Proposed order for an owner-authorized future experiment:

```
TWSE T86 fetch
  -> validate payload
  -> write canonical JSON
  -> refresh files.json
  -> canonical commit/checkpoint remains independent
  -> optional shadow writer reads the exact canonical file bytes
  -> write Turso versioned shadow rows
  -> produce parity/diagnostic artifact
```

The shadow writer must read the committed/canonical file representation, not independently refetch TWSE. This gives one input identity and avoids source-time races.

### 4.2 Failure semantics

- Canonical file failure: existing workflow semantics remain authoritative.
- Turso unavailable: canonical write still succeeds; shadow result is `degraded_database_unavailable`.
- Turso auth missing: skip shadow path with explicit non-secret diagnostic; canonical path succeeds.
- Partial Turso batch: shadow result fails closed; date is not counted as parity evidence.
- Parity mismatch: canonical file wins; no reader switch allowed.
- Push race or workflow retry: Turso shadow upsert must be idempotent on `(trade_date, stock_id)`.
- A retry must not change canonical source identity for a previously accepted date without explicit source-hash reconciliation.

## 5. Proposed shadow-read / dual-read validation

No production consumer is changed in Phase 9.

For an authorized future experiment:

1. Existing file reader executes normally and produces its current result.
2. Separate verifier reads Turso for the same date/stock universe.
3. Both outputs are converted into the same comparison contract.
4. Comparison is outcome-blind to downstream prediction results; it checks data semantics only.
5. Mismatch diagnostics identify date, stock, field, file source hash, database schema version, and database row identity.
6. The production consumer continues using the current file result regardless of comparison outcome.

Required parity contract:
- identity: `trade_date`, `stock_id`;
- metrics: `foreign_ex_dealer_net`, `foreign_dealer_net`, `trust_net`, `dealer_net`;
- normalized derived checks:
  - `foreign = foreign_ex_dealer_net + foreign_dealer_net`;
  - `total` must preserve existing normalizer semantics;
- instrument category remains explicit; no common-stock inference from four-digit code shape.

## 6. Deterministic parity gates

Before any cutover proposal, an owner-authorized shadow experiment should satisfy all of these:

1. zero missing accepted trading dates in the evaluation window;
2. zero row-count mismatches for the evaluated contract;
3. zero identity mismatches;
4. zero required-metric mismatches;
5. deterministic canonical hash agreement on repeated verification;
6. zero ambiguous or unmatched instrument-category identities for the evaluated universe;
7. no secret exposure in logs/artifacts;
8. no database outage that causes canonical collection failure;
9. all shadow failures classified and durable rather than silently skipped.

### Minimum evidence window

The POC has 20 historical dates, but that alone is not sufficient for a production cutover proposal.

Proposed minimum before any cutover proposal:
- **20 consecutive eligible live trading dates** of shadow-write/read evidence after owner authorization;
- at least one ordinary retry/re-run case proving idempotency;
- at least one deliberately simulated database-unavailable test proving canonical-file fallback;
- zero unresolved parity mismatch at closeout.

This window is a design recommendation, not an automatic scheduler change.

## 7. Feature flag and configuration design

No flag is implemented in Phase 9.

Proposed future default-off configuration:

- `TWSE_INSTITUTIONAL_TURSO_SHADOW_WRITE=false`
- `TWSE_INSTITUTIONAL_TURSO_SHADOW_READ=false`
- `TWSE_INSTITUTIONAL_TURSO_PRIMARY_READ=false`

Rules:
- all flags default false;
- primary-read cannot be enabled unless shadow-write and shadow-read phases have independent durable PASS;
- workflow input or repository variable may control non-secret booleans;
- credentials remain GitHub Actions secrets and are never written to files, artifacts, summaries, or logs;
- absence of credentials must fail the shadow path closed without affecting the canonical file path;
- no production default may flip as a side effect of merging POC code.

## 8. Rollback design

Rollback must be possible without data loss because the canonical file path remains intact during shadow evaluation.

Rollback trigger examples:
- any unresolved parity mismatch;
- database availability materially worse than the canonical path;
- unexpected quota/accounting behavior;
- schema/version ambiguity;
- reader result instability;
- credential/configuration failure;
- owner cancellation.

Rollback procedure for a future authorized shadow experiment:
1. set shadow/primary-read flags to false;
2. stop issuing new Turso shadow writes/reads;
3. continue current canonical file workflows unchanged;
4. keep database rows read-only for forensic comparison; do not delete them during rollback;
5. verify required raw and normalized repository files for the affected window;
6. rerun existing file-based readiness/parity checks;
7. close the experiment with a durable incident/rollback record.

No rollback depends on reconstructing repository files from Turso.

## 9. Outage, network, and rate-limit behavior

Turso is an additional network dependency.

Design requirements:
- finite connection/query timeout;
- bounded retry count;
- no unbounded retry loop;
- no retry that extends canonical collection beyond its existing workflow safety boundary;
- explicit distinction between database unavailable, auth failure, quota/rejection, schema mismatch, and parity mismatch;
- shadow operations must never trigger TWSE refetches;
- fallback is always the existing canonical repository file path during shadow evaluation;
- Pages and prediction readiness continue to use files until a separately authorized cutover.

## 10. Secrets and least privilege

Current POC uses `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` as Actions secrets.

Future design requirements:
- dedicated production-shadow credentials, not reuse of unrelated credentials where avoidable;
- minimum database permissions sufficient for the shadow table family only;
- credentials only in Actions secret context;
- never persist URL/token into committed JSON, handoff, artifact, log, or step summary;
- evidence artifacts contain only non-secret table/schema/hash/count/timing data;
- credential rotation must not alter canonical file collection behavior.

No secret is added or changed by this design document.

## 11. Measured evidence vs unknown provider assumptions

Measured in the POC:
- exact 21,475-row write/read parity;
- replay idempotency;
- Phase 7 logical table-family size 1,982,464 bytes;
- v3 logical size 1,937,408 bytes;
- bounded GitHub-hosted query timings;
- exact read-contract compatibility for four current required metrics.

Not proven:
- production-scale Turso billing;
- account-specific monthly usage or billing behavior;
- provider SLA;
- long-term outage frequency;
- latency from all production execution environments;
- whole-repository storage feasibility;
- TPEx coverage;
- production backup/restore guarantees;
- security-master integration for a broader universe.

Provider quota labels and SQLite logical page sizes must remain separate in every future decision.

## 12. Integration seams for a future owner-authorized experiment

### Writer seam

Verified current-main seam:
- `.github/workflows/crawl-twse-institutional-investors.yml`
- `scripts/crawl_twse_institutional_investors.js`
- canonical output `data_twse_institutional_investors/<date>_twse_institutional_investors.json`.

Preferred future shadow implementation seam:
- add a separate POC/production-shadow script that consumes the already-written canonical JSON;
- invoke it only after canonical validation/write;
- do not embed Turso writes inside the TWSE HTTP fetch function.

### Normalization seam

Verified:
- `scripts/backfill_normalized_data.js`
- `.github/workflows/backfill-normalized-data.yml`
- normalized output `data_normalized/institutional_investors/<date>.json`.

Preferred validation:
- compare Turso read-contract output against the existing normalizer's semantics;
- do not replace the normalizer in the first shadow phase.

### Prediction/readiness seam

Verified:
- `scripts/generate_all_stock_predictions.js`
- `scripts/prepare_and_verify_forecast_inputs.js`
- `scripts/verify_prediction_data_readiness.js`
- `scripts/check_forecast_required_files.js`.

All currently expect file availability. A future shadow-read verifier should run beside them, not change their required paths.

### Pages seam

Verified:
- `.github/workflows/deploy-pages.yml`;
- `scripts/apply_pages_size_budget.js`;
- `scripts/trim_pages_artifact.js`.

Keep Pages file-backed during any initial Turso shadow experiment.

## 13. Non-goals

Phase 9 explicitly does not:
- merge PR #52;
- add or rotate secrets;
- create production Turso tables;
- change canonical TWSE collection;
- change any cron;
- change normalized data generation;
- change prediction readers;
- change Pages to query a database;
- remove historical files;
- expand to TPEx;
- declare Turso the source of truth;
- claim production readiness or provider SLA.

## 14. Unresolved questions before any shadow experiment

Owner/provider decisions still required:
1. Which Turso account/database should own production-shadow tables?
2. What account-specific quota/billing telemetry is available and acceptable?
3. What retention policy should apply to shadow data?
4. Should shadow-write evidence be daily only or cover every repeated intraday collection attempt?
5. Should normalized-shape rows be stored separately or always derived from the raw-equivalent structured table?
6. What exact alerting channel should receive parity/outage failures?
7. Is 20 consecutive eligible live trading dates sufficient for owner risk tolerance, or should the window be longer?
8. What explicit owner action will authorize creation of production-shadow credentials/configuration?

## 15. Staged owner-approval gates

### Gate A — design approval
Current Phase 9 artifact only.

PASS means the owner accepts the architecture for a possible shadow experiment. It does **not** authorize code/config/secrets or production changes.

### Gate B — optional shadow-experiment authorization
Requires separate explicit owner authorization.

Only then may a future round propose:
- default-off shadow flags;
- production-shadow credentials;
- separate shadow tables;
- bounded shadow writer/verifier;
- no production reader cutover.

### Gate C — shadow experiment independent closeout
Requires the preregistered parity/outage/idempotency evidence window to pass independently.

Failure returns to current canonical files with no production cutover.

### Gate D — separate production-migration authorization
Only after Gate C PASS may a new task propose primary-read migration.

This must be a separate owner authorization and a separate paired Prompt A/Prompt B lifecycle.

## 16. Decision summary

The Phase 3–8 evidence is strong enough to justify migration design and, if the owner chooses, a future **shadow-only** experiment.

It is **not** evidence sufficient to replace the canonical repository file source of truth today.

The recommended next action after Phase 9 closeout is an owner decision:
- stop and retain the POC/design; or
- explicitly authorize a separate default-off shadow-experiment task.

Until that explicit authorization, production remains unchanged.
