#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getClose } = require('./lib/stock_price_provider');
const { buildRevenueMonthRange } = require('./backfill_mops_monthly_revenue_task');

const ROOT = path.resolve(__dirname, '..');
const SIGNAL_ROOT = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'monthly-signals');
const MARKET_FILE = path.join(ROOT, 'data_twse_market_chart', 'market_chart.json');
const LONG_HORIZONS = [40, 60];

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function pctReturn(start, end) {
  return Number.isFinite(start) && start > 0 && Number.isFinite(end)
    ? Number((((end / start) - 1) * 100).toFixed(4))
    : null;
}
function loadMarketSeries() {
  const payload = readJson(MARKET_FILE, {});
  return (payload.data || [])
    .filter(row => /^20\d{6}$/.test(String(row.date)) && Number.isFinite(Number(row.close)))
    .map(row => ({ date: String(row.date), close: Number(row.close) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
function parseArgs(argv = process.argv.slice(2)) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) args.set(key, true);
    else { args.set(key, next); i += 1; }
  }
  return args;
}
function enrichEvent(event, marketRows) {
  const baseDate = String(event.base_trading_date || '');
  const baseIndex = marketRows.findIndex(row => row.date === baseDate);
  if (baseIndex < 0) {
    for (const horizon of LONG_HORIZONS) {
      event.returns ||= {};
      event.returns[`d${horizon}`] = {
        status: 'missing_market_base', target_trading_date: null,
        stock_return_pct: null, market_return_pct: null, excess_return_pct: null,
        stock_positive: null, outperformed_market: null,
      };
    }
    return;
  }
  const stockCode = String(event.stock_code);
  const stockBase = getClose(stockCode, baseDate, { root: ROOT });
  for (const horizon of LONG_HORIZONS) {
    const target = marketRows[baseIndex + horizon];
    event.returns ||= {};
    if (!target) {
      event.returns[`d${horizon}`] = {
        status: 'pending_market_data', target_trading_date: null,
        stock_return_pct: null, market_return_pct: null, excess_return_pct: null,
        stock_positive: null, outperformed_market: null,
      };
      continue;
    }
    const stockEnd = getClose(stockCode, target.date, { root: ROOT });
    const stockReturn = pctReturn(stockBase, stockEnd);
    const marketReturn = pctReturn(marketRows[baseIndex].close, target.close);
    const excess = Number.isFinite(stockReturn) && Number.isFinite(marketReturn)
      ? Number((stockReturn - marketReturn).toFixed(4)) : null;
    event.returns[`d${horizon}`] = {
      status: Number.isFinite(stockReturn) && Number.isFinite(marketReturn) ? 'complete' : 'missing_stock_price',
      target_trading_date: target.date,
      stock_return_pct: stockReturn,
      market_return_pct: marketReturn,
      excess_return_pct: excess,
      stock_positive: Number.isFinite(stockReturn) ? stockReturn > 0 : null,
      outperformed_market: Number.isFinite(excess) ? excess > 0 : null,
    };
  }
}
function enrichMonth(month, marketRows) {
  const file = path.join(SIGNAL_ROOT, `${month}.json`);
  const payload = readJson(file, null);
  if (!payload || !Array.isArray(payload.events)) throw new Error(`Missing monthly signal detail: ${month}`);
  for (const event of payload.events) enrichEvent(event, marketRows);
  payload.methodology ||= {};
  payload.methodology.long_horizon_extension = 'D40/D60 use the same pre-effective base close, TAIEX benchmark series, and unified stock price provider as D1-D20';
  payload.counts ||= {};
  payload.counts.d40_complete = payload.events.filter(e => e.returns?.d40?.status === 'complete').length;
  payload.counts.d60_complete = payload.events.filter(e => e.returns?.d60?.status === 'complete').length;
  payload.long_horizon_enrichment = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    horizons: ['d40', 'd60'],
    base_rule: 'reuse existing base_trading_date from conservative monthly signal event',
    benchmark: 'TAIEX data_twse_market_chart/market_chart.json',
    stock_price_source: 'scripts/lib/stock_price_provider.js',
  };
  writeJson(file, payload);
  return { month, d40_complete: payload.counts.d40_complete, d60_complete: payload.counts.d60_complete };
}
function main() {
  const args = parseArgs();
  const start = args.get('start-month');
  const end = args.get('end-month');
  if (!/^20\d{4}$/.test(String(start || '')) || !/^20\d{4}$/.test(String(end || ''))) {
    throw new Error('Usage: --start-month YYYYMM --end-month YYYYMM');
  }
  const marketRows = loadMarketSeries();
  if (!marketRows.length) throw new Error('Missing TAIEX market history');
  const months = buildRevenueMonthRange(start, end, { maxMonths: 36 });
  const rows = months.map(month => enrichMonth(month, marketRows));
  console.log(JSON.stringify({ start_month: start, end_month: end, months: rows.length, rows }, null, 2));
}
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
module.exports = { LONG_HORIZONS, enrichEvent, enrichMonth, pctReturn };
