'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('crawler only skips rows with complete target-date institutional data', () => {
  const source = read('scripts/crawl_institutional_data.js');
  assert.match(source, /!hasTargetDate\(existingData\[stock\], targetRocDate\)/);
  assert.match(source, /getTradingDayStatus\(targetDateStr\)/);
});

test('crawler retry and reconcile share the same eligible stock universe', () => {
  const crawler = read('scripts/crawl_institutional_data.js');
  const retry = read('scripts/retry_institutional_failed.js');
  const reconcile = read('scripts/reconcile_institutional_data.js');
  assert.match(crawler, /readEligibleStockUniverse\(twseIndustryCsvPath\)/);
  assert.match(crawler, /filterInstitutionalDataToUniverse/);
  assert.match(retry, /readEligibleStockUniverse\(twseIndustryCsvPath\)/);
  assert.match(retry, /isEligibleInstitutionalStockCode/);
  assert.match(retry, /filterInstitutionalDataToUniverse/);
  assert.match(reconcile, /readEligibleStockUniverse\(path\.join\(repoRoot, 'data_twse', 'twse_industry\.csv'\)\)/);
  assert.doesNotMatch(reconcile, /function readStockUniverse/);
});

test('crawler and retry preserve structured failure reasons', () => {
  const crawler = read('scripts/crawl_institutional_data.js');
  const retry = read('scripts/retry_institutional_failed.js');
  assert.match(crawler, /reason: institutionalData\.skipReason \|\| 'OTHER_ERROR'/);
  assert.match(retry, /reason:data\.skipReason\|\|'OTHER_ERROR'/);
  assert.match(retry, /reason:'REQUEST_ERROR'/);
});

test('retry drops stale failed items that are already complete', () => {
  const source = read('scripts/retry_institutional_failed.js');
  assert.match(source, /failedList = failedList\.filter\(\(item\) => !hasTargetDate/);
});

test('reconcile directly guards non-trading days and exposes anomaly flags', () => {
  const source = read('scripts/reconcile_institutional_data.js');
  assert.match(source, /getTradingDayStatus\(targetDateStr\)/);
  assert.match(source, /UNIVERSE_TOO_SMALL/);
  assert.match(source, /SENTINEL_MISSING/);
  assert.match(source, /REFERENCE_VALID_DROP_GT_10_PERCENT/);
});

test('institutional workflows use explicit reusable Pages deploy and Actions summary', () => {
  for (const file of ['.github/workflows/crawl-institutional.yml', '.github/workflows/retry-institutional.yml']) {
    const source = read(file);
    assert.doesNotMatch(source, /workflow_run/);
    assert.match(source, /uses: \.\/\.github\/workflows\/deploy-pages\.yml/);
    assert.match(source, /write_institutional_actions_summary\.js/);
  }
});

test('foreign page keeps the selected sort when date or institution changes', () => {
  const source = read('public/foreign.html');
  assert.doesNotMatch(source, /pendingDefaultHeaderSortKey='day0'/);
  assert.match(source, /async function onDateChanged\(\)\{pendingDefaultHeaderSortKey=null/);
  assert.match(source, /async function onTypeChanged\(\).*pendingDefaultHeaderSortKey=null/);
});
