'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  verifyOutcome,
  labelStats,
  buildVerifiedStockProfile,
  finalizeResearchResult,
} = require('../scripts/oversold_rebound_outcome_verification');

function event(outcome) {
  return {
    stock_code: '2330',
    stock_name: '測試股',
    signal: { price_volume: { return_5d: -12, drawdown_20d: -18, rsi14: 20 } },
    outcome_from_signal: outcome,
    outcome_from_deepest_signal: outcome,
    data_availability: {},
  };
}

test('incomplete future horizon is unverified instead of a false miss', () => {
  const outcome = verifyOutcome({
    future_return_1d: 3,
    future_return_3d: null,
    future_return_5d: null,
    future_return_10d: null,
    max_return_3d: 8,
    max_return_5d: 12,
  });
  assert.equal(outcome.labels.close_rebound_1d_5pct, false);
  assert.equal(outcome.labels.close_rebound_3d_5pct, null);
  assert.equal(outcome.labels.intraday_rebound_3d_5pct, null);
  assert.equal(outcome.labels.intraday_rebound_5d_10pct, null);
  assert.deepEqual(outcome.verification.completed_horizons, [1]);
});

test('label statistics use only verified events as denominator', () => {
  const events = [
    event(verifyOutcome({ future_return_5d: 11, max_return_5d: 12 })),
    event(verifyOutcome({ future_return_5d: -2, max_return_5d: 4 })),
    event(verifyOutcome({ future_return_5d: null, max_return_5d: 15 })),
  ];
  const stats = labelStats(events, 'intraday_rebound_5d_10pct');
  assert.deepEqual(stats, { hits: 1, verified: 2, misses: 1, unverified: 1, hit_rate: 50 });
});

test('stock profile separates verified failures from unfinished observations', () => {
  const events = [
    event(verifyOutcome({ future_return_3d: 6, future_return_5d: 12, max_return_5d: 13 })),
    event(verifyOutcome({ future_return_3d: -1, future_return_5d: -3, max_return_5d: 2 })),
    event(verifyOutcome({ future_return_3d: null, future_return_5d: null, max_return_5d: 20 })),
  ];
  const profile = buildVerifiedStockProfile('2330', '測試股', events);
  assert.equal(profile.successful_rebound_count, 1);
  assert.equal(profile.non_success_count, 1);
  assert.equal(profile.verified_outcome_count, 2);
  assert.equal(profile.unverified_outcome_count, 1);
  assert.equal(profile.rebound_rate_5d_intraday_10pct, 50);
});

test('finalizer recalculates summary with hit, verified and unverified counts', () => {
  const rawOutcome = {
    future_return_1d: 2,
    future_return_3d: null,
    future_return_5d: null,
    future_return_10d: null,
    max_return_3d: 9,
    max_return_5d: 11,
    labels: {
      close_rebound_3d_5pct: false,
      intraday_rebound_5d_10pct: true,
    },
  };
  const result = finalizeResearchResult({
    stockResults: [{
      stock_code: '2330',
      stock_name: '測試股',
      events: [event(rawOutcome)],
      profile: {},
    }],
    summary: { schema_version: 1, generated_at: '2026-08-01T00:00:00.000Z', notes: [] },
    manifest: {},
  });
  assert.equal(result.summary.schema_version, 2);
  assert.equal(result.summary.primary_outcome.verified, 0);
  assert.equal(result.summary.primary_outcome.unverified, 1);
  assert.equal(result.stockResults[0].events[0].outcome_from_signal.labels.intraday_rebound_5d_10pct, null);
});
