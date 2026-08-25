'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStatus, inferReason } = require('../scripts/reconcile_institutional_data');
const { hasTargetDate, toRocDate } = require('../scripts/lib/institutional_data_common');

const SENTINELS = ['1101', '2330', '2317', '2882'];

function makeUniverse(size = 1000, omit = []) {
  const map = new Map();
  for (const code of SENTINELS) if (!omit.includes(code)) map.set(code, code);
  for (let n = 1000; map.size < size; n += 1) {
    const code = String(n).padStart(4, '0');
    if (!omit.includes(code)) map.set(code, code);
  }
  return map;
}

function rowFor(date) {
  return {
    ForeignInvestors: { [date]: 1 },
    InvestmentTrust: { [date]: 2 },
    Dealers: { [date]: 3 },
    DailyTotal: { [date]: 6 },
  };
}

function dataFor(stockInfo, date, limit = Infinity) {
  const result = {};
  let count = 0;
  for (const code of stockInfo.keys()) {
    if (count >= limit) break;
    result[code] = rowFor(date);
    count += 1;
  }
  return result;
}

test('hasTargetDate requires all four institutional fields on the target date', () => {
  const date = toRocDate('20260825');
  const row = rowFor(date);
  assert.equal(hasTargetDate(row, date), true);
  delete row.Dealers[date];
  assert.equal(hasTargetDate(row, date), false);
});

test('complete healthy universe is ready without anomaly flags', () => {
  const stockInfo = makeUniverse(1000);
  const date = toRocDate('20260825');
  const { status, reconciledFailed } = buildStatus({
    targetDateStr: '20260825',
    stockInfo,
    data: dataFor(stockInfo, date),
    failedList: [],
    reference: { date: '20260824', valid_count: 1000, universe_count: 1000 },
  });
  assert.equal(status.status, 'ready');
  assert.equal(status.valid_count, 1000);
  assert.deepEqual(status.anomaly_flags, []);
  assert.equal(reconciledFailed.length, 0);
});

test('small universe is explicitly abnormal even when every row is complete', () => {
  const stockInfo = makeUniverse(137);
  const date = toRocDate('20260825');
  const { status } = buildStatus({
    targetDateStr: '20260825',
    stockInfo,
    data: dataFor(stockInfo, date),
    failedList: [],
    reference: { date: '20260824', valid_count: 1097, universe_count: 1097 },
  });
  assert.equal(status.status, 'abnormal');
  assert.ok(status.anomaly_flags.includes('UNIVERSE_TOO_SMALL'));
  assert.ok(status.anomaly_flags.includes('UNIVERSE_DROP_GT_10_PERCENT'));
});

test('large valid-count drop is surfaced as a reference coverage anomaly', () => {
  const stockInfo = makeUniverse(1000);
  const date = toRocDate('20260825');
  const { status } = buildStatus({
    targetDateStr: '20260825',
    stockInfo,
    data: dataFor(stockInfo, date, 800),
    failedList: [],
    reference: { date: '20260824', valid_count: 1000, universe_count: 1000 },
  });
  assert.ok(status.anomaly_flags.includes('REFERENCE_VALID_DROP_GT_10_PERCENT'));
  assert.equal(status.missing_count, 200);
});

test('missing sentinel is surfaced', () => {
  const stockInfo = makeUniverse(1000, ['2330']);
  const date = toRocDate('20260825');
  const { status } = buildStatus({
    targetDateStr: '20260825',
    stockInfo,
    data: dataFor(stockInfo, date),
    failedList: [],
    reference: { date: '20260824', valid_count: 1000, universe_count: 1000 },
  });
  assert.ok(status.anomaly_flags.includes('SENTINEL_MISSING'));
  assert.equal(status.sentinels['2330'].in_universe, false);
});

test('explicit failure reason wins over legacy error-text inference', () => {
  assert.equal(inferReason({ reason: 'REQUEST_ERROR', error: '目標日期資料尚未更新' }), 'REQUEST_ERROR');
  assert.equal(inferReason({ error: '目標日期資料尚未更新 (值為 "--")' }), 'DATA_MISSING');
});
