# Institutional Accumulation / Catalyst Pre-positioning Research — Handoff

Canonical handoff: `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`

## Current phase

**Phase 2 — outcome-blind deterministic development sample / event-anchor freeze: Prompt A COMPLETE / awaiting mandatory Prompt B closeout.**

Active/promoted round:

`institutional-accumulation-development-sample-freeze-v1`

Status:

- `institutional-accumulation-preregistration-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-point-in-time-contract-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-sample-freeze-v1`: Prompt A **COMPLETE**, Prompt B **PREREGISTERED / NOT STARTED**;
- `institutional-accumulation-outcome-opening-v1`: **PREREGISTERED / FUTURE / NOT PROMOTED**.

Do not execute Prompt B automatically. Do not execute the future outcome-opening pair unless Phase 2 Prompt B PASSes and explicitly promotes it.

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
- `801d15b006217842597b187baa0d548872382700` — align durable coverage counts with fresh-runner truth;
- `930b95edc40f0b9c55887cecd0f2c88c6a8d10f5` — Phase 1 closeout and Phase 2 promotion.

### Phase 1 PIT contract

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

### Phase 1 mechanical coverage audit

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

### Phase 1 Prompt B closeout evidence

`Prompt B closeout: PASS`

The exact Phase 1 Prompt B was recovered from pre-implementation remote-main commit `d430ba015b085cefc3d9da599f8b121a434e9feb`, proving the closeout criteria were preregistered before Phase 1 began.

Final executable closeout evidence:

- workflow: `.github/workflows/test-institutional-accumulation-pit.yml`
- run: `33505951816`
- job: `99849911255`
- head SHA: `801d15b006217842597b187baa0d548872382700`
- conclusion: **SUCCESS**
- regression tests: **9 passed, 0 failed**;
- bounded coverage audit semantic reproduction: **PASS**;
- outcome-blindness guard: **PASS**;
- protected `2454` exclusion regression: **PASS**.

## Phase 2 Prompt A completed

Round:

`institutional-accumulation-development-sample-freeze-v1`

Phase 2 was executed from remote `main` after Phase 1 Prompt B PASS and promotion commit `930b95edc40f0b9c55887cecd0f2c88c6a8d10f5`. The exact Phase 2 Prompt A/B pair was already durably present before implementation began.

Phase 2 remained fully outcome-blind. It did not inspect or generate candidate future returns, MFE/MAE, breakout/repricing success, failure/reclaim labels, or future catalyst/news evidence.

Durable implementation artifacts:

- `scripts/freeze_institutional_accumulation_development_sample.js`
- `tests/institutional_accumulation_development_sample.test.js`
- `.github/workflows/freeze-institutional-accumulation-development-sample.yml`
- `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`
- `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.md`

Implementation / manifest commits:

- `5837550417a2045deeda581bedeb3025b5e725ce` — `feat: freeze accumulation development sample v1`;
- `3810d00c4289c1067725f7b1ccdb5dc9da7dfffd` — `analysis: freeze accumulation development sample v1`.

### Frozen deterministic universe and anchors

Universe rule:

- first 15 ascending four-digit TWSE equity codes with numeric code `>=1000` from `data_twse/twse_industry.csv`;
- protected MediaTek `2454` excluded before selection;
- current industry labels ignored.

Frozen universe:

`1101, 1102, 1103, 1104, 1108, 1109, 1110, 1201, 1203, 1210, 1213, 1215, 1216, 1217, 1218`

Trading-session rule:

- ascending intersection of foreign-investor, dealer, and margin archive manifests at or before fixed cutoff `20260827`;
- offsets count trading sessions;
- after 20-session warmup, freeze latest 10 usable T0 sessions.

Frozen anchor sessions:

`20260814, 20260817, 20260818, 20260819, 20260820, 20260821, 20260824, 20260825, 20260826, 20260827`

### Frozen source-completeness rules

Mandatory for every `T-20/T-15/T-10/T-5/T-3/T-1/T0` observation:

- unified price / volume;
- foreign-investor flow;
- dealer flow.

Each required observation must have Phase 1 source state `available`. Every absent / missing / quality-rejected / availability-unsafe / not-applicable required value fails closed. Non-available observations are never zero-filled.

Optional/context-only:

- investment trust;
- margin financing;
- HiStock broker history — no backfill was launched and it is not an eligibility requirement;
- catalyst/disclosure — separate PIT-safe optional layer only.

Historical TDCC remains `availability_unsafe`. Current/static industry mapping is not used as historical membership.

### Threshold-free event-anchor construction

No numerical winning cutoff was selected. Every stock-session satisfying the mandatory PIT completeness gate is frozen as an eligible prospective anchor.

The manifest preserves contemporaneous continuous/rank inputs only:

- foreign sampled net shares;
- dealer sampled net shares;
- foreign + dealer core accumulation;
- positive core-flow observation count;
- sampled core net shares / sampled observed volume when all sampled volume is valid;
- T-20 to T0 price return;
- cross-sectional accumulation percentile;
- supply-absorption percentile;
- price-return percentile;
- price-non-confirmation rank gap.

No free-float normalization is claimed and no final weighted score exists.

### Frozen partitions

Priority:

1. `stock_holdout` — every fifth stock in ascending universe (`zero-based index % 5 === 4`) across all anchors;
2. `time_holdout` — non-stock-holdout stocks in final 20% of frozen anchor sessions;
3. `methodology_development` — remaining eligible anchors.

Fresh-runner counts:

| Partition / state | Count |
| --- | ---: |
| methodology_development | 41 |
| stock_holdout | 11 |
| time_holdout | 10 |
| ineligible | 88 |

Ineligible prospective anchors remain in the manifest with PIT eligibility reasons.

### Durable manifest / fresh-runner evidence

Manifest:

`data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`

Manifest semantic content SHA-256:

`66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`

Fresh-runner remote file-byte SHA-256:

`1dd28b1e026122c185cae67d731f39d0895d9446017f9825e08ce001ecfb8272`

Fresh-runner workflow evidence:

- workflow: `.github/workflows/freeze-institutional-accumulation-development-sample.yml`;
- run: `33507122033`;
- job: `99853715397`;
- head SHA: `5837550417a2045deeda581bedeb3025b5e725ce`;
- conclusion: **SUCCESS**;
- deterministic tests: **4 passed, 0 failed**;
- manifest outcome-blind / partition / content-hash contract verification: **PASS**;
- durable remote manifest verification: **PASS**.

The manifest also stores SHA-256 identities for source files referenced by observation provenance for later immutability verification.

## Exact repository entry points

### Phase 2 freeze implementation / validation

- `scripts/freeze_institutional_accumulation_development_sample.js`
- `tests/institutional_accumulation_development_sample.test.js`
- `.github/workflows/freeze-institutional-accumulation-development-sample.yml`
- `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`
- `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.md`

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

## Unresolved evidence carried forward

1. normalized HiStock broker coverage remains insufficient to make broker history a mandatory Phase 2 source;
2. durable historical intraday publication timestamps for TWSE EOD archives remain unverified;
3. TDCC historical publication timing remains unverified;
4. effective-dated historical industry membership remains unverified;
5. complete timestamped historical catalyst/news/analyst-revision evidence remains unverified;
6. PIT-safe free-float/share-base support remains unaudited;
7. numerical repricing/success thresholds remain deliberately unfrozen; later outcome analysis must begin with continuous outcomes rather than retrofitting a binary success cutoff.

## Current mandatory closeout

Round awaiting closeout:

`institutional-accumulation-development-sample-freeze-v1`

Prompt A is complete. Execute only the preregistered **Prompt B — Phase 2 closeout / verification** below when the repository owner invokes `promptB` while Accumulation remains the sole globally active routed task.

Do not promote or execute the future outcome-opening round before Phase 2 Prompt B PASS.

---

## Completed Prompt A — Phase 2 deterministic development sample/event-anchor freeze

The exact implementation prompt below was preregistered before Phase 2 execution and has now completed.

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

---

## FUTURE / NOT PROMOTED — institutional-accumulation-outcome-opening-v1

This pair is preregistered during Phase 2 Prompt A before any Accumulation candidate outcome is opened. It must remain future/not-promoted until Phase 2 Prompt B PASS explicitly promotes it.

### Prompt A — Development-only continuous outcome opening

```text
Continue the Institutional Accumulation / Catalyst Pre-positioning research project only if mandatory Phase 2 closeout has PASSed and explicitly promoted round `institutional-accumulation-outcome-opening-v1`.

Before work, fetch current remote main; read AGENTS.md, project philosophy/roadmap, the canonical Accumulation handoff, preregistration, Phase 1 PIT contract, Phase 2 freeze contract, and the frozen manifest. Recover this exact future pair from durable history and verify it was preregistered before any candidate outcome was opened.

First verify the frozen Phase 2 manifest methodology identity and `content_sha256`, and verify its referenced source-file SHA-256 identities still match the frozen inputs. If the frozen manifest or relevant source identities changed, stop rather than silently regenerate or redefine the sample.

Open outcomes ONLY for anchors whose frozen partition is `methodology_development`. Do not inspect, summarize, materialize, or derive future outcomes for `stock_holdout`, `time_holdout`, or protected MediaTek `2454` motivation cases in this round.

Use only the preregistered continuous outcome families and session semantics:
- D+5, D+10, D+20, D+40 exchange trading-session horizons;
- absolute forward return;
- TAIEX-relative forward return when the benchmark can be aligned to the same trading-session sequence;
- optional continuous MFE/MAE only if computed from the same frozen base/session convention without using future information to redefine anchors/features;
- unified stock price provider for stock prices;
- missing stock/benchmark observations remain missing and are never converted to zero;
- omit same-industry-relative outcomes while historical effective-dated industry membership remains unproven.

Because numerical repricing/success thresholds were deliberately unfrozen in Phase 2, do not invent a binary success/failure cutoff after viewing outcomes. Preserve continuous outcomes and preregister any later binary-threshold experiment separately if evidence still requires one.

Do not alter the frozen Phase 2 feature definitions, universe, anchors, partitions, source mandatory/optional rules, or source hashes. Do not use development outcomes to inspect or tune against untouched stock/time holdouts. Do not promote a production classifier, final weighted score, or strategy.

Write a durable development-only outcome artifact carrying frozen anchor identity, partition identity, methodology identities, outcome provenance, horizon/session contract, missingness state, and the parent Phase 2 manifest hash. Add deterministic regression/reproduction checks and update the canonical handoff while preserving the paired Prompt B.

Stop after the development-only continuous outcome artifact is durably written and verified. Do not open holdouts automatically.

When complete, report:
`Prompt A complete — ready for Prompt B`
and stop.
```

### Prompt B — Development-only outcome-opening closeout

```text
Perform mandatory closeout for round `institutional-accumulation-outcome-opening-v1` only after that round has been explicitly promoted and its Prompt A has completed.

Fetch current remote main; read AGENTS.md, the canonical Accumulation handoff, preregistration, Phase 1 PIT contract, Phase 2 freeze contract/manifest, and recover this exact preregistered Prompt B from durable history.

Verify at minimum:
1. the Phase 2 frozen manifest identity/content hash and referenced source identities were verified before outcome opening and were not regenerated/redefined;
2. outcome materialization is limited strictly to frozen `methodology_development` anchors;
3. no stock-holdout, time-holdout, or protected MediaTek 2454 candidate future outcome was opened, summarized, or encoded;
4. D+5/D+10/D+20/D+40 count exchange trading sessions from the frozen anchor convention;
5. stock prices use the unified provider and TAIEX-relative outcomes align to the same session sequence;
6. missing stock/benchmark observations remain explicit missing values, never zero returns;
7. same-industry-relative outcomes remain omitted without PIT-safe historical membership;
8. no post-outcome binary repricing/success threshold was invented or tuned;
9. Phase 2 features, anchors, partitions, mandatory/optional sources, and hashes remain unchanged;
10. the durable development-only outcome artifact is reproducible and carries parent freeze identity/hash plus outcome provenance;
11. no production classifier/final weighted score/strategy was promoted and Withdrawal v6.0-v6.5 state remains untouched;
12. changed files/tests/commits and remote artifacts satisfy this preregistered development-only outcome-opening contract.

On PASS, update/commit the canonical handoff. Do not open untouched holdouts unless a separately preregistered and explicitly promoted future round authorizes it.

End with:
`Prompt B closeout: PASS`
and stop.
```

## Safety / stop conditions

- No production strategy promotion.
- No future-outcome opening during Phase 2 sample-freeze closeout.
- No MediaTek outcome-driven tuning.
- No large network backfill unless separately planned under repository batch rules.
- No modification of frozen Withdrawal methodology/validation state.
- Phase 2 Prompt A completion does not authorize Prompt B automatically.
- Phase 2 Prompt B PASS may promote only the already-preregistered `institutional-accumulation-outcome-opening-v1` round; promotion does not execute it.
