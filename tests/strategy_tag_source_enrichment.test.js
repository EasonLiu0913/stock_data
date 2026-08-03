'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  enrichDispositionFeatures,
  enrichLiquidityFeatures,
  enrichStrategyTagSources,
} = require('../scripts/strategy_tag_source_enrichment');

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
}

function dateText(index) {
  return `2026/07/${String(index + 1).padStart(2, '0')}`;
}

function createPriceHistory(root) {
  for (let index = 0; index < 20; index += 1) {
    const compact = `202607${String(index + 1).padStart(2, '0')}`;
    writeJson(path.join(root, 'data_fubon', `fubon_${compact}_sma.json`), {
      '2330': {
        [dateText(index)]: { Price: 100, Volume: 1000 },
      },
      '2317': {
        [dateText(index)]: { Price: 10, Volume: 100 },
      },
      '9999': index === 19 ? {
        [dateText(index)]: { Price: 5, Volume: 10 },
      } : {},
    });
  }
}

function fixturePayload() {
  return {
    forecast_date: '20260803',
    base_trade_date: '20260731',
    stocks: [
      { stock_code: '2330', stock_name: '台積電' },
      { stock_code: '2317', stock_name: '鴻海' },
      { stock_code: '9999', stock_name: '歷史不足' },
    ],
  };
}

test('liquidity uses 20-day traded-value median and market 30th percentile', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tag-liquidity-'));
  createPriceHistory(root);
  const payload = fixturePayload();
  const metadata = enrichLiquidityFeatures(payload, root, '20260731');
  assert.equal(metadata.calculation_status, 'completed');
  assert.equal(metadata.threshold_percentile, 30);
  assert.equal(metadata.valid_cross_section_count, 2);
  assert.equal(metadata.available_stock_count, 3);
  assert.equal(payload.stocks[0].strategy_tag_features.liquidity_qualified, true);
  assert.equal(payload.stocks[1].strategy_tag_features.liquidity_qualified, false);
  assert.equal(payload.stocks[2].strategy_tag_features.liquidity_qualified, false);
  assert.equal(payload.stocks[2].strategy_tag_features.liquidity_reason, 'less_than_20_valid_days');
});

test('missing liquidity cross-section keeps every stock unavailable', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tag-liquidity-missing-'));
  const payload = fixturePayload();
  const metadata = enrichLiquidityFeatures(payload, root, '20260731');
  assert.equal(metadata.calculation_status, 'unable_to_calculate');
  assert.equal(payload.stocks[0].strategy_tag_features.liquidity_qualified, null);
});

test('complete official disposition source gives true and false for every stock', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tag-disposition-'));
  writeJson(path.join(root, 'data_market_constraints', '20260803', 'disposition.json'), {
    target_date: '20260803',
    complete_market_coverage: true,
    active_stock_codes: ['2317'],
  });
  const payload = fixturePayload();
  const metadata = enrichDispositionFeatures(payload, root, '20260803');
  assert.equal(metadata.calculation_status, 'completed');
  assert.equal(metadata.coverage_pct, 100);
  assert.equal(metadata.matched_prediction_stock_count, 1);
  assert.equal(payload.stocks[0].strategy_tag_features.disposition_stock, false);
  assert.equal(payload.stocks[1].strategy_tag_features.disposition_stock, true);
  assert.equal(payload.stocks[2].strategy_tag_features.disposition_stock, false);
});

test('incomplete or wrong-date disposition source remains unavailable', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tag-disposition-incomplete-'));
  writeJson(path.join(root, 'data_market_constraints', '20260803', 'disposition.json'), {
    target_date: '20260802',
    complete_market_coverage: true,
    active_stock_codes: ['2317'],
  });
  const payload = fixturePayload();
  const metadata = enrichDispositionFeatures(payload, root, '20260803');
  assert.equal(metadata.calculation_status, 'unable_to_calculate');
  assert.equal(payload.stocks[1].strategy_tag_features.disposition_stock, null);
});

test('combined enrichment stores both source metadata blocks', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tag-sources-'));
  createPriceHistory(root);
  writeJson(path.join(root, 'data_market_constraints', '20260803', 'disposition.json'), {
    target_date: '20260803',
    complete_market_coverage: true,
    active_stock_codes: [],
  });
  const payload = fixturePayload();
  const result = enrichStrategyTagSources(payload, root, {
    forecastDate: '20260803',
    dataAsOf: '20260731',
  });
  assert.equal(result.liquidity.calculation_status, 'completed');
  assert.equal(result.disposition.calculation_status, 'completed');
  assert.ok(payload.strategy_tag_source_metadata.liquidity);
  assert.ok(payload.strategy_tag_source_metadata.disposition);
});
