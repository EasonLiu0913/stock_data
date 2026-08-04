'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { mergeRange } = require('../scripts/merge_history_data');

function temp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'merge-sma-')); }

test('merges an explicit trading-date range into the established daily SMA schema', () => {
  const root = temp();
  const smaDir = path.join(root, 'history');
  const outputDir = path.join(root, 'output');
  fs.mkdirSync(smaDir);
  const csv = path.join(root, 'stocks.csv');
  fs.writeFileSync(csv, 'Code,Name\n1101,台泥\n');
  fs.writeFileSync(path.join(smaDir, '1101.json'), JSON.stringify({
    '2025/11/03': { price: 10, open: 9, high: 11, low: 8, volume: 100, sma5: 9.5, sma20: 9, sma60: 8, sma120: 7, sma240: 6 }
  }));
  const calendar = path.join(root, 'calendar.json');
  fs.writeFileSync(calendar, JSON.stringify({ data: [{ date: '20251103' }] }));
  mergeRange({ start: '20251103', end: '20251103', smaOnly: true, outputDir, smaDir, csvFile: csv, calendarFile: calendar });
  const daily = JSON.parse(fs.readFileSync(path.join(outputDir, 'fubon_20251103_sma.json')));
  assert.equal(daily['1101']['2025/11/03'].Price, '10.00');
  assert.equal(daily['1101']['2025/11/03'].Volume, '100');
});
