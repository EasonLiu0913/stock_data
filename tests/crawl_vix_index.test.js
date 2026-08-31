'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildDailyPayload, buildPlan, parseRows, resolveAutomaticTargetDate, validateStored, writeDates } = require('../scripts/crawl_vix_index');
const { resolveScheduledOccurrence } = require('../scripts/resolve_scheduled_collection_date');

function ts(date) { return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000); }
const payload = { chart: { result: [{
  timestamp: [ts('2025-11-03'), ts('2025-11-04')],
  indicators: { quote: [{ open: [16, 17], high: [18, 19], low: [15, 16], close: [17, 18], volume: [0, 0] }], adjclose: [{ adjclose: [17, 18] }] }
}] } };

test('parses VIX rows and calculates daily change', () => {
  const rows = parseRows(payload);
  const daily = buildDailyPayload(rows, 1);
  assert.equal(daily.symbol, '^VIX');
  assert.equal(daily.previous_close, 17);
  assert.equal(daily.change, 1);
});

test('plans exact market rows and writes validated daily files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vix-'));
  const rows = parseRows(payload);
  const plan = buildPlan({ rows, start: '20251103', end: '20251104', outputDir: dir, batchSize: 10 });
  assert.equal(plan.pending_date_count, 2);
  writeDates({ rows, dates: ['20251103'], outputDir: dir });
  assert.deepEqual(validateStored(path.join(dir, '20251103', 'vix.json'), '20251103'), []);
});

test('scheduled VIX target remains anchored when runner crosses New York cutoff and date boundary', () => {
  const runnerNow = new Date('2026-09-07T21:00:00Z');
  const occurrence = resolveScheduledOccurrence('35 22 * * 1-5', runnerNow);
  assert.equal(occurrence.scheduled_at_utc, '2026-09-04T22:35:00.000Z');
  assert.equal(resolveAutomaticTargetDate(new Date(occurrence.scheduled_at_utc)), '20260904');
  assert.equal(resolveAutomaticTargetDate(runnerNow), '20260907');
});

test('scheduled VIX target is unchanged by a normal delay', () => {
  const runnerNow = new Date('2026-09-04T23:15:00Z');
  const occurrence = resolveScheduledOccurrence('35 22 * * 1-5', runnerNow);
  assert.equal(occurrence.scheduled_at_utc, '2026-09-04T22:35:00.000Z');
  assert.equal(resolveAutomaticTargetDate(new Date(occurrence.scheduled_at_utc)), '20260904');
  assert.equal(resolveAutomaticTargetDate(runnerNow), '20260904');
});
