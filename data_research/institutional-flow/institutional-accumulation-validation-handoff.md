# Institutional Accumulation / Catalyst Pre-positioning Research — Handoff

Canonical handoff: `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`

## Current phase

**Phase 2 — outcome-blind deterministic development sample / event-anchor freeze: PROMOTED after Phase 1 Prompt B PASS.**

Active/promoted round:

`institutional-accumulation-development-sample-freeze-v1`

Status:

- `institutional-accumulation-preregistration-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-point-in-time-contract-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-sample-freeze-v1`: Prompt A **NOT STARTED / ACTIVE**, Prompt B **PREREGISTERED / NOT STARTED**.

Do not execute Phase 2 except through its preregistered Prompt A below. Promotion does not authorize automatic execution.

## Objective

Detect cases where price has not yet fully repriced upward while durable institutional capital has already changed behavior in a bullish direction, then later test whether credible PIT-safe catalyst evidence adds incremental value.

This remains research, not a production strategy.

## Frozen decisions / constraints

Canonical preregistration:

`data_research/institutional-flow/institutional-accumulation-preregistration-v1.md`

Methodology identity:

`institutional-accumulation-preregistration-v1`

Keep these conceptual layers separate until evidence supports combining them:

1. Institutional Accumulation
2. Supply Absorption
3. Price Non-confirmation
4. Catalyst Evidence / Catalyst Proximity
5. Repricing Readiness
6. Crowding / Retail-chasing Risk

No arbitrary final weighted score is frozen.

Outcome blindness remains mandatory until an explicitly later outcome-opening round. Do not use candidate-specific future returns, MFE/MAE, future breakout/failure labels, or future catalyst/news evidence to choose features, thresholds, samples, partitions, or anchors.

Protected MediaTek `2454` motivation cases remain `motivation_cases_only` and outside development/validation tuning evidence.

Withdrawal v6.0-v6.5 classifier/lifecycle rules, specs, validation outcomes/metrics, holdouts, and methodology remain frozen and are not Accumulation inputs.

Observation family remains:

`T-20 / T-15 / T-10 / T-5 / T-3 / T-1 / T0`

Required lifecycle remains:

`outcome-blind selection -> durable sample freeze -> stop -> later round opens outcomes`

## Phase 0 closeout

Phase 0 Prompt B closeout: **PASS**.

Key durable commits:

- `8a34187f87998fcc20c32024eeab47ac927f0957` — preregistration/source-semantics audit;
- `34868751908edd18aea19dac35885c2c373be902` — Phase 0 handoff checkpoint;
- preregistered Phase 0 Prompt B recoverable from `9d244fab0fe786393d8be72ab2f6327d306e7328`.

## Phase 1 completed

Round:

`institutional-accumulation-point-in-time-contract-v1`

Phase 1 built only the outcome-blind PIT observation/data contract and mechanical existing-repository coverage probe. It did not select/freeze a development sample, open outcomes, run a large network backfill, build a production classifier, or execute Phase 2.

Durable Phase 1 implementation artifacts:

- `scripts/lib/institutional_accumulation_pit.js`
- `tests/institutional_accumulation_pit.test.js`
- `tests/institutional_accumulation_pit_coverage.test.js`
- `scripts/audit_institutional_accumulation_pit_coverage.js`
- `data_research/institutional-flow/institutional-accumulation-pit-coverage-v1.json`
- `data_research/institutional-flow/institutional-accumulation-pit-contract-v1.md`
- `.github/workflows/test-institutional-accumulation-pit.yml`

Core implementation commits include:

- `b394073c31ef97742d3228ac67ec0afc9bdfb12d` — PIT observation contract;
- `5fe29975020eec587d80dc3497e42a2b28d85e8c` — PIT semantic tests;
- `e44c583bbca30aa1df259c0464e7cfbd21726326` — coverage audit;
- `9557b07b4203d75d32a1b03a3f75c6cd6bb5e6a4` — first coverage artifact;
- `fc9d539894e1375510f02042358c5f02460b4706` — PIT contract document;
- `ca92e9827d4eb3f9b876d6bcd1db6f157a1fe125` — bounded audit defaults;
- `83f4ca396e4f974aca9f2f9011dcbd13fa6c4281` / `119771cf989bf1f56a99e15c755902f873463c8a` — closeout validation workflow and sparse-checkout repair;
- `402305f36d457ddfc2ac55adce5a15ece93e204b` — reproducible equity-universe rule;
- `7ad163fc91d38bd37012f669fb1246afa01a80ed` — equity-universe regression test;
- `da23101b70c07f9bb2225d298ab1d3cd0a5ed314` — generator-owned audit artifact;
- `320aa280b1dae3d54092739fb7f15c71205282d6` — semantic reproduction / outcome guard;
- `801d15b006217842597b187baa0d548872382700` — align durable coverage counts with fresh-runner truth.

## Phase 1 PIT contract

The executable contract preserves value separately from state/provenance and supports at least:

- `available`
- `missing`
- `quality_rejected`
- `availability_unsafe`
- `not_applicable`

Non-`available` observations cannot expose a PIT-safe value. Missing/rejected/unsafe/not-applicable are never silently zero-filled; explicit numeric zero is valid only from a valid source row.

T-offsets are trading-session offsets, never calendar-day offsets. EOD institutional, margin, broker, and price/volume facts are unavailable before source-session completion unless stronger publication-time evidence is independently proven.

Stock prices use `scripts/lib/stock_price_provider.js`. Historical TDCC remains `availability_unsafe` while `production_no_lookahead_safe=false`. Current/static industry membership is not projected backward. Catalyst/disclosure remains a separate optional layer and requires conservative publication/known-time evidence.

`evaluateAnchorEligibility` fails closed for every later-declared required observation.

## Phase 1 mechanical coverage audit

Durable artifact:

`data_research/institutional-flow/institutional-accumulation-pit-coverage-v1.json`

Selection is deterministic and outcome-independent:

- universe: first 3 ascending four-digit TWSE equity codes with numeric code `>=1000` from `data_twse/twse_industry.csv`, excluding protected motivation stock `2454`;
- resulting stocks: `1101`, `1102`, `1103`;
- sessions: latest 3 dates `<=20260831` shared by foreign/investment-trust/dealer/margin manifests;
- resulting sessions: `20260825`, `20260826`, `20260827`;
- 9 stock-session observations per source;
- purpose: source-state coverage probe only; `sample_freeze=false`.

Fresh-runner source-state counts after closeout repair:

| Source | available | missing | quality_rejected |
| --- | ---: | ---: | ---: |
| Unified price | 9 | 0 | 0 |
| Foreign | 9 | 0 | 0 |
| Investment trust | 5 | 4 | 0 |
| Dealer | 9 | 0 | 0 |
| Margin | 9 | 0 | 0 |
| HiStock broker | 0 | 9 | 0 |

The durable audit explicitly records `outcome_blind=true`, `sample_freeze=false`, `outcome_fields_present=[]`, and protected-stock exclusion `2454`.

## Phase 1 Prompt B closeout evidence

`Prompt B closeout: PASS`

The exact Phase 1 Prompt B was recovered from pre-implementation remote-main commit `d430ba015b085cefc3d9da599f8b121a434e9feb`, proving the closeout criteria were preregistered before Phase 1 began.

Closeout initially found two real defects and did not PASS prematurely:

1. the audit universe rule accepted leading-zero ETF codes (`0050/0051/0052`), so the first durable `1101/1102/1103` artifact was not generator-reproducible;
2. the first outcome-blindness guard searched forbidden words literally and would have misclassified the artifact's own `forbidden_outcome_fields` declaration.

Bounded repairs fixed both without changing the PIT methodology, opening outcomes, touching Withdrawal, or executing Phase 2.

Final executable closeout evidence:

- workflow: `.github/workflows/test-institutional-accumulation-pit.yml`
- run: `33505951816`
- job: `99849911255`
- head SHA: `801d15b006217842597b187baa0d548872382700`
- conclusion: **SUCCESS**
- regression tests: **9 passed, 0 failed**;
- bounded coverage audit semantic reproduction: **PASS** after excluding only volatile `generated_at`;
- outcome-blindness guard: **PASS**;
- protected `2454` exclusion regression: **PASS**.

Phase 1 Prompt B criteria:

1. outcome-blind artifacts / no candidate outcomes — **PASS**;
2. T-20/T-15/T-10/T-5/T-3/T-1/T0 and T0 session semantics — **PASS**;
3. value separate from state/provenance; no zero-filling — **PASS**;
4. unified stock-price provider used — **PASS**;
5. conservative EOD availability — **PASS**;
6. historical TDCC remains `availability_unsafe` — **PASS**;
7. historical industry membership not guessed — **PASS**;
8. catalyst/disclosure separate and publication-time safe — **PASS**;
9. coverage audit mechanical/outcome-independent and reproducible — **PASS**;
10. no development sample freeze and Phase 2 not executed — **PASS**;
11. Withdrawal/production state untouched — **PASS**;
12. files/tests/commits/remote durable artifacts satisfy Phase 1 contract — **PASS**.

Changed-file comparison from Phase 1 pre-implementation baseline `d430ba015b085cefc3d9da599f8b121a434e9feb` through closeout head showed only the Accumulation Phase 1 code/tests/docs/workflow plus concurrent TWSE MI_INDEX data updates. No Withdrawal methodology or production strategy/prediction file was changed by this round.

## Exact repository entry points

### Phase 1 PIT implementation / validation

- `scripts/lib/institutional_accumulation_pit.js`
- `tests/institutional_accumulation_pit.test.js`
- `tests/institutional_accumulation_pit_coverage.test.js`
- `scripts/audit_institutional_accumulation_pit_coverage.js`
- `.github/workflows/test-institutional-accumulation-pit.yml`
- `data_research/institutional-flow/institutional-accumulation-pit-contract-v1.md`
- `data_research/institutional-flow/institutional-accumulation-pit-coverage-v1.json`

### Unified stock price

- `scripts/lib/stock_price_provider.js`
- `data_twse_mi_index/YYYYMMDD_twse_mi_index.json`
- `data_history_sma/<stock>.json`
- `data_fubon/fubon_YYYYMMDD_sma.json`

### Institutional / margin

- `data_twse_foreign_investors/files.json`
- `data_twse_investment_trust/files.json`
- `data_twse_dealers/files.json`
- `data_twse_margin_balance/files.json`
- corresponding dated daily archives

### HiStock broker

- `scripts/lib/histock_broker_quality.js`
- `data_research/institutional-flow/histock/<stock>/daily/YYYYMMDD.json`
- `data_research/institutional-flow/histock/<stock>/batch-status/*.json`

### TDCC / industry / disclosure

- `scripts/backfill_tdcc_shareholding_history.js`
- `data_tdcc_shareholding/history/2449/YYYYMMDD.json`
- `data_tdcc_shareholding/history/2449/manifest.json`
- `data_twse/twse_industry.csv`
- `scripts/fundamental_event_timeline.js`
- `scripts/build_fundamental_event_timeline.js`
- `data_fundamental_events/<stock>/<year>.json`

## Unresolved evidence carried into Phase 2

1. normalized HiStock broker coverage is absent for the bounded Phase 1 probe;
2. durable historical intraday publication timestamps for TWSE EOD archives remain unverified;
3. TDCC historical publication timing remains unverified;
4. effective-dated historical industry membership remains unverified;
5. complete timestamped historical catalyst/news/analyst-revision evidence remains unverified;
6. PIT-safe free-float/share-base support remains unaudited;
7. numerical repricing/success thresholds remain deliberately unfrozen.

## Next round

Active/promoted round:

`institutional-accumulation-development-sample-freeze-v1`

Execute only the preregistered **Prompt A — Phase 2 deterministic development sample/event-anchor freeze** below when the repository owner next invokes `promptA` while Accumulation remains the sole globally active routed task.

Do not open outcomes in Phase 2. Stop after a durable deterministic sample/event-anchor and partition freeze.

---

## Completed Prompt B — Phase 1 closeout / verification

Round `institutional-accumulation-point-in-time-contract-v1` closed with **PASS** using the exact preregistered Prompt B recoverable from commit `d430ba015b085cefc3d9da599f8b121a434e9feb`.

---

## Prompt A — Phase 2 deterministic development sample/event-anchor freeze

```text
Continue the Institutional Accumulation / Catalyst Pre-positioning research project in repository `EasonLiu0913/stock_data` only if Phase 1 Prompt B has durably PASSed and explicitly promoted round `institutional-accumulation-development-sample-freeze-v1`.

Before work, fetch current remote main; read AGENTS.md, project philosophy/roadmap, the canonical Accumulation handoff, preregistration, Phase 1 PIT contract, and Phase 1 coverage artifact. Recover this exact Phase 2 pair from durable history and verify it predates Phase 2 execution.

Phase 2 is OUTCOME-BLIND DETERMINISTIC DEVELOPMENT SAMPLE / EVENT-ANCHOR FREEZE ONLY.

Do not inspect or generate candidate-specific future returns, MFE/MAE, breakout/repricing success, failure/reclaim labels, or future catalyst/news. Do not execute an outcome study. Do not promote a production strategy or final weighted score.

Using only information available at or before each prospective anchor and the frozen Phase 1 source-state/PIT contract:
- define deterministic stock-universe and date/session eligibility without using protected MediaTek motivation episodes to tune inclusion;
- define which source observations are mandatory vs optional for sample eligibility, with explicit fail-closed data-completeness rules;
- define deterministic event-anchor construction from PIT-safe contemporaneous accumulation/supply-absorption/price-non-confirmation inputs without outcome-derived thresholds;
- if numerical scale cutoffs cannot be justified outcome-independently, freeze threshold-free/rank-based candidate construction or preregister a separate pre-outcome threshold-freeze gate instead of peeking at outcomes;
- preserve catalyst/disclosure as a separate optional PIT-safe layer;
- keep historical TDCC unavailable unless its publication timing has independently become safe under a preregistered rule;
- do not use current industry mapping as historical membership;
- deterministically separate methodology-development sample, untouched stock holdout, and untouched time holdout where feasible;
- keep MediaTek 2454 motivation cases outside validation/sample-tuning evidence;
- write a durable sample/anchor manifest containing only PIT inputs, eligibility reasons, source states/provenance, partition identity, methodology version, and hashes needed for later immutability verification;
- explicitly exclude all future-outcome fields.

Stop after the sample/event-anchor manifest and partition identities are durably frozen. Update the canonical handoff, preserve the preregistered Phase 2 Prompt B, and preregister a FUTURE / NOT PROMOTED later outcome-opening paired round. Commit/push, refetch remote main, verify changed-file scope and durable hashes.

When complete, report:
`Prompt A complete — ready for Prompt B`
and stop.
```

## Prompt B — Phase 2 closeout / verification

```text
Perform mandatory closeout for round `institutional-accumulation-development-sample-freeze-v1` only after it has been explicitly promoted and its Prompt A has completed.

Fetch current remote main; read AGENTS.md, the canonical Accumulation handoff, preregistration, Phase 1 PIT contract/coverage evidence, and recover this exact preregistered Phase 2 Prompt B from durable history.

Verify at minimum:
1. sample/anchor selection is deterministic, reproducible, and entirely outcome-blind;
2. no candidate future return, MFE/MAE, breakout/repricing success, failure/reclaim label, or future catalyst/news was opened or encoded;
3. all required inputs use the frozen Phase 1 PIT observation/source-state semantics and fail closed on missing/rejected/unsafe values;
4. source mandatory/optional rules were frozen before outcomes and are not chosen to fit protected MediaTek episodes;
5. protected MediaTek 2454 motivation cases remain outside development/validation tuning evidence;
6. development, untouched-stock holdout, and untouched-time holdout where feasible are explicitly separated and durably identified;
7. historical TDCC and industry restrictions remain intact unless stronger PIT evidence was independently preregistered before this round;
8. catalyst/disclosure remains a separate PIT-safe optional layer;
9. the durable sample/anchor manifest has stable methodology/version identity, source-state/provenance, partition identity, and an immutable content hash or equivalent verification;
10. no production classifier/final weighted score was promoted and no outcome-opening round was executed;
11. Withdrawal v6.0-v6.5 and production strategy/prediction state remain untouched;
12. changed files/tests/commits and remote artifacts satisfy the preregistered Phase 2 contract.

On PASS, update/commit the canonical handoff and promote exactly one already-preregistered later outcome-opening round. Promotion does not execute that future round.

End with:
`Prompt B closeout: PASS`
and the promoted round identity/canonical handoff path, then stop.
```

## Safety / stop conditions

- No production strategy promotion.
- No future-outcome opening in Phase 2 sample-freeze work.
- No MediaTek outcome-driven tuning.
- No large network backfill unless separately planned under repository batch rules.
- No modification of frozen Withdrawal methodology/validation state.
- Phase 2 Prompt A completion does not authorize Prompt B automatically.
- Phase 2 Prompt B PASS may promote a later outcome-opening round; promotion does not execute it.
