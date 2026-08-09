#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_ROOT = path.join(ROOT, 'data_twse_quarterly_financial_quality');
const ENDPOINT = 'https://openapi.twse.com.tw/v1/opendata/t187ap06_L_ci';

function parseNumber(value) {
  if (value == null || value === '' || value === '--') return null;
  const normalized = String(value).replace(/,/g, '').replace(/%/g, '').trim();
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function first(row, keys) {
  for (const key of keys) {
    if (row[key] != null && row[key] !== '') return row[key];
  }
  return null;
}

function normalizeFiscalYear(value) {
  const n = parseNumber(value);
  if (!Number.isFinite(n)) return null;
  return n < 1911 ? n + 1911 : n;
}

function normalizeQuarter(value) {
  const text = String(value ?? '').trim().toUpperCase();
  const match = text.match(/(?:Q|第)?\s*([1-4])(?:季)?/);
  if (match) return Number(match[1]);
  const n = parseNumber(value);
  return [1, 2, 3, 4].includes(n) ? n : null;
}

function safeDivide(numerator, denominator) {
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0
    ? numerator / denominator * 100
    : null;
}

function round(value, digits = 4) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function normalizeRow(row) {
  const revenue = parseNumber(first(row, ['營業收入', 'Revenue', '營業收入合計']));
  const grossProfit = parseNumber(first(row, ['營業毛利（毛損）', '營業毛利(毛損)', '營業毛利', 'GrossProfitLossFromOperations']));
  const operatingIncome = parseNumber(first(row, ['營業利益（損失）', '營業利益(損失)', '營業利益', 'OperatingIncomeLoss']));
  const netIncome = parseNumber(first(row, ['本期淨利（淨損）', '本期淨利(淨損)', '本期淨利', 'NetIncomeLoss']));
  const parentNetIncome = parseNumber(first(row, ['淨利（淨損）歸屬於母公司業主', '淨利(淨損)歸屬於母公司業主', '歸屬於母公司業主之淨利（淨損）', 'ProfitLossAttributableToOwnersOfParent']));
  const eps = parseNumber(first(row, ['基本每股盈餘（元）', '基本每股盈餘(元)', '基本每股盈餘', 'BasicEarningsLossPerShare']));
  const fiscalYear = normalizeFiscalYear(first(row, ['年度', '年', 'FiscalYear']));
  const quarter = normalizeQuarter(first(row, ['季別', '季', 'Season', 'Quarter']));
  const code = String(first(row, ['公司代號', '公司代碼', 'Code', 'CompanyCode']) || '').trim();
  const name = String(first(row, ['公司名稱', 'Name', 'CompanyName']) || '').trim();

  return {
    stock_code: code || null,
    stock_name: name || null,
    fiscal_year: fiscalYear,
    fiscal_quarter: quarter,
    period_basis: 'cumulative_ytd',
    industry_statement_type: 'general_industry',
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

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'stock_data research crawler', Accept: 'application/json' } }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
        try { resolve(JSON.parse(body)); } catch (error) { reject(new Error(`Invalid JSON: ${error.message}`)); }
      });
    });
    req.setTimeout(30000, () => req.destroy(new Error('TWSE OpenAPI request timed out')));
    req.on('error', reject);
  });
}

function assertSnapshot(rows) {
  if (!Array.isArray(rows) || rows.length < 100) throw new Error(`Unexpected TWSE income-statement row count: ${rows?.length ?? 0}`);
  const usable = rows.filter(row => row.stock_code && Number.isFinite(row.revenue));
  if (usable.length < 100) throw new Error(`Too few usable general-industry rows: ${usable.length}`);
  const periods = new Set(usable.filter(row => row.fiscal_year && row.fiscal_quarter).map(row => `${row.fiscal_year}Q${row.fiscal_quarter}`));
  if (periods.size > 1) throw new Error(`Mixed fiscal periods in one TWSE snapshot: ${[...periods].join(', ')}`);
  return { usable, period: [...periods][0] || 'unknown-period' };
}

function writeStockEventSnapshot(period, generatedAt, usable, stockCode = '2059') {
  const company = usable.find(row => String(row.stock_code) === String(stockCode)) || null;
  const outputDir = path.join(OUTPUT_ROOT, 'stock-events');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, `${stockCode}-latest.json`);
  const payload = {
    schema_version: 1,
    dataset: 'twse_quarterly_financial_quality_stock_snapshot',
    generated_at: generatedAt,
    stock_code: String(stockCode),
    fiscal_period: period,
    period_basis: 'cumulative_ytd',
    company,
    research_guardrails: {
      standalone_quarter_required_for_qoq: true,
      direct_qoq_from_cumulative_ytd_prohibited: true,
      historical_backfill_required_for_yoy_and_backtest: true,
      note: 'Q2/Q3/Q4 income-statement amounts from this snapshot are cumulative YTD. Standalone-quarter amounts must be derived from adjacent cumulative filings before QoQ scoring.',
    },
  };
  fs.writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return outputFile;
}

async function main() {
  const raw = await getJson(ENDPOINT);
  const normalized = raw.map(normalizeRow);
  const { usable, period } = assertSnapshot(normalized);
  const generatedAt = new Date().toISOString();
  const outputDir = path.join(OUTPUT_ROOT, period);
  fs.mkdirSync(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, 'income-statement-general.json');
  const payload = {
    schema_version: 2,
    dataset: 'twse_quarterly_financial_quality_snapshot',
    generated_at: generatedAt,
    source: {
      provider: 'TWSE OpenAPI',
      endpoint: '/v1/opendata/t187ap06_L_ci',
      statement_type: 'listed-company income statement - general industry',
    },
    fiscal_period: period,
    period_basis: 'cumulative_ytd',
    methodology: {
      status: 'research_only',
      scope: 'listed general-industry companies only; financial, insurance, securities and other non-comparable statement types are intentionally excluded',
      ratios: 'gross/operating/net margins are recomputed from reported cumulative-YTD statement amounts; no forward estimates are used',
      quarter_conversion: 'Q1 equals standalone Q1. Q2/Q3/Q4 standalone-quarter amounts must be derived by subtracting the preceding cumulative filing before any QoQ comparison.',
      history_warning: 'this endpoint is used as an immutable latest-quarter snapshot source going forward; historical backfill must use archived MOPS/XBRL quarter data and preserve report availability dates before backtesting',
    },
    research_guardrails: {
      direct_qoq_from_cumulative_ytd_prohibited: true,
      standalone_quarter_required_for_qoq: true,
      historical_backfill_required_for_yoy_and_backtest: true,
    },
    counts: { raw: raw.length, usable: usable.length },
    companies: usable.sort((a, b) => String(a.stock_code).localeCompare(String(b.stock_code))),
  };
  fs.writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  const stockEventFile = writeStockEventSnapshot(period, generatedAt, usable, '2059');
  console.log(JSON.stringify({ output: path.relative(ROOT, outputFile), stock_event_output: path.relative(ROOT, stockEventFile), fiscal_period: period, period_basis: 'cumulative_ytd', companies: usable.length }, null, 2));
}

if (require.main === module) {
  main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
}

module.exports = { parseNumber, normalizeFiscalYear, normalizeQuarter, safeDivide, normalizeRow, assertSnapshot, writeStockEventSnapshot };
