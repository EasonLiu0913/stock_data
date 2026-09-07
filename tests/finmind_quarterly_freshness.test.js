'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  coverageFreshnessDecision,
  normalizeAsOfDate,
} = require('../scripts/backfill_finmind_quarterly_financial_quality_batch');

function coverage(missingPeriods = []) {
  return {
    requested: { start_quarter: '2023Q1', end_quarter: '2026Q2' },
    missing_periods: missingPeriods,
  };
}

test('future pending quarter remains reusable before conservative known date', () => {
  const result = coverageFreshnessDecision(
    coverage([{ fiscal_period: '2026Q2', conservative_known_date: '2026-08-14', reason: 'pending_not_yet_available' }]),
    true,
    '2023Q1',
    '2026Q2',
    '2026-08-13',
  );
  assert.equal(result.reusable, true);
});

test('pending quarter becomes stale on conservative known date', () => {
  const result = coverageFreshnessDecision(
    coverage([{ fiscal_period: '2026Q2', conservative_known_date: '2026-08-14', reason: 'pending_not_yet_available' }]),
    true,
    '2023Q1',
    '2026Q2',
    '2026-08-14',
  );
  assert.equal(result.reusable, false);
  assert.equal(result.reason, 'due_pending');
});

test('pending quarter remains stale after conservative known date', () => {
  const result = coverageFreshnessDecision(
    coverage([{ fiscal_period: '2026Q2', conservative_known_date: '2026-08-14', reason: 'pending_not_yet_available' }]),
    true,
    '2023Q1',
    '2026Q2',
    '2026-09-07',
  );
  assert.equal(result.reusable, false);
  assert.equal(result.fiscal_period, '2026Q2');
});

test('matching complete coverage with timeline remains reusable', () => {
  assert.deepEqual(
    coverageFreshnessDecision(coverage([]), true, '2023Q1', '2026Q2', '2026-09-07'),
    { reusable: true, reason: 'complete' },
  );
});

test('missing or corrupt coverage and timeline fail safe toward refresh', () => {
  assert.equal(coverageFreshnessDecision(null, true, '2023Q1', '2026Q2', '2026-09-07').reusable, false);
  assert.equal(coverageFreshnessDecision({}, true, '2023Q1', '2026Q2', '2026-09-07').reusable, false);
  assert.equal(coverageFreshnessDecision(coverage([]), false, '2023Q1', '2026Q2', '2026-09-07').reusable, false);
});

test('invalid pending known date fails safe toward refresh', () => {
  const result = coverageFreshnessDecision(
    coverage([{ fiscal_period: '2026Q2', conservative_known_date: 'invalid', reason: 'pending_not_yet_available' }]),
    true,
    '2023Q1',
    '2026Q2',
    '2026-09-07',
  );
  assert.equal(result.reusable, false);
  assert.equal(result.reason, 'invalid_pending_known_date');
});

test('as-of date must be explicit ISO calendar date', () => {
  assert.equal(normalizeAsOfDate('2026-09-07'), '2026-09-07');
  assert.throws(() => normalizeAsOfDate('2026-02-30'), /Invalid as-of-date/);
});
