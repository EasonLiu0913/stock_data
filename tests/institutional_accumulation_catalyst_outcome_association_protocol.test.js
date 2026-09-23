'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProtocol, serializeProtocol, sha256 } = require('../scripts/build_institutional_accumulation_catalyst_outcome_association_protocol');

test('methodology identity is frozen before outcome access', () => {
  const p = buildProtocol();
  assert.equal(p.methodology.sha256, sha256(p.methodology.id));
  assert.equal(p.authorization_gate.outcome_values_read, false);
  assert.equal(p.authorization_gate.outcome_association_execution_authorized, false);
});

test('primary cohort is exactly 11 prospectively first-seen events', () => {
  const p = buildProtocol();
  assert.equal(p.cohort.primary_count, 11);
  assert.equal(p.cohort.excluded_left_censored_count, 169);
  assert.equal(new Set(p.cohort.primary_events.map(x => x.event_identity)).size, 11);
  assert.deepEqual(
    p.cohort.primary_events.map(x => x.event_identity),
    ["1102|sii|1150915|1","1102|sii|1150922|1","1216|sii|1150916|1","1216|sii|1150918|1","1216|sii|1150918|2","1216|sii|1150918|3","1216|sii|1150918|4","1216|sii|1150918|5","1216|sii|1150922|1","1216|sii|1150923|1","1216|sii|1150923|2"]
  );
});

test('first-seen availability is never replaced by source-reported time', () => {
  const p = buildProtocol();
  assert.equal(p.rules.availability_clock, 'first_seen_at_only');
  assert.match(p.rules.source_reported_at_role, /never_backdates/);
  for (const row of p.cohort.primary_events) {
    assert.ok(row.first_seen_at);
    assert.ok(Object.hasOwn(row, 'source_reported_at'));
  }
});

test('D1 D3 D5 and benchmark-relative formulas are preregistered', () => {
  const p = buildProtocol();
  assert.deepEqual(p.rules.returns.horizons, ['D1','D3','D5']);
  assert.match(p.rules.returns.stock_formula, /previous_eligible_session/);
  assert.equal(p.rules.returns.benchmark_relative_formula, 'stock_return_pct - benchmark_return_pct');
});

test('provider entry points are exact repository paths', () => {
  const p = buildProtocol();
  assert.equal(p.providers.stock_price.path, 'scripts/lib/stock_price_provider.js');
  assert.equal(p.providers.stock_price.export, 'getClose');
  assert.equal(p.providers.institutional.path, 'scripts/crawl_history_twse_institutional_investors.js');
  assert.equal(p.providers.broker.path, 'scripts/aggregate_histock_broker_history_research.js');
  assert.equal(p.providers.margin.path, 'scripts/crawl_twse_margin_balance.js');
  assert.equal(p.providers.ownership.path, 'scripts/crawl_tdcc_shareholding_snapshot.js');
});

test('captured detail context stays separate from primary analysis', () => {
  const p = buildProtocol();
  assert.equal(p.cohort.captured_detail_context_count, 3);
  assert.match(p.rules.analysis_scope.secondary_detail, /separate context only/);
});

test('no tuning, ranking, model or production promotion is authorized', () => {
  const p = buildProtocol();
  assert.deepEqual(p.rules.analysis_scope.prohibited, [
    'optimized threshold','score','rank','predictive model','production strategy','statistical significance claim'
  ]);
  assert.equal(p.protected_state.model_score_rank_strategy_production_opened, false);
});

test('checked-in serialization carries no outcome values', () => {
  const p = JSON.parse(serializeProtocol());
  for (const value of Object.values(p.protected_state)) assert.equal(value, false);
  assert.equal(p.authorization_gate.outcome_values_read, false);
  assert.equal(p.authorization_gate.outcome_association_execution_authorized, false);
});
