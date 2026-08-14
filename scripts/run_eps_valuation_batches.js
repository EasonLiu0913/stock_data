#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  analyzeStock,
  loadMarketDates,
  listStocks,
  summarize,
  EPS_METHODS,
  PE_METHODS,
  ROOT,
  OUT_DIR,
} = require('./generate_eps_valuation_lab');

const PLAN_FILE = path.join(OUT_DIR, 'valuation-batch-plan.json');
const BATCH_DIR = path.join(OUT_DIR, 'valuation-batches');
const FINAL_FILE = path.join(OUT_DIR, 'valuation-backtest.json');

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] != null ? process.argv[i + 1] : fallback;
}
function intArg(name, fallback) {
  const n = Number(arg(name, fallback));
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid --${name}: ${n}`);
  return n;
}
function pad(n) { return String(n).padStart(4, '0'); }
function batchFile(offset, count) {
  const end = Math.max(offset, offset + count - 1);
  return path.join(BATCH_DIR, `batch-${pad(offset)}-${pad(end)}.json`);
}
function planIdentity(plan) {
  if (!plan || !Array.isArray(plan.stock_codes) || !Array.isArray(plan.batches)) return null;
  return JSON.stringify({
    stock_codes: plan.stock_codes,
    batches: plan.batches.map(batch => ({
      offset: batch.offset,
      batch_size: batch.batch_size,
      start_stock: batch.start_stock,
      end_stock: batch.end_stock,
      output_file: batch.output_file,
    })),
  });
}
function buildPlan(batchSize) {
  const stocks = listStocks();
  const batches = [];
  for (let offset = 0; offset < stocks.length; offset += batchSize) {
    const selected = stocks.slice(offset, offset + batchSize);
    batches.push({
      offset,
      batch_size: selected.length,
      start_stock: selected[0] || null,
      end_stock: selected[selected.length - 1] || null,
      output_file: path.relative(ROOT, batchFile(offset, selected.length)),
    });
  }
  const existing = readJson(PLAN_FILE);
  const candidate = {
    schema_version: 1,
    dataset: 'eps_valuation_batch_plan',
    generated_at: new Date().toISOString(),
    stock_count: stocks.length,
    default_batch_size: batchSize,
    expected_batch_count: batches.length,
    stock_codes: stocks,
    batches,
  };
  if (planIdentity(existing) === planIdentity(candidate)) {
    candidate.generated_at = existing.generated_at || candidate.generated_at;
  }
  writeJson(PLAN_FILE, candidate);
  console.log(JSON.stringify({
    mode: 'plan',
    output: path.relative(ROOT, PLAN_FILE),
    stocks: stocks.length,
    batches: batches.length,
    batch_size: batchSize,
    reused_plan_identity: planIdentity(existing) === planIdentity(candidate),
  }, null, 2));
}
function analyzeStockIsolated(stock, marketDates) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `eps-valuation-${stock}-`));
  const outputFile = path.join(tempDir, 'rows.json');
  const workerCode = `
    const fs = require('node:fs');
    const { analyzeStock } = require(${JSON.stringify(path.join(__dirname, 'generate_eps_valuation_lab.js'))});
    const stock = process.argv[1];
    const marketDates = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    const rows = analyzeStock(stock, marketDates);
    fs.writeFileSync(process.argv[3], JSON.stringify(rows));
    console.log('[eps-valuation-worker] stock=' + stock + ' rows=' + rows.length);
  `;
  const marketFile = path.join(tempDir, 'market-dates.json');
  fs.writeFileSync(marketFile, JSON.stringify(marketDates));
  const result = spawnSync(process.execPath, ['-e', workerCode, stock, marketFile, outputFile], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw new Error(`Isolated valuation worker failed for ${stock} with exit code ${result.status}`);
  }
  const rows = readJson(outputFile, []);
  fs.rmSync(tempDir, { recursive: true, force: true });
  return Array.isArray(rows) ? rows : [];
}
function runBatch(offset, batchSize) {
  const plan = readJson(PLAN_FILE);
  if (!plan || !Array.isArray(plan.stock_codes)) throw new Error('Missing valuation-batch-plan.json. Run --mode plan first.');
  const selected = plan.stock_codes.slice(offset, offset + batchSize);
  if (!selected.length) throw new Error(`No stocks selected for offset=${offset}, batch-size=${batchSize}`);
  const marketDates = loadMarketDates();
  const rows = [];
  const stockSummaries = [];
  for (let i = 0; i < selected.length; i++) {
    const stock = selected[i];
    const stockRows = analyzeStockIsolated(stock, marketDates);
    rows.push(...stockRows);
    stockSummaries.push({ stock_code: stock, formula_rows: stockRows.length });
    const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
    console.log(`[eps-valuation-batch] ${i + 1}/${selected.length} stock=${stock} rows=${stockRows.length} cumulative=${rows.length} parent_rss_mb=${rssMb}`);
  }
  const file = batchFile(offset, selected.length);
  const payload = {
    schema_version: 1,
    dataset: 'eps_valuation_batch_result',
    generated_at: new Date().toISOString(),
    plan_generated_at: plan.generated_at,
    execution_mode: 'isolated_stock_workers',
    offset,
    batch_size: selected.length,
    selected_stock_codes: selected,
    stock_summaries: stockSummaries,
    stock_count_with_rows: new Set(rows.map(r => r.stock_code)).size,
    sample_count: rows.length,
    rows,
  };
  writeJson(file, payload);
  console.log(JSON.stringify({
    mode: 'batch',
    output: path.relative(ROOT, file),
    offset,
    selected_stocks: selected.length,
    stocks_with_rows: payload.stock_count_with_rows,
    samples: rows.length,
    execution_mode: payload.execution_mode,
  }, null, 2));
}
function finalize() {
  const plan = readJson(PLAN_FILE);
  if (!plan || !Array.isArray(plan.batches)) throw new Error('Missing valuation-batch-plan.json.');
  const missing = [];
  const rows = [];
  const seenStocks = new Set();
  for (const batch of plan.batches) {
    const file = path.join(ROOT, batch.output_file);
    const payload = readJson(file);
    if (!payload || payload.dataset !== 'eps_valuation_batch_result') {
      missing.push(batch.output_file);
      continue;
    }
    const expected = plan.stock_codes.slice(batch.offset, batch.offset + batch.batch_size);
    if (payload.offset !== batch.offset || payload.batch_size !== batch.batch_size || JSON.stringify(payload.selected_stock_codes) !== JSON.stringify(expected)) {
      throw new Error(`Batch checkpoint mismatch: ${batch.output_file}`);
    }
    for (const stock of payload.selected_stock_codes) {
      if (seenStocks.has(stock)) throw new Error(`Duplicate stock across batch files: ${stock}`);
      seenStocks.add(stock);
    }
    rows.push(...(payload.rows || []));
  }
  if (missing.length) {
    console.error(JSON.stringify({ mode: 'finalize', complete: false, missing_batches: missing }, null, 2));
    process.exitCode = 2;
    return;
  }
  if (seenStocks.size !== plan.stock_count) throw new Error(`Expected ${plan.stock_count} planned stocks, merged ${seenStocks.size}`);
  const payload = {
    schema_version: 1,
    dataset: 'eps_valuation_backtest',
    generated_at: new Date().toISOString(),
    methodology: {
      information_rule: 'Only quarterly EPS and P/E observations available no later than each financial-report effective trading date are used.',
      target_rule: 'Future-quarter target is the maximum daily high from the report effective trading date until the next quarterly report effective trading date, exclusive. Samples without a known next quarterly report are excluded as incomplete.',
      pe_history_rule: 'Historical P/E uses only earlier report events and at most the previous 12 observations.',
      price_source: 'scripts/lib/stock_price_provider.js',
      execution_mode: 'plan_plus_committed_batches',
      batch_plan_file: path.relative(ROOT, PLAN_FILE),
    },
    formula_count: EPS_METHODS.length * PE_METHODS.length,
    stock_count: new Set(rows.map(r => r.stock_code)).size,
    planned_stock_count: plan.stock_count,
    sample_count: rows.length,
    formula_summary: summarize(rows),
    rows,
  };
  writeJson(FINAL_FILE, payload);
  console.log(JSON.stringify({
    mode: 'finalize',
    complete: true,
    output: path.relative(ROOT, FINAL_FILE),
    planned_stocks: plan.stock_count,
    stocks_with_rows: payload.stock_count,
    samples: payload.sample_count,
    formulas: payload.formula_summary.length,
  }, null, 2));
}

function main() {
  const mode = arg('mode', 'plan');
  if (mode === 'plan') return buildPlan(intArg('batch-size', 20));
  if (mode === 'batch') return runBatch(intArg('offset', 0), intArg('batch-size', 20));
  if (mode === 'finalize') return finalize();
  throw new Error(`Unknown --mode ${mode}; use plan, batch, or finalize.`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
