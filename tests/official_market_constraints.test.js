'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  rocDateToCompact,
  parseDispositionPeriod,
  normalizeTwseDispositionRows,
  normalizeTpexDispositionRows,
  buildDispositionSnapshot,
  selectTaifexNightFuture,
} = require('../scripts/official_market_constraints');

test('ROC dates and disposition periods normalize to Gregorian compact dates', () => {
  assert.equal(rocDateToCompact('115/07/31'), '20260731');
  assert.equal(rocDateToCompact('1150731'), '20260731');
  assert.equal(rocDateToCompact('2026-07-31'), '20260731');
  assert.deepEqual(parseDispositionPeriod('115/07/31～115/08/13'), {
    start: '20260731', end: '20260813', raw: '115/07/31～115/08/13',
  });
  assert.deepEqual(parseDispositionPeriod('1150710~1150723'), {
    start: '20260710', end: '20260723', raw: '1150710~1150723',
  });
});

test('TWSE rows normalize and identify 20-minute second disposition', () => {
  const rows = normalizeTwseDispositionRows([{
    Number: '1',
    Date: '1150730',
    Code: '2492',
    Name: '華新科',
    NumberOfAnnouncement: '1',
    ReasonsOfDisposition: '連續三次',
    DispositionPeriod: '115/07/31～115/08/13',
    DispositionMeasures: '第二次處置',
    Detail: '約每二十分鐘撮合一次',
  }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].market, 'TWSE');
  assert.equal(rows[0].period_start, '20260731');
  assert.equal(rows[0].period_end, '20260813');
  assert.equal(rows[0].board_type, '20分鐘撮合');
});

test('TPEX rows support official OpenAPI aliases and active-date filtering', () => {
  const rows = normalizeTpexDispositionRows([{
    DateOfAnnouncement: '1150730',
    SecuritiesCompanyCode: '6443',
    CompanyName: '元晶',
    DispositionPeriod: '1150731~1150813',
    DisposalCondition: '連續三次且第二次處置',
    DisposalMeasure: '每二十分鐘撮合一次',
  }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].code, '6443');
  assert.equal(rows[0].period_start, '20260731');
  assert.equal(rows[0].period_end, '20260813');
  assert.equal(rows[0].board_type, '20分鐘撮合');
});

test('disposition coverage is complete only when both TWSE and TPEX succeed', () => {
  const twse = [{
    Date: '1150730', Code: '2492', Name: '華新科',
    DispositionPeriod: '115/07/31～115/08/13',
    DispositionMeasures: '第二次處置', Detail: '約每二十分鐘撮合一次',
  }];
  const tpex = [{
    DateOfAnnouncement: '1150730', SecuritiesCompanyCode: '6443', CompanyName: '元晶',
    DispositionPeriod: '1150731~1150813', DisposalMeasure: '每二十分鐘撮合一次',
  }];
  const complete = buildDispositionSnapshot({
    date: '20260731', twseRows: twse, tpexRows: tpex,
    sourceStatus: { twse: { ok: true }, tpex: { ok: true } },
  });
  assert.equal(complete.complete_market_coverage, true);
  assert.deepEqual(complete.active_stock_codes, ['2492', '6443']);

  const partial = buildDispositionSnapshot({
    date: '20260731', twseRows: twse, tpexRows: [],
    sourceStatus: { twse: { ok: true }, tpex: { ok: false } },
  });
  assert.equal(partial.complete_market_coverage, false);
  assert.match(partial.warnings.join(' '), /不能宣稱已完成全市場處置股排除/);
});

test('night futures selects target-date TX after-hours front month with volume', () => {
  const rows = [
    {
      Date: '20260731', Contract: 'TX', 'ContractMonth(Week)': '202608',
      TradingSession: '盤後交易時段', Open: '44000', High: '44500', Low: '43800', Last: '44400',
      Change: '880', ChangePercent: '2.02%', Volume: '50,000',
    },
    {
      Date: '20260731', Contract: 'TX', 'ContractMonth(Week)': '202609',
      TradingSession: '盤後交易時段', Last: '44500', Change: '850', ChangePercent: '1.95%', Volume: '500',
    },
    {
      Date: '20260731', Contract: 'TX', 'ContractMonth(Week)': '202608',
      TradingSession: '一般交易時段', Last: '43520', Change: '-100', ChangePercent: '-0.23%', Volume: '80,000',
    },
  ];
  const result = selectTaifexNightFuture(rows, '20260731');
  assert.equal(result.available, true);
  assert.equal(result.selected_contract_month, '202608');
  assert.equal(result.change_percent, 2.02);
  assert.equal(result.trading_session, '盤後交易時段');
});

test('night futures never silently falls back to the regular session', () => {
  const result = selectTaifexNightFuture([{
    Date: '20260731', Contract: 'TX', 'ContractMonth(Week)': '202608',
    TradingSession: '一般交易時段', Last: '44000', Change: '800', ChangePercent: '1.85%', Volume: '90000',
  }], '20260731');
  assert.equal(result.available, false);
  assert.equal(result.change_percent, null);
  assert.deepEqual(result.observed_session_values, ['一般交易時段']);
});
