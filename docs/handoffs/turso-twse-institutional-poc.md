# Turso TWSE Institutional POC

Canonical handoff: `docs/handoffs/turso-twse-institutional-poc.md`

## Current phase
Phase 2 structured SQL import and independent local SQLite size comparison: **PASS (2026-10-06)**. Next phase is performance / durability / precise capacity validation, not production migration.

## Objective
Evidence-based feasibility test of a zero-cost Turso database for TWSE T86 daily institutional flows from `data_twse_institutional_investors`.

## Frozen constraints
- Keep all work on `poc/turso-institutional-20261006` / PR #52, **not main**.
- No production crawler, prediction, dashboard, schedule, or deployment migration.
- No token values/logging credentials; Turso secrets from Repository secrets.
- No changes to canonical data during POC. Only `turso_poc_*` tables; no writes to tracked JSON files.
- Separate 4-digit TWSE securities from warrants; 4-digit pattern is **not an authoritative security-master classification**.
- Do not claim a full-DB storage ratio using raw JSON including excluded instruments.
- Avoid large external requests and avoid additional import waves until evidence and free-tier capacity are reviewed.

## Completed
1. Connectivity `SELECT 1` verified after token update.
2. Earlier v2 import of 20 dates, 21,475 four-digit instrument rows, round-trip and idempotent upsert: GitHub Actions #4, run ID `37439496021` succeeded.
3. Earlier 16–18K rows/day were incorrectly labeled stocks, including many excluded instruments; 20-minute job timeout caused cancellation after day 11 in original run `37431071289`.
4. Structured v3 importer `scripts/poc_turso_institutional_structured.js` and sizing comparison `scripts/poc_turso_capacity_compare.py`, executed from `.github/workflows/poc-turso-institutional.yml`.
5. **V3 PASS**, Actions run ID `37440693487`, job `112193442377`: 20 dates 2026-09-04 through 2026-10-05, 21,475 four-digit records, 23? no: 8 signed numeric fields, per-date source counts, sampled full-field round-trip, upsert idempotency, 2330 historical query returned 20 days, top foreign buy net returned 5 rows.
6. Same-row local SQLite comparison **including key/stock index**, 21,475 records: compact JSON-value-array model 2,322,432 bytes (108.1 bytes/row); typed SQL model 1,880,064 bytes (87.5 bytes/row), ratio 0.8095 (~19.05% lower). Local comparison is not Turso provider billing or exact online bytes.
7. V3 raw source JSON including excluded instruments = 94,783,801 bytes; structured selected-row newline JSON = 4,054,939 bytes. These are DIFFERENT populations from the full-source JSON and must not be compared as a compression ratio.

## Important caveats
- TWSE T86 is listed-market data only: it is NOT the entire TWSE+TPEx equity universe.
- The v3 structured schema covers 8 metrics: foreign buy/sell/net, trust buy/sell/net, dealer net, combined institutional net. Some other raw source columns are not yet imported.
- Four-digit IDs can include security types other than common stocks. Proper security-master join should precede a production classification.
- Earlier experimental `turso_poc_institutional` and `turso_poc_equity_v2` tables may occupy cloud space; never silently delete until ownership and backups confirmed.
- At current limited scope and daily density ~1,074 rows/day for these 8 metrics, a simple annual estimate ~263,000 rows x 87.5 B ≈ 23 MB/year in local SQLite. This extrapolation excludes vendor overhead, index growth, stock universe changes, missing features, all other datasets, source changes, and retention policies; not a supported estimate for the whole 5GB project.
- No benchmark timings, remote table-specific storage, read quotas, failure/resume under partial write, or detailed count/hash equality across all rows yet.

## Evidence / entry points
- PR: https://github.com/EasonLiu0913/stock_data/pull/52
- CI: https://github.com/EasonLiu0913/stock_data/actions/runs/37440693487
- `scripts/poc_turso_institutional.js`: legacy raw-row JSON v2 POC.
- `scripts/poc_turso_institutional_structured.js`: structured SQL v3 importer.
- `scripts/poc_turso_capacity_compare.py`: local SQLite apples-to-apples comparison.
- `.github/workflows/poc-turso-institutional.yml`: isolated on PR / manually runnable.
- Source: `scripts/crawl_twse_institutional_investors.js`, `data_twse_institutional_investors/*.json`.

## Next round
1. Inspect current remote main and PR branch, follow `AGENTS.md`, this handoff and architecture governance.
2. Freeze selected dates & expected row count from v3.
3. Measure structured import network latency and run-to-run idempotency, exact per-field parity for all sampled days or all 21,475 rows, NULL handling and signed numeric correctness.
4. Compare remote provider observed storage or `dbstat` if available, otherwise label estimated local SQLite only.
5. Document realistic whole-project free-tier limits; do not extrapolate one table to the whole project.
6. Keep POC isolated. Submit evidence then independent closeout before discussing production use.

## Prompt A — next-round implementation
Fetch current remote main and POC branch; read `AGENTS.md` and this handoff. Improve only the isolated v3 Turso POC to validate all 21,475 rows against source projections, compare repeat-run idempotency, examine remote storage/quotas safely, and collect query latency metrics. Do not touch production, original JSON, or unrelated workflows. Do not delete prior experimental tables. Commit evidence and provide the exact run IDs.

## Prompt B — next-round independent closeout
Fetch current remote main and PR branch; read `AGENTS.md` and this preregistered handoff. Verify actual GitHub Actions run/logs and source-code logic, exact counts and values for all 20 trading dates, unchanged production files, safe secret handling, idempotency under replay, defensible storage comparison, and query measurement. If any gate fails, repair only within POC and rerun bounded verification; otherwise record PASS and preserve next-round paired prompts in this handoff. Do not merge PR or change production deployments.
