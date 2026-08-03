'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  isSameDayReboundStrategy,
  policyForDate,
  policyForTarget,
  hitForCloseReturn,
} = require('../public/rebound-evaluation-policy');

test('selects the historical and current rebound policies by replay date', () => {
  const historical = policyForDate('20260802');
  const current = policyForDate('20260803');

  assert.equal(historical.version, 1);
  assert.equal(historical.evaluation_target, 'close_return_gt_5');
  assert.equal(historical.operator, 'gt');
  assert.equal(historical.threshold_percent, 5);

  assert.equal(current.version, 2);
  assert.equal(current.evaluation_target, 'close_return_gte_4');
  assert.equal(current.operator, 'gte');
  assert.equal(current.threshold_percent, 4);
});

test('treats exactly 4 percent as a current rebound hit', () => {
  const current = policyForDate('20260803');
  assert.equal(hitForCloseReturn(4, current), true);
  assert.equal(hitForCloseReturn(3.99, current), false);
  assert.equal(hitForCloseReturn(null, current), null);
});

test('preserves the previous strict greater-than-5-percent boundary', () => {
  const historical = policyForTarget('close_return_gt_5');
  assert.equal(hitForCloseReturn(5, historical), false);
  assert.equal(hitForCloseReturn(5.01, historical), true);
});

test('recognizes current and future rebound strategy versions', () => {
  assert.equal(isSameDayReboundStrategy('oversold_electronics_rebound_v2'), true);
  assert.equal(isSameDayReboundStrategy('oversold_electronics_rebound_v9'), true);
  assert.equal(isSameDayReboundStrategy('oversold_margin_exit_rebound_v1'), true);
  assert.equal(isSameDayReboundStrategy('bear_market_defensive_resilience_v2'), false);
});
