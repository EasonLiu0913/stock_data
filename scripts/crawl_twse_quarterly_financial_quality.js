#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_ROOT = path.join(ROOT, 'data_twse_quarterly_financial_quality');
const ENDPOINT = 'https://openapi.twse.com.tw/v1/opendata/t187ap06_L_ci';
const MAX_ATTEMPTS = 5;

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function looksLikeHtml(body, contentType = '') {
  const trimmed = String(body || '').trimStart().toLowerCase();
  return /text\/html/i.test(contentType) || trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html');
}

function requestText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 stock_data-research/1.0',
        Accept: 'application/json,text/plain;q=0.9,*/*;q=0.1',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.7',
        'Cache-Control': 'no-cache',
      },
    }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          contentType: String(res.headers['content-type'] || ''),
          location: res.headers.location || null,
          body,
        });
      });
    });
    req.setTimeout(30000, () => req.destroy(new Error('TWSE OpenAPI request timed out')));
    req.on('error', reject);
  });
}

async function getJson(url, attempts = MAX_ATTEMPTS) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await requestText(url);
      const preview = response.body.replace(/\s+/g, ' ').slice(0, 180);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(`HTTP ${response.statusCode}${response.location ? ` redirect=${response.location}` : ''}: ${preview}`);
      }
      if (looksLikeHtml(response.body, response.contentType)) {
        throw new Error(`TWSE OpenAPI returned HTML instead of JSON (content-type=${response.contentType || 'unknown'}): ${preview}`);
      }
      let parsed;
      try {
        parsed = JSON.parse(response.body);
      } catch (error) {
        throw new Error(`Invalid JSON from TWSE OpenAPI (content-type=${response.contentType || 'unknown'}): ${error.message}; body=${preview}`);
      }
      if (!Array.isArray(parsed)) throw new Error(`Unexpected TWSE OpenAPI payload type: ${typeof parsed}`);
      return parsed;
    } catch (error) {
      lastError = error;
      console.warn(`[TWSE quarterly financial quality] attempt ${attempt}/${attempts} failed: ${error.message}`);
      if (attempt < attempts) await sleep(Math.min(30000, 2000 * attempt * attempt));
    }
  }
  throw new Error(`TWSE OpenAPI failed after ${attempts} attempts: ${lastError?.message || 'unknown error'}`);
}

function assertSnapshot(rows) {
  if (!Array.isArray(rows) || rows.length < 100) throw new Error(`Unexpected TWSE income-statement row count: ${rows?.length ?? 0}`);
  const usable = rows.filter(row => row.stock_code && Number.isFinite(row.revenue));
  if (usable.length < 100) throw new Error(`Too few usable general-industry rows: ${usable.length}`);
  const periods = new Set(usable.filter(row => row.fiscal_year && row.fiscal_quarter).map(row => `${row.fiscal_year}Q${row.fiscal_quarter}`));
  if (periods.size > 1) throw new Error(`Mixed fiscal periods in one TWSE snapshot: ${[...periods].join(', ')}`);
  return { usable, period: [...periods][0] || 'unknown-period' };
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
    statement_period_basis: 'cumulative_ytd',
    methodology: {
      status: 'research_only',
      scope: 'listed general-industry companies only; financial, insurance, securities and other non-comparable statement types are intentionally excluded',
      ratios: 'gross/operating/net margins are recomputed from reported cumulative YTD statement amounts; no forward estimates are used',
      quarterization_warning: 'Q2/Q3/Q4 amounts are cumulative YTD and must be differenced against the previous fiscal-quarter YTD statement before any single-quarter QoQ comparison',
      history_warning: 'this endpoint is used as an immutable snapshot source going forward; historical backfill requires separately archived MOPS/XBRL quarter data and must preserve report availability dates before backtesting',
    },
    counts: { raw: raw.length, usable: usable.length },
    companies: usable.sort((a, b) => String(a.stock_code).localeCompare(String(b.stock_code))),
  };
  fs.writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const stock2059 = usable.find(row => row.stock_code === '2059');
  if (stock2059) {
    fs.writeFileSync(path.join(outputDir, '2059-latest.json'), `${JSON.stringify({
      schema_version: 1,
      dataset: 'twse_quarterly_financial_quality_stock_snapshot',
      generated_at: generatedAt,
      fiscal_period: period,
      statement_period_basis: 'cumulative_ytd',
      company: stock2059,
    }, null, 2)}\n`, 'utf8');
  }

  console.log(JSON.stringify({ output: path.relative(ROOT, outputFile), fiscal_period: period, companies: usable.length, stock_2059_found: Boolean(stock2059) }, null, 2));
}

if (require.main === module) {
  main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
}

module.exports = { parseNumber, normalizeFiscalYear, normalizeQuarter, safeDivide, normalizeRow, assertSnapshot, looksLikeHtml, getJson };
