'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  buildMomentumHistory,
  persistMomentumHistory,
  previousHistory,
  loadForwardPriceRows,
  buildMomentumReplay,
  refreshRecentReplays,
} = require('../scripts/momentum_history_replay');

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
}

function stock(code = '2330') {
  return {
    stock_code: code,
    stock_name: '測試股',
    close: 110,
    high: 111,
    low: 100,
    features: {
      r1: 5,
      r3: 8,
      r5: 12,
      rsi14: 65,
      volume_ratio_5d: 2,
      gap_sma20: 3,
    },
    strategy_tag_features: {
      trend_bullish_alignment: true,
      trend_quality_20d: true,
      volume_breakout_confirmation: true,
      market_relative_strength_20d_top20: true,
      industry_relative_strength_20d_top20: true,
      leadership_persistence_7d: true,
      institutional_bullish: true,
      broker_bullish: true,
    },
    atomic_tags: ['momentum_price_volume_sync_v1'],
  };
}

function payload(date, code = '2330') {
  return {
    forecast_date: date,
    base_trade_date: date,
    stocks: [stock(code)],
    strategy_snapshot_metadata: {
      registry_id: 'fixture',
      registry_fingerprint: 'abc123',
    },
  };
}

function writeSma(root, date, close, high = close, low = close, code = '2330') {
  const formatted = `${date.slice(0, 4)}/${date.slice(4, 6)}/${date.slice(6, 8)}`;
  writeJson(path.join(root, 'data_fubon', `fubon_${date}_sma.json`), {
    [code]: {
      [formatted]: { Price: close, High: high, Low: low, Volume: 1000, SMA20: 100, SMA60: 90 },
    },
  });
}

test('history uses the previous stored trading signal date for acceleration', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'momentum-history-'));
  const first = persistMomentumHistory(payload('20260821'), { workspaceRoot: root, generatedAt: '2026-08-21T10:00:00Z' });
  assert.equal(first.history.previous_signal_date, null);
  assert.equal(first.history.stocks[0].momentum_acceleration, null);

  const priorScore = first.history.stocks[0].momentum_score;
  const secondPayload = payload('20260824');
  secondPayload.stocks[0].features.r1 = 7;
  const second = persistMomentumHistory(secondPayload, { workspaceRoot: root, generatedAt: '2026-08-24T10:00:00Z' });
  assert.equal(second.history.previous_signal_date, '20260821');
  assert.equal(second.history.stocks[0].momentum_previous_score, priorScore);
  assert.equal(
    second.history.stocks[0].momentum_acceleration,
    second.history.stocks[0].momentum_score - priorScore,
  );
  assert.equal(previousHistory(root, '20260824').signal_date, '20260821');
});

test('history stores mutually useful component scores without future outcomes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'momentum-history-'));
  const history = buildMomentumHistory(payload('20260824'), { workspaceRoot: root, generatedAt: '2026-08-24T10:00:00Z' });
  const row = history.stocks[0];
  assert.equal(history.signal_date, '20260824');
  assert.equal(history.momentum_model_version, 1);
  assert.ok(row.momentum_score >= 0 && row.momentum_score <= 100);
  assert.deepEqual(Object.keys(row.component_scores), ['price', 'volume', 'trend', 'chip', 'breakout']);
  assert.equal(Object.hasOwn(row, 'outcomes'), false);
});

test('replay horizons follow trading rows and calculate T+1/T+3/T+5 without calendar leakage', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'momentum-replay-'));
  const history = persistMomentumHistory(payload('20260821'), { workspaceRoot: root }).history;
  writeSma(root, '20260821', 100, 101, 99);
  writeSma(root, '20260824', 102, 104, 98);
  writeSma(root, '20260825', 105, 106, 101);
  writeSma(root, '20260826', 108, 110, 104);
  writeSma(root, '20260827', 107, 111, 103);
  writeSma(root, '20260828', 112, 115, 106);

  const context = loadForwardPriceRows(root, history, 12);
  const replay = buildMomentumReplay(history, context, { generatedAt: '2026-08-28T10:00:00Z' });
  const row = replay.stocks[0];
  assert.equal(row.outcomes.t_plus_1.date, '20260824');
  assert.equal(row.outcomes.t_plus_1.return_pct, 2);
  assert.equal(row.outcomes.t_plus_3.date, '20260826');
  assert.equal(row.outcomes.t_plus_3.return_pct, 8);
  assert.equal(row.outcomes.t_plus_5.date, '20260828');
  assert.equal(row.outcomes.t_plus_5.return_pct, 12);
  assert.equal(row.outcomes.t_plus_5.max_gain_pct, 15);
  assert.equal(row.outcomes.t_plus_5.max_drawdown_pct, -2);
  assert.equal(row.reached_plus_10_pct_5d, true);
  assert.equal(replay.completed_horizon, 5);
});

test('incomplete future data remains null instead of being guessed', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'momentum-replay-'));
  const history = persistMomentumHistory(payload('20260824'), { workspaceRoot: root }).history;
  writeSma(root, '20260824', 100, 101, 99);
  writeSma(root, '20260825', 101, 102, 98);
  const context = loadForwardPriceRows(root, history, 12);
  const replay = buildMomentumReplay(history, context);
  assert.ok(replay.stocks[0].outcomes.t_plus_1);
  assert.equal(replay.stocks[0].outcomes.t_plus_3, null);
  assert.equal(replay.stocks[0].outcomes.t_plus_5, null);
  assert.equal(replay.stocks[0].reached_plus_4_pct_5d, null);
});

test('recent replay refresh matures older histories as future prices arrive', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'momentum-replay-'));
  persistMomentumHistory(payload('20260821'), { workspaceRoot: root });
  persistMomentumHistory(payload('20260824'), { workspaceRoot: root });
  for (const [date, close] of [
    ['20260821', 100], ['20260824', 102], ['20260825', 103], ['20260826', 104],
    ['20260827', 105], ['20260828', 106], ['20260831', 107],
  ]) writeSma(root, date, close, close + 1, close - 1);
  const results = refreshRecentReplays(root, { lookbackDates: 10 });
  const older = results.find(item => item.signal_date === '20260821');
  const newer = results.find(item => item.signal_date === '20260824');
  assert.equal(older.completed_horizon, 5);
  assert.equal(newer.completed_horizon, 5);
});
