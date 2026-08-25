'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getTradingDayStatus } = require('../scripts/lib/twse_trading_day');

test('TWSE trading-day guard rejects weekends', () => {
  const status = getTradingDayStatus('20260822');
  assert.equal(status.isTradingDay, false);
  assert.equal(status.reason, 'WEEKEND');
});

test('TWSE trading-day guard rejects official 2026 market holidays', () => {
  const status = getTradingDayStatus('20260925');
  assert.equal(status.isTradingDay, false);
  assert.equal(status.reason, 'MARKET_HOLIDAY');
  assert.equal(status.calendarCovered, true);
});

test('TWSE trading-day guard accepts ordinary covered weekdays', () => {
  const status = getTradingDayStatus('20260824');
  assert.equal(status.isTradingDay, true);
  assert.equal(status.reason, 'TRADING_DAY');
  assert.equal(status.calendarCovered, true);
});

test('TWSE trading-day guard fails open for uncovered calendar years', () => {
  const status = getTradingDayStatus('20270823');
  assert.equal(status.isTradingDay, true);
  assert.equal(status.reason, 'CALENDAR_YEAR_UNCOVERED');
  assert.equal(status.calendarCovered, false);
  assert.match(status.warning, /尚未覆蓋 2027 年/);
});
