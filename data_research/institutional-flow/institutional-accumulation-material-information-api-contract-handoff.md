# Institutional Accumulation — Material-information API-contract Handoff

Canonical active routing handoff:
`data_research/institutional-flow/institutional-accumulation-material-information-api-contract-handoff.md`

Historical canonical project handoff remains:
`data_research/institutional-flow/institutional-accumulation-validation-handoff.md`

This routing handoff superseded the previously preregistered legacy-third-retry Prompt A/B for round `institutional-accumulation-material-information-final-preflight-v1`. It does not alter completed rounds, frozen methodology, outcome artifacts, holdouts, or prior closeout results.

## Current active round

`institutional-accumulation-material-information-row-shape-detail-contract-preflight-v1`

Status:
- Prompt A: **COMPLETE — Prompt B pending**
- Prompt B: **PREREGISTERED / PENDING**

Promotion does not execute Prompt A automatically.

## Frozen boundaries

- Phase 2 semantic SHA-256 remains `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`.
- methodology-development identities remain exactly 41.
- protected `2454` remains motivation-only and excluded from development/validation outcome tuning.
- stock holdout and time holdout outcomes remain sealed.
- refreshed development outcome SHA-256 remains `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`.
- refreshed association SHA-256 remains `779e2be6708e6d8bc55062058ede6178e2dd4cf7634621d05ab05228c31e7b68`.
- Withdrawal v6.0-v6.5 state is frozen and is not an Accumulation input.
- no binary cutoff, composite score, optimized weighting, model, strategy, production behavior, generic news layer, or outcome-driven catalyst tuning is authorized.
- Wave A monthly-revenue collection is quality-passed and must not be refetched.
- no material-information Wave C collection is authorized until a separately preregistered collection round is promoted after contract closeout.

## Closed round — corrected material-information API preflight

Round: `institutional-accumulation-material-information-final-preflight-v1`

**Prompt B closeout: PASS**

Pre-Prompt-A amendment commit containing the exact corrected Prompt A/B pair:
`2d91b842e90d6e76d2812d7589932cc3f7bab066`

Prompt A implementation head:
`eba27e009eea1d43283151b6cc423496ac48b6a4`

Fresh-runner workflow evidence:
- run `33596804900`;
- corrected preflight job `100142131290`;
- durable corrected preflight writer commit `dfc9ec6b304d6105f2a058a784703fe4b58e412c`;
- Prompt A handoff checkpoint commit `d50da8cadb8b16a43e480a3dd091d7abd3f64712`.

Prompt B independent verification:

1. Bounded compare from amendment preregistration `2d91b842e90d6e76d2812d7589932cc3f7bab066` through Prompt A/cleanup changed only the collection workflow, corrected preflight/planner/tests/checkpoint helper, corrected preflight artifact, and this routing handoff. Phase 2 freeze, refreshed development outcome, refreshed association, stock/time holdouts, protected `2454`, and Withdrawal v6.0-v6.5 files were not modified — **PASS**.
2. Pre-run durable legacy state was exactly `attempt_count=2`, `retryable=true`, `terminal_state=null`; planner baseline was Wave A=`0`, Wave B=`1`, Wave C=`0`. Wave A was not refetched — **PASS**.
3. Prompt A did not issue a third request to legacy `/mops/web/ajax_t05st01`. It implemented `POST https://mops.twse.com.tw/mops/api/t05st01` with deterministic JSON body `{"companyId":"1102","year":"115","month":"all","firstDay":"","lastDay":""}` — **PASS**.
4. The corrected listing executed exactly once on one fresh runner. Total network requests in the corrected Prompt A round were exactly `1`, below the cap of `3` — **PASS**.
5. Durable response evidence: HTTP `200`, response bytes `15049`, SHA-256 `ceac4726ca0ecf6fd50dc1b6432a21dd8910d7c2c3ad04a2b4110ee96515817e`, parseable JSON, application `code=200`, message `查詢成功`, `result.companyId=1102`, `result.data` array with `58` entries, and a discovered descriptor with `apiName=t05st01_detail` plus `enterDate=1150115`, `serialNumber=1`, `companyId=1102`, `marketKind=sii` — **PASS as observed evidence**.
6. Prompt A did **not** claim listing PASS because its analyzer required every top-level `result.data` row to be a non-array object and recorded `coherent_row_structure=false`. The raw 15,049-byte JSON response body itself was not durably persisted, so closeout does not rewrite this conservative blocked decision from inference alone. This is carried forward as a bounded row-shape verification gap, not as evidence that the corrected API transport/application contract failed — **PASS / explicit limitation**.
7. Pagination conclusions are evidence-based: the request used `month=all`; no pagination mechanism or end-condition was observed; no fictitious pagination requirement was invented; completeness beyond the single response is not upgraded beyond the evidence — **PASS**.
8. Detail method/URL/body was not guessed. No detail request ran. Durable detail status remains `unproven` — **PASS**.
9. The two historical 800-byte responses remain isolated under legacy contract version `mops-web-ajax-t05st01-form-v1`; legacy attempt count remains `2`; they are not called source-empty and are not counted as corrected API failures — **PASS**.
10. No corrected-API empty result was observed or promoted to terminal source-empty. Security/WAF/malformed semantics remain fail-closed — **PASS**.
11. Remote preflight artifact contains corrected endpoint, method, request body, application code/message, response bytes/hash, schema/row diagnostics, descriptor evidence, request count, collection timestamp, and explicit PIT disclaimer. Green CI is backed by durable writer commit `dfc9ec6b...` — **PASS**.
12. Wave C did not run and post-run planner was Wave A=`0`, Wave B=`0`, Wave C=`0`, with `material_information_authorized=false`. No outcome/holdout/catalyst association/threshold/model/strategy/production behavior was introduced — **PASS**.
13. Collection time/current API visibility is explicitly audit metadata only and is not treated as proof that the same version was visible at an earlier T0 — **PASS**.
14. Because listing transport/application success and descriptor evidence are strong but coherent row shape and detail HTTP contract are still not durably proven, the next promoted round is a bounded corrected-API row-shape + detail-contract preflight. It must not revert to the obsolete legacy retry and must not run Wave C — **PASS**.

Closeout decision:
`corrected_listing_application_contract_observed_row_shape_and_detail_contract_unproven`

## Current durable corrected API state

Exact artifact:
`data_research/institutional-flow/official-disclosure-raw/mops-material-information/preflight.json`

Implementation / planner / tests:
- `scripts/preflight_institutional_accumulation_mops_material_information.js`
- `scripts/plan_institutional_accumulation_official_disclosure_collection.js`
- `tests/institutional_accumulation_official_disclosure_collection.test.js`
- `.github/workflows/collect-institutional-accumulation-official-disclosure.yml`

Observed corrected API contract:
- endpoint: `https://mops.twse.com.tw/mops/api/t05st01`;
- method: `POST`;
- body: `companyId=1102`, ROC `year=115`, `month=all`, blank `firstDay`/`lastDay`;
- HTTP/application success observed;
- 58 listing entries observed;
- `t05st01_detail` descriptor metadata observed;
- raw JSON response body was not persisted in the completed round;
- top-level row shape therefore remains unproven from durable evidence;
- detail HTTP method/URL/body remains unproven;
- Wave C remains forbidden.

## Next round objective

Persist and inspect the corrected listing response itself so row shape can be verified from durable evidence, then derive the detail HTTP contract only from official deterministic evidence. This is still a bounded preflight, not historical collection.

Exact new raw paths for this round:
- `data_research/institutional-flow/official-disclosure-raw/mops-material-information/corrected-api-preflight/source.json`
- `data_research/institutional-flow/official-disclosure-raw/mops-material-information/corrected-api-preflight/source-meta.json`
- optional, only if a detail request is deterministically authorized: `data_research/institutional-flow/official-disclosure-raw/mops-material-information/corrected-api-preflight/detail-source.json`
- optional corresponding metadata: `data_research/institutional-flow/official-disclosure-raw/mops-material-information/corrected-api-preflight/detail-source-meta.json`

## Prompt A durable checkpoint — row-shape + detail-contract preflight

Round: `institutional-accumulation-material-information-row-shape-detail-contract-preflight-v1`

- Prompt A status: **COMPLETE — Prompt B pending**.
- Fresh-runner workflow run: `33602540469`.
- Triggering implementation head: `313bffb96ea07c609fbcc670c2311244b074b083`.
- corrected listing endpoint/method: `https://mops.twse.com.tw/mops/api/t05st01` / `POST`.
- deterministic request body: `{"companyId":"1102","year":"115","month":"all","firstDay":"","lastDay":""}`.
- total network requests this round: `1` (cap 3); legacy attempt_count remains `2`.
- raw listing source: `data_research/institutional-flow/official-disclosure-raw/mops-material-information/corrected-api-preflight/source.json`; metadata: `data_research/institutional-flow/official-disclosure-raw/mops-material-information/corrected-api-preflight/source-meta.json`.
- response bytes/SHA-256: `15049 / 4bf00b7a65ce051e67fa749424c9fac18524c4a49dcb93e9fc07b6fbedba21f5`.
- application code/message: `200 / 查詢成功`.
- row count/type/coherence: `58 / array / true`.
- descriptor count: `58`; sample descriptor: `{"apiName":"t05st01_detail","parameters":{"enterDate":"1150115","serialNumber":"1","companyId":"1102","marketKind":"sii"}}`.
- listing contract passed: `true`.
- detail contract status: `unproven`; request executed: `false`.
- durable decision: `listing_contract_passed_detail_contract_unproven`; reason: `corrected_api_listing_contract_verified_detail_method_url_body_not_proven`.
- post-run planner: Wave A=`0`, Wave B=`0`, Wave C=`0`; material-information authorization=`false`.
- Wave A was not refetched. Wave C did not run. Current collection time remains audit metadata only, not historical PIT proof.
- Protected Phase 2/outcome/association/holdout/2454/Withdrawal state was not opened or modified by this bounded implementation.

## Prompt A — Row-shape + detail-contract preflight

```text
Continue the Institutional Accumulation / Catalyst Pre-positioning project only if this routing handoff is still the active handoff and round `institutional-accumulation-material-information-row-shape-detail-contract-preflight-v1` is still Prompt A NOT STARTED / ACTIVE.

Before work:
1. fetch current remote `main`; do not rely on conversation state;
2. read repository-root `AGENTS.md`, `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, this routing handoff, historical canonical handoff `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`, `data_research/institutional-flow/institutional-accumulation-official-disclosure-source-collection-preregistration-v1.md`, current `data_research/institutional-flow/official-disclosure-raw/mops-material-information/preflight.json`, `scripts/preflight_institutional_accumulation_mops_material_information.js`, `scripts/plan_institutional_accumulation_official_disclosure_collection.js`, `tests/institutional_accumulation_official_disclosure_collection.test.js`, `.github/workflows/collect-institutional-accumulation-official-disclosure.yml`, and `docs/agent-prompts/task-routing.json`;
3. recover this exact Prompt A + Prompt B pair from durable pre-Prompt-A repository history;
4. verify the prior corrected round has Prompt B PASS, legacy attempt_count remains exactly 2, Wave A is quality-passed, Wave C has never run, and protected Phase 2/outcome/association/holdout/2454/Withdrawal state is unchanged.

Execute only this bounded preflight:
- never retry legacy `/mops/web/ajax_t05st01`;
- keep the corrected listing identity exactly `POST https://mops.twse.com.tw/mops/api/t05st01` with JSON body `{"companyId":"1102","year":"115","month":"all","firstDay":"","lastDay":""}`;
- run at most one corrected listing request on one fresh runner and persist the exact response body to `data_research/institutional-flow/official-disclosure-raw/mops-material-information/corrected-api-preflight/source.json` plus `source-meta.json` containing endpoint, method, body, HTTP status, application code/message, bytes, SHA-256, collection timestamp, parser identity, row-shape diagnostics, row count, descriptor diagnostics, and PIT disclaimer;
- total network request cap for the entire round is 3, with 2-5 second jitter between requests;
- inspect the actual persisted `result.data` structure. Do not require top-level rows to be objects if the official response uses arrays/cell arrays. Define and test the real coherent schema from the persisted response, including row/cell type consistency and the location of `t05st01_detail` descriptors;
- listing PASS requires parseable JSON, application code=200 with successful semantics, result.companyId=1102, result.data array, coherent observed row schema across the returned dataset, and at least one descriptor exposing `parameters.enterDate`, `parameters.serialNumber`, `parameters.companyId`, `parameters.marketKind`, and `apiName=t05st01_detail`;
- preserve evidence-based pagination semantics. Do not invent a page loop. Record only what the API exposes for the month=all request;
- derive detail method/URL/body only from deterministic official MOPS evidence. Acceptable evidence is current official frontend/network contract or explicit machine metadata sufficient to determine the request without guessing. The string `apiName=t05st01_detail` alone is not sufficient to invent a URL or HTTP method;
- if determining the detail contract requires one official frontend/static-contract request, it may use one of the remaining requests and must persist the exact evidence used;
- only if the detail request contract is deterministically proven within the remaining request budget may you execute at most one detail request for the observed descriptor and persist `detail-source.json` + `detail-source-meta.json`;
- if listing PASSes but detail contract remains unproven, durable decision must be exactly `listing_contract_passed_detail_contract_unproven` and stop there;
- if listing and detail contract both PASS, durable decision may be `listing_and_detail_contract_passed`, but Wave C is still forbidden in this round;
- if corrected API returns WAF/security/malformed/application failure, fail closed and keep that distinct from source-empty;
- terminal source-empty is allowed only when application success and the exact empty-data contract are observed and persisted;
- planner must continue to report Wave A=0 and Wave C=0 throughout this round. Do not authorize collection merely because preflight passes;
- do not refetch Wave A and do not collect the nine-stock Wave C listing partitions;
- do not open development outcomes, stock/time holdout outcomes, or protected 2454 outcomes;
- do not create catalyst/outcome associations, thresholds, scores, weights, models, strategies, or production behavior;
- do not modify Withdrawal v6.0-v6.5 state;
- do not claim current API collection proves historical value-version immutability or earlier T0 visibility.

Prompt A completion requires:
1. corrected raw listing response and metadata are durable on current remote main;
2. actual row-shape diagnostics are durable and covered by tests;
3. detail contract is either deterministically proven with bounded evidence or explicitly remains unproven without guessing;
4. total requests are <=3 and legacy request count remains 2;
5. Wave C did not run and planner does not authorize it;
6. this handoff records Prompt A COMPLETE / Prompt B pending and preserves the exact Prompt B below;
7. protected research state remains unchanged.

When complete, report:
`Prompt A complete — ready for Prompt B`
and stop.
```

## Prompt B — Row-shape + detail-contract preflight closeout

```text
Perform mandatory closeout for round `institutional-accumulation-material-information-row-shape-detail-contract-preflight-v1` only after its Prompt A has completed.

Fetch current remote `main`; read `AGENTS.md`, project philosophy/roadmap, this routing handoff, historical canonical handoff, source-collection preregistration, current `preflight.json`, corrected raw `source.json`/`source-meta.json`, optional detail artifacts, planner, preflight implementation, tests, workflow/run evidence, and task routing. Recover this exact Prompt B from durable pre-Prompt-A history.

Verify at minimum:
1. protected Phase 2 freeze, refreshed outcome, refreshed association, stock/time holdouts, protected 2454, and Withdrawal v6.0-v6.5 state are unchanged;
2. legacy `/mops/web/ajax_t05st01` attempt_count remains exactly 2 and no legacy request ran;
3. Wave A was not refetched and Wave C did not run;
4. corrected listing executed at most once in this round on one fresh runner; entire round used <=3 network requests with the required jitter when multiple requests occurred;
5. exact corrected listing raw JSON is durable with endpoint/method/body, HTTP/application status, bytes/hash, collection timestamp, parser identity, row count, row-shape diagnostics, descriptor evidence, and PIT disclaimer;
6. any listing PASS is based on the actual persisted response schema, not an assumed object-only row shape. Coherent structure and descriptor location must be independently reproducible from `source.json`;
7. pagination/completeness claims are limited to observed API evidence; no fictitious pagination/end condition is introduced;
8. detail HTTP method/URL/body is accepted only when deterministic official MOPS evidence is durable. `apiName=t05st01_detail` alone cannot justify guessed URL/method/body;
9. if a detail request ran, it used one observed descriptor, stayed within request budget, and its raw response/meta are durable and pass application/schema quality checks;
10. if detail contract remains unproven, decision is `listing_contract_passed_detail_contract_unproven`; if both listing/detail pass, decision may be `listing_and_detail_contract_passed`; WAF/security/malformed responses remain separate and fail closed;
11. no corrected empty result became terminal source-empty without exact application-success + empty-data evidence;
12. planner remains collection-blocked in this preflight-only round: Wave A=0, Wave C=0, `material_information_authorized=false`;
13. no outcome/holdout/catalyst association/threshold/model/strategy/production behavior was introduced and no current collection timestamp is used as historical PIT proof;
14. the handoff records the closeout and preregisters the correct next paired round before promotion. Only listing+detail PASS may promote a physically batched material-information collection preregistration. Listing PASS/detail unproven may promote only another bounded detail-contract resolution round. Any corrected API failure must remain explicit and must never fall back to obsolete legacy retry.

On PASS, update/commit this routing handoff, promote only the next explicitly preregistered round, do not execute it, end with:
`Prompt B closeout: PASS`
and stop.
```

## Stop conditions

- No production strategy promotion.
- No development outcome or holdout opening.
- No mutation of frozen Phase 2/outcome/association artifacts.
- No catalyst/outcome association.
- No generic-news/analyst substitution.
- No Wave A refetch.
- No Wave C collection during the active preflight round.
- No third legacy retry.
- No guessed detail endpoint/method/body.
