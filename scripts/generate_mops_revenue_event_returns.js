#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REVENUE_ROOT = path.join(ROOT, 'data_mops_monthly_revenue');
const OUTPUT_ROOT = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'events');
const MARKET_FILE = path.join(ROOT, 'data_twse_market_chart', 'market_chart.json');
const HORIZONS = [1, 3, 5, 10, 20];

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function comparablePayload(value) {
  if (!value || typeof value !== 'object') return value;
  const copy = JSON.parse(JSON.stringify(value));
  delete copy.generated_at;
  return copy;
}

function compactDate(value) {
  const text = String(value || '');
  const match = text.match(/(20\d{2})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}${match[2]}${match[3]}` : String(value || '').replace(/\D/g, '').slice(0, 8);
}

function nextRevenueCalendarMonth(revenueMonth) {
  let year = Number(revenueMonth.slice(0, 4));
  let month = Number(revenueMonth.slice(4, 6)) + 1;
  if (month === 13) { year += 1; month = 1; }
  return `${year}${String(month).padStart(2, '0')}`;
}

function classifyObservedTiming(revenueMonth, firstSeenAt) {
  const date = compactDate(firstSeenAt);
  if (!/^20\d{6}$/.test(date)) return { usable: false, status: 'missing_first_seen_at', observed_date: null };
  const expectedMonth = nextRevenueCalendarMonth(revenueMonth);
  const observedMonth = date.slice(0, 6);
  const day = Number(date.slice(6, 8));
  if (observedMonth !== expectedMonth || day < 1 || day > 15) {
    return { usable: false, status: 'backfill_no_original_timestamp', observed_date: date };
  }
  return { usable: true, status: 'observed_during_reporting_window', observed_date: date };
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

function buildTradingWindow(marketRows, observedDate) {
  const priorIndex = marketRows.map(row => row.date).findLastIndex(date => date <= observedDate);
  const baseIndex = priorIndex >= 0 ? priorIndex : -1;
  const effectiveIndex = baseIndex + 1;
  if (effectiveIndex < 0 || effectiveIndex >= marketRows.length) return null;
  const base = marketRows[baseIndex];
  const effective = marketRows[effectiveIndex];
  return { baseIndex, effectiveIndex, base, effective };
}

function pctReturn(start, end) {
  return Number.isFinite(start) && start > 0 && Number.isFinite(end)
    ? Number((((end / start) - 1) * 100).toFixed(4))
    : null;
}

function calculateEventReturns(stockCode, observedDate, marketRows) {
  const window = buildTradingWindow(marketRows, observedDate);
  if (!window || !window.base) return { effective_trading_date: null, base_trading_date: null, returns: {} };
  const baseDate = window.base.date;
  const stockBase = loadFubonClose(stockCode, baseDate);
  const marketBase = window.base.close;
  const returns = {};
  for (const horizon of HORIZONS) {
    const target = marketRows[window.baseIndex + horizon];
    if (!target) {
      returns[`d${horizon}`] = {
        status: 'pending_market_data',
        target_trading_date: null,
        stock_return_pct: null,
        market_return_pct: null,
        excess_return_pct: null,
        stock_positive: null,
        outperformed_market: null,
      };
      continue;
    }
    const stockEnd = loadFubonClose(stockCode, target.date);
    const stockReturn = pctReturn(stockBase, stockEnd);
    const marketReturn = pctReturn(marketBase, target.close);
    const excess = Number.isFinite(stockReturn) && Number.isFinite(marketReturn)
      ? Number((stockReturn - marketReturn).toFixed(4)) : null;
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
  return { effective_trading_date: window.effective.date, base_trading_date: baseDate, returns };
}

function buildEvent(row, revenueMonth, marketRows) {
  const timing = classifyObservedTiming(revenueMonth, row.first_seen_at);
  const base = {
    stock_code: row.stock_code,
    stock_name: row.stock_name,
    industry: row.industry || null,
    revenue_month: revenueMonth,
    first_seen_at: row.first_seen_at || null,
    event_timing_status: timing.status,
    observed_date: timing.observed_date,
    factors: {
      mom_pct: row.mom_pct,
      yoy_pct: row.yoy_pct,
      ytd_yoy_pct: row.ytd_yoy_pct,
      yoy_acceleration_pct_points: row.derived?.yoy_acceleration_pct_points ?? null,
      yoy_accelerating: row.derived?.yoy_accelerating ?? null,
      yoy_and_mom_positive: row.derived?.yoy_and_mom_positive ?? null,
    },
    benchmark: { code: 'TAIEX', source: 'data_twse_market_chart/market_chart.json' },
  };
  if (!timing.usable) {
    return {
      ...base,
      effective_trading_date: null,
      base_trading_date: null,
      returns: {},
      evaluation_status: 'excluded_missing_original_event_time',
    };
  }
  const calculated = calculateEventReturns(row.stock_code, timing.observed_date, marketRows);
  return {
    ...base,
    ...calculated,
    evaluation_status: calculated.effective_trading_date ? 'eligible' : 'pending_next_trading_day',
  };
}

function generateMonth(revenueMonth) {
  const sourceFile = path.join(REVENUE_ROOT, revenueMonth, 'monthly_revenue.json');
  const source = readJson(sourceFile, null);
  if (!source) throw new Error(`Missing MOPS revenue file: ${sourceFile}`);
  const marketRows = loadMarketSeries();
  const events = (source.companies || []).map(row => buildEvent(row, revenueMonth, marketRows));
  const output = path.join(OUTPUT_ROOT, `${revenueMonth}.json`);
  const previous = readJson(output, null);
  const payload = {
    schema_version: 1,
    dataset: 'mops_monthly_revenue_event_returns',
    revenue_month: revenueMonth,
    generated_at: previous?.generated_at || new Date().toISOString(),
    benchmark: {
      code: 'TAIEX',
      source: 'TWSE MI_5MINS_HIST via data_twse_market_chart/market_chart.json',
    },
    methodology: {
      event_time_rule: 'first_seen_at must fall in days 1-15 of the calendar month after revenue_month',
      effective_trade_rule: 'always start evaluation from the next TAIEX trading day after observed_date',
      return_rule: 'D1/D3/D5/D10/D20 compare target close with the close immediately before the effective trading day',
      historical_backfill_rule: 'backfilled first_seen_at values outside the reporting window are excluded to avoid look-ahead bias',
      stock_price_rule: 'stock close must come from the exact matching data_fubon/fubon_YYYYMMDD_sma.json trading-date key',
    },
    counts: {
      total: events.length,
      eligible: events.filter(event => event.evaluation_status === 'eligible').length,
      pending_next_trading_day: events.filter(event => event.evaluation_status === 'pending_next_trading_day').length,
      excluded_missing_original_event_time: events.filter(event => event.evaluation_status === 'excluded_missing_original_event_time').length,
    },
    events,
  };

  if (previous && JSON.stringify(comparablePayload(previous)) === JSON.stringify(comparablePayload(payload))) {
    return { output: path.relative(ROOT, output), counts: payload.counts, changed: false };
  }

  payload.generated_at = new Date().toISOString();
  writeJson(output, payload);
  return { output: path.relative(ROOT, output), counts: payload.counts, changed: true };
}

function main() {
  const arg = process.argv.find(value => /^--month=20\d{4}$/.test(value));
  const index = process.argv.indexOf('--month');
  const month = arg ? arg.split('=')[1] : (index >= 0 ? process.argv[index + 1] : null);
  if (!/^20\d{4}$/.test(String(month || ''))) {
    throw new Error('Usage: node scripts/generate_mops_revenue_event_returns.js --month YYYYMM');
  }
  console.log(JSON.stringify(generateMonth(String(month)), null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = {
  HORIZONS,
  buildTradingWindow,
  classifyObservedTiming,
  generateMonth,
  pctReturn,
};
