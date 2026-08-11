#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  loadHolidaySet,
  nextTradingDate,
  normalizeIsoDate,
} = require('./resolve_forecast_dates');

const ROOT = path.resolve(__dirname, '..');
const REVENUE_ROOT = path.join(ROOT, 'data_mops_monthly_revenue');
const SIGNAL_ROOT = path.join(ROOT, 'data_prediction_analysis', 'monthly-revenue', 'monthly-signals');

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function compactDate(value) {
  const digits = String(value ?? '').replace(/[^0-9]/g, '');
  return /^20\d{6}$/.test(digits) ? digits : '';
}

function monthBefore(month) {
  let year = Number(month.slice(0, 4));
  let value = Number(month.slice(4, 6)) - 1;
  if (value === 0) { value = 12; year -= 1; }
  return `${year}${String(value).padStart(2, '0')}`;
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).replaceAll(',', '').replace('%', '').trim());
  return Number.isFinite(number) ? number : null;
}

function firstFinite(row, keys) {
  for (const key of keys) {
    const value = finite(row?.[key]);
    if (value !== null) return value;
  }
  return null;
}

function normalizeDateValue(value) {
  if (!value) return '';
  const text = String(value).trim();
  const direct = normalizeIsoDate(text);
  if (direct) return direct;
  const digits = text.replace(/[^0-9]/g, '');
  if (digits.length >= 8) return normalizeIsoDate(digits.slice(0, 8)) || '';
  return '';
}

function availabilityDate(row, payload) {
  const rowCandidates = [
    row?.effective_trading_date,
    row?.conservative_availability_date,
    row?.announcement_date,
    row?.disclosure_date,
    row?.publish_date,
    row?.published_date,
    row?.report_date,
    row?.first_seen_at,
    row?.first_collected_at,
    row?.collected_at,
    row?.published_at,
  ];
  for (const value of rowCandidates) {
    const date = normalizeDateValue(value);
    if (date) return { date, source: 'company_level' };
  }

  const fallbackCandidates = [
    payload?.collection?.first_collected_at,
    payload?.source?.report_date,
    payload?.collection?.last_collected_at,
  ];
  for (const value of fallbackCandidates) {
    const date = normalizeDateValue(value);
    if (date) return { date, source: 'file_level_fallback' };
  }
  return { date: '', source: 'unavailable' };
}

function revenueValue(row) {
  return firstFinite(row, [
    'monthly_revenue_thousand_twd',
    'monthly_revenue',
    'revenue_thousand_twd',
    'revenue',
  ]);
}

function yoyValue(row) {
  return firstFinite(row, [
    'yoy_pct',
    'yoy_growth_pct',
    'year_over_year_pct',
    'same_month_last_year_growth_pct',
    'increase_decrease_percent',
  ]);
}

function momValue(row, previousRow) {
  const direct = firstFinite(row, [
    'mom_pct',
    'mom_growth_pct',
    'month_over_month_pct',
    'monthly_change_pct',
  ]);
  if (direct !== null) return direct;
  const current = revenueValue(row);
  const previous = revenueValue(previousRow);
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return (current / previous - 1) * 100;
}

function companyMap(payload) {
  return new Map((payload?.companies || []).map(row => [String(row.stock_code || row.stock_id || '').trim(), row]));
}

function buildEvents(month, payload, previousPayload, holidays = loadHolidaySet()) {
  const previousByCode = companyMap(previousPayload || {});
  const events = [];
  for (const row of payload?.companies || []) {
    const stockCode = String(row.stock_code || row.stock_id || '').trim();
    if (!stockCode) continue;
    const previous = previousByCode.get(stockCode) || null;
    const yoy = yoyValue(row);
    const previousYoy = yoyValue(previous);
    const mom = momValue(row, previous);
    const available = availabilityDate(row, payload);
    if (!available.date) continue;

    // Conservative anti-lookahead rule: a disclosure becomes an actionable
    // signal on the next TWSE trading day. This also prevents file-level
    // fallback dates from being treated as same-day pre-close information.
    const baseTradingDateIso = nextTradingDate(available.date, holidays, false);
    const baseTradingDate = compactDate(baseTradingDateIso);
    if (!baseTradingDate) continue;

    events.push({
      stock_code: stockCode,
      stock_name: row.stock_name || row.company_name || '',
      industry: row.industry || '',
      revenue_month: month,
      announcement_date: available.date,
      availability_source: available.source,
      conservative_availability_date: available.date,
      effective_trading_date: baseTradingDateIso,
      base_trading_date: baseTradingDateIso,
      factors: {
        yoy_pct: yoy,
        mom_pct: mom,
        previous_month_yoy_pct: previousYoy,
        yoy_acceleration_pct_points: Number.isFinite(yoy) && Number.isFinite(previousYoy)
          ? yoy - previousYoy
          : null,
      },
      source: {
        revenue_file: `data_mops_monthly_revenue/${month}/monthly_revenue.json`,
        previous_revenue_file: previous ? `data_mops_monthly_revenue/${monthBefore(month)}/monthly_revenue.json` : null,
      },
    });
  }
  return events.sort((a, b) => a.base_trading_date.localeCompare(b.base_trading_date) || a.stock_code.localeCompare(b.stock_code));
}

function syncMonth(month, options = {}) {
  if (!/^20\d{4}$/.test(month)) throw new Error(`Invalid month: ${month}`);
  const revenueFile = path.join(REVENUE_ROOT, month, 'monthly_revenue.json');
  const previousMonth = monthBefore(month);
  const previousFile = path.join(REVENUE_ROOT, previousMonth, 'monthly_revenue.json');
  const payload = readJson(revenueFile, null);
  if (!payload || !Array.isArray(payload.companies)) throw new Error(`Missing MOPS revenue data: ${revenueFile}`);
  const previousPayload = readJson(previousFile, { companies: [] });
  const events = buildEvents(month, payload, previousPayload);
  const output = path.join(SIGNAL_ROOT, `${month}.json`);
  const result = {
    schema_version: 2,
    dataset: 'mops_monthly_revenue_signal_artifact',
    generated_at: new Date().toISOString(),
    revenue_month: month,
    event_count: events.length,
    anti_lookahead_policy: 'company availability date when present; file-level date only as conservative fallback; actionable on next TWSE trading day',
    source_file: `data_mops_monthly_revenue/${month}/monthly_revenue.json`,
    events,
  };
  fs.mkdirSync(SIGNAL_ROOT, { recursive: true });
  if (!options.dryRun) fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return { month, output: path.relative(ROOT, output), events: events.length, dry_run: Boolean(options.dryRun) };
}

function availableRevenueMonths() {
  if (!fs.existsSync(REVENUE_ROOT)) return [];
  return fs.readdirSync(REVENUE_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^20\d{4}$/.test(entry.name))
    .map(entry => entry.name)
    .filter(month => fs.existsSync(path.join(REVENUE_ROOT, month, 'monthly_revenue.json')))
    .sort();
}

function syncMissingMonths(options = {}) {
  const months = availableRevenueMonths();
  const requested = options.month ? [options.month] : months;
  const results = [];
  for (const month of requested) {
    const output = path.join(SIGNAL_ROOT, `${month}.json`);
    if (!options.force && fs.existsSync(output) && fs.statSync(output).size > 0) continue;
    results.push(syncMonth(month, options));
  }
  return { checked_months: requested.length, generated_months: results.length, results };
}

function parseArgs(argv) {
  const options = { month: '', force: false, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--month') options.month = argv[++index] || '';
    else if (arg === '--force') options.force = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function main(argv = process.argv.slice(2)) {
  const result = syncMissingMonths(parseArgs(argv));
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = {
  availabilityDate,
  buildEvents,
  compactDate,
  momValue,
  monthBefore,
  syncMonth,
  syncMissingMonths,
  yoyValue,
};
