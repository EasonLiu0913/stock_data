#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  addDaysCompact,
  buildMatrix,
  compactToIso,
  finiteNumber,
  normalizeCompactDate,
  parseArgs,
  readJson,
  writeJsonAtomic
} = require('./lib/range_backfill');

const SYMBOL = '^VIX';
const NAME = 'CBOE Volatility Index';
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'data_vix');
const FILE_NAME = 'vix.json';

function unixSeconds(compact) {
  return Math.floor(new Date(`${compactToIso(compact)}T00:00:00Z`).getTime() / 1000);
}

function buildYahooUrl(start, end, symbol = SYMBOL) {
  const period1 = unixSeconds(addDaysCompact(start, -7));
  const period2 = unixSeconds(addDaysCompact(end, 2));
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=history&includeAdjustedClose=true`;
}

async function fetchJson(url, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'application/json, text/plain, */*',
        'user-agent': 'Mozilla/5.0 (compatible; stock-data-vix-crawler/1.0)'
      }
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

function round(value, digits = 4) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function parseRows(payload) {
  const result = payload?.chart?.result?.[0];
  if (!result) throw new Error(payload?.chart?.error?.description || 'Yahoo chart result missing');
  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const adjusted = result.indicators?.adjclose?.[0]?.adjclose || [];
  const rows = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const close = finiteNumber(quote.close?.[index] ?? adjusted[index]);
    if (close === null) continue;
    rows.push({
      date: new Date(timestamps[index] * 1000).toISOString().slice(0, 10).replaceAll('-', ''),
      open: round(finiteNumber(quote.open?.[index])),
      high: round(finiteNumber(quote.high?.[index])),
      low: round(finiteNumber(quote.low?.[index])),
      close: round(close),
      adjusted_close: round(finiteNumber(adjusted[index])),
      volume: finiteNumber(quote.volume?.[index])
    });
  }
  return rows.sort((left, right) => left.date.localeCompare(right.date));
}

function buildDailyPayload(rows, index) {
  const row = rows[index];
  const previous = rows[index - 1] || null;
  const change = previous ? row.close - previous.close : null;
  const changePercent = previous && previous.close !== 0 ? (row.close / previous.close - 1) * 100 : null;
  return {
    schemaVersion: 1,
    generated_at: new Date().toISOString(),
    date: row.date,
    requested_date: row.date,
    market_date: row.date,
    symbol: SYMBOL,
    name: NAME,
    source: 'yahoo_finance_chart',
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    adjusted_close: row.adjusted_close,
    volume: row.volume,
    previous_market_date: previous?.date || null,
    previous_close: previous?.close ?? null,
    change: round(change),
    change_percent: round(changePercent)
  };
}

function validateStored(file, date) {
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) return ['missing or empty file'];
  let payload;
  try { payload = readJson(file); } catch (error) { return [`invalid JSON: ${error.message}`]; }
  const errors = [];
  if (payload?.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (String(payload?.date || '') !== date) errors.push(`date is ${payload?.date}`);
  if (payload?.symbol !== SYMBOL) errors.push(`symbol is ${payload?.symbol}`);
  for (const field of ['open', 'high', 'low', 'close']) {
    if (!Number.isFinite(Number(payload?.[field]))) errors.push(`${field} invalid`);
  }
  return errors;
}

function refreshIndexes(outputDir = DEFAULT_OUTPUT_DIR) {
  fs.mkdirSync(outputDir, { recursive: true });
  const dates = fs.readdirSync(outputDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^20\d{6}$/.test(entry.name))
    .filter((entry) => validateStored(path.join(outputDir, entry.name, FILE_NAME), entry.name).length === 0)
    .map((entry) => entry.name)
    .sort();
  writeJsonAtomic(path.join(outputDir, 'files.json'), dates.map((date) => `${date}/${FILE_NAME}`));
  writeJsonAtomic(path.join(outputDir, 'manifest.json'), {
    schemaVersion: 1,
    generated_at: new Date().toISOString(),
    symbol: SYMBOL,
    source: 'yahoo_finance_chart',
    latest_date: dates.at(-1) || null,
    latest_file: dates.length ? `data_vix/${dates.at(-1)}/${FILE_NAME}` : null,
    available_dates: dates
  });
  return dates;
}

function buildPlan({ rows, start, end, batchSize = 10, outputDir = DEFAULT_OUTPUT_DIR, force = false }) {
  const normalizedStart = normalizeCompactDate(start, 'start date');
  const normalizedEnd = normalizeCompactDate(end, 'end date');
  const available = rows.filter((row) => row.date >= normalizedStart && row.date <= normalizedEnd);
  if (!available.length) throw new Error(`No VIX market rows for ${normalizedStart}~${normalizedEnd}`);
  const invalid = [];
  const valid = [];
  for (const row of available) {
    const errors = force ? ['forced'] : validateStored(path.join(outputDir, row.date, FILE_NAME), row.date);
    if (errors.length) invalid.push({ date: row.date, errors }); else valid.push(row.date);
  }
  const pendingDates = invalid.map((item) => item.date);
  return {
    dataset: 'vix',
    start: normalizedStart,
    end: normalizedEnd,
    available_date_count: available.length,
    valid_date_count: valid.length,
    pending_date_count: pendingDates.length,
    pending_dates: pendingDates,
    invalid,
    matrix: buildMatrix(pendingDates, batchSize)
  };
}

function writeDates({ rows, dates, outputDir = DEFAULT_OUTPUT_DIR, force = false }) {
  const indexByDate = new Map(rows.map((row, index) => [row.date, index]));
  const results = [];
  for (const rawDate of dates) {
    const date = normalizeCompactDate(rawDate);
    const index = indexByDate.get(date);
    if (index === undefined) throw new Error(`No exact VIX market row for ${date}`);
    const file = path.join(outputDir, date, FILE_NAME);
    const existingErrors = validateStored(file, date);
    if (!force && existingErrors.length === 0) {
      results.push({ date, status: 'skipped', file });
      continue;
    }
    const existed = fs.existsSync(file);
    writeJsonAtomic(file, buildDailyPayload(rows, index));
    const errors = validateStored(file, date);
    if (errors.length) throw new Error(`Stored VIX ${date} invalid: ${errors.join('; ')}`);
    results.push({ date, status: existed ? 'updated' : 'created', file });
  }
  refreshIndexes(outputDir);
  return results;
}

function previousWeekday(compact) {
  let date = addDaysCompact(compact, -1);
  while ([0, 6].includes(new Date(`${compactToIso(date)}T00:00:00Z`).getUTCDay())) date = addDaysCompact(date, -1);
  return date;
}

function resolveAutomaticTargetDate(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now).map((part) => [part.type, part.value]));
  const date = `${parts.year}${parts.month}${parts.day}`;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return minutes >= 17 * 60 ? date : previousWeekday(date);
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.has('resolve-date')) {
    process.stdout.write(args.get('date') ? normalizeCompactDate(args.get('date')) : resolveAutomaticTargetDate());
    return;
  }
  const outputDir = args.get('output-dir') ? path.resolve(args.get('output-dir')) : DEFAULT_OUTPUT_DIR;
  if (args.has('refresh-indexes')) {
    console.log(JSON.stringify({ count: refreshIndexes(outputDir).length }));
    return;
  }
  const force = args.has('force');
  const planOnly = args.has('plan-only');
  const explicitDates = String(args.get('dates') || args.get('date') || '')
    .split(',').map((value) => value.trim()).filter(Boolean).map((value) => normalizeCompactDate(value));
  let start = args.get('start');
  let end = args.get('end');
  if (explicitDates.length) {
    start = explicitDates.slice().sort()[0];
    end = explicitDates.slice().sort().at(-1);
  } else if (!start && !end) {
    start = end = resolveAutomaticTargetDate();
  } else {
    start = start || end;
    end = end || start;
  }
  start = normalizeCompactDate(start, 'start date');
  end = normalizeCompactDate(end, 'end date');
  const sourcePayload = args.get('input-file')
    ? readJson(path.resolve(args.get('input-file')))
    : await fetchJson(buildYahooUrl(start, end));
  const rows = parseRows(sourcePayload);
  if (planOnly) {
    process.stdout.write(`${JSON.stringify(buildPlan({
      rows, start, end,
      batchSize: Number(args.get('batch-size') || 10),
      outputDir,
      force
    }))}\n`);
    return;
  }
  const dates = explicitDates.length ? explicitDates : [start];
  const results = writeDates({ rows, dates, outputDir, force });
  console.log(JSON.stringify({ written: results.length, results }));
}

if (require.main === module) main().catch((error) => {
  console.error(`Failed to crawl VIX index: ${error.message}`);
  process.exitCode = 1;
});

module.exports = {
  buildDailyPayload,
  buildPlan,
  buildYahooUrl,
  parseRows,
  refreshIndexes,
  resolveAutomaticTargetDate,
  validateStored,
  writeDates
};
