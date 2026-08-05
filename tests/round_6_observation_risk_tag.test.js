'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const registry = require('../config/strategy-tag-registry.json');
const {
  calculateMarginCrowdingCapitulationContinuationRisk,
} = require('../scripts/historical_factor_research_round_3');
const {
  evaluateStock,
  buildSnapshot,
  validateRegistry,
} = require('../scripts/strategy_tag_engine');

const TAG_ID = 'margin_crowding_capitulation_continuation_risk_v1';

function qualifyingInputs(overrides = {}) {
  return {
    crowdingWeakening: {
      available: true,
      pass: true,
      latest_return_1d_pct: -3,
      price_return_5d_pct: -9,
      sma20_gap_pct: -8,
      ...(overrides.crowdingWeakening || {}),
    },
    trailingRisk: {
      available: true,
      realized_volatility_20d_pct: 5,
      max_drawdown_20d_pct: -14,
      ...(overrides.trailingRisk || {}),
    },
  };
}

test('round-six continuation risk passes the frozen research definition', () => {
  const input = qualifyingInputs();
  const result = calculateMarginCrowdingCapitulationContinuationRisk(
    input.crowdingWeakening,
    input.trailingRisk,
  );
  assert.equal(result.available, true);
  assert.equal(result.pass, true);
  assert.equal(result.conditions.margin_crowding_weakening, true);
  assert.equal(result.conditions.tail_breakdown, true);
});

test('SMA20 breakdown can satisfy the OR tail condition when five-day decline is milder', () => {
  const input = qualifyingInputs({
    crowdingWeakening: {
      price_return_5d_pct: -6,
      sma20_gap_pct: -11,
    },
  });
  const result = calculateMarginCrowdingCapitulationContinuationRisk(
    input.crowdingWeakening,
    input.trailingRisk,
  );
  assert.equal(result.pass, true);
  assert.equal(result.conditions.price_breakdown_5d, false);
  assert.equal(result.conditions.sma20_breakdown, true);
});

test('risk tag fails without same-day capitulation even when other conditions pass', () => {
  const input = qualifyingInputs({
    crowdingWeakening: { latest_return_1d_pct: -1.99 },
  });
  const result = calculateMarginCrowdingCapitulationContinuationRisk(
    input.crowdingWeakening,
    input.trailingRisk,
  );
  assert.equal(result.available, true);
  assert.equal(result.pass, false);
  assert.equal(result.conditions.latest_return_1d, false);
});

test('missing trailing history is unavailable rather than a zero-count false result', () => {
  const input = qualifyingInputs({ trailingRisk: { available: false } });
  const result = calculateMarginCrowdingCapitulationContinuationRisk(
    input.crowdingWeakening,
    input.trailingRisk,
  );
  assert.equal(result.available, false);
  assert.equal(result.pass, null);
});

test('bull or bear context cannot change observation-tag eligibility', () => {
  const input = qualifyingInputs();
  const bull = calculateMarginCrowdingCapitulationContinuationRisk(
    { ...input.crowdingWeakening, market_regime: 'bull' },
    { ...input.trailingRisk, market_regime: 'bull' },
  );
  const bear = calculateMarginCrowdingCapitulationContinuationRisk(
    { ...input.crowdingWeakening, market_regime: 'bear' },
    { ...input.trailingRisk, market_regime: 'bear' },
  );
  assert.deepEqual(bull, bear);
});

test('formal registry keeps the new tag observation-only and out of every strategy', () => {
  assert.equal(validateRegistry(registry), true);
  const tag = registry.tags.find(item => item.tag_id === TAG_ID);
  assert.ok(tag);
  assert.equal(tag.fixed_display, true);
  assert.equal(tag.enabled, true);
  assert.equal(tag.usage_role, 'observation_only');
  assert.equal(tag.affects_strategy_eligibility, false);
  assert.equal(tag.affects_prediction_score, false);
  assert.match(tag.display_hint, /市場趨勢不影響此標籤入選/);
  for (const strategy of registry.strategies) {
    const referenced = [
      ...(strategy.expression?.all || []),
      ...(strategy.expression?.any || []),
      ...(strategy.expression?.not || []),
    ];
    assert.equal(referenced.includes(TAG_ID), false, strategy.strategy_id);
  }
});

test('matching stocks enter the tag list without changing strategy matches', () => {
  const baseStock = {
    stock_code: '2330',
    strategy_tag_features: {
      margin_crowding_capitulation_continuation_risk: false,
    },
  };
  const before = evaluateStock(baseStock, registry);
  const after = evaluateStock({
    ...baseStock,
    strategy_tag_features: {
      ...baseStock.strategy_tag_features,
      margin_crowding_capitulation_continuation_risk: true,
    },
  }, registry);
  assert.equal(after.tag_ids.includes(TAG_ID), true);
  assert.deepEqual(after.strategy_ids, before.strategy_ids);
  assert.deepEqual(after.unavailable_strategy_ids, before.unavailable_strategy_ids);
});

test('enabled observation tag remains visible with count zero and distinguishes unavailable', () => {
  const zeroSnapshot = buildSnapshot({
    forecast_date: '20260805',
    base_trade_date: '20260804',
    stocks: [{
      stock_code: '2330',
      strategy_tag_features: {
        margin_crowding_capitulation_continuation_risk: false,
      },
    }],
  }, registry, { generatedAt: '2026-08-05T00:00:00.000Z' });
  assert.equal(zeroSnapshot.tag_classifications[TAG_ID].count, 0);
  assert.equal(zeroSnapshot.tag_classifications[TAG_ID].calculation_status, 'completed');

  const unavailableSnapshot = buildSnapshot({
    forecast_date: '20260805',
    base_trade_date: '20260804',
    stocks: [{ stock_code: '2330', strategy_tag_features: {} }],
  }, registry, { generatedAt: '2026-08-05T00:00:00.000Z' });
  assert.equal(unavailableSnapshot.tag_classifications[TAG_ID].count, null);
  assert.equal(unavailableSnapshot.tag_classifications[TAG_ID].calculation_status, 'unable_to_calculate');
});
