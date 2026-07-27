'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeCompleteness,
  normalizeVersion,
  numberOrNull
} = require('../scripts/generate_prediction_version_ui');

test('missing numeric values remain null', () => {
  assert.equal(numberOrNull(null), null);
  assert.equal(numberOrNull(undefined), null);
  assert.equal(numberOrNull(''), null);
  assert.equal(numberOrNull('3.5'), 3.5);
});

test('completeness accepts ratio and percentage formats', () => {
  assert.equal(normalizeCompleteness({ data_completeness: 0.85 }), 85);
  assert.equal(normalizeCompleteness({ data_completeness: 85 }), 85);
  assert.equal(normalizeCompleteness({}), null);
});

test('V2 viewer fields expose score delta and experiment metadata', () => {
  const normalized = normalizeVersion({
    methodology_version: '2.0.0-experimental',
    direction_score: 4,
    final_direction_label: '中性偏多',
    experimental_v2: {
      score_delta: 1,
      relative_strength_bucket: 'moderate_strong',
      chip_technical_quadrant: 'both_aligned',
      adjustments: [{ id: 'test', score: 1 }]
    }
  }, 'v2');

  assert.equal(normalized.score, 4);
  assert.equal(normalized.direction, '中性偏多');
  assert.equal(normalized.score_delta, 1);
  assert.equal(normalized.relative_strength_bucket, 'moderate_strong');
  assert.equal(normalized.chip_technical_quadrant, 'both_aligned');
  assert.deepEqual(normalized.adjustments, [{ id: 'test', score: 1 }]);
});
