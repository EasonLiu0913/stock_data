# Turso TWSE Institutional POC

Canonical handoff: `docs/handoffs/turso-twse-institutional-poc.md`

## Current phase
Phase 3 full-row Turso parity / replay / latency validation: **Prompt B CLOSEOUT PASS (2026-10-06)**.

Phase 4 remote storage-accounting / free-tier feasibility evidence: **Prompt B CLOSEOUT PASS (2026-10-06)**.

Phase 5 security-master classification / schema-coverage readiness: **Prompt A COMPLETE (2026-10-06), Prompt B PENDING**.

## Objective
Evidence-based feasibility test of a zero-cost Turso database for TWSE T86 daily institutional flows from `data_twse_institutional_investors`.

## Frozen constraints
- Keep all work on `poc/turso-institutional-20261006` / PR #52, **not main**.
- No production crawler, prediction, dashboard, schedule, or deployment migration.
- No token values/logging credentials; Turso secrets from Repository secrets.
- No changes to canonical data during POC. Only `turso_poc_*` tables; no writes to tracked JSON files.
- Separate 4-digit TWSE securities from warrants; 4-digit pattern is **not an authoritative security-master classification**.
- Do not claim a full-DB storage ratio using raw JSON including excluded instruments.
- Avoid large external requests and do not expand beyond the frozen 20-date validation population until closeout reviews the evidence.
- Provider `dbstat` numbers are observational SQLite page accounting, not Turso billing/quota accounting.

## Completed
1. Connectivity `SELECT 1` verified after token update.
2. Earlier v2 import of 20 dates, 21,475 four-digit instrument rows, round-trip and idempotent upsert: GitHub Actions #4, run ID `37439496021` succeeded.
3. Earlier 16–18K rows/day were incorrectly labeled stocks, including many excluded instruments; 20-minute job timeout caused cancellation after day 11 in original run `37431071289`.
4. Structured v3 importer `scripts/poc_turso_institutional_structured.js` and sizing comparison `scripts/poc_turso_capacity_compare.py`, executed from `.github/workflows/poc-turso-institutional.yml`.
5. V3 PASS, Actions run ID `37440693487`, job `112193442377`: 20 dates 2026-09-04 through 2026-10-05, 21,475 four-digit records, 8 signed numeric fields, per-date source counts, sampled full-field round-trip, upsert idempotency, 2330 historical query returned 20 days, top foreign buy net returned 5 rows.
6. V3 same-row local SQLite comparison including key/stock index: 21,475 records; compact JSON-value-array model 2,322,432 bytes (108.1 bytes/row); typed SQL model 1,880,064 bytes (87.5 bytes/row), ratio 0.8095 (~19.05% lower). Local comparison is not Turso provider billing or exact online bytes.
7. V3 raw source JSON including excluded instruments = 94,783,801 bytes; structured selected-row newline JSON = 4,054,939 bytes. These are different populations and must not be compared as a compression ratio.
8. Phase 3 implementation commits on the POC branch:
   - `d67f5ffdff74705d561595c8fbc2decf7487a35c` — full-row parity, replay and latency validation.
   - `012aa918d89f26ceb2d8de6846bce46bd6060fae` — retain validation evidence artifact.
   - `3fc2252ef1488c6879a2e39f416933facab4bab9` — restore same-row sizing input after validation rewrite.
9. Phase 3 first run `37441775430`, job `112196992278`: the Turso V4 validation step itself PASSed, but the old local sizing step failed because `/tmp/turso-v3.ndjson` was no longer emitted. This was a POC plumbing regression, not a parity failure, and was repaired without weakening any Turso gate.
10. Phase 3 authoritative rerun: GitHub Actions run `37442074755`, job `112197987844`, head `3fc2252ef1488c6879a2e39f416933facab4bab9`: **SUCCESS**.
11. Frozen population used by Phase 3: exactly these 20 dates and exactly 21,475 rows: 20260904, 20260907, 20260908, 20260909, 20260910, 20260911, 20260914, 20260915, 20260916, 20260917, 20260918, 20260921, 20260922, 20260923, 20260924, 20260929, 20260930, 20261001, 20261002, 20261005.
12. Phase 3 exact parity evidence:
   - Pass 1 write: 21,475 rows / 220 batches / 39,175.05 ms.
   - Pass 1 exact remote parity: 21,475 rows / all 8 fields / 13,490.18 ms.
   - Pass 2 full replay write: 21,475 rows / 220 batches / 37,911.37 ms.
   - Pass 2 exact remote parity: 21,475 rows / all 8 fields / 13,215.04 ms.
   - Replay row count: 21,475 before and 21,475 after.
   - Per-date canonical SHA-256 values were identical before/after replay.
   - Parsed values included 31,198 negative signed values per parity pass; NULL count in this frozen sample was 0.
13. Query latency evidence from five remote executions each:
   - 2330 20-day history: median 127.69 ms; min 126.19 ms; one first/cold sample 840.25 ms.
   - Latest-date foreign-net Top 20: median 127.94 ms; min 125.34 ms; max 127.99 ms.
   - Latest-date count: median 127.48 ms; min 124.99 ms; max 131.50 ms.
   These are one workflow/run's observed latencies, not an SLA or general benchmark.
14. Remote storage observation in the Phase 3 artifact:
   - whole DB PRAGMA logical size before/after replay: 46,645,248 bytes, unchanged;
   - `dbstat` exposed `turso_poc_equity_structured_v3` = 909,312 bytes;
   - `dbstat` exposed `turso_poc_equity_structured_sources_v3` = 12,288 bytes.
   Current `dbstat` query does **not** include every related index/autoindex, so these values are not a complete table-family storage total and must not be presented as Turso billing usage.
15. Authoritative run artifact `turso-poc-validation-evidence`, artifact ID `11401497844`, SHA-256 digest `9784e7a97e99ad86db1f10c24a10c22c9f9352fed72139e7a1a39faea09d5ab4`, contains `turso-v3-sizing.json` and `turso-v4-validation.json`.
16. Phase 3 local same-row SQLite sizing rerun: JSON model 2,334,720 bytes (108.7 B/row), structured model 1,892,352 bytes (88.1 B/row), structured/json ratio 0.8105. This remains a local SQLite model, not provider billing.

17. Phase 4 implementation commit `9c5eef6359a3e606305160a4e58f4cbbadeb1da0` adds complete remote SQLite object accounting, replay storage-stability gating, provider quota evidence labels, and a bounded feasibility calculation without expanding the frozen population.
18. Phase 4 authoritative workflow run `37443792571`, job `112203610605`, completed **SUCCESS** on head `9c5eef6359a3e606305160a4e58f4cbbadeb1da0`.
19. Phase 4 preserved the frozen 20 dates / 21,475 rows and both exact parity passes:
   - Pass 1: 21,475 rows; 31,198 negative values; 0 NULL projected values.
   - Pass 2 full replay: 21,475 rows; 31,198 negative values; 0 NULL projected values.
   - Replay row count remained 21,475 -> 21,475 and canonical per-date hashes remained identical.
20. Remote `sqlite_master` + `dbstat` accounting exposed exactly five objects for the two POC table families, with no missing `dbstat` objects:
   - `turso_poc_equity_structured_v3` table: 909,312 bytes / 222 pages.
   - `sqlite_autoindex_turso_poc_equity_structured_v3_1`: 507,904 bytes / 124 pages.
   - `turso_poc_equity_structured_v3_stock_date`: 503,808 bytes / 123 pages.
   - `turso_poc_equity_structured_sources_v3` table: 12,288 bytes / 3 pages.
   - `sqlite_autoindex_turso_poc_equity_structured_sources_v3_1`: 4,096 bytes / 1 page.
   - Complete exposed table-family total: **1,937,408 bytes / 473 pages**.
21. Full replay storage stability PASS: table-family total was 1,937,408 bytes before replay and 1,937,408 bytes after replay. Whole-database logical size also remained 46,645,248 bytes. These are SQLite logical page measures, not Turso provider billing usage.
22. Current authoritative Turso Free-plan quota facts were recorded separately from SQLite measurements, sourced from `https://turso.tech/pricing` and observed 2026-10-06: 5 GB storage, 500 million monthly rows read, 10 million monthly rows written, 3 GB monthly sync, 100 databases.
23. Narrow T86 feasibility arithmetic from the measured table-family total:
   - observed logical density: 90.22 bytes per frozen row;
   - assuming 250 trading days/year: ~268,438 rows/year and ~24,217,645 logical bytes/year;
   - this is ~0.484% of the Free plan's 5 GB storage quota per projected year under the stated assumptions;
   - assuming 22 trading days/month: ~23,645 row writes/month, ~0.236% of the 10 million monthly write quota;
   - no generic monthly read-quota fraction is claimed because row-read usage depends on query frequency/provider accounting semantics.
24. Phase 4 evidence artifact `turso-poc-validation-evidence`: artifact ID `11403060483`, digest `sha256:d3d6e5a2cf9b0fba75e724007c4275d16b24fb4cfdd6745872e4c9a9d4660aa6`. It contains `turso-v4-validation.json` (schema `structured_v3_validation_v5_phase4`) and `turso-v3-sizing.json`.
25. Secret handling remained clean in the authoritative run: `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` were redacted as `***`; the uploaded artifact contains no credential values.
26. Concurrent-main freshness check after the run: current `main` is nine commits ahead of the PR base; none of those concurrent files touch the five POC files or any frozen `data_twse_institutional_investors` source file, so Phase 4 evidence is not stale.

## Phase 3 Prompt B closeout — PASS (2026-10-06)
Independent closeout re-established evidence from current remote state instead of accepting the Prompt A summary.

- Preregistered Prompt B identity was recovered from pre-Prompt-A branch commit `1ac0685a2db2755d75f829fac7f2d48818edfcbb`; it matches the current-round closeout contract.
- Authoritative validation run `37442074755`, job `112197987844`, completed successfully on tested head `3fc2252ef1488c6879a2e39f416933facab4bab9`.
- The run artifact `turso-poc-validation-evidence` (artifact `11401497844`, digest `sha256:9784e7a97e99ad86db1f10c24a10c22c9f9352fed72139e7a1a39faea09d5ab4`) was independently inspected. Its JSON records exactly 20 frozen dates, 21,475 rows, the eight projected fields, two 21,475-row parity passes, replay counts 21,475 -> 21,475, per-date source hashes, query samples, and storage caveats.
- Source-code review confirms parity is not sampling: each frozen date is read back in ordered pages, every returned row is compared with the projected source row, and every one of the eight numeric fields is checked for strict equality. A per-date SHA-256 is also recomputed and checked.
- Replay verification performs a second complete 21,475-row upsert wave and a second complete parity pass; row count and per-date hashes must remain unchanged.
- Signed-number parsing accepts explicit plus/minus integer strings after comma removal and rejects unsafe/non-integer values. This frozen sample exercised 31,198 negative values per parity pass. NULL handling is implemented, although this sample contained zero NULL projected values.
- Query timing is defensible as run-local evidence only: five measurements per query are recorded with min/median/max; no SLA claim is made.
- Storage claims remain bounded: local SQLite sizing compares the same 21,475 rows and the same stock/date index; remote PRAGMA is labeled whole-database logical size; remote `dbstat` is labeled incomplete because the query does not yet include all related indexes/autoindexes; none is described as Turso billing usage.
- Secret handling PASS: the workflow consumes repository secrets only; log inspection shows `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` redacted as `***`; no credential value appeared in inspected logs or artifacts.
- Production isolation PASS: PR #52 remains draft/open; changed-file set is limited to `.github/workflows/poc-turso-institutional.yml`, this handoff, `scripts/poc_turso_capacity_compare.py`, `scripts/poc_turso_institutional.js`, and `scripts/poc_turso_institutional_structured.js`. No production crawler, prediction, dashboard, schedule, deployment, or tracked source JSON file is changed.
- Freshness PASS: current `main` advanced 9 commits from the PR base, but comparison found no concurrent changes touching the five POC files or `data_twse_institutional_investors/`; Phase 3 evidence is therefore not stale.
- No repair/rerun was required during Prompt B. The earlier Prompt A plumbing failure in run `37441775430` remains documented and superseded by the authoritative successful rerun.

## Phase 4 Prompt B closeout — PASS (2026-10-06)
Independent closeout re-established the Phase 4 contract and evidence from durable repository state rather than accepting the Prompt A summary.

- Preregistered Prompt B identity was recovered from pre-Prompt-A branch checkpoint `7115e271c2eb029904e7c7d307b6addf4d0d851a`; it matches the current Phase 4 closeout contract exactly.
- Authoritative run `37443792571`, job `112203610605`, completed successfully against tested implementation SHA `9c5eef6359a3e606305160a4e58f4cbbadeb1da0`.
- Evidence artifact `turso-poc-validation-evidence` (artifact `11403060483`, digest `sha256:d3d6e5a2cf9b0fba75e724007c4275d16b24fb4cfdd6745872e4c9a9d4660aa6`) was independently inspected. It contains `turso-v3-sizing.json` and `turso-v4-validation.json` with schema `structured_v3_validation_v5_phase4`.
- Phase 3 parity/replay guarantees were preserved: the frozen 20 dates and 21,475 rows are unchanged; both parity passes compare every selected row and all eight numeric fields; replay remains 21,475 -> 21,475 with identical per-date canonical hashes. The implementation still exercises 31,198 negative values per parity pass and retains NULL handling.
- Remote object accounting PASS: `sqlite_master` enumerates both POC tables and every exposed related index object; `dbstat` reports all five exposed objects with no missing object. The summed table-family total is 1,937,408 bytes / 473 pages, with no double counting.
- Replay storage-stability PASS: table-family logical bytes remain 1,937,408 before and after full replay; whole-database PRAGMA logical size remains 46,645,248 bytes.
- Measurement labels PASS: local SQLite same-row sizing, remote whole-DB PRAGMA bytes, remote table-family `dbstat` logical bytes, and Turso provider quota facts are explicitly separate and are not presented as equivalent billing measures.
- Current Turso Free-plan facts were independently rechecked against the authoritative pricing page on 2026-10-06: 100 databases, 5 GB storage, 500 million monthly rows read, 10 million monthly rows written, and 3 GB monthly sync.
- Feasibility calculation PASS: it is explicitly scoped to the frozen four-digit TWSE T86 structured dataset, states 250 trading days/year and 22/month assumptions, excludes provider overhead, other repository datasets, and replay/backfill write amplification, and does not claim a generic monthly read-quota fraction.
- Secret handling PASS: workflow logs show `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` redacted as `***`; no credential value appears in the inspected artifact.
- Production isolation PASS: PR #52 remains draft/open/unmerged, and its changed-file set remains exactly five POC-only files: `.github/workflows/poc-turso-institutional.yml`, this handoff, `scripts/poc_turso_capacity_compare.py`, `scripts/poc_turso_institutional.js`, and `scripts/poc_turso_institutional_structured.js`.
- Freshness PASS: current `main` at closeout is `2665e688c5eb1b92a77840f84d682ebf3676a87c`, 11 commits ahead of the PR base. The concurrent changes do not touch the five POC files or any frozen `data_twse_institutional_investors` source file, so the Phase 4 evidence is not stale.
- No repair or rerun was required during Prompt B.

## Promoted next round
Phase 5 — security-master classification and schema-coverage readiness.

Purpose: close the remaining data-semantics gap before any production recommendation. This phase remains POC-only and must not migrate production.

### Phase 5 bounded objectives
1. Determine whether the repository already contains an authoritative or sufficiently reliable TWSE security-master / instrument-classification source. The exact path is not yet verified; locate and record it before implementation.
2. Classify the frozen 21,475 four-digit records by security type using that source when available, and quantify how many are common stocks versus other 4-digit instruments.
3. Audit the raw T86 source columns against the current eight-field structured schema and explicitly classify omitted columns as required, optional, derivable, or intentionally out-of-scope.
4. Produce a production-readiness gap summary limited to classification/schema semantics. Do not implement production migration, additional historical import, or a new generalized data platform.
5. Keep all work on `poc/turso-institutional-20261006` / PR #52 and preserve all Phase 3/4 parity, replay, and storage evidence.

## Prompt A — Phase 5 implementation (preregistered)
Continue the Turso TWSE Institutional POC in repository `EasonLiu0913/stock_data`, only on branch `poc/turso-institutional-20261006` / PR #52.

Before doing any work:
1. Fetch current remote `main` and the POC branch.
2. Read repository-root `AGENTS.md`.
3. Read canonical handoff `docs/handoffs/turso-twse-institutional-poc.md`.
4. Verify Phase 4 Prompt B is durably PASS and recover this exact Phase 5 pair.
5. Re-check concurrent changes for the POC entry points and frozen T86 source files.

Implement only bounded Phase 5 evidence work. Start by locating and verifying the exact repository path of any existing TWSE security-master/instrument-classification source; if none is authoritative enough, record that gap rather than inventing a classifier.

Requirements:
- keep the frozen 20 dates / 21,475-row population unchanged;
- preserve the existing exact parity/replay/storage gates;
- classify the frozen four-digit instruments by security type only from a verified repository source or other authoritative evidence;
- report counts and representative classifications, including non-common-stock four-digit instruments when present;
- audit all raw T86 columns against the current eight structured fields and record why each omitted field is required, optional, derivable, or intentionally excluded;
- keep all evidence non-secret and POC-only;
- do not import additional dates, delete old POC tables, touch production crawler/prediction/dashboard/deployment code, merge PR #52, or recommend production migration as complete.

Prompt A completion contract:
- classification source/path and trust boundary are documented;
- frozen-population classification counts are reproducible;
- raw-column-to-structured-schema coverage audit is complete;
- Phase 3/4 validation remains green or unchanged by construction;
- this handoff records implementation/evidence SHA(s);
- preserve the Phase 5 Prompt B below unchanged;
- stop and report “Prompt A complete — ready for Prompt B”.

## Prompt B — Phase 5 independent closeout (preregistered)
Fetch current remote `main` and the POC branch; read `AGENTS.md` and this handoff; recover this Phase 5 Prompt B from the pre-Prompt-A checkpoint. Independently verify:
1. the classification source is authoritative enough for the claims made and its exact repo/source identity is recorded;
2. frozen 20-date / 21,475-row population identity was not changed;
3. common-stock versus other-instrument classification counts are reproducible and no four-digit-pattern assumption is being mislabeled as authoritative classification;
4. the raw T86 column audit covers every source column and the eight-field structured schema without silent omissions;
5. Phase 3/4 parity, replay, storage-accounting, quota-labeling, and secret-handling guarantees were not weakened;
6. changed files remain POC-only and production files/data/deployments remain untouched;
7. concurrent `main` changes do not stale the evidence.

If any criterion fails, repair only the bounded POC defect and rerun verification from criterion 1. If all pass, record Phase 5 Prompt B closeout PASS and preregister the next bounded pair before any further phase. Do not merge PR #52 or migrate production.

## Phase 5 Prompt A implementation evidence (2026-10-06)
- Implementation commits:
  - `f46308576996bb9ff8c4bb48fd0dc18575e9efaa` — add `scripts/poc_turso_phase5_semantics.js`.
  - `54793dafe3af147802f17fecb980913eb69518f2` — wire Phase 5 semantics audit and classification inputs into the isolated POC workflow.
- Authoritative workflow run `37445363651`, job `112208744280`, completed **SUCCESS** on head `54793dafe3af147802f17fecb980913eb69518f2`.
- Evidence artifact `turso-poc-validation-evidence`: artifact ID `11402519626`, digest `sha256:6172828ec1b441dcd795fa05cba96bf66c943e993f2abb4debaab8cebf2f1f1b`. It contains `turso-phase5-semantics.json`, `turso-v4-validation.json`, and `turso-v3-sizing.json`.
- Phase 3/4 regression gates remained green in the same run: exact 21,475-row parity passed twice; replay remained 21,475 -> 21,475; table-family storage remained 1,937,408 bytes and replay-stable.
- Verified repository classification inputs:
  - `data_twse/twse_industry.csv` — 1,370 records; includes listed equity names/industry and also non-common-stock entries such as TDR/REIT-like records, so it is **not** treated as a pure common-stock master.
  - `data_twse/twse_industry_ETF.csv` — 241 ETF/fund-like records.
  - `data_twse/twse_industry_Warrants.csv` — 35,767 warrant records.
- Frozen population classification is reproducible from those exact files:
  - total frozen eligible rows: **21,475**;
  - unique four-digit instruments: **1,088**;
  - `twse_stock_list_non_dr`: **21,414 rows / 1,084 unique IDs**;
  - explicit `-DR` TDRs: **61 rows / 4 unique IDs** — 9103 美德醫療-DR, 9105 泰金寶-DR, 9110 越南控-DR, 9136 巨騰-DR;
  - ETF: **0**; warrant: **0**; unclassified: **0** within the frozen four-digit population.
- Trust boundary: Phase 5 deliberately does **not** relabel the 1,084 non-DR stock-list IDs as `common_stock`, because the repository list has no verified security-type field proving that semantic for every member. The production-readiness artifact therefore records `common_stock_claim_supported: false`.
- Raw T86 schema was identical across all 20 frozen dates: one schema variant with **19 source fields**.
- All 19 source fields are explicitly audited:
  - identity/dimension: 證券代號, 證券名稱;
  - current structured schema: exactly **8 metrics** — foreign buy/sell/net excluding foreign dealer, trust buy/sell/net, dealer net, combined institutional net;
  - omitted but non-derivable additional metrics: foreign-dealer buy/sell/net plus dealer proprietary and hedge component buy/sell/net fields.
- Production-readiness gaps are now explicit:
  1. if production requires `common-stock-only` semantics, an authoritative instrument-type field/master is still required;
  2. production consumers must decide whether foreign-dealer and dealer component/gross metrics are required before freezing the database schema.
- No production crawler, prediction, dashboard, deployment, schedule, or tracked canonical JSON was modified. PR #52 remains draft/open/unmerged.
- Freshness check: current `main` at completion is `2665e688c5eb1b92a77840f84d682ebf3676a87c`; concurrent changes do not touch the POC files, the three classification inputs, or frozen T86 source files used by Phase 5.
- Global task routing was not changed; `institutional-accumulation` remains the repository-wide default active task. This Turso POC was executed only because the owner explicitly named it in the Prompt A command.

## Important caveats
- TWSE T86 is listed-market data only: it is NOT the entire TWSE+TPEx equity universe.
- The v3 structured schema covers 8 metrics: foreign buy/sell/net, trust buy/sell/net, dealer net, combined institutional net. Some other raw source columns are not yet imported.
- Four-digit IDs can include security types other than common stocks. Proper security-master join should precede a production classification.
- Earlier experimental `turso_poc_institutional` and `turso_poc_equity_v2` tables may occupy cloud space; never silently delete until ownership and backups confirmed.
- The earlier ~23 MB/year arithmetic from local row density remains only a narrow single-table extrapolation. It excludes provider overhead, all related indexes unless measured, stock-universe changes, other datasets, retention, quotas, and network/read/write limits; it is not a supported whole-project estimate.
- No Turso account billing/quota API evidence has been collected by this repository workflow.
- The current remote `dbstat` observation is useful evidence that table-level SQLite page accounting is exposed, but the query needs index/autoindex coverage before it can be treated as a complete table-family logical-size figure.

## Evidence / entry points
- PR: https://github.com/EasonLiu0913/stock_data/pull/52
- Authoritative Phase 3 CI: https://github.com/EasonLiu0913/stock_data/actions/runs/37442074755
- `scripts/poc_turso_institutional.js`: legacy raw-row JSON v2 POC.
- `scripts/poc_turso_institutional_structured.js`: structured SQL v3 importer + Phase 3 V4 exact validation.
- `scripts/poc_turso_capacity_compare.py`: local SQLite same-row comparison.
- `.github/workflows/poc-turso-institutional.yml`: isolated PR/manual POC workflow.
- `scripts/poc_turso_phase5_semantics.js`: frozen-population security classification + all-column T86 schema audit.
- Classification inputs: `data_twse/twse_industry.csv`, `data_twse/twse_industry_ETF.csv`, `data_twse/twse_industry_Warrants.csv`.
- Source: `scripts/crawl_twse_institutional_investors.js`, `data_twse_institutional_investors/*.json`.

## Current round status
- Active round: Phase 5 security-master classification and schema-coverage readiness.
- Prompt A: **COMPLETE**.
- Prompt B closeout: **PENDING**.
- Authoritative run/job: `37445363651` / `112208744280`.
- Tested implementation SHA: `54793dafe3af147802f17fecb980913eb69518f2`.
- Evidence artifact: `11402519626`, digest `sha256:6172828ec1b441dcd795fa05cba96bf66c943e993f2abb4debaab8cebf2f1f1b`.
- Prompt B below remains the preregistered Phase 5 closeout contract and must be executed independently before any further phase.

### Phase 4 bounded objectives
1. Extend remote storage accounting so `dbstat` captures the data table, explicit `stock_date` index, PRIMARY KEY autoindex, source-metadata table, and its autoindex/object pages where exposed.
2. Record a table-family total separately from whole-database PRAGMA size.
3. Test whether repeated replay changes any table-family page totals after the database stabilizes; do not infer provider billing from page counts.
4. Document Turso free-tier limits using authoritative provider documentation/account-visible evidence if accessible without exposing credentials. Keep provider quota facts separate from measured SQLite logical bytes.
5. Produce a narrow feasibility calculation for this one TWSE T86 structured dataset only. Do not extrapolate it to the whole repository or recommend production migration yet.
6. Keep the same frozen 20 dates / 21,475 rows unless a storage-accounting check inherently needs no additional data. No new historical import wave.

## Prompt A — Phase 4 implementation (preregistered)
Continue the Turso TWSE Institutional POC in repository `EasonLiu0913/stock_data`, only on branch `poc/turso-institutional-20261006` / PR #52.

Before doing any work:
1. Fetch current remote `main` and the POC branch.
2. Read repository-root `AGENTS.md`.
3. Read canonical handoff `docs/handoffs/turso-twse-institutional-poc.md`.
4. Verify Phase 3 Prompt B is durably PASS and recover this exact Phase 4 pair.
5. Re-check concurrent changes for the exact POC entry points.

Implement only bounded Phase 4 evidence work in:
- `scripts/poc_turso_institutional_structured.js`
- `scripts/poc_turso_capacity_compare.py` only if the same-row local comparator needs a matching explanatory field
- `.github/workflows/poc-turso-institutional.yml`
- `docs/handoffs/turso-twse-institutional-poc.md`

Requirements:
- retain the frozen 20 dates / 21,475 rows and existing exact parity/replay gates;
- query remote `dbstat` or equivalent read-only SQLite metadata to enumerate all storage objects belonging to `turso_poc_equity_structured_v3` and `turso_poc_equity_structured_sources_v3`, including explicit and auto indexes when exposed;
- preserve object-by-object bytes plus a clearly labeled table-family total;
- capture before/after full replay and verify row/hash parity still passes;
- distinguish table-family SQLite logical bytes, whole-database logical bytes, local SQLite sizing, and provider quota/billing units;
- use authoritative Turso documentation/account-visible evidence for current free-tier quota facts when available, and record source/date; never log tokens or sensitive account details;
- calculate feasibility only for this one structured T86 dataset using explicitly stated assumptions;
- do not delete old POC tables, import additional dates, touch production code/data, merge PR #52, or change deployment/schedules.

Prompt A completion contract:
- authoritative workflow run is green;
- exact parity/replay remains PASS;
- remote object accounting is durable in a non-secret artifact;
- all storage/quota labels are defensible;
- this handoff records run/job/SHA/artifact evidence;
- preserve the Phase 4 Prompt B below unchanged;
- stop and report “Prompt A complete — ready for Prompt B”.

## Prompt B — Phase 4 independent closeout (preregistered)
Fetch current remote `main` and POC branch; read `AGENTS.md` and this handoff; recover this Phase 4 Prompt B from the pre-Prompt-A checkpoint. Independently verify:
1. the authoritative workflow run/job/tested SHA and artifact;
2. Phase 3 exact 21,475-row parity and full replay guarantees were not weakened;
3. remote storage accounting includes every exposed object belonging to both POC table families, with explicit/auto indexes classified and summed without double-counting;
4. whole-DB PRAGMA, table-family SQLite logical bytes, local SQLite comparison, and Turso provider quota/billing facts are kept distinct;
5. any free-tier limits are supported by authoritative, current evidence and no credential/account secret is exposed;
6. the feasibility calculation is limited to the frozen T86 structured dataset and its assumptions are explicit;
7. PR changed files remain POC-only and production files/data/deployments are untouched;
8. concurrent `main` changes do not stale the evidence.

If any criterion fails, repair only the bounded POC defect and rerun verification from criterion 1. If all pass, record Phase 4 Prompt B closeout PASS and preregister the next bounded pair before any further phase. Do not merge PR #52 or migrate production.

