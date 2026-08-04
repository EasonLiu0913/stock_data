#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  compactToSlash,
  loadTwseTradingCalendar,
  normalizeCompactDate,
  parseArgs,
  readJson,
  writeJsonAtomic
} = require('./lib/range_backfill');

const INSTITUTIONAL_DIR = path.join(ROOT, 'data_institutional');
const SMA_DIR = path.join(ROOT, 'data_history_sma');
const OUTPUT_DIR = path.join(ROOT, 'data_fubon');
const CSV_FILE = path.join(ROOT, 'data_twse', 'twse_industry.csv');
const DEFAULT_START = '20251202';
const DEFAULT_END = '20260608';

function compactToRocSlash(compact) {
  const date = normalizeCompactDate(compact);
  return `${Number(date.slice(0, 4)) - 1911}/${date.slice(4, 6)}/${date.slice(6, 8)}`;
}

function readStockMap(csvFile = CSV_FILE) {
  const lines = fs.readFileSync(csvFile, 'utf8').trim().split(/\r?\n/);
  const map = new Map();
  for (const line of lines.slice(1)) {
    const parts = line.split(',');
    const code = String(parts[0] || '').trim();
    if (!code) continue;
    map.set(code, String(parts[1] || '').trim());
  }
  return map;
}

function formatSma(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : value;
}

function formatVolume(value) {
  return typeof value === 'number' && Number.isFinite(value) ? String(Math.trunc(value)) : value;
}

function buildDailySma(stockMap, smaDataCache, date) {
  const dateKey = compactToSlash(date);
  const output = {};
  for (const [code, name] of stockMap) {
    const point = smaDataCache.get(code)?.[dateKey];
    if (!point) continue;
    output[code] = {
      StockName: name,
      [dateKey]: {
        Price: formatSma(point.price),
        Open: formatSma(point.open),
        High: formatSma(point.high),
        Low: formatSma(point.low),
        Volume: formatVolume(point.volume),
        SMA5: formatSma(point.sma5),
        SMA20: formatSma(point.sma20),
        SMA60: formatSma(point.sma60),
        SMA120: formatSma(point.sma120),
        SMA240: formatSma(point.sma240)
      }
    };
  }
  return output;
}

function buildDailyInstitutional(stockMap, institutionalCache, date) {
  const dateKey = compactToSlash(date);
  const output = {};
  for (const [code, name] of stockMap) {
    const history = institutionalCache.get(code);
    if (!history) continue;
    const keys = Object.keys(history).filter((key) => key <= dateKey).sort().reverse().slice(0, 30);
    if (!keys.length) continue;
    const foreign = {};
    const trust = {};
    const dealers = {};
    const total = {};
    for (const key of keys) {
      const compact = key.replaceAll('/', '');
      const rocDate = compactToRocSlash(compact);
      const item = history[key] || {};
      foreign[rocDate] = item.ForeignInvestors;
      trust[rocDate] = item.InvestmentTrust;
      dealers[rocDate] = item.Dealers;
      total[rocDate] = item.DailyTotal;
    }
    output[code] = {
      StockName: name,
      ForeignInvestors: foreign,
      InvestmentTrust: trust,
      Dealers: dealers,
      DailyTotal: total
    };
  }
  return output;
}

function loadCache(stockMap, directory) {
  const cache = new Map();
  for (const code of stockMap.keys()) {
    const file = path.join(directory, `${code}.json`);
    const payload = readJson(file, null);
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) cache.set(code, payload);
  }
  return cache;
}

function mergeRange(options = {}) {
  const start = normalizeCompactDate(options.start || DEFAULT_START, 'start date');
  const end = normalizeCompactDate(options.end || DEFAULT_END, 'end date');
  if (start > end) throw new Error(`Start date ${start} is after end date ${end}`);
  const calendar = loadTwseTradingCalendar(options.calendarFile);
  if (start < calendar.firstDate || end > calendar.lastDate) {
    throw new Error(`Requested range ${start}~${end} is outside TWSE calendar ${calendar.firstDate}~${calendar.lastDate}`);
  }
  const dates = calendar.dates.filter((date) => date >= start && date <= end);
  const stockMap = readStockMap(options.csvFile || CSV_FILE);
  const smaCache = loadCache(stockMap, options.smaDir || SMA_DIR);
  const institutionalCache = options.smaOnly ? new Map() : loadCache(stockMap, options.institutionalDir || INSTITUTIONAL_DIR);
  const outputDir = options.outputDir || OUTPUT_DIR;
  fs.mkdirSync(outputDir, { recursive: true });
  const results = [];

  for (const date of dates) {
    const sma = buildDailySma(stockMap, smaCache, date);
    const smaCount = Object.keys(sma).length;
    const smaFile = path.join(outputDir, `fubon_${date}_sma.json`);
    if (smaCount > 0) writeJsonAtomic(smaFile, sma);

    let institutionalCount = 0;
    let institutionalFile = null;
    if (!options.smaOnly) {
      const institutional = buildDailyInstitutional(stockMap, institutionalCache, date);
      institutionalCount = Object.keys(institutional).length;
      institutionalFile = path.join(outputDir, `fubon_${date}_institutional.json`);
      if (institutionalCount > 0) writeJsonAtomic(institutionalFile, institutional);
    }
    results.push({ date, smaCount, smaFile, institutionalCount, institutionalFile });
    console.log(`merge ${date}: SMA ${smaCount}${options.smaOnly ? '' : `, institutional ${institutionalCount}`}`);
  }
  return { start, end, dateCount: dates.length, stockCount: stockMap.size, results };
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const result = mergeRange({
    start: args.get('start') || DEFAULT_START,
    end: args.get('end') || DEFAULT_END,
    smaOnly: args.has('sma-only'),
    outputDir: args.get('output-dir') ? path.resolve(args.get('output-dir')) : undefined,
    smaDir: args.get('sma-dir') ? path.resolve(args.get('sma-dir')) : undefined,
    institutionalDir: args.get('institutional-dir') ? path.resolve(args.get('institutional-dir')) : undefined,
    csvFile: args.get('csv-file') ? path.resolve(args.get('csv-file')) : undefined,
    calendarFile: args.get('calendar-file') ? path.resolve(args.get('calendar-file')) : undefined
  });
  console.log(JSON.stringify({ start: result.start, end: result.end, dates: result.dateCount, stocks: result.stockCount }));
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(`Failed to merge historical data: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildDailyInstitutional,
  buildDailySma,
  compactToRocSlash,
  mergeRange,
  readStockMap
};
