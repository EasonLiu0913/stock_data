#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SIGNAL_ROOT = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'monthly-signals');
const HORIZONS = ['d1', 'd3', 'd5', 'd10', 'd20'];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function nextMonth(value) {
  let year = Number(value.slice(0, 4));
  let month = Number(value.slice(4, 6)) + 1;
  if (month === 13) { year += 1; month = 1; }
  return `${year}${String(month).padStart(2, '0')}`;
}

function parseArg(name) {
  const eq = process.argv.find(v => v.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

function statusCounts(events, horizon) {
  const counts = { complete: 0, missing_stock_price: 0, pending_market_data: 0, other: 0 };
  for (const event of events) {
    const status = event.returns?.[horizon]?.status || 'other';
    if (Object.prototype.hasOwnProperty.call(counts, status)) counts[status] += 1;
    else counts.other += 1;
  }
  const total = events.length;
  return {
    ...counts,
    complete_rate: total ? Number((counts.complete / total).toFixed(4)) : 0,
    missing_stock_price_rate: total ? Number((counts.missing_stock_price / total).toFixed(4)) : 0,
  };
}

function summarizeMonth(month) {
  const file = path.join(SIGNAL_ROOT, `${month}.json`);
  if (!fs.existsSync(file)) throw new Error(`Missing signal file: ${month}`);
  const payload = readJson(file);
  const events = Array.isArray(payload.events) ? payload.events : [];
  const horizons = Object.fromEntries(HORIZONS.map(h => [h, statusCounts(events, h)]));
  const effectiveDates = [...new Set(events.map(e => e.effective_trading_date).filter(Boolean))].sort();
  const baseDates = [...new Set(events.map(e => e.base_trading_date).filter(Boolean))].sort();
  return {
    revenue_month: month,
    total: events.length,
    conservative_availability_date: events[0]?.conservative_availability_date || null,
    effective_trading_dates: effectiveDates,
    base_trading_dates: baseDates,
    benchmark_code: payload.benchmark?.code || null,
    horizons,
  };
}

function main() {
  const start = parseArg('start-month');
  const end = parseArg('end-month');
  if (!/^20\d{4}$/.test(String(start || '')) || !/^20\d{4}$/.test(String(end || ''))) {
    throw new Error('Usage: node scripts/summarize_mops_revenue_monthly_signal_study.js --start-month YYYYMM --end-month YYYYMM');
  }
  const months = [];
  for (let month = start;; month = nextMonth(month)) {
    months.push(summarizeMonth(month));
    if (month === end) break;
  }
  const totals = Object.fromEntries(HORIZONS.map(h => {
    const total = months.reduce((sum, m) => sum + m.total, 0);
    const complete = months.reduce((sum, m) => sum + m.horizons[h].complete, 0);
    const missing = months.reduce((sum, m) => sum + m.horizons[h].missing_stock_price, 0);
    const pending = months.reduce((sum, m) => sum + m.horizons[h].pending_market_data, 0);
    return [h, {
      total,
      complete,
      missing_stock_price: missing,
      pending_market_data: pending,
      complete_rate: total ? Number((complete / total).toFixed(4)) : 0,
      missing_stock_price_rate: total ? Number((missing / total).toFixed(4)) : 0,
    }];
  }));
  const output = {
    schema_version: 1,
    dataset: 'mops_monthly_revenue_conservative_signal_coverage_summary',
    start_month: start,
    end_month: end,
    generated_at: new Date().toISOString(),
    benchmark: 'TAIEX',
    months,
    totals,
  };
  const outputFile = path.join(SIGNAL_ROOT, 'coverage-summary.json');
  fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(output, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
