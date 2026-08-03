#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MARKET_PATH = path.join(ROOT, 'data_twse_market_chart', 'market_chart.json');
const OUTPUT_PATH = path.join(ROOT, 'public', 'data', 'etf-market-regime-analysis', 'data.json');
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_RETRIES = 3;
const LOCAL_SMA_DIR = path.join(ROOT, 'data_fubon');

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

function inferSplitFactor(previousClose, currentClose) {
  if (!(previousClose > 0) || !(currentClose > 0)) return null;
  const ratio = currentClose / previousClose;
  if (ratio < 0.4) {
    const factor = Math.round(1 / ratio);
    if (factor >= 2 && factor <= 20 && Math.abs(ratio - 1 / factor) <= 0.035) {
      return { type: 'forward', factor };
    }
  }
  if (ratio > 2.5) {
    const factor = Math.round(ratio);
    if (factor >= 3 && factor <= 20 && Math.abs(ratio - factor) <= 0.2) {
      return { type: 'reverse', factor };
    }
  }
  return null;
}

function backAdjustSplitRows(rows) {
  const sorted = [...rows].sort((left, right) => left.date.localeCompare(right.date));
  const adjusted = sorted.map((row) => ({ ...row }));
  const splitAdjustments = [];
  let multiplier = 1;
  for (let index = adjusted.length - 1; index >= 0; index -= 1) {
    adjusted[index].adjustedClose = round(adjusted[index].close * multiplier);
    if (index === 0) continue;
    const split = inferSplitFactor(adjusted[index - 1].close, adjusted[index].close);
    if (!split) continue;
    splitAdjustments.push({
      date: adjusted[index].date,
      type: split.type,
      factor: split.factor,
      previousClose: adjusted[index - 1].close,
      currentClose: adjusted[index].close
    });
    if (split.type === 'forward') multiplier /= split.factor;
    else multiplier *= split.factor;
  }
  return { rows: adjusted, splitAdjustments: splitAdjustments.reverse() };
}

function localDateKey(compact) {
  return `${compact.slice(0, 4)}/${compact.slice(4, 6)}/${compact.slice(6, 8)}`;
}

function parseLocalSmaPayload(payload, date, etfs = ETF_DEFINITIONS) {
  const result = {};
  for (const etf of etfs) {
    const stock = payload?.[etf.id];
    if (!stock || typeof stock !== 'object') continue;
    const expectedKey = localDateKey(date);
    const key = stock[expectedKey]
      ? expectedKey
      : Object.keys(stock).find((value) => /^20\d{2}\/\d{2}\/\d{2}$/.test(value));
    const row = key ? stock[key] : null;
    const close = Number(String(row?.Price ?? row?.Close ?? row?.close ?? '').replaceAll(',', ''));
    if (!Number.isFinite(close) || close <= 0) continue;
    const parseOptional = (value) => {
      const text = String(value ?? '').replaceAll(',', '').trim();
      if (!text) return null;
      const number = Number(text);
      return Number.isFinite(number) ? round(number) : null;
    };
    result[etf.id] = {
      date,
      open: parseOptional(row?.Open ?? row?.open) ?? close,
      high: parseOptional(row?.High ?? row?.high) ?? close,
      low: parseOptional(row?.Low ?? row?.low) ?? close,
      close: round(close),
      adjustedClose: round(close),
      volume: parseOptional(row?.Volume ?? row?.volume)
    };
  }
  return result;
}

function loadLocalEtfSeries(options = {}) {
  const root = options.root || ROOT;
  const directory = options.directory || (root === ROOT ? LOCAL_SMA_DIR : path.join(root, 'data_fubon'));
  const fromDate = options.fromDate || '00000000';
  const toDate = options.toDate || '99999999';
  const etfs = options.etfs || ETF_DEFINITIONS;
  const raw = Object.fromEntries(etfs.map((etf) => [etf.id, []]));
  if (!fs.existsSync(directory)) {
    return { rowsById: raw, splitAdjustmentsById: Object.fromEntries(etfs.map((etf) => [etf.id, []])), filesRead: 0 };
  }
  const files = fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const match = entry.name.match(/^fubon_(20\d{6})_sma\.json$/);
      return match ? { name: entry.name, date: match[1] } : null;
    })
    .filter((item) => item && item.date >= fromDate && item.date <= toDate)
    .sort((left, right) => left.date.localeCompare(right.date));
  let filesRead = 0;
  for (const item of files) {
    try {
      const text = fs.readFileSync(path.join(directory, item.name), 'utf8');
      if (!text.trim()) continue;
      const parsed = parseLocalSmaPayload(JSON.parse(text), item.date, etfs);
      for (const etf of etfs) if (parsed[etf.id]) raw[etf.id].push(parsed[etf.id]);
      filesRead += 1;
    } catch (error) {
      console.warn(`Local SMA fallback skipped ${item.name}: ${error.message}`);
    }
  }
  const rowsById = {};
  const splitAdjustmentsById = {};
  for (const etf of etfs) {
    const adjusted = backAdjustSplitRows(raw[etf.id]);
    rowsById[etf.id] = adjusted.rows;
    splitAdjustmentsById[etf.id] = adjusted.splitAdjustments;
  }
  return { rowsById, splitAdjustmentsById, filesRead };
}

function fillYahooGapsWithLocal(yahooRows, localRows) {
  const yahoo = [...(yahooRows || [])].sort((left, right) => left.date.localeCompare(right.date));
  const local = [...(localRows || [])].sort((left, right) => left.date.localeCompare(right.date));
  const byDate = new Map(yahoo.map((row) => [row.date, { ...row }]));
  let filledCount = 0;
  for (const row of local) {
    if (byDate.has(row.date)) continue;
    let nearest = null;
    let nearestDistance = Infinity;
    const targetTime = new Date(`${compactToIso(row.date)}T00:00:00Z`).getTime();
    for (const candidate of yahoo) {
      if (!(candidate.close > 0) || !(candidate.adjustedClose > 0)) continue;
      const distance = Math.abs(new Date(`${compactToIso(candidate.date)}T00:00:00Z`).getTime() - targetTime);
      if (distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    }
    const adjustmentRatio = nearest ? nearest.adjustedClose / nearest.close : null;
    byDate.set(row.date, {
      ...row,
      adjustedClose: Number.isFinite(adjustmentRatio) && adjustmentRatio > 0
        ? round(row.close * adjustmentRatio)
        : row.adjustedClose
    });
    filledCount += 1;
  }
  return {
    rows: [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date)),
    filledCount
  };
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

  const local = loadLocalEtfSeries({
    root: options.root || ROOT,
    directory: options.localSmaDirectory,
    fromDate: actualFrom,
    toDate: actualTo
  });
  const etfRowsById = {};
  const etfPriceDetails = {};
  for (const etf of ETF_DEFINITIONS) {
    let rows = [];
    let source = null;
    let errorMessage = null;
    let localGapFillCount = 0;
    try {
      const url = buildYahooUrl(etf.symbol, actualFrom, actualTo);
      console.log(`Fetching ${etf.id} ${etf.name}: ${actualFrom} - ${actualTo}`);
      const payload = await fetchJson(url, etf.symbol, options.fetchOptions);
      const yahooRows = parseYahooRows(payload).filter((row) => row.date >= actualFrom && row.date <= actualTo);
      const merged = fillYahooGapsWithLocal(yahooRows, local.rowsById[etf.id] || []);
      rows = merged.rows;
      localGapFillCount = merged.filledCount;
      if (rows.length < 2) throw new Error(`Yahoo and local combined coverage too low: ${rows.length}/${boundedRows.length}`);
      source = merged.filledCount > 0
        ? 'yahoo_finance_adjusted_close_with_local_gap_fill'
        : 'yahoo_finance_adjusted_close';
    } catch (error) {
      errorMessage = error.message;
      rows = local.rowsById[etf.id] || [];
      if (rows.length < 2) throw new Error(`${etf.id} has no usable Yahoo or local SMA history: ${error.message}`);
      source = 'local_fubon_sma_split_adjusted_close';
      console.warn(`${etf.id} uses local SMA fallback: ${error.message}`);
    }
    etfRowsById[etf.id] = rows;
    etfPriceDetails[etf.id] = {
      source,
      rowCount: rows.length,
      yahooError: errorMessage,
      localGapFillCount,
      splitAdjustments: source === 'local_fubon_sma_split_adjusted_close'
        ? local.splitAdjustmentsById[etf.id]
        : []
    };
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
      explanation: 'Yahoo 可用時採還原收盤價（含配息與分割調整）；Yahoo 不可用時改用專案既有富邦 SMA 日價並自動回溯調整分割，該備援不含現金配息。'
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
      etfPrices: 'Yahoo Finance Chart API with local data_fubon SMA fallback',
      etfSymbols: Object.fromEntries(ETF_DEFINITIONS.map((etf) => [etf.id, etf.symbol])),
      localSmaFilesRead: local.filesRead,
      etfPriceDetails
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
  inferSplitFactor,
  backAdjustSplitRows,
  parseLocalSmaPayload,
  loadLocalEtfSeries,
  fillYahooGapsWithLocal,
  readMarketData,
  alignRows,
  validateOutput,
  generate
};
