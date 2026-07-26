#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'data_oil_prices');
const DEFAULT_TIMEOUT_MS = 30000;
const SERIES = [
  {
    id: 'wti_spot',
    name: 'WTI Crude Oil Spot',
    fred_series_id: 'DCOILWTICO',
    source_name: 'FRED / EIA',
    source_url: 'https://fred.stlouisfed.org/series/DCOILWTICO',
    csv_url: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILWTICO',
    unit: 'USD per barrel'
  },
  {
    id: 'brent_spot',
    name: 'Brent Crude Oil Spot',
    fred_series_id: 'DCOILBRENTEU',
    source_name: 'FRED / EIA',
    source_url: 'https://fred.stlouisfed.org/series/DCOILBRENTEU',
    csv_url: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILBRENTEU',
    unit: 'USD per barrel'
  }
];

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) args.set(key, true);
    else {
      args.set(key, next);
      index += 1;
    }
  }
  return args;
}

function taipeiCompactDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}${get('month')}${get('day')}`;
}

function normalizeCompactDate(value) {
  const text = String(value || '').replace(/[^\d]/g, '');
  if (!/^\d{8}$/.test(text)) throw new Error(`Invalid --date: ${value}`);
  return text;
}

function compactToIso(value) {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function isoToCompact(value) {
  return String(value || '').replaceAll('-', '');
}

function round(value, digits = 4) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

async function fetchText(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'text/csv, text/plain, */*',
        'user-agent': 'Mozilla/5.0 (compatible; stock-oil-price-crawler/1.0)'
      }
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseFredCsv(text, valueKey) {
  const rows = [];
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const [date, rawValue] = line.split(',');
    const price = Number(rawValue);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isFinite(price)) continue;
    rows.push({ date: isoToCompact(date), iso_date: date, price: round(price) });
  }
  if (!rows.length) throw new Error(`No valid FRED observations for ${valueKey}`);
  return rows.sort((left, right) => left.date.localeCompare(right.date));
}

function pickObservation(rows, targetDate, offset) {
  const available = rows.filter((row) => row.date <= targetDate);
  return available.at(-1 - offset) || null;
}

function changeFrom(latest, previous) {
  if (!latest || !previous) return { change: null, change_pct: null };
  const change = latest.price - previous.price;
  return {
    change: round(change),
    change_pct: previous.price !== 0 ? round((change / previous.price) * 100) : null
  };
}

async function crawlSeries(series, targetDate) {
  const csv = await fetchText(series.csv_url);
  const rows = parseFredCsv(csv, series.fred_series_id);
  const latest = pickObservation(rows, targetDate, 0);
  const previous = pickObservation(rows, targetDate, 1);
  const previous5 = pickObservation(rows, targetDate, 5);
  const previous20 = pickObservation(rows, targetDate, 20);
  if (!latest) throw new Error(`No observations on or before ${targetDate} for ${series.fred_series_id}`);
  const day = changeFrom(latest, previous);
  const five = changeFrom(latest, previous5);
  const twenty = changeFrom(latest, previous20);
  return {
    ...series,
    requested_date: targetDate,
    latest_date: latest.date,
    latest_iso_date: latest.iso_date,
    latest_price: latest.price,
    previous_date: previous?.date || null,
    previous_price: previous?.price ?? null,
    change: day.change,
    change_pct: day.change_pct,
    change_5d: five.change,
    change_pct_5d: five.change_pct,
    change_20d: twenty.change,
    change_pct_20d: twenty.change_pct,
    observations: rows.filter((row) => row.date <= targetDate).slice(-80)
  };
}

function buildSpread(benchmarks) {
  const wti = benchmarks.find((item) => item.id === 'wti_spot');
  const brent = benchmarks.find((item) => item.id === 'brent_spot');
  if (!wti || !brent || !Number.isFinite(wti.latest_price) || !Number.isFinite(brent.latest_price)) return null;
  return {
    id: 'wti_brent_spread',
    name: 'WTI - Brent Spread',
    unit: 'USD per barrel',
    latest_date: wti.latest_date === brent.latest_date ? wti.latest_date : null,
    wti_latest_date: wti.latest_date,
    brent_latest_date: brent.latest_date,
    spread: round(wti.latest_price - brent.latest_price)
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.has('help')) {
    console.log('Usage: node scripts/crawl_oil_prices.js [--date YYYYMMDD]');
    return;
  }
  const targetDate = normalizeCompactDate(args.get('date') || taipeiCompactDate());
  const benchmarks = [];
  const errors = [];

  for (const series of SERIES) {
    try {
      benchmarks.push(await crawlSeries(series, targetDate));
    } catch (error) {
      errors.push({ id: series.id, fred_series_id: series.fred_series_id, error: error.message });
    }
  }

  const payload = {
    schemaVersion: 1,
    generated_at: new Date().toISOString(),
    collection_date: targetDate,
    collection_iso_date: compactToIso(targetDate),
    source: 'FRED CSV, original series from U.S. Energy Information Administration',
    crawler: path.relative(ROOT, __filename),
    benchmark_count: benchmarks.length,
    error_count: errors.length,
    benchmarks,
    spread: buildSpread(benchmarks),
    errors
  };

  const outputDir = path.join(OUTPUT_DIR, targetDate);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'oil_prices.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const dateDirs = fs.readdirSync(OUTPUT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{8}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  fs.writeFileSync(path.join(OUTPUT_DIR, 'files.json'), `${JSON.stringify(dateDirs.map((date) => `${date}/oil_prices.json`), null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), `${JSON.stringify({
    schemaVersion: 1,
    generated_at: payload.generated_at,
    latest_date: targetDate,
    latest_file: `data_oil_prices/${targetDate}/oil_prices.json`,
    available_dates: dateDirs
  }, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    collection_date: targetDate,
    benchmarks: benchmarks.length,
    errors: errors.length,
    latest_dates: benchmarks.map((item) => `${item.id}:${item.latest_date}`),
    output: `data_oil_prices/${targetDate}/oil_prices.json`
  }));
}

main().catch((error) => {
  console.error(`Failed to crawl oil prices: ${error.message}`);
  process.exitCode = 1;
});
