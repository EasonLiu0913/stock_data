# Turso TWSE Institutional POC

Canonical handoff: `docs/handoffs/turso-twse-institutional-poc.md`

## Current phase
Phase 3 full-row Turso parity / replay / latency validation: **Prompt B CLOSEOUT PASS (2026-10-06)**.

Phase 4 remote storage-accounting / free-tier feasibility evidence: **Prompt B CLOSEOUT PASS (2026-10-06)**.

Phase 5 security-master classification / schema-coverage readiness: **Prompt B CLOSEOUT PASS (2026-10-06)**.

Phase 6 authoritative instrument-type source resolution / omitted-metric consumer audit: **Prompt B CLOSEOUT PASS (2026-10-06)**.

Phase 7 consumer-complete 9-metric structured-schema POC is **internally promoted but not started**. Do not execute its Prompt A unless the owner explicitly asks to continue this Turso POC.

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

## Phase 5 Prompt B closeout — PASS (2026-10-06)
The exact Phase 5 Prompt B was independently recovered from the pre-Prompt-A checkpoint `cdd8ec994510188d60f4372472408dd0207b030e`, not from conversation history or the Prompt A completion summary.

Independent verification:
1. Classification-source trust boundary — PASS. The exact repository inputs are `data_twse/twse_industry.csv`, `data_twse/twse_industry_ETF.csv`, and `data_twse/twse_industry_Warrants.csv`. The claims are intentionally bounded: these files support reproducible stock-list / ETF / warrant partitioning and explicit `-DR` detection, but `twse_industry.csv` is not asserted to be an authoritative pure common-stock master. The Phase 5 artifact explicitly records `common_stock_claim_supported: false`.
2. Frozen population identity — PASS. Artifact `11402519626` records the exact 20 preregistered dates and exactly 21,475 selected rows, unchanged from Phases 3/4.
3. Classification reproducibility / no four-digit overclaim — PASS. The artifact records 1,088 unique four-digit IDs: 1,084 `twse_stock_list_non_dr` IDs covering 21,414 rows and four explicit TDR IDs covering 61 rows (9103, 9105, 9110, 9136). No ETF, warrant, or unclassified rows occur in the frozen selected population. The implementation never relabels the 1,084 residual IDs as authoritative `common_stock`.
4. Raw-column schema coverage — PASS. The frozen source has one stable 19-field schema variant. Every field has an explicit audit classification: 2 identity/dimension fields, exactly 8 mapped structured metrics, and 9 omitted non-derivable additional metrics (foreign-dealer buy/sell/net plus dealer proprietary and hedge buy/sell/net). There are zero silently unclassified source fields.
5. Phase 3/4 guarantees — PASS. Authoritative run `37445363651`, job `112208744280`, head `54793dafe3af147802f17fecb980913eb69518f2`, completed SUCCESS. The same artifact preserves two exact 21,475-row parity passes across all eight stored metrics, 31,198 negative values per pass, replay 21,475 -> 21,475, complete five-object table-family accounting at 1,937,408 bytes / 473 pages, replay-stable storage, separated provider-quota labeling, and the existing bounded feasibility assumptions. Workflow logs redact both Turso secrets; independent artifact inspection found no credential/token-like values.
6. POC-only changed-file scope — PASS. PR #52 remains draft/open/unmerged. Its six changed files are exactly: `.github/workflows/poc-turso-institutional.yml`, this handoff, `scripts/poc_turso_capacity_compare.py`, `scripts/poc_turso_institutional.js`, `scripts/poc_turso_institutional_structured.js`, and `scripts/poc_turso_phase5_semantics.js`. No production crawler, prediction, dashboard, deployment, schedule, or canonical source-data file is modified by the PR.
7. Concurrent-main freshness — PASS. Current remote `main` at closeout is `9d1bd6dd846a0c10729f2295fa8bfdb7e6e81e71`, 12 commits ahead of the PR base. None of the 55 concurrent changed files touches a POC entry point, `data_twse_institutional_investors/`, or any of the three Phase 5 classification inputs. The three classification-input blobs are also byte-identical between tested SHA `54793dafe3af147802f17fecb980913eb69518f2` and current main: stock `98a08652569bcc5dbc1c460efd589a2f919239e7`, ETF `6a0a8b92c44ccebe47bc1da038cb4b38cd1be20b`, warrant `34c4eb7a7611319d128a5db3bc85ac8efa77dd86`.

Authoritative Phase 5 evidence:
- run/job: `37445363651` / `112208744280`;
- tested implementation SHA: `54793dafe3af147802f17fecb980913eb69518f2`;
- artifact: `11402519626`;
- artifact digest: `sha256:6172828ec1b441dcd795fa05cba96bf66c943e993f2abb4debaab8cebf2f1f1b`;
- implementation commits: `f46308576996bb9ff8c4bb48fd0dc18575e9efaa`, `54793dafe3af147802f17fecb980913eb69518f2`.

No repair or rerun was required during Phase 5 Prompt B.

**Prompt B closeout: PASS**

## Promoted next round
Phase 6 — authoritative instrument-type source resolution and omitted-metric consumer audit.

Purpose: resolve the two semantic gaps left explicit by Phase 5 before any production recommendation. This remains POC-only and must not migrate production.

### Phase 6 bounded objectives
1. Locate and verify an authoritative instrument-type source for TWSE listed securities, preferring an existing repository-captured official TWSE source when available. Record exact source identity, fields, update mechanism, and trust boundary. If no sufficiently authoritative source is already available, record the gap rather than inventing one.
2. Reclassify only the existing frozen 1,088 unique / 21,475-row population when an authoritative type field is available, without importing additional T86 dates.
3. Audit existing repository consumers of TWSE institutional data to determine whether the nine omitted additional T86 metrics are actually required by current consumers. This is a static/read-only consumer-usage audit, not schema expansion.
4. Produce a bounded schema recommendation: minimum required fact columns for current proven consumers, optional future fields, and any unresolved classification dependency.
5. Preserve all Phase 3/4/5 parity, replay, storage, quota, security, and frozen-population guarantees. Do not touch production behavior or merge PR #52.

## Prompt A — Phase 6 implementation (preregistered)
Continue the Turso TWSE Institutional POC in repository `EasonLiu0913/stock_data`, only on branch `poc/turso-institutional-20261006` / PR #52.

Before doing any work:
1. Fetch current remote `main` and the POC branch.
2. Read repository-root `AGENTS.md`.
3. Read canonical handoff `docs/handoffs/turso-twse-institutional-poc.md`.
4. Verify Phase 5 Prompt B is durably PASS and recover this exact Phase 6 pair.
5. Re-check concurrent changes for POC entry points, frozen T86 sources, classification inputs, and any discovered instrument-master source.

Implement only bounded Phase 6 evidence work.

Requirements:
- do not import any additional T86 date or alter the frozen 20 dates / 21,475 rows;
- first search the repository for an existing official TWSE-derived security/instrument master with an explicit type/category field; document exact repo path, upstream identity, field semantics, and freshness;
- if no authoritative source is present, record that result and do not infer common-stock status from code shape, name suffix absence, industry membership, or exclusion from ETF/warrant lists;
- if an authoritative type field is present, classify only the frozen 1,088 IDs and report exact row/unique counts by type with unmatched IDs fail-closed;
- statically audit current repository code/queries/reports that consume `data_twse_institutional_investors` or its normalized equivalents, and map their actual field dependencies to all 19 T86 source columns;
- distinguish proven-current-consumer requirements from speculative future usefulness;
- produce a non-secret Phase 6 evidence artifact and, if practical, deterministic zero-network tests for the classification/consumer audit;
- preserve existing Phase 3/4/5 validation steps unchanged or stronger;
- do not add production columns/tables, migrate consumers, change schedules/deployments, widen the universe, delete old POC tables, merge PR #52, or claim production readiness.

Prompt A completion contract:
- authoritative instrument-type source status is resolved as either verified-present or explicitly absent/insufficient;
- any type counts are reproducible and fail-closed;
- current-consumer field-dependency audit is complete enough to justify a bounded schema recommendation;
- Phase 3/4/5 guarantees remain green or unchanged by construction;
- handoff records implementation/run/job/SHA/artifact evidence;
- preserve the Phase 6 Prompt B below unchanged;
- stop with “Prompt A complete — ready for Prompt B”.

## Prompt B — Phase 6 independent closeout (preregistered)
Fetch current remote `main` and the POC branch; read `AGENTS.md` and this handoff; recover this exact Phase 6 Prompt B from the pre-Prompt-A checkpoint. Independently verify:
1. any claimed authoritative instrument-type source really contains a defensible explicit type/category semantic and its exact repository/upstream identity and freshness are recorded; if the result is “insufficient source”, verify the implementation did not substitute heuristics;
2. the frozen 20-date / 21,475-row and 1,088-ID populations were not expanded or silently changed;
3. any classification counts are reproducible, unmatched IDs fail closed, and no four-digit/name/exclusion heuristic is promoted to authoritative common-stock classification;
4. the consumer audit is based on actual repository consumers and maps their proven field dependencies against all 19 T86 columns without silently treating speculative fields as required;
5. the schema recommendation clearly separates current required fields, optional fields, derivable dimensions, and unresolved dependencies;
6. Phase 3/4/5 parity, replay, storage-accounting, quota-labeling, secret-handling, and production-isolation guarantees were not weakened;
7. PR changed files remain POC-only and no production data/code/deployment is modified;
8. concurrent `main` changes do not stale the evidence.

If any criterion fails, repair only the bounded POC defect and restart verification from criterion 1. If all pass, record Phase 6 Prompt B closeout PASS and preregister the next bounded pair only if evidence justifies another POC phase. Do not merge PR #52 or migrate production.

## Phase 6 Prompt A completion — COMPLETE (2026-10-06)

Phase 6 implementation is complete on the isolated POC branch and is ready for the preregistered Phase 6 Prompt B closeout.

Authoritative implementation/evidence:
- tested branch SHA: `d320790dc6b6a1b9e5791d28237a87943f2c496d`;
- workflow run/job: `37448313360` / `112218402677`, conclusion SUCCESS;
- evidence artifact: `11403768325`;
- artifact digest: `sha256:5f72ee7689cd720cce75374f1f42b94362ab465d6550eb864d1682a844ba2abd`;
- current remote `main` at Prompt A completion check: `9d1bd6dd846a0c10729f2295fa8bfdb7e6e81e71`.

Instrument-type resolution:
- verified official upstream: `https://isin.twse.com.tw/isin/C_public.jsp?strMode=2`;
- repository extractor: `scripts/extract_twse_industry.js`;
- refresh workflow: `.github/workflows/update-twse-industry.yml`;
- classification uses explicit TWSE ISIN category files, not code length/name/exclusion heuristics.
- frozen population remained exactly 20 dates / 21,475 rows / 1,088 unique IDs.
- authoritative category result: `stock` 20,816 rows / 1,053 IDs; `innovation_board` 598 rows / 31 IDs; `tdr` 61 rows / 4 IDs; unmatched 0; ambiguous 0.

Consumer/schema audit:
- deterministic audit implementation: `scripts/poc_turso_phase6_audit.js`;
- scan scope is non-POC runtime source under `scripts/`, fixtures excluded;
- direct raw T86 runtime consumers found: 18; normalized institutional runtime consumers: 4;
- proven current stored net metrics: `foreign_ex_dealer_net`, `foreign_dealer_net`, `trust_net`, `dealer_net`;
- `total_net` is derivable/validation rather than required stored state;
- gross buy/sell and dealer proprietary/hedge component fields remain optional/unproven for current scanned runtime consumers;
- the current eight-metric POC schema is not sufficient for production consumers because it omits `foreign_dealer_net`. No production schema was changed.

Regression / isolation:
- Phase 3/4 parity still passes twice at exactly 21,475 rows, with 31,198 negative values each pass;
- replay remains idempotent at 21,475 -> 21,475;
- table-family storage remains 1,937,408 bytes and replay-stable;
- Phase 5 still reports the same 19 raw fields / 8 mapped POC fields;
- PR #52 remains draft/open/unmerged and changed-file scope remains POC-only (7 files);
- no production crawler, production data, schedules, deployments, dashboards, or canonical T86 source files were modified.

Prompt A completion contract is satisfied. Do not start another phase until the preregistered Phase 6 Prompt B is executed and passes.


## Phase 6 Prompt B closeout — PASS (2026-10-06)

The exact Phase 6 Prompt B was independently recovered from the durable pre-Prompt-A checkpoint `75e952f6f8032c2150a886468682e40ee6421b0e` (`docs: close out Turso Phase 5`), not from conversation history or the Prompt A completion summary.

Independent verification:
1. **Authoritative instrument-type source — PASS.** The repository extractor `scripts/extract_twse_industry.js` reads the official TWSE ISIN page `https://isin.twse.com.tw/isin/C_public.jsp?strMode=2`, maps explicit upstream category headings into separate category CSVs, and is refreshed by `.github/workflows/update-twse-industry.yml`. Classification therefore uses explicit source categories rather than code length, name suffix, industry membership, or exclusion heuristics.
2. **Frozen population identity — PASS.** The authoritative run preserves exactly the preregistered 20 T86 dates, 21,475 selected rows, and 1,088 unique four-digit IDs.
3. **Classification reproducibility / fail-closed behavior — PASS.** `scripts/poc_turso_phase6_audit.js` requires every frozen ID to match exactly one authoritative category and fails on unmatched or ambiguous IDs. Result: `stock` 20,816 rows / 1,053 IDs; `innovation_board` 598 rows / 31 IDs; `tdr` 61 rows / 4 IDs; unmatched 0; ambiguous 0.
4. **Consumer audit — PASS, with explicit bounded scope.** The deterministic audit scans non-POC runtime source under `scripts/` with fixtures excluded, identifies 18 direct raw-T86 consumers and 4 normalized institutional consumers, and maps every one of the 19 frozen T86 source columns. Proven current stored net requirements are `foreign_ex_dealer_net`, `foreign_dealer_net`, `trust_net`, and `dealer_net`; `total_net` is derivable/validation state. Gross buy/sell and dealer proprietary/hedge components remain optional/unproven for this scanned runtime-consumer scope. No speculative field was promoted to required.
5. **Schema recommendation separation — PASS.** The recommendation distinguishes fact key (`trade_date`, `stock_code`), four required stored net metrics, derivable `total_net`, derivable `stock_name` dimension, and optional future metrics. It explicitly records that the current eight-metric POC schema is not consumer-complete because `foreign_dealer_net` is missing.
6. **Phase 3/4/5 guarantees preserved — PASS.** Authoritative run `37448313360`, job `112218402677`, tested SHA `d320790dc6b6a1b9e5791d28237a87943f2c496d`, completed SUCCESS. Both exact parity passes remain 21,475 rows with 31,198 negative values each, replay remains 21,475 -> 21,475, table-family logical storage remains 1,937,408 bytes / 473 pages and replay-stable, provider-quota labeling remains separate from SQLite page accounting, and Turso secrets remain redacted.
7. **POC-only changed-file scope — PASS.** PR #52 remains draft/open/unmerged. Its seven changed files are exactly `.github/workflows/poc-turso-institutional.yml`, this handoff, `scripts/poc_turso_capacity_compare.py`, `scripts/poc_turso_institutional.js`, `scripts/poc_turso_institutional_structured.js`, `scripts/poc_turso_phase5_semantics.js`, and `scripts/poc_turso_phase6_audit.js`. No production crawler, canonical source JSON, prediction, dashboard, schedule, or deployment file is modified by the PR.
8. **Concurrent-main freshness — PASS.** Current remote `main` at closeout is `9d1bd6dd846a0c10729f2295fa8bfdb7e6e81e71`. The 12 commits since the PR base are unrelated data/research outputs and do not touch POC entry points, frozen T86 inputs, or the authoritative TWSE category source. The eight category CSV blobs, `scripts/extract_twse_industry.js`, and `.github/workflows/update-twse-industry.yml` are byte-identical between tested SHA and current `main`.

Authoritative Phase 6 evidence:
- run/job: `37448313360` / `112218402677`;
- tested implementation SHA: `d320790dc6b6a1b9e5791d28237a87943f2c496d`;
- artifact: `11403768325`;
- artifact digest: `sha256:5f72ee7689cd720cce75374f1f42b94362ab465d6550eb864d1682a844ba2abd`;
- Prompt A handoff checkpoint: `57033153c702e7696b3e736528c9543ef71ac143`.

No repair or rerun was required during Phase 6 Prompt B.

**Prompt B closeout: PASS**

## Promoted next round
Phase 7 — consumer-complete 9-metric structured-schema POC.

Purpose: close the single proven schema gap from Phase 6 by adding `foreign_dealer_net` to an isolated next-version POC schema, while preserving the old v3 evidence and all production isolation.

### Phase 7 bounded objectives
1. Create a new isolated consumer-complete structured POC version for the same frozen 20 dates / 21,475 rows. Preserve existing v3 tables and evidence; do not mutate or delete them.
2. Store exactly the four proven required current-consumer net metrics plus the existing gross metrics needed by the current POC validation contract, resulting in nine stored T86 metrics by adding `foreign_dealer_net` to the existing eight-metric projection.
3. Perform exact two-pass full-row parity and replay validation across all nine stored metrics, including signed values and deterministic per-date hashes.
4. Measure the new table-family SQLite logical bytes separately and compare only against the prior v3 table-family measurement using the same frozen population. Keep provider billing/quota claims separate.
5. Re-run the Phase 6 category and consumer audits unchanged or stronger so the new schema can be shown to satisfy the proven runtime-consumer minimum without claiming full production readiness.
6. Keep PR #52 draft/unmerged and POC-only. Do not modify production consumers, canonical T86 files, schedules, deployment, prediction, dashboard behavior, or import additional dates.

## Prompt A — Phase 7 implementation (preregistered)
Continue the Turso TWSE Institutional POC in repository `EasonLiu0913/stock_data`, only on branch `poc/turso-institutional-20261006` / PR #52.

Before doing any work:
1. Fetch current remote `main` and the POC branch.
2. Read repository-root `AGENTS.md`.
3. Read canonical handoff `docs/handoffs/turso-twse-institutional-poc.md`.
4. Verify Phase 6 Prompt B is durably PASS and recover this exact Phase 7 pair.
5. Re-check concurrent changes for POC entry points, frozen T86 sources, category inputs/extractor, and proven institutional consumers.

Implement only bounded Phase 7 POC work.

Preferred implementation boundary:
- add a new POC script `scripts/poc_turso_institutional_structured_v4.js` rather than rewriting the closed v3 evidence path;
- update `.github/workflows/poc-turso-institutional.yml` only as needed to execute and retain the Phase 7 evidence;
- update `docs/handoffs/turso-twse-institutional-poc.md`;
- keep `scripts/poc_turso_phase6_audit.js` unchanged unless a strictly stronger deterministic audit is required.

Requirements:
- keep exactly the frozen 20 dates / 21,475 rows / 1,088 IDs;
- create new prefixed POC table names for the Phase 7 schema; never delete or silently migrate the existing v3 tables;
- add `foreign_dealer_net` as the ninth stored metric and derive it from the explicit frozen T86 source column, not from arithmetic or heuristics;
- retain exact full-row parity, second full replay, row-count idempotency, per-date canonical hashes, signed-number handling, and fail-closed parsing;
- prove all nine stored metrics match source values for every frozen row in both parity passes;
- enumerate every exposed table/index/autoindex object for the new Phase 7 table family and report the table-family logical-byte total before/after replay;
- compare new-vs-v3 storage only as SQLite logical page evidence for the same frozen population; do not relabel it as Turso billing usage;
- re-run Phase 6 authoritative category/consumer audit and prove the new schema contains every metric listed in `required_stored_metrics_for_proven_current_consumers`;
- retain secret redaction and non-secret evidence artifact upload;
- do not change production data/code/consumers/schedules/deployment, widen dates/universe, merge PR #52, delete old POC tables, or claim production readiness.

Prompt A completion contract:
- authoritative Phase 7 workflow run is green;
- nine-metric exact parity passes twice across exactly 21,475 rows;
- replay remains idempotent and table-family logical storage is replay-stable;
- Phase 6 audit proves no required current-consumer metric is missing from the Phase 7 schema;
- old v3 evidence/tables remain preserved;
- handoff records run/job/tested SHA/artifact and storage evidence;
- preserve the Phase 7 Prompt B below unchanged;
- stop with “Prompt A complete — ready for Prompt B”.


## Phase 7 Prompt A completion evidence

Implementation and repair history:
- `scripts/poc_turso_institutional_structured_v4.js` was added as a new isolated Phase 7 path; closed v3 script/table identities were preserved.
- Initial commit `cca4d8c749edb70459b5b731a23c41dbce6a88ed` added the nine-metric script. Commit `aa47a1e3bdda2de87df6659117caefb4c2ed2615` fixed a missing mapping comma.
- Workflow commits `45287c0dcac76ea7064175e74e76d20f87ffc2a5` and `5f8fb0e8fed65641a0adca797cb047c2525ce847` added the Phase 7 execution step, PR path filter, and evidence artifact retention.
- Run `37459412434` exposed a real fail-closed defect: the first attempted v4 table had been created without the new column. It failed with `table turso_poc_equity_structured_v4 has no column named foreign_dealer_net`. No deletion or silent ALTER was used.
- Commit `dd87a08f7bf8bba781c22224d40ee87922adae27` completed the nine-metric table schema, required-consumer coverage evidence, and v3/v4 SQLite logical-storage comparison.
- Commit `396adeec9050d2cb8b37b2fced9dcf1a94358084` moved Phase 7 to fresh table identities `turso_poc_equity_structured_v4_phase7` and `turso_poc_equity_structured_sources_v4_phase7`, preserving the failed earlier v4 table as historical POC state instead of deleting or mutating it.

Authoritative evidence:
- workflow run/job: `37459722120` / `112255976475`;
- tested implementation SHA: `396adeec9050d2cb8b37b2fced9dcf1a94358084`;
- run event: pull_request; conclusion: SUCCESS;
- evidence artifact: `11412875561`;
- artifact digest: `sha256:794a86efef5ea8b4e0f9c84d9e716342e730633c34925ef9ff707438c56edd05`;
- artifact uploaded five non-secret files including `/tmp/turso-phase7-validation.json`, `/tmp/turso-phase6-audit.json`, and `/tmp/turso-phase5-semantics.json`.

Phase 7 validation:
- frozen population remains exactly 20 dates / 21,475 rows / 1,088 unique four-digit IDs;
- stored Phase 7 metric columns are exactly nine: `foreign_buy`, `foreign_sell`, `foreign_net`, `foreign_dealer_net`, `trust_buy`, `trust_sell`, `trust_net`, `dealer_net`, `total_net`;
- `foreign_dealer_net` is sourced directly from the explicit frozen T86 field matching `/^外資自營商買賣超股數/`, not arithmetic or heuristics;
- pass 1 exact parity: 21,475 rows, 0 null values, 31,198 negative values;
- pass 2 replay exact parity: 21,475 rows, 0 null values, 31,198 negative values;
- replay row count is idempotent at 21,475 -> 21,475 and canonical per-date hashes are identical across passes;
- Phase 6 audit reran unchanged and again reported 21,475 rows / 1,088 IDs, 18 direct consumers, 4 normalized consumers, and required metrics `foreign_ex_dealer_net`, `foreign_dealer_net`, `trust_net`, `dealer_net`;
- Phase 7 evidence maps those four logical requirements to stored columns `foreign_net`, `foreign_dealer_net`, `trust_net`, `dealer_net` respectively and records `all_required_present=true`.

Storage evidence:
- Phase 7 table family enumerates every exposed table/index/autoindex object with no missing dbstat objects;
- v4 Phase 7 table-family logical size: 1,982,464 bytes / 484 pages;
- prior v3 table-family logical size for the same frozen population: 1,937,408 bytes / 473 pages;
- delta: +45,056 bytes;
- Phase 7 before-replay and after-replay table-family totals are identical at 1,982,464 bytes, so replay storage is stable;
- the comparison is explicitly labeled SQLite logical page evidence for the same frozen population, not Turso provider billing usage.

Isolation and freshness:
- PR #52 remains draft/open/unmerged and changed files remain POC-only: the isolated workflow, routing/handoff, POC scripts, and POC audit/comparison files only;
- no production crawler, canonical frozen source JSON, consumer, schedule, deployment, prediction, or dashboard file was modified by Phase 7;
- current remote main at completion is `59be6cd2dbcbd3f854b30a4609cbd902002e2c4f`;
- concurrent main changes since the Phase 6 baseline add current-day data/research outputs only. The only T86 changes are the new 2026-10-06 data file plus its files index; none of the frozen 20 source files, category extractor/files, or proven consumer code used by this round changed.

Prompt A completion contract is satisfied. Preserve the preregistered Phase 7 Prompt B below unchanged.

## Prompt B — Phase 7 independent closeout (preregistered)
Fetch current remote `main` and the POC branch; read `AGENTS.md` and this handoff; recover this exact Phase 7 Prompt B from the pre-Prompt-A checkpoint. Independently verify:
1. Phase 6 Prompt B is durably PASS and the Phase 7 implementation is isolated to new POC schema/table identities rather than silently mutating closed v3 evidence;
2. frozen 20-date / 21,475-row / 1,088-ID identity is unchanged;
3. `foreign_dealer_net` comes from the explicit T86 source column and every frozen row passes exact nine-metric source parity twice;
4. full replay remains 21,475 -> 21,475 with deterministic hashes and signed-number handling intact;
5. Phase 7 table-family storage accounting includes every exposed table/index/autoindex object, is replay-stable, and any comparison to v3 is labeled SQLite logical evidence rather than provider billing;
6. the unchanged-or-stronger Phase 6 consumer audit proves every current required stored metric is present, while optional/derivable fields remain correctly classified;
7. secrets remain redacted, the evidence artifact is non-secret, PR changed files remain POC-only, and no production data/code/consumer/schedule/deployment behavior is modified;
8. concurrent `main` changes do not stale the source, consumer, classification, or validation evidence.

If any criterion fails, repair only the bounded POC defect and restart verification from criterion 1. If all pass, record Phase 7 Prompt B closeout PASS and decide from evidence whether another POC phase is justified. Do not merge PR #52 or migrate production.

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
- Completed round: Phase 6 authoritative instrument-type source resolution / omitted-metric consumer audit.
- Prompt A: **COMPLETE**.
- Prompt B closeout: **PASS**.
- Authoritative run/job: `37448313360` / `112218402677`.
- Tested implementation SHA: `d320790dc6b6a1b9e5791d28237a87943f2c496d`.
- Evidence artifact: `11403768325`, digest `sha256:5f72ee7689cd720cce75374f1f42b94362ab465d6550eb864d1682a844ba2abd`.
- Closeout checkpoint: the branch commit containing this handoff update.
- Current round: Phase 7 consumer-complete 9-metric structured-schema POC. Prompt A: **COMPLETE**. Prompt B: **PREREGISTERED / PENDING**. Authoritative run/job: `37459722120` / `112255976475`; tested SHA: `396adeec9050d2cb8b37b2fced9dcf1a94358084`; artifact: `11412875561`, digest `sha256:794a86efef5ea8b4e0f9c84d9e716342e730633c34925ef9ff707438c56edd05`.

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



## Phase 7 Prompt B closeout — PASS

The exact Phase 7 Prompt B was independently recovered from pre-Prompt-A durable checkpoint `b829ec510104b82a124e2f905cd7a85117b71266`. The current handoff copy was byte-for-byte identical before closeout.

Independent verification:
1. **Phase 6 prerequisite / v3 isolation — PASS.** Phase 6 has durable Prompt B PASS. Closed v3 script `scripts/poc_turso_institutional_structured.js` has blob `84d833a1afd1d95f014bae70911a60d3332805cb` both at Phase 6 tested SHA `d320790dc6b6a1b9e5791d28237a87943f2c496d` and current POC branch. Phase 7 uses fresh table identities `turso_poc_equity_structured_v4_phase7` / `turso_poc_equity_structured_sources_v4_phase7`.
2. **Frozen identity — PASS.** Authoritative artifact records exactly 20 frozen dates / 21,475 rows. The unchanged Phase 6 audit reran in the same authoritative workflow and records exactly 1,088 unique IDs.
3. **Ninth metric source / exact parity — PASS.** `foreign_dealer_net` is mapped directly from the explicit frozen T86 source field using `/^外資自營商買賣超股數/`. Phase 7 columns are exactly nine stored metrics. Pass 1 and pass 2 each compare all 21,475 rows exactly, with 0 null values and 31,198 signed negative values.
4. **Replay / deterministic hashes — PASS.** Full replay remains 21,475 -> 21,475. The script compares per-date canonical hashes across passes and the artifact contains 20 source hashes.
5. **Storage accounting — PASS.** Phase 7 dbstat accounting exposes and sums all five objects: data table, explicit stock/date index, data-table PRIMARY KEY autoindex, source-metadata table, and source-table autoindex. No dbstat objects are missing. Before/after replay both equal 1,982,464 bytes / 484 pages. Prior v3 family is 1,937,408 bytes / 473 pages, delta +45,056 bytes. Artifact labels this only as SQLite logical page evidence for the same frozen population, not Turso billing usage.
6. **Consumer coverage — PASS.** Unchanged `scripts/poc_turso_phase6_audit.js` blob `1e4bad3c0ae68a908269b9d05fb5723240de0005` reran and again proves required current-consumer metrics `foreign_ex_dealer_net`, `foreign_dealer_net`, `trust_net`, `dealer_net`. Phase 7 artifact maps them to stored columns `foreign_net`, `foreign_dealer_net`, `trust_net`, `dealer_net` and records `all_required_present=true`. Optional and derivable fields remain separately classified.
7. **Secret redaction / POC-only scope — PASS.** Authoritative run `37459722120`, job `112255976475`, tested SHA `396adeec9050d2cb8b37b2fced9dcf1a94358084`, completed SUCCESS. Artifact `11412875561`, digest `sha256:794a86efef5ea8b4e0f9c84d9e716342e730633c34925ef9ff707438c56edd05`, contains five non-secret evidence files; independent content scan found no Turso URL/token/credential strings. PR #52 remains draft/open/unmerged. Changed files are limited to POC workflow/routing/handoff and POC scripts/audits; no production data, consumer, schedule, deployment, prediction, or dashboard file is modified.
8. **Concurrent-main freshness — PASS.** Current remote main at closeout is `80940a94f7235a2eff6c55e9d9347b74d9652344`. The three commits since Prompt A completion baseline `59be6cd2dbcbd3f854b30a4609cbd902002e2c4f` contain no frozen T86 source, TWSE category/extractor, consumer, or POC entry-point changes. Evidence remains fresh.

**Prompt B closeout: PASS**

## Promoted next round

Phase 8 — read-contract compatibility POC.

Purpose: prove whether the isolated Phase 7 Turso schema can reconstruct the institutional read shape required by proven current consumers for the same frozen population, without changing any production consumer or migration state.

### Phase 8 bounded objectives
1. Add a new POC-only read-contract verifier that reads the Phase 7 Turso tables and reconstructs the proven current-consumer institutional shape for the frozen 20 dates.
2. Compare the Turso-derived read shape against the frozen source/normalization semantics for exactly the required current-consumer metrics and identity keys.
3. Preserve instrument-type/category findings from Phase 6; do not silently treat every four-digit T86 ID as common stock.
4. Measure only bounded read-query behavior needed for compatibility evidence; do not claim production latency/SLA from GitHub-hosted samples.
5. Keep PR #52 draft/unmerged and production consumers/configuration untouched.
6. Stop at a compatibility decision gate. Do not migrate production even if compatibility passes.

## Prompt A — Phase 8 read-contract compatibility implementation (preregistered)

```text
Continue the Turso TWSE Institutional POC in repository EasonLiu0913/stock_data, only on branch poc/turso-institutional-20261006 / PR #52.

Before work:
1. Fetch current remote main and the POC branch.
2. Read AGENTS.md and docs/handoffs/turso-twse-institutional-poc.md.
3. Verify Phase 7 Prompt B is durably PASS and recover this exact Phase 8 pair.
4. Re-check current production consumer/read-shape entry points and frozen T86 source semantics without changing them.

Implement only bounded Phase 8 POC evidence.

Preferred new entry point:
- scripts/poc_turso_phase8_read_contract.js
- update .github/workflows/poc-turso-institutional.yml only as needed to execute/upload Phase 8 evidence
- update docs/handoffs/turso-twse-institutional-poc.md

Requirements:
- use the existing Phase 7 tables turso_poc_equity_structured_v4_phase7 and turso_poc_equity_structured_sources_v4_phase7; do not rewrite or delete them;
- keep the exact frozen 20 dates / 21,475 rows / 1,088-ID identity;
- reconstruct the proven current-consumer metric contract: foreign_ex_dealer_net, foreign_dealer_net, trust_net, dealer_net, plus trade_date/security identity;
- compare every frozen row against the canonical frozen T86 source semantics or the current normalization contract with deterministic hashes and fail closed on any mismatch;
- preserve category/type evidence from scripts/poc_turso_phase6_audit.js and explicitly report stock/innovation_board/tdr coverage rather than assuming all four-digit IDs are common stocks;
- include representative read queries required by current consumers and record row counts/query timings only as bounded POC observations, not production SLA claims;
- produce a non-secret /tmp/turso-phase8-read-contract.json artifact;
- do not modify production consumers, canonical T86 data, schedules, deployment, prediction/dashboard behavior, or merge PR #52.

Prompt A completion contract:
- authoritative Phase 8 workflow run is green;
- exact read-contract parity passes for all frozen rows and required metrics;
- deterministic hashes/row counts are stable on a repeated read pass;
- instrument-type coverage is explicit;
- evidence artifact is retained and non-secret;
- handoff records run/job/tested SHA/artifact evidence;
- preserve the Phase 8 Prompt B below unchanged;
- stop with Prompt A complete — ready for Prompt B.
```

## Phase 8 Prompt A completion evidence

Status:
- Phase 8 Prompt A: **COMPLETE**
- Phase 8 Prompt B: **PREREGISTERED / PENDING**

Implementation:
- Added `scripts/poc_turso_phase8_read_contract.js` as a read-only compatibility verifier over the existing Phase 7 tables `turso_poc_equity_structured_v4_phase7` and `turso_poc_equity_structured_sources_v4_phase7`.
- Updated `.github/workflows/poc-turso-institutional.yml` only to trigger on the new POC script, execute the Phase 8 verifier, and retain `/tmp/turso-phase8-read-contract.json` in the existing non-secret evidence artifact.
- No Phase 7/v3 table deletion, ALTER, migration, or production consumer change was performed.

Authoritative Phase 8 evidence:
- workflow run/job: `37471298950` / `112295184571`;
- tested implementation SHA: `8ac55ed927dd67457b4eab6b6fd8b96b14bede5e`;
- event/conclusion: pull_request / SUCCESS;
- evidence artifact: `11417167846`;
- artifact digest: `sha256:85cdb95c3fc20b8d92f99206295609318b8a281f89835344f02c1753535e6912`;
- artifact contains six non-secret evidence files including `turso-phase8-read-contract.json`.

Read-contract validation:
- frozen identity remains exactly 20 dates / 21,475 rows / 1,088 unique IDs;
- contract identity is `trade_date` + `stock_id`;
- required current-consumer metrics are `foreign_ex_dealer_net`, `foreign_dealer_net`, `trust_net`, `dealer_net`;
- Turso stored-column mapping is `foreign_net`, `foreign_dealer_net`, `trust_net`, `dealer_net` respectively;
- PASS1 exact parity: 21,475 rows, 0 null values, 20,403 negative values, hash `401045e819a3f909a515896a2dffedc4658bde49bcd765c191c86e8156a5768f`;
- PASS2 repeated-read exact parity: 21,475 rows, 0 null values, 20,403 negative values, same hash `401045e819a3f909a515896a2dffedc4658bde49bcd765c191c86e8156a5768f`;
- all 20 per-date deterministic hashes match the frozen source semantics and are stable across repeated reads;
- no database mutation is performed by the Phase 8 verifier.

Instrument-type coverage:
- stock: 1,053 unique IDs;
- innovation_board: 31 unique IDs;
- tdr: 4 unique IDs;
- unmatched: 0;
- ambiguous: 0;
- evidence explicitly states that four-digit code shape is not common-stock proof.

Representative read observations:
- 2330 20-date required-metric history: 20 rows, median about 135 ms;
- latest-date top foreign-ex-dealer query: 20 rows, median about 128 ms;
- latest-date full required-metric rows: 1,080 rows, median about 140 ms;
- all timings are explicitly labeled bounded GitHub-hosted POC observations and not production latency/SLA evidence.

Isolation / secrecy / freshness:
- independent artifact scan found no `libsql://`, `TURSO_AUTH_TOKEN`, `TURSO_DATABASE_URL`, or bearer credential strings;
- PR #52 remains draft/open/unmerged and changed-file scope remains POC-only;
- production consumers, canonical T86 data, schedules, deployment, prediction, and dashboard behavior remain untouched;
- current remote main at completion is `3738cb509122a865541bca61b92b1e2d664e9267`;
- the four concurrent main commits since Phase 7 closeout baseline `80940a94f7235a2eff6c55e9d9347b74d9652344` contain no frozen T86 source, category/extractor, consumer-script, or POC entry-point changes, so the Phase 8 evidence is not stale.

Prompt A completion contract is satisfied. Preserve the preregistered Phase 8 Prompt B below unchanged.

## Prompt B — Phase 8 read-contract compatibility closeout (preregistered)

```text
After Phase 8 Prompt A completes, fetch current remote main and the POC branch, read AGENTS.md and the canonical handoff, and recover this exact Prompt B from durable pre-Prompt-A history.

Independently verify:
1. Phase 7 Prompt B is durably PASS and Phase 8 did not mutate/delete closed Phase 7 or v3 tables/evidence;
2. frozen 20-date / 21,475-row / 1,088-ID identity is unchanged;
3. every frozen row passes exact compatibility for trade_date/security identity and required current-consumer metrics foreign_ex_dealer_net, foreign_dealer_net, trust_net, dealer_net;
4. repeated read-contract validation has stable deterministic hashes and row counts;
5. instrument-type coverage remains explicit for stock/innovation_board/tdr and no common-stock-only claim is inferred from four-digit code shape;
6. read-query observations are labeled bounded POC evidence rather than production SLA/performance claims;
7. artifact is non-secret, PR scope remains POC-only, production consumer/data/schedule/deployment behavior is untouched, and PR #52 remains draft/unmerged;
8. concurrent main changes do not stale source, normalization, category, or consumer compatibility evidence.

If any criterion fails, repair only the bounded Phase 8 POC defect and restart verification from criterion 1. On PASS, record Phase 8 Prompt B closeout PASS and make an evidence-based decision whether the POC has enough compatibility evidence for a separate owner-authorized migration-design task. Do not merge PR #52 or modify production.
```
