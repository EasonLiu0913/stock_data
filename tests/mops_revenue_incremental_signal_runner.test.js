'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  runIncrementalRange,
} = require('../scripts/run_mops_revenue_monthly_signal_incremental');
const {
  hasPendingMarketData,
  marketWindowFingerprint,
  stableRevenueResearchInput,
} = require('../scripts/generate_mops_revenue_monthly_signal_returns');

function silentLogger() {
  return { log() {} };
}

test('stable revenue research input excludes volatile collection metadata', () => {
  const base = {
    schema_version: 2,
    revenue_month: '202511',
    collection: {
      last_collected_at: '2026-08-07T10:00:00+08:00',
      status_calculated_at: '2026-08-07T10:01:00+08:00',
      snapshot_count: 1,
    },
    companies: [{
      stock_code: '2330',
      stock_name: '台積電',
      industry: '半導體業',
      mom_pct: 2,
      yoy_pct: 30,
      ytd_yoy_pct: 25,
      derived: {
        previous_month_yoy_pct: 20,
        yoy_acceleration_pct_points: 10,
        yoy_accelerating: true,
        yoy_and_mom_positive: true,
      },
    }],
  };
  const changedMetadata = JSON.parse(JSON.stringify(base));
  changedMetadata.collection.last_collected_at = '2026-08-07T23:00:00+08:00';
  changedMetadata.collection.status_calculated_at = '2026-08-07T23:01:00+08:00';
  changedMetadata.collection.snapshot_count = 99;

  assert.deepEqual(stableRevenueResearchInput(base), stableRevenueResearchInput(changedMetadata));
});

test('market window fingerprint ignores later appended market rows beyond D20 window', () => {
  const rows = [];
  for (let day = 1; day <= 31; day += 1) {
    rows.push({ date: `202512${String(day).padStart(2, '0')}`, close: 100 + day });
  }
  for (let day = 1; day <= 10; day += 1) {
    rows.push({ date: `202601${String(day).padStart(2, '0')}`, close: 140 + day });
  }

  const base = marketWindowFingerprint(rows, '202511');
  const appended = marketWindowFingerprint([
    ...rows,
    { date: '20260202', close: 160 },
    { date: '20260203', close: 161 },
  ], '202511');
  assert.equal(base, appended);
});

test('historical missing stock price does not keep a mature month perpetually invalid', () => {
  const payload = {
    events: [{
      returns: {
        d1: { status: 'complete' },
        d3: { status: 'complete' },
        d5: { status: 'complete' },
        d10: { status: 'missing_stock_price' },
        d20: { status: 'complete' },
      },
    }],
  };
  assert.equal(hasPendingMarketData(payload), false);
});

test('pending market horizon keeps a month non-reusable until the market window matures', () => {
  const payload = {
    events: [{
      returns: {
        d1: { status: 'complete' },
        d3: { status: 'complete' },
        d5: { status: 'complete' },
        d10: { status: 'complete' },
        d20: { status: 'pending_market_data' },
      },
    }],
  };
  assert.equal(hasPendingMarketData(payload), true);
});

test('incremental runner reuses unchanged details and generates invalidated details', () => {
  const generated = [];
  const summary = runIncrementalRange({
    startMonth: '202511',
    endMonth: '202512',
    logger: silentLogger(),
    inspectMonth(month) {
      return month === '202511'
        ? { reusable: true, reason: 'unchanged_mature_detail' }
        : { reusable: false, reason: 'missing_input_fingerprint' };
    },
    generate(month) {
      generated.push(month);
      return { output: `${month}.json`, counts: { total: 10 } };
    },
  });

  assert.deepEqual(generated, ['202512']);
  assert.equal(summary.total, 2);
  assert.equal(summary.reused, 1);
  assert.equal(summary.generated, 1);
  assert.equal(summary.items[0].action, 'reused');
  assert.equal(summary.items[1].action, 'generated');
});

test('force full rebuild generates every month without consulting reuse', () => {
  const generated = [];
  let inspectCalls = 0;
  const summary = runIncrementalRange({
    startMonth: '202511',
    endMonth: '202601',
    forceFullRebuild: true,
    logger: silentLogger(),
    inspectMonth() {
      inspectCalls += 1;
      return { reusable: true, reason: 'unchanged_mature_detail' };
    },
    generate(month) {
      generated.push(month);
      return { output: `${month}.json`, counts: {} };
    },
  });

  assert.equal(inspectCalls, 0);
  assert.deepEqual(generated, ['202511', '202512', '202601']);
  assert.equal(summary.generated, 3);
  assert.equal(summary.reused, 0);
});
