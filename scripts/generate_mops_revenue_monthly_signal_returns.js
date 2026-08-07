#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REVENUE_ROOT = path.join(ROOT, 'data_mops_monthly_revenue');
const OUTPUT_ROOT = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'monthly-signals');
const MARKET_FILE = path.join(ROOT, 'data_twse_market_chart', 'market_chart.json');
const HORIZONS = [1, 3, 5, 10, 20];

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function nextMonth(month) {
  let y = Number(month.slice(0, 4));
  let m = Number(month.slice(4, 6)) + 1;
  if (m === 13) { y += 1; m = 1; }
  return `${y}${String(m).padStart(2, '0')}`;
}
function conservativeAvailabilityDate(revenueMonth) {
  return `${nextMonth(revenueMonth)}15`;
}
function loadMarketSeries() {
  const payload = readJson(MARKET_FILE, {});
  return (payload.data || [])
    .filter(row => /^20\d{6}$/.test(String(row.date)) && Number.isFinite(Number(row.close)))
    .map(row => ({ date: String(row.date), close: Number(row.close) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
function loadFubonClose(stockCode, date) {
  const file = path.join(ROOT, 'data_fubon', `fubon_${date}_sma.json`);
  const payload = readJson(file, null);
  const item = payload?.[stockCode];
  if (!item || typeof item !== 'object') return null;
  const keys = [
    date,
    `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
    `${date.slice(0, 4)}/${date.slice(4, 6)}/${date.slice(6, 8)}`,
  ];
  const raw = keys.map(key => item[key]).find(Boolean);
  const close = Number(raw?.Price ?? raw?.Close);
  return Number.isFinite(close) && close > 0 ? close : null;
}
function buildTradingWindow(marketRows, availabilityDate) {
  const baseIndex = marketRows.map(row => row.date).findLastIndex(date => date <= availabilityDate);
  const effectiveIndex = baseIndex + 1;
  if (baseIndex < 0 || effectiveIndex >= marketRows.length) return null;
  return { baseIndex, effectiveIndex, base: marketRows[baseIndex], effective: marketRows[effectiveIndex] };
}
function pctReturn(start, end) {
  return Number.isFinite(start) && start > 0 && Number.isFinite(end)
    ? Number((((end / start) - 1) * 100).toFixed(4))
    : null;
}
function calculateReturns(stockCode, marketRows, availabilityDate) {
  const window = buildTradingWindow(marketRows, availabilityDate);
  if (!window) return { effective_trading_date: null, base_trading_date: null, returns: {} };
  const stockBase = loadFubonClose(stockCode, window.base.date);
  const returns = {};
  for (const horizon of HORIZONS) {
    const target = marketRows[window.baseIndex + horizon];
    if (!target) {
      returns[`d${horizon}`] = { status: 'pending_market_data', target_trading_date: null, stock_return_pct: null, market_return_pct: null, excess_return_pct: null, stock_positive: null, outperformed_market: null };
      continue;
    }
    const stockEnd = loadFubonClose(stockCode, target.date);
    const stockReturn = pctReturn(stockBase, stockEnd);
    const marketReturn = pctReturn(window.base.close, target.close);
    const excess = Number.isFinite(stockReturn) && Number.isFinite(marketReturn) ? Number((stockReturn - marketReturn).toFixed(4)) : null;
    returns[`d${horizon}`] = {
      status: Number.isFinite(stockReturn) && Number.isFinite(marketReturn) ? 'complete' : 'missing_stock_price',
      target_trading_date: target.date,
      stock_return_pct: stockReturn,
      market_return_pct: marketReturn,
      excess_return_pct: excess,
      stock_positive: Number.isFinite(stockReturn) ? stockReturn > 0 : null,
      outperformed_market: Number.isFinite(excess) ? excess > 0 : null,
    };
  }
  return { effective_trading_date: window.effective.date, base_trading_date: window.base.date, returns };
}
function buildEvent(row, revenueMonth, marketRows) {
  const availabilityDate = conservativeAvailabilityDate(revenueMonth);
  return {
    stock_code: row.stock_code,
    stock_name: row.stock_name,
    industry: row.industry || null,
    revenue_month: revenueMonth,
    availability_rule: 'conservative_month_complete',
    conservative_availability_date: availabilityDate,
    factors: {
      mom_pct: row.mom_pct,
      yoy_pct: row.yoy_pct,
      ytd_yoy_pct: row.ytd_yoy_pct,
      previous_month_yoy_pct: row.derived?.previous_month_yoy_pct ?? null,
      yoy_acceleration_pct_points: row.derived?.yoy_acceleration_pct_points ?? null,
      yoy_accelerating: row.derived?.yoy_accelerating ?? null,
      yoy_and_mom_positive: row.derived?.yoy_and_mom_positive ?? null,
    },
    benchmark: { code: 'TAIEX', source: 'data_twse_market_chart/market_chart.json' },
    ...calculateReturns(row.stock_code, marketRows, availabilityDate),
  };
}
function generateMonth(revenueMonth) {
  const sourceFile = path.join(REVENUE_ROOT, revenueMonth, 'monthly_revenue.json');
  const source = readJson(sourceFile, null);
  if (!source) throw new Error(`Missing MOPS revenue file: ${sourceFile}`);
  const marketRows = loadMarketSeries();
  const events = (source.companies || []).map(row => buildEvent(row, revenueMonth, marketRows));
  const payload = {
    schema_version: 1,
    dataset: 'mops_monthly_revenue_conservative_signal_returns',
    revenue_month: revenueMonth,
    generated_at: new Date().toISOString(),
    benchmark: { code: 'TAIEX', source: 'TWSE MI_5MINS_HIST via data_twse_market_chart/market_chart.json' },
    methodology: {
      purpose: 'historical factor study when company-level original filing timestamps are unavailable',
      availability_rule: 'treat the monthly revenue dataset as usable only after calendar day 15 of the following month',
      effective_trade_rule: 'start evaluation from the first TAIEX trading day after that conservative availability date',
      return_rule: 'D1/D3/D5/D10/D20 compare target close with the close immediately before the effective trading day',
      interpretation_warning: 'this is not a filing-day event study and must not be interpreted as immediate market reaction to an individual company filing',
    },
    counts: {
      total: events.length,
      with_effective_trading_date: events.filter(e => e.effective_trading_date).length,
      d20_complete: events.filter(e => e.returns?.d20?.status === 'complete').length,
    },
    events,
  };
  const output = path.join(OUTPUT_ROOT, `${revenueMonth}.json`);
  writeJson(output, payload);
  return { output: path.relative(ROOT, output), counts: payload.counts };
}
function main() {
  const arg = process.argv.find(v => /^--month=20\d{4}$/.test(v));
  const idx = process.argv.indexOf('--month');
  const month = arg ? arg.split('=')[1] : (idx >= 0 ? process.argv[idx + 1] : null);
  if (!/^20\d{4}$/.test(String(month || ''))) throw new Error('Usage: node scripts/generate_mops_revenue_monthly_signal_returns.js --month YYYYMM');
  console.log(JSON.stringify(generateMonth(String(month)), null, 2));
}
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
module.exports = { conservativeAvailabilityDate, buildTradingWindow, pctReturn };
