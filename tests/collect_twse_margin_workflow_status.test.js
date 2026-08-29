'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { collect } = require('../scripts/collect_twse_margin_workflow_status');
const { CSV_HEADERS } = require('../scripts/crawl_twse_margin_balance');

test('collector validates an existing expected-date CSV without network probing', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'twse-margin-status-'));
  const file = path.join(dir, '20260828_twse_margin_balance.csv');
  fs.writeFileSync(file, `${CSV_HEADERS.join(',')}\n2330,台積電,1,1,0,1,1,1,0,0,0,0,0,0,0,\n`, 'utf8');
  const result = await collect({ expectedDate: '20260828', outputFile: file, crawlOutcome: 'success', fetchLatest: async () => { throw new Error('must not probe'); } });
  assert.equal(result.validation_complete, true);
  assert.equal(result.actual_date, '20260828');
  assert.equal(result.success_count, 1);
});

test('collector records official latest date when target data is absent', async () => {
  const result = await collect({ expectedDate: '20260828', outputFile: '/tmp/does-not-exist.csv', crawlOutcome: 'failure', fetchLatest: async () => ({ date: '20260827' }) });
  assert.equal(result.validation_complete, false);
  assert.equal(result.actual_date, '20260827');
  assert.equal(result.source_status, 'data_not_updated');
});
