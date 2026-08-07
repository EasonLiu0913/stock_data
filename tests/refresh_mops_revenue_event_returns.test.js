'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { eventMonthNeedsRefresh, hasUsableLiveTiming } = require('../scripts/refresh_mops_revenue_event_returns');

const liveSource = {
  companies: [
    { stock_code: '2330', first_seen_at: '2026-08-07T18:00:00+08:00' },
  ],
};

const backfillSource = {
  companies: [
    { stock_code: '2330', first_seen_at: '2026-08-07T18:00:00+08:00' },
  ],
};

test('live reporting-window month is eligible for auto refresh', () => {
  assert.equal(hasUsableLiveTiming('202607', liveSource), true);
  assert.equal(eventMonthNeedsRefresh('202607', null, liveSource), true);
});

test('historical backfill month is excluded from auto refresh', () => {
  assert.equal(hasUsableLiveTiming('202606', backfillSource), false);
  assert.equal(eventMonthNeedsRefresh('202606', null, backfillSource), false);
});

test('pending live event keeps month active', () => {
  const existing = {
    counts: { total: 1 },
    events: [{
      event_timing_status: 'observed_during_reporting_window',
      evaluation_status: 'pending_next_trading_day',
      returns: {},
    }],
  };
  assert.equal(eventMonthNeedsRefresh('202607', existing, liveSource), true);
});

test('fully completed D20 month no longer refreshes', () => {
  const returns = Object.fromEntries([1, 3, 5, 10, 20].map(day => [`d${day}`, { status: 'complete' }]));
  const existing = {
    counts: { total: 1 },
    events: [{
      event_timing_status: 'observed_during_reporting_window',
      evaluation_status: 'eligible',
      returns,
    }],
  };
  assert.equal(eventMonthNeedsRefresh('202607', existing, liveSource), false);
});
