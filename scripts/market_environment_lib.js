#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const PRIMARY_IDS = ['nasdaq', 'sp500', 'dow', 'sox', 'tsm_adr'];

function parseArgs(argv = process.argv.slice(2)) {
  const out = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) out.set(key, true);
    else {
      out.set(key, next);
      index += 1;
    }
  }
  return out;
}

function compactDate(value, label = 'date') {
  const text = String(value || '').replace(/[^0-9]/g, '');
  if (!/^20\d{6}$/.test(text)) throw new Error(`Invalid ${label}: ${value}`);
  return text;
}

function compactToIso(value) {
  const date = compactDate(value);
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

function addDays(value, delta) {
  const date = new Date(`${compactToIso(value)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

function weekdayAtOrBefore(value) {
  let date = compactDate(value);
  while ([0, 6].includes(new Date(`${compactToIso(date)}T00:00:00Z`).getUTCDay())) date = addDays(date, -1);
  return date;
}

function businessDayDistance(later, earlier, limit = 10) {
  let cursor = compactDate(later);
  const target = compactDate(earlier);
  let distance = 0;
  for (let guard = 0; guard < limit + 10 && cursor > target; guard += 1) {
    cursor = addDays(cursor, -1);
    const day = new Date(`${compactToIso(cursor)}T00:00:00Z`).getUTCDay();
    if (![0, 6].includes(day)) distance += 1;
  }
  return cursor === target ? distance : Infinity;
}

function readJson(file, fallback = null) {
  try {
    const text = fs.readFileSync(file, 'utf8').trim();
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

function atomicWriteJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

function round(value, digits = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
}

function pctChange(current, previous) {
  const a = Number(current);
  const b = Number(previous);
  return Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? (a / b - 1) * 100 : null;
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function listDateDirectories(rootDir, maxDate = '99999999') {
  if (!fs.existsSync(rootDir)) return [];
  return fs.readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^20\d{6}$/.test(entry.name) && entry.name <= maxDate)
    .map((entry) => entry.name)
    .sort();
}

function latestDatedFileInDirectories(rootDir, maxDate, filename) {
  const dates = listDateDirectories(rootDir, maxDate).reverse();
  for (const date of dates) {
    const file = path.join(rootDir, date, filename);
    if (fs.existsSync(file) && fs.statSync(file).size > 0) return { date, file, payload: readJson(file) };
  }
  return null;
}

function listFlatDateFiles(rootDir, maxDate, suffix) {
  if (!fs.existsSync(rootDir)) return [];
  return fs.readdirSync(rootDir)
    .map((name) => {
      const match = name.match(/^(20\d{6})/);
      return match && match[1] <= maxDate && name.endsWith(suffix)
        ? { date: match[1], name, file: path.join(rootDir, name) }
        : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.date.localeCompare(right.date));
}

function primaryExternalValidation(external, expectedDate = null) {
  const indicators = Array.isArray(external?.indicators) ? external.indicators : [];
  const byId = new Map(indicators.map((item) => [item.id, item]));
  const primary = PRIMARY_IDS.map((id) => byId.get(id)).filter(Boolean);
  const dates = primary.map((item) => String(item.market_date || ''));
  const uniqueDates = [...new Set(dates.filter((date) => /^20\d{6}$/.test(date)))];
  const actualDate = uniqueDates.length === 1 ? uniqueDates[0] : null;
  const collectionDate = String(external?.collection_date || actualDate || '');
  const errors = Array.isArray(external?.errors) ? external.errors : [];
  const complete = primary.length === PRIMARY_IDS.length && uniqueDates.length === 1 && errors.length === 0;
  const exact = complete && (!expectedDate || actualDate === expectedDate) && collectionDate === actualDate;
  return {
    complete,
    exact,
    expected_date: expectedDate,
    actual_date: actualDate,
    collection_date: collectionDate || null,
    primary_indicator_agreement: `${primary.length}/${PRIMARY_IDS.length}`,
    primary_market_dates: Object.fromEntries(PRIMARY_IDS.map((id) => [id, byId.get(id)?.market_date || null])),
    error_count: errors.length,
    errors,
  };
}

function indicatorById(external, id) {
  return (external?.indicators || []).find((item) => item.id === id) || null;
}

function trailingReturn(indicator, sessions = 3) {
  const rows = Array.isArray(indicator?.rows) ? indicator.rows.filter((row) => Number.isFinite(Number(row.close))) : [];
  if (rows.length < sessions + 1) return null;
  const latest = rows.at(-1);
  const base = rows.at(-(sessions + 1));
  return pctChange(latest.close, base.close);
}

function extractTwseIndex(payload) {
  const direct = payload?.data || payload;
  let close = Number(direct?.close ?? direct?.Close ?? direct?.index_close);
  let changePercent = Number(direct?.change_percent ?? direct?.changePercent ?? direct?.ChangePercent);
  let name = direct?.index_name || direct?.name || '發行量加權股價指數';
  if (!Number.isFinite(close) && Array.isArray(payload?.tables)) {
    for (const table of payload.tables) {
      const fields = table.fields || [];
      const nameIndex = fields.findIndex((field) => /指數/.test(field));
      const closeIndex = fields.findIndex((field) => /收盤指數/.test(field));
      const pctIndex = fields.findIndex((field) => /漲跌百分比/.test(field));
      const row = (table.data || []).find((item) => String(item[nameIndex] || '').includes('發行量加權股價指數'));
      if (!row) continue;
      close = Number(String(row[closeIndex]).replaceAll(',', ''));
      changePercent = Number(String(row[pctIndex]).replaceAll(',', ''));
      name = row[nameIndex];
      break;
    }
  }
  return {
    close: Number.isFinite(close) ? close : null,
    change_percent: Number.isFinite(changePercent) ? changePercent : null,
    index_name: name,
  };
}

function loadTwseHistory(maxDate) {
  const rootDir = path.join(ROOT, 'data_twse_mi_index');
  return listFlatDateFiles(rootDir, maxDate, '_twse_mi_index.json')
    .map((entry) => ({ ...entry, ...extractTwseIndex(readJson(entry.file, {})) }))
    .filter((entry) => Number.isFinite(entry.close));
}

function extractForeignFutures(payload) {
  const summary = payload?.summary?.taiwanStockIndexFuturesForeignOpenInterest;
  if (summary && Number.isFinite(Number(summary.netContracts))) {
    return {
      long_contracts: Number(summary.longContracts),
      short_contracts: Number(summary.shortContracts),
      net_contracts: Number(summary.netContracts),
    };
  }
  const row = (payload?.rows || []).find((item) => item.productName === '臺股期貨' && /^外資/.test(String(item.investorType || '')));
  if (!row) return null;
  return {
    long_contracts: Number(row.openInterest?.long?.contracts),
    short_contracts: Number(row.openInterest?.short?.contracts),
    net_contracts: Number(row.openInterest?.net?.contracts),
  };
}

function loadFuturesHistory(maxDate) {
  const rootDir = path.join(ROOT, 'data_taifex_major_institutional_traders_futures_contracts');
  return listFlatDateFiles(rootDir, maxDate, '_taifex_major_institutional_traders_futures_contracts.json')
    .map((entry) => ({ ...entry, ...extractForeignFutures(readJson(entry.file, {})) }))
    .filter((entry) => Number.isFinite(entry.net_contracts));
}

function environmentOutputDir(date) {
  return path.join(ROOT, 'data_market_environment', compactDate(date));
}

function refreshEnvironmentIndexes(generatedAt = new Date().toISOString()) {
  const rootDir = path.join(ROOT, 'data_market_environment');
  fs.mkdirSync(rootDir, { recursive: true });
  const dates = listDateDirectories(rootDir);
  const files = [];
  for (const date of dates) {
    for (const filename of ['market_environment.json', 'actual_market_environment.json']) {
      if (fs.existsSync(path.join(rootDir, date, filename))) files.push(`${date}/${filename}`);
    }
  }
  atomicWriteJson(path.join(rootDir, 'files.json'), files);
  const latestForecast = [...dates].reverse().find((date) => fs.existsSync(path.join(rootDir, date, 'market_environment.json'))) || null;
  const latestActual = [...dates].reverse().find((date) => fs.existsSync(path.join(rootDir, date, 'actual_market_environment.json'))) || null;
  atomicWriteJson(path.join(rootDir, 'manifest.json'), {
    schemaVersion: 1,
    generated_at: generatedAt,
    latest_date: latestForecast,
    latest_file: latestForecast ? `data_market_environment/${latestForecast}/market_environment.json` : null,
    latest_actual_date: latestActual,
    latest_actual_file: latestActual ? `data_market_environment/${latestActual}/actual_market_environment.json` : null,
    available_dates: dates,
  });
}

function latestActualEnvironment(maxDate) {
  return latestDatedFileInDirectories(
    path.join(ROOT, 'data_market_environment'),
    maxDate,
    'actual_market_environment.json',
  );
}

module.exports = {
  ROOT,
  PRIMARY_IDS,
  parseArgs,
  compactDate,
  compactToIso,
  addDays,
  weekdayAtOrBefore,
  businessDayDistance,
  readJson,
  atomicWriteJson,
  round,
  pctChange,
  sha256,
  listDateDirectories,
  latestDatedFileInDirectories,
  listFlatDateFiles,
  primaryExternalValidation,
  indicatorById,
  trailingReturn,
  loadTwseHistory,
  loadFuturesHistory,
  environmentOutputDir,
  refreshEnvironmentIndexes,
  latestActualEnvironment,
};
