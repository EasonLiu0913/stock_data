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

test('normalizes broker branch details and concentration metrics', () => {
  const source = {
    unit: '張',
    stocks: {
      1101: {
        stockCode: '1101',
        stockName: '台泥',
        totals: { netBuy: 24, netSell: 11, net: 13 },
        buyBrokers: [
          { rank: 1, brokerName: '甲', brokerId: 'A', branchId: '01', netBuy: 10, sharePercent: 10 },
          { rank: 2, brokerName: '乙', brokerId: 'B', branchId: '02', netBuy: 8, sharePercent: 8 },
          { rank: 3, brokerName: '丙', brokerId: 'C', branchId: '03', netBuy: 6, sharePercent: 6 }
        ],
        sellBrokers: [
          { rank: 1, brokerName: '丁', brokerId: 'D', branchId: '04', netSell: 7, sharePercent: 7 },
          { rank: 2, brokerName: '戊', brokerId: 'E', branchId: '05', netSell: 4, sharePercent: 4 }
        ]
      }
    }
  };
  const normalized = normalizeBrokerSource(source)['1101'];
  assert.equal(normalized.net, 13000);
  assert.equal(normalized.buy_branch_count, 3);
  assert.equal(normalized.sell_branch_count, 2);
  assert.deepEqual(normalized.top_buy_branches[0], {
    rank: 1,
    branch_key: 'A:01',
    broker_name: '甲',
    broker_id: 'A',
    branch_id: '01',
    net_shares: 10000,
    share_percent: 10
  });
  assert.equal(normalized.top_sell_branches[0].net_shares, -7000);
  assert.equal(normalized.concentration.ranked_buy_net_shares, 24000);
  assert.equal(normalized.concentration.top3_buy_net_shares, 24000);
  assert.equal(normalized.concentration.top3_buy_concentration_pct, 100);
  assert.equal(normalized.concentration.top3_sell_concentration_pct, 100);
});

test('uses ranked branch sum when reported totals are smaller than displayed branches', () => {
  const normalized = normalizeBrokerSource({
    unit: '張',
    stocks: {
      '006204': {
        stockCode: '006204',
        stockName: '測試ETF',
        totals: { netBuy: 10, netSell: 3, net: 7 },
        buyBrokers: [
          { rank: 1, brokerId: 'A', branchId: '01', netBuy: 8, sharePercent: 8 },
          { rank: 2, brokerId: 'B', branchId: '02', netBuy: 7, sharePercent: 7 }
        ],
        sellBrokers: [{ rank: 1, brokerId: 'C', branchId: '03', netSell: 3, sharePercent: 3 }]
      }
    }
  })['006204'];
  assert.equal(normalized.concentration.ranked_buy_net_shares, 15000);
  assert.equal(normalized.concentration.source_reported_buy_net_shares, 10000);
  assert.equal(normalized.concentration.source_buy_difference_shares, -5000);
  assert.equal(normalized.concentration.top3_buy_concentration_pct, 100);
});

test('deduplicates repeated broker branch identities', () => {
  const source = {
    unit: '張',
    stocks: {
      1101: {
        stockCode: '1101',
        stockName: '台泥',
        totals: { netBuy: 15, netSell: 4, net: 11 },
        buyBrokers: [
          { rank: 1, brokerId: 'A', branchId: '01', netBuy: 10, sharePercent: 5 },
          { rank: 2, brokerId: 'A', branchId: '01', netBuy: 5, sharePercent: 2.5 },
          { rank: 3, brokerId: 'B', branchId: '02', netBuy: 0, sharePercent: 0 }
        ],
        sellBrokers: [{ rank: 1, brokerId: 'C', branchId: '03', netSell: 4, sharePercent: 2 }]
      }
    }
  };
  const normalized = normalizeBrokerSource(source)['1101'];
  assert.equal(normalized.buy_branch_count, 1);
  assert.equal(normalized.top_buy_branches.length, 1);
  assert.equal(normalized.top_buy_branches[0].net_shares, 15000);
  assert.equal(normalized.top_buy_branches[0].share_percent, 7.5);
});

test('rejects old broker schema without branch details', () => {
  const payload = {
    schemaVersion: 3,
    date: '20260729',
    stocks: {
      1101: {
        stock_code: '1101',
        net: 1000,
        buy_branch_count: 1,
        sell_branch_count: 1,
        normalized_unit: '股'
      }
    }
  };
  const errors = validateNormalized('broker', payload, '20260729', { minimumRecords: 1 });
  assert.ok(errors.some(error => error.includes('schemaVersion must be 4')));
  assert.ok(errors.some(error => error.includes('top_buy_branches')));
  assert.ok(errors.some(error => error.includes('concentration')));
});

test('accepts valid broker schema v4', () => {
  const stock = normalizeBrokerSource({
    unit: '張',
    stocks: {
      1101: {
        stockCode: '1101',
        stockName: '台泥',
        totals: { netBuy: 10, netSell: 3, net: 7 },
        buyBrokers: [{ rank: 1, brokerName: '甲', brokerId: 'A', branchId: '01', netBuy: 10, sharePercent: 10 }],
        sellBrokers: [{ rank: 1, brokerName: '乙', brokerId: 'B', branchId: '02', netSell: 3, sharePercent: 3 }]
      }
    }
  })['1101'];
  const payload = {
    schemaVersion: 4,
    date: '20260729',
    stocks: {
      1101: stock,
      1102: { ...stock, stock_code: '1102' },
      3231: { ...stock, stock_code: '3231' }
    }
  };
  assert.deepEqual(validateNormalized('broker', payload, '20260729', { minimumRecords: 1 }), []);
});

test('parses date range and type options', () => {
  const options = parseArgs(['--type', 'institutional', '--from=20260101', '--to', '20260131', '--dry-run']);
  assert.deepEqual([...options.types], ['institutional']);
  assert.equal(options.from, '20260101');
  assert.equal(options.to, '20260131');
  assert.equal(options.dryRun, true);
});
