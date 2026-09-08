#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_ROOT = path.join(ROOT, 'data_finmind_quarterly_financial_quality');
const MASTER_FILE = path.join(ROOT, 'data_prediction_analysis', 'quarterly-financial-quality', 'financial-quality-master.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    if (!String(argv[i]).startsWith('--')) continue;
    const key = String(argv[i]).slice(2);
    const next = argv[i + 1];
    if (!next || String(next).startsWith('--')) args.set(key, true);
    else { args.set(key, next); i += 1; }
  }
  return args;
}

function verifyStock(masterStock, timeline, stockId) {
  if (!masterStock) throw new Error(`Master missing refreshed stock ${stockId}`);
  const masterRows = new Map((masterStock.rows || []).map(row => [row.fiscal_period, row]));
  for (const row of timeline.rows || []) {
    const masterRow = masterRows.get(row.fiscal_period);
    if (!masterRow) throw new Error(`Master missing ${stockId} ${row.fiscal_period}`);
    if ((masterRow.conservative_known_date || null) !== (row.conservative_known_date || null)) {
      throw new Error(`Master known-date mismatch for ${stockId} ${row.fiscal_period}`);
    }
    if (Number(masterRow.financial_quality_score) !== Number(row.financial_quality_score)) {
      throw new Error(`Master score mismatch for ${stockId} ${row.fiscal_period}`);
    }
  }
}

function verifyMasterPropagation(stockIds, master = readJson(MASTER_FILE), options = {}) {
  if (!master || !Array.isArray(master.stocks)) throw new Error('Missing or invalid financial-quality master');
  const masterStocks = new Map(master.stocks.map(stock => [String(stock.stock_id), stock]));
  let skippedUnsupported = 0;
  for (const stockId of stockIds) {
    const timelineFile = path.join(SOURCE_ROOT, stockId, 'financial-quality-score-timeline.json');
    if (!fs.existsSync(timelineFile)) {
      const coverageFile = path.join(SOURCE_ROOT, stockId, 'coverage-status.json');
      const coverage = fs.existsSync(coverageFile) ? readJson(coverageFile) : null;
      if (options.allowUnsupported && coverage?.status === 'unsupported_financial_model') {
        skippedUnsupported += 1;
        continue;
      }
      throw new Error(`Missing refreshed timeline for ${stockId}`);
    }
    const timeline = readJson(timelineFile);
    if (!Array.isArray(timeline.rows)) throw new Error(`Invalid refreshed timeline for ${stockId}`);
    verifyStock(masterStocks.get(stockId), timeline, stockId);
  }
  return { verified_stocks: stockIds.length - skippedUnsupported, skipped_unsupported: skippedUnsupported };
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const stockIds = String(args.get('stock-ids') || '').split(',').map(value => value.trim()).filter(Boolean);
  if (!stockIds.length) throw new Error('--stock-ids requires at least one stock id');
  const allowUnsupported = String(args.get('allow-unsupported') || 'false').toLowerCase() === 'true';
  const result = verifyMasterPropagation(stockIds, readJson(MASTER_FILE), { allowUnsupported });
  console.log(JSON.stringify({ master: path.relative(ROOT, MASTER_FILE), ...result }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { verifyStock, verifyMasterPropagation };
