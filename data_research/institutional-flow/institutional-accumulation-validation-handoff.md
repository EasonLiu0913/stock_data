# Institutional Accumulation / Catalyst Pre-positioning Research — Handoff

Canonical handoff: `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`

## Current phase

**Phase 0 — outcome-blind preregistration and source/semantics audit: Prompt A complete, Prompt B pending.**

Active/promoted round:

`institutional-accumulation-preregistration-v1`

Status:

- Prompt A: **COMPLETE**
- Prompt B: **PREREGISTERED / PENDING**
- future round `institutional-accumulation-point-in-time-contract-v1`: **PREREGISTERED / NOT PROMOTED**

Do not execute Phase 1 until this round's Prompt B passes and explicitly promotes it.

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

The canonical preregistration now contains:

- exact verified repository paths for source/implementation entry points;
- source-by-source date, point-in-time, missingness, and zero semantics;
- explicit TDCC historical no-lookahead limitation;
- unified price-provider contract;
- conservative disclosure/fundamental availability semantics;
- prospective outcome/session semantics without opening outcomes;
- unresolved evidence questions;
- ordered Phase 1 proposal.

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

The current active round is still:

`institutional-accumulation-preregistration-v1`

Prompt A is complete. The only authorized next action is the same preregistered **Prompt B — Phase 0 closeout / verification** below.

Do not promote or execute Phase 1 merely because its future pair is now preregistered.

---

## Prompt B — Phase 0 closeout / verification

```text
Perform mandatory Prompt B closeout for the Institutional Accumulation / Catalyst Pre-positioning project in repository `EasonLiu0913/stock_data`.

Round to verify:

`institutional-accumulation-preregistration-v1`

This Prompt B was preregistered before Prompt A execution.

Do not begin Phase 1.

Before verification:
1. Fetch current remote `main`.
2. Read repository-root `AGENTS.md`.
3. Read `docs/project-philosophy.md` and `docs/roadmap/current-phase.md`.
4. Read `data_research/institutional-flow/institutional-accumulation-validation-handoff.md`.
5. Read `data_research/institutional-flow/institutional-accumulation-preregistration-v1.md`.
6. Read `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md` as methodological precedent.
7. Recover durable repository history and verify this exact phase-specific Prompt B was preregistered for this round before Prompt A began.

Use remote repository evidence, not the Prompt A summary, as source of truth.

### Gate 1 — durable artifacts

Verify remote `main` contains both canonical Accumulation documents, committed and pushed, with unambiguous project/methodology/round identity. Record commit SHA evidence.

### Gate 2 — correct research direction

Verify the project still targets `durable institutional behavior changes before upward price repricing`, not a simplistic foreign-buy, technical-breakout, volume-spike, news-sentiment, or analyst-call rule.

Verify the six conceptual layers remain separately represented and no arbitrary final weighted score was frozen without evidence.

### Gate 3 — outcome blindness / leakage

Audit changed files and methodology history. Verify Prompt A did not calculate/use candidate future returns, MFE/MAE, future breakout labels, or future catalyst/news evidence to select features, windows, formulas, thresholds, or samples.

Verify MediaTek `2454` May, June, and late-August/2026-09-01 episodes remain `motivation_cases_only` and were not tuned against.

If future outcome information contaminated methodology decisions, FAIL. Do not repair contamination by merely deleting the visible result; redesign the affected methodology/sample boundary.

### Gate 4 — point-in-time semantics

Verify explicit availability/leakage/missingness policy exists for institutional investor, broker, TDCC, margin, price/volume, disclosure/fundamental, and catalyst/news evidence. Future-publication evidence must not be usable at earlier anchors. Missing must not silently equal zero unless proven by source semantics.

### Gate 5 — exact source inventory

Verify exact repo-relative paths were recorded for all source/implementation entry points actually verified by Prompt A, including stable symbols where useful. Conceptual names alone are insufficient when exact paths are known.

For material sources verify the documentation records where determinable: schema/role, date semantics, useful coverage, missingness, point-in-time safety, and network-backfill requirement.

### Gate 6 — Withdrawal protection / evidence-before-abstraction

Compare pre-Prompt-A and current remote state. Verify frozen Withdrawal v6.0-v6.5 code/specs, outcomes/metrics, and holdout state were not changed for Accumulation. Verify no premature generic institutional-flow abstraction was introduced without repeated-use evidence.

### Gate 7 — prospective feature/outcome contract

Verify the T-20/T-15/T-10/T-5/T-3/T-1/T0 observation family is preserved or any change is prospectively justified by repository evidence.

Verify future absolute, TAIEX-relative, same-industry-relative where supportable, MFE, MAE, repricing/breakout outcomes and candidate D+5/D+10/D+20/D+40 horizons are defined prospectively without candidate outcome values being opened.

### Gate 8 — validation architecture

Verify durable separation of development samples, untouched stock holdout, untouched time holdout where feasible, MediaTek motivation cases, and final production-gate evidence.

Verify the future lifecycle requires:
`outcome-blind selection -> durable sample freeze -> stop -> later round opens outcome`.

### Gate 9 — false positives

Verify the documented failure taxonomy includes transient trading, no repricing, temporary pop then failure, catalyst non-materialization, already-priced catalyst, retail/margin crowding, and market/industry beta explanations.

### Gate 10 — changed-file audit

Review every file changed during the round. Expected changes are research documentation and narrowly necessary documentation references. Fail or bounded-repair unexpected production strategy, registry, prediction/replay, frozen Withdrawal, unrelated workflow, source-data, large-backfill, or future-outcome changes.

No large network collection belongs in Phase 0.

### PASS behavior

PASS only if durable artifacts exist, outcome blindness is intact, point-in-time rules are explicit, MediaTek cases are protected, exact entry points are recorded, Withdrawal remains untouched, and the next round remains pre-outcome.

Bounded documentation/contract defects may be repaired, committed/pushed, refetched, and reverified. Outcome contamination is not a trivial bounded repair.

On PASS:
1. update the canonical handoff with Prompt A commits, Prompt B evidence, changed-file audit, PASS state, and unresolved questions;
2. promote exactly one following round — normally Phase 1 outcome-blind point-in-time feature/data contract unless evidence requires a different pre-outcome step;
3. preserve the already-preregistered future Prompt A/B pair or repair it before promotion if Phase 0 evidence required a prospective change;
4. commit/push the handoff;
5. refetch current remote `main` and verify durable promotion state;
6. do not execute the newly promoted Prompt A.

End with:

`Prompt B closeout: PASS`

plus the newly promoted round identity and exact canonical handoff path, then stop.
```

---

## FUTURE / NOT PROMOTED — Prompt A — Phase 1 point-in-time feature/data contract

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

## FUTURE / NOT PROMOTED — Prompt B — Phase 1 closeout / verification

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
- No large network backfill in Phase 0.
- No modification of frozen Withdrawal methodology/validation state.
- Current Prompt A completion does not authorize current Prompt B automatically.
- Current Prompt B PASS will authorize promotion, not execution, of the future Phase 1 Prompt A.
