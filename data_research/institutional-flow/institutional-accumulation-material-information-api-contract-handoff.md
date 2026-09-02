# Institutional Accumulation — Material-information API-contract Handoff

Canonical active routing handoff:
`data_research/institutional-flow/institutional-accumulation-material-information-api-contract-handoff.md`

Historical canonical project handoff remains:
`data_research/institutional-flow/institutional-accumulation-validation-handoff.md`

This routing handoff supersedes the obsolete legacy-third-retry route. Completed rounds and frozen methodology remain recoverable from durable repository history.

## Current active round

`institutional-accumulation-material-information-wave-c-physical-batch-collection-v1`

Status:
- Prompt A: **NOT STARTED / ACTIVE**
- Prompt B: **PREREGISTERED / PENDING**

Promotion does not execute Prompt A automatically.

## Frozen boundaries

- Phase 2 semantic SHA-256 remains `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`.
- methodology-development identities remain exactly `41`.
- protected `2454` remains motivation-only and excluded from development/validation outcome tuning.
- stock holdout and time holdout outcomes remain sealed.
- refreshed development outcome SHA-256 remains `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`.
- refreshed association SHA-256 remains `779e2be6708e6d8bc55062058ede6178e2dd4cf7634621d05ab05228c31e7b68`.
- Withdrawal v6.0-v6.5 state is frozen and is not an Accumulation input.
- no binary cutoff, composite score, optimized weighting, model, strategy, production behavior, generic news layer, or outcome-driven catalyst tuning is authorized.
- Wave A monthly-revenue collection is quality-passed and must not be refetched.
- never retry legacy `/mops/web/ajax_t05st01`; its attempt count is frozen at exactly `2`.
- current collection timestamps/API visibility are audit metadata only and never historical PIT proof.
- the active Wave C round may collect only preregistered official MOPS material-information raw evidence and provenance. It must stop before catalyst/outcome association or any outcome opening.

## Closed round — corrected material-information API preflight

Round: `institutional-accumulation-material-information-final-preflight-v1`

**Prompt B closeout: PASS**

Key durable evidence:
- amended pair commit `2d91b842e90d6e76d2812d7589932cc3f7bab066`;
- Prompt A implementation head `eba27e009eea1d43283151b6cc423496ac48b6a4`;
- corrected-preflight writer `dfc9ec6b304d6105f2a058a784703fe4b58e412c`;
- handoff checkpoint `d50da8cadb8b16a43e480a3dd091d7abd3f64712`;
- closeout/promotion checkpoint `dbbf4c4ccc0f482f6dca3639d89809d6da7d847d`.

Closeout decision:
`corrected_listing_application_contract_observed_row_shape_and_detail_contract_unproven`.

## Closed round — row-shape + detail-contract preflight

Round: `institutional-accumulation-material-information-row-shape-detail-contract-preflight-v1`

**Prompt B closeout: PASS**

Preregistered pair commit:
`dbbf4c4ccc0f482f6dca3639d89809d6da7d847d`.

Durable evidence:
- corrected listing writer `94792f1775bdfa60bef67b15a89c6ecbed8b06da`;
- raw listing `data_research/institutional-flow/official-disclosure-raw/mops-material-information/corrected-api-preflight/source.json`;
- listing metadata `data_research/institutional-flow/official-disclosure-raw/mops-material-information/corrected-api-preflight/source-meta.json`;
- canonical preflight `data_research/institutional-flow/official-disclosure-raw/mops-material-information/preflight.json`;
- independent verification run `33602320620`, job `100158570348` — success;
- Prompt A checkpoint `6d9b62e0f53b5b953aae4ef73d4816033867e60c`.

Observed listing contract:
- endpoint `POST https://mops.twse.com.tw/mops/api/t05st01`;
- body `{"companyId":"1102","year":"115","month":"all","firstDay":"","lastDay":""}`;
- HTTP/application `200`, message `查詢成功`;
- `58` coherent array rows, each length `6`;
- all `58` rows carry `t05st01_detail` descriptors;
- no pagination mechanism/end-condition was observed and no unobserved completeness claim was invented.

Closeout decision:
`listing_contract_passed_detail_contract_unproven`.

## Closed round — detail-contract resolution

Round: `institutional-accumulation-material-information-detail-contract-resolution-v1`

**Prompt B closeout: PASS**

### Preregistered identity and Prompt A evidence

Pre-Prompt-A active handoff / paired Prompt A+B commit:
`8d282a80a0485d161ef3211b05507b9e7537beab`.

Prompt A durable commits:
- bounded resolution state `0b63a7c239dd394c97df49394f7a89dbfef33d78`;
- planner fix `b58db4bec1fa32970d1cca9c83be3a409749a529`;
- regression coverage `eaa7e85b9b04cbabc8f20921c37d012d1a6457bb`;
- handoff checkpoint `e770c4afc6ce8028e735bb5fd70437b57ec4d481`.

Prompt A reused the durable listing source and issued no corrected listing request. It used one bounded official frontend/static-contract probe, found no deterministic detail request construction, did not guess a detail endpoint, left detail `unproven`, kept legacy attempt count `2`, and kept Wave A/B/C queues at zero with collection unauthorized.

### Prompt B bounded new evidence and independent verification

The repository owner then supplied directly observed official MOPS browser Network evidence for the first already-durable descriptor:

```text
POST https://mops.twse.com.tw/mops/api/t05st01_detail
{"enterDate":"1150115","serialNumber":"1","companyId":"1102","marketKind":"sii"}
```

This mapped exactly to the first durable listing descriptor:

```text
apiName=t05st01_detail
enterDate=1150115
serialNumber=1
companyId=1102
marketKind=sii
```

A one-off fresh-runner closeout verifier independently reproduced exactly one detail request and checkpointed the response:

- workflow run `33606251855` — **success**;
- job `100170801660` — **success**;
- durable writer commit `f204f26ebd910f7bc6d69c4d394c638941acfa24`;
- raw response `data_research/institutional-flow/official-disclosure-raw/mops-material-information/corrected-api-preflight/detail-source.json`;
- metadata `data_research/institutional-flow/official-disclosure-raw/mops-material-information/corrected-api-preflight/detail-source-meta.json`;
- HTTP `200`, application code `200`, message `查詢成功`;
- final URL `https://mops.twse.com.tw/mops/api/t05st01_detail`;
- response bytes `3312`;
- SHA-256 `dfcdff36648ffc462917adc1caf1486660528078ebe4e19730dd0b21f40f3036`;
- `result.companyId=1102`;
- exactly one observed detail row, length `10`, every cell a string;
- titles exactly `序號, 發言日期, 發言時間, 發言人, 發言人職稱, 發言人電話, 主旨, 符合條款, 事實發生日, 說明`;
- row identity begins with sequence `1`, spoke date `115/01/15`, consistent with the requested descriptor;
- PIT disclaimer explicitly preserves that current collection/API visibility is not proof of historical T0 visibility or immutable historical value version.

Durable `preflight.json` now records:
- `decision=listing_and_detail_contract_passed`;
- `detail_contract.status=passed`;
- `descriptor_mapping_verified=true`;
- legacy `attempt_count=2`, `retryable=true`, `terminal_state=null`;
- corrected listing requests in this round `0`;
- official frontend-contract probes in this round `1`;
- detail requests in this round `1`;
- total repository-controlled network requests in this round `2`, cap `2`;
- `wave_a_refetched=false`;
- `wave_c_ran=false`;
- `material_information_authorized=false` during this contract-only round;
- `collection_time_is_pit_proof=false`.

The two permitted repository-controlled requests occurred in separate Prompt A / Prompt B executions with a substantially longer cooldown than the preregistered `2-5s` adjacent-request jitter window. This is recorded as a conservative over-cooldown rather than a rate-limit safety violation; there was no two-request burst.

A duplicate verifier trigger was accidentally created while the first run was not yet visible through the Actions API. Duplicate run `33606300224`, job `100171307416`, **failed safe before any fetch**: after checkout of current `f204f26...`, its guard observed `total_network_requests_this_round != 1` and threw before reaching the `fetch()` statement. No third detail request ran. The one-off verifier is now inert at `.github/workflows/verify-accumulation-mops-detail-contract-closeout.yml`; inerting commit `bcac270d316e080763654a5d153370ffb20f5347`.

### Prompt B criterion-by-criterion closeout

1. Compare from pre-Prompt-A `8d282a80...` through durable detail verification changed only the bounded preflight state, detail evidence, planner/test fix, this handoff, and the one-off verifier. Protected Phase 2 freeze, refreshed outcome, refreshed association, stock/time holdouts, protected `2454`, and Withdrawal v6.0-v6.5 artifacts were not changed — **PASS**.
2. Legacy attempt count remains exactly `2`; no legacy request ran — **PASS**.
3. Wave A was not refetched; Wave C did not run — **PASS**.
4. The previously durable corrected listing source was reused; corrected listing requests this round remain `0` — **PASS**.
5. Repository-controlled network requests are exactly `2` / cap `2`. They were separated across executions by a longer-than-2-5s conservative cooldown; duplicate trigger failed before `fetch()` and did not create a third request — **PASS with explicit conservative timing variance**.
6. Detail method/URL/body is supported by directly observed official browser Network evidence and maps exactly to the durable descriptor; it was not inferred from `apiName` alone — **PASS**.
7. The fresh runner used the already-observed first descriptor; exact raw/meta are durable with bytes/hash, application/schema diagnostics, timestamp, and PIT disclaimer — **PASS**.
8. Independent fresh-runner reproduction succeeded and verified response quality/schema before checkpoint — **PASS**.
9. No source-empty terminal state was created from security/WAF/malformed/ambiguous responses — **PASS**.
10. During the contract-only round the planner remained blocked: Wave A=`0`, Wave B=`0`, Wave C=`0`, `material_information_authorized=false` — **PASS**.
11. No development outcome/holdout/catalyst association/threshold/model/strategy/production behavior was opened or introduced; current collection time remains audit metadata only — **PASS**.
12. Because both listing and detail contracts are now deterministically PASS, only the separately preregistered physical-batch Wave C collection round below is promoted. It is not executed by this closeout — **PASS**.

Closeout decision:
`listing_and_detail_contract_passed`.

## Current durable MOPS material-information contract

Listing:
- `POST https://mops.twse.com.tw/mops/api/t05st01`;
- request body fields: `companyId`, ROC `year`, `month`, `firstDay`, `lastDay`;
- the verified year query uses `month=all`, blank `firstDay`/`lastDay`;
- listing response is JSON and yields detail descriptors.

Detail:
- `POST https://mops.twse.com.tw/mops/api/t05st01_detail`;
- request body is exactly the descriptor parameter object: `enterDate`, `serialNumber`, `companyId`, `marketKind`;
- verified response is JSON with application success, company identity, 10-column detail row and explicit titles.

Historical/PIT rule:
- source-reported spoke date/time may support official timestamp precision once each record is collected through the verified listing/detail chain;
- current retrieval time/API visibility never proves earlier T0 visibility;
- immutable historical value-version provenance is not assumed; use an explicit version-safety state such as `historical_timing_safe_value_version_unproven` when applicable.

## Next round objective

Execute only the preregistered **Wave C material-information raw-source collection** through true fresh-runner physical batches. The deterministic listing partitions are ROC year `115` for exactly these nine frozen stocks:

```text
1102, 1103, 1104, 1109, 1201, 1203, 1215, 1216, 1217
```

Exact entry points:
- `scripts/plan_institutional_accumulation_official_disclosure_collection.js` — planner; update it to authorize Wave C only from durable listing+detail PASS and committed raw/checkpoint state;
- `scripts/collect_institutional_accumulation_mops_material_information_batch.js` — preregistered material-information batch collector path; create/complete this domain-specific collector;
- `tests/institutional_accumulation_official_disclosure_collection.test.js` — collection/planner regression harness;
- `.github/workflows/collect-institutional-accumulation-official-disclosure.yml` — production fresh-runner physical-batch orchestration;
- `data_research/institutional-flow/official-disclosure-raw/mops-material-information/` — canonical raw/checkpoint root;
- `data_research/institutional-flow/institutional-accumulation-official-disclosure-source-collection-preregistration-v1.md` — frozen source/batching/provenance contract;
- `data_research/institutional-flow/institutional-accumulation-official-disclosure-artifact-reconstruction-v1.json` — exact `33` outcome-blind unresolved identities;
- `data_research/institutional-flow/official-disclosure-raw/mops-material-information/preflight.json` — listing+detail contract PASS gate.

## Prompt A — Wave C physical-batch material-information collection

```text
Continue the Institutional Accumulation / Catalyst Pre-positioning project only if `docs/agent-prompts/task-routing.json` still routes the sole active task to this handoff and round `institutional-accumulation-material-information-wave-c-physical-batch-collection-v1` is still Prompt A NOT STARTED / ACTIVE.

Before work:
1. fetch current remote `main`; do not rely on conversation state;
2. read repository-root `AGENTS.md`, `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, this routing handoff, historical canonical handoff `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`, frozen preregistration `data_research/institutional-flow/institutional-accumulation-official-disclosure-source-collection-preregistration-v1.md`, reconstruction artifact `data_research/institutional-flow/institutional-accumulation-official-disclosure-artifact-reconstruction-v1.json`, current `data_research/institutional-flow/official-disclosure-raw/mops-material-information/preflight.json`, corrected listing/detail preflight raw+meta, `scripts/plan_institutional_accumulation_official_disclosure_collection.js`, `tests/institutional_accumulation_official_disclosure_collection.test.js`, `.github/workflows/collect-institutional-accumulation-official-disclosure.yml`, and `docs/agent-prompts/task-routing.json`;
3. recover this exact Prompt A + Prompt B pair from durable pre-Prompt-A history;
4. independently verify the immediately prior detail-contract round has Prompt B PASS, durable decision `listing_and_detail_contract_passed`, legacy attempt_count exactly 2, Wave A quality-passed, Wave C not previously run, exact unresolved identity count 33, and protected research state unchanged.

Implement and execute only Wave C raw-source collection:
- never request legacy `/mops/web/ajax_t05st01`;
- never refetch Wave A monthly revenue;
- use listing endpoint `POST https://mops.twse.com.tw/mops/api/t05st01` and verified detail endpoint `POST https://mops.twse.com.tw/mops/api/t05st01_detail` only;
- listing partitions are deterministically `(stock, ROC year 115)` for exactly `1102,1103,1104,1109,1201,1203,1215,1216,1217`;
- planner inputs are only the immutable 33 unresolved identities, frozen preregistration, durable preflight PASS, and committed raw/checkpoint state. Do not read outcomes to choose work;
- implement/complete `scripts/collect_institutional_accumulation_mops_material_information_batch.js` as a domain-specific batch worker, not a generic crawler framework;
- true physical listing batch: one company-year partition per fresh GitHub runner, `strategy.max-parallel: 1`, maximum one listing request per runner plus only pagination requests if a pagination mechanism is actually proven. The observed `month=all` contract currently has no pagination mechanism; do not invent one;
- derive detail work deterministically from committed quality-passed listing checkpoints, not from in-memory same-runner loops;
- true physical detail batch: `batch_size=1` detail descriptor/request per fresh runner, `strategy.max-parallel: 1`;
- randomized pre-request jitter `2-5s`; randomized retry/following-physical-batch cooldown `20-60s` where orchestration can enforce it;
- maximum `3` fresh-runner attempts per request key before `manual_review`;
- every runner exits after validating and checkpointing only its bounded key; no one-long-running runner and no same-runner loop across multiple listing partitions or detail records;
- after every physical batch, checkpoint exact raw source and metadata, then re-plan from current remote main; quality-passed keys disappear from the queue and are never refetched;
- on HTTP/security/WAF/shrunken/malformed/ambiguous response, fail closed as retryable; never call it terminal source-empty unless the full application/schema contract provides an exact trustworthy empty result;
- preserve HTTP status/final URL, bytes/SHA-256, exact request key/body, source-reported spoke date/time/sequence, parser identity, quality state, collected_at, version_safety, PIT availability rule, duplicate/incomplete diagnostics, and current-time PIT disclaimer;
- corrections/revisions discovered as separate timestamped official disclosures must be retained rather than overwritten;
- use race-safe bounded writes: fetch latest main at runner start and before push; remote quality-passed artifacts win; on a push race replay only files still absent; `cancel-in-progress:false`; do not use blind add/add-prone rebase patterns;
- do not open development outcomes, stock/time holdout outcomes, or protected 2454 outcomes;
- do not compute catalyst/outcome association, thresholds, scores, weights, models, strategies, or production behavior;
- do not modify Withdrawal v6.0-v6.5 state.

Prompt A completion boundary:
1. Wave C listing/detail collection code, planner, tests, and physical-batch workflow are durable;
2. all work actually attempted by this round is checkpointed on remote main with no green-but-missing artifacts;
3. the deterministic Wave C queues are exhausted for quality-passed/terminal-trustworthy keys, or any remaining keys are explicitly `manual_review` after the maximum three fresh-runner attempts; do not hide incomplete/retryable work;
4. every durable record preserves provenance/PIT/version-safety semantics;
5. no Wave A refetch, no legacy request, and no outcome/catalyst analysis occurred;
6. this handoff records Prompt A COMPLETE / Prompt B pending and preserves the exact Prompt B below;
7. protected research state remains unchanged.

Passing an intermediate listing or detail batch is not Prompt A completion. Continue ordered physical batches/replanning until the completion boundary above is met or a stop condition blocks the round.

When complete, report:
`Prompt A complete — ready for Prompt B`
and stop.
```

## Prompt B — Wave C physical-batch collection closeout

```text
Perform mandatory closeout for round `institutional-accumulation-material-information-wave-c-physical-batch-collection-v1` only after its Prompt A has completed.

Fetch current remote `main`; read `AGENTS.md`, project philosophy/roadmap, this routing handoff, historical canonical handoff, frozen source-collection preregistration, reconstruction artifact, current preflight/listing/detail evidence, planner, material-information batch collector, tests, collection workflow, all Wave C raw/checkpoint artifacts, relevant workflow runs/jobs/logs, and task routing. Recover this exact Prompt B from durable pre-Prompt-A history.

Verify at minimum:
1. protected Phase 2 freeze, refreshed outcome, refreshed association, stock/time holdouts, protected 2454, and Withdrawal v6.0-v6.5 state are unchanged;
2. legacy attempt_count remains exactly 2 and no legacy request ran; Wave A was not refetched;
3. Wave C authorization came only from durable `listing_and_detail_contract_passed` plus the frozen 33-identity preregistration, never from outcome inspection;
4. listing queue was exactly the nine `(stock, ROC year 115)` partitions and each physical listing runner handled at most one partition with `max-parallel:1`; no invented pagination loop ran;
5. detail queue was derived only from committed quality-passed listing checkpoints and each physical detail runner handled exactly one descriptor/request with `max-parallel:1`;
6. request jitter/cooldown/three-attempt ceiling, fresh-runner isolation, re-plan/resume/no-refetch behavior, and `cancel-in-progress:false` are evidenced by workflow/code/logs; any deviation is explicit and must be assessed before PASS;
7. every quality-passed raw/checkpoint artifact exists on current remote main and has exact request identity, HTTP/application status, bytes/hash, schema/row diagnostics, source-reported spoke date/time/sequence, parser identity, quality state, collection timestamp, version_safety, PIT rule/disclaimer; green jobs without remote artifacts fail closeout;
8. security/WAF/shrunken/malformed/ambiguous responses remained retryable and never became false terminal source-empty; terminal negatives, if any, are supported by an exact trustworthy application/schema empty contract;
9. retries never refetched already quality-passed keys; successful later fetch superseded earlier ambiguous failure without deleting audit evidence; push races respected remote completed artifacts;
10. deterministic final planner/coverage accounting reconciles the exact 33 unresolved identities and all Wave C request keys; queues are exhausted except explicitly documented `manual_review` keys at the three-attempt ceiling;
11. no development outcome/holdout/catalyst association/threshold/model/strategy/production behavior was introduced and no current collection timestamp is treated as historical PIT proof;
12. closeout records exact commits, runs/jobs, request/quality counts, retry/manual-review counts and durable artifact paths; only after this PASS may a separately preregistered catalyst-artifact reconstruction/readiness round be promoted.

If any important defect is found, fix only the bounded defect or rerun only the affected physical keys, then restart Prompt B verification from criterion 1. Do not broaden into catalyst analysis.

On PASS, update/commit this routing handoff, preregister and promote only the correct next round, do not execute it, end with:
`Prompt B closeout: PASS`
and stop.
```

## Stop conditions

- No production strategy promotion.
- No development outcome or holdout opening.
- No mutation of frozen Phase 2/outcome/association artifacts.
- No catalyst/outcome association during Wave C collection.
- No generic-news/analyst substitution.
- No Wave A refetch.
- No third legacy retry.
- No guessed endpoint/pagination contract.
- No one-long-running Wave C runner.
- Stop/fail closed on unresolved security/WAF/quality ambiguity, stale frozen identity, or need for outcome inspection.
