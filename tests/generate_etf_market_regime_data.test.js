'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ETF_DEFINITIONS,
  parseYahooRows,
  inferSplitFactor,
  backAdjustSplitRows,
  parseLocalSmaPayload,
  loadLocalEtfSeries,
  fillYahooGapsWithLocal,
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

test('detects and back-adjusts a forward stock split in local prices', () => {
  assert.deepEqual(inferSplitFactor(140, 20), { type: 'forward', factor: 7 });
  const adjusted = backAdjustSplitRows([
    { date: '20260727', close: 140 },
    { date: '20260728', close: 20 },
    { date: '20260729', close: 21 }
  ]);
  assert.equal(adjusted.rows[0].adjustedClose, 20);
  assert.equal(adjusted.rows[1].adjustedClose, 20);
  assert.equal(adjusted.rows[2].adjustedClose, 21);
  assert.equal(adjusted.splitAdjustments.length, 1);
  assert.equal(adjusted.splitAdjustments[0].factor, 7);
});

test('extracts all requested ETF rows from the existing Fubon SMA payload', () => {
  const payload = {
    '0050': { StockName: '元大台灣50', '2026/07/31': { Price: '55.50', Open: '55.00', High: '56.00', Low: '54.80', Volume: '12345' } },
    '0052': { StockName: '富邦科技', '2026/07/31': { Price: '180.25', Volume: '54321' } },
    '00631L': { StockName: '元大台灣50正2', '2026/07/31': { Price: '320.00', Volume: '98765' } }
  };
  const parsed = parseLocalSmaPayload(payload, '20260731');
  assert.deepEqual(Object.keys(parsed).sort(), ['0050', '0052', '00631L']);
  assert.equal(parsed['0050'].close, 55.5);
  assert.equal(parsed['0052'].open, 180.25);
  assert.equal(parsed['00631L'].volume, 98765);
});

test('loads local ETF series from daily SMA files and applies split adjustment', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'etf-sma-'));
  try {
    const writeDay = (date, prices) => {
      const dateKey = `${date.slice(0, 4)}/${date.slice(4, 6)}/${date.slice(6, 8)}`;
      const payload = Object.fromEntries(Object.entries(prices).map(([code, price]) => [code, {
        StockName: code,
        [dateKey]: { Price: String(price), Volume: '1000' }
      }]));
      fs.writeFileSync(path.join(directory, `fubon_${date}_sma.json`), JSON.stringify(payload), 'utf8');
    };
    writeDay('20260727', { '0050': 140, '0052': 70, '00631L': 280 });
    writeDay('20260728', { '0050': 20, '0052': 71, '00631L': 282 });
    writeDay('20260729', { '0050': 21, '0052': 72, '00631L': 284 });

    const loaded = loadLocalEtfSeries({ directory, fromDate: '20260727', toDate: '20260729' });
    assert.equal(loaded.filesRead, 3);
    assert.equal(loaded.rowsById['0050'].length, 3);
    assert.equal(loaded.rowsById['0050'][0].adjustedClose, 20);
    assert.equal(loaded.splitAdjustmentsById['0050'][0].factor, 7);
    assert.equal(loaded.rowsById['0052'][2].adjustedClose, 72);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('fills missing Yahoo dates with local prices scaled to the nearest adjusted-close ratio', () => {
  const merged = fillYahooGapsWithLocal(
    [
      { date: '20260102', close: 100, adjustedClose: 90 },
      { date: '20260106', close: 104, adjustedClose: 93.6 }
    ],
    [
      { date: '20260102', close: 100, adjustedClose: 100 },
      { date: '20260105', close: 102, adjustedClose: 102 },
      { date: '20260106', close: 104, adjustedClose: 104 }
    ]
  );
  assert.equal(merged.filledCount, 1);
  assert.equal(merged.rows[1].date, '20260105');
  assert.equal(merged.rows[1].adjustedClose, 91.8);
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
