'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FILTER_KEY,
  STRATEGY_ID,
  STRATEGY_LABEL,
  isReboundCandidate,
  reboundCandidates,
} = require('../public/prediction-dashboard-rebound-enhancement');

test('rebound candidate filter uses the formal strategy registry entry', () => {
  const stock = {
    stock_code: '2330',
    formal_market_strategies: {
      [STRATEGY_ID]: { strategy_id: STRATEGY_ID, label: STRATEGY_LABEL },
    },
  };

  assert.equal(FILTER_KEY, 'oversoldElectronicsRebound');
  assert.equal(isReboundCandidate(stock), true);
});

test('rebound candidate filter supports the formal strategy and strategy tag fallbacks', () => {
  assert.equal(isReboundCandidate({
    formal_market_strategy: { strategy_id: STRATEGY_ID },
  }), true);
  assert.equal(isReboundCandidate({
    strategy_tags: [STRATEGY_LABEL],
  }), true);
  assert.equal(isReboundCandidate({
    strategy_tags: ['熊市時防禦抗跌股'],
  }), false);
});

test('rebound candidate list contains only matched dashboard stocks', () => {
  const payload = {
    stocks: [
      { stock_code: '1111', strategy_tags: [STRATEGY_LABEL] },
      { stock_code: '2222', formal_market_strategies: { [STRATEGY_ID]: {} } },
      { stock_code: '3333', strategy_tags: [] },
    ],
  };

  assert.deepEqual(
    reboundCandidates(payload).map(stock => stock.stock_code),
    ['1111', '2222'],
  );
  assert.deepEqual(reboundCandidates(null), []);
});
