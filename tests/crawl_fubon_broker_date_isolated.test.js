'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  passThroughArgs,
  publishAtomically,
  validateCompletePayload
} = require('../scripts/crawl_fubon_broker_date_isolated');

function completePayload(date) {
  return {
    date,
    complete: true,
    failedStockCount: 0,
    failedStocks: [],
    successfulStockCount: 2,
    unavailableStockCount: 1,
    stockUniverse: { expectedStockCount: 3 },
    stocks: { 1101: {}, 1102: {} },
    unavailableStocks: [{ code: '9999' }]
  };
}

test('publishes only complete payloads atomically', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fubon-isolated-'));
  const source = path.join(dir, 'source.json');
  const destination = path.join(dir, 'final', 'day.json');
  fs.writeFileSync(source, JSON.stringify(completePayload('2026-07-01')));
  publishAtomically(source, destination, '2026-07-01');
  assert.equal(JSON.parse(fs.readFileSync(destination)).complete, true);
});

test('refuses incomplete daily payloads', () => {
  const payload = completePayload('2026-07-01');
  payload.complete = false;
  payload.failedStockCount = 1;
  assert.ok(validateCompletePayload(payload, '2026-07-01').length >= 2);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fubon-isolated-'));
  const source = path.join(dir, 'source.json');
  const destination = path.join(dir, 'final.json');
  fs.writeFileSync(source, JSON.stringify(payload));
  assert.throws(() => publishAtomically(source, destination, '2026-07-01'), /拒絕發布未完成檔案/);
  assert.equal(fs.existsSync(destination), false);
});

test('refuses all-unavailable payloads even when marked complete', () => {
  const payload = {
    date: '2025-12-25',
    complete: true,
    failedStockCount: 0,
    failedStocks: [],
    successfulStockCount: 0,
    unavailableStockCount: 3,
    stockUniverse: { expectedStockCount: 3 },
    stocks: {},
    unavailableStocks: [{ code: '1101' }, { code: '1102' }, { code: '3231' }]
  };
  const errors = validateCompletePayload(payload, '2025-12-25');
  assert.ok(errors.some(error => error.includes('successful stocks 為 0')));
});

test('removes internal range and output arguments before invoking crawler', () => {
  assert.deepEqual(passThroughArgs([
    '--date', '20260701',
    '--start', '2026-01-01',
    '--end', '2026-06-30',
    '--output-dir', '/tmp/old',
    '--final-output-dir', '/repo/data',
    '--work-root', '/tmp/work',
    '--concurrency', '2',
    '--force'
  ]), ['--concurrency', '2', '--force']);
});
