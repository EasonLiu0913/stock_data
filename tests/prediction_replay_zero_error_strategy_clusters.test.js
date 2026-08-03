'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildStrategyFailureGroups,
} = require('../public/prediction-replay-zero-error-strategy-enhancement');

test('keeps strategies with zero obvious misses', () => {
  const rows = [
    {
      verified: true,
      prediction_match_label: '明顯準確',
      prediction: { strategy_tags: ['零錯誤策略', '共同策略'] },
    },
    {
      verified: true,
      prediction_match_label: '部分準確',
      prediction: { strategy_tags: ['零錯誤策略'] },
    },
    {
      verified: true,
      prediction_match_label: '明顯不準',
      prediction: { strategy_tags: ['有錯誤策略', '共同策略', '共同策略'] },
    },
    {
      verified: true,
      prediction_match_label: '明顯準確',
      prediction: { strategy_tags: ['有錯誤策略'] },
    },
    {
      verified: false,
      prediction_match_label: '明顯不準',
      prediction: { strategy_tags: ['零錯誤策略'] },
    },
  ];

  const groups = buildStrategyFailureGroups(rows);
  const byName = new Map(groups.map(item => [item.name, item]));

  assert.equal(byName.get('零錯誤策略').population_count, 2);
  assert.equal(byName.get('零錯誤策略').obvious_miss_count, 0);
  assert.equal(byName.get('零錯誤策略').obvious_miss_rate, 0);
  assert.equal(byName.get('零錯誤策略').failure_rate_difference_vs_overall, -25);

  assert.equal(byName.get('有錯誤策略').population_count, 2);
  assert.equal(byName.get('有錯誤策略').obvious_miss_count, 1);
  assert.equal(byName.get('有錯誤策略').obvious_miss_rate, 50);

  assert.equal(byName.get('共同策略').population_count, 2);
  assert.equal(byName.get('共同策略').obvious_miss_count, 1);
});
