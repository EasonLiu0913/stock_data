'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  entryForPolicy,
  gapBucket,
  summarizeTrades,
  chooseProductionRecommendation,
} = require('../scripts/summarize_fundamental_quality_execution_revalidation');

test('entryForPolicy separates benchmark and executable timestamps', () => {
  const event = {
    signal_index: 10,
    signal_date: '20260811',
    execution_date: '20260812',
    signal_close: 100,
    next_open: 103,
    next_close: 101,
  };
  assert.deepEqual(entryForPolicy(event, 'signal_close'), {
    entry_index: 10,
    entry_date: '20260811',
    entry_price: 100,
  });
  assert.deepEqual(entryForPolicy(event, 'next_open'), {
    entry_index: 11,
    entry_date: '20260812',
    entry_price: 103,
  });
  assert.deepEqual(entryForPolicy(event, 'next_close'), {
    entry_index: 11,
    entry_date: '20260812',
    entry_price: 101,
  });
});

test('gapBucket uses stable execution gap boundaries', () => {
  assert.equal(gapBucket(-0.1), 'gap_le_0');
  assert.equal(gapBucket(0), 'gap_le_0');
  assert.equal(gapBucket(2), 'gap_0_2');
  assert.equal(gapBucket(5), 'gap_2_5');
  assert.equal(gapBucket(5.01), 'gap_gt_5');
});

test('summarizeTrades reports endpoint, MFE and MAE', () => {
  const trades = [
    { stats: { endpoint_pct: 10, mfe_pct: 15, mae_pct: -3 } },
    { stats: { endpoint_pct: -2, mfe_pct: 4, mae_pct: -8 } },
  ];
  const result = summarizeTrades(trades);
  assert.equal(result.trades, 2);
  assert.equal(result.endpoint.average_pct, 4);
  assert.equal(result.endpoint.median_pct, 4);
  assert.equal(result.endpoint.positive_rate_pct, 50);
  assert.equal(result.mfe.median_pct, 9.5);
  assert.equal(result.mae.median_pct, -5.5);
});

test('production recommendation prefers earliest executable price when not worse', () => {
  const rows = [];
  for (const horizon of ['d5', 'd20', 'd60']) {
    rows.push({ policy_id: 'next_open', horizon, trades: 100, endpoint: { median_pct: 12, positive_rate_pct: 70 } });
    rows.push({ policy_id: 'next_close', horizon, trades: 100, endpoint: { median_pct: 11, positive_rate_pct: 69 } });
  }
  const result = chooseProductionRecommendation(rows);
  assert.equal(result.status, 'recommended');
  assert.equal(result.policy_id, 'next_open');
});

test('production recommendation can prefer next close when evidence is stronger', () => {
  const rows = [];
  for (const horizon of ['d5', 'd20', 'd60']) {
    rows.push({ policy_id: 'next_open', horizon, trades: 100, endpoint: { median_pct: 5, positive_rate_pct: 55 } });
    rows.push({ policy_id: 'next_close', horizon, trades: 100, endpoint: { median_pct: 9, positive_rate_pct: 65 } });
  }
  const result = chooseProductionRecommendation(rows);
  assert.equal(result.status, 'recommended');
  assert.equal(result.policy_id, 'next_close');
});
