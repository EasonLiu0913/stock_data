#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_ROOT = path.join(ROOT, 'data_finmind_quarterly_financial_quality');
const API_URL = 'https://api.finmindtrade.com/api/v4/data';

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

function periodIndex(period) {
  const { year, quarter } = periodToParts(period);
  return year * 4 + quarter - 1;
}

function periodFromIndex(index) {
  return `${Math.floor(index / 4)}Q${index % 4 + 1}`;
}

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

function round(value, digits = 4) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function safeDivide(n, d) {
  return Number.isFinite(n) && Number.isFinite(d) && d !== 0 ? n / d * 100 : null;
}

function getJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Accept: 'application/json', 'User-Agent': 'stock_data research crawler', ...headers } }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`FinMind HTTP ${res.statusCode}: ${body.slice(0, 500)}`));
        try { resolve(JSON.parse(body)); } catch (error) { reject(new Error(`FinMind invalid JSON: ${error.message}; body=${body.slice(0, 500)}`)); }
      });
    });
    req.setTimeout(30000, () => req.destroy(new Error('FinMind request timed out')));
    req.on('error', reject);
  });
}

async function fetchFinancialStatements(stockId, start, end) {
  const params = new URLSearchParams({
    dataset: 'TaiwanStockFinancialStatements',
    data_id: stockId,
    start_date: start,
    end_date: end,
  });
  const token = String(process.env.FINMIND_API_TOKEN || '').trim();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const payload = await getJson(`${API_URL}?${params.toString()}`, headers);
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

function normalizeReportedQuarter(rows, period, stockId) {
  const { year, quarter } = periodToParts(period);
  const revenue = fieldFromRows(rows, ['Revenue', 'OperatingRevenue', '營業收入合計', '營業收入']);
  const grossProfit = fieldFromRows(rows, ['GrossProfit', 'GrossProfitLossFromOperations', '營業毛利（毛損）淨額', '營業毛利(毛損)淨額', '營業毛利']);
  const operatingIncome = fieldFromRows(rows, ['OperatingIncome', 'OperatingIncomeLoss', '營業利益（損失）', '營業利益(損失)', '營業利益']);
  const netIncome = fieldFromRows(rows, ['IncomeAfterTaxes', 'NetIncomeLoss', '本期淨利（淨損）', '本期淨利(淨損)', '本期淨利']);
  const parentNetIncome = fieldFromRows(rows, ['IncomeAttributableToOwnersOfParent', 'ProfitLossAttributableToOwnersOfParent', '淨利（淨損）歸屬於母公司業主', '淨利(淨損)歸屬於母公司業主']);
  const eps = fieldFromRows(rows, ['EPS', 'BasicEarningsLossPerShare', '基本每股盈餘（元）', '基本每股盈餘']);
  if (!Number.isFinite(revenue) || !Number.isFinite(grossProfit) || !Number.isFinite(operatingIncome)) {
    const available = [...new Set(rows.map(row => `${row.type}:${row.origin_name}`))].slice(0, 30).join(' | ');
    throw new Error(`Missing core FinMind fields for ${stockId} ${period}; available=${available}`);
  }
  return {
    stock_code: stockId,
    fiscal_year: year,
    fiscal_quarter: quarter,
    statement_period_basis: 'reported_source_basis_pending_validation',
    revenue,
    gross_profit: grossProfit,
    operating_income: operatingIncome,
    net_income: netIncome,
    parent_net_income: parentNetIncome,
    eps,
  };
}

function standaloneFromYtd(current, previous) {
  if (current.fiscal_quarter === 1) {
    const out = { ...current, statement_period_basis: 'standalone_quarter' };
    out.gross_margin_pct = round(safeDivide(out.gross_profit, out.revenue));
    out.operating_margin_pct = round(safeDivide(out.operating_income, out.revenue));
    out.net_margin_pct = round(safeDivide(out.parent_net_income ?? out.net_income, out.revenue));
    return out;
  }
  if (!previous || previous.fiscal_year !== current.fiscal_year || previous.fiscal_quarter !== current.fiscal_quarter - 1) return null;
  const out = { ...current, statement_period_basis: 'standalone_quarter' };
  for (const field of ['revenue', 'gross_profit', 'operating_income', 'net_income', 'parent_net_income', 'eps']) {
    const a = Number(current[field]), b = Number(previous[field]);
    out[field] = Number.isFinite(a) && Number.isFinite(b) ? a - b : null;
  }
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

function inferYtdScale(stockId, reportedByPeriod) {
  if (String(stockId) !== '2059') return { confirmed: false, scale: null, reason: 'official_crosscheck_only_configured_for_2059' };
  const official = readOfficial2059Q2();
  const finmind = reportedByPeriod.get('2026Q2');
  if (!official || !finmind || !Number.isFinite(official.revenue) || !Number.isFinite(finmind.revenue)) return { confirmed: false, scale: null, reason: 'missing_2026Q2_crosscheck' };
  const ratio = finmind.revenue / official.revenue;
  const candidates = [1, 1000, 1000000];
  const scale = candidates.reduce((best, x) => Math.abs(ratio - x) < Math.abs(ratio - best) ? x : best, candidates[0]);
  const relativeError = Math.abs(finmind.revenue - official.revenue * scale) / Math.abs(finmind.revenue);
  if (relativeError > 0.01) throw new Error(`2059 FinMind/TWSE 2026Q2 revenue crosscheck failed: FinMind=${finmind.revenue}; TWSE=${official.revenue}; inferred_scale=${scale}; relative_error=${relativeError}`);
  return { confirmed: true, scale, relative_error: relativeError, reason: 'matched_TWSE_2026Q2_cumulative_ytd_revenue' };
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const stockId = String(args.get('stock-id') || '2059').trim();
  const start = args.get('start-quarter') || '2024Q1';
  const end = args.get('end-quarter') || '2026Q2';
  if (!/^\d{4,6}$/.test(stockId)) throw new Error(`Invalid stock id: ${stockId}`);
  const periods = enumeratePeriods(start, end);
  const first = periodToParts(periods[0]);
  const apiStart = `${first.year}-01-01`;
  const apiEnd = quarterEnd(periods[periods.length - 1]);
  const rows = await fetchFinancialStatements(stockId, apiStart, apiEnd);
  const byDate = new Map();
  for (const row of rows) {
    const date = String(row.date || '').slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(row);
  }

  const reportedByPeriod = new Map();
  for (const period of periods) {
    const date = quarterEnd(period);
    const quarterRows = byDate.get(date) || [];
    if (!quarterRows.length) throw new Error(`FinMind missing ${stockId} rows for ${period} (${date})`);
    reportedByPeriod.set(period, normalizeReportedQuarter(quarterRows, period, stockId));
  }

  const basisValidation = inferYtdScale(stockId, reportedByPeriod);
  if (String(stockId) === '2059' && periods.includes('2026Q2') && !basisValidation.confirmed) {
    throw new Error(`Unable to confirm 2059 FinMind reported basis against TWSE official 2026Q2 snapshot: ${basisValidation.reason}`);
  }

  let previous = null;
  const stockDir = path.join(OUTPUT_ROOT, stockId);
  fs.mkdirSync(stockDir, { recursive: true });
  for (const period of periods) {
    const reported = reportedByPeriod.get(period);
    const standalone = standaloneFromYtd(reported, previous);
    if (!standalone) throw new Error(`Unable to derive standalone quarter for ${stockId} ${period}`);
    const { year, quarter } = periodToParts(period);
    const payload = {
      schema_version: 1,
      dataset: 'finmind_quarterly_financial_quality_history',
      generated_at: new Date().toISOString(),
      stock_id: stockId,
      fiscal_period: period,
      source: {
        provider: 'FinMind',
        dataset: 'TaiwanStockFinancialStatements',
        source_role: 'historical research provider',
      },
      methodology: {
        status: 'research_only',
        reported_basis: 'cumulative_ytd_confirmed_by_2059_TWSE_crosscheck',
        standalone_rule: 'Q1 equals reported YTD; Q2-Q4 standalone is current YTD minus prior-quarter YTD in same fiscal year',
        availability_policy: 'conservative_period_deadline',
        conservative_known_date: conservativeAvailabilityDate(year, quarter),
        official_crosscheck: basisValidation,
        caution: 'historical provider data is cross-checked against official TWSE latest-quarter snapshot; company-specific filing timestamps are not yet applied',
      },
      reported_ytd: { ...reported, statement_period_basis: 'cumulative_ytd' },
      standalone_quarter: standalone,
    };
    fs.writeFileSync(path.join(stockDir, `${period}.json`), `${JSON.stringify(payload, null, 2)}\n`);
    previous = reported;
  }
  console.log(JSON.stringify({ stock_id: stockId, start_quarter: start, end_quarter: end, periods: periods.length, basis_validation: basisValidation, output_dir: path.relative(ROOT, stockDir) }, null, 2));
}

if (require.main === module) main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });

module.exports = { periodToParts, enumeratePeriods, quarterEnd, conservativeAvailabilityDate, standaloneFromYtd, normalizeReportedQuarter };
