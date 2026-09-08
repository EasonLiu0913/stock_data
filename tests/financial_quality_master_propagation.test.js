'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyStock } = require('../scripts/verify_financial_quality_master_propagation');

const timeline = {
  rows: [
    {
      fiscal_period: '2026Q1',
      conservative_known_date: '2026-05-15',
      financial_quality_score: 12,
    },
    {
      fiscal_period: '2026Q2',
      conservative_known_date: '2026-08-14',
      financial_quality_score: 11,
    },
  ],
};

test('master propagation accepts matching refreshed timeline rows', () => {
  const masterStock = {
    stock_id: '8021',
    rows: timeline.rows.map(row => ({ ...row })),
  };
  assert.doesNotThrow(() => verifyStock(masterStock, timeline, '8021'));
});

test('master propagation fails when a refreshed quarter is missing', () => {
  const masterStock = { stock_id: '8021', rows: [timeline.rows[0]] };
  assert.throws(
    () => verifyStock(masterStock, timeline, '8021'),
    /Master missing 8021 2026Q2/,
  );
});

test('master propagation fails when known date is stale', () => {
  const masterStock = {
    stock_id: '8021',
    rows: timeline.rows.map(row => ({ ...row })),
  };
  masterStock.rows[1].conservative_known_date = '2026-08-15';
  assert.throws(
    () => verifyStock(masterStock, timeline, '8021'),
    /Master known-date mismatch/,
  );
});

test('master propagation fails when refreshed score is stale', () => {
  const masterStock = {
    stock_id: '8021',
    rows: timeline.rows.map(row => ({ ...row })),
  };
  masterStock.rows[1].financial_quality_score = 10;
  assert.throws(
    () => verifyStock(masterStock, timeline, '8021'),
    /Master score mismatch/,
  );
});


test('master propagation may explicitly skip durable unsupported financial models', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const sourceRoot = path.join(__dirname, '..', 'data_finmind_quarterly_financial_quality');
  const stockId = '__test_unsupported__';
  const dir = path.join(sourceRoot, stockId);
  fs.mkdirSync(dir, { recursive: true });
  try {
    fs.writeFileSync(path.join(dir, 'coverage-status.json'), JSON.stringify({ status: 'unsupported_financial_model' }));
    const { verifyMasterPropagation } = require('../scripts/verify_financial_quality_master_propagation');
    assert.deepEqual(verifyMasterPropagation([stockId], { stocks: [] }, { allowUnsupported: true }), { verified_stocks: 0, skipped_unsupported: 1 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
