'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  conservativeAvailabilityDate,
  buildTradingWindow,
  marketWindowFingerprint,
  pctReturn,
} = require('../scripts/generate_mops_revenue_monthly_signal_returns');

test('conservative availability uses day 15 of following month', () => {
  assert.equal(conservativeAvailabilityDate('202511'), '20251215');
  assert.equal(conservativeAvailabilityDate('202512'), '20260115');
});

test('trading window starts after conservative availability date', () => {
  const rows = [
    { date: '20251212', close: 100 },
    { date: '20251215', close: 101 },
    { date: '20251216', close: 102 },
  ];
  const result = buildTradingWindow(rows, '20251215');
  assert.equal(result.base.date, '20251215');
  assert.equal(result.effective.date, '20251216');
});

test('missing benchmark history has no trading window or market fingerprint', () => {
  const rows = [
    { date: '20251103', close: 28000 },
    { date: '20251104', close: 28100 },
  ];
  assert.equal(buildTradingWindow(rows, '20240215'), null);
  assert.equal(marketWindowFingerprint(rows, '202401'), null);
});

test('pctReturn calculates percentage return', () => {
  assert.equal(pctReturn(100, 110), 10);
  assert.equal(pctReturn(100, 90), -10);
});
