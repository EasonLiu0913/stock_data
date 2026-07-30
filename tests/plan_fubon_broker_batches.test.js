'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  buildPlan,
  isCompleteOutput
} = require('../scripts/plan_fubon_broker_batches');

function writeOutput(dir, date, complete = true) {
  const file = path.join(dir, `fubon_${date.replaceAll('-', '')}_券商分點進出明細.json`);
  fs.writeFileSync(file, JSON.stringify({
    complete,
    failedStockCount: complete ? 0 : 1,
    failedStocks: complete ? [] : [{ code: '1101' }],
    successfulStockCount: complete ? 2 : 1,
    unavailableStockCount: 0,
    stockUniverse: { expectedStockCount: 2 },
    stocks: complete ? { 1101: {}, 1102: {} } : { 1101: {} },
    unavailableStocks: []
  }));
  return file;
}

test('plans all missing trading dates in five-day batches', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fubon-plan-'));
  const plan = buildPlan({
    start: '2026-07-01',
    end: '2026-07-10',
    batchSize: 5,
    force: false,
    outputDir: dir,
    nonTradingDays: new Set(['2026-07-06'])
  });
  assert.equal(plan.trading_date_count, 7);
  assert.equal(plan.pending_date_count, 7);
  assert.equal(plan.matrix.include.length, 2);
  assert.equal(plan.matrix.include[0].dates, '2026-07-01,2026-07-02,2026-07-03,2026-07-07,2026-07-08');
  assert.equal(plan.matrix.include[1].dates, '2026-07-09,2026-07-10');
  assert.equal(plan.matrix.include[0].has_next, true);
  assert.equal(plan.matrix.include[1].has_next, false);
});

test('skips only complete daily outputs unless force is enabled', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fubon-plan-'));
  writeOutput(dir, '2026-07-01', true);
  writeOutput(dir, '2026-07-02', false);
  const normal = buildPlan({
    start: '2026-07-01',
    end: '2026-07-03',
    batchSize: 5,
    force: false,
    outputDir: dir,
    nonTradingDays: new Set()
  });
  assert.equal(normal.skipped_complete_date_count, 1);
  assert.equal(normal.matrix.include[0].dates, '2026-07-02,2026-07-03');
  const forced = buildPlan({
    start: '2026-07-01',
    end: '2026-07-03',
    batchSize: 5,
    force: true,
    outputDir: dir,
    nonTradingDays: new Set()
  });
  assert.equal(forced.pending_date_count, 3);
});

test('rejects partial files as incomplete', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fubon-plan-'));
  assert.equal(isCompleteOutput(writeOutput(dir, '2026-07-01', false)), false);
  assert.equal(isCompleteOutput(writeOutput(dir, '2026-07-02', true)), true);
});
