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
- current frozen result remains `identity_count=33`, `pit_ready=0`, `not_pit_ready=33`, `manual_review=0`;
- `network_collection_used=false`, `source_network_requests=0`, `outcome_blind=true`;
- Node 24 closeout run `34478084243`, job `102873698591`.

### Prospective PIT-safe catalyst capture contract

Round: `institutional-accumulation-catalyst-prospective-pit-capture-contract-v1`

- Prompt A: **COMPLETE**
- Prompt B closeout: **PASS**
- pre-Prompt-A baseline `0d025c6676f3f1675a00f42c808db2d6dfeecfbd`;
- implementation commits `96319a7636e99584a935fe043d7acdcf305fb153`, `3ed6f6f7c0b66209af9880a62426f14fb311523a`, `57046dce6c00167003e39a8d01f3ecbc517f4232`, `a9d68a9ec0855b8413b636940f09ed87b0033247`;
- Prompt A checkpoint `8aeac8942d61b43e4a5ea5e33abf416c8f72c5ed`;
- Prompt B closeout/promotion checkpoint `4c782bebffb892540f74d0f5e1bc151065edfb59`;
- Node 24 regression run `34479732345`, job `102879203734`, Node `v24.20.0`, readiness 1/1, PIT provenance 1/1, prospective contract 5/5, all PASS.

Durable contract entry points:
- `scripts/institutional_accumulation_catalyst_prospective_pit_capture_contract.js`;
- `tests/institutional_accumulation_catalyst_prospective_pit_capture_contract.test.js`;
- `data_research/institutional-flow/institutional-accumulation-catalyst-prospective-pit-capture-contract-v1.json`;
- `.github/workflows/test-institutional-accumulation-catalyst-readiness.yml`.

Contract invariants remain append-only immutable raw-response capture, SHA-256 content identity, parser/methodology identity, `pit_known_at=collected_at`, no historical back-imputation, identical rerun as no-op, and same-path conflicting content as fail-closed.

## Current round

`institutional-accumulation-catalyst-prospective-live-capture-canary-v1`

Status:
- Prompt A: **COMPLETE**
- Prompt B: **PREREGISTERED / PENDING**

Pre-Prompt-A durable baseline:
- `4c782bebffb892540f74d0f5e1bc151065edfb59`.

### Prompt A implementation

Durable implementation commits:
- `18576518ebbcd016521b754f31c46ec2cae9d7a2` — add domain-specific prospective catalyst live canary collector;
- `8433ce7e19196aac344336aa35b8a14442b021d2` — add zero-network canary regression;
- `bfebc092d543ddd13311b832e361ee3a4ce8c597` — inject test-only sleep adapter while keeping production 20–60 second cooldown;
- `6d5f9d2d21afecb5d5ad95c3d886de283bf4dfe9` — use no-op sleep in zero-network test;
- `87c7acc5bd54fe2563c639ed6800fc3bdba8f9c7` — add dedicated fresh-runner canary workflow;
- `21e80a477fde8679d1f766b4a2dc124159886e9e` — extend bounded Node 24 readiness workflow to cover canary adapter;
- `187945da80824d4a852fa0739f37efdc5d860c04` — bounded test-only repair for inclusive 60-second cooldown upper bound;
- `3e3ae88163d379e0ccc5f11aa3174ba4046edf11` — trigger the preregistered three-stock live canary.

Durable implementation entry points:
- `scripts/collect_institutional_accumulation_catalyst_prospective_canary.js`;
- `tests/institutional_accumulation_catalyst_prospective_canary.test.js`;
- `.github/workflows/collect-institutional-accumulation-catalyst-prospective-canary.yml`;
- `.github/workflows/test-institutional-accumulation-catalyst-readiness.yml`;
- `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/`.

### Zero-network regression gate

Initial Node 24 run:
- run `34480920549`, job `102883215878` — **FAIL**;
- failure was bounded to a test expectation: `boundedCooldownMs(() => 0.999999)` legitimately produced inclusive upper bound `60000`, while the test expected `59999`;
- no live MOPS request was started before this gate passed.

Bounded repair:
- commit `187945da80824d4a852fa0739f37efdc5d860c04` updated only the test expectation to accept the preregistered inclusive 20–60 second range.

Successful Node 24 gate:
- run `34481090029`;
- job `102883774145` (`regression`) — **SUCCESS**;
- Node `v24.20.0`;
- readiness, historical PIT provenance, prospective PIT contract, and prospective canary adapter regressions all passed;
- canary fake-fetch tests use an injected no-op sleep and issue zero network requests; production collector still defaults to randomized 20–60 second pre-request cooldown.

### Live canary execution

Workflow:
- `.github/workflows/collect-institutional-accumulation-catalyst-prospective-canary.yml`;
- run `34481151262` — three independent matrix jobs, `max-parallel: 1`;
- only preregistered stocks `1102`, `1104`, `1216` ran;
- only official MOPS `POST /mops/api/t05st01` and `POST /mops/api/t05st01_detail` were used;
- each stock performed exactly one listing request and one verified-detail request;
- total repository-controlled requests: exactly `6 / 6` maximum;
- no retry loop, no legacy endpoint, no historical range/backfill.

Jobs and durable checkpoints:

#### 1102
- job `102883992555` — **SUCCESS**;
- requests `2`, snapshots `2`;
- checkpoint commit `224e5574f0f7adad2d33890f4948388b97685979`;
- listing snapshot: `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/prospective_material_information_listing/1102_115_all/20260910T131236863Z--0e5de2e07f85ea7cd3bff45f99fb9f19342feef3e7cfc5998bf8254329693851.json`;
- detail snapshot: `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/prospective_material_information_detail/1102_1150115_1_sii/20260910T131322218Z--26ffb7f87af3f023fbb98ea7ba9f3cc1b54170bccedf11c1a21bd2486d149e8c.json`.

#### 1104
- job `102883992117` — **SUCCESS**;
- requests `2`, snapshots `2`;
- checkpoint commit `7122ab57a5a8947b5a7a15bcf223b25caf48145c`;
- listing snapshot: `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/prospective_material_information_listing/1104_115_all/20260910T131445723Z--75f4d44b45282d9f089d60fc671f029f4dd45fe2e948110687ee0ad0a6dea155.json`;
- detail snapshot: `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/prospective_material_information_detail/1104_1150113_1_sii/20260910T131535098Z--9f5c34d4c53d6e51ddd33fab7018977faa95e4a798d7069e37ba662753dc6561.json`.

#### 1216
- job `102883992512` — **SUCCESS**;
- requests `2`, snapshots `2`;
- checkpoint commit `f71ab6e689ce18d3655fe64ba462555398654703`;
- listing snapshot: `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/prospective_material_information_listing/1216_115_all/20260910T131622449Z--d800e353f5b1694e68038508277fc20486f8d73fc58a23807231b235140725f7.json`;
- detail snapshot: `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/prospective_material_information_detail/1216_1150109_1_sii/20260910T131719439Z--25a623c03b29c52a7c9cd88c0fc6d4239ccf50340086e81bb9a27ab75d937eb7.json`.

All six accepted snapshots passed durable remote verification for:
- prospective PIT contract ID;
- methodology identity `institutional-accumulation-catalyst-prospective-live-capture-canary-v1`;
- `pit_known_at === collected_at`;
- 64-hex `response_sha256` and `immutable_snapshot_id`;
- `historical_back_imputation_allowed=false`.

The three physical jobs checkpointed sequentially against moving `main`: 1102 first, 1104 refetched/rebased its bounded candidate set on the 1102 checkpoint, and 1216 did the same on the 1104 checkpoint. The workflow compares any existing remote immutable path byte-for-byte and fails closed on conflicting content; no overwrite conflict occurred.

Response-quality behavior is fail-closed before snapshot creation for HTTP failure, degraded/WAF/security response, malformed JSON, application contract failure, listing schema/descriptor mismatch, and detail schema/title/identity mismatch. No degraded or ambiguous response was accepted in this live run.

### Protected-state confirmation

- historical PIT artifact remains exactly 33 identities / `0 pit_ready` / `33 not_pit_ready` and outcome-blind;
- no historical 33 identity was upgraded or rewritten;
- historical Wave A/Wave C raw stores were not refetched or mutated by this canary;
- legacy `/mops/web/ajax_t05st01` was not retried;
- development outcomes, stock/time holdouts, protected `2454` outcomes, future-return data, catalyst/outcome association, and Withdrawal state remained unopened/unchanged;
- no threshold, score, optimized weighting, model, strategy, production behavior, or generic-news layer was introduced.

### Prompt A limitation

This round proves only a bounded three-stock current/future live capture path and immutable durable checkpoint behavior. It does not authorize historical backfill, broad-universe collection, scheduled production rollout, historical identity upgrade, or any catalyst/outcome association.

Prompt A completion boundary reached. The exact preregistered Prompt B below remains pending and has not been executed automatically.

## Prompt B — prospective live-capture canary closeout

```text
Perform mandatory closeout for `institutional-accumulation-catalyst-prospective-live-capture-canary-v1` only after its Prompt A completes. Fetch current remote `main` and recover this exact Prompt B from durable pre-Prompt-A history. Independently verify: sole active routing still points to this handoff; prior prospective PIT contract round remains Prompt B PASS; historical 33 identities remain exactly 0 pit_ready / 33 not_pit_ready; the canary used only official `t05st01` / `t05st01_detail`; exactly stocks 1102, 1104, 1216 were preregistered and no other stock was requested; each stock ran as an independent fresh-runner physical job with max-parallel 1; total repository-controlled requests were <=6 with one listing and at most one detail per stock and bounded 20-60s pre-request cooldown; no legacy endpoint, historical backfill, Wave A refetch, or historical Wave C rewrite occurred; every accepted prospective snapshot under `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/` preserves raw bytes, SHA-256, collection timestamp, parser/methodology identity, immutable snapshot identity, append-only/non-overwrite behavior, and pit_known_at equal to collected_at; degraded/ambiguous/WAF/malformed/schema-invalid responses never became PIT-safe snapshots; bounded checkpoint logic is race-safe and remote immutable identity conflicts fail closed; Node 24 zero-network regression reproduces collector/contract invariants; development outcomes, holdouts, protected 2454, catalyst/outcome association, Withdrawal, thresholds/scores/models/strategies/production behavior remain unopened/unchanged. Compare the bounded changed-file set against the pre-Prompt-A baseline and verify all required files and live snapshot outputs are durable on current remote main. Fix only bounded defects and restart verification. On PASS record exact commits/runs/jobs/request counts/snapshot hashes/limitations, promote only a justified next preregistered round, end `Prompt B closeout: PASS`, and stop without executing the promoted Prompt A.
```

## Stop conditions

- Do not execute Prompt B automatically.
- Do not promote or execute a future Prompt A before this Prompt B passes.
- Do not reopen or upgrade the historical 33 identities.
- Do not open protected outcomes, holdouts, association, or Withdrawal state.
- Do not mutate frozen Phase 2/outcome/association artifacts.
- Do not introduce catalyst/outcome association, thresholds, scores, models, strategies, production behavior, or generic-news features.
- Do not retry the legacy endpoint.
- Fail closed whenever PIT/value-version proof or response quality is unresolved.
