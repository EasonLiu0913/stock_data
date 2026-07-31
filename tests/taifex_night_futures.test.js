'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeTaifexFuturesRows,
  selectTaifexNightFuture,
} = require('../scripts/taifex_night_futures');

test('TAIFEX official single-character percent field is parsed', () => {
  const [row] = normalizeTaifexFuturesRows([{
    Date: '20260731',
    Contract: 'TX',
    'ContractMonth(Week)': '202608',
    Last: '24400',
    Change: '480',
    '%': '2.01%',
    Volume: '50,000',
    TradingSession: '盤後交易時段',
  }]);
  assert.equal(row.change_percent, 2.01);
});

test('real TAIFEX field shape selects TX after-hours front month', () => {
  const result = selectTaifexNightFuture([
    {
      Date: '20260731', Contract: 'TX', 'ContractMonth(Week)': '202608',
      Open: '24000', High: '24500', Low: '23900', Last: '24400', Change: '480',
      '%': '2.01%', Volume: '50,000', SettlementPrice: '-', TradingSession: '盤後交易時段',
    },
    {
      Date: '20260731', Contract: 'TX', 'ContractMonth(Week)': '202609',
      Last: '24450', Change: '470', '%': '1.96%', Volume: '800', TradingSession: '盤後交易時段',
    },
  ], '20260731');
  assert.equal(result.available, true);
  assert.equal(result.selected_contract_month, '202608');
  assert.equal(result.change_percent, 2.01);
});
