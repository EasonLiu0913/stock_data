# Institutional Accumulation / Catalyst Pre-positioning Research — Handoff

Canonical handoff: `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`

## Current phase

**Phase 1 — outcome-blind point-in-time feature/data contract: promoted after Phase 0 Prompt B PASS.**

Active/promoted round:

`institutional-accumulation-point-in-time-contract-v1`

Status:

- completed round `institutional-accumulation-preregistration-v1`: Prompt A **COMPLETE**, Prompt B **PASS**
- active round `institutional-accumulation-point-in-time-contract-v1`: Prompt A **NOT STARTED / ACTIVE**
- active round Prompt B: **PREREGISTERED / NOT STARTED**

Do not execute Phase 1 except through its preregistered Prompt A below. Phase 1 remains outcome-blind and must not select/freeze the development sample or open candidate outcomes.

## Objective

Detect cases where price has not yet fully repriced upward while durable institutional capital has already changed behavior in a bullish direction, then later test whether credible point-in-time catalyst evidence adds incremental value.

This remains research, not a production strategy.

## Frozen decisions / constraints

Canonical preregistration:

`data_research/institutional-flow/institutional-accumulation-preregistration-v1.md`

Methodology identity:

`institutional-accumulation-preregistration-v1`

Keep these layers separate until evidence supports combining them:

1. Institutional Accumulation
2. Supply Absorption
3. Price Non-confirmation
4. Catalyst Evidence / Catalyst Proximity
5. Repricing Readiness
6. Crowding / Retail-chasing Risk

No arbitrary final weighted score is frozen.

Outcome blindness remains mandatory until an explicitly later outcome-opening round. Do not use candidate-specific future returns, MFE/MAE, future breakout/failure labels, or future catalyst/news evidence to select features, windows, thresholds, formulas, samples, or anchors.

Protected MediaTek `2454` motivation cases remain:

- May 2026 upward repricing wave;
- June 2026 upward repricing wave;
- late-August / 2026-09-01 upward repricing wave.

Status: `motivation_cases_only`.

Withdrawal v6.0-v6.5 classifier/lifecycle rules, specs, validation outcomes/metrics, holdouts, and methodology remain frozen and were not modified for Accumulation.

Observation family remains:

`T-20 / T-15 / T-10 / T-5 / T-3 / T-1 / T0`

Required research boundary remains:

`outcome-blind selection -> durable sample freeze -> stop -> later round opens outcomes`

## Phase 0 completed

Prompt A completed the preregistration/source-semantics audit without opening candidate outcomes, building a classifier, creating the historical feature dataset, selecting a development sample, running a large network backfill, or executing Phase 1.

Phase 0 preregistration audit commit:

`8a34187f87998fcc20c32024eeab47ac927f0957` — `docs: complete accumulation phase 0 preregistration audit`

Phase 0 handoff checkpoint:

`34868751908edd18aea19dac35885c2c373be902` — `docs: checkpoint accumulation phase 0 handoff`

The canonical preregistration now contains:

- exact verified repository paths for source/implementation entry points;
- source-by-source date, point-in-time, missingness, and zero semantics;
- explicit TDCC historical no-lookahead limitation;
- unified price-provider contract;
- conservative disclosure/fundamental availability semantics;
- prospective outcome/session semantics without opening outcomes;
- unresolved evidence questions;
- ordered Phase 1 proposal.

## Phase 0 Prompt B closeout evidence

`Prompt B closeout: PASS`

Verified against current remote `main` with the preregistered Phase 0 Prompt B recovered from bootstrap commit:

`9d244fab0fe786393d8be72ab2f6327d306e7328` — `docs: bootstrap institutional accumulation handoff`

This proves the same Phase 0 Prompt B existed before Prompt A implementation commit `8a34187f87998fcc20c32024eeab47ac927f0957`.

Closeout gates:

1. **Durable artifacts — PASS.** Both canonical Accumulation documents are committed on remote `main` with stable methodology/round identity.
2. **Research direction — PASS.** The target remains durable institutional behavior before upward repricing; six conceptual layers remain separate and no arbitrary final weighted score was frozen.
3. **Outcome blindness / leakage — PASS.** The Phase 0 implementation commit changed only `data_research/institutional-flow/institutional-accumulation-preregistration-v1.md`; no candidate future-return, MFE/MAE, breakout/failure, or future-catalyst artifact was created or used. MediaTek May/June/late-August episodes remain `motivation_cases_only`.
4. **Point-in-time semantics — PASS.** Institutional, broker, TDCC, margin, price/volume, disclosure/fundamental, and catalyst/news availability/missingness rules are explicit; future-publication evidence is forbidden and missing is not silently zero-filled.
5. **Exact source inventory — PASS.** Verified repo-relative paths and stable symbols are recorded where known, with unresolved paths/timestamps left explicitly unresolved rather than guessed.
6. **Withdrawal protection / evidence-before-abstraction — PASS.** No frozen Withdrawal v6.0-v6.5 code/spec/outcome/holdout state changed for Accumulation and no generic institutional-flow abstraction was introduced.
7. **Prospective feature/outcome contract — PASS.** `T-20/T-15/T-10/T-5/T-3/T-1/T0` is preserved; future absolute/TAIEX-relative/same-industry-relative where PIT-safe, MFE, MAE, repricing/breakout, and D+5/D+10/D+20/D+40 session horizons are defined without opening candidate outcomes.
8. **Validation architecture — PASS.** Development samples, untouched stock holdout, untouched time holdout where feasible, MediaTek motivation cases, and final production-gate evidence remain separated; the sample-freeze stop boundary is durable.
9. **False-positive taxonomy — PASS.** Transient trading, no repricing, temporary pop/failure, catalyst non-materialization, already-priced catalyst, retail/margin crowding, and market/industry beta explanations remain documented in the preregistration.
10. **Changed-file audit — PASS.** Phase 0 implementation commit `8a34187f...` changed only the preregistration document; checkpoint commit `34868751...` changed only this handoff. Concurrent 2026-09-01 SMA data updates and repository runner/routing protocol updates were separate changes and do not alter Phase 0 methodology, protected Withdrawal state, production strategies, or outcome blindness.

No bounded repair was required. The unresolved evidence questions below remain legitimate Phase 1 inputs rather than closeout defects.

## Exact repository entry points

### Unified stock price

- `scripts/lib/stock_price_provider.js`
  - `getDailyPrice`
  - `getClose`
  - `loadFromTwseMiIndex`
  - `loadFromHistorySma`
  - `loadFromLegacyFubon`
- `data_twse_mi_index/YYYYMMDD_twse_mi_index.json`
- `data_history_sma/<stock>.json`
- `data_fubon/fubon_YYYYMMDD_sma.json`

Provider priority is MI_INDEX -> data_history_sma -> legacy data_fubon. Missing/invalid close returns `null`, never zero.

### TWSE MI_INDEX and margin

- `.github/workflows/backfill-twse-core-range-data.yml`
- `scripts/plan_twse_core_range_backfill.js`
- `scripts/run_twse_core_range_backfill_batch.sh`
- `scripts/crawl_twse_mi_index.js`
- `scripts/twse_mi_index_maintenance.js`
- `scripts/crawl_twse_margin_balance.js`
- `data_twse_mi_index/YYYYMMDD_twse_mi_index.json`
- `data_twse_margin_balance/YYYYMMDD_twse_margin_balance.csv`
- `data_twse_margin_balance/files.json`

Source session dates are authoritative identities; Phase 0 did not verify durable historical intraday publication timestamps, so EOD facts must not be made available before session completion.

### Institutional-investor daily archives

- `data_twse_foreign_investors/files.json`
- `data_twse_foreign_investors/YYYYMMDD_twse_foreign_investors.json`
- `data_twse_investment_trust/files.json`
- `data_twse_investment_trust/YYYYMMDD_twse_investment_trust.json`
- `data_twse_dealers/files.json`
- `data_twse_dealers/YYYYMMDD_twse_dealers.json`

Foreign archive was verified to include at least `20251103` through `20260831`. Exact usable ranges for all actor families remain a Phase 1 mechanical coverage audit. Missing file/row is not zero.

### HiStock broker history

- `.github/workflows/backfill-histock-broker-history-research.yml`
- `scripts/lib/histock_broker_quality.js`
- `scripts/checkpoint_histock_batch_quality.js`
- `scripts/plan_histock_broker_history_backfill.js`
- `scripts/backfill_histock_broker_history_research_v2.js`
- `scripts/aggregate_histock_broker_history_research.js`
- `scripts/render_histock_broker_history_summary.js`
- `data_research/institutional-flow/histock/<stock>/daily/YYYYMMDD.json`
- `data_research/institutional-flow/histock/<stock>/batch-status/*.json`
- `data_research/institutional-flow/histock/<stock>/analysis.json`

The hard quality gate requires non-negative buy/sell, `net = buy - sell`, and positive average price. Missing/unresolved/quality-rejected are distinct from zero.

### TDCC

- `.github/workflows/backfill-tdcc-shareholding-history-2449.yml`
- `scripts/backfill_tdcc_shareholding_history.js`
- `tests/tdcc_shareholding_history_backfill.test.js`
- `data_tdcc_shareholding/history/2449/YYYYMMDD.json`
- `data_tdcc_shareholding/history/2449/manifest.json`

Critical restriction: historical artifacts explicitly carry `production_no_lookahead_safe=false` because original publication timestamps are unknown. Phase 1 must keep them `availability_unsafe`/excluded from PIT-safe feature values unless an independent publication contract is proven.

### Universe / industry

- `data_twse/twse_industry.csv`

No historical effective-dated industry membership was verified. Do not project current mapping backward automatically.

### Fundamental / disclosure timeline

- `.github/workflows/build-fundamental-event-timeline.yml`
- `scripts/fundamental_event_timeline.js`
- `scripts/build_fundamental_event_timeline.js`
- `tests/fundamental_event_timeline.test.js`
- `data_fundamental_events/<stock>/<year>.json`
- `data_fundamental_events/build-summary.json`
- `data_finmind_quarterly_financial_quality/<stock>/YYYYQn.json`

Availability-confidence concepts already distinguish official timestamp/date, aggregate snapshot date, fallback deadline, curated supplemental, and unknown. Period end is never availability time. The current workflow remains shadow-only.

### Withdrawal methodological precedent only

- `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`
- `data_research/institutional-flow/validation-plan-v1.md`
- `data_research/institutional-flow/institutional-withdrawal-expansion-protocol-v1.md`
- `scripts/analyze_institutional_distribution_events.js`
- `scripts/backtest_institutional_distribution_universe.js`
- `scripts/build_institutional_distribution_score.js`
- `.github/workflows/analyze-institutional-distribution-events.yml`
- `.github/workflows/backtest-institutional-distribution-universe.yml`

Do not create a generic institutional-flow framework merely from conceptual similarity.

## Point-in-time and missingness contract

Phase 0 freezes these conservative rules prospectively:

1. EOD institutional, margin, broker, and price/volume facts cannot be used before the source session is complete unless a verified timestamp proves earlier availability.
2. Historical TDCC is not PIT-safe while `production_no_lookahead_safe=false`.
3. Official disclosure timestamp is preferred; official date, aggregate snapshot date, and fallback known date are lower-confidence conservative states; unknown availability is excluded.
4. Accounting period end is never evidence availability time.
5. Catalyst/news evidence requires source identity plus publication/observation timestamp; retrospective explanations are forbidden.
6. Missing file, missing row, parse failure, unresolved task, quality rejection, availability unsafe, and explicit numeric zero are distinct states.
7. Only an explicit numeric zero from a valid source row may be treated as observed zero.

Phase 1 source-state vocabulary must preserve at least:

- `available`
- `missing`
- `quality_rejected`
- `availability_unsafe`
- `not_applicable`

## Prospective future outcome contract — not opened

Later validation may evaluate:

- absolute forward return;
- TAIEX-relative return;
- same-industry-relative return only where historical industry identity is PIT-safe;
- MFE;
- MAE;
- breakout/repricing occurrence;
- D+5/D+10/D+20/D+40 trading-session horizons.

Missing stock/benchmark observations remain missing. Numerical success/failure thresholds remain unfrozen and require an outcome-independent pre-outcome freeze gate if empirical scale information is necessary.

## Validation architecture

Keep separate:

- methodology development samples;
- untouched stock holdout;
- untouched time holdout where feasible;
- MediaTek motivation cases;
- final production-gate evidence.

Future sample selection must be deterministic and outcome-independent.

## Unresolved questions

1. Mechanically measure exact usable history for investment trust, dealers, MI_INDEX, margin, broker, and the unified provider for the intended prospective universe.
2. Durable historical intraday publication timestamps for TWSE institutional/margin/MI_INDEX archives were not verified.
3. TDCC historical publication timestamps remain unknown.
4. Historical effective-dated industry membership is not verified.
5. Complete timestamped historical catalyst/news/analyst-revision evidence is not verified.
6. Point-in-time free-float/share-base support is not yet audited.
7. Numerical repricing/success thresholds remain deliberately unfrozen.

## Next round

Active/promoted round:

`institutional-accumulation-point-in-time-contract-v1`

Execute only the preregistered **Prompt A — Phase 1 point-in-time feature/data contract** below when the repository owner next invokes `promptA` while this project remains the sole globally active task.

Do not execute Phase 2, select/freeze the development sample, or open candidate outcomes in Phase 1.

---

## Completed Prompt B — Phase 0 closeout / verification

The exact preregistered Prompt B for round `institutional-accumulation-preregistration-v1` is preserved durably in bootstrap commit `9d244fab0fe786393d8be72ab2f6327d306e7328` and closed with PASS as recorded above.

---

## Prompt A — Phase 1 point-in-time feature/data contract

Round identity:

`institutional-accumulation-point-in-time-contract-v1`

```text
Continue the Institutional Accumulation / Catalyst Pre-positioning research project in repository `EasonLiu0913/stock_data`.

This prompt is valid only after Phase 0 Prompt B has durably PASSed and explicitly promoted round `institutional-accumulation-point-in-time-contract-v1`.

Before doing any work:
1. Fetch current remote `main`.
2. Read repository-root `AGENTS.md`.
3. Read `docs/project-philosophy.md` and `docs/roadmap/current-phase.md`.
4. Read `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`.
5. Read `data_research/institutional-flow/institutional-accumulation-preregistration-v1.md`.
6. Verify durable Phase 0 Prompt B PASS and that this exact Phase 1 pair was preregistered before Phase 1 begins.

Phase 1 is OUTCOME-BLIND POINT-IN-TIME FEATURE/DATA CONTRACT ONLY.

Do not inspect candidate future returns, MFE/MAE, breakout/failure outcomes, or future catalyst/news. Do not select/freeze the development sample. Do not execute Phase 2. Do not build a production classifier or final weighted score.

Implement/document the narrow PIT observation contract for T-20/T-15/T-10/T-5/T-3/T-1/T0 using the exact entry points recorded in the handoff. Prefer a domain-specific contract over a generic institutional-flow framework.

Required behavior:
- preserve value separately from source-state/provenance;
- preserve at least states `available`, `missing`, `quality_rejected`, `availability_unsafe`, `not_applicable`;
- preserve source, source_file, source/session date, and publication/known-time or conservative availability rule where applicable;
- use `scripts/lib/stock_price_provider.js` for stock prices;
- treat EOD TWSE institutional/margin/broker/MI_INDEX data as unavailable before session completion unless stronger timestamp evidence is proven;
- keep historical TDCC `availability_unsafe` and excluded from PIT-safe feature values while its provenance says `production_no_lookahead_safe=false`;
- never silently coerce missing/unsafe/rejected to zero;
- do not use current industry mapping historically unless effective-date safety is proven;
- keep catalyst/disclosure evidence a separate optional layer, and admit only records whose availability can be proven conservatively;
- no large network backfill.

Mechanically measure existing-repository coverage/source-state rates over a prospectively chosen universe/date range. The choice must be outcome-independent and must not be tuned to the protected MediaTek episodes.

Define deterministic prospective event-anchor eligibility and data-completeness semantics, but do not select/freeze the development sample in this round.

Prompt A completion requires durable code/docs/tests as appropriate, a coverage audit, no future-outcome fields/artifacts, updated canonical handoff, preserved Phase 1 Prompt B, and a FUTURE / NOT PROMOTED Phase 2 paired prompt. Commit/push, refetch current main, and verify remote artifacts and changed-file scope.

When complete, report:
`Prompt A complete — ready for Prompt B`
and stop.
```

## Prompt B — Phase 1 closeout / verification

```text
Perform mandatory closeout for round `institutional-accumulation-point-in-time-contract-v1` only after it has been explicitly promoted and its Prompt A has completed.

Fetch current remote main; read `AGENTS.md`, the canonical Accumulation handoff, and preregistration; recover this exact preregistered Prompt B from durable history.

Verify at minimum:
1. all Phase 1 artifacts are outcome-blind and contain no candidate future returns/MFE/MAE/breakout/failure labels;
2. T-20/T-15/T-10/T-5/T-3/T-1/T0 and T0 trading-date semantics are explicit;
3. value is separate from source-state/provenance and missing/rejected/unsafe are never zero-filled;
4. unified stock-price provider is used rather than a new direct legacy price dependency;
5. EOD source availability is conservative;
6. TDCC historical data remains excluded/`availability_unsafe` unless an independently proven publication rule was preregistered before candidate outcomes;
7. historical industry membership is not guessed from current mapping;
8. catalyst/disclosure evidence remains separate and publication-time safe;
9. coverage/source-state audit is mechanical and outcome-independent;
10. no development sample was selected/frozen and Phase 2 was not executed;
11. Withdrawal v6.0-v6.5 and production prediction/strategy state remain untouched;
12. changed files, tests, commits, and remote durable artifacts satisfy the Phase 1 contract.

On PASS, update/commit the handoff and promote exactly one Phase 2 deterministic development sample/event-anchor freeze round using its already-preregistered pair. Do not execute Phase 2.

End with:
`Prompt B closeout: PASS`
and the promoted round identity/canonical handoff path, then stop.
```

## Safety / stop conditions

- No production strategy promotion.
- No future-outcome opening in Phase 0 or Phase 1.
- No MediaTek outcome-driven tuning.
- No large network backfill in Phase 0 or Phase 1.
- No modification of frozen Withdrawal methodology/validation state.
- Phase 1 Prompt A completion does not authorize Phase 1 Prompt B automatically.
- Phase 1 Prompt B PASS will authorize promotion, not execution, of the future Phase 2 Prompt A.
