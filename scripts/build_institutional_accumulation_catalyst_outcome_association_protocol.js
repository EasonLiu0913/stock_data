#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const EVENT_PATH = path.join(ROOT, 'data_research/institutional-flow/institutional-accumulation-catalyst-five-window-event-intelligence-v1.json');
const OUTPUT_PATH = path.join(ROOT, 'data_research/institutional-flow/institutional-accumulation-catalyst-outcome-association-protocol-v1.json');
const EVENT_GIT_BLOB_SHA1 = 'ee34b995148886ed4f4b27940c6a854fff26f3bb';
const EVENT_METHODOLOGY_SHA256 = '27e31156c9ba2f5a5d321784b5512074ed9a74217dbe7119249e2f31ac342a96';
const METHODOLOGY_ID = 'institutional-accumulation-catalyst-outcome-association-protocol-methodology-v1';
const METHODOLOGY_SHA256 = '5e57653500ae88d263915f1d74e3020e986736098c70e56cac114d16a1e315be';

const RULES = {
  "timezone": "Asia/Taipei",
  "regular_session": {
    "open": "09:00",
    "close": "13:30",
    "close_boundary": "exclusive_for_intraday_classification"
  },
  "availability_clock": "first_seen_at_only",
  "source_reported_at_role": "descriptive_only_never_backdates_availability",
  "t0": {
    "during_regular_session_on_eligible_trading_day": "same trading date is event session",
    "after_regular_close_or_before_open": "next eligible trading date is event session",
    "weekend_or_holiday": "next eligible trading date is event session",
    "baseline": "immediately previous eligible trading date close"
  },
  "returns": {
    "horizons": [
      "D1",
      "D3",
      "D5"
    ],
    "stock_formula": "100 * (close(event_session+horizon_index-1) / close(previous_eligible_session) - 1)",
    "benchmark_formula": "100 * (TAIEX_close(event_session+horizon_index-1) / TAIEX_close(previous_eligible_session) - 1)",
    "benchmark_relative_formula": "stock_return_pct - benchmark_return_pct",
    "d1_semantics": "event-session close versus previous eligible session close",
    "d3_semantics": "third eligible session close counting event session as 1 versus previous eligible session close",
    "d5_semantics": "fifth eligible session close counting event session as 1 versus previous eligible session close"
  },
  "institutional_flow": {
    "pre_window": "five eligible sessions immediately before event session (T-5..T-1)",
    "event_window": "event session only (T0/D1)",
    "post_windows": [
      "T0..T+2",
      "T0..T+4"
    ],
    "metrics_planned": [
      "foreign_net",
      "investment_trust_net",
      "dealer_net",
      "three_institutions_net"
    ],
    "aggregation": "sum net shares by stock over eligible sessions; no imputation"
  },
  "broker_flow": {
    "pre_window": "five eligible sessions immediately before event session",
    "post_window": "event session through fifth eligible session",
    "planned_metrics": [
      "total_net",
      "total_buy",
      "total_sell",
      "persistent_buyers",
      "persistent_sellers"
    ],
    "limitation": "HiStock is a ranked third-party broker view, not the complete official BSR ledger"
  },
  "margin_financing": {
    "baseline": "previous eligible session end-of-day financing balance",
    "horizons": [
      "event session",
      "D3",
      "D5"
    ],
    "planned_metrics": [
      "financing_balance_change",
      "short_balance_change"
    ],
    "rule": "use only same-stock TWSE margin rows for aligned eligible dates; no forward fill"
  },
  "tdcc_ownership": {
    "enabled_if_pit_safe": true,
    "pre_snapshot": "latest snapshot with available_at <= event first_seen_at",
    "post_snapshot": "first later archived snapshot whose available_at is <= the analysis cutoff being evaluated",
    "planned_metrics": [
      "large_holder_pct",
      "holder_400_lots_plus_pct",
      "small_holder_pct"
    ],
    "rule": "never backdate available_at to observed_date; absence remains missing"
  },
  "missing_data": {
    "imputation": "forbidden",
    "missing_event_policy": "retain event identity and emit explicit missing status/coverage flags",
    "partial_source_policy": "never convert missing source observations to zero",
    "return_requirement": "both baseline and horizon closes must exist or the horizon is missing"
  },
  "duplicate_and_cluster": {
    "event_identity": "companyId|marketKind|enterDate|serialNumber remains canonical",
    "same_day_multiple_events": "keep each canonical event as a separate event record",
    "stock_session_cluster": "also emit a stock+event-session cluster identifier for descriptive aggregation to avoid treating same-session announcements as independent evidence",
    "threshold_optimization": "forbidden",
    "significance_claim": "forbidden at n=11"
  },
  "analysis_scope": {
    "primary": "listing-level features for exactly 11 prospectively first-seen events",
    "secondary_detail": "the three captured-detail events are separate context only; they do not enter the primary cohort and require separate authorization before any outcome use",
    "exploratory_outputs": [
      "per-event joined record",
      "coverage counts",
      "descriptive distributions",
      "stock/session cluster counts"
    ],
    "prohibited": [
      "optimized threshold",
      "score",
      "rank",
      "predictive model",
      "production strategy",
      "statistical significance claim"
    ]
  }
};
const PROVIDERS = {
  "trading_calendar": {
    "path": "data_history_sma/trading_days.json",
    "role": "eligible trading-session calendar"
  },
  "stock_price": {
    "path": "scripts/lib/stock_price_provider.js",
    "export": "getClose",
    "fallback_order": [
      "data_twse_mi_index",
      "data_history_sma",
      "legacy_data_fubon"
    ]
  },
  "benchmark": {
    "path": "data_twse_market_chart/market_chart.json",
    "series": "TAIEX close"
  },
  "institutional": {
    "path": "scripts/crawl_history_twse_institutional_investors.js",
    "output_pattern": "data_twse_institutional_investors/YYYYMMDD_twse_institutional_investors.json"
  },
  "broker": {
    "path": "scripts/aggregate_histock_broker_history_research.js",
    "daily_pattern": "data_research/institutional-flow/histock/<stock>/daily/YYYYMMDD.json",
    "quality_guard": "scripts/lib/histock_broker_quality.js"
  },
  "margin": {
    "path": "scripts/crawl_twse_margin_balance.js",
    "output_pattern": "data_twse_margin_balance/YYYYMMDD_twse_margin_balance.csv"
  },
  "ownership": {
    "path": "scripts/crawl_tdcc_shareholding_snapshot.js",
    "manifest": "data_tdcc_shareholding/latest.json",
    "weekly_pattern": "data_tdcc_shareholding/weekly/<observed_date canonical file>",
    "pit_clock": "available_at"
  }
};

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}
function gitBlobSha1(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`);
  return crypto.createHash('sha1').update(header).update(buffer).digest('hex');
}
function readFrozenEventIntelligence() {
  const bytes = fs.readFileSync(EVENT_PATH);
  const blob = gitBlobSha1(bytes);
  if (blob !== EVENT_GIT_BLOB_SHA1) throw new Error(`Frozen Event Intelligence blob mismatch: ${blob}`);
  const payload = JSON.parse(bytes.toString('utf8'));
  if (payload?.methodology?.sha256 && payload.methodology.sha256 !== EVENT_METHODOLOGY_SHA256) {
    throw new Error('Frozen Event Intelligence methodology mismatch');
  }
  if (!Array.isArray(payload.events) || payload.events.length !== 180) throw new Error('Expected exactly 180 frozen events');
  return payload;
}
function buildProtocol() {
  if (sha256(METHODOLOGY_ID) !== METHODOLOGY_SHA256) throw new Error('Methodology hash constant mismatch');
  const source = readFrozenEventIntelligence();
  const primary = source.events.filter(event => event.first_seen_is_left_censored === false).map(event => ({
    event_identity: event.event_identity,
    stock: event.stock,
    first_seen_at: event.first_seen_at,
    source_reported_at: event.source_reported_at_first_observed,
    first_listing_taxonomy: event.first_listing_taxonomy,
    first_listing_features: event.first_listing_features
  }));
  const leftCensored = source.events.filter(event => event.first_seen_is_left_censored === true);
  const detailContext = source.events.filter(event => event.detail?.captured === true).map(event => ({
    event_identity: event.event_identity,
    stock: event.stock,
    first_seen_is_left_censored: event.first_seen_is_left_censored
  }));
  if (primary.length !== 11) throw new Error(`Primary cohort drift: ${primary.length}`);
  if (leftCensored.length !== 169) throw new Error(`Left-censored count drift: ${leftCensored.length}`);
  if (detailContext.length !== 3) throw new Error(`Captured detail context drift: ${detailContext.length}`);
  return {
    schema_version: 1,
    protocol_id: 'institutional-accumulation-catalyst-outcome-association-protocol-v1',
    methodology: { id: METHODOLOGY_ID, sha256: METHODOLOGY_SHA256, hash_basis: 'UTF-8 methodology id string' },
    frozen_event_intelligence: {
      path: 'data_research/institutional-flow/institutional-accumulation-catalyst-five-window-event-intelligence-v1.json',
      git_blob_sha1: EVENT_GIT_BLOB_SHA1,
      methodology_sha256: EVENT_METHODOLOGY_SHA256,
      event_count: source.events.length
    },
    cohort: {
      primary_count: primary.length,
      excluded_left_censored_count: leftCensored.length,
      primary_events: primary,
      captured_detail_context_count: detailContext.length,
      captured_detail_context: detailContext
    },
    rules: RULES,
    providers: PROVIDERS,
    authorization_gate: {
      outcome_values_read: false,
      outcome_association_execution_authorized: false
    },
    protected_state: {
      price_rows_read: false,
      institutional_values_read: false,
      broker_values_read: false,
      margin_values_read: false,
      ownership_values_read: false,
      protected_2454_outcomes_read: false,
      holdout_outcomes_read: false,
      withdrawal_outcomes_read: false,
      model_score_rank_strategy_production_opened: false
    },
    sample_warning: 'Primary prospective cohort n=11. Descriptive exploratory reporting only; no optimized threshold, ranking, predictive model, production strategy, or statistical-significance claim.'
  };
}
function serializeProtocol() {
  return JSON.stringify(buildProtocol(), null, 2) + '\n';
}
function main(argv = process.argv.slice(2)) {
  const content = serializeProtocol();
  if (argv.includes('--write')) {
    fs.writeFileSync(OUTPUT_PATH, content);
    console.log(`wrote ${path.relative(ROOT, OUTPUT_PATH)}`);
    return;
  }
  const checked = fs.readFileSync(OUTPUT_PATH, 'utf8');
  if (checked !== content) throw new Error('Protocol artifact is not byte-identical to deterministic regeneration');
  console.log('outcome-association protocol byte-match: PASS');
}
if (require.main === module) main();
module.exports = { buildProtocol, serializeProtocol, gitBlobSha1, sha256, RULES, PROVIDERS };
