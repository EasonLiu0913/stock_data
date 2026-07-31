'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeDispositionSnapshot,
  isReusableSnapshot,
} = require('../scripts/fetch_official_market_constraints');

test('official disposition count uses unique four-digit stock codes', () => {
  const result = normalizeDispositionSnapshot({
    active_stock_codes: ['2492', '2492', '6443', 'TXO'],
    active_records: [
      { code: '2492' },
      { code: '2492' },
      { code: '6443' },
      { code: 'TXO' },
    ],
  });
  assert.deepEqual(result.active_stock_codes, ['2492', '6443']);
  assert.equal(result.active_stock_record_count, 3);
  assert.equal(result.active_stock_count, 2);
});

test('snapshot is reusable only when both disposition coverage and night futures are complete', () => {
  assert.equal(isReusableSnapshot({
    target_date: '20260731',
    disposition: { complete_market_coverage: true },
    night_futures: { available: true },
  }, '20260731'), true);
  assert.equal(isReusableSnapshot({
    target_date: '20260731',
    disposition: { complete_market_coverage: true },
    night_futures: { available: false },
  }, '20260731'), false);
});
