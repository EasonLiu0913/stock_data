# Institutional Accumulation / Catalyst Pre-positioning — Preregistration v1

Methodology identity: `institutional-accumulation-preregistration-v1`

## Objective

Detect situations where price has not yet fully repriced upward, but capital capable of sustained institutional ownership/absorption has already changed behavior in a bullish direction.

This is research, not a production strategy.

## Core hypothesis

`institutional accumulation / supply absorption + price non-confirmation + optional later catalyst evidence -> elevated probability of subsequent upward repricing`

The project must test whether money moves before price, without assuming that all institutional buying is durable or predictive.

## Mandatory conceptual layers

Keep these separate until evidence supports combining them:

1. Institutional Accumulation
2. Supply Absorption
3. Price Non-confirmation
4. Catalyst Evidence / Catalyst Proximity
5. Repricing Readiness
6. Crowding / Retail-chasing Risk

No final arbitrary weighted score is frozen in this preregistration.

## Institutional actor semantics

Audit and distinguish at minimum:

- foreign investors;
- investment trust;
- dealers;
- broker branch activity;
- TDCC large-holder ownership/concentration;
- margin financing and other available retail-leverage proxies.

Candidate concepts include single-day flow, multi-day accumulation, persistence, concentration, participation relative to volume/free float where supportable, and synchronized accumulation across independent sources.

Do not assume equal persistence across actor classes.

## Price non-confirmation research family

Candidate formulations may later include:

- institutional-flow percentile vs contemporaneous return percentile;
- accumulation z-score minus price-return z-score;
- cumulative institutional absorption with muted price movement;
- strong institutional participation while price remains inside a base/range;
- market-relative or industry-relative price response.

No winning formula is selected yet.

## Supply absorption research family

Candidate concepts include:

- turnover/volume vs institutional net purchases;
- price impact per unit of institutional buying;
- repeated high-volume sessions with limited downside;
- narrowing downside response while accumulation persists.

No winning formula is selected in Phase 0.

## Catalyst boundary

Catalyst Pre-positioning is a later extension. A catalyst may be used at date/time T only if the evidence was publicly available by T under a conservative point-in-time policy.

Potential evidence families include company disclosures, revenue/earnings information, analyst-revision evidence preserved in repository research, customer/supply-chain evidence, structured theme/catalyst research, corporate actions, and capital-raising/investment announcements.

Future news explaining a later rally is forbidden as a T feature.

## Protected motivation cases

MediaTek `2454` episodes that motivated the project:

- May 2026 upward repricing wave;
- June 2026 upward repricing wave;
- late-August / 2026-09-01 upward repricing wave.

Status: `motivation_cases_only`.

They may not be used to reverse-engineer thresholds, choose features because they fit those rallies, or count as validation evidence during preregistration/development. They may only be revisited as illustrative retrospective sanity checks after a methodology version has been frozen independently.

## Outcome-blindness rule

Before an explicit later outcome-opening round, do not inspect, generate for optimization, rank by, or summarize candidate-specific:

- D+1/D+3/D+5/D+10/D+20/D+40 future returns;
- future MFE/MAE;
- future breakout/repricing success;
- future failure/reclaim labels;
- future catalyst/news evidence unavailable at the anchor date.

Existing outcome artifacts from unrelated projects must not influence stock selection, thresholds, factor definitions, windows, or sample identity.

## Initial feature observation family

Unless evidence later requires a preregistered revision, use:

- T-20
- T-15
- T-10
- T-5
- T-3
- T-1
- T0

T0 must be defined conservatively from source-derived market/trading dates rather than runner-clock convenience.

## Prospective future outcome families

Future validation may evaluate, after proper sample freeze:

Absolute:

- forward return;
- maximum favorable excursion;
- maximum adverse excursion;
- breakout/repricing occurrence.

Relative:

- return minus TAIEX;
- return minus same-industry baseline where mechanically supportable and point-in-time industry identity is defensible.

Candidate horizons:

- D+5
- D+10
- D+20
- D+40

Prospective session contract:

- horizons count exchange trading sessions, not calendar days;
- the outcome base is the frozen anchor/session convention defined before outcome opening;
- stock prices must come through the unified price provider;
- TAIEX dates must align to the same trading-session sequence;
- a missing stock/benchmark observation remains missing and is never converted to zero return;
- same-industry-relative outcomes are omitted when historical industry membership cannot be proven point-in-time safe.

Exact numerical success/failure thresholds remain unfrozen. If thresholds require empirical scale/distribution evidence, a dedicated outcome-independent pre-outcome threshold-freeze gate must precede candidate outcome opening.

## False-positive taxonomy

At minimum preserve these failure classes:

- transient institutional trading rather than durable accumulation;
- accumulation with no repricing;
- short-lived pop followed by failure;
- catalyst fails to materialize;
- catalyst materializes but was already priced in;
- retail/margin crowding overwhelms the signal;
- market/industry beta explains the move rather than stock-specific accumulation.

## Development / holdout architecture

The project must separate:

- methodology development samples;
- untouched stock holdout;
- untouched time holdout where feasible;
- MediaTek motivation cases;
- final production-gate evidence.

Future sample selection must be deterministic and outcome-independent.

Required lifecycle:

`outcome-blind selection -> durable sample freeze -> stop -> later round opens outcomes`

Never use `see outcome -> alter rule -> call same sample validation`.

## Phase 0 source / semantics audit

The following inventory is the verified current-main starting contract. Exact repository paths are recorded where Phase 0 verified them. A path or timestamp behavior not proven by repository evidence is explicitly left unresolved rather than guessed.

### Unified historical stock-price provider

Exact implementation:

- `scripts/lib/stock_price_provider.js`
  - stable entry points: `getDailyPrice`, `getClose`;
  - source loaders: `loadFromTwseMiIndex`, `loadFromHistorySma`, `loadFromLegacyFubon`.

Verified priority:

1. `data_twse_mi_index/YYYYMMDD_twse_mi_index.json`
2. `data_history_sma/<stock>.json`
3. `data_fubon/fubon_YYYYMMDD_sma.json` as legacy fallback.

Semantics:

- date argument is a trading-date identity in `YYYYMMDD` form;
- valid records expose OHLC, volume, `source`, and `source_file`;
- an absent/invalid/non-positive close yields `null`, not zero;
- Phase 1 must use this provider rather than create another direct legacy price-source dependency.

Historical coverage is source-dependent. Broader coverage may require existing price backfills, but no network collection was performed in Phase 0.

### TWSE MI_INDEX / official price-volume

Exact paths:

- `.github/workflows/backfill-twse-core-range-data.yml`
- `scripts/plan_twse_core_range_backfill.js`
- `scripts/run_twse_core_range_backfill_batch.sh`
- `scripts/crawl_twse_mi_index.js`
- `scripts/twse_mi_index_maintenance.js`
- `data_twse_mi_index/YYYYMMDD_twse_mi_index.json`

The crawler validates TWSE `stat`, payload date, table/field/data structure, and rejects/retries request/response date mismatch. Saved filename uses the source payload date.

Point-in-time rule:

- the payload date is authoritative session identity;
- Phase 0 did not verify a durable historical publication timestamp for each archive;
- therefore same-session intraday availability must not be assumed; Phase 1 should conservatively treat EOD-derived MI_INDEX values as available only after the session is complete unless a stronger source-specific timestamp contract is proven.

Missing file, missing quote table, missing stock row, or invalid price means unknown/missing, never zero.

### TWSE institutional-investor archives

Verified durable archive paths:

- `data_twse_foreign_investors/files.json`
- `data_twse_foreign_investors/YYYYMMDD_twse_foreign_investors.json`
- `data_twse_investment_trust/files.json`
- `data_twse_investment_trust/YYYYMMDD_twse_investment_trust.json`
- `data_twse_dealers/files.json`
- `data_twse_dealers/YYYYMMDD_twse_dealers.json`

Foreign-investor manifest was verified to contain durable daily history at least from `20251103` through `20260831` during Phase 0. Investment-trust/dealer manifests were also verified as current archive entry points; exact useful range must be measured mechanically in Phase 1 rather than inferred from directory existence.

Point-in-time / missingness rule:

- archive date is the source trading-session identity;
- Phase 0 did not verify durable per-day historical publication timestamps, so these EOD facts must not be made available before the source session has completed;
- a numeric zero in a valid official row may be used as a true observed zero only when the row/schema explicitly supplies that value;
- absence of the daily file, parsing failure, or absence of a stock row is `missing/unknown` unless a later source contract proves that omission has true-zero semantics.

The exact historical collector implementation for all three archives was not needed to prove the durable archive contract and remains an explicit Phase 1 inventory item if collection expansion is required. Do not invent a collector path.

### Margin financing / retail leverage

Exact paths:

- `.github/workflows/backfill-twse-core-range-data.yml`
- `scripts/crawl_twse_margin_balance.js`
- `data_twse_margin_balance/YYYYMMDD_twse_margin_balance.csv`
- `data_twse_margin_balance/files.json`

Canonical stock columns include financing/security buy, sell, repayment, previous/current balance, limits, day-trade offset, and note fields. Historical TWSE date normalization is validated; request/source mismatch is rejected and invalid existing files are replaced.

Point-in-time / missingness rule:

- archive date is official session identity;
- exact historical same-day publication timestamp is not persisted in the verified contract, so treat as EOD/next-observable-session information rather than intraday T0 evidence;
- valid row numeric zero may be true zero;
- missing/invalid file or missing stock row remains missing, not zero.

### HiStock normalized broker history

Exact paths:

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

The shared hard quality gate requires non-negative buy/sell, `net = buy - sell`, and positive average price; any bad row invalidates the daily file. Planner states distinguish valid, quality-rejected, and missing tasks.

Point-in-time / missingness rule:

- `missing`, `unresolved`, and `quality_rejected` are not zero;
- historical scrape date alone does not prove the original data was published by an earlier intraday instant;
- Phase 1 must conservatively assign availability after the relevant source session unless stronger provenance exists.

Broader stock/date coverage requires network collection and therefore a later plan + fresh-runner physical-batch workflow; no such backfill belongs to Phase 0.

### TDCC ownership / concentration history

Exact paths:

- `.github/workflows/backfill-tdcc-shareholding-history-2449.yml`
- `scripts/backfill_tdcc_shareholding_history.js`
- `tests/tdcc_shareholding_history_backfill.test.js`
- `data_tdcc_shareholding/history/2449/YYYYMMDD.json`
- `data_tdcc_shareholding/history/2449/manifest.json`

Verified stored derived fields include `large_holder_pct` and `small_holder_pct` for the 2449 bootstrap.

Critical point-in-time rule:

- these are official historical observations, but the workflow explicitly requires `historical_backfill === true` and `production_no_lookahead_safe === false`;
- the reason recorded by the workflow is that original publication timestamps are unknown;
- therefore nominal historical TDCC observation dates MUST NOT be treated as proof that the value was knowable at that anchor;
- Phase 1 must classify this historical TDCC evidence as `availability_unsafe`/excluded from PIT-safe feature values until a defensible publication-lag or timestamp contract is independently proven.

Missing/unresolved TDCC dates are missing, not zero. Existing bootstrap is stock-specific; broader coverage would require later network collection under repository batch rules.

### Stock / industry universe

Exact verified path:

- `data_twse/twse_industry.csv`

It is an operational stock/industry universe input used by research workflows, including HiStock planning.

Point-in-time limitation:

- Phase 0 did not verify historical effective-dated industry-membership snapshots;
- therefore current/static industry mapping must not automatically be projected backward as historical truth;
- same-industry-relative features/outcomes are only allowed where Phase 1 can prove the relevant historical mapping is point-in-time safe; otherwise mark them unsupported/missing.

### Fundamental-event / disclosure availability infrastructure

Exact paths:

- `.github/workflows/build-fundamental-event-timeline.yml`
- `scripts/fundamental_event_timeline.js`
- `scripts/build_fundamental_event_timeline.js`
- `tests/fundamental_event_timeline.test.js`
- `data_fundamental_events/<stock>/<year>.json`
- `data_fundamental_events/build-summary.json`
- fallback input family `data_finmind_quarterly_financial_quality/<stock>/YYYYQn.json`.

The builder distinguishes availability confidence including:

- `official_timestamp` for material information with official date + time;
- `official_date` when only an official publication date is available;
- `aggregate_snapshot_date` for official monthly-revenue OpenAPI snapshots;
- `fallback_deadline` for conservative financial-report fallback dates;
- `curated_supplemental` and `unknown` where applicable.

Important semantics:

- fiscal/measurement period is never itself an availability timestamp;
- material disclosures with official timestamps may only enter after that timestamp, mapped conservatively to the effective trading session;
- monthly OpenAPI `出表日期` is explicitly an aggregate snapshot date, not a company publication time;
- fallback financial values may only enter on/after their conservative known date;
- missing/unknown availability evidence remains unavailable, not zero.

The existing workflow is shadow-only (`production_integration=false`). It is evidence infrastructure, not permission to add catalyst features to the Accumulation core in Phase 1.

### Catalyst / news evidence

No generic retrospective news article is PIT-safe merely because it describes an event later. A future Catalyst Pre-positioning extension must carry source identity plus publication/observation timestamp precise enough to prove availability at T.

Phase 0 verified the official fundamental-event timeline above as a possible future source family. It did not verify a complete timestamped historical analyst-revision, customer/supply-chain, or general-news archive suitable for leakage-free use. Those families remain unavailable until independently audited.

### Withdrawal methodological precedent

Exact precedent entry points include:

- `data_research/institutional-flow/institutional-withdrawal-validation-handoff.md`
- `data_research/institutional-flow/validation-plan-v1.md`
- `data_research/institutional-flow/institutional-withdrawal-expansion-protocol-v1.md`
- `scripts/analyze_institutional_distribution_events.js`
- `scripts/backtest_institutional_distribution_universe.js`
- `scripts/build_institutional_distribution_score.js`
- `.github/workflows/analyze-institutional-distribution-events.yml`
- `.github/workflows/backtest-institutional-distribution-universe.yml`

Only source parsing, date handling, coverage discipline, and validation architecture may be reused where semantics genuinely match. Frozen Withdrawal v6.0-v6.5 classifier/lifecycle rules, outcomes, metrics, and holdout identities are not Accumulation inputs and must not be modified.

## Conservative point-in-time availability rules frozen by Phase 0

1. **Trading-session data:** source trading date identifies the session, not necessarily an intraday publication instant. EOD-derived institutional, margin, broker, and price/volume facts are not usable before the session is complete unless a verified timestamp says otherwise.
2. **TDCC historical backfill:** excluded from PIT-safe feature values while `production_no_lookahead_safe=false`.
3. **Disclosures:** official timestamp is preferred; official date is second-best; aggregate snapshot/fallback dates are conservative lower-confidence availability states; unknown availability is excluded.
4. **Fundamentals:** accounting period end is never availability time. Use actual disclosure/known-date provenance.
5. **Catalyst/news:** require publication/observation timestamp and source identity; retrospective explanations are forbidden.
6. **Missingness:** missing file, missing row, parse failure, unresolved task, quality rejection, availability-unsafe source, and true numeric zero are distinct states.
7. **No silent zero fill:** only an explicit numeric zero from a valid source row is eligible to mean observed zero.

## Phase 1 required source-state vocabulary

The next round should implement or document a narrow contract that preserves at least:

- `available`
- `missing`
- `quality_rejected`
- `availability_unsafe`
- `not_applicable`

A numeric feature value and its availability/source state must remain distinguishable. The contract must preserve `source`, `source_file`, source/trading date, and known/publication time or conservative availability rule where applicable.

## Unresolved questions after Phase 0

These are evidence gaps, not permission to guess:

1. Exact earliest/latest usable coverage for investment-trust, dealer, MI_INDEX, margin, broker, and unified-provider histories must be measured mechanically in Phase 1 for the intended sample universe.
2. Durable historical publication timestamps for TWSE institutional/margin/MI_INDEX archives were not verified; same-session intraday use remains forbidden.
3. Historical TDCC publication timestamps are unknown and the existing bootstrap is explicitly not no-lookahead-safe.
4. Historical effective-dated industry membership is not yet verified; same-industry relative comparisons may need to be omitted or separately sourced.
5. A complete leakage-safe historical catalyst/news/analyst-revision archive was not verified; catalyst evidence remains a later extension.
6. Participation versus free float is only supportable if a point-in-time free-float/share-base source is independently audited.
7. Final numerical repricing/success thresholds remain unfrozen and require an outcome-independent pre-outcome freeze gate if empirical scale information is necessary.

## Ordered Phase 1 proposal — future, not yet promoted

Proposed round identity: `institutional-accumulation-point-in-time-contract-v1`.

Order:

1. Freeze a machine-readable/normative PIT observation contract for T-20/T-15/T-10/T-5/T-3/T-1/T0 without candidate outcomes.
2. Implement only narrowly necessary source adapters/normalizers and tests needed to express the verified source families under the source-state vocabulary; reuse the unified stock-price provider.
3. Mechanically inventory actual coverage and source-state rates for a prospective universe/date window without using future returns or MediaTek outcomes to choose the window.
4. Keep TDCC historical values excluded/`availability_unsafe` unless an independent publication-time rule is proven before inspection of candidate outcomes.
5. Keep catalyst evidence separate; only timestamp-safe fundamental/disclosure records may be represented as optional evidence metadata, not used to tune the core Accumulation rule.
6. Define deterministic event-anchor eligibility and the data-completeness contract prospectively, but do not freeze/select the development sample yet.
7. Record unresolved coverage limitations and preregister the Phase 2 deterministic sample/event-anchor freeze pair.
8. Stop before Phase 2 sample selection and before all future outcomes.

Phase 1 remains outcome-blind and is not authorized until Phase 0 Prompt B passes and promotes it.
