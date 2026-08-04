#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_CALENDAR_FILE = path.join(ROOT, 'data_twse_market_chart', 'market_chart.json');
const OUTPUT_DIR = 'data_twse_institutional_investors';

function getArg(argv, flag, fallback = null) {
  const index = argv.indexOf(flag);
  return index >= 0 && argv[index + 1] !== undefined ? argv[index + 1] : fallback;
}

function hasFlag(argv, flag) {
  return argv.includes(flag);
}

function getPositiveInteger(argv, flag, fallback) {
  const value = Number(getArg(argv, flag, fallback));
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return value;
}

function normalizeDate(value, label) {
  if (!value) return null;
  const compact = String(value).replace(/[^\d]/g, '');
  if (!/^20\d{6}$/.test(compact)) {
    throw new Error(`${label} has invalid date: ${value}`);
  }
  return compact;
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function loadTradingDates(calendarFile = DEFAULT_CALENDAR_FILE) {
  const payload = readJson(calendarFile, null);
  const dates = [...new Set((Array.isArray(payload?.data) ? payload.data : [])
    .map(row => String(row?.date || ''))
    .filter(date => /^20\d{6}$/.test(date)))]
    .sort();

  if (!dates.length) {
    throw new Error(`Trading calendar has no valid dates: ${calendarFile}`);
  }
  return dates;
}

function resolveRange(tradingDates, from, to) {
  const firstAvailable = tradingDates[0];
  const lastAvailable = tradingDates[tradingDates.length - 1];
  const resolvedFrom = from || firstAvailable;
  const resolvedTo = to || lastAvailable;

  if (resolvedFrom > resolvedTo) {
    throw new Error(`Start date ${resolvedFrom} is after end date ${resolvedTo}`);
  }
  if (resolvedFrom < firstAvailable || resolvedTo > lastAvailable) {
    throw new Error(
      `Requested range ${resolvedFrom}-${resolvedTo} exceeds trading calendar coverage `
      + `${firstAvailable}-${lastAvailable}. Build TWSE Market Chart for the wider range first.`,
    );
  }

  const dates = tradingDates.filter(date => date >= resolvedFrom && date <= resolvedTo);
  if (!dates.length) throw new Error(`No trading dates found in ${resolvedFrom}-${resolvedTo}`);
  return { from: resolvedFrom, to: resolvedTo, dates, firstAvailable, lastAvailable };
}

function outputPath(root, date) {
  return path.join(root, OUTPUT_DIR, `${date}_twse_institutional_investors.json`);
}

function isCompletePayload(payload, expectedDate) {
  if (!payload || typeof payload !== 'object') return false;
  if (String(payload.date || '') !== expectedDate) return false;
  if (!Array.isArray(payload.fields) || payload.fields.length === 0) return false;
  if (!Array.isArray(payload.data) || payload.data.length === 0) return false;
  return true;
}

function sourceDateComplete(root, date) {
  const file = outputPath(root, date);
  if (!fs.existsSync(file)) return false;
  return isCompletePayload(readJson(file, null), date);
}

function buildBatches(dates, batchSize) {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error('batchSize must be a positive integer');
  }

  const chunks = [];
  for (let index = 0; index < dates.length; index += batchSize) {
    chunks.push(dates.slice(index, index + batchSize));
  }

  return chunks.map((batchDates, index) => ({
    batch_index: index + 1,
    batch_count: chunks.length,
    dates: batchDates.join(','),
    date_count: batchDates.length,
    first_date: batchDates[0],
    last_date: batchDates[batchDates.length - 1],
    has_next: index < chunks.length - 1,
  }));
}

function buildPlan(options = {}) {
  const root = path.resolve(options.root || ROOT);
  const calendarFile = path.resolve(options.calendarFile || DEFAULT_CALENDAR_FILE);
  const tradingDates = options.tradingDates || loadTradingDates(calendarFile);
  const range = resolveRange(tradingDates, options.from || null, options.to || null);
  const force = Boolean(options.force);
  const batchSize = options.batchSize || options.maxDates || 10;
  const completeDates = range.dates.filter(date => sourceDateComplete(root, date));
  const missingDates = force
    ? [...range.dates]
    : range.dates.filter(date => !sourceDateComplete(root, date));
  const batches = buildBatches(missingDates, batchSize);

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    source: 'institutional_investors',
    directory: OUTPUT_DIR,
    priority: 'trading_date_asc',
    calendar_file: path.relative(root, calendarFile).replaceAll(path.sep, '/'),
    calendar_first_date: range.firstAvailable,
    calendar_last_date: range.lastAvailable,
    from: range.from,
    to: range.to,
    force,
    batch_size: batchSize,
    required_date_count: range.dates.length,
    complete_date_count: completeDates.length,
    missing_date_count: missingDates.length,
    missing_dates: missingDates,
    batch_count: batches.length,
    batches,
    matrix: { include: batches },
    estimated_date_coverage_pct: range.dates.length
      ? Math.round((completeDates.length / range.dates.length) * 10000) / 100
      : 0,
  };
}

function main(argv = process.argv.slice(2)) {
  const singleDate = normalizeDate(getArg(argv, '--date'), '--date');
  const plan = buildPlan({
    root: ROOT,
    calendarFile: getArg(argv, '--calendar-file', DEFAULT_CALENDAR_FILE),
    maxDates: getPositiveInteger(argv, '--max-dates', 10),
    from: singleDate || normalizeDate(getArg(argv, '--from'), '--from'),
    to: singleDate || normalizeDate(getArg(argv, '--to'), '--to'),
    force: hasFlag(argv, '--force'),
  });
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}

module.exports = {
  OUTPUT_DIR,
  normalizeDate,
  loadTradingDates,
  resolveRange,
  isCompletePayload,
  sourceDateComplete,
  buildBatches,
  buildPlan,
};
