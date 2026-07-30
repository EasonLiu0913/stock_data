'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  compactDate,
  parseArgs,
  selectDates
} = require('../scripts/backfill_prediction_dashboard_fields');
const dashboardGenerator = require('../scripts/generate_prediction_dashboard_data');

test('normalizes supported date formats', () => {
  assert.equal(compactDate('2026-07-27'), '20260727');
  assert.equal(compactDate('2026/07/28'), '20260728');
  assert.equal(compactDate('2026072'), '');
});

test('selects only prediction directories inside an inclusive range', () => {
  const options = parseArgs(['--from', '20260727', '--to=20260728', '--dry-run']);
  assert.deepEqual(
    selectDates(['20260726', '20260727', '20260728', '20260730'], options),
    ['20260727', '20260728']
  );
  assert.equal(options.dryRun, true);
});

test('rejects a reversed date range', () => {
  assert.throws(
    () => parseArgs(['--from', '20260728', '--to', '20260727']),
    /cannot be after/
  );
});

test('single-date selection does not silently fall back', () => {
  const options = parseArgs(['--date', '20260727']);
  assert.deepEqual(selectDates(['20260727', '20260728'], options), ['20260727']);
  assert.deepEqual(selectDates(['20260728'], options), []);
});

test('dashboard generator rejects a missing historical date value', () => {
  assert.throws(
    () => dashboardGenerator.parseArgs(['--date']),
    /requires YYYYMMDD/
  );
});

test('historical rebuild does not repoint a different latest manifest', () => {
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');
  const latestManifest = { output_directory: 'data_predictions/20260730' };
  assert.equal(
    dashboardGenerator.shouldUpdateRootManifest(
      latestManifest,
      path.join(root, 'data_predictions', '20260727')
    ),
    false
  );
  assert.equal(
    dashboardGenerator.shouldUpdateRootManifest(
      latestManifest,
      path.join(root, 'data_predictions', '20260730')
    ),
    true
  );
});
