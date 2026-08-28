'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  latestEligibleBaseDate,
} = require('../scripts/resolve_latest_complete_prediction_base');

const holidays = new Set();

function atTaipei(year, month, day, hour, minute) {
  // Taipei is UTC+8 and has no daylight-saving time.
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, 0));
}

test('scheduled morning prediction keeps previous trading day even when runner starts after close', () => {
  const now = atTaipei(2026, 8, 28, 19, 30);
  assert.equal(
    latestEligibleBaseDate(now, holidays, { scheduledBeforeOpen: true }),
    '2026-08-27',
  );
});

test('manual prediction after market data cutoff uses current trading day', () => {
  const now = atTaipei(2026, 8, 28, 19, 30);
  assert.equal(
    latestEligibleBaseDate(now, holidays, { scheduledBeforeOpen: false }),
    '2026-08-28',
  );
});

test('normal morning execution uses previous trading day', () => {
  const now = atTaipei(2026, 8, 28, 7, 52);
  assert.equal(
    latestEligibleBaseDate(now, holidays, { scheduledBeforeOpen: false }),
    '2026-08-27',
  );
});
