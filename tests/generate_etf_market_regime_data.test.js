'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ETF_DEFINITIONS,
  parseYahooRows,
  alignRows,
  validateOutput
} = require('../scripts/generate_etf_market_regime_data');

test('parses Yahoo rows and falls back to close when adjusted close is absent', () => {
  const payload = {
    chart: {
      result: [{
        timestamp: [1767229200, 1767315600],
        indicators: {
          quote: [{
            open: [100, 101],
            high: [102, 103],
            low: [99, 100],
            close: [101, 102],
            volume: [1000, 1200]
          }],
          adjclose: [{ adjclose: [100.5, null] }]
        }
      }]
    }
  };
  const rows = parseYahooRows(payload);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].adjustedClose, 100.5);
  assert.equal(rows[1].adjustedClose, 102);
});

test('aligns only dates available in market and every ETF', () => {
  const marketRows = [
    { date: '20260102', close: 20000 },
    { date: '20260105', close: 20100 }
  ];
  const complete = [
    { date: '20260102', close: 100, adjustedClose: 99 },
    { date: '20260105', close: 101, adjustedClose: 100 }
  ];
  const missingSecond = [{ date: '20260102', close: 50, adjustedClose: 49 }];
  const data = {
    '0050': complete,
    '0052': complete,
    '00631L': missingSecond
  };
  const aligned = alignRows(marketRows, data);
  assert.equal(aligned.rows.length, 1);
  assert.deepEqual(aligned.missingDates['00631L'], ['20260105']);
});

test('validates a complete compact output', () => {
  const row = { date: '20260102', marketClose: 20000 };
  for (const etf of ETF_DEFINITIONS) {
    row[etf.closeField] = 100;
    row[etf.adjustedCloseField] = 99;
  }
  const row2 = { ...row, date: '20260105', marketClose: 20100 };
  assert.doesNotThrow(() => validateOutput({ rows: [row, row2] }));
});
