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

## Closed round — catalyst artifact reconstruction/readiness

Round: `institutional-accumulation-catalyst-artifact-reconstruction-readiness-v1`

Status:
- Prompt A: **COMPLETE**
- Prompt B closeout: **PASS**

Durable evidence:
- 33 total identities / 0 ready / 33 `not_pit_ready`;
- Node 24 closeout run `34466672001`, job `102836756516`.

## Closed round — PIT provenance resolution

Round: `institutional-accumulation-catalyst-pit-provenance-resolution-v1`

Status:
- Prompt A: **COMPLETE**
- Prompt B closeout: **PASS**

Durable evidence:
- `data_research/institutional-flow/institutional-accumulation-catalyst-pit-provenance-resolution-v1.json`;
- audit result remains `identity_count=33`, `pit_ready=0`, `not_pit_ready=33`, `manual_review=0`;
- `network_collection_used=false`, `source_network_requests=0`, `outcome_blind=true`;
- Node 24 closeout run `34478084243`, job `102873698591`;
- no historical identity may be positively imputed from present-day source visibility, collection time, or source event date.

## Closed round — prospective PIT-safe catalyst capture contract

Round: `institutional-accumulation-catalyst-prospective-pit-capture-contract-v1`

Status:
- Prompt A: **COMPLETE**
- **Prompt B closeout: PASS**

Pre-Prompt-A durable handoff checkpoint used to recover the exact preregistered Prompt B:
- baseline `0d025c6676f3f1675a00f42c808db2d6dfeecfbd`.

Prompt A implementation commits:
- `96319a7636e99584a935fe043d7acdcf305fb153` — prospective PIT capture implementation;
- `3ed6f6f7c0b66209af9880a62426f14fb311523a` — zero-network contract tests;
- `57046dce6c00167003e39a8d01f3ecbc517f4232` — machine-readable contract;
- `a9d68a9ec0855b8413b636940f09ed87b0033247` — bounded Node 24 workflow coverage;
- `8aeac8942d61b43e4a5ea5e33abf416c8f72c5ed` — Prompt A handoff checkpoint.

Durable outputs:
- `scripts/institutional_accumulation_catalyst_prospective_pit_capture_contract.js`;
- `tests/institutional_accumulation_catalyst_prospective_pit_capture_contract.test.js`;
- `data_research/institutional-flow/institutional-accumulation-catalyst-prospective-pit-capture-contract-v1.json`;
- `.github/workflows/test-institutional-accumulation-catalyst-readiness.yml`.

### Prompt B independent closeout evidence

The exact Prompt B was recovered from the pre-Prompt-A baseline `0d025c6676f3f1675a00f42c808db2d6dfeecfbd` before closeout.

Criterion-by-criterion verification:

1. Sole global active routing remains `institutional-accumulation`, pointing to this handoff — **PASS**.
2. Prior PIT-resolution round remains durable PASS; current PIT artifact still reports exactly 33 identities, `0 pit_ready`, `33 not_pit_ready`, `0 manual_review`, zero network collection and outcome-blind state — **PASS**.
3. Prospective capture implementation binds source identity, collection timestamp, raw-response SHA-256, parser version, and methodology identity into `immutable_snapshot_id` — **PASS**.
4. Raw response bytes are preserved as base64 and re-hashed on validation; hash/byte mismatch fails closed — **PASS**.
5. `pit_known_at` is exactly `collected_at`; source-reported timing and present-day visibility cannot move known-at earlier — **PASS**.
6. Storage semantics are append-only: identical deterministic rerun is an idempotent no-op, while an existing-path content collision fails instead of overwriting — **PASS**.
7. The machine-readable contract explicitly records forward-only scope, zero-network validation, no historical reopen, no outcomes, append-only storage, and fail-closed PIT semantics — **PASS**.
8. Prompt A performed no live canary and no broad backfill, so there were zero new MOPS requests and no physical-batch safety exposure — **PASS**.
9. Legacy `/mops/web/ajax_t05st01` was not retried — **PASS**.
10. Bounded change review from `0d025c6676f3f1675a00f42c808db2d6dfeecfbd` through `8aeac8942d61b43e4a5ea5e33abf416c8f72c5ed` is exactly five paths: this handoff, the prospective implementation, its test, its machine-readable contract, and the bounded readiness workflow. No protected Phase 2, outcome, holdout, association, Withdrawal, Wave A raw, Wave C raw, or historical 33 identity artifact changed — **PASS**.
11. Node 24 workflow `test: institutional accumulation catalyst readiness`, run `34479732345`, job `102879203734`, tested SHA `a9d68a9ec0855b8413b636940f09ed87b0033247`, Node `v24.20.0` reproduced readiness `1/1`, PIT provenance `1/1`, and prospective contract `5/5`, all with zero failures and no source-fetch stage — **PASS**.
12. Required implementation/test/contract/workflow outputs exist durably on current remote `main` and match the contract markers above — **PASS**.

Closeout limitation:
- this round proves the forward-only immutable capture contract itself, not live-source integration. No claim is made yet that a production or scheduled collector is writing prospective snapshots.

**Prompt B closeout: PASS**

## Current active round

`institutional-accumulation-catalyst-prospective-live-capture-canary-v1`

Status:
- Prompt A: **NOT STARTED / ACTIVE**
- Prompt B: **PREREGISTERED / PENDING**

Promotion does not execute Prompt A automatically.

## Next round objective

Wire the proven prospective PIT capture contract into the smallest real forward-only MOPS collection canary. Validate that actual future listing/detail responses can be checkpointed under the immutable prospective snapshot contract without changing the historical Wave C store and without opening outcomes.

The canary is deliberately small: exactly three preregistered non-protected stocks `1102`, `1104`, `1216`, each in its own fresh-runner physical job, `max-parallel: 1`. One listing request per stock is permitted; at most one verified detail descriptor per stock may be fetched if needed to prove detail wiring. Maximum repository-controlled live requests for this round is therefore `6`. No historical range/backfill is authorized.

Exact entry points:
- `scripts/institutional_accumulation_catalyst_prospective_pit_capture_contract.js` — immutable prospective snapshot builder/validator/writer;
- `data_research/institutional-flow/institutional-accumulation-catalyst-prospective-pit-capture-contract-v1.json` — machine-readable PIT contract;
- `scripts/collect_institutional_accumulation_mops_material_information_batch.js` — verified MOPS listing/detail request and response-quality reference; do not reuse its historical output path for prospective snapshots;
- `.github/workflows/collect-institutional-accumulation-official-disclosure.yml` — reference for fresh-runner physical-job, `max-parallel: 1`, cooldown and race-safe checkpoint patterns;
- `.github/workflows/test-institutional-accumulation-catalyst-readiness.yml` — existing zero-network Node 24 regression;
- `tests/institutional_accumulation_catalyst_prospective_pit_capture_contract.test.js` — existing contract regression;
- `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/` — canonical forward-only snapshot root;
- `data_research/institutional-flow/institutional-accumulation-catalyst-pit-provenance-resolution-v1.json` — frozen historical 33 limitation evidence;
- `docs/agent-prompts/task-routing.json` — global routing source of truth;
- repository-root `AGENTS.md` — mandatory crawl-safety, physical-batch, checkpoint and paired-prompt rules.

## Prompt A — prospective live-capture canary

```text
Continue the Institutional Accumulation / Catalyst Pre-positioning project only if `docs/agent-prompts/task-routing.json` still routes the sole active task to `data_research/institutional-flow/institutional-accumulation-catalyst-artifact-readiness-handoff.md` and round `institutional-accumulation-catalyst-prospective-live-capture-canary-v1` remains Prompt A NOT STARTED / ACTIVE.

Before work:
1. fetch current remote `main` and read repository-root `AGENTS.md`;
2. read `docs/project-philosophy.md`, `docs/roadmap/current-phase.md`, `docs/agent-prompts/task-routing.json`, this canonical handoff, `data_research/institutional-flow/institutional-accumulation-catalyst-prospective-pit-capture-contract-v1.json`, `scripts/institutional_accumulation_catalyst_prospective_pit_capture_contract.js`, `scripts/collect_institutional_accumulation_mops_material_information_batch.js`, `.github/workflows/collect-institutional-accumulation-official-disclosure.yml`, `.github/workflows/test-institutional-accumulation-catalyst-readiness.yml`, and the frozen PIT provenance artifact;
3. recover this exact Prompt A + Prompt B pair from durable pre-Prompt-A history;
4. independently verify the prospective PIT contract round has durable Prompt B PASS, historical 33 identities remain `0 pit_ready / 33 not_pit_ready`, and protected outcome/holdout/association state remains unopened.

Objective: implement and execute the smallest real forward-only live canary that writes current/future MOPS listing/detail responses through the prospective immutable snapshot contract.

Implementation requirements:
- create a domain-specific prospective collector rather than modifying historical Wave C artifacts in place; preferred exact new path is `scripts/collect_institutional_accumulation_catalyst_prospective_canary.js`;
- create a dedicated fresh-runner canary workflow at `.github/workflows/collect-institutional-accumulation-catalyst-prospective-canary.yml`;
- use only the already verified official MOPS endpoints `POST https://mops.twse.com.tw/mops/api/t05st01` and, when needed, `POST https://mops.twse.com.tw/mops/api/t05st01_detail`;
- preregister exactly stocks `1102`, `1104`, `1216`; each stock must run in a separate fresh-runner physical matrix job with `max-parallel: 1`;
- permit exactly one listing request per stock and at most one detail request per stock; total repository-controlled request cap is `6`;
- use a bounded randomized cooldown of at least 20-60 seconds before each live request; no tight retry loop;
- write successful observations only under `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/` using the proven append-only writer;
- verify raw bytes/hash, source identity, collection timestamp, parser/methodology identity, `pit_known_at=collected_at`, and immutable snapshot identity before checkpoint;
- after each stock physical job, checkpoint only that bounded snapshot set with race-safe fetch/reset/reapply behavior; remote immutable snapshot wins on exact identity; any conflicting content must fail closed;
- failed, malformed, WAF/security, ambiguous, or schema-invalid responses must not become PIT-safe snapshots; persist only bounded diagnostics if needed and do not infer `source_empty` from degraded responses;
- extend zero-network regression to cover the live collector's serialization/checkpoint adapter without making network calls in CI.

Frozen/safety rules:
- no historical backfill or historical 33 identity upgrade/rewrite;
- never retry legacy `/mops/web/ajax_t05st01`;
- do not refetch or mutate historical Wave A/Wave C raw evidence merely to satisfy this canary;
- do not open development outcomes, stock/time holdouts, protected `2454` outcomes, future-return data, catalyst/outcome association, or Withdrawal state;
- no thresholds, scores, optimized weights, model, strategy, production behavior, or generic-news layer.

Completion contract:
- dedicated prospective collector/workflow and zero-network regression are durable on remote `main`;
- a live canary runs for no more than the three preregistered stocks and no more than six total source requests;
- every accepted live observation is an append-only prospective snapshot with reproducible content/version identity and `pit_known_at=collected_at`;
- no accepted snapshot can be produced from degraded/ambiguous response quality;
- each physical stock job checkpoints independently and survives concurrent `main` movement without overwriting immutable observations;
- historical 33/protected state remains unchanged;
- record exact commits, workflow run/job IDs, request counts, snapshot paths/hashes, failures/limitations in this handoff;
- preserve this same preregistered Prompt B;
- stop with `Prompt A complete — ready for Prompt B.` Do not execute Prompt B.
```

## Prompt B — prospective live-capture canary closeout

```text
Perform mandatory closeout for `institutional-accumulation-catalyst-prospective-live-capture-canary-v1` only after its Prompt A completes. Fetch current remote `main` and recover this exact Prompt B from durable pre-Prompt-A history. Independently verify: sole active routing still points to this handoff; prior prospective PIT contract round remains Prompt B PASS; historical 33 identities remain exactly 0 pit_ready / 33 not_pit_ready; the canary used only official `t05st01` / `t05st01_detail`; exactly stocks 1102, 1104, 1216 were preregistered and no other stock was requested; each stock ran as an independent fresh-runner physical job with max-parallel 1; total repository-controlled requests were <=6 with one listing and at most one detail per stock and bounded 20-60s pre-request cooldown; no legacy endpoint, historical backfill, Wave A refetch, or historical Wave C rewrite occurred; every accepted prospective snapshot under `data_research/institutional-flow/official-disclosure-raw/prospective-catalyst-pit/` preserves raw bytes, SHA-256, collection timestamp, parser/methodology identity, immutable snapshot identity, append-only/non-overwrite behavior, and pit_known_at equal to collected_at; degraded/ambiguous/WAF/malformed/schema-invalid responses never became PIT-safe snapshots; bounded checkpoint logic is race-safe and remote immutable identity conflicts fail closed; Node 24 zero-network regression reproduces collector/contract invariants; development outcomes, holdouts, protected 2454, catalyst/outcome association, Withdrawal, thresholds/scores/models/strategies/production behavior remain unopened/unchanged. Compare the bounded changed-file set against the pre-Prompt-A baseline and verify all required files and live snapshot outputs are durable on current remote main. Fix only bounded defects and restart verification. On PASS record exact commits/runs/jobs/request counts/snapshot hashes/limitations, promote only a justified next preregistered round, end `Prompt B closeout: PASS`, and stop without executing the promoted Prompt A.
```

## Stop conditions

- Do not execute the promoted Prompt A automatically.
- Do not reopen or upgrade the historical 33 identities.
- Do not open protected outcomes, holdouts, association, or Withdrawal state.
- Do not mutate frozen Phase 2/outcome/association artifacts.
- Do not introduce catalyst/outcome association, thresholds, scores, models, strategies, production behavior, or generic-news features.
- Do not retry the legacy endpoint.
- Fail closed whenever PIT/value-version proof or response quality is unresolved.
