#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const DEFAULT_TWSE_CALENDAR = path.join(ROOT, 'data_twse_market_chart', 'market_chart.json');

function normalizeCompactDate(value, label = 'date') {
  const text = String(value || '').replace(/[^\d]/g, '');
  if (!/^20\d{6}$/.test(text)) throw new Error(`Invalid ${label}: ${value}; expected YYYYMMDD`);
  const year = Number(text.slice(0, 4));
  const month = Number(text.slice(4, 6));
  const day = Number(text.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) throw new Error(`Invalid calendar ${label}: ${value}`);
  return text;
}

function compactToIso(value) {
  const date = normalizeCompactDate(value);
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

function compactToSlash(value) {
  const date = normalizeCompactDate(value);
  return `${date.slice(0, 4)}/${date.slice(4, 6)}/${date.slice(6, 8)}`;
}

function isoToCompact(value) {
  return normalizeCompactDate(value);
}

function addDaysCompact(value, days) {
  const compact = normalizeCompactDate(value);
  const date = new Date(`${compactToIso(compact)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Number(days));
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

function dateRange(start, end) {
  const first = normalizeCompactDate(start, 'start date');
  const last = normalizeCompactDate(end, 'end date');
  if (first > last) throw new Error(`Start date ${first} is after end date ${last}`);
  const dates = [];
  for (let current = first; current <= last; current = addDaysCompact(current, 1)) dates.push(current);
  return dates;
}

function chunk(items, size) {
  const batchSize = Number(size);
  if (!Number.isInteger(batchSize) || batchSize < 1) throw new Error(`Invalid batch size: ${size}`);
  const batches = [];
  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }
  return batches;
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const [rawKey, inline] = arg.slice(2).split('=', 2);
    if (inline !== undefined) {
      args.set(rawKey, inline);
      continue;
    }
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) args.set(rawKey, true);
    else {
      args.set(rawKey, next);
      index += 1;
    }
  }
  return args;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (arguments.length >= 2) return fallback;
    throw error;
  }
}

function writeJsonAtomic(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function loadTwseTradingCalendar(file = DEFAULT_TWSE_CALENDAR) {
  if (!fs.existsSync(file)) throw new Error(`TWSE trading calendar not found: ${path.relative(ROOT, file)}`);
  const payload = readJson(file);
  const dates = [...new Set((payload?.data || [])
    .map((item) => String(item?.date || '').replace(/[^\d]/g, ''))
    .filter((date) => /^20\d{6}$/.test(date)))].sort();
  if (!dates.length) throw new Error(`TWSE trading calendar contains no dates: ${path.relative(ROOT, file)}`);
  return {
    file,
    dates,
    set: new Set(dates),
    firstDate: dates[0],
    lastDate: dates.at(-1)
  };
}

function assertRangeCovered(start, end, calendar) {
  if (start < calendar.firstDate || end > calendar.lastDate) {
    throw new Error(
      `Requested range ${start}~${end} is outside calendar ${calendar.firstDate}~${calendar.lastDate}`
    );
  }
}

function buildMatrix(dates, batchSize, extra = {}) {
  const rawBatches = chunk(dates, batchSize);
  return {
    include: rawBatches.map((batchDates, index) => ({
      batch_index: index + 1,
      batch_count: rawBatches.length,
      dates: batchDates.join(','),
      first_date: batchDates[0],
      last_date: batchDates.at(-1),
      has_next: index < rawBatches.length - 1,
      ...extra
    }))
  };
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

module.exports = {
  ROOT,
  DEFAULT_TWSE_CALENDAR,
  addDaysCompact,
  assertRangeCovered,
  buildMatrix,
  chunk,
  compactToIso,
  compactToSlash,
  dateRange,
  finiteNumber,
  isoToCompact,
  loadTwseTradingCalendar,
  normalizeCompactDate,
  parseArgs,
  readJson,
  writeJsonAtomic
};
