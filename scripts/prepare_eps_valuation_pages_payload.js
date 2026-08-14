#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJson(file, value, pretty = false) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, pretty ? 2 : 0)}\n`, 'utf8');
}
function uniq(values) {
  return [...new Set(values.filter(value => value != null && value !== ''))].sort((a, b) => String(a).localeCompare(String(b), 'zh-Hant'));
}
function compactValuationSummary(payload) {
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  return {
    schema_version: 1,
    dataset: 'eps_valuation_pages_summary',
    generated_at: payload.generated_at || null,
    methodology: payload.methodology || {},
    formula_count: payload.formula_count || 0,
    stock_count: payload.stock_count || 0,
    planned_stock_count: payload.planned_stock_count || 0,
    sample_count: payload.sample_count || rows.length,
    formula_summary: Array.isArray(payload.formula_summary) ? payload.formula_summary : [],
    stock_codes: uniq(rows.map(row => row.stock_code)),
    fiscal_periods: uniq(rows.map(row => row.fiscal_period)),
    eps_methods: uniq(rows.map(row => row.eps_method)).map(value => {
      const row = rows.find(item => item.eps_method === value);
      return { value, label: row?.eps_method_label || value };
    }),
    pe_methods: uniq(rows.map(row => row.pe_method)).map(value => {
      const row = rows.find(item => item.pe_method === value);
      return { value, label: row?.pe_method_label || value };
    }),
  };
}
function splitValuation(root) {
  const dir = path.join(root, 'data_prediction_analysis', 'eps-valuation');
  const source = path.join(dir, 'valuation-backtest.json');
  if (!fs.existsSync(source)) return { dataset: 'eps_valuation', skipped: true, reason: 'source_missing' };
  const payload = readJson(source);
  if (payload.dataset !== 'eps_valuation_backtest' || !Array.isArray(payload.rows)) {
    throw new Error('valuation-backtest.json has unexpected shape');
  }
  const byStock = new Map();
  for (const row of payload.rows) {
    const stock = String(row.stock_code || '');
    if (!/^\d{4,6}$/.test(stock)) continue;
    if (!byStock.has(stock)) byStock.set(stock, []);
    byStock.get(stock).push(row);
  }
  const outputDir = path.join(dir, 'valuation-by-stock');
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  let rowsWritten = 0;
  for (const [stock, rows] of byStock) {
    writeJson(path.join(outputDir, `${stock}.json`), {
      schema_version: 1,
      dataset: 'eps_valuation_stock_rows',
      generated_at: payload.generated_at || null,
      stock_code: stock,
      sample_count: rows.length,
      rows,
    });
    rowsWritten += rows.length;
  }
  writeJson(path.join(dir, 'valuation-summary.json'), compactValuationSummary(payload));
  fs.rmSync(source, { force: true });
  return { dataset: 'eps_valuation', stocks: byStock.size, rows: rowsWritten, removed_source: 'valuation-backtest.json' };
}
function splitCoverage(root) {
  const dir = path.join(root, 'data_prediction_analysis', 'eps-valuation');
  const source = path.join(dir, 'coverage-report.json');
  if (!fs.existsSync(source)) return { dataset: 'eps_coverage', skipped: true, reason: 'source_missing' };
  const payload = readJson(source);
  if (!payload.summary || !Array.isArray(payload.stocks)) throw new Error('coverage-report.json has unexpected shape');
  const outputDir = path.join(dir, 'coverage-by-stock');
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  let count = 0;
  const stockIndex = [];
  for (const stock of payload.stocks) {
    const code = String(stock.stock_code || '');
    if (!/^\d{4,6}$/.test(code)) continue;
    writeJson(path.join(outputDir, `${code}.json`), {
      schema_version: 1,
      dataset: 'eps_coverage_stock',
      generated_at: payload.generated_at || null,
      stock,
    });
    stockIndex.push({ stock_code: code, stock_name: stock.stock_name || '', industry: stock.industry || '' });
    count += 1;
  }
  writeJson(path.join(dir, 'coverage-summary.json'), {
    schema_version: 1,
    dataset: 'eps_coverage_pages_summary',
    generated_at: payload.generated_at || null,
    summary: payload.summary,
    stock_index: stockIndex,
  });
  fs.rmSync(source, { force: true });
  return { dataset: 'eps_coverage', stocks: count, removed_source: 'coverage-report.json' };
}
function run(root) {
  const valuation = splitValuation(root);
  const coverage = splitCoverage(root);
  const output = { root, valuation, coverage };
  console.log(JSON.stringify(output, null, 2));
  return output;
}
function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eps-pages-payload-'));
  const dir = path.join(root, 'data_prediction_analysis', 'eps-valuation');
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, 'valuation-backtest.json'), {
    dataset: 'eps_valuation_backtest', generated_at: '2026-01-01T00:00:00Z', formula_count: 1, stock_count: 2, planned_stock_count: 2, sample_count: 3,
    formula_summary: [{ formula: 'a__b', samples: 3 }], methodology: { information_rule: 'test' },
    rows: [
      { stock_code: '1101', fiscal_period: '2025Q1', eps_method: 'a', eps_method_label: 'A', pe_method: 'b', pe_method_label: 'B' },
      { stock_code: '1101', fiscal_period: '2025Q2', eps_method: 'a', eps_method_label: 'A', pe_method: 'b', pe_method_label: 'B' },
      { stock_code: '2330', fiscal_period: '2025Q1', eps_method: 'a', eps_method_label: 'A', pe_method: 'b', pe_method_label: 'B' },
    ],
  });
  writeJson(path.join(dir, 'coverage-report.json'), {
    generated_at: '2026-01-01T00:00:00Z', summary: { total_stocks: 2, reason_counts: [] },
    stocks: [{ stock_code: '1101', stock_name: 'A' }, { stock_code: '2330', stock_name: 'B' }],
  });
  const result = run(root);
  if (result.valuation.stocks !== 2 || result.valuation.rows !== 3) throw new Error('valuation split self-test failed');
  if (!fs.existsSync(path.join(dir, 'valuation-summary.json'))) throw new Error('valuation summary missing');
  if (!fs.existsSync(path.join(dir, 'valuation-by-stock', '1101.json'))) throw new Error('valuation stock file missing');
  if (fs.existsSync(path.join(dir, 'valuation-backtest.json'))) throw new Error('large valuation source was not removed');
  if (!fs.existsSync(path.join(dir, 'coverage-summary.json'))) throw new Error('coverage summary missing');
  if (!fs.existsSync(path.join(dir, 'coverage-by-stock', '2330.json'))) throw new Error('coverage stock file missing');
  if (fs.existsSync(path.join(dir, 'coverage-report.json'))) throw new Error('large coverage source was not removed');
  console.log('prepare_eps_valuation_pages_payload self-test passed');
  fs.rmSync(root, { recursive: true, force: true });
}

if (require.main === module) {
  try {
    if (process.argv.includes('--self-test')) selfTest();
    else {
      const i = process.argv.indexOf('--site');
      const root = path.resolve(i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : '_site');
      run(root);
    }
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { compactValuationSummary, splitValuation, splitCoverage, run };
