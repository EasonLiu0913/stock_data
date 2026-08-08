#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MARKET_FILE = path.join(ROOT, 'data_twse_market_chart', 'market_chart.json');
const OUTPUT_DIR = path.join(ROOT, 'data_twse_mi_index');

function parseArgs(argv) {
  const result = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) result.set(key, true);
    else { result.set(key, next); i += 1; }
  }
  return result;
}

function normalizeDate(value, label) {
  const compact = String(value || '').replace(/[^\d]/g, '');
  if (!/^20\d{6}$/.test(compact)) throw new Error(`${label} must use YYYYMMDD`);
  return compact;
}

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function findQuoteTable(payload) {
  return (payload?.tables || []).find(table => {
    const fields = table?.fields || [];
    return fields.includes('證券代號')
      && fields.includes('開盤價')
      && fields.includes('最高價')
      && fields.includes('最低價')
      && fields.includes('收盤價');
  }) || null;
}

function validateMiIndexFile(file, date) {
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) return ['missing_or_empty'];
  const payload = readJson(file, null);
  if (!payload) return ['invalid_json'];
  const errors = [];
  if (payload.stat !== 'OK') errors.push('stat_not_ok');
  if (String(payload.date || '') !== date) errors.push('date_mismatch');
  const table = findQuoteTable(payload);
  if (!table) errors.push('quote_table_missing');
  else if (!Array.isArray(table.data) || table.data.length < 100) errors.push('quote_rows_too_low');
  return errors;
}

function validCoverageDate(value) {
  const compact = String(value || '').replace(/[^\d]/g, '');
  return /^20\d{6}$/.test(compact) ? compact : '';
}

function loadTradingDates(start, end, marketFile = MARKET_FILE) {
  const payload = readJson(marketFile, null);
  if (!payload || !Array.isArray(payload.data)) throw new Error(`Missing market chart: ${marketFile}`);
  const allDates = payload.data
    .map(row => String(row?.date || ''))
    .filter(date => /^20\d{6}$/.test(date))
    .sort();
  if (!allDates.length) throw new Error(`No TAIEX trading dates found in ${marketFile}`);

  const firstTradingDate = allDates[0];
  const lastTradingDate = allDates.at(-1);
  // market_chart.startDate records the requested coverage boundary and may itself be
  // a holiday/weekend (for example 2024-01-01). The first data row is necessarily
  // the first trading day on or after that boundary, so use startDate when present
  // instead of incorrectly treating a non-trading requested start as truncation.
  const coverageStart = validCoverageDate(payload.startDate) || firstTradingDate;
  const coverageEnd = validCoverageDate(payload.endDate) || lastTradingDate;

  if (start < coverageStart) {
    throw new Error(
      `TAIEX trading calendar is truncated: requested start ${start}, but market chart coverage starts at ${coverageStart} `
      + `(first trading date ${firstTradingDate}). Backfill [03 市場環境] Build TWSE Market Chart first.`
    );
  }
  if (end > coverageEnd) {
    throw new Error(
      `TAIEX trading calendar does not reach requested end ${end}; coverage ends at ${coverageEnd} `
      + `(latest trading date ${lastTradingDate}).`
    );
  }

  const dates = allDates.filter(date => date >= start && date <= end);
  if (!dates.length) throw new Error(`No TAIEX trading dates found in ${start}-${end}`);
  return dates;
}

function buildPlan({ start, end, batchSize = 20, force = false, outputDir = OUTPUT_DIR, marketFile = MARKET_FILE }) {
  const normalizedStart = normalizeDate(start, 'start');
  const normalizedEnd = normalizeDate(end, 'end');
  if (normalizedStart > normalizedEnd) throw new Error('start must be <= end');
  const dates = loadTradingDates(normalizedStart, normalizedEnd, marketFile);
  const pending = [];
  const valid = [];
  for (const date of dates) {
    const file = path.join(outputDir, `${date}_twse_mi_index.json`);
    const errors = force ? ['forced'] : validateMiIndexFile(file, date);
    if (errors.length) pending.push({ date, errors }); else valid.push(date);
  }
  const size = Number(batchSize);
  if (!Number.isInteger(size) || size <= 0 || size > 60) throw new Error('batch-size must be 1-60');
  const include = [];
  for (let offset = 0; offset < pending.length; offset += size) {
    const datesInBatch = pending.slice(offset, offset + size).map(item => item.date);
    include.push({
      batch_index: include.length + 1,
      start_date: datesInBatch[0],
      end_date: datesInBatch.at(-1),
      dates: datesInBatch.join(','),
      count: datesInBatch.length,
    });
  }
  return {
    dataset: 'twse_mi_index',
    start: normalizedStart,
    end: normalizedEnd,
    trading_date_count: dates.length,
    valid_date_count: valid.length,
    pending_date_count: pending.length,
    pending,
    batch_count: include.length,
    matrix: { include },
  };
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const plan = buildPlan({
    start: args.get('start'),
    end: args.get('end'),
    batchSize: Number(args.get('batch-size') || 20),
    force: args.has('force'),
  });
  process.stdout.write(`${JSON.stringify(plan)}\n`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { buildPlan, findQuoteTable, loadTradingDates, validateMiIndexFile, validCoverageDate };
