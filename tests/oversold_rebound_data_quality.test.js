'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeDataQualityDateRanges,
  finalizeResearchResult,
} = require('../scripts/oversold_rebound_outcome_verification');

test('data quality range uses successfully loaded dates and preserves discovered range', () => {
  const quality = normalizeDataQualityDateRanges({
    price: {
      first_date: '20251202',
      last_date: '20260731',
      discovered_files: 159,
      loaded_files: 143,
      dates: ['20260731', '20251224', '20251226', '20251224'],
    },
  });
  assert.equal(quality.price.discovered_first_date, '20251202');
  assert.equal(quality.price.discovered_last_date, '20260731');
  assert.equal(quality.price.first_date, '20251224');
  assert.equal(quality.price.last_date, '20260731');
  assert.equal(quality.price.trading_date_count, 3);
  assert.deepEqual(quality.price.dates, ['20251224', '20251226', '20260731']);
});

test('manifest actual range follows normalized price coverage', () => {
  const result = finalizeResearchResult({
    stockResults: [],
    summary: {
      schema_version: 1,
      generated_at: '2026-08-01T00:00:00.000Z',
      notes: [],
      data_quality: {
        price: {
          first_date: '20251202',
          last_date: '20260731',
          dates: ['20251224', '20260731'],
        },
      },
    },
    manifest: {
      date_range: {
        requested_from: null,
        requested_to: null,
        actual_from: '20251202',
        actual_to: '20260731',
      },
    },
  });
  assert.equal(result.manifest.date_range.actual_from, '20251224');
  assert.equal(result.manifest.date_range.actual_to, '20260731');
});
