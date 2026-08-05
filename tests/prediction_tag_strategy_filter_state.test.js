'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const predictionUi = require('../public/prediction-tag-strategy-enhancement');

test('AND tags remain an intersection when more conditions are selected', () => {
  const stocks = [
    { stock_code: 'A', atomic_tags: ['three_day_drop', 'margin_exit_today'] },
    { stock_code: 'B', atomic_tags: ['three_day_drop'] },
    { stock_code: 'C', atomic_tags: ['margin_exit_today'] },
  ];
  const selection = {
    all: ['three_day_drop', 'margin_exit_today'],
    any: [],
    not: [],
  };

  assert.deepEqual(
    stocks.filter(stock => predictionUi.compositeMatches(stock, selection)).map(stock => stock.stock_code),
    ['A'],
  );
});

test('adding another composite condition refreshes instead of toggling the filter off', () => {
  const key = predictionUi.COMPOSITE_FILTER_KEY;

  assert.deepEqual(
    predictionUi.compositeFilterTransition('', true),
    { targetKey: key, shouldSet: true },
  );
  assert.deepEqual(
    predictionUi.compositeFilterTransition(key, true),
    { targetKey: key, shouldSet: false },
  );
  assert.deepEqual(
    predictionUi.compositeFilterTransition(key, false),
    { targetKey: '', shouldSet: true },
  );
});
