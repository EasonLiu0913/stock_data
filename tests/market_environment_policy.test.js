'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  confirmationProfile,
  policyBucket,
  evaluateRelativeLeadershipShadow,
} = require('../scripts/generate_actual_market_environment');

function prediction(code, overrides = {}) {
  return {
    stock_code: code,
    stock_name: code,
    final_direction_label: '中性偏多',
    chip_bias: '偏多',
    features: {
      volume_ratio_5d: 2.5,
      rsi14: 78,
      r1: 1,
      gap_sma20: 5,
      ...overrides.features,
    },
    relative_strength_7d: {
      relative_strength_7d: 9,
      ...overrides.relative_strength_7d,
    },
    breakout_precursor: {
      matched: false,
      ...overrides.breakout_precursor,
    },
    ...Object.fromEntries(Object.entries(overrides).filter(([key]) => !['features', 'relative_strength_7d', 'breakout_precursor'].includes(key))),
  };
}

function replay(code, hit) {
  return {
    stock_code: code,
    verified: true,
    market_relative: {
      classification: hit ? 'relative_leadership' : 'broad_market_driven',
      market_percentile: hit ? 95 : 50,
    },
  };
}

test('confirmation score uses prediction-time momentum, relative strength, chips, and direction', () => {
  const profile = confirmationProfile(prediction('A'));
  assert.equal(profile.score, 7);
  assert.equal(profile.signals.relative_strength_7d_at_least_8, true);
  assert.equal(profile.signals.gap_sma20_at_most_10, true);
  assert.equal(profile.signals.chip_bias_bullish, true);
});

test('risk warning reduced policy keeps confirmed candidates and separates watchlist', () => {
  const core = prediction('A');
  const watch = prediction('B', {
    chip_bias: '中性或不足',
    final_direction_label: '中性',
    features: { volume_ratio_5d: 1.7, rsi14: 72, r1: -1 },
    relative_strength_7d: { relative_strength_7d: 8.5 },
  });
  const excluded = prediction('C', {
    chip_bias: '中性或不足',
    final_direction_label: '中性',
    features: { volume_ratio_5d: 1.6, rsi14: 71, r1: -2 },
    relative_strength_7d: { relative_strength_7d: 4 },
  });

  assert.equal(policyBucket(core, 'reduced_shadow').bucket, 'core');
  assert.equal(policyBucket(watch, 'reduced_shadow').bucket, 'watchlist');
  assert.equal(policyBucket(excluded, 'reduced_shadow').bucket, 'excluded');
});

test('post-shock core requires high confirmation, strong relative strength, and controlled SMA20 gap', () => {
  const strong = prediction('A');
  const overextended = prediction('B', {
    features: { gap_sma20: 12 },
  });
  const lowerScore = prediction('C', {
    chip_bias: '中性或不足',
    final_direction_label: '中性',
  });
  const noRelativeStrength = prediction('D', {
    relative_strength_7d: { relative_strength_7d: 5 },
    breakout_precursor: { matched: true },
  });

  assert.equal(policyBucket(strong, 'restricted_shadow').bucket, 'core');
  assert.equal(policyBucket(overextended, 'restricted_shadow').bucket, 'watchlist');
  assert.equal(policyBucket(lowerScore, 'restricted_shadow').bucket, 'watchlist');
  assert.equal(policyBucket(noRelativeStrength, 'restricted_shadow').bucket, 'watchlist');
});

test('shadow evaluation reports core precision and avoided errors without changing raw candidates', () => {
  const predictions = [
    prediction('A'),
    prediction('B', {
      chip_bias: '中性或不足',
      final_direction_label: '中性',
      features: { volume_ratio_5d: 1.7, rsi14: 72, r1: -1 },
      relative_strength_7d: { relative_strength_7d: 8.5 },
    }),
    prediction('C', {
      chip_bias: '中性或不足',
      final_direction_label: '中性',
      features: { volume_ratio_5d: 1.6, rsi14: 71, r1: -2 },
      relative_strength_7d: { relative_strength_7d: 4 },
    }),
  ];
  const rows = [replay('A', true), replay('B', false), replay('C', false)];
  const result = evaluateRelativeLeadershipShadow(predictions, rows, 'reduced_shadow');

  assert.equal(result.raw_candidates, 3);
  assert.equal(result.raw_hits, 1);
  assert.equal(result.policy_candidates, 1);
  assert.equal(result.policy_hits, 1);
  assert.equal(result.policy_precision, 100);
  assert.equal(result.watchlist_candidates, 1);
  assert.equal(result.excluded_candidates, 1);
  assert.equal(result.avoided_false_positives, 2);
  assert.equal(result.suppressed_true_positives, 0);
  assert.equal(result.net_avoided_errors, 2);
});

test('post-shock high-confidence core separates overextended candidates into watchlist', () => {
  const predictions = [
    prediction('A'),
    prediction('B', { features: { gap_sma20: 27 } }),
    prediction('C', { chip_bias: '中性或不足', final_direction_label: '中性偏多' }),
  ];
  const rows = [replay('A', true), replay('B', false), replay('C', false)];
  const result = evaluateRelativeLeadershipShadow(predictions, rows, 'restricted_shadow');

  assert.equal(result.raw_candidates, 3);
  assert.equal(result.policy_candidates, 1);
  assert.equal(result.policy_hits, 1);
  assert.equal(result.policy_precision, 100);
  assert.equal(result.watchlist_candidates, 2);
  assert.equal(result.policy_candidate_stocks[0].gap_sma20, 5);
});

test('boolean disabled argument remains backward compatible', () => {
  const result = evaluateRelativeLeadershipShadow(
    [prediction('A'), prediction('B')],
    [replay('A', true), replay('B', false)],
    true,
  );
  assert.equal(result.policy_candidates, 0);
  assert.equal(result.avoided_false_positives, 1);
  assert.equal(result.suppressed_true_positives, 1);
});

require('./formal_market_strategy_tags.test');
