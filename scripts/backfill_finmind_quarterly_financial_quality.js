#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_ROOT = path.join(ROOT, 'data_finmind_quarterly_financial_quality');
const API_URL = 'https://api.finmindtrade.com/api/v4/data';

class UnsupportedFinancialModelError extends Error {
  constructor(message) { super(message); this.name = 'UnsupportedFinancialModelError'; this.exitCode = 3; }
}

function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) args.set(key, true);
    else { args.set(key, next); i += 1; }
  }
  return args;
}

function periodToParts(period) {
  const m = String(period || '').match(/^(20\d{2})Q([1-4])$/);
  if (!m) throw new Error(`Invalid quarter: ${period}`);
  return { year: Number(m[1]), quarter: Number(m[2]) };
}
function periodIndex(period) { const { year, quarter } = periodToParts(period); return year * 4 + quarter - 1; }
function periodFromIndex(index) { return `${Math.floor(index / 4)}Q${index % 4 + 1}`; }
function enumeratePeriods(start, end) {
  const a = periodIndex(start), b = periodIndex(end);
  if (a > b) throw new Error(`start-quarter must not exceed end-quarter: ${start} > ${end}`);
  return Array.from({ length: b - a + 1 }, (_, i) => periodFromIndex(a + i));
}
function quarterEnd(period) {
  const { year, quarter } = periodToParts(period);
  return `${year}-${String(quarter * 3).padStart(2, '0')}-${quarter === 1 ? '31' : quarter === 2 ? '30' : quarter === 3 ? '30' : '31'}`;
}
function conservativeAvailabilityDate(year, quarter) {
  if (quarter === 1) return `${year}-05-15`;
  if (quarter === 2) return `${year}-08-14`;
  if (quarter === 3) return `${year}-11-14`;
  return `${year + 1}-03-31`;
}
function round(value, digits = 4) { return Number.isFinite(value) ? Number(value.toFixed(digits)) : null; }
function safeDivide(n, d) { return Number.isFinite(n) && Number.isFinite(d) && d !== 0 ? n / d * 100 : null; }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function getJsonOnce(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Accept: 'application/json', 'User-Agent': 'stock_data research crawler', ...headers } }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const error = new Error(`FinMind HTTP ${res.statusCode}: ${body.slice(0, 500)}`);
          error.httpStatus = res.statusCode;
          return reject(error);
        }
        try { resolve(JSON.parse(body)); }
        catch (error) { reject(new Error(`FinMind invalid JSON: ${error.message}; body=${body.slice(0, 500)}`)); }
      });
    });
    req.setTimeout(30000, () => req.destroy(new Error('FinMind request timed out')));
    req.on('error', reject);
  });
}

async function getJsonWithRetry(url, headers = {}, maxAttempts = 4) {
  const waits = [2000, 5000, 10000];
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try { return await getJsonOnce(url, headers); }
    catch (error) {
      lastError = error;
      const status = Number(error.httpStatus || 0);
      const retryable = status === 429 || status >= 500 || /timed out|ECONNRESET|ETIMEDOUT|socket hang up/i.test(error.message);
      if (!retryable || attempt === maxAttempts) throw error;
      const base = waits[Math.min(attempt - 1, waits.length - 1)];
      const jitter = Math.floor(Math.random() * 750);
      console.warn(`[retry] FinMind attempt ${attempt}/${maxAttempts} failed: ${error.message}; wait=${base + jitter}ms`);
      await sleep(base + jitter);
    }
  }
  throw lastError;
}

async function fetchFinancialStatements(stockId, start, end) {
  const params = new URLSearchParams({ dataset: 'TaiwanStockFinancialStatements', data_id: stockId, start_date: start, end_date: end });
  const token = String(process.env.FINMIND_API_TOKEN || '').trim();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const payload = await getJsonWithRetry(`${API_URL}?${params.toString()}`, headers);
  if (payload.status !== 200 || !Array.isArray(payload.data)) {
    throw new Error(`FinMind API error: status=${payload.status}; msg=${payload.msg || payload.message || 'unknown'}`);
  }
  if (!payload.data.length) throw new Error(`FinMind returned no financial statements for ${stockId}`);
  return payload.data;
}

function fieldFromRows(rows, candidates) {
  const normalized = rows.map(row => ({ ...row, origin: String(row.origin_name || '').replace(/\s+/g, ''), typeName: String(row.type || '') }));
  for (const candidate of candidates) {
    const exactType = normalized.find(row => row.typeName === candidate);
    if (exactType && Number.isFinite(Number(exactType.value))) return Number(exactType.value);
  }
  for (const candidate of candidates) {
    const byOrigin = normalized.find(row => row.origin.includes(candidate));
    if (byOrigin && Number.isFinite(Number(byOrigin.value))) return Number(byOrigin.value);
  }
  return null;
}

function looksLikeFinancialIndustry(rows) {
  const text = rows.map(row => `${row.type || ''}:${row.origin_name || ''}`).join('|');
  return /NetInterestIncome|NetNonInterestIncome|Insurance|利息淨收益|利息以外淨收益|保險負債|呆帳費用|淨收益/.test(text);
}

function looksLikeNonGrossMarginStatement(rows) {
  const types = new Set(rows.map(row => String(row.type || '')));
  const hasProfitCore = ['OperatingIncome', 'IncomeAfterTaxes', 'IncomeAfterTax', 'EPS', 'PreTaxIncome']
    .some(type => types.has(type));
  const hasRevenueLike = ['Revenue', 'OperatingRevenue', 'GrossProfit', 'GrossProfitLossFromOperations']
    .some(type => types.has(type));
  return hasProfitCore && !hasRevenueLike;
}

function normalizeReportedQuarter(rows, period, stockId) {
  const { year, quarter } = periodToParts(period);
  const revenue = fieldFromRows(rows, ['Revenue', 'OperatingRevenue', '營業收入合計', '營業收入']);
  const grossProfit = fieldFromRows(rows, ['GrossProfit', 'GrossProfitLossFromOperations', '營業毛利（毛損）淨額', '營業毛利(毛損)淨額', '營業毛利']);
  const operatingIncome = fieldFromRows(rows, ['OperatingIncome', 'OperatingIncomeLoss', '營業利益（損失）', '營業利益(損失)', '營業利益']);
  const netIncome = fieldFromRows(rows, ['IncomeAfterTaxes', 'IncomeAfterTax', 'NetIncomeLoss', '本期淨利（淨損）', '本期淨利(淨損)', '本期淨利']);
  const parentNetIncome = fieldFromRows(rows, ['IncomeAttributableToOwnersOfParent', 'ProfitLossAttributableToOwnersOfParent', '淨利（淨損）歸屬於母公司業主', '淨利(淨損)歸屬於母公司業主']);
  const eps = fieldFromRows(rows, ['EPS', 'BasicEarningsLossPerShare', '基本每股盈餘（元）', '基本每股盈餘']);
  if (!Number.isFinite(revenue) || !Number.isFinite(grossProfit) || !Number.isFinite(operatingIncome)) {
    const available = [...new Set(rows.map(row => `${row.type}:${row.origin_name}`))].slice(0, 30).join(' | ');
    if (looksLikeFinancialIndustry(rows) || looksLikeNonGrossMarginStatement(rows)) {
      throw new UnsupportedFinancialModelError(`unsupported_financial_model ${stockId} ${period}; current revenue/gross-margin model does not apply to this statement structure; available=${available}`);
    }
    throw new Error(`Missing core FinMind fields for ${stockId} ${period}; available=${available}`);
  }
  const out = { stock_code: stockId, fiscal_year: year, fiscal_quarter: quarter, statement_period_basis: 'standalone_quarter', revenue, gross_profit: grossProfit, operating_income: operatingIncome, net_income: netIncome, parent_net_income: parentNetIncome, eps };
  out.gross_margin_pct = round(safeDivide(out.gross_profit, out.revenue));
  out.operating_margin_pct = round(safeDivide(out.operating_income, out.revenue));
  out.net_margin_pct = round(safeDivide(out.parent_net_income ?? out.net_income, out.revenue));
  return out;
}

function readOfficial2059Q2() {
  const file = path.join(ROOT, 'data_twse_quarterly_financial_quality', '2026Q2', '2059-latest.json');
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')).company || null; } catch { return null; }
}
function sumFinite(a, b) { return Number.isFinite(Number(a)) && Number.isFinite(Number(b)) ? Number(a) + Number(b) : null; }
function relativeError(actual, expected) { if (!Number.isFinite(actual) || !Number.isFinite(expected) || actual === 0) return null; return Math.abs(actual - expected) / Math.abs(actual); }
function validateStandaloneAgainstOfficialYtd(stockId, reportedByPeriod) {
  if (String(stockId) !== '2059') return { confirmed: false, reason: 'official_crosscheck_only_configured_for_2059' };
  const official = readOfficial2059Q2();
  const q1 = reportedByPeriod.get('2026Q1');
  const q2 = reportedByPeriod.get('2026Q2');
  if (!official || !q1 || !q2) return { confirmed: false, reason: 'missing_2026Q1_or_Q2_crosscheck' };
  const scale = 1000;
  const checks = {};
  for (const field of ['revenue', 'gross_profit', 'operating_income', 'net_income', 'parent_net_income']) {
    const finmindYtd = sumFinite(q1[field], q2[field]);
    const twseYtd = Number.isFinite(Number(official[field])) ? Number(official[field]) * scale : null;
    if (!Number.isFinite(finmindYtd) || !Number.isFinite(twseYtd)) continue;
    const error = relativeError(finmindYtd, twseYtd);
    checks[field] = { finmind_q1_plus_q2: finmindYtd, twse_q2_ytd_scaled: twseYtd, relative_error: error };
    if (error > 0.02) throw new Error(`2059 FinMind standalone/TWSE YTD crosscheck failed for ${field}: FinMindQ1Q2=${finmindYtd}; TWSEYTD=${twseYtd}; relative_error=${error}`);
  }
  if (!checks.revenue) throw new Error('2059 revenue crosscheck could not be evaluated');
  const finmindEpsYtd = sumFinite(q1.eps, q2.eps), twseEpsYtd = Number(official.eps);
  if (Number.isFinite(finmindEpsYtd) && Number.isFinite(twseEpsYtd)) {
    checks.eps = { finmind_q1_plus_q2: finmindEpsYtd, twse_q2_ytd: twseEpsYtd, relative_error: relativeError(finmindEpsYtd, twseEpsYtd) };
    if (checks.eps.relative_error > 0.02) throw new Error(`2059 FinMind standalone/TWSE YTD EPS crosscheck failed: FinMindQ1Q2=${finmindEpsYtd}; TWSEYTD=${twseEpsYtd}; relative_error=${checks.eps.relative_error}`);
  }
  return { confirmed: true, statement_period_basis: 'standalone_quarter', amount_scale_to_twse_thousands: scale, reason: 'FinMind Q1+Q2 matches official TWSE 2026Q2 cumulative YTD snapshot', checks };
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const stockId = String(args.get('stock-id') || '2059').trim();
  const start = args.get('start-quarter') || '2024Q1';
  const end = args.get('end-quarter') || '2026Q2';
  const asOfDate = String(args.get('as-of-date') || new Date().toISOString().slice(0, 10));
  if (!/^\d{4,6}$/.test(stockId)) throw new Error(`Invalid stock id: ${stockId}`);
  const periods = enumeratePeriods(start, end);
  const first = periodToParts(periods[0]);
  const rows = await fetchFinancialStatements(stockId, `${first.year}-01-01`, quarterEnd(periods[periods.length - 1]));
  const byDate = new Map();
  for (const row of rows) {
    const date = String(row.date || '').slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(row);
  }

  const availableDates = [...byDate.keys()].sort();
  const firstAvailableDate = availableDates[0] || null;
  const reportedByPeriod = new Map();
  const missingPeriods = [];
  for (const period of periods) {
    const date = quarterEnd(period);
    const { year, quarter } = periodToParts(period);
    const knownDate = conservativeAvailabilityDate(year, quarter);
    const quarterRows = byDate.get(date) || [];
    if (!quarterRows.length) {
      let reason = 'missing_historical_quarter';
      if (knownDate > asOfDate) reason = 'pending_not_yet_available';
      else if (firstAvailableDate && date < firstAvailableDate) reason = 'unavailable_before_first_report';
      missingPeriods.push({ fiscal_period: period, quarter_end: date, conservative_known_date: knownDate, reason });
      continue;
    }
    reportedByPeriod.set(period, normalizeReportedQuarter(quarterRows, period, stockId));
  }

  if (!reportedByPeriod.size) throw new Error(`No usable general-industry quarters for ${stockId}`);
  const basisValidation = validateStandaloneAgainstOfficialYtd(stockId, reportedByPeriod);
  if (String(stockId) === '2059' && periods.includes('2026Q1') && periods.includes('2026Q2') && reportedByPeriod.has('2026Q2') && !basisValidation.confirmed) {
    throw new Error(`Unable to confirm 2059 FinMind standalone basis against TWSE official 2026Q2 snapshot: ${basisValidation.reason}`);
  }

  const stockDir = path.join(OUTPUT_ROOT, stockId);
  fs.mkdirSync(stockDir, { recursive: true });
  for (const [period, standalone] of reportedByPeriod) {
    const { year, quarter } = periodToParts(period);
    const payload = {
      schema_version: 3,
      dataset: 'finmind_quarterly_financial_quality_history',
      generated_at: new Date().toISOString(),
      stock_id: stockId,
      fiscal_period: period,
      source: { provider: 'FinMind', dataset: 'TaiwanStockFinancialStatements', source_role: 'historical research provider' },
      methodology: {
        status: 'research_only', reported_basis: 'standalone_quarter',
        standalone_rule: 'FinMind quarter-end financial-statement values are used directly; no YTD subtraction is applied',
        availability_policy: 'conservative_period_deadline', conservative_known_date: conservativeAvailabilityDate(year, quarter),
        official_crosscheck: basisValidation,
        caution: '2059 Q1+Q2 values are cross-checked against official TWSE 2026Q2 cumulative YTD snapshot; company-specific filing timestamps are not yet applied',
      },
      standalone_quarter: standalone,
    };
    fs.writeFileSync(path.join(stockDir, `${period}.json`), `${JSON.stringify(payload, null, 2)}\n`);
  }

  const coverage = {
    schema_version: 1,
    dataset: 'finmind_quarterly_financial_quality_coverage',
    generated_at: new Date().toISOString(),
    stock_id: stockId,
    requested_start_quarter: start,
    requested_end_quarter: end,
    as_of_date: asOfDate,
    available_periods: [...reportedByPeriod.keys()],
    missing_periods: missingPeriods,
  };
  fs.writeFileSync(path.join(stockDir, 'coverage-status.json'), `${JSON.stringify(coverage, null, 2)}\n`);
  console.log(JSON.stringify({ stock_id: stockId, start_quarter: start, end_quarter: end, available_periods: reportedByPeriod.size, missing_periods: missingPeriods, basis_validation: basisValidation, output_dir: path.relative(ROOT, stockDir) }, null, 2));
}

if (require.main === module) main().catch(error => { console.error(error.stack || error.message); process.exitCode = error.exitCode || 1; });

module.exports = { periodToParts, enumeratePeriods, quarterEnd, conservativeAvailabilityDate, normalizeReportedQuarter, validateStandaloneAgainstOfficialYtd, looksLikeFinancialIndustry, looksLikeNonGrossMarginStatement };
