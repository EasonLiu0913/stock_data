'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildOilMarketContext,
  classifyOilTrend,
  classifyOilShock,
} = require('../scripts/market_environment_oil_context');

function oilLeg({ oneDay, fiveDay, twentyDay }) {
  return {
    available: true,
    market_date: '20260902',
    close: 90,
    change_1d_pct: oneDay,
    return_5d_pct: fiveDay,
    return_20d_pct: twentyDay,
  };
}

test('oil trend uses the mean 5d move across WTI and Brent', () => {
  const trend = classifyOilTrend(
    oilLeg({ oneDay: 2, fiveDay: 6, twentyDay: 12 }),
    oilLeg({ oneDay: 1.5, fiveDay: 4, twentyDay: 10 }),
  );
  assert.equal(trend.code, 'up');
  assert.equal(trend.basis, 'mean_wti_brent_5d');
  assert.equal(trend.mean_5d_pct, 5);
});

test('oil shock flags a large upside move without changing strategy scoring', () => {
  const shock = classifyOilShock(
    oilLeg({ oneDay: 5.2, fiveDay: 8, twentyDay: 15 }),
    oilLeg({ oneDay: 4.8, fiveDay: 10.4, twentyDay: 14 }),
  );
  assert.equal(shock.active, true);
  assert.equal(shock.direction, 'upside');
  assert.equal(shock.reason, 'threshold_exceeded');
});

test('oil context derives 1d, 5d and 20d metrics from Yahoo futures rows', () => {
  const rows = Array.from({ length: 21 }, (_, index) => ({
    date: String(20260801 + index),
    close: 80 + index,
  }));
  const external = {
    indicators: [
      {
        id: 'wti_crude_oil',
        market_date: '20260902',
        close: 100,
        change_percent: 2.5,
        rows,
      },
      {
        id: 'brent_crude_oil',
        market_date: '20260902',
        close: 105,
        change_percent: 2,
        rows: rows.map((row) => ({ ...row, close: row.close + 5 })),
      },
    ],
  };
  const context = buildOilMarketContext(external);
  assert.equal(context.source, 'yahoo_finance_futures');
  assert.equal(context.scoring_effect, 'none_shadow_context');
  assert.equal(context.instruments.wti.change_1d_pct, 2.5);
  assert.ok(Number.isFinite(context.instruments.wti.return_5d_pct));
  assert.ok(Number.isFinite(context.instruments.wti.return_20d_pct));
  assert.equal(context.oil_shock.active, false);
});

test('missing oil indicators degrade to unavailable rather than failing market environment', () => {
  const context = buildOilMarketContext({ indicators: [] });
  assert.equal(context.instruments.wti.available, false);
  assert.equal(context.instruments.brent.available, false);
  assert.equal(context.oil_trend.code, 'unavailable');
  assert.equal(context.oil_shock.direction, 'unavailable');
});
