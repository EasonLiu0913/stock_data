'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildPlan, buildSnapshot, normalizeHistoricalRows, validateStoredSnapshot, writeDates } = require('../scripts/reconstruct_cnn_fear_and_greed_history');

function ms(date) { return new Date(`${date}T00:00:00Z`).getTime(); }
const payload = {
  fear_and_greed: { timestamp: '2025-11-04T23:00:00Z' },
  fear_and_greed_historical: { data: [
    { x: ms('2025-11-03'), y: 40, rating: 'fear' },
    { x: ms('2025-11-04'), y: 45, rating: 'neutral' }
  ] }
};

test('builds compatible reconstructed CNN snapshots with provenance', () => {
  const rows = normalizeHistoricalRows(payload);
  const snapshot = buildSnapshot(rows, 1, payload);
  assert.equal(snapshot.reconstructed, true);
  assert.equal(snapshot.fear_and_greed.previous_close, 40);
  assert.equal(snapshot.fear_and_greed.timestamp.slice(0, 10), '2025-11-04');
});

test('plans and writes only historical dates available in CNN payload', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cnn-history-'));
  const plan = buildPlan({ payload, start: '20251103', end: '20251104', outputDir: dir, batchSize: 20 });
  assert.equal(plan.pending_date_count, 2);
  writeDates({ payload, dates: ['20251103'], outputDir: dir });
  assert.deepEqual(validateStoredSnapshot(path.join(dir, '20251103', 'cnn_fear_and_greed.json'), '20251103'), []);
});
