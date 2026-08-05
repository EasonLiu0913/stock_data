'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const expression = require('../public/prediction-tag-strategy-expression-semantics');

const stocks = [
  { stock_code: 'A', atomic_tags: ['sharp_drop', 'margin_exit'] },
  { stock_code: 'B', atomic_tags: ['sharp_drop'] },
  { stock_code: 'C', atomic_tags: ['margin_exit'] },
  { stock_code: 'D', atomic_tags: ['other'] },
];

function matchedCodes(selection) {
  return stocks
    .filter(stock => expression.compositeMatches(stock, selection))
    .map(stock => stock.stock_code);
}

test('AND tags intersect with each other', () => {
  assert.deepEqual(matchedCodes({
    all: ['sharp_drop', 'margin_exit'],
    any: [],
    not: [],
  }), ['A']);
});

test('OR tags form a union with the AND group', () => {
  assert.deepEqual(matchedCodes({
    all: ['sharp_drop'],
    any: ['margin_exit'],
    not: [],
  }), ['A', 'B', 'C']);
});

test('multiple OR tags match at least one OR tag', () => {
  assert.deepEqual(matchedCodes({
    all: [],
    any: ['sharp_drop', 'margin_exit'],
    not: [],
  }), ['A', 'B', 'C']);
});

test('NOT tags are excluded after the positive union', () => {
  assert.deepEqual(matchedCodes({
    all: ['sharp_drop'],
    any: ['margin_exit'],
    not: ['margin_exit'],
  }), ['B']);
});

test('NOT-only selection starts from all stocks and excludes matches', () => {
  assert.deepEqual(matchedCodes({
    all: [],
    any: [],
    not: ['margin_exit'],
  }), ['B', 'D']);
});
