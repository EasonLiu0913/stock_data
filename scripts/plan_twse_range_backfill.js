#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  assertRangeCovered,
  buildMatrix,
  compactToSlash,
  loadTwseTradingCalendar,
  normalizeCompactDate,
  parseArgs,
  readJson
} = require('./lib/range_backfill');

const ASSERTION_CODES = ['1101', '1102', '3231'];

function rocDateToCompact(value) {
  const match = String(value || '').match(/(\d+)\D+(\d{1,2})\D+(\d{1,2})/);
  if (!match) return '';
  return `${Number(match[1]) + 1911}${match[2].padStart(2, '0')}${match[3].padStart(2, '0')}`;
}

function validateTwt49u(file, date) {
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) return ['missing or empty file'];
  let payload;
  try { payload = readJson(file); } catch (error) { return [`invalid JSON: ${error.message}`]; }
  const errors = [];
  if (payload?.stat !== 'OK') errors.push(`stat is ${payload?.stat || '(empty)'}`);
  if (!Array.isArray(payload?.fields)) errors.push('fields must be an array');
  if (!Array.isArray(payload?.data)) errors.push('data must be an array');
  if (errors.length) return errors;
  const requiredFields = ['資料日期', '股票代號', '漲停價格', '跌停價格', '開盤競價基準'];
  for (const requiredField of requiredFields) {
    if (!payload.fields.some((field) => String(field).includes(requiredField))) {
      errors.push(`${requiredField} field missing`);
    }
  }
  const dateIndex = payload.fields.findIndex((field) => String(field).includes('資料日期'));
  for (const row of payload.data) {
    if (!Array.isArray(row)) { errors.push('invalid row'); break; }
    if (dateIndex >= 0 && rocDateToCompact(row[dateIndex]) !== date) {
      errors.push(`row date mismatch: ${row[dateIndex]}`);
      break;
    }
  }
  return errors;
}

function validateSmaDaily(file, date, minimumRecords = 100) {
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) return ['missing or empty file'];
  let payload;
  try { payload = readJson(file); } catch (error) { return [`invalid JSON: ${error.message}`]; }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return ['payload must be an object'];
  const entries = Object.entries(payload);
  const errors = [];
  if (entries.length < minimumRecords) errors.push(`stock count too low: ${entries.length}`);
  for (const code of ASSERTION_CODES) if (!payload[code]) errors.push(`reference stock missing: ${code}`);
  const dateKey = compactToSlash(date);
  for (const [code, stock] of entries.slice(0, 100)) {
    const point = stock?.[dateKey];
    if (!point || typeof point !== 'object') {
      errors.push(`${code}: date key ${dateKey} missing`);
      break;
    }
    for (const field of ['Price', 'Open', 'High', 'Low', 'Volume', 'SMA5', 'SMA20']) {
      if (point[field] === null || point[field] === undefined || point[field] === '') {
        errors.push(`${code}: ${field} missing`);
        break;
      }
    }
    if (errors.length >= 10) break;
  }
  return errors;
}

function readStockCodes(csvFile = path.join(ROOT, 'data_twse', 'twse_industry.csv')) {
  const lines = fs.readFileSync(csvFile, 'utf8').trim().split(/\r?\n/);
  return lines.slice(1)
    .map((line) => String(line.split(',')[0] || '').trim())
    .filter(Boolean);
}

function inspectSmaHistory(codes, dates, historyDir = path.join(ROOT, 'data_history_sma')) {
  const coverage = Object.fromEntries(dates.map((date) => [date, 0]));
  const missingIndexes = [];
  for (const [index, code] of codes.entries()) {
    const file = path.join(historyDir, `${code}.json`);
    const history = readJson(file, {});
    let completeForRange = true;
    for (const date of dates) {
      const point = history?.[compactToSlash(date)];
      if (point && ['price', 'open', 'high', 'low', 'volume', 'sma5', 'sma20']
        .every((field) => point[field] !== null && point[field] !== undefined && point[field] !== '')) {
        coverage[date] += 1;
      } else completeForRange = false;
    }
    if (!completeForRange) missingIndexes.push(index);
  }
  return { coverage, missingIndexes };
}

function stockBatchMatrix(codes, missingIndexes, batchSize, startDate, endDate) {
  const ranges = [];
  for (let start = 0; start < codes.length; start += batchSize) {
    const end = Math.min(start + batchSize, codes.length);
    if (!missingIndexes.some((index) => index >= start && index < end)) continue;
    ranges.push({ start, end });
  }
  return {
    include: ranges.map((range, index) => ({
      batch_index: index + 1,
      batch_count: ranges.length,
      start_index: range.start,
      limit: range.end - range.start,
      first_stock_code: codes[range.start],
      last_stock_code: codes[range.end - 1],
      first_date: startDate,
      last_date: endDate,
      has_next: index < ranges.length - 1
    }))
  };
}

function buildPlan(options) {
  const dataset = options.dataset;
  const start = normalizeCompactDate(options.start, 'start date');
  const end = normalizeCompactDate(options.end, 'end date');
  const calendar = options.calendar || loadTwseTradingCalendar(options.calendarFile);
  assertRangeCovered(start, end, calendar);
  const dates = calendar.dates.filter((date) => date >= start && date <= end);
  const force = Boolean(options.force);
  const invalid = [];
  const valid = [];

  if (dataset === 'twt49u') {
    for (const date of dates) {
      const file = path.join(options.outputDir || path.join(ROOT, 'data_twse_twt49u'), `${date}_twt49u.json`);
      const errors = force ? ['forced'] : validateTwt49u(file, date);
      if (errors.length) invalid.push({ date, errors }); else valid.push(date);
    }
    const pendingDates = invalid.map((item) => item.date);
    return {
      dataset,
      start,
      end,
      calendar_first_date: calendar.firstDate,
      calendar_last_date: calendar.lastDate,
      trading_date_count: dates.length,
      valid_date_count: valid.length,
      pending_date_count: pendingDates.length,
      pending_dates: pendingDates,
      invalid,
      matrix: buildMatrix(pendingDates, options.batchSize || 10)
    };
  }

  if (dataset !== 'sma') throw new Error(`Unsupported TWSE dataset: ${dataset}`);
  const minimumRecords = Number(options.minimumRecords || 100);
  for (const date of dates) {
    const file = path.join(options.outputDir || path.join(ROOT, 'data_fubon'), `fubon_${date}_sma.json`);
    const errors = force ? ['forced'] : validateSmaDaily(file, date, minimumRecords);
    if (errors.length) invalid.push({ date, errors }); else valid.push(date);
  }
  const pendingDates = invalid.map((item) => item.date);
  const codes = options.codes || readStockCodes(options.csvFile);
  const history = inspectSmaHistory(codes, pendingDates, options.historyDir);
  const reconstructableDates = pendingDates.filter((date) => history.coverage[date] >= minimumRecords);
  const datesNeedingCrawl = pendingDates.filter((date) => history.coverage[date] < minimumRecords);
  const missingIndexes = datesNeedingCrawl.length ? history.missingIndexes : [];
  const matrix = stockBatchMatrix(codes, missingIndexes, options.stockBatchSize || 100, start, end);
  return {
    dataset,
    start,
    end,
    calendar_first_date: calendar.firstDate,
    calendar_last_date: calendar.lastDate,
    trading_date_count: dates.length,
    valid_date_count: valid.length,
    pending_date_count: pendingDates.length,
    pending_dates: pendingDates,
    invalid,
    historical_coverage: history.coverage,
    reconstructable_dates: reconstructableDates,
    dates_needing_crawl: datesNeedingCrawl,
    rebuild_only: pendingDates.length > 0 && datesNeedingCrawl.length === 0,
    stock_count: codes.length,
    stock_batch_count: matrix.include.length,
    matrix
  };
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const dataset = String(args.get('dataset') || '');
  const start = args.get('start');
  const end = args.get('end');
  if (!dataset || !start || !end) throw new Error('--dataset, --start, and --end are required');
  const plan = buildPlan({
    dataset,
    start,
    end,
    batchSize: Number(args.get('batch-size') || 10),
    stockBatchSize: Number(args.get('stock-batch-size') || 100),
    minimumRecords: Number(args.get('minimum-records') || 100),
    force: args.has('force'),
    calendarFile: args.get('calendar-file'),
    outputDir: args.get('output-dir') ? path.resolve(args.get('output-dir')) : undefined,
    historyDir: args.get('history-dir') ? path.resolve(args.get('history-dir')) : undefined,
    csvFile: args.get('csv-file') ? path.resolve(args.get('csv-file')) : undefined
  });
  process.stdout.write(`${JSON.stringify(plan)}\n`);
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(`Failed to plan TWSE range backfill: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildPlan,
  inspectSmaHistory,
  readStockCodes,
  rocDateToCompact,
  validateSmaDaily,
  validateTwt49u
};
