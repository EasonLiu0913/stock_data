#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const HOLIDAY_FILE = path.join(ROOT, 'data_history_sma', 'non_trading_days.json');
const MARKET_CONTEXT_CAPTURE = path.join(__dirname, 'capture_prediction_market_context.js');

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

function buildResolvedDates(targetIso, now, holidays) {
  const parts = taipeiParts(now);
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

function resolveForecastDates(now = new Date(), holidays = loadHolidaySet()) {
  const parts = taipeiParts(now);
  const minutes = parts.hour * 60 + parts.minute;
  const marketCloseMinutes = 15 * 60 + 30;
  const todayIsTradingDate = isTradingDate(parts.isoDate, holidays);
  const targetIso = todayIsTradingDate && minutes < marketCloseMinutes
    ? parts.isoDate
    : nextTradingDate(parts.isoDate, holidays, false);
  return buildResolvedDates(targetIso, now, holidays);
}

function resolveExplicitForecastDate(value, now = new Date(), holidays = loadHolidaySet()) {
  const targetIso = normalizeIsoDate(value);
  if (!targetIso) {
    throw new Error(`Invalid --target-date value: ${value}. Expected YYYYMMDD or YYYY-MM-DD.`);
  }
  if (!isTradingDate(targetIso, holidays)) {
    throw new Error(`Forecast target date is not a trading day: ${targetIso}`);
  }
  return buildResolvedDates(targetIso, now, holidays);
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

function isDailyPredictionWorkflow(args = new Map()) {
  if (args.has('capture-market-context')) return true;
  if (args.has('skip-market-context')) return false;
  if (process.env.GITHUB_ACTIONS !== 'true') return false;
  const identity = `${process.env.GITHUB_WORKFLOW_REF || ''} ${process.env.GITHUB_WORKFLOW || ''}`;
  return identity.includes('daily-stock-prediction.yml') || identity.includes('每日產生股票預測');
}

function capturePredictionMarketContext(resolved) {
  const forecast = resolved.forecast_target_date_compact;
  const base = resolved.base_trade_date_compact;
  const result = spawnSync(process.execPath, [
    MARKET_CONTEXT_CAPTURE,
    '--forecast-date', forecast,
    '--base-date', base,
  ], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_OPTIONS: '' },
  });
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    if (result.stdout) process.stderr.write(result.stdout);
    throw new Error(`Prediction market context capture failed with exit code ${result.status}`);
  }

  const latestFile = path.join(ROOT, 'data_prediction_context', forecast, 'latest.json');
  const latest = readJson(latestFile, null);
  if (!latest?.manifest_file || !latest?.external_market_file || !latest?.night_futures_file) {
    throw new Error(`Prediction market context latest.json is incomplete: ${latestFile}`);
  }

  if (process.env.GITHUB_ACTIONS === 'true') {
    const staged = spawnSync('git', ['add', path.join('data_prediction_context', forecast)], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    if (staged.status !== 0) {
      throw new Error(`Unable to stage prediction market context: ${staged.stderr || staged.stdout}`);
    }
  }

  return {
    ...latest,
    latest_file: path.relative(ROOT, latestFile).replaceAll(path.sep, '/'),
    external_market_absolute: path.join(ROOT, latest.external_market_file),
    night_futures_absolute: path.join(ROOT, latest.night_futures_file),
    manifest_absolute: path.join(ROOT, latest.manifest_file),
  };
}

function githubEnvLines(resolved, context = null) {
  const lines = [
    `FORECAST_BASE_DATE=${resolved.base_trade_date_compact}`,
    `FORECAST_TARGET_DATE=${resolved.forecast_target_date_compact}`,
    `FORECAST_BASE_DATE_ISO=${resolved.base_trade_date}`,
    `FORECAST_TARGET_DATE_ISO=${resolved.forecast_target_date}`,
  ];
  if (context) {
    lines.push(
      `PREDICTION_MARKET_CONTEXT_LATEST_FILE=${context.latest_file}`,
      `PREDICTION_MARKET_CONTEXT_MANIFEST_FILE=${context.manifest_absolute}`,
      `PREDICTION_MARKET_CONTEXT_EXTERNAL_FILE=${context.external_market_absolute}`,
      `PREDICTION_MARKET_CONTEXT_NIGHT_FILE=${context.night_futures_absolute}`,
      `PREDICTION_MARKET_CONTEXT_SNAPSHOT_ID=${context.snapshot_id}`,
      `PREDICTION_MARKET_CONTEXT_SNAPSHOT_HASH=${context.snapshot_hash}`,
    );
  }
  return lines;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const nowArg = args.get('now');
  const now = nowArg ? new Date(nowArg) : new Date();
  if (Number.isNaN(now.getTime())) {
    throw new Error(`Invalid --now value: ${nowArg}`);
  }

  const targetDateArg = args.get('target-date');
  const resolved = targetDateArg
    ? resolveExplicitForecastDate(targetDateArg, now)
    : resolveForecastDates(now);
  const context = args.has('github-env') && isDailyPredictionWorkflow(args)
    ? capturePredictionMarketContext(resolved)
    : null;

  if (args.has('github-env')) {
    process.stdout.write(githubEnvLines(resolved, context).join('\n'));
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
  resolveExplicitForecastDate,
  resolveForecastDates,
  isDailyPredictionWorkflow,
  capturePredictionMarketContext,
  githubEnvLines,
};
