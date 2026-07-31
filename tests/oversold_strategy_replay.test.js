'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluateOversoldElectronicsStrategy,
  evaluateMarketReboundReadiness,
} = require('../scripts/evaluate_formal_strategy_replay');
const { OVERSOLD_ELECTRONICS_STRATEGY_ID, OVERSOLD_ELECTRONICS_TAG } = require('../scripts/apply_formal_market_strategy_tags');

function prediction(code) {
  return {
    stock_code: code,
    stock_name: code,
    strategy_tags: [OVERSOLD_ELECTRONICS_TAG],
    formal_market_strategies: {
      [OVERSOLD_ELECTRONICS_STRATEGY_ID]: { strategy_id: OVERSOLD_ELECTRONICS_STRATEGY_ID, candidate_score: 70 },
    },
  };
}
function replay(code, closeReturn) {
  return { stock_code: code, verified: true, actual: { close_return: closeReturn } };
}
const actualEnvironment = { actual_environment: { metrics: { equal_weight_market_return: 3.6, up_ratio: 83.27 } } };

test('oversold electronics hit requires return strictly greater than 5.00%', () => {
  const result = evaluateOversoldElectronicsStrategy(
    [prediction('A'), prediction('B'), prediction('C')],
    [replay('A', 5), replay('B', 5.01), replay('C', -2)],
    actualEnvironment,
  );
  assert.equal(result.candidates, 3);
  assert.equal(result.verified_candidates, 3);
  assert.equal(result.hits, 1);
  assert.deepEqual(result.hit_members, ['B']);
  assert.deepEqual(result.miss_members, ['A', 'C']);
  assert.equal(result.hit_rate, 33.33);
  assert.equal(result.average_market_excess_return, -0.93);
});

test('market gate replay uses equal-weight return and advancing issue ratio together', () => {
  const result = evaluateMarketReboundReadiness({ score: 85, status: '已觸發' }, actualEnvironment);
  assert.equal(result.market_rebound_day, true);
  const failedBreadth = evaluateMarketReboundReadiness({ score: 85 }, { actual_environment: { metrics: { equal_weight_market_return: 3, up_ratio: 60 } } });
  assert.equal(failedBreadth.market_rebound_day, false);
});
