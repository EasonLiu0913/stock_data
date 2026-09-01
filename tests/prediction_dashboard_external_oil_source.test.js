'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  selectExternalMarketDate,
  externalOilBenchmarks,
  eiaSpotBenchmarks,
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

test('externalOilBenchmarks maps CL=F and BZ=F as futures, not spot', () => {
  const rows = prices => prices.map(([date, close]) => ({ date, close }));
  const payload = {
    indicators: [
      {
        id: 'wti_crude_oil', symbol: 'CL=F', market_date: '20260831', previous_market_date: '20260828',
        close: 90, previous_close: 88, change_percent: 2.2727,
        rows: rows([
          ['20260730', 70], ['20260731', 71], ['20260803', 72], ['20260804', 73], ['20260805', 74],
          ['20260806', 75], ['20260807', 76], ['20260810', 77], ['20260811', 78], ['20260812', 79],
          ['20260813', 80], ['20260814', 81], ['20260817', 82], ['20260818', 83], ['20260819', 84],
          ['20260820', 85], ['20260821', 86], ['20260824', 87], ['20260825', 87.5], ['20260828', 88],
          ['20260831', 90],
        ]),
      },
      {
        id: 'brent_crude_oil', symbol: 'BZ=F', market_date: '20260831', previous_market_date: '20260828',
        close: 94, previous_close: 92, change_percent: 2.1739,
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
  assert.deepEqual(
    benchmarks.map(item => [item.id, item.symbol, item.instrument_type, item.latest_price]),
    [
      ['wti_futures', 'CL=F', 'futures', 90],
      ['brent_futures', 'BZ=F', 'futures', 94],
    ],
  );
  assert.equal(benchmarks[0].change_pct_5d, ((90 - 85) / 85) * 100);
  assert.equal(benchmarks[0].change_pct_20d, ((90 - 70) / 70) * 100);
});

test('eiaSpotBenchmarks keeps canonical WTI and Brent spot identities', () => {
  const benchmarks = eiaSpotBenchmarks({
    source_url: 'https://www.eia.gov/example',
    benchmarks: [
      { id: 'wti_spot', benchmark: 'WTI', latest_date: '20260828', latest_price: 86.1 },
      { id: 'brent_spot', benchmark: 'Brent', latest_date: '20260828', latest_price: 89.2 },
      { id: 'other', latest_price: 1 },
    ],
  });
  assert.deepEqual(benchmarks.map(item => [item.id, item.instrument_type, item.source_name]), [
    ['wti_spot', 'spot', 'U.S. EIA Open Data'],
    ['brent_spot', 'spot', 'U.S. EIA Open Data'],
  ]);
});
