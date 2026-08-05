'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  calculateTrendQuality,
  enrichHistoricalFactorFeatures,
  linearRegression,
} = require('../scripts/historical_factor_research');

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
}

function compactDate(index) {
  return `202601${String(index + 1).padStart(2, '0')}`;
}

function dateKey(index) {
  return `2026/01/${String(index + 1).padStart(2, '0')}`;
}

function createHistory(root, options = {}) {
  const files = ['files.json'];
  const stockRates = options.stockRates || {
    '1101': 0.02,
    '1102': 0.015,
    '1103': 0.012,
    '1104': 0.01,
    '1105': 0.008,
    '1106': 0.006,
  };
  for (let index = 0; index < 26; index += 1) {
    const date = compactDate(index);
    const payload = {};
    if (options.includeBenchmark !== false) {
      const close = 100 * (1.01 ** index);
      payload['0050'] = {
        StockName: '元大台灣50',
        [dateKey(index)]: {
          Price: close,
          SMA20: close * 0.98,
          SMA60: close * 0.95,
          Volume: 100000,
        },
      };
    }
    for (const [code, rate] of Object.entries(stockRates)) {
      const close = 100 * ((1 + rate) ** index);
      payload[code] = {
        StockName: code,
        [dateKey(index)]: {
          Price: close,
          SMA20: close * 0.97,
          SMA60: close * 0.93,
          Volume: 1000 + index,
        },
      };
    }
    const file = `fubon_${date}_sma.json`;
    files.push(file);
    writeJson(path.join(root, 'data_fubon', file), payload);
  }
  writeJson(path.join(root, 'data_fubon', 'files.json'), files);
}

function fixturePayload() {
  return {
    base_trade_date: '20260125',
    forecast_date: '20260126',
    stocks: ['1101', '1102', '1103', '1104', '1105', '1106'].map(code => ({
      stock_code: code,
      stock_name: code,
      industry: '水泥工業',
    })),
  };
}

test('linear regression returns perfect fit for a straight line', () => {
  const result = linearRegression([1, 3, 5, 7, 9]);
  assert.equal(result.slope, 2);
  assert.equal(result.intercept, 1);
  assert.equal(result.r2, 1);
});

test('trend quality uses log-price slope and R squared', () => {
  const rows = Array.from({ length: 20 }, (_, index) => ({
    date: compactDate(index),
    close: 100 * (1.01 ** index),
  }));
  const result = calculateTrendQuality(rows);
  assert.equal(result.available, true);
  assert.equal(result.pass, true);
  assert.ok(Math.abs(result.slope_pct_per_day - 1) < 0.00001);
  assert.equal(result.r2, 1);
});

test('round-one enrichment calculates all five candidate factors without future leakage', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'historical-factors-'));
  createHistory(root);
  const payload = fixturePayload();
  const metadata = enrichHistoricalFactorFeatures(payload, root, '20260125');
  const leader = payload.stocks.find(stock => stock.stock_code === '1101');

  assert.equal(metadata.benchmark.return_20d_source, '0050');
  assert.equal(metadata.cutoff_date, '20260125');
  assert.equal(metadata.source_files.at(-1), 'data_fubon/fubon_20260125_sma.json');
  assert.equal(leader.strategy_tag_features.historical_factor_latest_date, '20260125');
  assert.equal(leader.strategy_tag_features.trend_quality_20d, true);
  assert.equal(leader.strategy_tag_features.trend_bullish_alignment, true);
  assert.equal(leader.strategy_tag_features.market_relative_strength_20d_top20, true);
  assert.equal(leader.strategy_tag_features.industry_relative_strength_20d_top20, true);
  assert.equal(leader.strategy_tag_features.leadership_persistence_7d, true);
  assert.equal(metadata.available_stock_count.trend_quality, 6);
  assert.equal(metadata.available_stock_count.industry_relative_strength, 6);
});

test('benchmark falls back to cross-section median when 0050 is unavailable', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'historical-factors-fallback-'));
  createHistory(root, { includeBenchmark: false });
  const payload = fixturePayload();
  const metadata = enrichHistoricalFactorFeatures(payload, root, '20260125');
  assert.equal(metadata.benchmark.return_20d_source, 'cross_section_median');
  assert.ok(metadata.benchmark.cross_section_fallback_daily_days > 0);
});

test('insufficient history keeps factors unavailable instead of returning false', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'historical-factors-short-'));
  const files = ['files.json'];
  for (let index = 0; index < 5; index += 1) {
    const date = compactDate(index);
    const file = `fubon_${date}_sma.json`;
    files.push(file);
    writeJson(path.join(root, 'data_fubon', file), {
      '1101': {
        [dateKey(index)]: { Price: 100 + index, SMA20: 99, SMA60: 98 },
      },
    });
  }
  writeJson(path.join(root, 'data_fubon', 'files.json'), files);
  const payload = {
    base_trade_date: '20260105',
    stocks: [{ stock_code: '1101', industry: '水泥工業' }],
  };
  enrichHistoricalFactorFeatures(payload, root, '20260105');
  const features = payload.stocks[0].strategy_tag_features;
  assert.equal(features.trend_quality_20d, null);
  assert.equal(features.market_relative_strength_20d_top20, null);
  assert.equal(features.industry_relative_strength_20d_top20, null);
  assert.equal(features.leadership_persistence_7d, null);
});
