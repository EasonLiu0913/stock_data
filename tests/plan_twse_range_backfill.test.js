'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildPlan, validateSmaDaily, validateTwt49u } = require('../scripts/plan_twse_range_backfill');

function temp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'twse-plan-')); }
const calendar = { dates: ['20251224', '20251226'], set: new Set(['20251224', '20251226']), firstDate: '20251224', lastDate: '20251226' };

test('TWT49U accepts a valid empty corporate-action day', () => {
  const dir = temp();
  const file = path.join(dir, '20251224_twt49u.json');
  fs.writeFileSync(file, JSON.stringify({ stat: 'OK', fields: ['資料日期', '股票代號', '漲停價格', '跌停價格', '開盤競價基準'], data: [] }));
  assert.deepEqual(validateTwt49u(file, '20251224'), []);
  const plan = buildPlan({ dataset: 'twt49u', start: '20251224', end: '20251226', calendar, outputDir: dir, batchSize: 10 });
  assert.deepEqual(plan.pending_dates, ['20251226']);
});

test('SMA rejects legacy or empty daily formats', () => {
  const dir = temp();
  const file = path.join(dir, 'fubon_20251224_sma.json');
  fs.writeFileSync(file, JSON.stringify({ 1101: { Price: '10' } }));
  assert.ok(validateSmaDaily(file, '20251224', 1).some((error) => error.includes('reference stock missing') || error.includes('date key')));
});

test('SMA can rebuild missing daily files from per-stock history without crawling', () => {
  const dailyDir = temp();
  const historyDir = temp();
  for (const code of ['1101', '1102', '3231']) {
    fs.writeFileSync(path.join(historyDir, `${code}.json`), JSON.stringify({
      '2025/12/24': { price: 1, open: 1, high: 1, low: 1, volume: 1, sma5: 1, sma20: 1 },
      '2025/12/26': { price: 2, open: 2, high: 2, low: 2, volume: 2, sma5: 2, sma20: 2 }
    }));
  }
  const plan = buildPlan({
    dataset: 'sma', start: '20251224', end: '20251226', calendar,
    outputDir: dailyDir, historyDir, codes: ['1101', '1102', '3231'], minimumRecords: 1, stockBatchSize: 2
  });
  assert.equal(plan.pending_date_count, 2);
  assert.equal(plan.rebuild_only, true);
  assert.equal(plan.stock_batch_count, 0);
});
