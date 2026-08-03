#!/usr/bin/env node
'use strict';

const path = require('node:path');
const {
  ROOT,
  readJson,
  atomicWriteJson,
} = require('./market_environment_lib');

function compactDate(value) {
  const compact = String(value || '').replaceAll('-', '').replaceAll('/', '');
  return /^20\d{6}$/.test(compact) ? compact : '';
}

function annotatePredictionDispositionStocks({ rootDir = 'data_predictions', date, dryRun = false } = {}) {
  const compact = compactDate(date);
  if (!compact) throw new Error('date must be YYYYMMDD');
  const summaryFile = path.join(ROOT, rootDir, compact, 'summary.json');
  const dispositionFile = path.join(ROOT, 'data_market_constraints', compact, 'disposition.json');
  const summary = readJson(summaryFile, null);
  const disposition = readJson(dispositionFile, null);
  if (!Array.isArray(summary?.stocks)) {
    return { date: compact, skipped: true, reason: 'missing_summary' };
  }
  const complete = disposition?.complete_market_coverage === true;
  const activeCodes = new Set(complete ? (disposition.active_stock_codes || []).map(String) : []);
  let activeCount = 0;
  for (const stock of summary.stocks) {
    const active = complete && activeCodes.has(String(stock.stock_code));
    stock.is_disposition_stock = active;
    stock.disposition_data_complete = complete ? 1 : null;
    stock.disposition_stock_status = complete ? 'completed' : disposition ? 'incomplete' : 'unavailable';
    if (active) activeCount += 1;
  }
  summary.disposition_stock_annotation = {
    calculation_status: complete ? 'completed' : disposition ? 'incomplete' : 'unable_to_calculate',
    source_file: disposition ? `data_market_constraints/${compact}/disposition.json` : null,
    active_stock_count: complete ? activeCodes.size : null,
    matched_prediction_stock_count: complete ? activeCount : null,
  };
  if (!dryRun) atomicWriteJson(summaryFile, summary);
  return {
    date: compact,
    skipped: false,
    calculation_status: summary.disposition_stock_annotation.calculation_status,
    active_stock_count: summary.disposition_stock_annotation.active_stock_count,
    matched_prediction_stock_count: summary.disposition_stock_annotation.matched_prediction_stock_count,
    dry_run: dryRun,
  };
}

function parseArgs(argv) {
  const options = { rootDir: 'data_predictions', date: '', dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--date') options.date = argv[++index] || '';
    else if (arg === '--root') options.rootDir = argv[++index] || '';
    else if (arg === '--dry-run') options.dryRun = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function main(argv = process.argv.slice(2)) {
  const result = annotatePredictionDispositionStocks(parseArgs(argv));
  console.log(JSON.stringify(result));
  return result;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}

module.exports = {
  compactDate,
  annotatePredictionDispositionStocks,
  main,
};
