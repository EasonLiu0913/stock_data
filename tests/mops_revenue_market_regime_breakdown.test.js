'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  trailingMarketRegime,
  buildCrossRegimeSummary,
} = require('../scripts/summarize_mops_revenue_market_regime_breakdown');

function rowsFromCloses(closes) {
  return closes.map((close, i) => ({ date: `202601${String(i + 1).padStart(2, '0')}`, close }));
}

test('market regime uses only trailing rows ending at base trading date', () => {
  const rows = rowsFromCloses(Array.from({ length: 22 }, (_, i) => 100 + i));
  rows.push({ date: '20260123', close: 50 });
  const result = trailingMarketRegime(rows, '20260121', 20);
  assert.equal(result.code, 'strong');
  assert.equal(result.base_trading_date, '20260121');
  assert.equal(result.lookback_start_date, '20260101');
  assert.equal(result.trailing_return_pct, 20);
});

test('market regime separates strong sideways and weak by trailing return', () => {
  assert.equal(trailingMarketRegime(rowsFromCloses([100, 104]), '20260102', 1).code, 'strong');
  assert.equal(trailingMarketRegime(rowsFromCloses([100, 102]), '20260102', 1).code, 'sideways');
  assert.equal(trailingMarketRegime(rowsFromCloses([100, 96]), '20260102', 1).code, 'weak');
});

test('cross regime robustness requires at least two credible positive regimes', () => {
  const base = {
    factor_id: 'f', factor_name: 'F', industry: '航運業', horizon: 'd5', credible: true,
    samples: 25, covered_months: 2,
  };
  const rows = [
    { ...base, regime: 'strong', industry_win_uplift_pp: 5, industry_excess_uplift_pct: 1 },
    { ...base, regime: 'sideways', industry_win_uplift_pp: 2, industry_excess_uplift_pct: 0.5 },
    { ...base, regime: 'weak', credible: false, industry_win_uplift_pp: -3, industry_excess_uplift_pct: -1 },
  ];
  const summary = buildCrossRegimeSummary(rows)[0];
  assert.equal(summary.credible_regimes, 2);
  assert.equal(summary.positive_regimes, 2);
  assert.equal(summary.all_credible_regimes_positive, true);
});
