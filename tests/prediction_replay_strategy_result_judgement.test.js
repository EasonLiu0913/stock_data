'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildStrategyResultIndex,
  resultLabelFor,
  withStrategyJudgements,
} = require('../public/prediction-replay-strategy-result-judgement-enhancement');

test('judges rebound strategies by same-day close return instead of prior direction', () => {
  const rows = [
    { stock_code: '2359', prediction_match_label: '明顯不準', actual: { close_return: 9.5 } },
    { stock_code: '2434', prediction_match_label: '明顯準確', actual: { close_return: -6.48 } },
    { stock_code: '1310', prediction_match_label: '明顯不準', actual: { close_return: null } },
  ];
  const index = buildStrategyResultIndex({
    evaluations: {
      oversold_margin_exit_rebound_v1: {
        evaluation_target: 'intraday_rebound_5d_10pct',
        members: ['2359', '2434', '1310'],
        hit_members: [],
        miss_members: [],
      },
    },
  }, rows);

  assert.equal(resultLabelFor(index, 'oversold_margin_exit_rebound_v1', '2359'), '明顯準確');
  assert.equal(resultLabelFor(index, 'oversold_margin_exit_rebound_v1', '2434'), '明顯不準');
  assert.equal(resultLabelFor(index, 'oversold_margin_exit_rebound_v1', '1310'), '尚未驗證');

  const labelsDuringRender = withStrategyJudgements(
    rows,
    index,
    'oversold_margin_exit_rebound_v1',
    () => rows.map(row => row.prediction_match_label),
  );
  assert.deepEqual(labelsDuringRender, ['明顯準確', '明顯不準', '尚未驗證']);
  assert.deepEqual(
    rows.map(row => row.prediction_match_label),
    ['明顯不準', '明顯準確', '明顯不準'],
    'rendering must not permanently overwrite the original replay data',
  );
});

test('recomputes electronics rebound hit counts from actual returns', () => {
  const index = buildStrategyResultIndex({
    evaluations: {
      oversold_electronics_rebound_v1: {
        evaluation_target: 'close_return_gt_5',
        members: ['2327', '2429', '8021'],
        hit_members: [],
        miss_members: [],
        stocks: [
          { stock_code: '2327', close_return: 9.96 },
          { stock_code: '2429', close_return: 2.28 },
          { stock_code: '8021', close_return: null },
        ],
      },
    },
  });
  const evaluation = index.get('oversold_electronics_rebound_v1');

  assert.equal(evaluation.hits, 1);
  assert.equal(evaluation.misses, 1);
  assert.equal(evaluation.verified, 2);
  assert.equal(evaluation.hitRate, 50);
  assert.equal(resultLabelFor(index, 'oversold_electronics_rebound_v1', '8021'), '尚未驗證');
});
