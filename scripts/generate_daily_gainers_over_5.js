#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SMA_DIR = path.join(ROOT, 'data_fubon');
const OUTPUT_DIR = path.join(ROOT, 'data_daily_gain_over_5');
const THRESHOLD_PCT = 5;

function parseArgs(argv) {
  const args = { date: '' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--date') args.date = String(argv[++i] || '').trim();
    else if (argv[i] === '--self-test') args.selfTest = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

function compactToSlash(date) {
  return `${date.slice(0, 4)}/${date.slice(4, 6)}/${date.slice(6, 8)}`;
}

function listSmaDates() {
  if (!fs.existsSync(SMA_DIR)) return [];
  return fs.readdirSync(SMA_DIR)
    .map((name) => {
      const match = /^fubon_(20\d{6})_sma\.json$/.exec(name);
      return match?.[1] || null;
    })
    .filter(Boolean)
    .sort();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function numeric(value) {
  const number = Number(String(value ?? '').replaceAll(',', ''));
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function buildForDate(targetDate) {
  const dates = listSmaDates();
  const index = dates.indexOf(targetDate);
  if (index < 0) throw new Error(`SMA file not found for ${targetDate}`);
  if (index === 0) throw new Error(`No previous SMA trading date before ${targetDate}`);

  const previousDate = dates[index - 1];
  const currentFile = path.join(SMA_DIR, `fubon_${targetDate}_sma.json`);
  const previousFile = path.join(SMA_DIR, `fubon_${previousDate}_sma.json`);
  const current = readJson(currentFile);
  const previous = readJson(previousFile);
  const currentKey = compactToSlash(targetDate);
  const previousKey = compactToSlash(previousDate);

  const stocks = [];
  for (const [code, currentStock] of Object.entries(current)) {
    const previousStock = previous[code];
    const currentRow = currentStock?.[currentKey];
    const previousRow = previousStock?.[previousKey];
    const close = numeric(currentRow?.Price);
    const previousClose = numeric(previousRow?.Price);
    if (!(close > 0) || !(previousClose > 0)) continue;

    const changePctRaw = ((close - previousClose) / previousClose) * 100;
    if (changePctRaw + 1e-12 < THRESHOLD_PCT) continue;

    stocks.push({
      code,
      name: String(currentStock?.StockName || previousStock?.StockName || ''),
      previous_close: previousClose,
      close,
      change_pct: round(changePctRaw, 2),
      open: numeric(currentRow?.Open),
      high: numeric(currentRow?.High),
      low: numeric(currentRow?.Low),
      volume: numeric(currentRow?.Volume),
    });
  }

  stocks.sort((a, b) => b.change_pct - a.change_pct || a.code.localeCompare(b.code));

  return {
    schema_version: 1,
    target_date: targetDate,
    previous_date: previousDate,
    threshold_pct: THRESHOLD_PCT,
    source_files: [
      `data_fubon/fubon_${previousDate}_sma.json`,
      `data_fubon/fubon_${targetDate}_sma.json`,
    ],
    stock_count: stocks.length,
    stocks,
  };
}

function updateFilesIndex() {
  const files = fs.readdirSync(OUTPUT_DIR)
    .filter((name) => /^20\d{6}\.json$/.test(name))
    .sort()
    .reverse();
  const payload = {
    schema_version: 1,
    latest_date: files[0]?.replace('.json', '') || null,
    files,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'files.json'), `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

function selfTest() {
  const current = 105;
  const previous = 100;
  const change = ((current - previous) / previous) * 100;
  if (round(change, 2) !== 5) throw new Error('5% threshold calculation failed');
  if (compactToSlash('20260817') !== '2026/08/17') throw new Error('date conversion failed');
  console.log('daily gain over 5% self-test passed');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfTest) return selfTest();

  const dates = listSmaDates();
  if (dates.length < 2) throw new Error('At least two SMA dates are required');
  const targetDate = args.date || dates.at(-1);
  if (!/^20\d{6}$/.test(targetDate)) throw new Error(`Invalid target date: ${targetDate}`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const payload = buildForDate(targetDate);
  fs.writeFileSync(path.join(OUTPUT_DIR, `${targetDate}.json`), `${JSON.stringify(payload, null, 2)}\n`);
  const index = updateFilesIndex();
  console.log(JSON.stringify({
    target_date: targetDate,
    previous_date: payload.previous_date,
    threshold_pct: THRESHOLD_PCT,
    stock_count: payload.stock_count,
    latest_date: index.latest_date,
  }, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || error);
    process.exit(1);
  }
}

module.exports = { buildForDate, compactToSlash, listSmaDates, numeric, round };
