'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  buildPlan,
  buildSnapshot,
  loadBestStoredSource,
  normalizeHistoricalRows,
  resolveSourcePayload,
  validateStoredSnapshot,
  writeDates
} = require('../scripts/reconstruct_cnn_fear_and_greed_history');

function ms(date) { return new Date(`${date}T00:00:00Z`).getTime(); }

const payload = {
  fear_and_greed: { timestamp: '2025-11-04T23:00:00Z' },
  fear_and_greed_historical: {
    data: [
      { x: ms('2025-11-03'), y: 40, rating: 'fear' },
      { x: ms('2025-11-04'), y: 45, rating: 'neutral' }
    ]
  }
};

function writeSource(root, date, sourcePayload) {
  const dir = path.join(root, date);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'cnn_fear_and_greed.json');
  fs.writeFileSync(file, `${JSON.stringify(sourcePayload, null, 2)}\n`);
  return file;
}

test('builds compatible reconstructed CNN snapshots with provenance', () => {
  const rows = normalizeHistoricalRows(payload);
  const snapshot = buildSnapshot(rows, 1, payload);
  assert.equal(snapshot.reconstructed, true);
  assert.equal(snapshot.fear_and_greed.previous_close, 40);
  assert.equal(snapshot.fear_and_greed.timestamp.slice(0, 10), '2025-11-04');
  assert.equal(snapshot.reconstruction.source_access.mode, 'provided_payload');
});

test('plans and writes only historical dates available in CNN payload', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cnn-history-'));
  const plan = buildPlan({
    payload,
    start: '20251103',
    end: '20251104',
    outputDir: dir,
    batchSize: 20
  });
  assert.equal(plan.pending_date_count, 2);
  writeDates({ payload, dates: ['20251103'], outputDir: dir });
  assert.deepEqual(
    validateStoredSnapshot(path.join(dir, '20251103', 'cnn_fear_and_greed.json'), '20251103'),
    []
  );
});

test('plan defaults end date to the latest historical point', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cnn-history-'));
  const plan = buildPlan({ payload, start: '20251103', outputDir: dir, batchSize: 20 });
  assert.equal(plan.end, '20251104');
  assert.equal(plan.source_last_date, '20251104');
});

test('stored fallback chooses the payload with the longest historical series', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cnn-source-'));
  writeSource(dir, '20251105', {
    fear_and_greed: { timestamp: '2025-11-05T23:00:00Z' },
    fear_and_greed_historical: {
      data: [{ x: ms('2025-11-05'), y: 50, rating: 'neutral' }]
    }
  });
  const longer = writeSource(dir, '20251104', payload);
  const selected = loadBestStoredSource(dir);
  assert.equal(selected.file, longer);
  assert.equal(selected.historicalPointCount, 2);
});

test('falls back to a stored CNN payload when the live endpoint returns 418', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cnn-source-'));
  writeSource(dir, '20251104', payload);
  const resolved = await resolveSourcePayload({
    outputDir: dir,
    maxRetries: 1,
    retryDelayMs: 0,
    fetchImpl: async () => ({
      ok: false,
      status: 418,
      statusText: "I'm a teapot"
    })
  });
  assert.equal(resolved.__source_metadata.mode, 'stored_cnn_payload_fallback');
  assert.match(resolved.__source_metadata.live_error, /418/);
  assert.equal(normalizeHistoricalRows(resolved).length, 2);
});

test('can prefer the stored CNN source without contacting the live endpoint', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cnn-source-'));
  writeSource(dir, '20251104', payload);
  let requested = false;
  const resolved = await resolveSourcePayload({
    outputDir: dir,
    preferStored: true,
    fetchImpl: async () => {
      requested = true;
      throw new Error('should not be called');
    }
  });
  assert.equal(requested, false);
  assert.equal(resolved.__source_metadata.mode, 'stored_cnn_payload_preferred');
});
