#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { evaluateSignal } = require('./summarize_mops_revenue_fundamental_acceleration_breakout');

const ROOT = path.resolve(__dirname, '..');
const REVENUE_ROOT = path.join(ROOT, 'data_mops_monthly_revenue');
const SIGNAL_ROOT = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'monthly-signals');
const OUTPUT_ROOT = path.join(SIGNAL_ROOT, 'stock-events');

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function parseArgs(argv) {
  const out = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    out.set(argv[i].slice(2), argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true);
  }
  return out;
}
function loadRevenueRows(stockCode, start, end) {
  const rows = [];
  const months = fs.readdirSync(REVENUE_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^20\d{4}$/.test(entry.name))
    .map(entry => entry.name)
    .filter(month => (!start || month >= start) && (!end || month <= end))
    .sort();
  for (const month of months) {
    const payload = readJson(path.join(REVENUE_ROOT, month, 'monthly_revenue.json'), {});
    const row = (payload.companies || []).find(item => String(item.stock_code) === stockCode);
    if (row) rows.push({ month, row });
  }
  return rows;
}
function loadReturnEvent(stockCode, month) {
  const payload = readJson(path.join(SIGNAL_ROOT, `${month}.json`), {});
  return (payload.events || []).find(event => String(event.stock_code) === stockCode) || null;
}
function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const stockCode = String(args.get('stock') || '').trim();
  const start = args.get('start-month') || null;
  const end = args.get('end-month') || null;
  if (!/^\d{4,6}$/.test(stockCode)) throw new Error('Usage: --stock STOCK_CODE [--start-month YYYYMM] [--end-month YYYYMM]');

  const rawRows = loadRevenueRows(stockCode, start, end);
  if (!rawRows.length) throw new Error(`No MOPS monthly revenue rows found for ${stockCode}`);
  const stockMap = new Map(rawRows.map(({ month, row }) => [month, row]));
  const events = rawRows.map(({ month, row }) => {
    const returnEvent = loadReturnEvent(stockCode, month);
    const factors = returnEvent?.factors || {
      mom_pct: row.mom_pct ?? null,
      yoy_pct: row.yoy_pct ?? null,
      ytd_yoy_pct: row.ytd_yoy_pct ?? null,
      previous_month_yoy_pct: row.derived?.previous_month_yoy_pct ?? null,
      yoy_acceleration_pct_points: row.derived?.yoy_acceleration_pct_points ?? null,
      yoy_accelerating: row.derived?.yoy_accelerating ?? null,
      yoy_and_mom_positive: row.derived?.yoy_and_mom_positive ?? null,
    };
    const syntheticEvent = { factors };
    const signals = evaluateSignal(syntheticEvent, month, stockMap);
    return {
      revenue_month: month,
      stock_code: stockCode,
      stock_name: row.stock_name || returnEvent?.stock_name || null,
      industry: row.industry || returnEvent?.industry || null,
      revenue: {
        monthly_revenue_thousand_twd: row.monthly_revenue_thousand_twd ?? null,
        mom_pct: factors.mom_pct ?? null,
        yoy_pct: factors.yoy_pct ?? null,
        previous_month_yoy_pct: factors.previous_month_yoy_pct ?? null,
        yoy_acceleration_pct_points: factors.yoy_acceleration_pct_points ?? null,
      },
      signals,
      matched_signals: Object.entries(signals).filter(([, matched]) => matched).map(([id]) => id),
      conservative_availability_date: returnEvent?.conservative_availability_date || null,
      effective_trading_date: returnEvent?.effective_trading_date || null,
      returns: returnEvent?.returns || null,
    };
  });
  const firstMatches = {};
  for (const event of events) {
    for (const id of event.matched_signals) if (!firstMatches[id]) firstMatches[id] = event.revenue_month;
  }
  const output = {
    schema_version: 1,
    dataset: 'mops_monthly_revenue_stock_event_timeline',
    generated_at: new Date().toISOString(),
    stock_code: stockCode,
    stock_name: events.find(event => event.stock_name)?.stock_name || null,
    start_month: events[0].revenue_month,
    end_month: events.at(-1).revenue_month,
    methodology: {
      status: 'research_only',
      availability_rule: 'uses the same conservative next-month day-15 rule when monthly return details are available',
      purpose: 'show when one stock first matched each revenue-acceleration hypothesis without using future financial-statement information',
    },
    first_matches: firstMatches,
    events,
  };
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  const outputFile = path.join(OUTPUT_ROOT, `${stockCode}.json`);
  fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output: path.relative(ROOT, outputFile), stock_code: stockCode, first_matches: firstMatches, events: events.length }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { loadRevenueRows };
