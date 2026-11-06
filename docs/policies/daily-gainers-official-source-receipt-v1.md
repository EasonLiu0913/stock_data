# TAIWAN STOCK — Daily official-source numeric verification receipt v1
Owner approved: 2026-11-06. Applies to daily 5% Facts, S01, C03 and both scheduled Agents. This is an implementation contract, not proof that a receipt or PASS already exists.

## Acceptance
- Required standard: official-source numeric reconciliation, NOT independent second-source corroboration.
- S01 PASS requires an actual successful date-scoped upstream verification receipt for the exact input Facts and official source SHA set, with source date, stock code, unit, record status and numerical comparison checked. A complete source list alone is insufficient.
- C03 independently requires AI numeric claims to agree with verified Facts. C02 structure PASS is not S01 or C03 PASS.
- No second web lookup per stock when an eligible verified receipt exists. Missing, stale, conflicting, unverifiable or malformed evidence stays PENDING/FAIL; never fabricate PASS.

## Durable receipt, generated once per exact trading date
Suggested path: `data_daily_gain_over_5/verification/official-numeric/YYYYMMDD.json`. GitHub Actions writes it after running the upstream official-source numeric validator, not before. Record schema_version, target_date, validator path/version SHA, workflow run_id/job_id and URL, verified_at, Facts path/blob SHA, each official source path/blob SHA, date/units/schema check status, and per-code/per-field actual-vs-Facts numeric comparison result (PASS/FAIL/PENDING and reason). Include absence vs zero semantics and conversions (shares/lots). Mark aggregate PASS only when all mandatory fields for the exact date pass. Never treat metadata alone as proof of execution.
- Commit receipt atomically to main with CAS or equivalent; preserve failed diagnostic results. A new receipt supersedes old only when its exact inputs are verified.
- Validate receipt authenticity against GitHub Actions run/job result and SHA lineage; a text record self-declaring PASS without upstream evidence is insufficient.

## Agent reuse and invalidation
- At start read only date, source SHA manifest, receipt status and next affected 1–3 stocks. Reuse verified per-code results when all relevant input SHA and validator version match.
- When one source SHA changes, invalidate only dependent checks and stocks, and rerun the minimal official numeric reconciliation; do not re-fetch all websites per stock. When Facts SHA changes, recompute affected lineage; never use stale PASS.
- Existing per-stock CAS attempt ledger and 10-attempt lifetime cap remain. Do not spend a retry solely to read unchanged receipt SHA. For S01 PENDING, first seek exact-date upstream validator PASS; if unavailable, trigger/implement one date-scoped verification and persist actual run evidence before resolving.
- Report receipt path, source SHAs, run ID, per-code S01/C03 and affected invalidations. No proof means PENDING, not PASS.

## Safety
Do not lower original A/B, numeric checks, date/units/schema gates, daily Validator or upload locks. Do not trigger YouTube uploads. This policy does not by itself authorize publication.
