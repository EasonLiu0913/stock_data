'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  enumeratePeriods,
  conservativeAvailabilityDate,
  standaloneFromYtd,
} = require('../scripts/backfill_mops_quarterly_financial_quality');

test('enumerates quarter ranges inclusively', () => {
  assert.deepEqual(enumeratePeriods('2024Q4', '2025Q2'), ['2024Q4', '2025Q1', '2025Q2']);
});

test('uses conservative period-level availability dates', () => {
  assert.equal(conservativeAvailabilityDate(2024, 1), '2024-05-15');
  assert.equal(conservativeAvailabilityDate(2024, 2), '2024-08-14');
  assert.equal(conservativeAvailabilityDate(2024, 3), '2024-11-14');
  assert.equal(conservativeAvailabilityDate(2024, 4), '2025-03-31');
});

test('Q1 standalone equals YTD', () => {
  const q1 = { stock_code: '2059', fiscal_year: 2024, fiscal_quarter: 1, revenue: 100, gross_profit: 70, operating_income: 60, net_income: 50, parent_net_income: 50, eps: 10 };
  const out = standaloneFromYtd(q1, null);
  assert.equal(out.revenue, 100);
  assert.equal(out.statement_period_basis, 'standalone_quarter');
});

test('Q2 standalone subtracts Q1 YTD', () => {
  const q1 = { stock_code: '2059', fiscal_year: 2024, fiscal_quarter: 1, revenue: 100, gross_profit: 70, operating_income: 60, net_income: 50, parent_net_income: 50, eps: 10 };
  const q2 = { stock_code: '2059', fiscal_year: 2024, fiscal_quarter: 2, revenue: 250, gross_profit: 190, operating_income: 170, net_income: 140, parent_net_income: 140, eps: 28 };
  const out = standaloneFromYtd(q2, q1);
  assert.equal(out.revenue, 150);
  assert.equal(out.gross_profit, 120);
  assert.equal(out.operating_income, 110);
  assert.equal(out.parent_net_income, 90);
  assert.equal(out.eps, 18);
  assert.equal(out.gross_margin_pct, 80);
});
