'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  normalizeDomCapture,
  normalizeFile,
  validateInputFilename,
} = require('./normalize_wantgoo_margin_dom');

function captureFixture() {
  return {
    source: {
      name: 'Wantgoo',
      page: 'https://www.wantgoo.com/stock/margin-trading/exclude-etf/taiex',
    },
    scrapedAt: '2026-07-29T06:47:18.296Z',
    tradeDate: '2026-07-28',
    tradeDateCompact: '20260728',
    latest: {
      financingBalance100M: 5109.03,
      financingChange100M: -227.83,
      marginMaintenanceRatePercent: 139.69,
      shortBalanceLots: 137649,
      shortChangeLots: 39448,
      shortFinancingRatioPercent: 2.11,
      financingBalanceLotsEstimated: 6523649,
      close: 41603.36,
      changePercent: -4.65,
      volume: 8111,
    },
    chartHistory: [
      {
        date: '2026-07-28',
        timestamp: 1785168000000,
        taiex: {
          open: 43221.93,
          high: 43221.93,
          low: 41565,
          close: 41603.36,
        },
        marginMaintenanceRatePercent: 139.685,
        financingBalance100M: 5109.03,
        shortBalanceLots: 137649,
      },
      {
        date: '2026-07-29',
        timestamp: 1785254400000,
        taiex: {
          open: 41491.48,
          high: 41698.39,
          low: 39384.85,
          close: 40039.18,
        },
        marginMaintenanceRatePercent: null,
        financingBalance100M: null,
        shortBalanceLots: null,
      },
    ],
    table: [
      {
        date: '2026-07-28',
        financingBalance100M: 5109.03,
      },
    ],
    metadata: {
      tableRowCount: 1,
      chartRowCount: 2,
    },
  };
}

function withTemporaryDirectory(callback) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'wantgoo-dom-normalize-test-'),
  );
  try {
    return callback(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('validates the required manual DOM filename', () => {
  assert.equal(
    validateInputFilename('/tmp/20260728_wantgoo_margin_dom.json'),
    '20260728',
  );
  assert.throws(
    () => validateInputFilename('/tmp/20260728.json'),
    /Invalid input filename/,
  );
});

test('normalizes manual values and keeps estimated fields separate', () => {
  const normalized = normalizeDomCapture(captureFixture(), {
    expectedDate: '20260728',
    sourceFile:
      'data_wantgoo_margin/manual/raw/20260728_wantgoo_margin_dom.json',
  });

  assert.equal(normalized.date, '20260728');
  assert.equal(normalized.metrics.marginMaintenanceRatePercent, 139.685);
  assert.equal(normalized.metrics.financingBalance100M, 5109.03);
  assert.equal(normalized.metrics.financingBalanceLots, null);
  assert.equal(
    normalized.metrics.financingBalanceLotsEstimated,
    6523649,
  );
  assert.deepEqual(normalized.quality.estimatedFields, [
    'financingBalanceLotsEstimated',
  ]);
});

test('rejects a filename date that differs from the JSON date', () => {
  assert.throws(
    () => normalizeDomCapture(captureFixture(), {
      expectedDate: '20260727',
    }),
    /Filename date .* does not match JSON date/,
  );
});

test('rejects inconsistent latest and chart metrics', () => {
  const capture = captureFixture();
  capture.chartHistory[0].shortBalanceLots = 1;
  assert.throws(
    () => normalizeDomCapture(capture, {
      expectedDate: '20260728',
    }),
    /latest.shortBalanceLots does not match chartHistory/,
  );
});

test('writes normalized output and refreshes the manual index', () => {
  withTemporaryDirectory((directory) => {
    const rawDir = path.join(directory, 'manual', 'raw');
    const outputRoot = path.join(directory, 'manual');
    fs.mkdirSync(rawDir, { recursive: true });
    const inputFile = path.join(
      rawDir,
      '20260728_wantgoo_margin_dom.json',
    );
    fs.writeFileSync(inputFile, JSON.stringify(captureFixture()), 'utf8');

    const first = normalizeFile(inputFile, {
      outputRoot,
      repositoryRoot: directory,
    });
    const second = normalizeFile(inputFile, {
      outputRoot,
      repositoryRoot: directory,
    });

    assert.equal(first.status, 'saved');
    assert.equal(second.status, 'unchanged');
    assert.deepEqual(
      JSON.parse(fs.readFileSync(first.indexFile, 'utf8')),
      [
        'normalized/20260728_wantgoo_margin_dom_normalized.json',
      ],
    );
  });
});

test('refuses a different same-date record unless force is explicit', () => {
  withTemporaryDirectory((directory) => {
    const rawDir = path.join(directory, 'manual', 'raw');
    const outputRoot = path.join(directory, 'manual');
    fs.mkdirSync(rawDir, { recursive: true });
    const inputFile = path.join(
      rawDir,
      '20260728_wantgoo_margin_dom.json',
    );
    const capture = captureFixture();
    fs.writeFileSync(inputFile, JSON.stringify(capture), 'utf8');
    normalizeFile(inputFile, {
      outputRoot,
      repositoryRoot: directory,
    });

    capture.latest.financingChange100M = -200;
    fs.writeFileSync(inputFile, JSON.stringify(capture), 'utf8');
    assert.throws(
      () => normalizeFile(inputFile, {
        outputRoot,
        repositoryRoot: directory,
      }),
      /already exists with different content/,
    );

    const forced = normalizeFile(inputFile, {
      outputRoot,
      repositoryRoot: directory,
      force: true,
    });
    assert.equal(forced.status, 'saved');
  });
});
