#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { fetchLatestCsv, validateCsv } = require('./crawl_twse_margin_balance');

function getArg(argv, name, fallback = '') {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] !== undefined ? argv[index + 1] : fallback;
}

async function collect(options = {}) {
  const expectedDate = String(options.expectedDate || '').replace(/[^0-9]/g, '');
  const outputFile = path.resolve(options.outputFile || '');
  const crawlOutcome = String(options.crawlOutcome || 'unknown');
  const errorLogFile = options.errorLogFile ? path.resolve(options.errorLogFile) : '';
  let sourceError = '';
  let actualDate = '';
  let successCount = null;
  let validationComplete = false;
  let sourceStatus = crawlOutcome === 'failure' ? 'failed' : 'unknown';

  if (outputFile && fs.existsSync(outputFile)) {
    try {
      successCount = validateCsv(fs.readFileSync(outputFile, 'utf8'));
      actualDate = expectedDate;
      validationComplete = true;
      sourceStatus = 'complete';
    } catch (error) {
      sourceError = error.message || String(error);
      sourceStatus = 'failed';
    }
  }

  if (!validationComplete) {
    if (errorLogFile && fs.existsSync(errorLogFile)) {
      sourceError = fs.readFileSync(errorLogFile, 'utf8').trim().slice(-8000) || sourceError;
    }
    try {
      const latest = await (options.fetchLatest || fetchLatestCsv)();
      actualDate = latest.date || actualDate;
      if (expectedDate && actualDate && expectedDate !== actualDate) sourceStatus = 'data_not_updated';
    } catch (error) {
      if (!sourceError) sourceError = error.message || String(error);
    }
  }

  return {
    workflow: 'crawl-twse-margin-balance.yml',
    expected_date: expectedDate || null,
    actual_date: actualDate || null,
    expected_count: null,
    success_count: successCount,
    missing_count: null,
    crawl_outcome: crawlOutcome,
    source_status: sourceStatus,
    source_error: sourceError,
    validation_complete: validationComplete,
    details: { output_file: outputFile || null },
  };
}

async function main(argv = process.argv.slice(2)) {
  const expectedDate = getArg(argv, '--expected-date');
  const outputFile = getArg(argv, '--output-file');
  const crawlOutcome = getArg(argv, '--crawl-outcome', 'unknown');
  const errorLogFile = getArg(argv, '--error-log');
  const output = getArg(argv, '--output');
  if (!expectedDate || !outputFile || !output) throw new Error('--expected-date, --output-file and --output are required');
  const status = await collect({ expectedDate, outputFile, crawlOutcome, errorLogFile });
  fs.writeFileSync(output, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Failed to collect TWSE margin workflow status: ${error.message || error}`);
    process.exit(1);
  });
}

module.exports = { collect, main };
