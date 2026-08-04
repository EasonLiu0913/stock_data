#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT_DIR = path.join(ROOT_DIR, 'data_fubon_broker_details');
const TRADING_CALENDAR_FILE = path.join(ROOT_DIR, 'data_twse_market_chart', 'market_chart.json');
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

function normalizeCalendarDate(value) {
  const match = String(value || '').match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function loadTradingCalendar(file = TRADING_CALENDAR_FILE) {
  if (!fs.existsSync(file)) throw new Error(`交易日曆不存在：${path.relative(ROOT_DIR, file)}`);
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  const dates = [...new Set((payload?.data || [])
    .map(item => normalizeCalendarDate(item?.date))
    .filter(Boolean))].sort();
  if (!dates.length) throw new Error(`交易日曆沒有有效日期：${path.relative(ROOT_DIR, file)}`);
  return {
    dates: new Set(dates),
    firstDate: dates[0],
    lastDate: dates.at(-1)
  };
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
      && successCount > 0
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

function buildPlan({
  start,
  end,
  batchSize = DEFAULT_BATCH_SIZE,
  force = false,
  outputDir = DEFAULT_OUTPUT_DIR,
  tradingCalendar = loadTradingCalendar()
}) {
  const normalizedStart = normalizeDate(start);
  const normalizedEnd = normalizeDate(end);
  if (normalizedStart < tradingCalendar.firstDate || normalizedEnd > tradingCalendar.lastDate) {
    throw new Error(
      `要求區間 ${normalizedStart}～${normalizedEnd} 超出交易日曆範圍 `
      + `${tradingCalendar.firstDate}～${tradingCalendar.lastDate}；請先更新 TWSE Market Chart`
    );
  }
  const requestedDates = dateRange(normalizedStart, normalizedEnd);
  const tradingDates = requestedDates.filter(date => tradingCalendar.dates.has(date));
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
    non_trading_date_count: requestedDates.length - tradingDates.length,
    skipped_complete_date_count: tradingDates.length - pendingDates.length,
    pending_date_count: pendingDates.length,
    batch_size: batchSize,
    calendar_first_date: tradingCalendar.firstDate,
    calendar_last_date: tradingCalendar.lastDate,
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
    tradingCalendarFile: path.resolve(getArg(argv, '--trading-calendar-file') || TRADING_CALENDAR_FILE)
  };
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const plan = buildPlan({
    ...options,
    tradingCalendar: loadTradingCalendar(options.tradingCalendarFile)
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
  loadTradingCalendar,
  normalizeDate
};
