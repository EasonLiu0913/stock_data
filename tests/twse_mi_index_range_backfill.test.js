'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildPlan, loadTradingDates, validateMiIndexFile } = require('../scripts/plan_twse_mi_index_range_backfill');

function validPayload(date) {
  return {
    stat: 'OK',
    date,
    tables: [{
      fields: ['證券代號', '開盤價', '最高價', '最低價', '收盤價'],
      data: Array.from({ length: 120 }, (_, index) => [String(1000 + index), '10', '11', '9', '10.5']),
    }],
  };
}

test('valid MI_INDEX file requires matching date and quote table', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-index-'));
  const file = path.join(dir, '20240102_twse_mi_index.json');
  fs.writeFileSync(file, JSON.stringify(validPayload('20240102')));
  assert.deepEqual(validateMiIndexFile(file, '20240102'), []);
  assert.ok(validateMiIndexFile(file, '20240103').includes('date_mismatch'));
});

test('planner reuses valid dates and batches only missing dates', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-index-plan-'));
  const outputDir = path.join(dir, 'output');
  fs.mkdirSync(outputDir);
  const marketFile = path.join(dir, 'market.json');
  fs.writeFileSync(marketFile, JSON.stringify({ startDate: '20240102', endDate: '20240104', data: [
    { date: '20240102', close: 100 },
    { date: '20240103', close: 101 },
    { date: '20240104', close: 102 },
  ] }));
  fs.writeFileSync(path.join(outputDir, '20240102_twse_mi_index.json'), JSON.stringify(validPayload('20240102')));
  const plan = buildPlan({ start: '20240102', end: '20240104', batchSize: 1, outputDir, marketFile });
  assert.equal(plan.trading_date_count, 3);
  assert.equal(plan.valid_date_count, 1);
  assert.equal(plan.pending_date_count, 2);
  assert.deepEqual(plan.matrix.include.map(item => item.dates), ['20240103', '20240104']);
});

test('planner accepts a requested start that is a non-trading day inside market coverage', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-index-holiday-start-'));
  const marketFile = path.join(dir, 'market.json');
  fs.writeFileSync(marketFile, JSON.stringify({
    startDate: '20240101',
    endDate: '20240104',
    data: [
      { date: '20240102', close: 100 },
      { date: '20240103', close: 101 },
      { date: '20240104', close: 102 },
    ],
  }));
  assert.deepEqual(
    loadTradingDates('20240101', '20240104', marketFile),
    ['20240102', '20240103', '20240104']
  );
});

test('planner rejects a requested range that begins before market chart coverage', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-index-calendar-'));
  const marketFile = path.join(dir, 'market.json');
  fs.writeFileSync(marketFile, JSON.stringify({ startDate: '20251103', endDate: '20251104', data: [
    { date: '20251103', close: 100 },
    { date: '20251104', close: 101 },
  ] }));
  assert.throws(
    () => loadTradingDates('20240101', '20251104', marketFile),
    /truncated: requested start 20240101, but market chart coverage starts at 20251103/
  );
});

test('planner rejects a requested range that extends past market chart coverage', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-index-calendar-end-'));
  const marketFile = path.join(dir, 'market.json');
  fs.writeFileSync(marketFile, JSON.stringify({ startDate: '20240102', endDate: '20240103', data: [
    { date: '20240102', close: 100 },
    { date: '20240103', close: 101 },
  ] }));
  assert.throws(
    () => loadTradingDates('20240102', '20240131', marketFile),
    /does not reach requested end 20240131; coverage ends at 20240103/
  );
});
