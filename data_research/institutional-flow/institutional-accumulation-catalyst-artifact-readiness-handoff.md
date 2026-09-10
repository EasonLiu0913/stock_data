# Institutional Accumulation — Catalyst artifact readiness handoff

Canonical active routing handoff:
`data_research/institutional-flow/institutional-accumulation-catalyst-artifact-readiness-handoff.md`

This file is the canonical routing state for the active Institutional Accumulation / Catalyst Pre-positioning lineage. Older detailed round history remains recoverable from git history; this checkpoint keeps the current durable state concise and executable.

## Frozen project boundaries

- Phase 2 semantic SHA-256 remains `66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`.
- methodology-development identities remain exactly `41`.
- protected `2454` remains motivation-only; its outcomes remain unopened.
- stock/time holdout outcomes remain sealed.
- refreshed development outcome SHA-256 remains `f1c94313a023b420501033b26ce35f90ba8d52c89a0756ce9b6fc42f44a2c59e`.
- refreshed association SHA-256 remains `779e2be6708e6d8bc55062058ede6178e2dd4cf7634621d05ab05228c31e7b68`.
- Withdrawal v6.0-v6.5 remains frozen and is not an Accumulation input.
- no catalyst/outcome association, threshold, score, optimized weighting, model, strategy, production behavior, generic-news layer, or outcome-driven tuning is authorized.
- legacy `/mops/web/ajax_t05st01` attempt count remains frozen at exactly `2`.
- present-day API visibility, collection timestamps, and source event dates alone are never historical PIT/value-version proof.

## Closed prerequisite rounds

### Catalyst artifact reconstruction/readiness

Round: `institutional-accumulation-catalyst-artifact-reconstruction-readiness-v1`

- Prompt A: **COMPLETE**
- Prompt B closeout: **PASS**
- durable result: 33 total identities / 0 ready / 33 `not_pit_ready`;
- Node 24 closeout run `34466672001`, job `102836756516`.

### PIT provenance resolution

Round: `institutional-accumulation-catalyst-pit-provenance-resolution-v1`

- Prompt A: **COMPLETE**
- Prompt B closeout: **PASS**
- durable artifact: `data_research/institutional-flow/institutional-accumulation-catalyst-pit-provenance-resolution-v1.json`;
- frozen result remains `identity_count=33`, `pit_ready=0`, `not_pit_ready=33`, `manual_review=0`;
- `network_collection_used=false`, `source_network_requests=0`, `outcome_blind=true`;
- Node 24 closeout run `34478084243`, job `102873698591`.

### Prospective PIT-safe catalyst capture contract

Round: `institutional-accumulation-catalyst-prospective-pit-capture-contract-v1`

- Prompt A: **COMPLETE**
- Prompt B closeout: **PASS**
- pre-Prompt-A baseline `0d025c6676f3f1675a00f42c808db2d6dfeecfbd`;
- Prompt A checkpoint `8aeac8942d61b43e4a5ea5e33abf416c8f72c5ed`;
- Prompt B closeout/promotion checkpoint `4c782bebffb892540f74d0f5e1bc151065edfb59`;
- Node 24 regression run `34479732345`, job `102879203734`, Node `v24.20.0`, readiness 1/1, PIT provenance 1/1, prospective contract 5/5, all PASS.

Durable contract entry points:
- `scripts/institutional_accumulation_catalyst_prospective_pit_capture_contract.js`;
- `tests/institutional_accumulation_catalyst_prospective_pit_capture_contract.test.js`;
- `data_research/institutional-flow/institutional-accumulation-catalyst-prospective-pit-capture-contract-v1.json`;
- `.github/workflows/test-institutional-accumulation-catalyst-readiness.yml`.

## Closed round — prospective live-capture canary

Round: `institutional-accumulation-catalyst-prospective-live-capture-canary-v1`

Status:
- Prompt A: **COMPLETE**
- **Prompt B closeout: PASS**

Pre-Prompt-A durable baseline:
- `4c782bebffb892540f74d0f5e1bc151065edfb59`.

Prompt A implementation commits:
- `18576518ebbcd016521b754f31c46ec2cae9d7a2` — add domain-specific prospective catalyst live canary collector;
- `8433ce7e19196aac344336aa35b8a14442b021d2` — add zero-network canary regression;
- `bfebc092d543ddd13311b832e361ee3a4ce8c597` — inject test-only sleep adapter while retaining production 20–60 second cooldown;
- `6d5f9d2d21afecb5d5ad95c3d886de283bf4dfe9` — use no-op sleep in zero-network test;
- `87c7acc5bd54fe2563c639ed6800fc3bdba8f9c7` — add dedicated fresh-runner canary workflow;
- `21e80a477fde8679d1f766b4a2dc124159886e9e` — extend bounded Node 24 readiness workflow to cover canary adapter;
- `187945da80824d4a852fa0739f37efdc5d860c04` — bounded test repair for inclusive 60-second cooldown upper bound;
- `3e3ae88163d379e0ccc5f11aa3174ba4046edf11` — trigger preregistered three-stock live canary;
- `55efde4d2b6acb7fdf780a6f475c3b47140343f4` — Prompt A durable handoff checkpoint.

Node 24 zero-network gate:
- initial run `34480920549`, job `102883215878` failed only because the test expected `59999` rather than the valid inclusive `60000` upper bound; no live request had started;
- bounded repair commit `187945da80824d4a852fa0739f37efdc5d860c04` changed only the expectation;
- successful run `34481090029`, job `102883774145`, tested SHA `187945da80824d4a852fa0739f37efdc5d860c04`, Node `v24.20.0`;
- readiness `1/1`, historical PIT provenance `1/1`, prospective PIT contract `5/5`, prospective canary adapter `6/6`, all PASS;
- degraded, malformed, application-failure and out-of-preregistration fixtures fail before snapshot creation;
- fake-fetch test uses no-op sleep and zero network while production collector retains randomized 20–60 second pre-request cooldown.

Live canary evidence:
- workflow `.github/workflows/collect-institutional-accumulation-catalyst-prospective-canary.yml`;
- run `34481151262`;
- exactly three independent fresh-runner matrix jobs with `max-parallel: 1`;
- exactly preregistered stocks `1102`, `1104`, `1216` and no others;
- only official MOPS `POST /mops/api/t05st01` and `POST /mops/api/t05st01_detail`;
- each stock used one listing request and one verified-detail request;
- total repository-controlled requests exactly `6 / 6` cap;
- no tight retry loop, legacy endpoint, historical range/backfill, Wave A refetch, or Wave C rewrite.

Durable job/checkpoint evidence:
- `1102`: job `102883992555`, requests `2`, snapshots `2`, checkpoint `224e5574f0f7adad2d33890f4948388b97685979`;
- `1104`: job `102883992117`, requests `2`, snapshots `2`, checkpoint `7122ab57a5a8947b5a7a15bcf223b25caf48145c`;
- `1216`: job `102883992512`, requests `2`, snapshots `2`, checkpoint `f71ab6e689ce18d3655fe64ba462555398654703`.

Accepted prospective snapshots:
- `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/prospective_material_information_listing/1102_115_all/20260910T131236863Z--0e5de2e07f85ea7cd3bff45f99fb9f19342feef3e7cfc5998bf8254329693851.json`;
- `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/prospective_material_information_detail/1102_1150115_1_sii/20260910T131322218Z--26ffb7f87af3f023fbb98ea7ba9f3cc1b54170bccedf11c1a21bd2486d149e8c.json`;
- `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/prospective_material_information_listing/1104_115_all/20260910T131445723Z--75f4d44b45282d9f089d60fc671f029f4dd45fe2e948110687ee0ad0a6dea155.json`;
- `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/prospective_material_information_detail/1104_1150113_1_sii/20260910T131535098Z--9f5c34d4c53d6e51ddd33fab7018977faa95e4a798d7069e37ba662753dc6561.json`;
- `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/prospective_material_information_listing/1216_115_all/20260910T131622449Z--d800e353f5b1694e68038508277fc20486f8d73fc58a23807231b235140725f7.json`;
- `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/prospective_material_information_detail/1216_1150109_1_sii/20260910T131719439Z--25a623c03b29c52a7c9cd88c0fc6d4239ccf50340086e81bb9a27ab75d937eb7.json`.

Prompt B independent closeout verification:
1. `docs/agent-prompts/task-routing.json` still has the sole active task `institutional-accumulation` and routes it to this handoff — **PASS**.
2. Exact phase Prompt B was recovered from the durable pre-Prompt-A handoff at baseline `4c782bebffb892540f74d0f5e1bc151065edfb59` — **PASS**.
3. Prior prospective PIT-safe capture-contract round still has durable Prompt B PASS — **PASS**.
4. Current historical PIT provenance artifact remains exactly `identity_count=33`, `pit_ready=0`, `not_pit_ready=33`, `manual_review=0`, `network_collection_used=false`, `source_network_requests=0`, `outcome_blind=true`, with protected outcome/holdout/association flags false — **PASS**.
5. Current canary workflow hard-codes matrix stocks `1102`, `1104`, `1216`, `max-parallel: 1`, per-stock request count <=2, independent bounded checkpointing, remote durable verification, and historical-PIT preflight — **PASS**.
6. Live run `34481151262` has exactly three successful jobs (`102883992555`, `102883992117`, `102883992512`), each `2 requests / 2 snapshots`, total `6 requests / 6 snapshots` — **PASS**.
7. Checkpoint sequence proves race-safe behavior against moving `main`: `224e5574` then `7122ab57` then `f71ab6e6`; each later job refetched current main and re-applied only its bounded immutable candidates; conflicting existing bytes are fail-closed — **PASS**.
8. All six snapshot files are durable on remote main and workflow remote verification checked contract ID, methodology identity, `pit_known_at=collected_at`, 64-hex `response_sha256` / `immutable_snapshot_id`, and `historical_back_imputation_allowed=false`; direct inspection confirms raw response bytes are retained base64-encoded — **PASS**.
9. Zero-network regression run `34481090029` reproduces collector/contract invariants and specifically rejects degraded/malformed/application-failure responses before snapshot creation — **PASS**.
10. Bounded changed-file comparison from `4c782beb...` through Prompt A head `55efde4d...` contains exactly the expected 12 paths: collector, collector test, canary workflow, readiness workflow extension, trigger, canonical handoff, and six prospective snapshots. No protected Phase 2, outcome, holdout, association, Withdrawal, historical Wave A, or historical Wave C path changed — **PASS**.
11. No threshold, score, optimized weighting, model, strategy, production behavior, generic-news layer, historical identity upgrade, or legacy `/mops/web/ajax_t05st01` retry was introduced — **PASS**.

Closeout limitation:
- this validates one bounded three-stock live capture window and durable prospective PIT semantics only. It does not validate longitudinal observation quality, broad-universe capture, scheduled automation, historical backfill, or catalyst/outcome association.

**Prompt B closeout: PASS**

## Current active round

`institutional-accumulation-catalyst-prospective-observation-audit-v1`

Status:
- Prompt A: **NOT STARTED / ACTIVE**
- Prompt B: **PREREGISTERED / PENDING**

Promotion does not execute Prompt A automatically.

## Next round objective

Before any scheduled or broader live rollout, turn the six real prospective canary snapshots into a deterministic, zero-network, machine-readable observation audit. The audit must prove that prospective observations can be enumerated, hash-validated, grouped by stock/interface, and rejected fail-closed when duplicate/conflicting/malformed identity or PIT metadata is present. This remains evidence plumbing only: no outcomes, association, scoring, thresholds, strategy, broad crawl, or new MOPS requests.

Exact entry points:
- `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/` — six real prospective canary snapshots;
- `scripts/institutional_accumulation_catalyst_prospective_pit_capture_contract.js` — canonical immutable snapshot validator;
- `scripts/collect_institutional_accumulation_catalyst_prospective_canary.js` — live collector serialization semantics;
- `tests/institutional_accumulation_catalyst_prospective_pit_capture_contract.test.js` — immutable contract regression;
- `tests/institutional_accumulation_catalyst_prospective_canary.test.js` — collector adapter regression;
- `.github/workflows/test-institutional-accumulation-catalyst-readiness.yml` — bounded Node 24 zero-network gate;
- `data_research/institutional-flow/institutional-accumulation-catalyst-pit-provenance-resolution-v1.json` — frozen historical 33 limitation evidence;
- `docs/agent-prompts/task-routing.json` — global routing source of truth;
- repository-root `AGENTS.md` — mandatory evidence-first, crawl-safety and paired-prompt rules.

## Prompt A — prospective observation audit

```text
Continue the Institutional Accumulation / Catalyst Pre-positioning project only if `docs/agent-prompts/task-routing.json` still routes the sole active task to `data_research/institutional-flow/institutional-accumulation-catalyst-artifact-readiness-handoff.md` and round `institutional-accumulation-catalyst-prospective-observation-audit-v1` remains Prompt A NOT STARTED / ACTIVE.

Before work:
1. fetch current remote `main` and read repository-root `AGENTS.md`;
2. read `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, `docs/agent-prompts/task-routing.json`, this canonical handoff, `data_research/institutional-flow/institutional-accumulation-catalyst-pit-provenance-resolution-v1.json`, `scripts/institutional_accumulation_catalyst_prospective_pit_capture_contract.js`, `scripts/collect_institutional_accumulation_catalyst_prospective_canary.js`, `tests/institutional_accumulation_catalyst_prospective_pit_capture_contract.test.js`, `tests/institutional_accumulation_catalyst_prospective_canary.test.js`, and `.github/workflows/test-institutional-accumulation-catalyst-readiness.yml`;
3. recover this exact Prompt A + Prompt B pair from durable pre-Prompt-A history;
4. independently verify the preceding live-capture canary round has durable Prompt B PASS and historical 33/protected state remains frozen.

Objective: create a deterministic zero-network audit over the checked-in prospective snapshot root, using the proven immutable contract as the source of truth.

Implementation requirements:
- add domain-specific audit code, preferred path `scripts/audit_institutional_accumulation_catalyst_prospective_observations.js`;
- add zero-network regression, preferred path `tests/institutional_accumulation_catalyst_prospective_observations.test.js`;
- emit a machine-readable audit artifact at `data_research/institutional-flow/institutional-accumulation-catalyst-prospective-observation-audit-v1.json`;
- enumerate only files under `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/` and validate each accepted snapshot through the existing contract validator rather than reimplementing conflicting PIT semantics;
- record deterministic counts by stock and source interface, unique immutable snapshot IDs, unique response hashes, collection-time range, exact source paths, methodology identities, and invalid/conflict counts;
- for the current checked-in baseline, require exactly six valid observations across exactly stocks `1102`, `1104`, `1216`, with one listing and one detail observation per stock; fail closed rather than silently normalizing unexpected files;
- validate raw base64 bytes against `response_bytes` and `response_sha256`, require `pit_known_at=collected_at`, `historical_back_imputation_allowed=false`, and the expected prospective methodology identity;
- fixture tests must prove malformed JSON, hash mismatch, invalid base64/length, duplicate immutable identity with conflicting content, unexpected stock/interface, and invalid PIT metadata fail closed;
- extend `.github/workflows/test-institutional-accumulation-catalyst-readiness.yml` to run the new audit regression and regenerate/compare the audit deterministically with zero network access;
- commit the generated audit artifact only if the deterministic audit passes.

Frozen/safety rules:
- zero source-network requests in this round; do not invoke either live MOPS endpoint;
- no historical backfill, no historical 33 identity upgrade/rewrite, no Wave A/Wave C refetch or mutation;
- never retry legacy `/mops/web/ajax_t05st01`;
- do not open development outcomes, stock/time holdouts, protected `2454`, future returns, catalyst/outcome association, or Withdrawal state;
- no thresholds, scores, optimized weights, model, strategy, production behavior, scheduler, broad-universe rollout, or generic-news layer.

Completion contract:
- audit script, zero-network regression, workflow coverage, and machine-readable audit artifact are durable on current remote `main`;
- Node 24 gate passes at the exact tested SHA and performs zero network requests;
- current audit reports exactly six valid prospective observations, three stocks, listing/detail pair per stock, zero invalid/conflict observations, and reproducible source/hash identities;
- historical 33/protected state remains unchanged;
- record exact commits, workflow run/job IDs, tested SHA, audit counts/hash and limitations in this handoff;
- preserve this same preregistered Prompt B;
- stop with `Prompt A complete — ready for Prompt B.` Do not execute Prompt B.
```

## Prompt B — prospective observation audit closeout

```text
Perform mandatory closeout for `institutional-accumulation-catalyst-prospective-observation-audit-v1` only after its Prompt A completes. Fetch current remote `main` and recover this exact Prompt B from durable pre-Prompt-A history. Independently verify: sole active routing still points to this handoff; the preceding live-capture canary round has durable Prompt B PASS; historical 33 identities remain exactly 0 pit_ready / 33 not_pit_ready and protected outcome/holdout/association state remains unopened; this round made zero MOPS/source-network requests and did not retry the legacy endpoint; the audit implementation uses the existing prospective PIT contract validator as source of truth; the generated machine-readable audit exists durably and deterministically enumerates exactly six valid checked-in observations across exactly stocks 1102, 1104, 1216 with one listing and one detail per stock, zero invalid/conflict observations, exact source paths, immutable snapshot IDs, response SHA-256 identities and collection-time range; raw base64 bytes/length/hash, pit_known_at=collected_at, methodology identity and historical_back_imputation_allowed=false are validated; fixture regressions fail closed for malformed JSON, hash/byte mismatch, duplicate immutable identity with conflicting content, unexpected stock/interface and invalid PIT metadata; Node 24 zero-network workflow passes at the recorded tested SHA and deterministic regeneration matches the committed audit; compare the bounded changed-file set against the pre-Prompt-A baseline and confirm no protected Phase 2, historical Wave A/Wave C, outcome, holdout, association, Withdrawal, model/strategy/production/scheduler paths changed. Fix only bounded defects and restart verification. On PASS record exact commits/runs/jobs/tested SHA/audit identity/limitations, promote only a justified next preregistered round, end `Prompt B closeout: PASS`, and stop without executing the promoted Prompt A.
```

## Stop conditions

- Do not execute the promoted Prompt A automatically.
- Do not reopen or upgrade the historical 33 identities.
- Do not open protected outcomes, holdouts, association, or Withdrawal state.
- Do not mutate frozen Phase 2/outcome/association artifacts.
- Do not introduce catalyst/outcome association, thresholds, scores, models, strategies, production behavior, scheduler, broad-universe rollout, or generic-news features.
- Do not retry the legacy endpoint.
- Fail closed whenever PIT/value-version proof, immutable content identity, or observation validity is unresolved.
