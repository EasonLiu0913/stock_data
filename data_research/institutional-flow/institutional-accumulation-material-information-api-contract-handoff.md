# Institutional Accumulation — Material-information API-contract Handoff

This is the current active routing handoff for the Institutional Accumulation / Catalyst Pre-positioning project.

Historical canonical handoff remains:
`data_research/institutional-flow/institutional-accumulation-validation-handoff.md`

This file is a bounded pre-execution amendment only. It supersedes the previously preregistered active Prompt A/B pair for round `institutional-accumulation-material-information-final-preflight-v1`; it does not alter any completed round, frozen methodology, outcome artifact, holdout, or prior closeout result.

## Current active round

`institutional-accumulation-material-information-final-preflight-v1`

Status:
- Prompt A: **COMPLETE — Prompt B pending**
- Prompt B: **PREREGISTERED / PENDING**

Reason for amendment:
- on 2026-09-02, manual browser inspection of the official MOPS site observed current material-information listing request `POST https://mops.twse.com.tw/mops/api/t05st01`;
- observed JSON body: `{"companyId":"1102","year":"115","month":"all","firstDay":"","lastDay":""}`;
- observed application response: `code=200`, `message="查詢成功"`, `result.companyId="1102"`, `result.data` containing material-information rows;
- row detail descriptors exposed `parameters.enterDate`, `parameters.serialNumber`, `parameters.companyId`, `parameters.marketKind`, and `apiName="t05st01_detail"`;
- therefore the two prior HTTP-200 + 800-byte failures against legacy `/mops/web/ajax_t05st01` are evidence about that legacy route only. Because Prompt A had not started, the active pair is corrected before execution instead of wasting a third legacy retry.

The new agent must independently reproduce this current official API contract. Manual evidence is a lead, not a substitute for durable fresh-runner verification.

## Frozen boundaries inherited from the historical canonical handoff

- Phase 2 semantic SHA-256 remains `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`.
- methodology-development identities remain exactly 41.
- protected `2454` remains motivation-only and excluded from development/validation outcome tuning.
- stock holdout and time holdout outcomes remain sealed.
- refreshed development outcome SHA-256 remains `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`.
- refreshed association SHA-256 remains `779e2be6708e6d8bc55062058ede6178e2dd4cf7634621d05ab05228c31e7b68`.
- Withdrawal v6.0-v6.5 state is frozen and is not an Accumulation input.
- no binary cutoff, composite score, optimized weighting, model, strategy, production behavior, generic news layer, or outcome-driven catalyst tuning is authorized.

Durable prior source-collection state inherited from the historical handoff:
- `institutional-accumulation-official-disclosure-source-collection-v1`: Prompt B PASS;
- Wave A monthly-revenue collection is quality-passed and must not be refetched;
- current legacy material-information preflight durable state is `attempt_count=2`, `retryable=true`, `terminal_state=null`;
- current planner state before correction should be Wave A=0, Wave B=1, Wave C=0;
- Wave C has never run.

## Prompt A durable checkpoint

Round: `institutional-accumulation-material-information-final-preflight-v1`

- Prompt A status: **COMPLETE — Prompt B pending**.
- Fresh-runner workflow run: `33596804900`.
- Triggering implementation head: `eba27e009eea1d43283151b6cc423496ac48b6a4`.
- corrected listing endpoint: `https://mops.twse.com.tw/mops/api/t05st01`; method: `POST`.
- deterministic request body: `{"companyId":"1102","year":"115","month":"all","firstDay":"","lastDay":""}`.
- corrected API attempts this round: `1`; total network requests this round: `1`.
- application code/message: `200 / 查詢成功`.
- response bytes/SHA-256: `15049 / ceac4726ca0ecf6fd50dc1b6432a21dd8910d7c2c3ad04a2b4110ee96515817e`.
- row count: `58`; listing contract passed: `false`.
- detail contract status: `unproven`; detail request executed: `false`.
- durable decision: `corrected_api_contract_blocked`; reason: `corrected_api_listing_schema_or_detail_descriptor_unverified`.
- legacy route evidence remains separate at attempt_count=`2`, retryable=`true`, terminal_state=`null`; no third legacy request was issued.
- post-run planner: Wave A=`0`, Wave B=`0`, Wave C=`0`; material-information collection authorization remains `false`.
- Wave A was not refetched. Wave C did not run. Collection/git time remains audit metadata only, not historical PIT-availability proof.
- Protected Phase 2/outcome/association/holdout/2454/Withdrawal state was not opened or modified by this bounded implementation.

## Prompt A — Material-information API-contract correction preflight

```text
Continue the Institutional Accumulation / Catalyst Pre-positioning project only if this routing handoff is still active and `institutional-accumulation-official-disclosure-source-collection-v1` still has durable Prompt B PASS.

Before work:
1. fetch current remote `main`; do not rely on conversation state;
2. read repository-root `AGENTS.md`, `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, this active routing handoff, the historical canonical handoff `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`, `data_research/institutional-flow/institutional-accumulation-official-disclosure-source-collection-preregistration-v1.md`, current `data_research/institutional-flow/official-disclosure-raw/mops-material-information/preflight.json`, `scripts/plan_institutional_accumulation_official_disclosure_collection.js`, `scripts/preflight_institutional_accumulation_mops_material_information.js`, `tests/institutional_accumulation_official_disclosure_collection.test.js`, relevant collection workflow, and `docs/agent-prompts/task-routing.json`;
3. recover this exact corrected Prompt A + Prompt B pair from durable pre-Prompt-A history;
4. prove protected research state is unchanged and prove the current legacy durable state is still attempt_count=2, retryable=true, Wave A=0, Wave B=1, Wave C=0 before implementation changes.

Execute only a bounded machine-contract correction/preflight:
- do NOT spend a third request on legacy `/mops/web/ajax_t05st01` merely to exhaust its old counter;
- update preflight implementation/tests so the current official JSON listing candidate is `POST https://mops.twse.com.tw/mops/api/t05st01` with JSON body fields `companyId`, `year`, `month`, `firstDay`, `lastDay`;
- use deterministic preflight identity `companyId=1102`, ROC `year=115`, `month=all`, blank `firstDay` and `lastDay`;
- run the corrected listing preflight exactly once on one fresh runner;
- keep the entire round to at most 3 network requests total, with 2-5 second jitter between requests if more than one request is needed;
- listing quality PASS requires parseable JSON, application `code=200`, successful message semantics, `result.companyId=1102`, and `result.data` as an array; HTTP 200 alone is not PASS;
- if rows exist, validate coherent row structure and require at least one detail descriptor exposing `parameters.enterDate`, `parameters.serialNumber`, `parameters.companyId`, `parameters.marketKind`, and `apiName=t05st01_detail`;
- record whether one response is complete for the requested period and whether a pagination/end-condition mechanism actually exists. Do not invent pagination when the current JSON contract returns the complete requested period in one response;
- derive the detail API method/URL/body only from current official MOPS frontend/network evidence or deterministic metadata exposed by the listing response. Do not guess;
- if a detail contract is deterministically discoverable within the same bounded request budget, exercise at most one detail request and persist that contract;
- if detail contract is not provable within budget, persist `listing_contract_passed_detail_contract_unproven` and stop at that boundary;
- keep legacy-route diagnostics separate from corrected-API diagnostics. The two old 800-byte responses remain historical evidence and must not be rewritten as source-empty or as failures of `/mops/api/t05st01`;
- do not increment the legacy attempt counter to 3 solely because the endpoint contract changed. Introduce explicit endpoint/contract-version semantics so planner/preflight logic cannot conflate legacy web/ajax attempts with corrected API attempts;
- corrected API WAF/security/malformed responses must fail closed and remain distinguishable from valid application-level empty data;
- terminal source-empty is allowed only if application success semantics and the exact empty-data contract are proven. Never infer empty from HTTP status or small response size alone;
- persist durable diagnostics sufficient to reproduce endpoint, method, request body, application code/message, response bytes/hash, schema checks, row count, sample detail descriptor, optional detail request/response evidence, and collection timestamp;
- collection/git time is audit metadata only and is never historical PIT-availability proof;
- update planner/tests as needed so future Wave C gating depends on the corrected machine contract rather than obsolete legacy retry exhaustion;
- Wave C MUST NOT run in this round even if corrected listing/detail contract PASSes. Any collection requires a separately preregistered later paired round.

Protected boundaries:
- do not refetch Wave A;
- do not read development outcomes, stock/time holdout outcomes, or protected `2454` outcomes;
- do not create catalyst features, catalyst/outcome associations, thresholds, scores, weights, models, strategies, or production behavior;
- do not modify Withdrawal v6.0-v6.5 state;
- do not claim current API success proves historical version safety or historical T0 visibility.

Prompt A completion requires:
1. corrected implementation/tests and fresh-runner evidence are durable on current remote `main`;
2. durable preflight artifacts distinguish legacy contract attempts from corrected API-contract evidence;
3. planner state reflects the corrected contract without executing Wave C;
4. this active handoff records Prompt A COMPLETE / Prompt B pending and preserves the exact paired Prompt B below;
5. protected research state is unchanged.

When complete, report:
`Prompt A complete — ready for Prompt B`
and stop.
```

## Prompt B — Material-information API-contract correction preflight closeout

```text
Perform mandatory closeout for round `institutional-accumulation-material-information-final-preflight-v1` only after its corrected Prompt A has completed.

Fetch current remote `main`; read `AGENTS.md`, project philosophy/roadmap, this active routing handoff, the historical canonical handoff, source-collection preregistration, current `preflight.json`, planner, corrected preflight implementation, tests, relevant workflow/run evidence, raw/checkpoint artifacts, and task routing. Recover this exact corrected Prompt B from durable pre-Prompt-A history; do not use the superseded legacy third-retry Prompt B.

Verify at minimum:
1. protected Phase 2 freeze, refreshed outcome, refreshed association, stock/time holdouts, protected `2454`, and Withdrawal v6.0-v6.5 state are unchanged;
2. pre-run legacy state was exactly attempt_count=2 + retryable=true and Wave A=0/Wave B=1/Wave C=0; Wave A was not refetched;
3. Prompt A did not blindly issue a third legacy `/mops/web/ajax_t05st01` request and instead implemented the corrected official JSON candidate `POST https://mops.twse.com.tw/mops/api/t05st01` with deterministic body `companyId=1102`, `year=115`, `month=all`, blank `firstDay`/`lastDay`;
4. corrected listing preflight executed exactly once on one fresh runner and this round used <=3 total network requests;
5. listing PASS, if claimed, is supported by parseable JSON plus application-level success (`code=200`, successful message semantics), `result.companyId=1102`, array `result.data`, coherent row structure, and at least one detail descriptor containing `enterDate`, `serialNumber`, `companyId`, `marketKind`, and `apiName=t05st01_detail`; HTTP 200 alone is insufficient;
6. pagination/end-condition conclusions are evidence-based. No fictitious pagination requirement is allowed; any inability to prove completeness is explicit;
7. detail API method/URL/body is accepted only if derived from official current MOPS frontend/network evidence or deterministic listing metadata. If it was not provable within bounded budget, durable result must stop at `listing_contract_passed_detail_contract_unproven` rather than guess;
8. legacy 800-byte responses remain preserved as legacy-route diagnostics, are never called source-empty, and are not counted as corrected `/mops/api/t05st01` failures. Endpoint/contract-version semantics prevent retry-count conflation;
9. a corrected-API empty result is terminal source-empty only if application-success and exact empty-data semantics are proven. Security/WAF/malformed responses remain fail-closed and distinct;
10. current remote writer artifacts contain endpoint, method, request body, application code/message, bytes/hash, schema/row diagnostics, and any detail evidence. Green CI without durable artifacts is failure;
11. Wave C did not run regardless of corrected preflight outcome, and no outcome/holdout/catalyst association/threshold/model/strategy/production behavior was introduced;
12. no statement treats current collection time/current API visibility as proof that the same version was PIT-visible at an earlier T0;
13. this handoff records the result and preregisters the appropriate next paired round before promotion: listing+detail PASS may lead to a physically batched collection preregistration; listing PASS/detail unproven must lead only to bounded detail-contract preflight; corrected API failure must be carried forward explicitly and must not silently revert to obsolete web/ajax retry.

On PASS, update/commit the active handoff, promote only the next explicitly preregistered round, do not execute it, end with:
`Prompt B closeout: PASS`
and stop.
```

## Stop conditions

- No production strategy promotion.
- No outcome or holdout opening.
- No mutation of frozen Phase 2/outcome/association artifacts.
- No catalyst/outcome association in this round.
- No generic-news/analyst substitution.
- No Wave C collection in this round.
- No third legacy retry merely to exhaust the old attempt counter.
