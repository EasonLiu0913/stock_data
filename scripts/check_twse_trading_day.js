'use strict';

const fs = require('node:fs');
const { getTradingDayStatus } = require('./lib/twse_trading_day');

const args = process.argv.slice(2);
const dateIndex = args.indexOf('--date');
const date = dateIndex >= 0 ? args[dateIndex + 1] : null;

try {
  if (!date) throw new Error('缺少 --date YYYYMMDD');
  const status = getTradingDayStatus(date);
  console.log(JSON.stringify(status, null, 2));
  if (status.warning) console.warn(`⚠️ ${status.warning}`);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `is_trading_day=${status.isTradingDay ? 'true' : 'false'}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `reason=${status.reason}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `calendar_covered=${status.calendarCovered ? 'true' : 'false'}\n`);
  }
} catch (error) {
  console.error(`TWSE trading-day check failed: ${error.message}`);
  process.exitCode = 1;
}
