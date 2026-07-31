'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  OVERSOLD_ELECTRONICS_STRATEGY_ID,
  OVERSOLD_ELECTRONICS_TAG,
  oversoldElectronicsDecision,
  updateOversoldElectronicsTag,
  buildRegisteredStrategyClassification,
  definitionFor,
} = require('../scripts/apply_formal_market_strategy_tags');

function stock(overrides = {}) {
  return {
    stock_code: '2330',
    stock_name: '測試電子股',
    industry: '半導體業',
    data_completeness: 100,
    strategy_tags: [],
    final_direction_label: '中性偏空',
    direction_score: -4,
    risk_label: '中風險',
    market_context_risk_label: '中風險',
    chip_bias: '中性或不足',
    features: {
      rsi14: 25,
      r3: -12,
      gap_sma20: -18,
      volume_ratio_1d: 1.1,
      ...overrides.features,
    },
    reversal_signals: overrides.reversal_signals || {},
    ...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== 'features' && key !== 'reversal_signals')),
  };
}

function context(pass = true) {
  return {
    readiness: { score: 85, status: '已觸發' },
    liquidity: {
      available: true,
      by_code: new Map([['2330', {
        pass,
        reason: pass ? null : 'median_traded_value_below_market_p30',
        valid_days: 20,
        latest_volume: 1000,
        median_traded_value_20d: 100000000,
        threshold_value: 50000000,
      }]]),
    },
  };
}

test('fixed oversold electronics strategy matches core criteria without requiring the market gate', () => {
  const item = stock();
  const result = oversoldElectronicsDecision(item, context());
  assert.equal(result.matched, true);
  assert.equal(updateOversoldElectronicsTag(item, context()), true);
  assert.ok(item.strategy_tags.includes(OVERSOLD_ELECTRONICS_TAG));
  assert.equal(item.formal_market_strategies[OVERSOLD_ELECTRONICS_STRATEGY_ID].environment_gate_required, false);
});

test('extreme oversold stocks remain candidates and receive risk warnings', () => {
  const result = oversoldElectronicsDecision(stock({ features: { rsi14: 8, r3: -24, gap_sma20: -35 } }), context());
  assert.equal(result.matched, true);
  assert.ok(result.risk_warnings.includes('極端超賣'));
  assert.ok(result.risk_warnings.includes('連續重挫'));
  assert.ok(result.risk_warnings.includes('遠離均線'));
});

test('digital cloud is not silently widened into the electronics scope', () => {
  const result = oversoldElectronicsDecision(stock({ industry: '數位雲端' }), context());
  assert.equal(result.matched, false);
  assert.ok(result.reasons.includes('industry_not_in_scope'));
});

test('liquidity failure rejects the candidate while disposition source remains an explicit warning', () => {
  const result = oversoldElectronicsDecision(stock(), context(false));
  assert.equal(result.matched, false);
  assert.ok(result.risk_warnings.some(item => item.includes('處置股資料未接入')));
});

test('completed zero candidates and unavailable data produce different classifications', () => {
  const definition = definitionFor(OVERSOLD_ELECTRONICS_STRATEGY_ID);
  const completed = buildRegisteredStrategyClassification(definition, {
    liquidity: { available: true, warnings: [] }, readiness: null,
  }, [], 'generated');
  const unavailable = buildRegisteredStrategyClassification(definition, {
    liquidity: { available: false, warnings: ['missing history'] }, readiness: null,
  }, [], 'generated');
  assert.equal(completed.calculation_status, 'completed');
  assert.equal(completed.count, 0);
  assert.match(completed.calculation_message, /0 筆/);
  assert.equal(unavailable.calculation_status, 'unable_to_calculate');
  assert.equal(unavailable.count, null);
});
