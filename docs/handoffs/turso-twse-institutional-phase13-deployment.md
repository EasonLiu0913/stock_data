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

## Phase 13 Prompt A completion evidence

Status: **COMPLETE — ready for independent Prompt B**.

Main-only deployment commits:
- `86c155a179d333b623ce2f8946a18ea1f41f45eb` — preregistered Phase 13 owner authorization and paired Prompt A/B before deployment;
- `15bb4211eda4966f4c0ce1092d80e9a5c1b1f60e` — deployed deterministic current-date schedule gate;
- `96ff7455da06b995146d5304366ad344b9fda0d1` — deployed live-shadow status reporter;
- `316c1429e48af0bbc770a079a67cb74e3b32dd9e` — deployed Phase 12 deterministic gate tests;
- `3701029077c09ad44a04f73af8b545870e78e1b8` — deployed Phase 11 collector with added accepted-source identity and canonical-byte recheck fail-closed guards;
- `d02c8255d1cb8da19ee761ef5818508cee3d4d7c` / `df30d20c78099de167e97ff6f6c755147b87d33d` — registered the new scheduler with repository-versioned snapshot semantics and updated only its inventory expectation;
- `4586bb8797ff126d3d755ca403ce6f4228bf55dc` — strengthened status completion to require a 20-eligible-trading-day consecutive streak, not merely 20 accepted rows;
- `b9f2dde1c2b714381d76b057f9950d0385f0107d` — added Phase 13 deployment-contract tests;
- `4b4022099caf962aef112e2e0973202ee2affe14` — activated the standalone default-main workflow with weekday UTC 11:47 / 13:17 cron;
- `e1b783b3f2a46f590824046748c53a24ab3e2629` — fixed Phase 13 sparse-test checkout and schedule-summary integration;
- `f1d426cc48d0a767f0e01994fe9fed74a65c9e90` — normalized schedule timing summary to the repository-required standalone v1 summary job.

Effective deployed workflow:
- `.github/workflows/poc-turso-live-shadow-daily.yml`
- cron: `47 11 * * 1-5` and `17 13 * * 1-5` UTC = Taipei 19:47 and 21:17 weekdays;
- manual `workflow_dispatch` retained with current-date-only gate;
- `contents: read`, `cancel-in-progress: false`, daily-shadow timeout 10 minutes;
- current-main canonical T86 checkout only; no independent TWSE refetch;
- READY invokes existing nine-metric write/read parity collector with explicit `PHASE11_TARGET_DATE`;
- secrets `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` are used only by READY DB steps;
- failures/holiday/missing canonical/preauthorization/excessive-delay/manual historical-or-future targets do not reach DB writer.

Focused authoritative CI:
- main SHA `f1d426cc48d0a767f0e01994fe9fed74a65c9e90`;
- Phase 13 workflow push run `37568302976`;
- gate-tests job `112620982208`;
- result: **SUCCESS**, 16 tests / 16 pass / 0 fail;
- 12 date/readiness tests plus four Phase 13 deployment-contract tests all pass;
- `daily-shadow` and `schedule-timing-summary` were correctly skipped on the push event.

Repository schedule-summary audit:
- latest run `37568302914` remained FAILURE only for the pre-existing unrelated workflows `.github/workflows/checkpoint-institutional-accumulation-sixth-window.yml` and `.github/workflows/test-v2-prediction.yml`;
- after the Phase 13 fix, `poc-turso-live-shadow-daily.yml` is no longer listed in the normalization-required diff.

Other checks at Prompt A closeout:
- scheduled registry run `37568303034` and Node 24 audit run `37568303056` were still in progress and are NOT represented as PASS;
- Public Page Registry CI for the deployment SHA passed;
- existing global active task routing remains `institutional-accumulation`; Phase 13 did not change task routing;
- canonical production T86 workflow blob remained `0cd843396634aef98fe96b0d8fe2b5f604239be3`, unchanged by Phase 13;
- PR #52 remained draft/open/unmerged, head `9dfb112ebd676c1a997f064d35bf501f6469a29e`.

Live evidence truth:
- automatic cron is now **configured on default main**;
- no natural 19:47/21:17 Taipei Phase 13 schedule occurrence had happened yet at this Prompt A closeout;
- no Phase 13 manual online Turso DB invocation was available through the connected GitHub action tools;
- therefore no new accepted date is claimed;
- last proven accepted live date remains `20261006` (Day 1/20) until a future run/status artifact proves otherwise.

Prompt A completion contract is satisfied for deployment. Independent Prompt B must recheck the still-in-progress CI, effective main workflow, natural/manual online evidence if any has since occurred, and must not infer a DB acceptance from configuration alone.

## Current Phase 13 state

Prompt A: **COMPLETE — READY FOR PROMPT B**.
Prompt B: **PASS FOR DEPLOYMENT — LIVE RUN EVIDENCE PENDING**.
Automatic scheduler: **ENABLED ON DEFAULT MAIN; FIRST NATURAL OCCURRENCE NOT YET OBSERVED AT CLOSEOUT**.
Production-reader change authorization: **NONE**.


## Phase 13 Prompt B independent closeout — PASS

The exact preregistered Phase 13 Prompt B was independently recovered from pre-Prompt-A commit `86c155a179d333b623ce2f8946a18ea1f41f45eb` and matched the current handoff text before closeout.

Independent verification result:

1. **Authorization / scope — PASS.** Owner explicitly authorized main-only deployment of the standalone Turso shadow scheduler, without merging PR #52 and without modifying production readers. PR #52 remains draft/open/unmerged at head `9dfb112ebd676c1a997f064d35bf501f6469a29e`.
2. **Independent deployment — PASS.** Required Phase 11/12 collector, status, gate and focused tests were copied independently onto main. No merge of PR #52 occurred. Canonical production T86 workflow blob remains `0cd843396634aef98fe96b0d8fe2b5f604239be3`.
3. **Actual default-main scheduler — PASS.** `.github/workflows/poc-turso-live-shadow-daily.yml` on main contains exactly the authorized weekday UTC schedules `47 11 * * 1-5` and `17 13 * * 1-5` (Taipei 19:47 / 21:17), retains manual `workflow_dispatch`, uses `contents: read`, `cancel-in-progress: false`, bounded 10-minute daily-shadow runtime, official Actions @v7, and repository-required standalone schedule timing summary.
4. **Canonical-date / trading-day gate — PASS.** The deployed gate uses only current-main canonical T86 JSON and the covered TWSE calendar. Preauthorization, non-trading/holiday, missing canonical, uncovered calendar, historical/future manual target and >480-minute delayed schedule all fail closed. There is no older-file fallback and no independent TWSE refetch.
5. **Shadow contract / immutability — PASS.** The deployed collector retains exact nine-metric write/read parity and deterministic contract hash checks, signed-number handling, explicit `PHASE11_TARGET_DATE`, typed instrument classification and duplicate-safe accepted ledger. Phase 13 adds `ACCEPTED_SOURCE_IDENTITY_CHANGED` and `CANONICAL_CHANGED_DURING_SHADOW` guards so an already accepted date cannot silently change source identity and canonical bytes must remain stable through acceptance. `ON CONFLICT(trade_date) DO NOTHING` preserves duplicate idempotence.
6. **Twenty-day semantics — PASS.** Status completion now evaluates `longest_consecutive` eligible TWSE trading-day streak through `nextEligibleTradingDate`; it does not mark complete merely because 20 accepted rows exist.
7. **Secrets / failure isolation — PASS for deployed code.** `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are referenced only by READY-path DB steps. Gate SKIP paths never invoke Turso. Workflow has read-only repository permission and no production checkout credentials or TWSE network fetch. Non-secret evidence artifacts remain bounded.
8. **Focused CI — PASS.** Main deployment SHA `f1d426cc48d0a767f0e01994fe9fed74a65c9e90`, workflow push run `37568302976`, gate-tests job `112620982208`: **16 tests / 16 pass / 0 fail**. This covers the 12 deterministic Phase 12 date/readiness cases plus four Phase 13 deployment/source-integrity contracts. The push event correctly skipped DB-writing and schedule-summary jobs.
9. **Node 24 — PASS.** Run `37568303056` completed successfully for the deployed workflow.
10. **Scheduled registry — Turso scope PASS, repository-global check still fails elsewhere.** Run `37568303034` failed only because existing current-main workflow `collect-institutional-accumulation-catalyst-prospective-canary.yml` is unregistered. The failure contains no `poc-turso-live-shadow-daily.yml` gap; the Turso scheduler itself is registered with `repository_versioned_snapshot` semantics.
11. **Schedule-summary normalization — Turso scope PASS, repository-global check still fails elsewhere.** Run `37568302914` still reports pre-existing unrelated `checkpoint-institutional-accumulation-sixth-window.yml` and `test-v2-prediction.yml`. After Phase 13 repair, the Turso workflow is no longer present in the normalization-required diff.
12. **Concurrent main / routing — PASS within scope.** Global active task remains `institutional-accumulation`; Phase 13 did not change routing. Concurrent prediction/data commits visible during the deployment window are unrelated main activity and are not Phase 13 modifications.
13. **Live online evidence — NOT YET OBSERVED, correctly not claimed.** At Prompt B inspection there is no natural `schedule` event for `POC: Turso live institutional shadow daily` after deployment. Current Taipei time is still before the first configured 19:47 slot. No connected GitHub action is available here to create a manual workflow dispatch. Therefore no new Turso acceptance is claimed. The last proven accepted live evidence remains `20261006` = Day 1/20 until a future scheduled/manual run artifact proves a newer date.

**Phase 13 Prompt B decision: PASS FOR DEPLOYMENT / LIVE RUN EVIDENCE PENDING.**

This PASS means:
- the standalone shadow scheduler is correctly deployed and enabled on default main;
- Phase 13 deployment/safety contracts are independently verified;
- PR #52 remains unmerged and production readers remain unchanged.

This PASS does **not** mean:
- the first natural schedule has already fired;
- 2026-10-07 or any later date has been accepted into Turso;
- 20-day live evidence is complete;
- production primary-read cutover is authorized.

Live accumulation remains `WAITING_ACTIVE_EVIDENCE` with the last proven count **1/20**, pending the first verified natural scheduled run.
