'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { transformPrediction } = require('../scripts/generate_all_stock_predictions_v2');

function sourcePrediction(overrides = {}) {
  return {
    methodology_version: '1.1.0',
    stock_code: '2330',
    stock_name: '台積電',
    forecast_date: '2026-10-05',
    direction_score: 5,
    combined_risk_score: 0,
    features: {
      relative_strength: 4,
      rsi14: 55,
      gap_sma20: 5,
      institutional_ratio: 4,
      main_net_ratio: 3,
    },
    view: {
      scores: [
        { item: '相對強弱', score: 1 },
        { item: 'SMA20', score: 1 },
        { item: '單日報酬', score: 1 },
      ],
      forecast_cards: [
        { label: '方向分數', value: '5', description: 'V1' },
      ],
      data_note: 'fixture',
    },
    ...overrides,
  };
}

test('V2 preserves source identity while publishing explicit V2 methodology metadata', () => {
  const source = sourcePrediction();
  const result = transformPrediction(source);

  assert.equal(result.stock_code, source.stock_code);
  assert.equal(result.stock_name, source.stock_name);
  assert.equal(result.forecast_date, source.forecast_date);
  assert.equal(result.methodology_version, '2.0.0-experimental');
  assert.equal(result.source_methodology_version, '1.1.0');
  assert.equal(result.source_prediction_path, 'data_predictions/20261005/2330.json');
  assert.equal(result.experimental_v2.status, 'shadow_only_do_not_replace_v1');
});

test('V2 output contract exposes score, direction, adjustment, and viewer fields', () => {
  const result = transformPrediction(sourcePrediction());

  assert.equal(Number.isFinite(result.direction_score), true);
  assert.match(result.raw_direction_label, /^(偏多|中性偏多|中性|中性偏空|偏空)$/);
  assert.match(result.final_direction_label, /^(偏多|中性偏多|中性|中性偏空|偏空)$/);
  assert.equal(Number.isFinite(result.experimental_v2.source_direction_score), true);
  assert.equal(Number.isFinite(result.experimental_v2.score_delta), true);
  assert.equal(typeof result.experimental_v2.relative_strength_bucket, 'string');
  assert.equal(typeof result.experimental_v2.chip_technical_quadrant, 'string');
  assert.equal(Array.isArray(result.experimental_v2.adjustments), true);
  assert.equal(Array.isArray(result.view.scores), true);
  assert.ok(result.view.scores.some((item) => item.item === 'V2 相對強勢校準'));
  assert.ok(result.view.scores.some((item) => item.item === 'V2 籌碼技術交互'));
  assert.equal(
    result.view.forecast_cards.find((card) => card.label === '方向分數')?.value,
    String(result.direction_score),
  );
});

test('V2 transformation does not mutate the V1 source payload', () => {
  const source = sourcePrediction();
  const before = JSON.parse(JSON.stringify(source));

  transformPrediction(source);

  assert.deepEqual(source, before);
});
