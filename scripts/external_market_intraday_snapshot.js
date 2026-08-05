#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'external_market_indicators.json');
const NEW_YORK_TIME_ZONE = 'America/New_York';
const PRIMARY_IDS = new Set(['nasdaq', 'sp500', 'dow', 'sox', 'tsm_adr']);
const USER_AGENT = 'Mozilla/5.0 (compatible; stock-external-intraday/1.0)';

function compactDate(value) {
  const compact = String(value || '').replace(/[^0-9]/g, '');
  return /^20\d{6}$/.test(compact) ? compact : '';
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 4) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function zonedCompactDate(timestampMs, timeZone = NEW_YORK_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(timestampMs));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}`;
}

function zonedIso(timestampMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(timestampMs));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;
}

async function fetchJson(url, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json,*/*', 'user-agent': USER_AGENT },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

function chartUrl(symbol, { interval, range, includePrePost = false }) {
  const params = new URLSearchParams({ interval, range, events: 'history', includeAdjustedClose: 'true' });
  if (includePrePost) params.set('includePrePost', 'true');
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params}`;
}

function parseChartRows(payload, interval) {
  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  const adjclose = result?.indicators?.adjclose?.[0]?.adjclose || [];
  const rows = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const close = finiteNumber(quote.close?.[index] ?? adjclose[index]);
    if (close === null) continue;
    const timestamp = Number(timestamps[index]) * 1000;
    rows.push({
      timestamp,
      date: zonedCompactDate(timestamp),
      open: round(finiteNumber(quote.open?.[index])),
      high: round(finiteNumber(quote.high?.[index])),
      low: round(finiteNumber(quote.low?.[index])),
      close: round(close),
      volume: finiteNumber(quote.volume?.[index]),
      interval,
    });
  }
  return { result, rows: rows.sort((left, right) => left.timestamp - right.timestamp) };
}

function marketStatus(meta, nowSeconds = Math.floor(Date.now() / 1000)) {
  const periods = meta?.currentTradingPeriod || {};
  for (const [name, period] of Object.entries(periods)) {
    if (Number(period?.start) <= nowSeconds && nowSeconds <= Number(period?.end)) return name;
  }
  const regular = periods.regular;
  if (regular && nowSeconds < Number(regular.start)) return 'pre_open';
  if (regular && nowSeconds > Number(regular.end)) return 'closed';
  return String(meta?.marketState || 'unknown').toLowerCase();
}

function buildIndicatorSnapshot(indicator, intradayPayload, dailyPayload, observedAt = new Date()) {
  const intraday = parseChartRows(intradayPayload, '1m');
  const daily = parseChartRows(dailyPayload, '1d');
  const latest = intraday.rows.at(-1) || null;
  const meta = intraday.result?.meta || daily.result?.meta || {};
  const lastPrice = latest?.close ?? finiteNumber(meta.regularMarketPrice);
  const quoteTimestampMs = latest?.timestamp ?? (finiteNumber(meta.regularMarketTime) !== null ? Number(meta.regularMarketTime) * 1000 : null);
  const marketDate = quoteTimestampMs ? zonedCompactDate(quoteTimestampMs) : null;
  const previousClose = finiteNumber(meta.chartPreviousClose ?? meta.previousClose)
    ?? daily.rows.filter((row) => row.date < marketDate).at(-1)?.close
    ?? null;
  const change = lastPrice !== null && previousClose !== null ? lastPrice - previousClose : null;
  const changePercent = change !== null && previousClose !== 0 ? change / previousClose * 100 : null;
  const currentDayRows = marketDate ? intraday.rows.filter((row) => row.date === marketDate) : [];
  const open = currentDayRows[0]?.open ?? latest?.open ?? null;
  const high = currentDayRows.length ? Math.max(...currentDayRows.map((row) => row.high).filter(Number.isFinite)) : latest?.high ?? null;
  const low = currentDayRows.length ? Math.min(...currentDayRows.map((row) => row.low).filter(Number.isFinite)) : latest?.low ?? null;
  const volume = currentDayRows.reduce((sum, row) => sum + (row.volume ?? 0), 0) || latest?.volume || null;
  const historyRows = daily.rows.filter((row) => !marketDate || row.date < marketDate).slice(-20).map((row) => ({
    date: row.date,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
  }));
  if (marketDate && lastPrice !== null) {
    historyRows.push({ date: marketDate, open, high, low, close: lastPrice, volume, snapshot: true });
  }
  return {
    ...indicator,
    source: 'yahoo_finance_chart_intraday',
    market_date: marketDate,
    observed_at: observedAt.toISOString(),
    quote_timestamp: quoteTimestampMs ? new Date(quoteTimestampMs).toISOString() : null,
    market_status: marketStatus(meta, Math.floor(observedAt.getTime() / 1000)),
    is_final: false,
    last_price: round(lastPrice),
    open: round(open),
    high: round(high),
    low: round(low),
    close: round(lastPrice),
    previous_close: round(previousClose),
    change: round(change),
    change_percent: round(changePercent),
    volume,
    currency: meta.currency || null,
    exchange_timezone: meta.exchangeTimezoneName || null,
    rows: historyRows,
  };
}

async function crawlIndicator(indicator, observedAt) {
  const [intradayPayload, dailyPayload] = await Promise.all([
    fetchJson(chartUrl(indicator.symbol, { interval: '1m', range: '5d', includePrePost: true })),
    fetchJson(chartUrl(indicator.symbol, { interval: '1d', range: '1mo' })),
  ]);
  return buildIndicatorSnapshot(indicator, intradayPayload, dailyPayload, observedAt);
}

async function captureExternalMarketSnapshot({ expectedMarketDate = '', observedAt = new Date() } = {}) {
  const expected = compactDate(expectedMarketDate);
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const indicators = [];
  const errors = [];
  for (const indicator of config.indicators || []) {
    try {
      indicators.push(await crawlIndicator(indicator, observedAt));
    } catch (error) {
      errors.push({ id: indicator.id, symbol: indicator.symbol, error: error.message });
    }
  }
  const primary = indicators.filter((item) => PRIMARY_IDS.has(item.id));
  const primaryReady = primary.length === PRIMARY_IDS.size
    && primary.every((item) => item.market_date && (!expected || item.market_date === expected) && item.last_price !== null);
  const marketDates = Object.fromEntries(primary.map((item) => [item.id, item.market_date]));
  return {
    schemaVersion: 3,
    snapshot_type: 'prediction_intraday',
    generated_at: observedAt.toISOString(),
    observed_at: observedAt.toISOString(),
    observed_at_new_york: `${zonedIso(observedAt.getTime(), NEW_YORK_TIME_ZONE)} America/New_York`,
    expected_market_date: expected || null,
    collection_date: expected || primary.map((item) => item.market_date).filter(Boolean).sort().at(-1) || null,
    primary_ready: primaryReady,
    primary_indicator_agreement: `${primary.filter((item) => !expected || item.market_date === expected).length}/${PRIMARY_IDS.size}`,
    primary_market_dates: marketDates,
    indicator_count: indicators.length,
    error_count: errors.length,
    indicators,
    errors,
    source_config: path.relative(ROOT, CONFIG_PATH).replaceAll(path.sep, '/'),
    notes: [
      '此檔為預測產生當下的盤中快照，不是收盤後日資料。',
      'close 欄位在此檔代表 observed_at 當下的最新可用價格。',
      '高低價與成交量皆為截至 observed_at 的累計值。',
    ],
  };
}

function parseArgs(argv) {
  const options = { expectedMarketDate: '', output: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--expected-market-date') options.expectedMarketDate = argv[++index] || '';
    else if (arg === '--output') options.output = argv[++index] || '';
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = await captureExternalMarketSnapshot(options);
  if (options.output) {
    const output = path.resolve(ROOT, options.output);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify(result));
  return result;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error: ${error.stack || error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  PRIMARY_IDS,
  compactDate,
  finiteNumber,
  round,
  zonedCompactDate,
  parseChartRows,
  marketStatus,
  buildIndicatorSnapshot,
  captureExternalMarketSnapshot,
  main,
};
