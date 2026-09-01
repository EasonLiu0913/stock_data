# Institutional Accumulation Development Sample / Event-Anchor Freeze v1

Methodology identity: `institutional-accumulation-development-sample-freeze-v1`

Parent PIT contract: `institutional-accumulation-point-in-time-contract-v1`

Research status: **Phase 2 Prompt A complete / awaiting mandatory Prompt B closeout.**

This artifact freezes an outcome-blind deterministic development sample, event-anchor construction, and partition identity. It is not an outcome study, production classifier, production strategy, or final weighted score.

## Outcome-blind boundary

No candidate-specific future return, MFE/MAE, breakout/repricing success, failure/reclaim label, or future catalyst/news evidence was opened or generated during this round.

Protected MediaTek `2454` motivation cases are excluded before universe construction and therefore cannot influence feature, threshold, anchor, or partition choices.

The durable manifest explicitly records:

- `outcome_blind=true`;
- `sample_freeze=true`;
- `outcome_fields_present=[]`;
- `protected_motivation_stock_excluded="2454"`.

## Deterministic universe

The frozen universe rule is:

> First 15 ascending four-digit TWSE equity codes with numeric code `>=1000` from `data_twse/twse_industry.csv`, excluding `2454`; current industry labels are ignored.

Frozen universe:

`1101, 1102, 1103, 1104, 1108, 1109, 1110, 1201, 1203, 1210, 1213, 1215, 1216, 1217, 1218`

No current/static industry label is projected backward as historical membership.

## Deterministic trading-session / anchor rule

The trading-session sequence is the ascending intersection of existing foreign-investor, dealer, and margin archive manifests at or before the fixed cutoff `20260827`.

Observation labels remain the preregistered trading-session family:

`T-20 / T-15 / T-10 / T-5 / T-3 / T-1 / T0`

After the required 20-session warmup, the latest 10 usable sessions are frozen as prospective event anchors:

`20260814, 20260817, 20260818, 20260819, 20260820, 20260821, 20260824, 20260825, 20260826, 20260827`

The cutoff predates Phase 2 execution and does not move with runner clock time.

## Mandatory and optional source rules

Mandatory at every frozen observation label:

- unified stock price / volume through `scripts/lib/stock_price_provider.js`;
- TWSE foreign-investor observation;
- TWSE dealer observation.

Every required observation must have Phase 1 source state `available`. Missing, quality-rejected, availability-unsafe, not-applicable, or absent required observations fail closed and make the prospective anchor ineligible. No non-available value is converted to zero.

Optional/context-only in Phase 2:

- investment trust;
- margin financing / retail-leverage observation;
- HiStock broker history — not used for eligibility and no network backfill was launched;
- catalyst/disclosure — remains a separate PIT-safe optional layer.

Historical TDCC remains excluded / `availability_unsafe` while `production_no_lookahead_safe=false` and historical publication timing remains unproven.

## Threshold-free event-anchor construction

Phase 2 deliberately does not freeze a success-derived numerical cutoff. Every stock-session that passes the mandatory PIT completeness gate is retained as an eligible prospective anchor.

For eligible anchors, the manifest preserves contemporaneous PIT features without choosing a winning threshold:

- sampled foreign net shares across the frozen observation family;
- sampled dealer net shares;
- core institutional sampled net shares = foreign + dealer;
- count of sampled observations where core institutional flow is positive;
- sampled core institutional net shares divided by sampled observed volume, only when every required sampled volume is valid;
- contemporaneous T-20 to T0 price return;
- cross-sectional accumulation percentile;
- cross-sectional supply-absorption percentile;
- cross-sectional price-return percentile;
- price-non-confirmation rank gap = accumulation percentile minus contemporaneous price-return percentile.

No PIT-safe free-float/share-base normalization is claimed because that support remains unaudited. No final weighted score exists.

## Frozen partitions

Partition priority is deterministic and is applied before any outcome is opened:

1. `stock_holdout`: every fifth stock in the ascending frozen universe (`zero-based index % 5 === 4`) across all anchor sessions;
2. `time_holdout`: non-stock-holdout stocks in the final 20% of frozen anchor sessions;
3. `methodology_development`: every remaining eligible anchor.

Fresh-runner frozen counts:

| Partition / state | Count |
| --- | ---: |
| methodology_development | 41 |
| stock_holdout | 11 |
| time_holdout | 10 |
| ineligible | 88 |

The 88 ineligible prospective anchors remain in the manifest with explicit PIT eligibility reasons rather than being silently discarded.

## Durable manifest / immutability evidence

Canonical manifest:

`data_research/institutional-flow/institutional-accumulation-development-sample-freeze-v1.json`

Generator:

`scripts/freeze_institutional_accumulation_development_sample.js`

Regression test:

`tests/institutional_accumulation_development_sample.test.js`

Fresh-runner writer/validation workflow:

`.github/workflows/freeze-institutional-accumulation-development-sample.yml`

Implementation commit:

`5837550417a2045deeda581bedeb3025b5e725ce` — `feat: freeze accumulation development sample v1`

Durable manifest commit:

`3810d00c4289c1067725f7b1ccdb5dc9da7dfffd` — `analysis: freeze accumulation development sample v1`

Workflow evidence:

- run: `33507122033`;
- job: `99853715397`;
- conclusion: **SUCCESS**;
- deterministic tests: **4 passed, 0 failed**;
- manifest contract verification: **PASS**;
- remote persistence verification: **PASS**.

Manifest semantic content SHA-256:

`66ddb3bbf99e40bb1babb9e25a5257612a61206d827e273e6fb9b45b9c35e25b`

Remote manifest file-byte SHA-256 observed by the fresh runner:

`1dd28b1e026122c185cae67d731f39d0895d9446017f9825e08ce001ecfb8272`

The manifest also stores SHA-256 identities for source files referenced by frozen observation provenance, enabling later immutability checks before outcome opening.

## Phase boundary

Phase 2 stops here. It does not open outcomes and does not inspect the frozen stock/time holdouts.

The next outcome-opening round is preregistered in the canonical handoff as **FUTURE / NOT PROMOTED**. It may not run until mandatory Phase 2 Prompt B closeout PASSes and explicitly promotes that round.
