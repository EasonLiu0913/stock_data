'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAnalysisManifest,
} = require('../scripts/analyze_replay_factor_ranges');

test('factor-range manifest update preserves volume-filter metadata', () => {
  const existing = {
    latest_volume_filter_date: '20260730',
    available_volume_filter_dates: ['20260730', '20260729', '20260728'],
    latest_volume_filter_analysis: 'data_prediction_analysis/20260730/volume-filter-impact.json',
    volume_filter_generated_at: '2026-07-30T08:46:22.044Z',
  };

  const manifest = buildAnalysisManifest(
    existing,
    '20260731',
    '2026-07-31T08:00:00.000Z',
  );

  assert.equal(manifest.latest_date, '20260731');
  assert.equal(
    manifest.latest_json,
    'data_prediction_analysis/20260731/industry-factor-ranges.json',
  );
  assert.equal(manifest.latest_volume_filter_date, '20260730');
  assert.deepEqual(
    manifest.available_volume_filter_dates,
    ['20260730', '20260729', '20260728'],
  );
  assert.equal(
    manifest.latest_volume_filter_analysis,
    'data_prediction_analysis/20260730/volume-filter-impact.json',
  );
});

test('factor-range manifest update accepts a missing or invalid manifest', () => {
  const manifest = buildAnalysisManifest(null, '20260731', 'generated-at');

  assert.deepEqual(manifest, {
    latest_date: '20260731',
    latest_json: 'data_prediction_analysis/20260731/industry-factor-ranges.json',
    latest_markdown: 'data_prediction_analysis/20260731/industry-factor-ranges.md',
    generated_at: 'generated-at',
  });
});
