# Phase 13 — Turso TWSE Institutional Live Shadow Daily Deployment

Canonical Phase 13 handoff: `docs/handoffs/turso-twse-institutional-phase13-deployment.md`.
Related POC source (draft PR #52): `docs/handoffs/turso-twse-institutional-poc.md` on `poc/turso-institutional-20261006`.

## Owner authorization — 2026-10-07 Asia/Taipei

Owner explicitly authorized **Phase 13: independently deploy the Turso shadow daily scheduler to remote main without merging PR #52 and without changing production readers**.

This authorization permits a bounded, separate shadow-only workflow and required POC scripts/tests on main. It DOES NOT authorize merging PR #52, modifying the existing TWSE T86 crawler or its schedules, changing prediction/Pages/normalized/production readers, primary-read cutover, deleting canonical JSON, changing Turso credentials or widening instrument scope.

Existing global task routing on main currently belongs to the independent `institutional-accumulation` project; do not change the registry for this explicitly selected bounded deployment. Keep that active project's canary safety rules intact.

## Phase 12 prerequisite

Draft POC's Phase 12 Prompt B closed **STAGED-SCOPE PASS** with 12/12 focused date-gate tests. The proposed cron was deliberately disabled on the POC branch because cron only runs from default main; the owner has now separately authorized installation on main.

Established proof: 2026-10-06 was accepted as live Day 1/20, 1078 rows, contract hash `45e19b2ff46fa27a4b1d6e9222ecacdd14daf012a0a06e66b7cbb51cf9d81908`, duplicate rerun remained count 1. Do not infer any new day was accepted without a new Turso status artifact.

## Frozen Phase 13 implementation contract

- Main-only deployment. Keep PR #52 draft and unmerged. No general POC PR merge.
- New standalone `.github/workflows/poc-turso-live-shadow-daily.yml` with weekday UTC `47 11 * * 1-5` and `17 13 * * 1-5` (Taipei 19:47 and 21:17), plus manual workflow_dispatch.
- New main scripts: `scripts/poc_turso_phase12_schedule_gate.js`, `scripts/poc_turso_phase11_live_shadow_collect.js`, `scripts/poc_turso_phase11_live_shadow_status.js`; new independent test: `tests/poc_turso_phase12_schedule_gate.test.js`.
- Reuse existing `scripts/lib/twse_trading_day.js` and date resolver on main, existing `data_twse_institutional_investors` canonical files and `data_twse/twse_industry_*.csv` classification. No independent TWSE fetch. Collect ONLY a current eligible scheduled date, with no older-file fallback.
- Fail closed: non-trading/holiday, uncovered calendar, unavailable canonical, future or pre-authorization, missed schedule with excessive delay, missing secrets, schema, parity mismatch; no acceptance on failed/duplicate dates.
- On READY, use the established Phase 11 nine-metric Turso shadow table family and exact write/read parity; keep canonical file as source of truth. Preserve immutable ledger identities for accepted dates, including source SHA and contract hash.
- Use only Actions secrets `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` in collector steps; minimum permissions `contents:read`, `cancel-in-progress:false`, bounded timeout, no secret exposure, evidence artifacts.
- Register ONLY the new scheduled POC workflow with `repository_versioned_snapshot` semantics in `scripts/audit_scheduled_workflow_outputs.js`; adapt `tests/audit_scheduled_workflow_outputs.test.js` only as necessary. Do not alter other research canaries/guards, T86 production, prediction or Pages.
- Before activation, ensure correct complete main source files are present and dry-test focused gate and registry; workflow file with active cron must be committed LAST.
- A passing setup test does not prove a natural cron has fired. If an authorized real manual invocation is unavailable, report it as unverified, not success.

## Phase 13 Prompt A — preregistered, ACTIVE

```text
Execute only the owner-authorized Phase 13 independent Turso live-shadow daily deployment. Verify latest remote main, AGENTS.md, this Phase 13 handoff, Phase 12 staged-scope closeout and draft PR #52.

Preregister this exact paired Prompt A/B before modifying main. Copy only required Phase 12/11 collector, gate, reporter and gate-tests to main; adjust only isolated safety bugs. Add the POC-only scheduled-workflow registry rule and bounded test expectations. Do not change task routing, other research workflows, production readers or T86 collection. Run appropriate available focused verification before enabling cron. Deploy new independent scheduled workflow to main LAST, with two weekday Taipei evening slots and manual dispatch. Verify effective main workflow source, source SHA/provenance, PR draft status, schedule activation semantics, and GitHub Actions status.

Record exact commits, tests, runs, known blockers, and whether natural schedule or manual online Turso shadow write has truly happened. Do not claim live acceptance without evidence. Preserve this Phase 13 Prompt B byte-for-byte. Stop with Prompt A ready for Prompt B, even if remaining unrelated global CI failures are noted.
```

## Phase 13 Prompt B — preregistered, PENDING

```text
Independently verify the Phase 13 main deployment using the exact Prompt B preregistered before Prompt A. Fetch current main, the POC branch and PR #52; read AGENTS.md, the Phase 13 handoff and the Phase 12/11 prerequisites.

Check: (1) owner's explicit main-only shadow deployment authorization; (2) independently deployed required files with no merge of PR #52 and zero production reader/T86 crawler changes; (3) main cron actually present with UTC 11:47/13:17 weekday slots, no extra trigger, manual option, minimum permissions and bounded concurrency; (4) current-date canonical main T86 and covered TWSE calendar gates, no older-file fallback/no independent TWSE refetch; (5) strict nine-metric shadow read/write parity, signed numeric support, source SHA and existing ledger idempotence/source immutability; (6) no secrets/log leaks and bounded failure behaviour; (7) POC-only scheduled registry entry with correct semantics and focused tests; (8) current main freshness and active-task routing preserved; (9) GitHub Actions deployment/CI status and exact new accepted live dates, distinguishing natural cron evidence, manual run and untested future cases.

Fail/repair only Phase 13-scoped defects; never widen into institutional-accumulation protected state. Record PASS only for verified gates, otherwise explicit HOLD with reasons. Do not cut over production primary-read or merge PR #52.
```

## Current Phase 13 state

Prompt A: **PREREGISTERED / IN PROGRESS**.
Prompt B: **PREREGISTERED / PENDING**.
Production-reader change authorization: **NONE**.
