'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  FORMAL_TAG,
  formalPostShockDecision,
  updateStockTag,
  summarizeStocks,
} = require('../scripts/apply_formal_market_strategy_tags');

function stock(overrides = {}) {
  return {
    stock_code: '2207',
    stock_name: '和泰車',
    final_direction_label: '中性偏多',
    direction_score: 6,
    risk_label: '低風險',
    market_context_risk_label: '高風險',
    data_completeness: 100,
    chip_bias: '偏多',
    strategy_tags: ['優先觀察'],
    missing_data: [],
    features: {
      r1: 3.8,
      r3: 5.17,
      volume_ratio_1d: 2.34,
      volume_ratio_5d: 3.57,
      gap_sma20: 7.04,
      rsi14: 80.22,
      ...overrides.features,
    },
    relative_strength_7d: {
      relative_strength_7d: 11.6,
      relative_strength_strong: true,
      market_return_7d: -5.68,
      ...overrides.relative_strength_7d,
    },
    reversal_signals: { tags: [], crossed_sma20: false, crossed_sma60: false },
    breakout_precursor: { matched: false },
    ...Object.fromEntries(Object.entries(overrides).filter(([key]) => !['features', 'relative_strength_7d'].includes(key))),
  };
}

function environment(code = 'post_shock_day_2') {
  return {
    environment: { code },
    strategy_policy: { relative_leadership_momentum: 'restricted_shadow' },
  };
}

test('formal post-shock label is limited to high-confidence core candidates', () => {
  const matched = formalPostShockDecision(stock(), environment());
  assert.equal(matched.matched, true);
  assert.equal(matched.decision.bucket, 'core');

  const overextended = formalPostShockDecision(stock({ features: { gap_sma20: 12 } }), environment());
  assert.equal(overextended.matched, false);
  assert.equal(overextended.decision.bucket, 'watchlist');
});

test('formal post-shock label is not applied outside post-shock environments', () => {
  assert.equal(formalPostShockDecision(stock(), environment('normal')).matched, false);
  assert.equal(formalPostShockDecision(stock(), environment('risk_warning')).matched, false);
});

test('stock tag update preserves existing strategy labels and adds formal metadata', () => {
  const item = stock();
  assert.equal(updateStockTag(item, environment()), true);
  assert.deepEqual(item.strategy_tags.slice(0, 2), [FORMAL_TAG, '優先觀察']);
  assert.equal(item.formal_market_strategy.label, FORMAL_TAG);
  assert.equal(item.formal_market_strategy.changes_direction_score, false);
});

test('stock tag update removes stale formal labels when environment no longer qualifies', () => {
  const item = stock({ strategy_tags: [FORMAL_TAG, '優先觀察'] });
  assert.equal(updateStockTag(item, environment('normal')), false);
  assert.deepEqual(item.strategy_tags, ['優先觀察']);
  assert.equal(item.formal_market_strategy, undefined);
});

test('formal strategy group summary uses the same dashboard aggregation shape', () => {
  const summary = summarizeStocks([stock()]);
  assert.equal(summary.count, 1);
  assert.equal(summary.bullish_ratio, 100);
  assert.equal(summary.high_risk_ratio, 0);
  assert.deepEqual(summary.directions, { '中性偏多': 1 });
});
