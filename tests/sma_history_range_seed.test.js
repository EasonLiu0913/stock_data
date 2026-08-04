'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  SEED_MARKER,
  cleanupRequestedStart,
  countCompleteAtStart,
  seedRequestedStart
} = require('../scripts/lib/sma_history_range_seed');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sma-range-seed-'));
  const historyDir = path.join(root, 'history');
  const csvFile = path.join(root, 'stocks.csv');
  const stateFile = path.join(root, 'state.json');
  fs.mkdirSync(historyDir, { recursive: true });
  fs.writeFileSync(csvFile, 'Code,Name,Industry\n1101,台泥,水泥\n1102,亞泥,水泥\n', 'utf8');
  return { root, historyDir, csvFile, stateFile, startDate: '20251103', startIndex: 0, limit: 2 };
}

function completePoint(price = 10) {
  return { price, open: price, high: price, low: price, volume: 100, sma5: price, sma20: price };
}

test('seed forces an older requested start without replacing complete data', () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.historyDir, '1101.json'), JSON.stringify({
    '2026/02/02': completePoint(20)
  }), 'utf8');
  fs.writeFileSync(path.join(f.historyDir, '1102.json'), JSON.stringify({
    '2025/11/03': completePoint(30)
  }), 'utf8');

  const result = seedRequestedStart(f);
  assert.equal(result.seededCount, 1);
  const seeded = JSON.parse(fs.readFileSync(path.join(f.historyDir, '1101.json'), 'utf8'));
  assert.equal(seeded['2025/11/03'][SEED_MARKER], true);
  const untouched = JSON.parse(fs.readFileSync(path.join(f.historyDir, '1102.json'), 'utf8'));
  assert.equal(untouched['2025/11/03'].price, 30);
});

test('cleanup keeps a real crawled point that replaced the seed', () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.historyDir, '1101.json'), JSON.stringify({
    '2026/02/02': completePoint(20)
  }), 'utf8');
  fs.writeFileSync(path.join(f.historyDir, '1102.json'), '{}', 'utf8');
  seedRequestedStart(f);

  const file = path.join(f.historyDir, '1101.json');
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  payload['2025/11/03'] = completePoint(15);
  fs.writeFileSync(file, JSON.stringify(payload), 'utf8');

  const cleanup = cleanupRequestedStart(f);
  assert.equal(cleanup.retainedCount, 1);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8'))['2025/11/03'].price, 15);
  assert.equal(countCompleteAtStart(f).completeCount, 1);
});

test('cleanup removes an unreplaced temporary seed', () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.historyDir, '1101.json'), JSON.stringify({
    '2026/02/02': completePoint(20)
  }), 'utf8');
  fs.writeFileSync(path.join(f.historyDir, '1102.json'), '{}', 'utf8');
  seedRequestedStart(f);

  const cleanup = cleanupRequestedStart(f);
  assert.equal(cleanup.restoredCount, 2);
  const first = JSON.parse(fs.readFileSync(path.join(f.historyDir, '1101.json'), 'utf8'));
  const second = JSON.parse(fs.readFileSync(path.join(f.historyDir, '1102.json'), 'utf8'));
  assert.equal(Object.hasOwn(first, '2025/11/03'), false);
  assert.equal(Object.hasOwn(second, '2025/11/03'), false);
});
