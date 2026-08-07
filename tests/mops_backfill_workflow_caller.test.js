'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  checkpointPaths,
  failedMonthsFromSummary,
  relativeToRoot,
} = require('../scripts/run_mops_backfill_workflow');
const { ROOT } = require('../scripts/crawl_mops_monthly_revenue');

test('checkpoint paths include only selected validated month directories and task manifest', () => {
  const manifest = path.join(ROOT, 'data_task_manifests', 'mops-monthly-revenue-backfill.json');
  assert.deepEqual(checkpointPaths(['202402', '202401', '202402'], manifest), [
    'data_mops_monthly_revenue/202401',
    'data_mops_monthly_revenue/202402',
    'data_task_manifests/mops-monthly-revenue-backfill.json',
  ]);
});

test('checkpoint paths deliberately exclude root MOPS indexes', () => {
  const paths = checkpointPaths(['202401']);
  assert.equal(paths.includes('data_mops_monthly_revenue/files.json'), false);
  assert.equal(paths.includes('data_mops_monthly_revenue/manifest.json'), false);
});

test('failed month extraction only returns failed task items', () => {
  assert.deepEqual(failedMonthsFromSummary({
    items: {
      202401: { status: 'done' },
      202402: { status: 'failed' },
      202403: { status: 'pending' },
    },
  }), ['202402']);
});

test('repository-relative path rejects paths outside repository root', () => {
  assert.equal(
    relativeToRoot(path.join(ROOT, 'data_task_manifests', 'task.json')),
    'data_task_manifests/task.json',
  );
  assert.throws(
    () => relativeToRoot(path.resolve(ROOT, '..', 'outside.json')),
    /outside repository root/,
  );
});
