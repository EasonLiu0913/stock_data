'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  attachMarketBreadth,
  buildReplayRow,
  failureGroups,
  matchPrediction,
  reasonTags,
  validateReplayDates,
} = require('../scripts/generate_prediction_replay');

function stock(overrides = {}) {
  return {
    stock_code: 'TEST',
    stock_name: 'Test',
    industry: '測試業',
    final_direction_label: '偏多',
    direction_score: 5,
    risk_label: '低風險',
    combined_risk_label: '低風險',
    market_context_risk_label: '低風險',
    data_completeness: 100,
    missing_data: [],
    features: {},
    reversal_signals: { tags: [] },
    relative_strength_7d: {},
    chip_bias: '中性或不足',
    strategy_tags: [],
    ...overrides,
  };
}

function snapshot(overrides = {}) {
  return {
    source_file: 'data_predictions/20260727/TEST.json',
    source_sha256: 'same',
    expected_source_sha256: 'same',
    integrity_status: 'verified',
    captured_at: '2026-07-27T00:00:00.000Z',
    payload: {
      direction_score: 5,
      raw_direction_label: '偏多',
      final_direction_label: '偏多',
      view: {
        scores: [],
        scenarios: [{ label: '基準', target: '90 ～ 110' }],
        levels: [{ type: '近期支撐', price: '90' }],
      },
    },
    ...overrides,
  };
}

function volumeHistory(volume = 1000) {
  return new Map([['TEST', Array.from({ length: 20 }, (_, index) => ({
    date: `202606${String(index + 1).padStart(2, '0')}`,
    volume,
  }))]]);
}

test('missing OHLC and zero volume are excluded instead of producing synthetic shadows', () => {
  const row = buildReplayRow(
    stock(),
    snapshot(),
    { close: 100 },
    { open: null, high: null, low: null, close: 101, volume: 0 },
    volumeHistory(),
    '20260727',
  );

  assert.equal(row.verified, false);
  assert.equal(row.outcome_eligibility.status, 'excluded');
  assert.ok(row.outcome_eligibility.reasons.includes('missing_actual_ohlc'));
  assert.ok(row.outcome_eligibility.reasons.includes('zero_or_missing_volume'));
  assert.equal(row.actual, undefined);
});

test('snapshot mismatch is excluded from the performance denominator', () => {
  const row = buildReplayRow(
    stock(),
    snapshot({ integrity_status: 'mismatch' }),
    { close: 100 },
    { open: 100, high: 102, low: 99, close: 101, volume: 1000 },
    volumeHistory(),
    '20260727',
  );

  assert.equal(row.verified, false);
  assert.ok(row.outcome_eligibility.reasons.includes('forecast_snapshot_hash_mismatch'));
});

test('corporate action without an official opening reference is excluded', () => {
  const row = buildReplayRow(
    stock(),
    snapshot(),
    { close: 100 },
    { open: 97, high: 99, low: 96, close: 98, volume: 1000 },
    volumeHistory(),
    '20260727',
    { corporateAction: { status: 'detected', type: '息' } },
  );

  assert.equal(row.verified, false);
  assert.ok(row.outcome_eligibility.reasons.includes('corporate_action_reference_unavailable'));
});

test('official corporate-action reference adjusts returns and forecast targets without overwriting originals', () => {
  const row = buildReplayRow(
    stock(),
    snapshot(),
    { close: 100 },
    { open: 90, high: 100, low: 89, close: 99, volume: 1000 },
    volumeHistory(),
    '20260727',
    {
      corporateAction: { status: 'detected', type: '息' },
      officialReference: {
        opening_reference_price: 90,
        limit_up_price: 99,
        limit_down_price: 81,
        source_file: 'data_twse_twt49u/20260727_twt49u.json',
      },
    },
  );

  assert.equal(row.verified, true);
  assert.equal(row.actual.close_return, 10);
  assert.equal(row.actual.unadjusted_close_return, -1);
  assert.equal(row.forecast_target_evaluation.scenarios[0].lower, 90);
  assert.equal(row.forecast_target_evaluation.scenarios[0].comparison_lower, 81);
  assert.equal(row.forecast_target_evaluation.scenarios[0].comparison_upper, 99);
});

test('locked limit stocks remain direction-eligible but are removed from mood scoring', () => {
  const row = buildReplayRow(
    stock(),
    snapshot(),
    { close: 100 },
    { open: 110, high: 110, low: 110, close: 110, volume: 1000 },
    volumeHistory(),
    '20260727',
    {
      officialReference: {
        opening_reference_price: 100,
        limit_up_price: 110,
        limit_down_price: 90,
        source_file: 'official.json',
      },
    },
  );

  assert.equal(row.verified, true);
  assert.equal(row.outcome_eligibility.status, 'special_case');
  assert.equal(row.outcome_eligibility.mood_eligible, false);
  assert.ok(row.actual.pattern_tags.includes('一字漲停'));
  assert.equal(row.mood_accuracy, 'not_eligible');
  assert.equal(row.prediction_match_label, '大致準確');
});

test('strong directional move makes a neutral prediction an obvious miss', () => {
  const result = matchPrediction(
    stock({ final_direction_label: '中性' }),
    { close_return: 3 },
    { score: 4 },
  );

  assert.equal(result.direction_accuracy, 'miss');
  assert.equal(result.mood_accuracy, 'miss');
  assert.equal(result.prediction_match_label, '明顯不準');
});

test('bullish-only success tags are not assigned to an accurate bearish prediction', () => {
  const tags = reasonTags(
    stock({
      final_direction_label: '偏空',
      reversal_signals: { tags: ['MACD 黃金交叉'] },
      relative_strength_7d: { relative_strength_strong: true },
    }),
    ['放量下殺'],
    { prediction_match_label: '明顯準確' },
  );

  assert.ok(tags.includes('放量配合方向'));
  assert.ok(!tags.includes('技術轉強後續強'));
  assert.ok(!tags.includes('相對強勢有效'));
});

test('failure groups report error concentration instead of a mechanically zero hit rate', () => {
  const allRows = [
    { verified: true, industry: 'A', prediction_match_label: '明顯不準' },
    { verified: true, industry: 'A', prediction_match_label: '明顯準確' },
    { verified: true, industry: 'B', prediction_match_label: '大致準確' },
  ];
  const misses = [allRows[0]];
  const groups = failureGroups(allRows, misses, (row) => row.industry);

  assert.deepEqual(groups[0], {
    name: 'A',
    population_count: 2,
    obvious_miss_count: 1,
    obvious_miss_rate: 50,
    share_of_all_obvious_misses: 100,
    failure_rate_difference_vs_overall: 16.67,
  });
  assert.equal('hit_rate' in groups[0], false);
});

test('formal replay enforces forecast date and adjacent available Fubon snapshots', () => {
  const result = validateReplayDates({
    predictionDate: '20260724',
    forecastDate: '2026-07-24',
    baseDate: '20260723',
    actualDate: '20260724',
    dryRun: false,
  });
  assert.equal(result.status, 'formal_verified');

  assert.throws(() => validateReplayDates({
    predictionDate: '20260724',
    forecastDate: '2026-07-24',
    baseDate: '20260723',
    actualDate: '20260723',
    dryRun: false,
  }), /actual_date must equal forecast_date/);
});

test('market breadth builds one-percent return bins and identifies relative resilience', () => {
  const returns = [-6, -5, -4, -3.5, -3, -2.5, -2, -1.5, -1, -0.5];
  const rows = returns.map((closeReturn, index) => ({
    stock_code: String(index),
    stock_name: String(index),
    industry: 'A',
    verified: true,
    prediction_match_label: index === 9 ? '大致不準' : '大致準確',
    reason_tags: [],
    actual: { close_return: closeReturn, mood_score: closeReturn },
    outcome_eligibility: { mood_eligible: true },
    causal_analysis: { candidate_causes: [] },
  }));

  const summary = attachMarketBreadth(rows, '20260723', '20260724');
  const distributionCount = summary.return_distribution.reduce((sum, bin) => sum + bin.count, 0);

  assert.equal(summary.sample_count, 10);
  assert.equal(summary.down_ratio, 100);
  assert.equal(distributionCount, 10);
  assert.equal(rows[9].market_relative.classification, 'relative_resilience');
  assert.ok(rows[9].reason_tags.includes('相對抗跌'));
  assert.ok(rows[9].causal_analysis.candidate_causes.some((item) => item.factor_id === 'relative_resilience'));
});

test('a stock moving near the center of a broad selloff is classified as market-driven', () => {
  const returns = [-5, -4.5, -4, -3.5, -3, -2.5, -2, -1.5, -1, 0.5];
  const rows = returns.map((closeReturn, index) => ({
    stock_code: String(index),
    industry: 'A',
    verified: true,
    prediction_match_label: '大致不準',
    reason_tags: [],
    actual: { close_return: closeReturn, mood_score: closeReturn },
    outcome_eligibility: { mood_eligible: true },
    causal_analysis: { candidate_causes: [] },
  }));

  attachMarketBreadth(rows, '20260723', '20260724');

  assert.equal(rows[4].market_relative.classification, 'broad_market_driven');
  assert.ok(rows[4].market_relative.market_influence_score >= 70);
  assert.ok(rows[4].reason_tags.includes('全市場連帶影響'));
  assert.ok(rows[4].causal_analysis.candidate_causes.some((item) => item.factor_id === 'cross_sectional_market_shock'));
});
