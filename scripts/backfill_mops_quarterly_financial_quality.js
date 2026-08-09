#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_ROOT = path.join(ROOT, 'data_mops_quarterly_financial_quality');
const MOPS_URL = 'https://mops.twse.com.tw/mops/web/ajax_t163sb04';

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
  if (!m) throw new Error(`Invalid quarter: ${period}. Expected YYYYQ1..YYYYQ4`);
  return { year: Number(m[1]), quarter: Number(m[2]) };
}

function periodIndex(period) {
  const { year, quarter } = periodToParts(period);
  return year * 4 + quarter - 1;
}

function periodFromIndex(index) {
  const year = Math.floor(index / 4);
  const quarter = index % 4 + 1;
  return `${year}Q${quarter}`;
}

function enumeratePeriods(start, end) {
  const a = periodIndex(start);
  const b = periodIndex(end);
  if (a > b) throw new Error(`start-quarter must not exceed end-quarter: ${start} > ${end}`);
  return Array.from({ length: b - a + 1 }, (_, i) => periodFromIndex(a + i));
}

function parseNumber(value) {
  if (value == null) return null;
  const text = String(value).replace(/,/g, '').replace(/%/g, '').replace(/\u00a0/g, ' ').trim();
  if (!text || text === '--' || text === '-') return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function round(value, digits = 4) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function safeDivide(n, d) {
  return Number.isFinite(n) && Number.isFinite(d) && d !== 0 ? n / d * 100 : null;
}

function conservativeAvailabilityDate(year, quarter) {
  // Conservative period-level dates, intentionally later than many actual filings.
  if (quarter === 1) return `${year}-05-15`;
  if (quarter === 2) return `${year}-08-14`;
  if (quarter === 3) return `${year}-11-14`;
  return `${year + 1}-03-31`;
}

function standaloneFromYtd(current, previous) {
  if (!current) return null;
  if (current.fiscal_quarter === 1) return { ...current, statement_period_basis: 'standalone_quarter' };
  if (!previous || previous.stock_code !== current.stock_code || previous.fiscal_year !== current.fiscal_year || previous.fiscal_quarter !== current.fiscal_quarter - 1) return null;
  const fields = ['revenue', 'gross_profit', 'operating_income', 'net_income', 'parent_net_income', 'eps'];
  const out = { ...current, statement_period_basis: 'standalone_quarter' };
  for (const field of fields) {
    const a = Number(current[field]);
    const b = Number(previous[field]);
    out[field] = Number.isFinite(a) && Number.isFinite(b) ? a - b : null;
  }
  out.gross_margin_pct = round(safeDivide(out.gross_profit, out.revenue));
  out.operating_margin_pct = round(safeDivide(out.operating_income, out.revenue));
  out.net_margin_pct = round(safeDivide(out.parent_net_income ?? out.net_income, out.revenue));
  return out;
}

function normalizeRow(cells, headers, year, quarter) {
  const map = Object.fromEntries(headers.map((h, i) => [h.replace(/\s+/g, ''), cells[i] ?? '']));
  const find = (patterns) => {
    for (const [key, value] of Object.entries(map)) {
      if (patterns.some((p) => key.includes(p))) return value;
    }
    return null;
  };
  const stockCode = String(find(['公司代號', '公司代碼']) || '').trim();
  if (!/^\d{4,6}$/.test(stockCode)) return null;
  const revenue = parseNumber(find(['營業收入']));
  const grossProfit = parseNumber(find(['營業毛利', '營業毛損']));
  const operatingIncome = parseNumber(find(['營業利益', '營業損失']));
  if (!Number.isFinite(revenue) || !Number.isFinite(grossProfit) || !Number.isFinite(operatingIncome)) return null;
  const netIncome = parseNumber(find(['本期淨利', '本期淨損']));
  const parentNetIncome = parseNumber(find(['歸屬於母公司業主', '母公司業主']));
  const eps = parseNumber(find(['基本每股盈餘', '基本每股虧損']));
  return {
    stock_code: stockCode,
    stock_name: String(find(['公司名稱']) || '').trim() || null,
    fiscal_year: year,
    fiscal_quarter: quarter,
    industry_statement_type: 'general_industry',
    statement_period_basis: 'cumulative_ytd',
    revenue,
    gross_profit: grossProfit,
    operating_income: operatingIncome,
    net_income: netIncome,
    parent_net_income: parentNetIncome,
    eps,
    gross_margin_pct: round(safeDivide(grossProfit, revenue)),
    operating_margin_pct: round(safeDivide(operatingIncome, revenue)),
    net_margin_pct: round(safeDivide(parentNetIncome ?? netIncome, revenue)),
  };
}

async function fetchQuarter(page, year, quarter) {
  const rocYear = year - 1911;
  await page.goto('https://mops.twse.com.tw/mops/web/t163sb04', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const html = await page.evaluate(async ({ url, rocYear, quarter }) => {
    const body = new URLSearchParams({
      encodeURIComponent: '1', step: '1', firstin: '1', off: '1', TYPEK: 'sii',
      year: String(rocYear), season: String(quarter),
    });
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: body.toString(),
      credentials: 'include',
    });
    if (!response.ok) throw new Error(`MOPS HTTP ${response.status}`);
    return await response.text();
  }, { url: MOPS_URL, rocYear, quarter });

  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  const tables = await page.locator('table').evaluateAll((els) => els.map((table) => {
    const rows = Array.from(table.querySelectorAll('tr')).map((tr) => Array.from(tr.querySelectorAll('th,td')).map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim()));
    return rows.filter((r) => r.some(Boolean));
  }));

  const companies = [];
  for (const rows of tables) {
    if (rows.length < 2) continue;
    let headerIndex = rows.findIndex((r) => r.some((x) => x.includes('公司代號')) && r.some((x) => x.includes('營業收入')) && r.some((x) => x.includes('營業毛利')));
    if (headerIndex < 0) continue;
    const headers = rows[headerIndex];
    for (const cells of rows.slice(headerIndex + 1)) {
      const row = normalizeRow(cells, headers, year, quarter);
      if (row) companies.push(row);
    }
  }
  const unique = [...new Map(companies.map((row) => [row.stock_code, row])).values()].sort((a, b) => a.stock_code.localeCompare(b.stock_code));
  if (unique.length < 100) throw new Error(`Too few general-industry rows for ${year}Q${quarter}: ${unique.length}`);
  return unique;
}

function writeQuarter(period, companies, previousByCode) {
  const { year, quarter } = periodToParts(period);
  const standalone = companies.map((row) => standaloneFromYtd(row, previousByCode.get(row.stock_code))).filter(Boolean);
  const availabilityDate = conservativeAvailabilityDate(year, quarter);
  const outputDir = path.join(OUTPUT_ROOT, period);
  fs.mkdirSync(outputDir, { recursive: true });
  const payload = {
    schema_version: 1,
    dataset: 'mops_quarterly_financial_quality_history',
    generated_at: new Date().toISOString(),
    fiscal_period: period,
    source: { provider: 'MOPS', endpoint: '/mops/web/ajax_t163sb04', typek: 'sii' },
    methodology: {
      status: 'research_only',
      source_basis: 'reported cumulative YTD income-statement values',
      standalone_rule: 'Q1 equals YTD; Q2-Q4 standalone values are current YTD minus prior-quarter YTD for the same fiscal year',
      availability_policy: 'conservative_period_deadline',
      conservative_known_date: availabilityDate,
      caution: 'company-specific actual filing dates are not yet applied; this deliberately avoids early availability assumptions',
    },
    counts: { ytd_companies: companies.length, standalone_companies: standalone.length },
    ytd_companies: companies,
    standalone_companies: standalone,
  };
  fs.writeFileSync(path.join(outputDir, 'income-statement-general.json'), `${JSON.stringify(payload, null, 2)}\n`);
  return standalone;
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const start = args.get('start-quarter') || '2024Q1';
  const end = args.get('end-quarter') || '2026Q2';
  const periods = enumeratePeriods(start, end);
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ locale: 'zh-TW' });
  const previousByCode = new Map();
  try {
    for (const period of periods) {
      const { year, quarter } = periodToParts(period);
      const companies = await fetchQuarter(page, year, quarter);
      writeQuarter(period, companies, previousByCode);
      previousByCode.clear();
      for (const row of companies) previousByCode.set(row.stock_code, row);
      console.log(JSON.stringify({ period, companies: companies.length }, null, 2));
    }
  } finally {
    await browser.close();
  }
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });

module.exports = { periodToParts, enumeratePeriods, parseNumber, conservativeAvailabilityDate, standaloneFromYtd, normalizeRow };
