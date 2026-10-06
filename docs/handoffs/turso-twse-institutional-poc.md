# Turso TWSE Institutional POC

Canonical handoff: `docs/handoffs/turso-twse-institutional-poc.md`

## Current phase
Phase 3 full-row Turso parity / replay / latency validation: **Prompt A COMPLETE (2026-10-06), Prompt B PENDING**.

Do not start a later implementation phase until the preregistered Prompt B below independently closes this round.

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
- Source: `scripts/crawl_twse_institutional_investors.js`, `data_twse_institutional_investors/*.json`.

## Current round status
- Round: Phase 3 full-row parity / replay / latency validation.
- Prompt A: **COMPLETE**.
- Prompt B: **PREREGISTERED / PENDING**.
- Do not run another Prompt A until this exact Prompt B passes.

## Next round
Run the preregistered Prompt B below as an independent closeout. It must verify the authoritative run and code rather than relying on this completion summary. If Prompt B passes, it may then checkpoint the next bounded POC phase and preregister its paired prompts.

## Prompt A — current round implementation (completed)
Fetch current remote main and POC branch; read `AGENTS.md` and this handoff. Improve only the isolated v3 Turso POC to validate all 21,475 rows against source projections, compare repeat-run idempotency, examine remote storage/quotas safely, and collect query latency metrics. Do not touch production, original JSON, or unrelated workflows. Do not delete prior experimental tables. Commit evidence and provide the exact run IDs.

## Prompt B — current round independent closeout (preregistered before Prompt A)
Fetch current remote main and PR branch; read `AGENTS.md` and this preregistered handoff. Verify actual GitHub Actions run/logs and source-code logic, exact counts and values for all 20 trading dates, unchanged production files, safe secret handling, idempotency under replay, defensible storage comparison, and query measurement. If any gate fails, repair only within POC and rerun bounded verification; otherwise record PASS and preserve next-round paired prompts in this handoff. Do not merge PR or change production deployments.
