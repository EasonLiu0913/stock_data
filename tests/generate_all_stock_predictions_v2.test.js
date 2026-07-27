'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  chipTechnicalInteraction,
  relativeStrengthAdjustment,
  transformPrediction,
  v2DirectionLabel,
} = require('../scripts/generate_all_stock_predictions_v2');

test('V2 thresholds are symmetric and more selective than V1', () => {
  assert.equal(v2DirectionLabel(6), '偏多');
  assert.equal(v2DirectionLabel(3), '中性偏多');
  assert.equal(v2DirectionLabel(0), '中性');
  assert.equal(v2DirectionLabel(-3), '中性偏空');
  assert.equal(v2DirectionLabel(-6), '偏空');
});

test('moderate relative strength is confirmation only', () => {
  assert.deepEqual(relativeStrengthAdjustment({ relative_strength: 4, rsi14: 55, gap_sma20: 5 }), {
    score: 1,
    bucket: 'moderate_strong',
    rule: 'relative_strength_confirmation_only',
  });
});

test('extreme overextended strength receives mean reversion penalty', () => {
  const result = relativeStrengthAdjustment({ relative_strength: 8, rsi14: 75, gap_sma20: 18 });
  assert.equal(result.score, -1);
  assert.equal(result.bucket, 'extreme_strong');
});

test('chip and technical factors are separated into quadrants', () => {
  const result = chipTechnicalInteraction({
    features: { institutional_ratio: 5, main_net_ratio: 3, rsi14: 55, gap_sma20: 4 },
    view: { scores: [
      { item: 'SMA20', score: 1 },
      { item: '單日報酬', score: 1 },
    ] },
  });
  assert.equal(result.quadrant, 'both_aligned');
  assert.equal(result.score, 1);
});

test('V2 removes legacy relative score before applying nonlinear adjustment', () => {
  const source = {
    methodology_version: '1.1.0',
    stock_code: '2330',
    stock_name: '台積電',
    forecast_date: '2026-07-28',
    direction_score: 5,
    combined_risk_score: 0,
    features: { relative_strength: 8, rsi14: 75, gap_sma20: 18, institutional_ratio: 0, main_net_ratio: 0 },
    view: { scores: [{ item: '相對強弱', score: 2 }], forecast_cards: [] },
  };
  const result = transformPrediction(source);
  assert.equal(result.direction_score, 2);
  assert.equal(result.raw_direction_label, '中性');
});
