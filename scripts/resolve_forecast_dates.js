#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const HOLIDAY_FILE = path.join(ROOT, 'data_history_sma', 'non_trading_days.json');

function readJson(file, fallback = null) {
  try {
    const text = fs.readFileSync(file, 'utf8').trim();
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

function loadHolidaySet(file = HOLIDAY_FILE) {
  const data = readJson(file, []);
  if (Array.isArray(data)) return new Set(data);
  if (data && typeof data === 'object') {
    return new Set(Object.values(data).flatMap((value) => Array.isArray(value) ? value : []));
  }
  return new Set();
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function normalizeIsoDate(value) {
  const text = String(value ?? '').trim();
  const compact = text.match(/^(20\d{2})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  const iso = text.match(/^(20\d{2})[-/](\d{2})[-/](\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function compactDate(iso) {
  return iso.replaceAll('-', '');
}

function addDays(iso, days) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function weekday(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

function isHoliday(iso, holidays) {
  return holidays.has(iso) || holidays.has(iso.replaceAll('-', '/'));
}

function isTradingDate(iso, holidays) {
  const day = weekday(iso);
  return day !== 0 && day !== 6 && !isHoliday(iso, holidays);
}

function nextTradingDate(iso, holidays, inclusive = false) {
  let date = inclusive ? iso : addDays(iso, 1);
  while (!isTradingDate(date, holidays)) date = addDays(date, 1);
  return date;
}

function previousTradingDate(iso, holidays, inclusive = false) {
  let date = inclusive ? iso : addDays(iso, -1);
  while (!isTradingDate(date, holidays)) date = addDays(date, -1);
  return date;
}

function taipeiParts(now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return {
    isoDate: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
    minute: Number(get('minute'))
  };
}

function resolveForecastDates(now = new Date(), holidays = loadHolidaySet()) {
  const parts = taipeiParts(now);
  const minutes = parts.hour * 60 + parts.minute;
  const marketCloseMinutes = 15 * 60 + 30;
  const todayIsTradingDate = isTradingDate(parts.isoDate, holidays);
  const targetIso = todayIsTradingDate && minutes < marketCloseMinutes
    ? parts.isoDate
    : nextTradingDate(parts.isoDate, holidays, false);
  const baseIso = previousTradingDate(targetIso, holidays, false);

  return {
    now_taipei_date: parts.isoDate,
    now_taipei_time: `${pad(parts.hour)}:${pad(parts.minute)}`,
    base_trade_date: baseIso,
    base_trade_date_compact: compactDate(baseIso),
    forecast_target_date: targetIso,
    forecast_target_date_compact: compactDate(targetIso)
  };
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args.set(key, true);
    } else {
      args.set(key, next);
      index += 1;
    }
  }
  return args;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const nowArg = args.get('now');
  const now = nowArg ? new Date(nowArg) : new Date();
  if (Number.isNaN(now.getTime())) {
    throw new Error(`Invalid --now value: ${nowArg}`);
  }
  const resolved = resolveForecastDates(now);

  if (args.has('github-env')) {
    process.stdout.write([
      `FORECAST_BASE_DATE=${resolved.base_trade_date_compact}`,
      `FORECAST_TARGET_DATE=${resolved.forecast_target_date_compact}`,
      `FORECAST_BASE_DATE_ISO=${resolved.base_trade_date}`,
      `FORECAST_TARGET_DATE_ISO=${resolved.forecast_target_date}`
    ].join('\n'));
    process.stdout.write('\n');
  } else {
    console.log(JSON.stringify(resolved, null, 2));
  }
}

module.exports = {
  addDays,
  compactDate,
  isTradingDate,
  loadHolidaySet,
  nextTradingDate,
  normalizeIsoDate,
  previousTradingDate,
  resolveForecastDates
};
