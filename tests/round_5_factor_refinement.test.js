'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  percentage,
  summarizeBreadthRecords,
  computeBreadthSnapshot,
  breadthForIndustry,
  buildAblationComparison,
  buildBreadthVariantComparison,
  evaluateRound5Promotion,
  buildCompactSummary,
} = require('../scripts/round_5_factor_refinement_lib');

test('percentage preserves missing denominator as unavailable', () => {
  assert.equal(percentage(2, 4), 50);
  assert.equal(percentage(1, 0), null);
});

test('breadth summary counts only available SMA, return, and breakout observations', () => {
  const summary = summarizeBreadthRecords([
    {
      history: [{ close: 110, sma20: 100 }],
      return20d: 5,
      breakout: { pass: true },
    },
    {
      history: [{ close: 90, sma20: 100 }],
      return20d: -2,
      breakout: { pass: false },
    },
    {
      history: [{ close: 80, sma20: null }],
      return20d: null,
      breakout: { pass: null },
    },
  ]);
  assert.equal(summary.peer_count, 3);
  assert.equal(summary.above_sma20_rate_pct, 50);
  assert.equal(summary.positive_return_20d_rate_pct, 50);
  assert.equal(summary.breakout_rate_pct, 50);
});

test('breadth snapshot separates market and industry cross sections', () => {
  const records = [
    { industry: '電子', history: [{ close: 110, sma20: 100 }], return20d: 5, breakout: { pass: true } },
    { industry: '電子', history: [{ close: 105, sma20: 100 }], return20d: 2, breakout: { pass: false } },
    { industry: '金融', history: [{ close: 90, sma20: 100 }], return20d: -1, breakout: { pass: false } },
  ];
  const snapshot = computeBreadthSnapshot(records, { minimumIndustryPeers: 2 });
  assert.equal(snapshot.market.peer_count, 3);
  assert.equal(snapshot.industries['電子'].peer_count, 2);
  assert.equal(snapshot.industries['電子'].above_sma20_rate_pct, 100);
});

test('industry breadth remains unknown when peer count is below the minimum', () => {
  const snapshot = computeBreadthSnapshot([
    { industry: '電子', history: [{ close: 110, sma20: 100 }], return20d: 5, breakout: { pass: true } },
  ], { minimumIndustryPeers: 2 });
  const breadth = breadthForIndustry(snapshot, '電子');
  assert.equal(breadth.industry_peer_count, 1);
  assert.equal(breadth.industry_breadth_available, false);
  assert.equal(breadth.industry_above_sma20_rate_pct, null);
});

test('ablation comparison reports recovered samples and test deltas against reference', () => {
  const definitions = [
    {
      candidate_id: 'reference',
      label: 'reference',
      analysis_role: 'ablation',
      ablation_group: 'g',
      ablation_role: 'reference',
    },
    {
      candidate_id: 'remove_vol',
      label: 'remove vol',
      analysis_role: 'ablation',
      ablation_group: 'g',
      ablation_role: 'remove_one',
      removed_condition: 'volatility_guard',
    },
  ];
  const summaries = {
    reference: {
      all: { event_count: 2 },
      walk_forward_test: {
        event_count: 1,
        average_excess_return_5d_pct: 0.5,
        return_5d_p10_pct: -3,
      },
    },
    remove_vol: {
      all: { event_count: 10 },
      walk_forward_test: {
        event_count: 4,
        average_excess_return_5d_pct: 0.2,
        return_5d_p10_pct: -4,
      },
    },
  };
  const comparison = buildAblationComparison(summaries, definitions).g;
  const row = comparison.rows.find(item => item.candidate_id === 'remove_vol');
  assert.equal(row.recovered_event_count_vs_reference, 8);
  assert.equal(row.delta_test_excess_vs_reference_pct, -0.3);
  assert.equal(row.delta_test_p10_vs_reference_pct, -1);
});

test('breadth comparison retains selection and tail metrics for each variant', () => {
  const definitions = [{
    candidate_id: 'market',
    label: 'market',
    analysis_role: 'breadth_variant',
    breadth_group: 'b',
  }];
  const summaries = {
    market: {
      all: { event_count: 5 },
      selection_rate_from_base_pct: 10,
      walk_forward_test: {
        event_count: 2,
        average_return_5d_pct: 1,
        average_excess_return_5d_pct: 0.5,
        positive_excess_return_5d_rate_pct: 50,
        return_5d_p10_pct: -2,
        cvar_5pct_return_5d_pct: -3,
        extreme_loss_rate_pct: 0,
      },
    },
  };
  const row = buildBreadthVariantComparison(summaries, definitions).b[0];
  assert.equal(row.event_count, 5);
  assert.equal(row.walk_forward_test_cvar_5pct_return_5d_pct, -3);
});

test('ablation variants can never become formal promotion candidates automatically', () => {
  const result = evaluateRound5Promotion(
    {},
    { analysis_role: 'ablation' },
    () => ({ status: 'promotion_eligible', passed: true }),
  );
  assert.equal(result.status, 'analysis_only');
  assert.equal(result.passed, false);
});

test('compact summary excludes event rows while preserving ablation and breadth studies', () => {
  const compact = buildCompactSummary({
    schema_version: 1,
    research_id: 'r',
    candidate_registry_id: 'c',
    candidate_registry_status: 'research_only',
    generated_at: 'now',
    cutoff_date: '20260804',
    source_date_range: [],
    eligible_signal_date_range: [],
    cooldown_trading_days: 5,
    market_regime_definition: {},
    market_regime_signal_date_count: {},
    walk_forward_definition: {},
    walk_forward_folds: [],
    tail_risk_definition: {},
    breadth_definition: {},
    leakage_guard: {},
    source_file_count: {},
    candidate_definitions: [],
    base_candidate_independent_event_count: {},
    availability_observation_count: {},
    raw_signal_count: {},
    ablation_comparison: { a: {} },
    breadth_variant_comparison: { b: [] },
    summaries: {},
    events: [{ id: 1 }],
    cooldown_suppressed_events: [{ id: 2 }],
  });
  assert.equal(compact.independent_event_count, 1);
  assert.equal(compact.cooldown_suppressed_count, 1);
  assert.equal(compact.events, undefined);
  assert.deepEqual(compact.ablation_comparison, { a: {} });
});
