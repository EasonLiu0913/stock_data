'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  compactDate,
  parseArgs,
  selectDates
} = require('../scripts/backfill_prediction_dashboard_fields');

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
