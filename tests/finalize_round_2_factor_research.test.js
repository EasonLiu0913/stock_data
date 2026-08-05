'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  FACTOR_IDS,
  canonicalFactorId,
  normalizeResearchFactorIds,
  buildResearchSummary,
  finalizeRound2FactorResearch,
} = require('../scripts/finalize_round_2_factor_research');

function group(eventCount) {
  return {
    event_count: eventCount,
    stock_count: eventCount,
    average_return_1d_pct: 1,
    average_return_3d_pct: 2,
    average_return_5d_pct: 3,
    median_return_5d_pct: 3,
    positive_return_5d_rate_pct: 60,
    rebound_4pct_5d_rate_pct: 20,
    average_excess_return_5d_pct: 1,
    positive_excess_return_5d_rate_pct: 55,
  };
}

function sourcePayload() {
  const oldBreakout = 'volume_breakout_confirmation_v1';
  const oldPullback = 'strong_pullback_volume_contraction_v1';
  return {
    schema_version: 1,
    research_id: 'round_2_volume_margin_factor_event_study_v1',
    generated_at: '2026-08-05T00:00:00.000Z',
    cutoff_date: '20260804',
    source_date_range: ['20260501', '20260804'],
    eligible_signal_date_range: ['20260601', '20260728'],
    chronological_splits: {
      train: ['20260601', '20260701'],
      validation: ['20260702', '20260715'],
      test: ['20260716', '20260728'],
    },
    leakage_guard: {
      signal_features_use_dates_lte_signal_date: true,
      outcomes_are_stored_separately: true,
      latest_outcome_horizon_days: 5,
      random_split_used: false,
    },
    thresholds: { breakout_volume_ratio_min: 1.5 },
    source_files: {
      price: ['a.json'],
      margin: ['b.csv'],
      margin_failures: [],
    },
    availability_observation_count: {
      [oldBreakout]: 100,
      [oldPullback]: 100,
      margin_exit_price_resilience_v1: 80,
      margin_crowding_risk_v1: 80,
    },
    signal_count: {
      [oldBreakout]: 10,
      [oldPullback]: 5,
      margin_exit_price_resilience_v1: 20,
      margin_crowding_risk_v1: 3,
    },
    summaries: {
      [oldBreakout]: { factor_id: oldBreakout, label: '放量突破確認', all: group(10), train: group(6), validation: group(2), test: group(2) },
      [oldPullback]: { factor_id: oldPullback, label: '強勢股回檔量縮', all: group(5), train: group(3), validation: group(1), test: group(1) },
      margin_exit_price_resilience_v1: { factor_id: 'margin_exit_price_resilience_v1', label: '融資退場但股價抗跌', all: group(20), train: group(12), validation: group(4), test: group(4) },
      margin_crowding_risk_v1: { factor_id: 'margin_crowding_risk_v1', label: '融資擁擠風險', all: group(3), train: group(1), validation: group(1), test: group(1) },
    },
    events: [
      { factor_id: oldBreakout, stock_code: '2330' },
      { factor_id: oldPullback, stock_code: '2317' },
    ],
  };
}

test('canonical factor IDs exactly match strategy registry tag IDs', () => {
  assert.equal(
    canonicalFactorId('volume_breakout_confirmation_v1'),
    'technical_volume_breakout_confirmation_v1',
  );
  assert.equal(
    canonicalFactorId('strong_pullback_volume_contraction_v1'),
    'technical_strong_pullback_volume_contraction_v1',
  );
  assert.equal(canonicalFactorId('margin_crowding_risk_v1'), 'margin_crowding_risk_v1');
});

test('normalization remaps counts, summaries, and every event without losing values', () => {
  const normalized = normalizeResearchFactorIds(sourcePayload());
  assert.deepEqual(Object.keys(normalized.signal_count).sort(), [...FACTOR_IDS].sort());
  assert.equal(normalized.signal_count.technical_volume_breakout_confirmation_v1, 10);
  assert.equal(normalized.signal_count.technical_strong_pullback_volume_contraction_v1, 5);
  assert.equal(normalized.summaries.technical_volume_breakout_confirmation_v1.factor_id, 'technical_volume_breakout_confirmation_v1');
  assert.equal(normalized.events[0].factor_id, 'technical_volume_breakout_confirmation_v1');
  assert.equal(normalized.events[1].factor_id, 'technical_strong_pullback_volume_contraction_v1');
  assert.equal(normalized.factor_id_schema, 'strategy_tag_registry_ids_v1');
});

test('compact summary excludes event rows while preserving split statistics', () => {
  const normalized = normalizeResearchFactorIds(sourcePayload());
  const summary = buildResearchSummary(normalized, 'data_research/strategy-factors/round-2/20260804.json');
  assert.equal(summary.event_count, 2);
  assert.equal(summary.events, undefined);
  assert.equal(summary.source_file_count.price, 1);
  assert.equal(summary.summaries.technical_volume_breakout_confirmation_v1.test.event_count, 2);
});

test('finalizer rewrites the research file and creates a readable summary file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'round-2-finalizer-'));
  const input = path.join(root, '20260804.json');
  fs.writeFileSync(input, `${JSON.stringify(sourcePayload(), null, 2)}\n`);
  const result = finalizeRound2FactorResearch({ input });
  const normalized = JSON.parse(fs.readFileSync(input, 'utf8'));
  const summary = JSON.parse(fs.readFileSync(path.join(root, '20260804.summary.json'), 'utf8'));
  assert.equal(result.event_count, 2);
  assert.equal(normalized.events[0].factor_id, 'technical_volume_breakout_confirmation_v1');
  assert.equal(summary.signal_count.technical_strong_pullback_volume_contraction_v1, 5);
  assert.equal(summary.events, undefined);
});
