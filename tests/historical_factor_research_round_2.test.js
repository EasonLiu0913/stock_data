'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  calculateVolumeBreakout,
  calculatePullbackVolumeContraction,
  calculateMarginExitPriceResilience,
  calculateMarginCrowdingRaw,
  enrichRound2HistoricalFactorFeatures,
} = require('../scripts/historical_factor_research_round_2');
const {
  chronologicalSplitMap,
  buildRound2EventResearchFromContext,
} = require('../scripts/generate_round_2_factor_research');

function rowsFrom(closes, volumes, sma20 = null) {
  return closes.map((close, index) => ({
    date: `202601${String(index + 1).padStart(2, '0')}`,
    close,
    high: close,
    volume: volumes[index],
    sma20: Array.isArray(sma20) ? sma20[index] : (sma20 ?? close * 0.97),
  }));
}

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
}

function date(index) {
  return `202601${String(index + 1).padStart(2, '0')}`;
}

function baseRows() {
  return Array.from({ length: 30 }, (_, index) => ({
    date: date(index),
    close: 100 + (index * 0.2),
    high: 100 + (index * 0.2),
    volume: 1000,
    sma20: 98,
  }));
}

test('volume breakout requires both a new 20-day closing high and 1.5x volume', () => {
  const closes = Array.from({ length: 21 }, (_, index) => 100 + index);
  const volumes = Array(20).fill(100).concat(160);
  const result = calculateVolumeBreakout(rowsFrom(closes, volumes));
  assert.equal(result.available, true);
  assert.equal(result.pass, true);
  assert.equal(result.breakout_level, 119);
  assert.equal(result.volume_ratio, 1.6);

  volumes[20] = 140;
  assert.equal(calculateVolumeBreakout(rowsFrom(closes, volumes)).pass, false);
});

test('strong pullback requires prior strength, a controlled 2-8% pullback, SMA20 support, and volume contraction', () => {
  const closes = Array.from({ length: 21 }, (_, index) => 100 + index);
  closes.push(114);
  const volumes = Array(21).fill(100).concat(70);
  const sma20 = Array(21).fill(105).concat(112);
  const result = calculatePullbackVolumeContraction(rowsFrom(closes, volumes, sma20));
  assert.equal(result.available, true);
  assert.equal(result.pass, true);
  assert.ok(result.strength_return_20d_pct >= 8);
  assert.ok(result.pullback_pct <= -2 && result.pullback_pct >= -8);
  assert.equal(result.volume_ratio, 0.7);

  volumes[21] = 95;
  assert.equal(calculatePullbackVolumeContraction(rowsFrom(closes, volumes, sma20)).pass, false);
});

test('margin exit resilience needs five-day financing reduction while price holds', () => {
  const rows = rowsFrom([100, 100, 99, 99, 99, 99], [100, 100, 100, 100, 100, 100], 98);
  const result = calculateMarginExitPriceResilience(rows, {
    margin_change_5d: -100,
    margin_balance: 900,
  });
  assert.equal(result.available, true);
  assert.equal(result.pass, true);
  assert.equal(result.margin_exit_ratio_5d_pct, -10);

  assert.equal(calculateMarginExitPriceResilience(rows, {
    margin_change_5d: 100,
    margin_balance: 1100,
  }).pass, false);
});

test('margin crowding raw ratio uses financing balance divided by 20-day median volume', () => {
  const rows = rowsFrom(Array(20).fill(100), Array(20).fill(200), 98);
  const result = calculateMarginCrowdingRaw(rows, {
    margin_change_5d: 50,
    margin_balance: 1000,
  });
  assert.equal(result.available, true);
  assert.equal(result.ratio, 5);
});

test('enrichment preserves unavailable margin factors as null and computes cross-sectional crowding threshold', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'round2-factors-'));
  const stocks = Array.from({ length: 20 }, (_, index) => ({
    stock_code: String(1101 + index),
    strategy_tag_features: {
      margin_change_5d: index === 19 ? 100 : -10,
      margin_balance: (index + 1) * 1000,
    },
  }));
  const files = ['files.json'];
  for (let day = 0; day < 22; day += 1) {
    const currentDate = `202601${String(day + 1).padStart(2, '0')}`;
    const formatted = `2026/01/${String(day + 1).padStart(2, '0')}`;
    const source = {};
    for (let index = 0; index < stocks.length; index += 1) {
      const code = stocks[index].stock_code;
      const close = 100 + day;
      source[code] = {
        [formatted]: {
          Price: close,
          High: close,
          Volume: index === 19 ? 100 : 1000,
          SMA20: close * 0.97,
        },
      };
    }
    const file = `fubon_${currentDate}_sma.json`;
    files.push(file);
    writeJson(path.join(root, 'data_fubon', file), source);
  }
  writeJson(path.join(root, 'data_fubon', 'files.json'), files);

  const payload = { base_trade_date: '20260122', stocks };
  const metadata = enrichRound2HistoricalFactorFeatures(payload, root, '20260122');
  assert.equal(metadata.calculation_status, 'completed');
  assert.equal(metadata.available_stock_count.margin_crowding_risk, 20);
  const crowded = payload.stocks.at(-1).strategy_tag_features;
  assert.equal(crowded.margin_crowding_risk, true);
  assert.ok(crowded.margin_balance_to_volume_20d > metadata.thresholds.margin_crowding_ratio_threshold);

  const unavailablePayload = {
    base_trade_date: '20260122',
    stocks: [{ stock_code: '9999', strategy_tag_features: {} }],
  };
  enrichRound2HistoricalFactorFeatures(unavailablePayload, root, '20260122');
  assert.equal(unavailablePayload.stocks[0].strategy_tag_features.margin_exit_price_resilience, null);
  assert.equal(unavailablePayload.stocks[0].strategy_tag_features.margin_crowding_risk, null);
});

test('chronological split keeps later dates in validation and test', () => {
  const split = chronologicalSplitMap(['20260101', '20260102', '20260103', '20260104', '20260105']);
  assert.equal(split.map.get('20260101'), 'train');
  assert.equal(split.map.get('20260104'), 'validation');
  assert.equal(split.map.get('20260105'), 'test');
});

test('event research separates signal-time factors from future 1/3/5-day outcomes', () => {
  const stocks = Array.from({ length: 20 }, (_, index) => ({
    stock_code: String(1101 + index),
    stock_name: `S${index + 1}`,
    industry: '測試產業',
  }));
  const byCode = new Map();
  for (const stock of stocks) byCode.set(stock.stock_code, baseRows());

  const breakout = byCode.get('1101');
  breakout[24] = { ...breakout[24], close: 120, high: 120, volume: 2000, sma20: 105 };
  breakout[25].close = 121;
  breakout[27].close = 124;
  breakout[29].close = 128;

  const pullback = byCode.get('1102');
  for (let index = 0; index <= 23; index += 1) {
    pullback[index].close = 100 + (index * 1.3);
    pullback[index].high = pullback[index].close;
    pullback[index].sma20 = 115;
  }
  pullback[24] = { ...pullback[24], close: 123, high: 123, volume: 500, sma20: 120 };
  pullback[25].close = 124;
  pullback[27].close = 126;
  pullback[29].close = 129;

  const resilient = byCode.get('1103');
  for (let index = 19; index <= 24; index += 1) {
    resilient[index].close = index === 19 ? 100 : 99;
    resilient[index].high = resilient[index].close;
    resilient[index].sma20 = 98;
  }
  resilient[25].close = 100;
  resilient[27].close = 103;
  resilient[29].close = 105;

  const marginDates = Array.from({ length: 30 }, (_, index) => date(index));
  const marginMaps = new Map();
  for (const currentDate of marginDates) {
    const map = new Map();
    for (const stock of stocks) {
      map.set(stock.stock_code, {
        margin_change: stock.stock_code === '1103' ? -20 : stock.stock_code === '1120' ? 20 : 0,
        margin_balance: stock.stock_code === '1120' ? 100000 : 1000,
      });
    }
    marginMaps.set(currentDate, map);
  }

  const priceContext = {
    cutoff_date: date(29),
    source_files: marginDates.map(currentDate => `data_fubon/fubon_${currentDate}_sma.json`),
    latest_source_date: date(29),
    by_code: byCode,
  };
  const marginContext = {
    dates: marginDates,
    maps: marginMaps,
    source_files: marginDates.map(currentDate => `data_twse_margin_balance/${currentDate}_twse_margin_balance.csv`),
    failures: [],
  };
  const result = buildRound2EventResearchFromContext({ stocks }, priceContext, marginContext);

  assert.ok(result.signal_count.volume_breakout_confirmation_v1 >= 1);
  assert.ok(result.signal_count.strong_pullback_volume_contraction_v1 >= 1);
  assert.ok(result.signal_count.margin_exit_price_resilience_v1 >= 1);
  assert.ok(result.signal_count.margin_crowding_risk_v1 >= 1);

  const breakoutEvent = result.events.find(item => item.factor_id === 'volume_breakout_confirmation_v1' && item.stock_code === '1101');
  assert.equal(breakoutEvent.signal_date, date(24));
  assert.equal(breakoutEvent.split, 'test');
  assert.ok(breakoutEvent.outcome.forward_return_5d_pct > 0);
  assert.equal(breakoutEvent.outcome.outcome_end_date, date(29));
  assert.equal(result.leakage_guard.signal_features_use_dates_lte_signal_date, true);
  assert.equal(result.leakage_guard.random_split_used, false);
  assert.ok(result.summaries.volume_breakout_confirmation_v1.test.event_count >= 1);
});
