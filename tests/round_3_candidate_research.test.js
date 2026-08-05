'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyMarketRegime,
  calculateCrowdingWeakening,
  evaluateExpression,
  deduplicateEvents,
  evaluatePromotionGate,
  summarizeCandidate,
  buildCompactSummary,
} = require('../scripts/round_3_candidate_research_lib');

function rows(closes, sma20 = 100) {
  return closes.map((close, index) => ({
    date: `202607${String(index + 1).padStart(2, '0')}`,
    close,
    sma20,
  }));
}

function outcome(excess = 1, value = 2) {
  return {
    forward_return_1d_pct: value / 3,
    forward_return_3d_pct: value / 2,
    forward_return_5d_pct: value,
    forward_excess_return_5d_pct: excess,
  };
}

test('market regime uses explicit bull and bear thresholds', () => {
  assert.equal(classifyMarketRegime(3), 'bull');
  assert.equal(classifyMarketRegime(-3), 'bear');
  assert.equal(classifyMarketRegime(0), 'sideways');
  assert.equal(classifyMarketRegime(null), 'unknown');
});

test('margin crowding weakening needs crowding, five-day weakness, SMA20 break, and latest down day', () => {
  const weakening = calculateCrowdingWeakening(
    rows([105, 104, 103, 102, 101, 99], 100),
    { available: true, pass: true },
  );
  assert.equal(weakening.available, true);
  assert.equal(weakening.pass, true);

  const noCrowding = calculateCrowdingWeakening(
    rows([105, 104, 103, 102, 101, 99], 100),
    { available: true, pass: false },
  );
  assert.equal(noCrowding.pass, false);

  const aboveSma = calculateCrowdingWeakening(
    rows([105, 104, 103, 102, 101, 101], 100),
    { available: true, pass: true },
  );
  assert.equal(aboveSma.pass, false);
});

test('candidate expressions preserve unknown states instead of treating missing data as false', () => {
  const expression = { all: ['a'], any: ['b', 'c'], not: ['risk'] };
  assert.equal(evaluateExpression(expression, { a: true, b: true, c: false, risk: false }), true);
  assert.equal(evaluateExpression(expression, { a: true, b: false, c: false, risk: false }), false);
  assert.equal(evaluateExpression(expression, { a: true, b: null, c: false, risk: false }), null);
  assert.equal(evaluateExpression(expression, { a: true, b: true, risk: null }), null);
});

test('five-trading-day cooldown collapses repeated daily signals into independent events', () => {
  const dates = ['20260701', '20260702', '20260703', '20260706', '20260707', '20260708', '20260709'];
  const events = [0, 1, 3, 4, 5].map(index => ({
    candidate_id: 'candidate_a',
    stock_code: '2330',
    signal_date: dates[index],
  }));
  const result = deduplicateEvents(events, dates, 5);
  assert.deepEqual(result.kept.map(item => item.signal_date), ['20260701', '20260708']);
  assert.equal(result.suppressed.length, 3);
});

test('promotion gate rejects a long candidate without enough stable test regimes', () => {
  const definition = {
    candidate_id: 'candidate_a',
    family_id: 'candidate_a',
    version: 1,
    label: 'A',
    kind: 'candidate_strategy',
    objective: 'long_relative',
    promotion_gate: {
      min_validation_events: 1,
      min_test_events: 1,
      min_test_regime_events: 1,
      min_test_regimes: 2,
      min_validation_average_excess_return_5d_pct: 0,
      min_test_average_excess_return_5d_pct: 0.5,
      min_test_positive_excess_return_5d_rate_pct: 55,
    },
  };
  const events = [
    { candidate_id: 'candidate_a', stock_code: '1', split: 'validation', market_regime: 'bull', outcome: outcome(1) },
    { candidate_id: 'candidate_a', stock_code: '1', split: 'test', market_regime: 'bull', outcome: outcome(1) },
  ];
  const summary = summarizeCandidate(events, definition);
  const assessment = evaluatePromotionGate(summary, definition);
  assert.equal(assessment.passed, false);
  assert.match(assessment.reasons.join('\n'), /qualified test regimes/);
});

test('promotion gate can pass a stable long candidate across two test regimes', () => {
  const definition = {
    candidate_id: 'candidate_a',
    family_id: 'candidate_a',
    version: 1,
    label: 'A',
    kind: 'candidate_strategy',
    objective: 'long_relative',
    promotion_gate: {
      min_validation_events: 1,
      min_test_events: 2,
      min_test_regime_events: 1,
      min_test_regimes: 2,
      min_validation_average_excess_return_5d_pct: 0,
      min_test_average_excess_return_5d_pct: 0.5,
      min_test_positive_excess_return_5d_rate_pct: 55,
    },
  };
  const events = [
    { candidate_id: 'candidate_a', stock_code: '1', split: 'validation', market_regime: 'sideways', outcome: outcome(1) },
    { candidate_id: 'candidate_a', stock_code: '1', split: 'test', market_regime: 'bull', outcome: outcome(1) },
    { candidate_id: 'candidate_a', stock_code: '2', split: 'test', market_regime: 'bear', outcome: outcome(1) },
  ];
  const summary = summarizeCandidate(events, definition);
  const assessment = evaluatePromotionGate(summary, definition);
  assert.equal(assessment.passed, true);
  assert.equal(assessment.status, 'promotion_eligible');
});

test('compact summary excludes event rows while preserving research safeguards', () => {
  const summary = buildCompactSummary({
    research_id: 'round_3',
    candidate_registry_id: 'registry',
    generated_at: '2026-08-05T00:00:00.000Z',
    cutoff_date: '20260804',
    source_date_range: ['20260501', '20260804'],
    eligible_signal_date_range: ['20260601', '20260728'],
    chronological_splits: {},
    cooldown_trading_days: 5,
    market_regime_definition: {},
    leakage_guard: { random_split_used: false },
    source_file_count: { price: 60, margin: 60 },
    raw_signal_count: { candidate_a: 10 },
    events: [{ candidate_id: 'candidate_a' }],
    cooldown_suppressed_events: [{ candidate_id: 'candidate_a' }],
    summaries: { candidate_a: { all: { event_count: 1 } } },
  });
  assert.equal(summary.independent_event_count, 1);
  assert.equal(summary.cooldown_suppressed_count, 1);
  assert.equal(summary.events, undefined);
  assert.equal(summary.leakage_guard.random_split_used, false);
});
