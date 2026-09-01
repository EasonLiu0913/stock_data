# Institutional Accumulation / Catalyst Pre-positioning Research — Handoff

Canonical handoff: `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`

## Current phase

**Phase 3 — development-only continuous outcome opening: PROMOTED after Phase 2 Prompt B PASS.**

Active/promoted round:

`institutional-accumulation-outcome-opening-v1`

Status:

- `institutional-accumulation-preregistration-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-point-in-time-contract-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-development-sample-freeze-v1`: Prompt A **COMPLETE**, Prompt B **PASS**;
- `institutional-accumulation-outcome-opening-v1`: Prompt A **NOT STARTED / ACTIVE**, Prompt B **PREREGISTERED / NOT STARTED**.

Promotion does not execute the active Prompt A automatically.

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

Protected MediaTek `2454` motivation cases remain `motivation_cases_only` and outside development/validation tuning evidence.

Withdrawal v6.0-v6.5 classifier/lifecycle rules, specs, validation outcomes/metrics, holdouts, and methodology remain frozen and are not Accumulation inputs.

Observation family remains:

`T-20 / T-15 / T-10 / T-5 / T-3 / T-1 / T0`

Required lifecycle remains:

`outcome-blind selection -> durable sample freeze -> stop -> development-only outcome opening -> closeout -> separately authorized holdout work`

## Phase 0 closeout

Phase 0 Prompt B closeout: **PASS**.

Key durable commits:

- `8a34187f87998fcc20c32024eeab47ac927f0957` — preregistration/source-semantics audit;
- `34868751908edd18aea19dac35885c2c373be902` — Phase 0 handoff checkpoint;
- preregistered Phase 0 Prompt B recoverable from `9d244fab0fe786393d8be72ab2f6327d306e7328`.

## Phase 1 closeout

Round:

`institutional-accumulation-point-in-time-contract-v1`

Prompt B closeout: **PASS**.

Core artifacts:

- `scripts/lib/institutional_accumulation_pit.js`
- `tests/institutional_accumulation_pit.test.js`
- `tests/institutional_accumulation_pit_coverage.test.js`
- `scripts/audit_institutional_accumulation_pit_coverage.js`
- `.github/workflows/test-institutional-accumulation-pit.yml`
- `data_research/institutional-flow/institutional-accumulation-pit-contract-v1.md`
- `data_research/institutional-flow/institutional-accumulation-pit-coverage-v1.json`

Closeout evidence:

- workflow run `33505951816`, job `99849911255`;
- tested head `801d15b006217842597b187baa0d548872382700`;
- 9 tests passed, 0 failed;
- semantic reproduction / outcome blindness / protected `2454` guards passed;
- Phase 1 closeout and Phase 2 promotion commit `930b95edc40f0b9c55887cecd0f2c88c6a8d10f5`.

## Phase 2 completed

Round:

`institutional-accumulation-development-sample-freeze-v1`

Phase 2 froze the development sample/event-anchor and partitions without opening candidate-specific future outcomes.

### Durable implementation artifacts

- `scripts/freeze_institutional_accumulation_development_sample.js`
- `tests/institutional_accumulation_development_sample.test.js`
- `.github/workflows/freeze-institutional-accumulation-development-sample.yml`
- `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`
- `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.md`

Implementation / manifest commits:

- `5837550417a2045deeda581bedeb3025b5e725ce` — `feat: freeze accumulation development sample v1`;
- `3810d00c4289c1067725f7b1ccdb5dc9da7dfffd` — `analysis: freeze accumulation development sample v1`;
- `481fda6c543fb3850f3bc74a81a2b9255a255bee` — Prompt A handoff checkpoint.

### Frozen deterministic universe / anchors

Universe rule:

- first 15 ascending four-digit TWSE equity codes with numeric code `>=1000` from `data_twse/twse_industry.csv`;
- protected MediaTek `2454` excluded before selection;
- current industry labels ignored.

Frozen universe:

`1101, 1102, 1103, 1104, 1108, 1109, 1110, 1201, 1203, 1210, 1213, 1215, 1216, 1217, 1218`

Trading-session rule:

- ascending intersection of foreign-investor, dealer, and margin archive manifests at or before fixed cutoff `20260827`;
- offsets count exchange/source-shared trading sessions;
- after 20-session warmup, freeze latest 10 usable T0 sessions.

Frozen anchors:

`20260814, 20260817, 20260818, 20260819, 20260820, 20260821, 20260824, 20260825, 20260826, 20260827`

### Frozen mandatory / optional source rules

Mandatory for every `T-20/T-15/T-10/T-5/T-3/T-1/T0` observation:

- unified price / volume;
- foreign-investor flow;
- dealer flow.

Each required observation must have Phase 1 source state `available`. Every absent / missing / quality-rejected / availability-unsafe / not-applicable required value fails closed. Non-available observations are never zero-filled.

Optional/context-only:

- investment trust;
- margin financing;
- HiStock broker history — no Phase 2 backfill and not an eligibility requirement;
- catalyst/disclosure — separate PIT-safe optional layer only.

Historical TDCC remains `availability_unsafe`. Current/static industry mapping is not used as historical membership.

### Threshold-free event-anchor construction

No numerical winning cutoff was selected. Every stock-session satisfying the mandatory PIT completeness gate is frozen as an eligible prospective anchor.

PIT continuous/rank features preserved:

- foreign sampled net shares;
- dealer sampled net shares;
- foreign + dealer core accumulation;
- positive core-flow observation count;
- sampled core net shares / sampled observed volume when valid;
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

Ineligible prospective anchors remain in the manifest with explicit PIT eligibility reasons.

### Durable manifest / immutability evidence

Manifest semantic content SHA-256:

`66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`

Fresh-runner remote file-byte SHA-256:

`1dd28b1e026122c185cae67d731f39d0895d9446017f9825e08ce001ecfb8272`

Fresh-runner workflow evidence:

- workflow `.github/workflows/freeze-institutional-accumulation-development-sample.yml`;
- run `33507122033`;
- job `99853715397`;
- head SHA `5837550417a2045deeda581bedeb3025b5e725ce`;
- conclusion **SUCCESS**;
- deterministic tests **4 passed, 0 failed**;
- manifest outcome-blind / partition / content-hash verification **PASS**;
- durable remote manifest verification **PASS**.

The manifest stores SHA-256 identities for source files referenced by observation provenance for later immutability verification.

## Phase 2 Prompt B closeout

Round:

`institutional-accumulation-development-sample-freeze-v1`

**Prompt B closeout: PASS**

The exact Phase 2 Prompt B was recovered from pre-Prompt-A durable commit:

`930b95edc40f0b9c55887cecd0f2c88c6a8d10f5`

Closeout independently re-established current remote state and verified all preregistered criteria:

1. deterministic/reproducible/outcome-blind sample and anchor selection — **PASS**;
2. no candidate future return, MFE/MAE, breakout/repricing success, failure/reclaim label, or future catalyst/news opened or encoded — **PASS**;
3. required observations reuse the frozen Phase 1 PIT source-state semantics and fail closed — **PASS**;
4. mandatory/optional source rules were frozen pre-outcome and are independent of MediaTek motivation cases — **PASS**;
5. protected `2454` remains excluded before universe construction — **PASS**;
6. development / untouched-stock / untouched-time partitions are deterministic, non-empty, and durably identified — **PASS**;
7. historical TDCC remains unsafe and current industry mapping is not projected backward — **PASS**;
8. catalyst/disclosure remains a separate PIT-safe optional layer — **PASS**;
9. manifest carries stable methodology/version identity, provenance/source states, partition identity, semantic content SHA-256, remote byte SHA-256, and source-file hashes — **PASS**;
10. no production classifier/final weighted score was promoted and no outcome-opening round was executed during Phase 2 — **PASS**;
11. Withdrawal v6.0-v6.5 and production strategy/prediction state remained untouched — **PASS**;
12. changed-file scope, tests, commits, workflow evidence, and durable remote artifacts satisfy the Phase 2 contract — **PASS**.

Changed-file audit from pre-Phase-2 baseline `930b95edc40f0b9c55887cecd0f2c88c6a8d10f5` through Prompt A checkpoint `481fda6c543fb3850f3bc74a81a2b9255a255bee` contains only:

- `.github/workflows/freeze-institutional-accumulation-development-sample.yml`;
- `scripts/freeze_institutional_accumulation_development_sample.js`;
- `tests/institutional_accumulation_development_sample.test.js`;
- `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`;
- `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.md`;
- this canonical Accumulation handoff.

Concurrent commits after Prompt A checkpoint and before closeout updated Pocket `00981A` data and 2026-09-01 `data_fubon` institutional artifacts only. They did not alter the freeze manifest, Phase 2 generator/test/workflow, routing, Withdrawal state, or the frozen cutoff/input archives through `20260827`; therefore the acceptance evidence remained fresh.

Phase 2 closeout promotes exactly the already-preregistered next round:

`institutional-accumulation-outcome-opening-v1`

Promotion does not execute it.

## Exact repository entry points

### Phase 2 freeze

- `scripts/freeze_institutional_accumulation_development_sample.js`
- `tests/institutional_accumulation_development_sample.test.js`
- `.github/workflows/freeze-institutional-accumulation-development-sample.yml`
- `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`
- `data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.md`

### Phase 1 PIT contract

- `scripts/lib/institutional_accumulation_pit.js`
- `scripts/lib/stock_price_provider.js`
- `scripts/lib/histock_broker_quality.js`
- `data_research/institutional-flow/institutional-accumulation-pit-contract-v1.md`
- `data_research/institutional-flow/institutional-accumulation-pit-coverage-v1.json`

### Institutional / margin inputs

- `data_twse_foreign_investors/files.json`
- `data_twse_investment_trust/files.json`
- `data_twse_dealers/files.json`
- `data_twse_margin_balance/files.json`
- corresponding dated daily archives

### TDCC / industry / disclosure restrictions

- `scripts/backfill_tdcc_shareholding_history.js`
- `data_tdcc_shareholding/history/2449/manifest.json`
- `data_twse/twse_industry.csv`
- `scripts/fundamental_event_timeline.js`
- `scripts/build_fundamental_event_timeline.js`
- `data_fundamental_events/<stock>/<year>.json`

## Unresolved evidence carried forward

1. normalized HiStock broker coverage remains insufficient for mandatory use;
2. durable historical intraday publication timestamps for TWSE EOD archives remain unverified;
3. TDCC historical publication timing remains unverified;
4. effective-dated historical industry membership remains unverified;
5. complete timestamped historical catalyst/news/analyst-revision evidence remains unverified;
6. PIT-safe free-float/share-base support remains unaudited;
7. numerical repricing/success thresholds remain deliberately unfrozen; Phase 3 must begin with continuous outcomes rather than retrofitting a binary success cutoff.

## Next round

Active/promoted round:

`institutional-accumulation-outcome-opening-v1`

Execute only the preregistered Prompt A below when the owner next invokes `promptA` while Accumulation remains the sole globally active routed task.

Do not open stock holdout, time holdout, or protected MediaTek outcomes in this round.

---

## Prompt A — Development-only continuous outcome opening

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

## Prompt B — Development-only outcome-opening closeout

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
- No MediaTek outcome-driven tuning.
- No stock-holdout/time-holdout outcome opening in `institutional-accumulation-outcome-opening-v1`.
- No large network backfill unless separately planned under repository batch rules.
- No modification of frozen Withdrawal methodology/validation state.
- Phase 3 Prompt A completion does not authorize Prompt B automatically.
- Promotion does not execute the promoted Prompt A automatically.
