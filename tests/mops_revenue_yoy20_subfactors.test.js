'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { consecutiveYoyAtLeast, revenueHigh } = require('../scripts/summarize_mops_revenue_yoy20_subfactors');

test('consecutive YoY threshold requires complete consecutive months', () => {
  const m = new Map([
    ['202606',{yoy_pct:25}],['202605',{yoy_pct:22}],['202604',{yoy_pct:19}],
  ]);
  assert.equal(consecutiveYoyAtLeast(m,'202606',20,2), true);
  assert.equal(consecutiveYoyAtLeast(m,'202606',20,3), false);
  assert.equal(consecutiveYoyAtLeast(new Map([['202606',{yoy_pct:30}]]),'202606',20,2), false);
});

test('revenue high requires full requested lookback', () => {
  const m = new Map([
    ['202606',{monthly_revenue_thousand_twd:130}],
    ['202605',{monthly_revenue_thousand_twd:120}],
    ['202604',{monthly_revenue_thousand_twd:100}],
  ]);
  assert.equal(revenueHigh(m,'202606',3), true);
  assert.equal(revenueHigh(m,'202606',6), false);
});
