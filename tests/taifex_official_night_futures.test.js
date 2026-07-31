'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseFrontMonthTxFromHtml,
  signedNumber,
} = require('../scripts/taifex_official_night_futures');

const OFFICIAL_EXCERPT = `
<html><body>
日期： 2026/07/31
臺股期貨 ( TX ) 行情表
2026/07/30 15:00~次日05:00 盤後交易時段行情表
契約 到期月份 開盤價 最高價 最低價 最後成交價 漲跌價 漲跌% 成交量
TX 202608 40035 41874 39866 41859 ▲1573 ▲3.90% 49738 - -
TX 202609 40192 42024 40036 42000 ▲1551 ▲3.83% 380 - -
</body></html>`;

test('TAIFEX specified-date page parses the traded front-month TX after-hours row', () => {
  const result = parseFrontMonthTxFromHtml(OFFICIAL_EXCERPT, '20260731');
  assert.equal(result.available, true);
  assert.equal(result.selected_contract_month, '202608');
  assert.equal(result.change_percent, 3.9);
  assert.equal(result.change, 1573);
  assert.equal(result.volume, 49738);
  assert.equal(result.session_start_date, '20260730');
  assert.equal(result.trading_session, '盤後交易時段');
});

test('TAIFEX specified-date page rejects a stale target date', () => {
  const result = parseFrontMonthTxFromHtml(OFFICIAL_EXCERPT, '20260803');
  assert.equal(result.available, false);
  assert.equal(result.change_percent, null);
  assert.match(result.warning, /未包含目標日期/);
});

test('TAIFEX down arrows normalize values to negative numbers', () => {
  assert.equal(signedNumber('▼', '123'), -123);
  assert.equal(signedNumber('▲', '3.25'), 3.25);
});
