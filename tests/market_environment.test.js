'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { primaryExternalValidation, trailingReturn } = require('../scripts/market_environment_lib');
const { strategyPolicy } = require('../scripts/generate_market_environment');
const { classifyActual, predictedMatchesActual, candidateRule } = require('../scripts/generate_actual_market_environment');

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

test('trailing return uses trading rows rather than calendar days', () => {
  const value = trailingReturn({ rows: [
    { date: '20260722', close: 100 },
    { date: '20260723', close: 98 },
    { date: '20260724', close: 96 },
    { date: '20260727', close: 93 },
  ] }, 3);
  assert.equal(Number(value.toFixed(2)), -7);
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
  assert.equal(candidateRule({ prediction: { features: { volume_ratio_5d: 1.5, rsi14: 70 } } }), true);
  assert.equal(candidateRule({ prediction: { features: { volume_ratio_5d: 1.49, rsi14: 90 } } }), false);
});
