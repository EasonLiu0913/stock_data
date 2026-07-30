'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeInstitutionalSource,
  normalizeBrokerSource,
  validateNormalized,
  parseArgs
} = require('../scripts/backfill_normalized_data');

test('normalizes TWSE institutional rows by field name', () => {
  const source = {
    fields: [
      '證券代號',
      '證券名稱',
      '外陸資買賣超股數(不含外資自營商)',
      '外資自營商買賣超股數',
      '投信買賣超股數',
      '自營商買賣超股數',
      '三大法人買賣超股數'
    ],
    data: [['1101', '台泥', '1,000', '200', '-300', '50', '950']]
  };
  assert.deepEqual(normalizeInstitutionalSource(source), {
    1101: {
      stock_code: '1101',
      stock_name: '台泥',
      foreign: 1200,
      trust: -300,
      dealer: 50,
      total: 950
    }
  });
});

test('derives institutional total only when all component values are numeric', () => {
  const source = {
    fields: [
      '證券代號',
      '證券名稱',
      '外陸資買賣超股數(不含外資自營商)',
      '外資自營商買賣超股數',
      '投信買賣超股數',
      '自營商買賣超股數',
      '三大法人買賣超股數'
    ],
    data: [
      ['041528', '測試一', '1,000', '-200', '300', '-50', '--'],
      ['041529', '測試二', '1,000', '-200', '', '-50', '--']
    ]
  };
  const stocks = normalizeInstitutionalSource(source);
  assert.deepEqual(stocks['041528'], {
    stock_code: '041528',
    stock_name: '測試一',
    foreign: 800,
    trust: 300,
    dealer: -50,
    total: 1050,
    total_derived: true
  });
  assert.equal(stocks['041529'].total, null);
  assert.equal(stocks['041529'].total_derived, undefined);
});

test('normalizes broker lots to shares and counts unique positive branches', () => {
  const source = {
    unit: '張',
    stocks: {
      1101: {
        stockCode: '1101',
        stockName: '台泥',
        totals: { net: '12.5' },
        buyBrokers: [
          { brokerId: 'A', branchId: '01', netBuy: 10 },
          { brokerId: 'A', branchId: '01', netBuy: 5 },
          { brokerId: 'B', branchId: '02', netBuy: 0 }
        ],
        sellBrokers: [{ brokerId: 'C', branchId: '03', netSell: 4 }]
      }
    }
  };
  assert.deepEqual(normalizeBrokerSource(source), {
    1101: {
      stock_code: '1101',
      stock_name: '台泥',
      net: 12500,
      buy_branch_count: 1,
      sell_branch_count: 1,
      source_unit: '張',
      normalized_unit: '股'
    }
  });
});

test('rejects old broker schema without branch counts', () => {
  const payload = {
    schemaVersion: 1,
    date: '20260729',
    stocks: {
      1101: { stock_code: '1101', net: 1000, normalized_unit: '股' }
    }
  };
  const errors = validateNormalized('broker', payload, '20260729', { minimumRecords: 1 });
  assert.ok(errors.some(error => error.includes('schemaVersion must be 2')));
  assert.ok(errors.some(error => error.includes('buy_branch_count')));
});

test('parses date range and type options', () => {
  const options = parseArgs(['--type', 'institutional', '--from=20260101', '--to', '20260131', '--dry-run']);
  assert.deepEqual([...options.types], ['institutional']);
  assert.equal(options.from, '20260101');
  assert.equal(options.to, '20260131');
  assert.equal(options.dryRun, true);
});
