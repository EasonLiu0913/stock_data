'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeFactor } = require('../scripts/summarize_mops_revenue_factor_rankings');

function event(yoy, excess, outperformed, positive = true) {
  return {
    factors: { yoy_pct: yoy },
    returns: {
      d5: {
        status: 'complete',
        excess_return_pct: excess,
        outperformed_market: outperformed,
        stock_positive: positive,
      },
    },
  };
}

test('factor ranking measures uplift against same-month universe baseline', () => {
  const months = [
    { month: '202601', payload: { events: [event(20, 2, true), event(15, 1, true), event(-5, -2, false), event(-8, -1, false)] } },
    { month: '202602', payload: { events: [event(25, 1.5, true), event(12, 0.5, true), event(-2, -1, false), event(-4, -0.5, false)] } },
  ];
  const factor = { id: 'yoy_positive', name: 'YoY > 0', test: e => Number(e.factors?.yoy_pct) > 0 };
  const result = summarizeFactor(months, factor, 'd5');
  assert.equal(result.samples, 4);
  assert.equal(result.universe_relative_win_rate, 50);
  assert.equal(result.relative_win_rate, 100);
  assert.equal(result.relative_win_rate_uplift_pp, 50);
  assert.ok(result.avg_excess_uplift_pct > 0);
  assert.equal(result.positive_win_uplift_month_rate, 100);
  assert.equal(result.positive_excess_uplift_month_rate, 100);
  assert.equal(result.stability_score, 100);
});

test('factor can rank positively even when absolute relative win rate is below 50 if universe is worse', () => {
  const months = [
    { month: '202601', payload: { events: [event(20, 0.2, true), event(15, -0.1, false), event(-5, -2, false), event(-8, -1, false), event(-3, -0.5, false)] } },
  ];
  const factor = { id: 'yoy_positive', name: 'YoY > 0', test: e => Number(e.factors?.yoy_pct) > 0 };
  const result = summarizeFactor(months, factor, 'd5');
  assert.equal(result.relative_win_rate, 50);
  assert.equal(result.universe_relative_win_rate, 20);
  assert.equal(result.relative_win_rate_uplift_pp, 30);
  assert.ok(result.ranking_score > 50);
});
