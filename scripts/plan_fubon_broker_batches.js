#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT_DIR = path.join(ROOT_DIR, 'data_fubon_broker_details');
const NON_TRADING_DAYS_FILE = path.join(ROOT_DIR, 'data_history_sma', 'non_trading_days.json');
const DEFAULT_BATCH_SIZE = 5;

function getArg(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
}

function normalizeDate(value) {
  if (!value) return '';
  const match = String(value).match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})$/);
  if (!match) throw new Error(`日期格式錯誤：${value}`);
  const isoDate = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== isoDate) {
    throw new Error(`日期不存在：${value}`);
  }
  return isoDate;
}

function dateRange(start, end) {
  const first = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  if (first > last) throw new Error(`起日 ${start} 晚於迄日 ${end}`);
  const dates = [];
  for (const cursor = new Date(first); cursor <= last; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
}

function isWeekend(isoDate) {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function loadNonTradingDays(file = NON_TRADING_DAYS_FILE) {
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  return new Set(Object.values(payload).flat().map(value => String(value).replaceAll('/', '-')));
}

function outputPath(outputDir, isoDate) {
  return path.join(outputDir, `fubon_${isoDate.replaceAll('-', '')}_券商分點進出明細.json`);
}

function isCompleteOutput(filePath) {
  if (!fs.existsSync(filePath)) return false;
  try {
    const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const successCount = Object.keys(payload?.stocks || {}).length;
    const unavailableCount = Array.isArray(payload?.unavailableStocks) ? payload.unavailableStocks.length : 0;
    return payload?.complete === true
      && Number(payload?.failedStockCount || 0) === 0
      && (!Array.isArray(payload?.failedStocks) || payload.failedStocks.length === 0)
      && Number(payload?.successfulStockCount) === successCount
      && Number(payload?.unavailableStockCount) === unavailableCount
      && Number(payload?.stockUniverse?.expectedStockCount) === successCount + unavailableCount;
  } catch {
    return false;
  }
}

function chunk(items, size) {
  const batches = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function buildPlan({ start, end, batchSize = DEFAULT_BATCH_SIZE, force = false, outputDir = DEFAULT_OUTPUT_DIR, nonTradingDays }) {
  const requestedDates = dateRange(normalizeDate(start), normalizeDate(end));
  const tradingDates = requestedDates.filter(date => !isWeekend(date) && !nonTradingDays.has(date));
  const pendingDates = force
    ? tradingDates
    : tradingDates.filter(date => !isCompleteOutput(outputPath(outputDir, date)));
  const rawBatches = chunk(pendingDates, batchSize);
  const include = rawBatches.map((dates, index) => ({
    batch_index: index + 1,
    batch_count: rawBatches.length,
    dates: dates.join(','),
    first_date: dates[0],
    last_date: dates.at(-1),
    has_next: index < rawBatches.length - 1
  }));
  return {
    requested_date_count: requestedDates.length,
    trading_date_count: tradingDates.length,
    skipped_complete_date_count: tradingDates.length - pendingDates.length,
    pending_date_count: pendingDates.length,
    batch_size: batchSize,
    matrix: { include }
  };
}

function parseArgs(argv) {
  const start = getArg(argv, '--start');
  const end = getArg(argv, '--end');
  if (!start || !end) throw new Error('--start 與 --end 都必須提供');
  const batchSize = Number(getArg(argv, '--batch-size') || DEFAULT_BATCH_SIZE);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 20) {
    throw new Error('--batch-size 必須是 1 到 20 的整數');
  }
  return {
    start,
    end,
    batchSize,
    force: argv.includes('--force'),
    outputDir: path.resolve(getArg(argv, '--output-dir') || DEFAULT_OUTPUT_DIR),
    nonTradingDaysFile: path.resolve(getArg(argv, '--non-trading-days-file') || NON_TRADING_DAYS_FILE)
  };
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const plan = buildPlan({
    ...options,
    nonTradingDays: loadNonTradingDays(options.nonTradingDaysFile)
  });
  process.stdout.write(`${JSON.stringify(plan)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`❌ ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_BATCH_SIZE,
  buildPlan,
  chunk,
  isCompleteOutput,
  normalizeDate
};
