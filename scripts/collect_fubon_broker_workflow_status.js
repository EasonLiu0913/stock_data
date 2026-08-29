#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function getArg(argv, name, fallback = '') {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] !== undefined ? argv[index + 1] : fallback;
}

function collectFromPayload(payload, expectedDate, crawlOutcome = 'unknown') {
  const stocks = payload && typeof payload.stocks === 'object' && payload.stocks ? Object.keys(payload.stocks).length : 0;
  const unavailable = Array.isArray(payload?.unavailableStocks) ? payload.unavailableStocks.length : Number(payload?.unavailableStockCount || 0);
  const failed = Array.isArray(payload?.failedStocks) ? payload.failedStocks.length : Number(payload?.failedStockCount || 0);
  const expectedCount = Number(payload?.stockUniverse?.expectedStockCount);
  const successfulCount = Number(payload?.successfulStockCount);
  const actualSuccess = Number.isInteger(successfulCount) && successfulCount >= 0 ? successfulCount : stocks;
  const actualExpected = Number.isInteger(expectedCount) && expectedCount >= 0 ? expectedCount : actualSuccess + unavailable + failed;
  const missing = Math.max(0, actualExpected - actualSuccess - unavailable);
  const validationComplete = payload?.complete === true
    && failed === 0
    && actualSuccess === stocks
    && actualExpected === actualSuccess + unavailable;

  return {
    workflow: 'crawl-fubon-broker-details.yml',
    expected_date: expectedDate || null,
    actual_date: expectedDate || null,
    expected_count: actualExpected,
    success_count: actualSuccess + unavailable,
    missing_count: missing,
    crawl_outcome: crawlOutcome,
    source_status: validationComplete ? 'complete' : (missing > 0 ? 'partial' : 'failed'),
    source_error: validationComplete ? '' : `failedStockCount=${failed}; unavailableStockCount=${unavailable}`,
    validation_complete: validationComplete,
    details: {
      successful_stock_count: actualSuccess,
      unavailable_stock_count: unavailable,
      failed_stock_count: failed,
    },
  };
}

function main(argv = process.argv.slice(2)) {
  const expectedDate = getArg(argv, '--expected-date').replace(/[^0-9]/g, '');
  const inputFile = path.resolve(getArg(argv, '--input-file'));
  const crawlOutcome = getArg(argv, '--crawl-outcome', 'unknown');
  const output = path.resolve(getArg(argv, '--output'));
  if (!expectedDate || !inputFile || !output) throw new Error('--expected-date, --input-file and --output are required');
  if (!fs.existsSync(inputFile)) {
    fs.writeFileSync(output, `${JSON.stringify({
      workflow: 'crawl-fubon-broker-details.yml',
      expected_date: expectedDate,
      actual_date: null,
      expected_count: null,
      success_count: 0,
      missing_count: null,
      crawl_outcome: crawlOutcome,
      source_status: 'failed',
      source_error: `Output file not found: ${inputFile}`,
      validation_complete: false,
    }, null, 2)}\n`, 'utf8');
    return;
  }
  const payload = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  fs.writeFileSync(output, `${JSON.stringify(collectFromPayload(payload, expectedDate, crawlOutcome), null, 2)}\n`, 'utf8');
}

if (require.main === module) {
  try { main(); } catch (error) {
    console.error(`Failed to collect Fubon broker workflow status: ${error.message || error}`);
    process.exit(1);
  }
}

module.exports = { collectFromPayload, main };
