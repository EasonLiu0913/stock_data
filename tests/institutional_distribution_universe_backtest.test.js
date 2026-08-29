'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { forwardReturn, buildEvents, summarizeReturns, edge } = require('../scripts/backtest_institutional_distribution_universe');

test('buildEvents emits threshold entries and red escalations without counting every orange week', () => {
  const timeline = [
    { observed_date: '2026-01-01', raw_level: 'yellow', score: 3, level: 'yellow' },
    { observed_date: '2026-01-08', raw_level: 'orange', score: 5, level: 'orange' },
    { observed_date: '2026-01-15', raw_level: 'orange', score: 6, level: 'orange' },
    { observed_date: '2026-01-22', raw_level: 'red', score: 8, level: 'red' },
    { observed_date: '2026-01-29', raw_level: 'yellow', score: 4, level: 'red' },
    { observed_date: '2026-02-05', raw_level: 'orange', score: 5, level: 'red' },
  ];
  const events = buildEvents(timeline);
  assert.deepEqual(events.map((x) => [x.observed_date, x.event_type]), [
    ['2026-01-08', 'orange_entry'],
    ['2026-01-22', 'red_escalation'],
    ['2026-02-05', 'orange_entry'],
  ]);
});

test('forwardReturn uses trading-session index rather than calendar days', () => {
  const prices = [
    { date: '2026-01-02', price: 100 },
    { date: '2026-01-05', price: 98 },
    { date: '2026-01-06', price: 95 },
    { date: '2026-01-07', price: 90 },
  ];
  assert.equal(forwardReturn(prices, '2026-01-02', 2), -5);
  assert.equal(forwardReturn(prices, '2026-01-05', 3), null);
});

test('bearish edge is favorable when signal returns are more negative than baseline', () => {
  const signal = { horizons: { '5d': summarizeReturns([{ r: -8 }, { r: -2 }], 'r'), '10d': summarizeReturns([], 'r'), '20d': summarizeReturns([], 'r') } };
  const baseline = { horizons: { '5d': summarizeReturns([{ r: 2 }, { r: -2 }], 'r'), '10d': summarizeReturns([], 'r'), '20d': summarizeReturns([], 'r') } };
  const e = edge(signal, baseline);
  assert.equal(e['5d'].mean_return_edge_pp, -5);
  assert.equal(e['5d'].negative_rate_edge, 0.5);
});
