'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateSignal, revenueHigh } = require('../scripts/summarize_mops_revenue_fundamental_acceleration_breakout');

function history(rows) {
  return new Map(rows.map(([month, revenue]) => [month, { monthly_revenue_thousand_twd: revenue }]));
}

test('revenueHigh requires complete lookback and current month at the maximum', () => {
  const map = history([
    ['202604', 260], ['202603', 190], ['202602', 180], ['202601', 170], ['202512', 160], ['202511', 150],
  ]);
  assert.equal(revenueHigh(map, '202604', 6), true);
  assert.equal(revenueHigh(map, '202604', 12), false);
});

test('acceleration breakout captures a Chuan Hu-style revenue acceleration pattern', () => {
  const map = history([
    ['202604', 260], ['202603', 190], ['202602', 180], ['202601', 170], ['202512', 160], ['202511', 150],
  ]);
  const event = {
    factors: {
      yoy_pct: 79,
      mom_pct: 35,
      yoy_acceleration_pct_points: 35,
      yoy_accelerating: true,
    },
  };
  const flags = evaluateSignal(event, '202604', map);
  assert.equal(flags.acceleration_base, true);
  assert.equal(flags.acceleration_6m_high, true);
  assert.equal(flags.acceleration_breakout, true);
  assert.equal(flags.acceleration_breakout_strong, true);
  assert.equal(flags.acceleration_12m_high, false);
});

test('high YoY alone is not enough without MoM and acceleration confirmation', () => {
  const map = history([
    ['202604', 260], ['202603', 190], ['202602', 180], ['202601', 170], ['202512', 160], ['202511', 150],
  ]);
  const event = {
    factors: {
      yoy_pct: 80,
      mom_pct: -5,
      yoy_acceleration_pct_points: -2,
      yoy_accelerating: false,
    },
  };
  const flags = evaluateSignal(event, '202604', map);
  assert.equal(flags.acceleration_base, false);
  assert.equal(flags.acceleration_breakout, false);
  assert.equal(flags.acceleration_breakout_strong, false);
});
