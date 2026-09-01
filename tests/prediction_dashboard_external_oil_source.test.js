'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  selectExternalMarketDate,
  externalOilBenchmarks,
} = require('../public/prediction-dashboard-rebound-enhancement.js');

test('selectExternalMarketDate never selects a snapshot newer than prediction base date', () => {
  assert.equal(
    selectExternalMarketDate(['20260828', '20260831', '20260901'], '2026-08-31'),
    '20260831',
  );
  assert.equal(
    selectExternalMarketDate(['20260828', '20260831'], '2026-08-29'),
    '20260828',
  );
  assert.equal(selectExternalMarketDate(['20260901'], '2026-08-31'), null);
});

test('externalOilBenchmarks maps CL=F and BZ=F into dashboard-compatible oil benchmarks', () => {
  const rows = prices => prices.map(([date, close]) => ({ date, close }));
  const payload = {
    indicators: [
      {
        id: 'wti_crude_oil',
        symbol: 'CL=F',
        market_date: '20260831',
        previous_market_date: '20260828',
        close: 90,
        previous_close: 88,
        change_percent: 2.2727,
        rows: rows([
          ['20260730', 70], ['20260731', 71], ['20260803', 72], ['20260804', 73], ['20260805', 74],
          ['20260806', 75], ['20260807', 76], ['20260810', 77], ['20260811', 78], ['20260812', 79],
          ['20260813', 80], ['20260814', 81], ['20260817', 82], ['20260818', 83], ['20260819', 84],
          ['20260820', 85], ['20260821', 86], ['20260824', 87], ['20260825', 87.5], ['20260828', 88],
          ['20260831', 90],
        ]),
      },
      {
        id: 'brent_crude_oil',
        symbol: 'BZ=F',
        market_date: '20260831',
        previous_market_date: '20260828',
        close: 94,
        previous_close: 92,
        change_percent: 2.1739,
        rows: rows([
          ['20260730', 74], ['20260731', 75], ['20260803', 76], ['20260804', 77], ['20260805', 78],
          ['20260806', 79], ['20260807', 80], ['20260810', 81], ['20260811', 82], ['20260812', 83],
          ['20260813', 84], ['20260814', 85], ['20260817', 86], ['20260818', 87], ['20260819', 88],
          ['20260820', 89], ['20260821', 90], ['20260824', 91], ['20260825', 91.5], ['20260828', 92],
          ['20260831', 94],
        ]),
      },
    ],
  };

  const benchmarks = externalOilBenchmarks(payload);
  assert.equal(benchmarks.length, 2);
  assert.deepEqual(
    benchmarks.map(item => [item.id, item.symbol, item.latest_date, item.latest_price]),
    [
      ['wti_spot', 'CL=F', '20260831', 90],
      ['brent_spot', 'BZ=F', '20260831', 94],
    ],
  );
  assert.equal(benchmarks[0].name, 'WTI Crude Oil Futures');
  assert.equal(benchmarks[1].name, 'Brent Crude Oil Futures');
  assert.equal(benchmarks[0].change_pct_5d, 90 / 85 - 1 > 0 ? ((90 - 85) / 85) * 100 : null);
  assert.equal(benchmarks[0].change_pct_20d, ((90 - 70) / 70) * 100);
});
