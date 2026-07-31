'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  scoreReadiness,
  probabilityCalibration,
  buildReadinessPayload,
} = require('../scripts/oversold_beta_rebound');

function external(indicators) {
  return { indicators };
}

const environment = {
  forecast_date: '2026-07-31',
  base_trade_date: '2026-07-30',
  metrics: {
    sox_change_1d_pct: 7.35,
    tsm_adr_change_1d_pct: 6.78,
    twse_return_3d_pct: -8.48,
    market_risk_score: 48.8,
    adr_sox_nasdaq_market_risk: 0,
    foreign_futures_net_change_contracts: 1768,
  },
  source_files: { external_market: 'data_external_market/20260730/external_market_indicators.json' },
};
const previousEnvironment = { payload: { metrics: { market_risk_score: 75.7 } }, file: '/tmp/previous.json' };
const marketExternal = external([
  { id: 'nasdaq', change_percent: 2.09 },
  { id: 'sox', change_percent: 7.35 },
  { id: 'tsm_adr', change_percent: 6.78 },
  { id: 'wti_crude_oil', change_percent: -0.24 },
  { id: 'brent_crude_oil', change_percent: -1.09 },
]);
const summary = { market_summary: { oversold_ratio: 45.82 }, forecast_date: '2026-07-31', base_trade_date: '2026-07-30', stocks: [] };

test('2026-07-31 readiness scores 85 with night futures kept as N/A', () => {
  const result = scoreReadiness({ environment, summary, external: marketExternal, previousEnvironment });
  assert.equal(result.score, 85);
  assert.equal(result.band.label, '已觸發');
  assert.equal(result.effective_data_weight, 85);
  assert.equal(result.available_signals, 8);
  const night = result.conditions.find(item => item.id === 'night_futures_open_signal');
  assert.equal(night.status, 'na');
  assert.equal(night.points, 0);
});

test('effective data weight below 70 returns unavailable probability rather than a low estimate', () => {
  const result = probabilityCalibration(30, 55);
  assert.equal(result.mode, 'unavailable');
  assert.equal(result.probability_range, null);
});

test('readiness stays independent from the existing market environment', () => {
  const payload = buildReadinessPayload({
    date: '20260731',
    rootDir: 'data_predictions',
    environment,
    summary,
    external: marketExternal,
    previousEnvironment,
  });
  assert.equal(payload.replaces_market_environment, false);
  assert.equal(payload.changes_direction_score, false);
  assert.equal(payload.probability.label, '啟發式機率區間');
  assert.deepEqual(payload.probability.probability_range, [65, 80]);
});
