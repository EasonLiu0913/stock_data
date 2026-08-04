#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { validateCsv } = require('./crawl_twse_margin_balance');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_CALENDAR_FILE = path.join(ROOT, 'data_twse_market_chart', 'market_chart.json');

const SOURCE_SPECS = Object.freeze({
  mi_index: {
    directory: 'data_twse_mi_index',
    filename: date => `${date}_twse_mi_index.json`,
    isComplete(file, expectedDate) {
      try {
        const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (payload?.stat !== 'OK' || String(payload?.date || '') !== expectedDate) return false;
        if (!Array.isArray(payload?.tables) || payload.tables.length === 0) return false;
        return payload.tables.some(table => Array.isArray(table?.data) && table.data.length > 0);
      } catch {
        return false;
      }
    },
  },
  margin: {
    directory: 'data_twse_margin_balance',
    filename: date => `${date}_twse_margin_balance.csv`,
    isComplete(file) {
      try {
        return validateCsv(fs.readFileSync(file, 'utf8')) > 0;
      } catch {
        return false;
      }
    },
  },
});

function getArg(argv, flag, fallback = null) {
  const index = argv.indexOf(flag);
  return index >= 0 && argv[index + 1] !== undefined ? argv[index + 1] : fallback;
}

function hasFlag(argv, flag) {
  return argv.includes(flag);
}

function getPositiveInteger(argv, flag, fallback) {
  const value = Number(getArg(argv, flag, fallback));
  if (!Number.isInteger(value) || value < 1) throw new Error(`${flag} must be a positive integer`);
  return value;
}

function normalizeDate(value, label) {
  if (!value) return null;
  const compact = String(value).replace(/[^\d]/g, '');
  if (!/^20\d{6}$/.test(compact)) throw new Error(`${label} has invalid date: ${value}`);
  return compact;
}

function parseSources(value) {
  const requested = String(value || 'mi_index,margin')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  const unique = [...new Set(requested)];
  for (const source of unique) {
    if (!SOURCE_SPECS[source]) throw new Error(`Unknown source: ${source}`);
  }
  return unique;
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
  if (!dates.length) throw new Error(`Trading calendar has no valid dates: ${calendarFile}`);
  return dates;
}

function resolveRange(tradingDates, from, to) {
  const firstAvailable = tradingDates[0];
  const lastAvailable = tradingDates[tradingDates.length - 1];
  const resolvedFrom = from || firstAvailable;
  const resolvedTo = to || lastAvailable;

  if (resolvedFrom > resolvedTo) throw new Error(`Start date ${resolvedFrom} is after end date ${resolvedTo}`);
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

function sourceDateComplete(root, source, date) {
  const spec = SOURCE_SPECS[source];
  const file = path.join(root, spec.directory, spec.filename(date));
  return fs.existsSync(file) && spec.isComplete(file, date);
}

function buildBatches(source, dates, batchSize) {
  if (!Number.isInteger(batchSize) || batchSize < 1) throw new Error('batchSize must be a positive integer');
  const chunks = [];
  for (let index = 0; index < dates.length; index += batchSize) {
    chunks.push(dates.slice(index, index + batchSize));
  }
  return chunks.map((batchDates, index) => ({
    source,
    batch_index: index + 1,
    batch_count: chunks.length,
    dates: batchDates.join(','),
    date_count: batchDates.length,
    first_date: batchDates[0],
    last_date: batchDates[batchDates.length - 1],
    has_next: index < chunks.length - 1,
  }));
}

function planSource(root, source, options = {}) {
  const calendarFile = path.resolve(options.calendarFile || DEFAULT_CALENDAR_FILE);
  const tradingDates = options.tradingDates || loadTradingDates(calendarFile);
  const range = resolveRange(tradingDates, options.from || null, options.to || null);
  const force = Boolean(options.force);
  const batchSize = options.batchSize || options.maxDates || 10;
  const completeDates = range.dates.filter(date => sourceDateComplete(root, source, date));
  const missingDates = force
    ? [...range.dates]
    : range.dates.filter(date => !sourceDateComplete(root, source, date));
  const batches = buildBatches(source, missingDates, batchSize);

  return {
    source,
    directory: SOURCE_SPECS[source].directory,
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

function buildPlan(options = {}) {
  const root = path.resolve(options.root || ROOT);
  const calendarFile = path.resolve(options.calendarFile || DEFAULT_CALENDAR_FILE);
  const tradingDates = loadTradingDates(calendarFile);
  const sources = options.sources || Object.keys(SOURCE_SPECS);
  const plans = Object.fromEntries(sources.map(source => [source, planSource(root, source, {
    ...options,
    calendarFile,
    tradingDates,
  })]));

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    priority: 'trading_date_asc',
    calendar_file: path.relative(root, calendarFile).replaceAll(path.sep, '/'),
    sources: plans,
  };
}

function main(argv = process.argv.slice(2)) {
  const plan = buildPlan({
    root: ROOT,
    calendarFile: getArg(argv, '--calendar-file', DEFAULT_CALENDAR_FILE),
    sources: parseSources(getArg(argv, '--sources', 'mi_index,margin')),
    maxDates: getPositiveInteger(argv, '--max-dates', 10),
    from: normalizeDate(getArg(argv, '--from'), '--from'),
    to: normalizeDate(getArg(argv, '--to'), '--to'),
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
  SOURCE_SPECS,
  parseSources,
  loadTradingDates,
  resolveRange,
  sourceDateComplete,
  buildBatches,
  planSource,
  buildPlan,
};
