'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  coverageFreshnessDecision,
  normalizeAsOfDate,
  buildPhysicalBatchPlan,
  buildDueStatusName,
  persistUnsupportedCoverage,
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


test('physical-batch planner groups a bounded deterministic wave', () => {
  const due = ['1001','1002','1003','1004','1005','1006','1007'].map(stock_id => ({ stock_id }));
  const plan = buildPhysicalBatchPlan(due, 3, 2);
  assert.equal(plan.selected.length, 6);
  assert.deepEqual(plan.batches, [
    { batch_index: 0, stock_ids: ['1001','1002','1003'], stock_ids_csv: '1001,1002,1003', request_count: 3 },
    { batch_index: 1, stock_ids: ['1004','1005','1006'], stock_ids_csv: '1004,1005,1006', request_count: 3 },
  ]);
});

test('physical-batch re-plan is idempotent when completed stocks disappear from due rows', () => {
  const first = ['1001','1002','1003','1004','1005','1006','1007'].map(stock_id => ({ stock_id }));
  const second = first.filter(row => !['1001','1002','1003'].includes(row.stock_id));
  const plan = buildPhysicalBatchPlan(second, 3, 2);
  assert.deepEqual(plan.batches[0].stock_ids, ['1004','1005','1006']);
  assert.equal(new Set(plan.selected.map(row => row.stock_id)).size, plan.selected.length);
});


test('physical-batch planner respects a smaller requested wave', () => {
  const due = ['1001','1002','1003','1004','1005'].map(stock_id => ({ stock_id }));
  const plan = buildPhysicalBatchPlan(due, 2, 1);
  assert.equal(plan.selected.length, 2);
  assert.equal(plan.batches.length, 1);
  assert.deepEqual(plan.batches[0].stock_ids, ['1001','1002']);
  assert.equal(plan.batches[0].request_count, 2);
});


test('backlog wave identity makes same-date physical-batch checkpoints unique', () => {
  const selected = [{ stock_id: '1001' }, { stock_id: '1002' }, { stock_id: '1003' }];
  const first = buildDueStatusName('2026-09-08', selected, 0, 'run-34193149003');
  const second = buildDueStatusName('2026-09-08', selected, 0, 'run-34199999999');
  assert.equal(first, 'due-refresh-2026-09-08-wave-run-34193149003-batch000.json');
  assert.equal(second, 'due-refresh-2026-09-08-wave-run-34199999999-batch000.json');
  assert.notEqual(first, second);
});

test('legacy daily due-refresh status identity remains backward compatible without wave id', () => {
  assert.equal(
    buildDueStatusName('2026-09-08', [{ stock_id: '1316' }], 0, ''),
    'due-refresh-2026-09-08-1316.json',
  );
});


test('unsupported financial model is reusable without a timeline once terminal coverage is durable', () => {
  const result = coverageFreshnessDecision({
    status: 'unsupported_financial_model',
    requested: { start_quarter: '2023Q1', end_quarter: '2026Q2' },
  }, false, '2023Q1', '2026Q2', '2026-09-08');
  assert.deepEqual(result, { reusable: true, reason: 'unsupported_financial_model' });
});
