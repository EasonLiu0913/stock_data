#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_FUBON_DIR = path.join(ROOT, 'data_fubon');
const DEFAULT_TRADING_FILE = path.join(ROOT, 'data_history_sma', 'trading_days.json');
const DEFAULT_NON_TRADING_FILE = path.join(ROOT, 'data_history_sma', 'non_trading_days.json');

function parseArgs(argv) {
  const out = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out.set(key, next);
      i += 1;
    } else {
      out.set(key, true);
    }
  }
  return out;
}

function compactToSlash(date) {
  return `${date.slice(0,4)}/${date.slice(4,6)}/${date.slice(6,8)}`;
}

function isWeekendCompact(date) {
  const d = new Date(`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}T00:00:00+08:00`);
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function calendarSet(calendar) {
  return new Set(Object.values(calendar || {}).flat());
}

function validateDailySma(file, compactDate, minRows = 100) {
  const payload = readJson(file);
  const expected = compactToSlash(compactDate);
  const entries = Object.entries(payload || {});
  let validRows = 0;
  for (const [, stock] of entries) {
    const row = stock && stock[expected];
    if (row && row.Price != null && row.SMA5 != null) validRows += 1;
  }
  return {
    valid: entries.length >= minRows && validRows >= minRows,
    stockCount: entries.length,
    validRows,
    expectedDate: expected
  };
}

function listDailySmaFiles(dir, start, end) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .map(name => {
      const m = name.match(/^fubon_(20\d{6})_sma\.json$/);
      if (!m) return null;
      return { name, date: m[1], file: path.join(dir, name) };
    })
    .filter(Boolean)
    .filter(x => !start || x.date >= start)
    .filter(x => !end || x.date <= end)
    .sort((a,b) => a.date.localeCompare(b.date));
}

function normalizeCalendar(calendar) {
  const out = {};
  for (const year of Object.keys(calendar || {}).sort()) {
    out[year] = [...new Set(calendar[year] || [])].sort();
  }
  return out;
}

function syncTradingCalendar(options = {}) {
  const fubonDir = options.fubonDir || DEFAULT_FUBON_DIR;
  const tradingFile = options.tradingFile || DEFAULT_TRADING_FILE;
  const nonTradingFile = options.nonTradingFile || DEFAULT_NON_TRADING_FILE;
  const start = options.start || null;
  const end = options.end || null;
  const minRows = Number(options.minRows || 100);

  const trading = fs.existsSync(tradingFile) ? readJson(tradingFile) : {};
  const nonTrading = fs.existsSync(nonTradingFile) ? readJson(nonTradingFile) : {};
  const nonTradingDates = calendarSet(nonTrading);

  const accepted = [];
  const rejected = [];
  for (const item of listDailySmaFiles(fubonDir, start, end)) {
    const slash = compactToSlash(item.date);
    if (isWeekendCompact(item.date)) {
      rejected.push({ date:item.date, reason:'weekend' });
      continue;
    }
    if (nonTradingDates.has(slash)) {
      rejected.push({ date:item.date, reason:'declared_non_trading_day' });
      continue;
    }
    let check;
    try {
      check = validateDailySma(item.file, item.date, minRows);
    } catch (error) {
      rejected.push({ date:item.date, reason:'invalid_json', error:error.message });
      continue;
    }
    if (!check.valid) {
      rejected.push({ date:item.date, reason:'insufficient_valid_sma_rows', ...check });
      continue;
    }
    const year = slash.slice(0,4);
    if (!Array.isArray(trading[year])) trading[year] = [];
    if (!trading[year].includes(slash)) trading[year].push(slash);
    accepted.push({ date:item.date, ...check });
  }

  const normalized = normalizeCalendar(trading);
  const before = fs.existsSync(tradingFile) ? fs.readFileSync(tradingFile,'utf8') : '';
  const after = JSON.stringify(normalized, null, 2) + '\n';
  const changed = before !== after;
  if (options.write !== false && changed) {
    fs.writeFileSync(tradingFile, after);
  }

  const allDates = Object.values(normalized).flat().sort();
  return {
    changed,
    accepted,
    rejected,
    latestTradingDate: allDates.at(-1) || null,
    tradingFile,
    source: 'validated_durable_daily_sma_checkpoint'
  };
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const result = syncTradingCalendar({
    start: args.get('start') || null,
    end: args.get('end') || null,
    minRows: args.get('min-rows') || 100,
    write: !args.has('check-only')
  });
  console.log(JSON.stringify(result, null, 2));
  if (args.has('require-latest')) {
    const required = compactToSlash(String(args.get('require-latest')));
    if (!result.latestTradingDate || result.latestTradingDate < required) {
      throw new Error(`Canonical trading calendar latest ${result.latestTradingDate || 'none'} is before required ${required}`);
    }
  }
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { syncTradingCalendar, validateDailySma, listDailySmaFiles, compactToSlash, isWeekendCompact };
