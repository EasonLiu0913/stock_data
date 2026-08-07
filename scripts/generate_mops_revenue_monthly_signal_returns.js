#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { getClose } = require('./lib/stock_price_provider');

const ROOT = path.resolve(__dirname, '..');
const REVENUE_ROOT = path.join(ROOT, 'data_mops_monthly_revenue');
const OUTPUT_ROOT = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'monthly-signals');
const MARKET_FILE = path.join(ROOT, 'data_twse_market_chart', 'market_chart.json');
const PRICE_PROVIDER_FILE = path.join(ROOT, 'scripts', 'lib', 'stock_price_provider.js');
const HORIZONS = [1, 3, 5, 10, 20];
const METHODOLOGY_VERSION = 'mops-conservative-signal-returns-v3';

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function fileSha256(file) {
  return sha256(fs.readFileSync(file));
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
  const stockBase = getClose(stockCode, window.base.date, { root: ROOT });
  const returns = {};
  for (const horizon of HORIZONS) {
    const target = marketRows[window.baseIndex + horizon];
    if (!target) {
      returns[`d${horizon}`] = { status: 'pending_market_data', target_trading_date: null, stock_return_pct: null, market_return_pct: null, excess_return_pct: null, stock_positive: null, outperformed_market: null };
      continue;
    }
    const stockEnd = getClose(stockCode, target.date, { root: ROOT });
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
function stableRevenueResearchInput(source) {
  return {
    schema_version: source?.schema_version ?? null,
    revenue_month: source?.revenue_month ?? null,
    companies: (source?.companies || []).map(row => ({
      stock_code: row.stock_code,
      stock_name: row.stock_name,
      industry: row.industry || null,
      mom_pct: row.mom_pct ?? null,
      yoy_pct: row.yoy_pct ?? null,
      ytd_yoy_pct: row.ytd_yoy_pct ?? null,
      previous_month_yoy_pct: row.derived?.previous_month_yoy_pct ?? null,
      yoy_acceleration_pct_points: row.derived?.yoy_acceleration_pct_points ?? null,
      yoy_accelerating: row.derived?.yoy_accelerating ?? null,
      yoy_and_mom_positive: row.derived?.yoy_and_mom_positive ?? null,
    })),
  };
}
function marketWindowFingerprint(marketRows, revenueMonth) {
  const availabilityDate = conservativeAvailabilityDate(revenueMonth);
  const window = buildTradingWindow(marketRows, availabilityDate);
  if (!window) return null;
  const rows = marketRows.slice(window.baseIndex, window.baseIndex + Math.max(...HORIZONS) + 1);
  return sha256(JSON.stringify(rows));
}
function buildInputFingerprint(revenueMonth, source, marketRows) {
  return {
    methodology_version: METHODOLOGY_VERSION,
    revenue_research_sha256: sha256(JSON.stringify(stableRevenueResearchInput(source))),
    market_window_sha256: marketWindowFingerprint(marketRows, revenueMonth),
    stock_price_provider_sha256: fileSha256(PRICE_PROVIDER_FILE),
  };
}
function hasPendingMarketData(payload) {
  const events = Array.isArray(payload?.events) ? payload.events : [];
  if (!events.length) return true;
  return events.some(event => HORIZONS.some(horizon => {
    const status = event.returns?.[`d${horizon}`]?.status;
    return !status || status === 'pending_market_data';
  }));
}
function inspectReusableMonth(revenueMonth) {
  const sourceFile = path.join(REVENUE_ROOT, revenueMonth, 'monthly_revenue.json');
  const outputFile = path.join(OUTPUT_ROOT, `${revenueMonth}.json`);
  const source = readJson(sourceFile, null);
  if (!source) return { reusable: false, reason: 'missing_source', source_file: sourceFile, output_file: outputFile };
  const existing = readJson(outputFile, null);
  if (!existing) return { reusable: false, reason: 'missing_output', source_file: sourceFile, output_file: outputFile };
  if (existing.dataset !== 'mops_monthly_revenue_conservative_signal_returns' || existing.revenue_month !== revenueMonth) {
    return { reusable: false, reason: 'output_identity_mismatch', source_file: sourceFile, output_file: outputFile };
  }
  const marketRows = loadMarketSeries();
  const current = buildInputFingerprint(revenueMonth, source, marketRows);
  if (!current.market_window_sha256) {
    return { reusable: false, reason: 'missing_market_window', source_file: sourceFile, output_file: outputFile, current };
  }
  if (hasPendingMarketData(existing)) {
    return { reusable: false, reason: 'pending_market_data', source_file: sourceFile, output_file: outputFile, current };
  }
  const stored = existing.incremental?.input_fingerprint || null;
  if (!stored) return { reusable: false, reason: 'missing_input_fingerprint', source_file: sourceFile, output_file: outputFile, current };
  for (const key of Object.keys(current)) {
    if (stored[key] !== current[key]) {
      return { reusable: false, reason: `fingerprint_changed:${key}`, source_file: sourceFile, output_file: outputFile, current, stored };
    }
  }
  return { reusable: true, reason: 'unchanged_mature_detail', source_file: sourceFile, output_file: outputFile, current };
}
function generateMonth(revenueMonth) {
  const sourceFile = path.join(REVENUE_ROOT, revenueMonth, 'monthly_revenue.json');
  const source = readJson(sourceFile, null);
  if (!source) throw new Error(`Missing MOPS revenue file: ${sourceFile}`);
  const marketRows = loadMarketSeries();
  const events = (source.companies || []).map(row => buildEvent(row, revenueMonth, marketRows));
  const inputFingerprint = buildInputFingerprint(revenueMonth, source, marketRows);
  const payload = {
    schema_version: 3,
    dataset: 'mops_monthly_revenue_conservative_signal_returns',
    revenue_month: revenueMonth,
    generated_at: new Date().toISOString(),
    benchmark: { code: 'TAIEX', source: 'TWSE MI_5MINS_HIST via data_twse_market_chart/market_chart.json' },
    methodology: {
      purpose: 'historical factor study when company-level original filing timestamps are unavailable',
      availability_rule: 'treat the monthly revenue dataset as usable only after calendar day 15 of the following month',
      effective_trade_rule: 'start evaluation from the first TAIEX trading day after that conservative availability date',
      return_rule: 'D1/D3/D5/D10/D20 compare target close with the close immediately before the effective trading day',
      stock_price_rule: 'use unified provider priority: TWSE MI_INDEX, data_history_sma, legacy data_fubon',
      interpretation_warning: 'this is not a filing-day event study and must not be interpreted as immediate market reaction to an individual company filing',
    },
    incremental: {
      reusable_when_market_window_mature: Boolean(inputFingerprint.market_window_sha256),
      historical_missing_stock_price_requires_force_rebuild_after_price_backfill: true,
      input_fingerprint: inputFingerprint,
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
module.exports = {
  HORIZONS,
  METHODOLOGY_VERSION,
  buildInputFingerprint,
  buildTradingWindow,
  conservativeAvailabilityDate,
  generateMonth,
  hasPendingMarketData,
  inspectReusableMonth,
  marketWindowFingerprint,
  pctReturn,
  stableRevenueResearchInput,
};
