#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  addDaysCompact,
  buildMatrix,
  compactToIso,
  normalizeCompactDate,
  parseArgs,
  readJson
} = require('./lib/range_backfill');

const CALENDAR_SYMBOL = '^GSPC';
const PRIMARY_IDS = ['nasdaq', 'sp500', 'dow', 'sox', 'tsm_adr'];

function unixSeconds(compact) {
  return Math.floor(new Date(`${compactToIso(compact)}T00:00:00Z`).getTime() / 1000);
}

function buildYahooUrl(start, end, symbol = CALENDAR_SYMBOL) {
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
        'user-agent': 'Mozilla/5.0 (compatible; stock-data-range-planner/1.0)'
      }
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

function parseMarketDates(payload, start, end) {
  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const close = result?.indicators?.quote?.[0]?.close || [];
  const dates = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    if (!Number.isFinite(close[index])) continue;
    const date = new Date(timestamps[index] * 1000).toISOString().slice(0, 10).replaceAll('-', '');
    if (date >= start && date <= end) dates.push(date);
  }
  return [...new Set(dates)].sort();
}

function validateExternalSnapshot(file, date) {
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) return ['missing or empty file'];
  let payload;
  try { payload = readJson(file); } catch (error) { return [`invalid JSON: ${error.message}`]; }
  const errors = [];
  if (String(payload?.collection_date || '') !== date) errors.push(`collection_date is ${payload?.collection_date}`);
  if (!Array.isArray(payload?.indicators)) errors.push('indicators must be an array');
  if (errors.length) return errors;
  const byId = Object.fromEntries(payload.indicators.map((item) => [item.id, item]));
  for (const id of PRIMARY_IDS) {
    const item = byId[id];
    if (!item) errors.push(`${id} missing`);
    else {
      if (String(item.market_date || '') !== date) errors.push(`${id} market_date is ${item.market_date}`);
      if (!Number.isFinite(Number(item.close))) errors.push(`${id} close invalid`);
    }
  }
  return errors;
}

async function buildPlan(options) {
  const start = normalizeCompactDate(options.start, 'start date');
  const end = normalizeCompactDate(options.end, 'end date');
  if (start > end) throw new Error(`Start date ${start} is after end date ${end}`);
  const payload = options.payload || await fetchJson(buildYahooUrl(start, end, options.symbol));
  const marketDates = parseMarketDates(payload, start, end);
  if (!marketDates.length) throw new Error(`No U.S. market dates found for ${start}~${end}`);
  const outputDir = options.outputDir || path.join(ROOT, 'data_external_market');
  const invalid = [];
  const valid = [];
  for (const date of marketDates) {
    const errors = options.force
      ? ['forced']
      : validateExternalSnapshot(path.join(outputDir, date, 'external_market_indicators.json'), date);
    if (errors.length) invalid.push({ date, errors }); else valid.push(date);
  }
  const pendingDates = invalid.map((item) => item.date);
  return {
    dataset: 'external_market',
    start,
    end,
    calendar_symbol: options.symbol || CALENDAR_SYMBOL,
    market_date_count: marketDates.length,
    valid_date_count: valid.length,
    pending_date_count: pendingDates.length,
    pending_dates: pendingDates,
    invalid,
    matrix: buildMatrix(pendingDates, options.batchSize || 5)
  };
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const start = args.get('start');
  const end = args.get('end');
  if (!start || !end) throw new Error('--start and --end are required');
  const payload = args.get('input-file') ? readJson(path.resolve(args.get('input-file'))) : null;
  const plan = await buildPlan({
    start,
    end,
    batchSize: Number(args.get('batch-size') || 5),
    symbol: args.get('symbol') || CALENDAR_SYMBOL,
    outputDir: args.get('output-dir') ? path.resolve(args.get('output-dir')) : undefined,
    force: args.has('force'),
    payload
  });
  process.stdout.write(`${JSON.stringify(plan)}\n`);
}

if (require.main === module) main().catch((error) => {
  console.error(`Failed to plan external market backfill: ${error.message}`);
  process.exitCode = 1;
});

module.exports = {
  buildPlan,
  buildYahooUrl,
  parseMarketDates,
  validateExternalSnapshot
};
