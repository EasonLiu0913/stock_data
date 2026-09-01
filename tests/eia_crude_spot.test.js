'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SERIES,
  PUBLICATION_POLICY,
  compactDate,
  calendarDayDiff,
  buildSourceFreshness,
  changeFrom,
  buildBenchmark,
} = require('../scripts/crawl_eia_crude_spot');

test('canonical crude spot series are WTI Cushing and Brent Europe', () => {
  assert.equal(SERIES.wti_spot.id, 'PET.RWTC.D');
  assert.equal(SERIES.brent_spot.id, 'PET.RBRTE.D');
  assert.equal(PUBLICATION_POLICY.cadence, 'weekly_wednesday_us_eastern');
});

test('compactDate accepts common date separators', () => {
  assert.equal(compactDate('2026-08-31'), '20260831');
  assert.equal(compactDate('2026/08/31'), '20260831');
});

test('calendarDayDiff measures source publication lag in calendar days', () => {
  assert.equal(calendarDayDiff('20260825', '20260901'), 7);
  assert.equal(calendarDayDiff('20260825', '20260903'), 9);
});

test('source freshness treats one-week EIA lag as expected and warns after the weekly window', () => {
  const benchmarks = [
    { id: 'wti_spot', latest_date: '20260825' },
    { id: 'brent_spot', latest_date: '20260825' },
  ];
  const normal = buildSourceFreshness('20260901', benchmarks);
  assert.equal(normal.overall_status, 'expected_weekly_publication_lag');
  assert.equal(normal.benchmarks[0].lag_calendar_days, 7);
  assert.equal(normal.benchmarks[0].status, 'expected_weekly_publication_lag');

  const stale = buildSourceFreshness('20260903', benchmarks);
  assert.equal(stale.overall_status, 'stale_warning');
  assert.equal(stale.benchmarks[0].lag_calendar_days, 9);
  assert.equal(stale.benchmarks[0].status, 'stale_warning');
});

test('changeFrom computes trading-observation changes', () => {
  const rows = [
    { date: '20260824', price: 70 },
    { date: '20260825', price: 72 },
    { date: '20260826', price: 71 },
    { date: '20260827', price: 73 },
    { date: '20260828', price: 74 },
    { date: '20260831', price: 76 },
  ];
  assert.deepEqual(changeFrom(rows, 1), { change: 2, change_pct: 2.7027 });
  assert.deepEqual(changeFrom(rows, 5), { change: 6, change_pct: 8.5714 });
});

test('buildBenchmark preserves each spot series own latest observation date', () => {
  const rows = [
    { date: '20260827', iso_date: '2026-08-27', price: 80 },
    { date: '20260828', iso_date: '2026-08-28', price: 81 },
    { date: '20260831', iso_date: '2026-08-31', price: 82 },
  ];
  const result = buildBenchmark('wti_spot', rows);
  assert.equal(result.id, 'wti_spot');
  assert.equal(result.eia_series_id, 'PET.RWTC.D');
  assert.equal(result.instrument_type, 'spot');
  assert.equal(result.latest_date, '20260831');
  assert.equal(result.latest_price, 82);
});