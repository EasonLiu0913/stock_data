'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseNumber,
  normalizeFiscalYear,
  normalizeQuarter,
  safeDivide,
  normalizeRow,
  assertSnapshot,
} = require('../scripts/crawl_twse_quarterly_financial_quality');

test('parses TWSE financial numbers safely', () => {
  assert.equal(parseNumber('1,234,567'), 1234567);
  assert.equal(parseNumber('-12.5'), -12.5);
  assert.equal(parseNumber('--'), null);
});

test('normalizes ROC fiscal year and quarter', () => {
  assert.equal(normalizeFiscalYear('115'), 2026);
  assert.equal(normalizeFiscalYear('2026'), 2026);
  assert.equal(normalizeQuarter('第2季'), 2);
  assert.equal(normalizeQuarter('Q3'), 3);
});

test('computes margins from statement amounts without estimates', () => {
  const row = normalizeRow({
    公司代號: '2059',
    公司名稱: '川湖',
    年度: '115',
    季別: '2',
    營業收入: '10,000',
    '營業毛利（毛損）': '7,500',
    '營業利益（損失）': '6,500',
    '本期淨利（淨損）': '5,000',
    '淨利（淨損）歸屬於母公司業主': '4,800',
    '基本每股盈餘（元）': '12.34',
  });
  assert.equal(row.stock_code, '2059');
  assert.equal(row.fiscal_year, 2026);
  assert.equal(row.fiscal_quarter, 2);
  assert.equal(row.gross_margin_pct, 75);
  assert.equal(row.operating_margin_pct, 65);
  assert.equal(row.net_margin_pct, 48);
  assert.equal(row.eps, 12.34);
});

test('rejects suspiciously small or mixed-period snapshots', () => {
  assert.throws(() => assertSnapshot([]), /Unexpected TWSE income-statement row count/);
  const rows = Array.from({ length: 101 }, (_, i) => ({
    stock_code: String(1000 + i), revenue: 1, fiscal_year: 2026, fiscal_quarter: i === 100 ? 1 : 2,
  }));
  assert.throws(() => assertSnapshot(rows), /Mixed fiscal periods/);
});

test('safeDivide rejects zero denominator', () => {
  assert.equal(safeDivide(10, 0), null);
});
