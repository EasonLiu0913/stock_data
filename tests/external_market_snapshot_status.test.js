'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { primaryExternalValidation } = require('../scripts/market_environment_lib');

function payload(date, snapshotStatus = null) {
  const value = {
    schemaVersion: snapshotStatus ? 3 : 2,
    generated_at: '2026-08-28T05:21:00.000Z',
    collection_date: date,
    requested_date: date,
    errors: [],
    indicators: ['nasdaq', 'sp500', 'dow', 'sox', 'tsm_adr'].map((id) => ({
      id,
      market_date: date,
    })),
  };
  if (snapshotStatus) value.snapshot_status = snapshotStatus;
  return value;
}

test('legacy exact-date snapshots remain backward compatible', () => {
  const validation = primaryExternalValidation(payload('20260827'), '20260827');
  assert.equal(validation.date_exact, true);
  assert.equal(validation.exact, true);
  assert.equal(validation.final_exact, true);
  assert.equal(validation.is_final, true);
  assert.equal(validation.needs_refresh, false);
});

test('intraday exact-date snapshot is preserved but not ready for downstream use', () => {
  const validation = primaryExternalValidation(payload('20260827', {
    data_status: 'intraday',
    market_phase: 'intraday',
    is_market_closed: false,
    is_final: false,
    needs_refresh: true,
    target_market_date: '20260827',
    actual_market_date: '20260827',
    captured_at: '2026-08-27T18:00:00.000Z',
    captured_at_new_york: '2026-08-27 14:00:00 EDT',
  }), '20260827');

  assert.equal(validation.complete, true);
  assert.equal(validation.date_exact, true);
  assert.equal(validation.exact, false);
  assert.equal(validation.final_exact, false);
  assert.equal(validation.data_status, 'intraday');
  assert.equal(validation.is_final, false);
  assert.equal(validation.needs_refresh, true);
});

test('closed exact-date snapshot becomes final and stops refresh', () => {
  const validation = primaryExternalValidation(payload('20260827', {
    data_status: 'final',
    market_phase: 'closed',
    is_market_closed: true,
    is_final: true,
    needs_refresh: false,
    target_market_date: '20260827',
    actual_market_date: '20260827',
    captured_at: '2026-08-27T21:10:00.000Z',
    captured_at_new_york: '2026-08-27 17:10:00 EDT',
  }), '20260827');

  assert.equal(validation.date_exact, true);
  assert.equal(validation.exact, true);
  assert.equal(validation.final_exact, true);
  assert.equal(validation.data_status, 'final');
  assert.equal(validation.is_final, true);
  assert.equal(validation.needs_refresh, false);
});
