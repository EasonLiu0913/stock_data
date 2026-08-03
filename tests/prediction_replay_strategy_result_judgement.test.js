'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildStrategyResultIndex,
  resultLabelFor,
  withStrategyJudgements,
} = require('../public/prediction-replay-strategy-result-judgement-enhancement');

test('judges current rebound strategies at 4 percent or above instead of prior direction', () => {
  const rows = [
    { stock_code: '2359', prediction_match_label: '明顯不準', actual: { close_return: 9.5 } },
    { stock_code: '2491', prediction_match_label: '明顯不準', actual: { close_return: 4.79 } },
    { stock_code: '2434', prediction_match_label: '明顯準確', actual: { close_return: 3.99 } },
    { stock_code: '1310', prediction_match_label: '明顯不準', actual: { close_return: null } },
  ];
  const index = buildStrategyResultIndex({
    replay_date: '20260803',
    evaluations: {
      oversold_margin_exit_rebound_v1: {
        evaluation_target: 'intraday_rebound_5d_10pct',
        members: ['2359', '2491', '2434', '1310'],
        hit_members: [],
        miss_members: [],
      },
    },
  }, rows);

  assert.equal(resultLabelFor(index, 'oversold_margin_exit_rebound_v1', '2359'), '明顯準確');
  assert.equal(resultLabelFor(index, 'oversold_margin_exit_rebound_v1', '2491'), '明顯準確');
  assert.equal(resultLabelFor(index, 'oversold_margin_exit_rebound_v1', '2434'), '明顯不準');
  assert.equal(resultLabelFor(index, 'oversold_margin_exit_rebound_v1', '1310'), '尚未驗證');

  const labelsDuringRender = withStrategyJudgements(
    rows,
    index,
    'oversold_margin_exit_rebound_v1',
    () => rows.map(row => row.prediction_match_label),
  );
  assert.deepEqual(labelsDuringRender, ['明顯準確', '明顯準確', '明顯不準', '尚未驗證']);
  assert.deepEqual(
    rows.map(row => row.prediction_match_label),
    ['明顯不準', '明顯不準', '明顯準確', '明顯不準'],
    'rendering must not permanently overwrite the original replay data',
  );
});

test('recomputes electronics rebound hit counts using the 4 percent boundary', () => {
  const index = buildStrategyResultIndex({
    replay_date: '20260803',
    evaluations: {
      oversold_electronics_rebound_v1: {
        evaluation_target: 'close_return_gt_5',
        members: ['2491', '2429', '8021'],
        hit_members: [],
        miss_members: [],
        stocks: [
          { stock_code: '2491', close_return: 4.79 },
          { stock_code: '2429', close_return: 3.99 },
          { stock_code: '8021', close_return: null },
        ],
      },
    },
  });
  const evaluation = index.get('oversold_electronics_rebound_v1');

  assert.equal(evaluation.policy.version, 2);
  assert.equal(evaluation.policyLabel, '當日收盤報酬 ≥ 4.00%');
  assert.equal(evaluation.hits, 1);
  assert.equal(evaluation.misses, 1);
  assert.equal(evaluation.verified, 2);
  assert.equal(evaluation.hitRate, 50);
  assert.equal(resultLabelFor(index, 'oversold_electronics_rebound_v1', '2491'), '明顯準確');
  assert.equal(resultLabelFor(index, 'oversold_electronics_rebound_v1', '8021'), '尚未驗證');
});

test('keeps the previous greater-than-5-percent rule before 20260803', () => {
  const index = buildStrategyResultIndex({
    replay_date: '20260802',
    evaluations: {
      oversold_electronics_rebound_v1: {
        members: ['A', 'B'],
        stocks: [
          { stock_code: 'A', close_return: 5 },
          { stock_code: 'B', close_return: 5.01 },
        ],
      },
    },
  });

  assert.equal(resultLabelFor(index, 'oversold_electronics_rebound_v1', 'A'), '明顯不準');
  assert.equal(resultLabelFor(index, 'oversold_electronics_rebound_v1', 'B'), '明顯準確');
});
