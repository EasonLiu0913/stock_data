#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MARKET_PATH = path.join(ROOT, 'data_twse_market_chart', 'market_chart.json');
const OUTPUT_PATH = path.join(ROOT, 'public', 'data', 'etf-market-regime-analysis', 'data.json');
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_RETRIES = 3;

const ETF_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: '0050',
    symbol: '0050.TW',
    name: '元大台灣50',
    description: '台灣大型權值股核心 ETF',
    closeField: 'etf0050Close',
    adjustedCloseField: 'etf0050AdjustedClose'
  }),
  Object.freeze({
    id: '0052',
    symbol: '0052.TW',
    name: '富邦科技',
    description: '台灣科技產業集中型 ETF',
    closeField: 'etf0052Close',
    adjustedCloseField: 'etf0052AdjustedClose'
  }),
  Object.freeze({
    id: '00631L',
    symbol: '00631L.TW',
    name: '元大台灣50正2',
    description: '追求台灣50指數單日正向兩倍報酬的槓桿 ETF',
    closeField: 'etf00631LClose',
    adjustedCloseField: 'etf00631LAdjustedClose'
  })
]);

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) args.set(key, true);
    else {
      args.set(key, next);
      index += 1;
    }
  }
  return args;
}

function normalizeDate(value, label) {
  const compact = String(value || '').replace(/[^\d]/g, '');
  if (!/^\d{8}$/.test(compact)) throw new Error(`${label} must use YYYYMMDD: ${value || '(empty)'}`);
  return compact;
}

function compactToIso(value) {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function addDays(compact, days) {
  const date = new Date(`${compactToIso(compact)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

function unixSeconds(compact) {
  return Math.floor(new Date(`${compactToIso(compact)}T00:00:00Z`).getTime() / 1000);
}

function round(value, digits = 6) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, label, options = {}) {
  const timeoutMs = Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS;
  const retries = Number.isInteger(options.retries) ? options.retries : DEFAULT_RETRIES;
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: 'application/json, text/plain, */*',
          'user-agent': 'Mozilla/5.0 (compatible; stock-data-etf-regime-research/1.0)'
        }
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      const delay = 1500 * (attempt + 1);
      console.warn(`Retry ${attempt + 1}/${retries} for ${label} after ${delay}ms: ${error.message}`);
      await sleep(delay);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`${label} failed: ${lastError?.message || 'unknown error'}`);
}

function buildYahooUrl(symbol, fromDate, toDate) {
  const period1 = unixSeconds(addDays(fromDate, -7));
  const period2 = unixSeconds(addDays(toDate, 3));
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`
    + `?period1=${period1}&period2=${period2}&interval=1d&events=history,div,splits&includeAdjustedClose=true`;
}

function formatTimestampInTaipei(timestamp) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(timestamp * 1000));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}`;
}

function parseYahooRows(payload) {
  const result = payload?.chart?.result?.[0];
  if (!result) {
    const message = payload?.chart?.error?.description || 'Yahoo chart result is empty';
    throw new Error(message);
  }
  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const adjusted = result.indicators?.adjclose?.[0]?.adjclose || [];
  const rows = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const close = Number(quote.close?.[index]);
    const adjustedClose = Number(adjusted[index]);
    if (!Number.isFinite(close) || close <= 0) continue;
    rows.push({
      date: formatTimestampInTaipei(timestamps[index]),
      open: round(Number(quote.open?.[index])),
      high: round(Number(quote.high?.[index])),
      low: round(Number(quote.low?.[index])),
      close: round(close),
      adjustedClose: round(Number.isFinite(adjustedClose) && adjustedClose > 0 ? adjustedClose : close),
      volume: Number.isFinite(Number(quote.volume?.[index])) ? Number(quote.volume[index]) : null
    });
  }
  const deduplicated = new Map(rows.map((row) => [row.date, row]));
  return [...deduplicated.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function readMarketData(filePath = MARKET_PATH) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing market data: ${path.relative(ROOT, filePath)}`);
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const rows = (payload.data || [])
    .filter((row) => /^\d{8}$/.test(String(row.date || '')) && Number.isFinite(Number(row.close)))
    .map((row) => ({ date: row.date, close: Number(row.close) }))
    .sort((left, right) => left.date.localeCompare(right.date));
  if (rows.length < 2) throw new Error('TWSE market chart has insufficient rows');
  return { payload, rows };
}

function alignRows(marketRows, etfRowsById, etfs = ETF_DEFINITIONS) {
  const maps = Object.fromEntries(etfs.map((etf) => [etf.id, new Map((etfRowsById[etf.id] || []).map((row) => [row.date, row]))]));
  const missingDates = Object.fromEntries(etfs.map((etf) => [etf.id, []]));
  const rows = [];
  for (const market of marketRows) {
    const item = { date: market.date, marketClose: round(market.close) };
    let complete = true;
    for (const etf of etfs) {
      const source = maps[etf.id].get(market.date);
      if (!source) {
        missingDates[etf.id].push(market.date);
        complete = false;
        continue;
      }
      item[etf.closeField] = source.close;
      item[etf.adjustedCloseField] = source.adjustedClose;
    }
    if (complete) rows.push(item);
  }
  return { rows, missingDates };
}

function validateOutput(output) {
  if (!Array.isArray(output.rows) || output.rows.length < 2) throw new Error('Output has insufficient aligned rows');
  for (let index = 1; index < output.rows.length; index += 1) {
    if (output.rows[index - 1].date >= output.rows[index].date) {
      throw new Error(`Output dates are not strictly increasing near ${output.rows[index].date}`);
    }
  }
  for (const row of output.rows) {
    const required = ['marketClose', ...ETF_DEFINITIONS.flatMap((etf) => [etf.closeField, etf.adjustedCloseField])];
    for (const field of required) {
      if (!Number.isFinite(row[field]) || row[field] <= 0) throw new Error(`Invalid ${field} on ${row.date}`);
    }
  }
}

async function generate(options = {}) {
  const market = readMarketData(options.marketPath || MARKET_PATH);
  const availableStart = market.rows[0].date;
  const availableEnd = market.rows.at(-1).date;
  const fromDate = options.fromDate ? normalizeDate(options.fromDate, '--from') : availableStart;
  const toDate = options.toDate ? normalizeDate(options.toDate, '--to') : availableEnd;
  if (fromDate > toDate) throw new Error('--from cannot be after --to');
  const boundedRows = market.rows.filter((row) => row.date >= fromDate && row.date <= toDate);
  if (boundedRows.length < 2) throw new Error('Selected market date range has insufficient trading days');
  const actualFrom = boundedRows[0].date;
  const actualTo = boundedRows.at(-1).date;

  const etfRowsById = {};
  for (const etf of ETF_DEFINITIONS) {
    const url = buildYahooUrl(etf.symbol, actualFrom, actualTo);
    console.log(`Fetching ${etf.id} ${etf.name}: ${actualFrom} - ${actualTo}`);
    const payload = await fetchJson(url, etf.symbol, options.fetchOptions);
    const rows = parseYahooRows(payload).filter((row) => row.date >= actualFrom && row.date <= actualTo);
    if (rows.length < 2) throw new Error(`${etf.symbol} returned insufficient rows`);
    etfRowsById[etf.id] = rows;
  }

  const aligned = alignRows(boundedRows, etfRowsById);
  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    startDate: aligned.rows[0]?.date || null,
    endDate: aligned.rows.at(-1)?.date || null,
    tradingDayCount: aligned.rows.length,
    market: {
      id: 'TAIEX',
      name: '臺灣加權股價指數',
      source: market.payload.sources?.ohlc || 'TWSE MI_5MINS_HIST',
      sourceFile: 'data_twse_market_chart/market_chart.json',
      sourceGeneratedAt: market.payload.generatedAt || null
    },
    etfs: ETF_DEFINITIONS,
    priceBasis: {
      holdingReturn: 'adjustedClose',
      explanation: '持有報酬使用 Yahoo Finance 還原收盤價，納入配息與分割調整；畫面另保留原始收盤價。'
    },
    regimeDefaults: {
      windowDays: 20,
      stepDays: 5,
      strongReturnPct: 5,
      slowReturnPct: 1,
      minTrendR2: 0.45,
      minDirectionalDayRatio: 0.55
    },
    coverage: {
      marketTradingDays: boundedRows.length,
      alignedTradingDays: aligned.rows.length,
      alignedRatePct: round(aligned.rows.length / boundedRows.length * 100, 2),
      missingDates: aligned.missingDates
    },
    sources: {
      etfPrices: 'Yahoo Finance Chart API',
      etfSymbols: Object.fromEntries(ETF_DEFINITIONS.map((etf) => [etf.id, etf.symbol]))
    },
    rows: aligned.rows
  };
  validateOutput(output);

  const outputPath = options.outputPath || OUTPUT_PATH;
  if (fs.existsSync(outputPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      const comparableExisting = { ...existing, generatedAt: null };
      const comparableOutput = { ...output, generatedAt: null };
      if (JSON.stringify(comparableExisting) === JSON.stringify(comparableOutput) && existing.generatedAt) {
        output.generatedAt = existing.generatedAt;
      }
    } catch (error) {
      console.warn(`Existing output could not be reused: ${error.message}`);
    }
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Saved ${path.relative(ROOT, outputPath)} (${output.rows.length} aligned trading days)`);
  return output;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await generate({
    fromDate: args.get('from') || null,
    toDate: args.get('to') || null,
    outputPath: args.get('output') ? path.resolve(args.get('output')) : OUTPUT_PATH,
    fetchOptions: {
      timeoutMs: args.get('timeout') ? Number(args.get('timeout')) : DEFAULT_TIMEOUT_MS,
      retries: args.get('retries') ? Number(args.get('retries')) : DEFAULT_RETRIES
    }
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}

module.exports = {
  ETF_DEFINITIONS,
  parseArgs,
  normalizeDate,
  buildYahooUrl,
  parseYahooRows,
  readMarketData,
  alignRows,
  validateOutput,
  generate
};
