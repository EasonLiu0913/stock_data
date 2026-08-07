'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildTradingWindow,
  classifyObservedTiming,
  pctReturn,
} = require('../scripts/generate_mops_revenue_event_returns');

test('historical backfill first_seen_at outside filing window is excluded', () => {
  assert.deepEqual(classifyObservedTiming('202606', '2026-08-07T14:52:23+08:00'), {
    usable: false,
    status: 'backfill_no_original_timestamp',
    observed_date: '20260807',
  });
});

test('current revenue observation inside next-month reporting window is eligible', () => {
  assert.deepEqual(classifyObservedTiming('202607', '2026-08-07T18:30:00+08:00'), {
    usable: true,
    status: 'observed_during_reporting_window',
    observed_date: '20260807',
  });
});

test('event evaluation starts from next TAIEX trading day', () => {
  const market = [
    { date: '20260806', close: 24000 },
    { date: '20260807', close: 24100 },
    { date: '20260810', close: 24200 },
    { date: '20260811', close: 24300 },
  ];
  const result = buildTradingWindow(market, '20260807');
  assert.equal(result.base.date, '20260807');
  assert.equal(result.effective.date, '20260810');
});

test('percentage return is expressed in percentage points', () => {
  assert.equal(pctReturn(100, 105), 5);
  assert.equal(pctReturn(100, 95), -5);
  assert.equal(pctReturn(null, 105), null);
});
