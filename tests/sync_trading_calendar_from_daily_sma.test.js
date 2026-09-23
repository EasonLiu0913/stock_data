'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { syncTradingCalendar } = require('../scripts/sync_trading_calendar_from_daily_sma');

function mkDaily(file, date, count = 120) {
  const slash = `${date.slice(0,4)}/${date.slice(4,6)}/${date.slice(6,8)}`;
  const payload = {};
  for (let i = 0; i < count; i++) {
    const code = String(1000 + i);
    payload[code] = { StockName: code, [slash]: { Price: '10.00', SMA5: '10.00' } };
  }
  fs.writeFileSync(file, JSON.stringify(payload));
}

test('validated durable weekday SMA checkpoint extends canonical trading calendar', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'calendar-sync-'));
  const fubon = path.join(dir, 'data_fubon');
  const hist = path.join(dir, 'data_history_sma');
  fs.mkdirSync(fubon); fs.mkdirSync(hist);
  fs.writeFileSync(path.join(hist,'trading_days.json'), JSON.stringify({2026:['2026/09/21']},null,2)+'\n');
  fs.writeFileSync(path.join(hist,'non_trading_days.json'), JSON.stringify({2026:['2026/09/25']},null,2)+'\n');
  mkDaily(path.join(fubon,'fubon_20260923_sma.json'),'20260923');
  const r = syncTradingCalendar({
    fubonDir:fubon,
    tradingFile:path.join(hist,'trading_days.json'),
    nonTradingFile:path.join(hist,'non_trading_days.json'),
    start:'20260923',end:'20260923'
  });
  assert.equal(r.changed,true);
  assert.equal(r.latestTradingDate,'2026/09/23');
  assert.equal(r.accepted.length,1);
});

test('declared holiday is never promoted even if a file exists', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'calendar-sync-'));
  const fubon = path.join(dir, 'data_fubon');
  const hist = path.join(dir, 'data_history_sma');
  fs.mkdirSync(fubon); fs.mkdirSync(hist);
  fs.writeFileSync(path.join(hist,'trading_days.json'), JSON.stringify({2026:[]},null,2)+'\n');
  fs.writeFileSync(path.join(hist,'non_trading_days.json'), JSON.stringify({2026:['2026/09/25']},null,2)+'\n');
  mkDaily(path.join(fubon,'fubon_20260925_sma.json'),'20260925');
  const r = syncTradingCalendar({
    fubonDir:fubon,
    tradingFile:path.join(hist,'trading_days.json'),
    nonTradingFile:path.join(hist,'non_trading_days.json')
  });
  assert.equal(r.accepted.length,0);
  assert.equal(r.rejected[0].reason,'declared_non_trading_day');
});

test('weekend is never promoted', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'calendar-sync-'));
  const fubon = path.join(dir, 'data_fubon');
  const hist = path.join(dir, 'data_history_sma');
  fs.mkdirSync(fubon); fs.mkdirSync(hist);
  fs.writeFileSync(path.join(hist,'trading_days.json'), JSON.stringify({2026:[]},null,2)+'\n');
  fs.writeFileSync(path.join(hist,'non_trading_days.json'), JSON.stringify({2026:[]},null,2)+'\n');
  mkDaily(path.join(fubon,'fubon_20260926_sma.json'),'20260926');
  const r = syncTradingCalendar({
    fubonDir:fubon,
    tradingFile:path.join(hist,'trading_days.json'),
    nonTradingFile:path.join(hist,'non_trading_days.json')
  });
  assert.equal(r.accepted.length,0);
  assert.equal(r.rejected[0].reason,'weekend');
});

test('insufficient checkpoint rows fail closed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'calendar-sync-'));
  const fubon = path.join(dir, 'data_fubon');
  const hist = path.join(dir, 'data_history_sma');
  fs.mkdirSync(fubon); fs.mkdirSync(hist);
  fs.writeFileSync(path.join(hist,'trading_days.json'), JSON.stringify({2026:[]},null,2)+'\n');
  fs.writeFileSync(path.join(hist,'non_trading_days.json'), JSON.stringify({2026:[]},null,2)+'\n');
  mkDaily(path.join(fubon,'fubon_20260923_sma.json'),'20260923',10);
  const r = syncTradingCalendar({
    fubonDir:fubon,
    tradingFile:path.join(hist,'trading_days.json'),
    nonTradingFile:path.join(hist,'non_trading_days.json')
  });
  assert.equal(r.accepted.length,0);
  assert.equal(r.rejected[0].reason,'insufficient_valid_sma_rows');
});
