'use strict';

const { spawnSync } = require('node:child_process');
const { getTradingDayStatus } = require('./lib/twse_trading_day');

function parseArgs(argv) {
  const separator = argv.indexOf('--');
  const options = separator === -1 ? argv : argv.slice(0, separator);
  const command = separator === -1 ? [] : argv.slice(separator + 1);
  const dateIndex = options.indexOf('--date');
  const date = dateIndex >= 0 ? options[dateIndex + 1] : null;
  return { date, command };
}

function main() {
  const { date, command } = parseArgs(process.argv.slice(2));
  if (!date) throw new Error('缺少 --date YYYYMMDD');
  if (!command.length) throw new Error('缺少 -- 後的執行命令');

  const status = getTradingDayStatus(date);
  console.log(`[TWSE_TRADING_DAY] ${JSON.stringify(status)}`);

  if (!status.isTradingDay) {
    console.log(`📅 ${date} 為非交易日（${status.reason}），跳過：${command.join(' ')}`);
    return;
  }

  if (status.warning) console.warn(`⚠️ ${status.warning}`);

  const child = spawnSync(command[0], command.slice(1), {
    stdio: 'inherit',
    shell: false,
  });
  if (child.error) throw child.error;
  if (typeof child.status === 'number' && child.status !== 0) process.exitCode = child.status;
  if (child.signal) throw new Error(`子程序被訊號終止: ${child.signal}`);
}

try {
  main();
} catch (error) {
  console.error(`TWSE trading-day wrapper failed: ${error.message}`);
  process.exitCode = 1;
}
