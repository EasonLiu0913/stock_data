'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  loadRegistry,
  loadMarginContext,
  evaluateExpression,
  buildTagStrategySnapshot,
} = require('../scripts/prediction_tag_strategy_engine');

function marginCsv(rows) {
  return [
    '股票代號,股票名稱,融資買進,融資賣出,融資現金償還,融資前日餘額,融資今日餘額,融資限額,融券買進,融券賣出,融券現券償還,融券前日餘額,融券今日餘額,融券限額,資券互抵,註記',
    ...rows,
  ].join('\n');
}

function writeMargin(directory, date, balance) {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, `${date}_twse_margin_balance.csv`),
    marginCsv([`2330,台積電,0,0,0,${balance},${balance},999999,0,0,0,0,0,999999,0,`]),
  );
}

test('registry keeps enabled tags and strategies versioned and internally valid', () => {
  const registry = loadRegistry();
  const tag = registry.tags.find(item => item.tag_id === 'margin_significant_exit_v1');
  const strategy = registry.strategies.find(item => item.strategy_id === 'oversold_margin_exit_rebound_v1');
  assert.equal(tag.family_id, 'margin_significant_exit');
  assert.equal(tag.version, 1);
  assert.equal(tag.fixed_display, true);
  assert.equal(strategy.family_id, 'oversold_margin_exit_rebound');
  assert.equal(strategy.version, 1);
  assert.ok(strategy.expression.all.includes('margin_significant_exit_v1'));
});

test('margin context calculates one-day and five-day balance changes without future files', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'prediction-margin-'));
  const dates = ['20260724', '20260727', '20260728', '20260729', '20260730', '20260731'];
  const balances = [1000, 980, 960, 940, 920, 900];
  dates.forEach((date, index) => writeMargin(directory, date, balances[index]));
  writeMargin(directory, '20260803', 500);

  const context = loadMarginContext('20260731', { marginDirectory: directory });
  const item = context.by_code.get('2330');
  assert.equal(context.available, true);
  assert.deepEqual(context.dates, dates);
  assert.equal(item.change_1d, -20);
  assert.equal(item.change_5d, -100);
  assert.equal(item.change_1d_pct, -2.1739);
  assert.equal(item.change_5d_pct, -10);
});

test('expression supports all, any and not with unavailable kept separate from zero matches', () => {
  const matched = evaluateExpression({
    all: ['a', 'b'], any: ['c', 'd'], not: ['x'],
  }, {
    a: { status: 'matched', matched: true },
    b: { status: 'matched', matched: true },
    c: { status: 'not_matched', matched: false },
    d: { status: 'matched', matched: true },
    x: { status: 'not_matched', matched: false },
  });
  assert.equal(matched.matched, true);

  const unavailable = evaluateExpression({ all: ['a', 'b'], any: [], not: [] }, {
    a: { status: 'matched', matched: true },
    b: { status: 'unavailable', matched: false },
  });
  assert.equal(unavailable.status, 'unavailable');
  assert.deepEqual(unavailable.unavailable_tags, ['b']);
});

test('snapshot always includes fixed tags and strategies even when counts are zero', () => {
  const registry = loadRegistry();
  const summary = {
    forecast_date: '2026-08-03',
    base_trade_date: '2026-07-31',
    stocks: [{
      stock_code: '2330',
      stock_name: '台積電',
      industry: '半導體業',
      data_completeness: 100,
      features: { r3: 2, gap_sma20: 3, rsi14: 50 },
      reversal_signals: { tags: [] },
      strategy_tags: [],
      formal_market_strategies: {},
    }],
  };
  const context = {
    margin: {
      available: true,
      calculation_status: 'completed',
      reason: 'completed',
      dates: ['20260724', '20260727', '20260728', '20260729', '20260730', '20260731'],
      by_code: new Map([['2330', {
        change_1d_pct: 1,
        change_5d_pct: 3,
        current_balance: 1000,
      }]]),
    },
    liquidity: {
      available: true,
      reason: 'completed',
      by_code: new Map([['2330', { pass: true }]]),
    },
  };
  const snapshot = buildTagStrategySnapshot(summary, { registry, context, generatedAt: '2026-08-03T00:00:00.000Z' });
  assert.equal(snapshot.tag_classifications.margin_significant_exit_v1.count, 0);
  assert.equal(snapshot.tag_classifications.margin_significant_exit_v1.calculation_status, 'completed');
  assert.equal(snapshot.strategy_classifications.oversold_margin_exit_rebound_v1.count, 0);
  assert.equal(snapshot.strategy_classifications.oversold_margin_exit_rebound_v1.fixed_display, true);
  assert.ok(snapshot.registry.tags.some(item => item.tag_id === 'margin_significant_exit_v1'));
  assert.ok(snapshot.registry.strategies.some(item => item.strategy_id === 'oversold_margin_exit_rebound_v1'));
});

test('snapshot identifies a margin-exit oversold rebound candidate', () => {
  const registry = loadRegistry();
  const summary = {
    forecast_date: '2026-08-03',
    base_trade_date: '2026-07-31',
    stocks: [{
      stock_code: '6477',
      stock_name: '安集',
      industry: '光電業',
      data_completeness: 100,
      features: { r3: -12, gap_sma20: -15, rsi14: 30 },
      reversal_signals: { tags: [] },
      strategy_tags: [],
      formal_market_strategies: {},
    }],
  };
  const context = {
    margin: {
      available: true,
      calculation_status: 'completed',
      reason: 'completed',
      dates: ['20260724', '20260727', '20260728', '20260729', '20260730', '20260731'],
      by_code: new Map([['6477', {
        change_1d_pct: -4,
        change_5d_pct: -8,
        current_balance: 900,
      }]]),
    },
    liquidity: {
      available: true,
      reason: 'completed',
      by_code: new Map([['6477', { pass: true }]]),
    },
  };
  const snapshot = buildTagStrategySnapshot(summary, { registry, context });
  assert.deepEqual(snapshot.tag_classifications.margin_significant_exit_v1.members, ['6477']);
  assert.deepEqual(snapshot.strategy_classifications.oversold_margin_exit_rebound_v1.members, ['6477']);
  assert.ok(summary.stocks[0].prediction_tags.includes('margin_significant_exit_v1'));
  assert.ok(summary.stocks[0].prediction_strategies.includes('oversold_margin_exit_rebound_v1'));
  assert.ok(summary.stocks[0].strategy_tags.includes('融資退場型跌深反彈'));
});
