'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { primaryExternalValidation, trailingReturn } = require('../scripts/market_environment_lib');
const { strategyPolicy, classifyExternalFreshness } = require('../scripts/generate_market_environment');
const {
  evaluateFirstDayShockGate,
  classifyPredictedEnvironment,
} = require('../scripts/classify_market_environment');
const {
  classifyActual,
  predictedMatchesActual,
  candidateRule,
  evaluateRelativeLeadershipShadow,
} = require('../scripts/generate_actual_market_environment');
const {
  reconstructIndicatorAtDate,
  reconstructExternalPayloadAtDate,
  buildTriggers,
  classifyEnvironment,
} = require('../scripts/reconstruct_historical_market_environment');

function external(date = '20260727') {
  return {
    collection_date: date,
    errors: [],
    indicators: ['nasdaq', 'sp500', 'dow', 'sox', 'tsm_adr'].map((id) => ({ id, market_date: date })),
  };
}

test('external snapshot requires exact 5/5 primary date agreement', () => {
  const valid = primaryExternalValidation(external(), '20260727');
  assert.equal(valid.exact, true);
  const mixed = external();
  mixed.indicators[4].market_date = '20260724';
  assert.equal(primaryExternalValidation(mixed, '20260727').complete, false);
});

test('one-business-day stale data is not labeled holiday adjusted', () => {
  const validation = primaryExternalValidation(external('20260724'), '20260727');
  const freshness = classifyExternalFreshness(validation, '20260727');
  assert.equal(freshness.status, 'stale_warning');
  assert.equal(freshness.reason, 'primary_market_date_mismatch');
  assert.equal(freshness.business_day_gap, 1);
});

test('incomplete primary external indicators remain invalid', () => {
  const payload = external('20260727');
  payload.indicators.pop();
  const validation = primaryExternalValidation(payload, '20260727');
  const freshness = classifyExternalFreshness(validation, '20260727');
  assert.equal(freshness.status, 'invalid');
  assert.equal(freshness.reason, 'primary_indicators_incomplete_or_inconsistent');
});

test('trailing return uses trading rows rather than calendar days', () => {
  const value = trailingReturn({ rows: [
    { date: '20260722', close: 100 },
    { date: '20260723', close: 98 },
    { date: '20260724', close: 96 },
    { date: '20260727', close: 93 },
  ] }, 3);
  assert.equal(Number(value.toFixed(2)), -7);
});

test('historical indicator reconstruction truncates future rows and recomputes return', () => {
  const indicator = {
    id: 'sox',
    market_date: '20260728',
    rows: [
      { date: '20260723', close: 100 },
      { date: '20260724', close: 96 },
      { date: '20260727', close: 93 },
      { date: '20260728', close: 95 },
    ],
  };
  const reconstructed = reconstructIndicatorAtDate(indicator, '20260727');
  assert.equal(reconstructed.market_date, '20260727');
  assert.equal(reconstructed.previous_market_date, '20260724');
  assert.equal(reconstructed.previous_close, 96);
  assert.equal(reconstructed.change_percent, -3.125);
  assert.deepEqual(reconstructed.rows.map((row) => row.date), ['20260723', '20260724', '20260727']);
});

test('historical external payload becomes exact only when all five primary rows exist', () => {
  const payload = {
    collection_date: '20260728',
    errors: [],
    indicators: ['nasdaq', 'sp500', 'dow', 'sox', 'tsm_adr'].map((id) => ({
      id,
      market_date: '20260728',
      rows: [
        { date: '20260724', close: 100 },
        { date: '20260727', close: 98 },
        { date: '20260728', close: 99 },
      ],
    })),
  };
  const reconstructed = reconstructExternalPayloadAtDate(payload, '20260727');
  assert.ok(reconstructed);
  assert.equal(reconstructed.validation.exact, true);
  assert.equal(reconstructed.payload.collection_date, '20260727');
  assert.ok(reconstructed.payload.indicators.every((item) => item.market_date === '20260727'));
});

test('historical reconstructed shock score remains shadow-only', () => {
  const metrics = {
    sox_change_1d_pct: -2.2,
    sox_return_3d_pct: -6.9,
    tsm_adr_change_1d_pct: -1.1,
    twse_minus_sox_3d_pct_points: 4.2,
    twse_change_1d_pct: -0.05,
    foreign_futures_net_contracts: -78699,
    foreign_futures_net_change_contracts: -2439,
    market_risk_score: 74,
    adr_sox_nasdaq_market_risk: 92,
  };
  const result = buildTriggers(metrics);
  const code = classifyEnvironment(result.score, null, result.triggers);
  assert.equal(code, 'shock_first_day_warning');
  assert.equal(strategyPolicy(code).formal_direction_score_adjustment, 0);
});

test('first-day shock gate rejects an already repriced Taiwan market', () => {
  const triggers = [
    { id: 'sox_1d_drop', value: -4.25 },
    { id: 'twse_sox_divergence', value: 3.04 },
    { id: 'foreign_futures_net_short', value: -76260 },
    { id: 'semiconductor_external_risk_high', value: 92.5 },
  ];
  const gate = evaluateFirstDayShockGate(triggers);
  const result = classifyPredictedEnvironment({ score: 8, triggers, dataValid: true });
  assert.equal(gate.passed, false);
  assert.equal(gate.required_conditions.taiwan_not_repriced, false);
  assert.equal(result.code, 'risk_warning');
});

test('first-day shock gate accepts 07/28 accumulation and unrepriced conditions', () => {
  const triggers = [
    { id: 'sox_1d_drop', value: -2.23 },
    { id: 'sox_3d_drop', value: -6.9 },
    { id: 'tsm_adr_drop', value: -1.07 },
    { id: 'twse_sox_divergence', value: 4.24 },
    { id: 'twse_not_repriced', value: -0.05 },
    { id: 'foreign_futures_net_short', value: -78699 },
    { id: 'foreign_futures_short_increase', value: -2439 },
  ];
  const gate = evaluateFirstDayShockGate(triggers);
  const result = classifyPredictedEnvironment({ score: 11, triggers, dataValid: true });
  assert.equal(gate.passed, true);
  assert.equal(gate.required_conditions.taiwan_not_repriced, true);
  assert.equal(gate.required_conditions.external_acceleration, true);
  assert.equal(result.code, 'shock_first_day_warning');
});

test('severe one-day SOX drop can confirm external acceleration only when Taiwan is unrepriced', () => {
  const triggers = [
    { id: 'sox_1d_drop', value: -3.5 },
    { id: 'twse_not_repriced', value: 0.1 },
  ];
  assert.equal(evaluateFirstDayShockGate(triggers).passed, true);
});

test('shock policy remains shadow-only and preserves formal scores', () => {
  const policy = strategyPolicy('shock_first_day_warning');
  assert.equal(policy.enforcement_mode, 'shadow');
  assert.equal(policy.formal_direction_score_adjustment, 0);
  assert.equal(policy.relative_leadership_momentum, 'disabled_shadow');
  assert.equal(policy.raw_predictions_preserved, true);
});

test('07/28 breadth shape is classified as first systemic selloff day', () => {
  const code = classifyActual({ down_ratio: 86.72, equal_weight_market_return: -3.34, p90_return: 0 }, null);
  assert.equal(code, 'systemic_selloff_first_day');
  assert.equal(predictedMatchesActual('shock_first_day_warning', code), true);
});

test('stress after a first selloff becomes post-shock stress', () => {
  const code = classifyActual({ down_ratio: 72.67, equal_weight_market_return: -2.23, p90_return: 1.03 }, 'systemic_selloff_first_day');
  assert.equal(code, 'post_shock_stress');
});

test('relative leadership shadow candidate uses only prediction-time fields', () => {
  assert.equal(candidateRule({ features: { volume_ratio_5d: 1.5, rsi14: 70 } }), true);
  assert.equal(candidateRule({ features: { volume_ratio_5d: 1.49, rsi14: 90 } }), false);
  assert.equal(candidateRule({ prediction: { features: { volume_ratio_5d: 2, rsi14: 75 } } }), true);
});

test('shadow evaluation joins prediction features and replay outcomes by stock code', () => {
  const predictions = [
    { stock_code: '2330', stock_name: '台積電', features: { volume_ratio_5d: 2, rsi14: 75 } },
    { stock_code: '2317', stock_name: '鴻海', features: { volume_ratio_5d: 1.8, rsi14: 72 } },
    { stock_code: '2454', stock_name: '聯發科', features: { volume_ratio_5d: 1.2, rsi14: 80 } },
    { stock_code: '9999', stock_name: '無覆盤', features: { volume_ratio_5d: 3, rsi14: 90 } },
  ];
  const replayRows = [
    { stock_code: '2330', verified: true, market_relative: { classification: 'relative_leadership', market_percentile: 95 } },
    { stock_code: '2317', verified: true, market_relative: { classification: 'broad_market_driven', market_percentile: 60 } },
    { stock_code: '2454', verified: true, market_relative: { classification: 'relative_leadership', market_percentile: 92 } },
    { stock_code: '8888', verified: true, market_relative: { classification: 'relative_leadership', market_percentile: 99 } },
  ];

  const result = evaluateRelativeLeadershipShadow(predictions, replayRows, true);
  assert.equal(result.raw_candidates, 2);
  assert.equal(result.raw_hits, 1);
  assert.equal(result.raw_precision, 50);
  assert.equal(result.policy_candidates, 0);
  assert.equal(result.avoided_false_positives, 1);
  assert.equal(result.suppressed_true_positives, 1);
  assert.equal(result.net_avoided_errors, 0);
  assert.equal(result.data_quality.matched_rows, 3);
  assert.equal(result.data_quality.replay_without_prediction, 1);
  assert.equal(result.data_quality.prediction_without_verified_replay, 1);
  assert.deepEqual(result.candidate_stocks.map((row) => row.stock_code), ['2330', '2317']);
});
