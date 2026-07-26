#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'external_market_indicators.json');
const OUTPUT_DIR = path.join(ROOT, 'data_external_market');
const DEFAULT_TIMEOUT_MS = 30000;

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

function addDaysIso(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function unixSeconds(iso) {
  return Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / 1000);
}

function round(value, digits = 4) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

async function fetchJson(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'application/json, text/plain, */*',
        'user-agent': 'Mozilla/5.0 (compatible; stock-external-market-crawler/1.0)'
      }
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function yahooChartUrl(symbol, targetDate) {
  const targetIso = compactToIso(targetDate);
  const period1 = unixSeconds(addDaysIso(targetIso, -14));
  const period2 = unixSeconds(addDaysIso(targetIso, 2));
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=history&includeAdjustedClose=true`;
}

function parseYahooRows(payload) {
  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  const adjclose = result?.indicators?.adjclose?.[0]?.adjclose || [];
  const rows = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const close = quote.close?.[index] ?? adjclose[index];
    if (!Number.isFinite(close)) continue;
    rows.push({
      date: new Date(timestamps[index] * 1000).toISOString().slice(0, 10).replaceAll('-', ''),
      open: round(quote.open?.[index]),
      high: round(quote.high?.[index]),
      low: round(quote.low?.[index]),
      close: round(close),
      volume: Number.isFinite(quote.volume?.[index]) ? quote.volume[index] : null,
      adjclose: round(adjclose[index])
    });
  }
  return rows.sort((left, right) => left.date.localeCompare(right.date));
}

function pickLatestRows(rows, targetDate) {
  const available = rows.filter((row) => row.date <= targetDate);
  const latest = available.at(-1) || null;
  const previous = available.at(-2) || null;
  return { latest, previous };
}

async function crawlIndicator(indicator, targetDate) {
  const url = yahooChartUrl(indicator.symbol, targetDate);
  const payload = await fetchJson(url);
  const rows = parseYahooRows(payload);
  const { latest, previous } = pickLatestRows(rows, targetDate);
  if (!latest) throw new Error(`No price rows for ${indicator.symbol}`);
  const change = previous ? latest.close - previous.close : null;
  const changePercent = previous && previous.close !== 0 ? (latest.close / previous.close - 1) * 100 : null;
  return {
    ...indicator,
    source: 'yahoo_finance_chart',
    requested_date: targetDate,
    market_date: latest.date,
    previous_market_date: previous?.date || null,
    open: latest.open,
    high: latest.high,
    low: latest.low,
    close: latest.close,
    previous_close: previous?.close ?? null,
    change: round(change),
    change_percent: round(changePercent),
    volume: latest.volume,
    rows
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetDate = normalizeCompactDate(args.get('date') || taipeiCompactDate());
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const indicators = [];
  const errors = [];

  for (const indicator of config.indicators || []) {
    try {
      indicators.push(await crawlIndicator(indicator, targetDate));
    } catch (error) {
      errors.push({ id: indicator.id, symbol: indicator.symbol, error: error.message });
    }
  }

  const payload = {
    schemaVersion: 1,
    generated_at: new Date().toISOString(),
    collection_date: targetDate,
    source_config: path.relative(ROOT, CONFIG_PATH),
    crawler: path.relative(ROOT, __filename),
    indicator_count: indicators.length,
    error_count: errors.length,
    indicators,
    errors
  };

  const outputDir = path.join(OUTPUT_DIR, targetDate);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'external_market_indicators.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const dateDirs = fs.readdirSync(OUTPUT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{8}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  fs.writeFileSync(path.join(OUTPUT_DIR, 'files.json'), `${JSON.stringify(dateDirs.map((date) => `${date}/external_market_indicators.json`), null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), `${JSON.stringify({
    schemaVersion: 1,
    generated_at: payload.generated_at,
    latest_date: targetDate,
    latest_file: `data_external_market/${targetDate}/external_market_indicators.json`,
    available_dates: dateDirs
  }, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    collection_date: targetDate,
    indicators: indicators.length,
    errors: errors.length,
    output: `data_external_market/${targetDate}/external_market_indicators.json`
  }));
}

main().catch((error) => {
  console.error(`Failed to crawl external market indicators: ${error.message}`);
  process.exitCode = 1;
});
