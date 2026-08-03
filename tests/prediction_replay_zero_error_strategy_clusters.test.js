'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildStrategyFailureGroups,
  buildCanonicalStrategyGroups,
} = require('../public/prediction-replay-zero-error-strategy-enhancement');

test('keeps general strategy tags with zero obvious direction misses', () => {
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
  assert.equal(byName.get('零錯誤策略').obvious_hit_count, 1);
  assert.equal(byName.get('零錯誤策略').obvious_miss_count, 0);
  assert.equal(byName.get('零錯誤策略').obvious_miss_rate, 0);
  assert.equal(byName.get('零錯誤策略').failure_rate_difference_vs_overall, -25);

  assert.equal(byName.get('有錯誤策略').population_count, 2);
  assert.equal(byName.get('有錯誤策略').obvious_miss_count, 1);
  assert.equal(byName.get('有錯誤策略').obvious_miss_rate, 50);

  assert.equal(byName.get('共同策略').population_count, 2);
  assert.equal(byName.get('共同策略').obvious_miss_count, 1);
});

test('uses the canonical evaluation target for registered strategies', () => {
  const groups = buildCanonicalStrategyGroups({
    registry: {
      strategies: [
        {
          strategy_id: 'oversold_electronics_rebound_v1',
          label: '跌深反彈電子股',
          evaluation_target: 'close_return_gt_5',
          enabled: true,
          fixed_display: true,
        },
      ],
    },
    evaluations: {
      oversold_electronics_rebound_v1: {
        evaluation_target: 'close_return_gt_5',
        calculation_status: 'completed',
        candidates: 13,
        verified_candidates: 12,
        hits: 8,
        misses: 4,
        hit_rate: 66.67,
        missing_replay_candidates: 1,
      },
    },
  });

  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, '跌深反彈電子股');
  assert.equal(groups[0].candidates, 13);
  assert.equal(groups[0].population_count, 12);
  assert.equal(groups[0].hit_count, 8);
  assert.equal(groups[0].miss_count, 4);
  assert.equal(groups[0].hit_rate, 66.67);
  assert.equal(groups[0].miss_rate, 33.33);
});

test('removes registered strategy labels from generic direction clusters', () => {
  const rows = [
    {
      verified: true,
      prediction_match_label: '明顯不準',
      prediction: { strategy_tags: ['跌深反彈電子股', '技術強勢'] },
    },
  ];

  const groups = buildStrategyFailureGroups(rows, ['跌深反彈電子股']);
  assert.deepEqual(groups.map(item => item.name), ['技術強勢']);
});
