'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  buildRevenueMonthRange,
  nextRevenueMonth,
  runMopsBackfillTask,
} = require('../scripts/backfill_mops_monthly_revenue_task');

function tempManifest(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-data-mops-task-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, 'manifest.json');
}

function complete(status, companyCount = 900) {
  return {
    valid: true,
    resumable_complete: status === 'baseline_seed' || status === 'likely_complete',
    reason: status === 'collecting' ? 'collecting_requires_refresh' : 'complete',
    metadata: {
      revenue_month: 'fixture',
      company_count: companyCount,
      status,
    },
  };
}

test('month range crosses calendar years without losing order', () => {
  assert.equal(nextRevenueMonth('202412'), '202501');
  assert.deepEqual(buildRevenueMonthRange('202411', '202502'), [
    '202411',
    '202412',
    '202501',
    '202502',
  ]);
});

test('month range preserves existing safety limit', () => {
  assert.throws(
    () => buildRevenueMonthRange('202401', '202404', { maxMonths: 3 }),
    /Safety limit exceeded/,
  );
});

test('likely complete historical month is skipped on resume', async (t) => {
  const manifestPath = tempManifest(t);
  const processed = [];

  const result = await runMopsBackfillTask({
    startMonth: '202401',
    endMonth: '202401',
    manifestPath,
    logger: false,
    rebuildMetadata: false,
    inspectMonth() {
      return complete('likely_complete');
    },
    async processMonth(month) {
      processed.push(month);
    },
  });

  assert.deepEqual(processed, []);
  assert.equal(result.summary.skipped, 1);
  assert.equal(result.summary.done, 0);
});

test('baseline seed can be adopted as an already valid earliest month', async (t) => {
  const manifestPath = tempManifest(t);
  let processed = 0;

  const result = await runMopsBackfillTask({
    startMonth: '202401',
    endMonth: '202401',
    manifestPath,
    logger: false,
    rebuildMetadata: false,
    inspectMonth() {
      return complete('baseline_seed');
    },
    async processMonth() {
      processed += 1;
    },
  });

  assert.equal(processed, 0);
  assert.equal(result.summary.skipped, 1);
});

test('collecting month is refreshed instead of being permanently frozen by resume', async (t) => {
  const manifestPath = tempManifest(t);
  const processed = [];
  let inspection = 0;

  const result = await runMopsBackfillTask({
    startMonth: '202401',
    endMonth: '202401',
    manifestPath,
    logger: false,
    rebuildMetadata: false,
    inspectMonth() {
      inspection += 1;
      return inspection === 1 ? complete('collecting', 850) : complete('likely_complete', 900);
    },
    async processMonth(month) {
      processed.push(month);
    },
  });

  assert.deepEqual(processed, ['202401']);
  assert.equal(result.summary.done, 1);
  assert.equal(result.summary.skipped, 0);
});

test('invalid existing output is rebuilt even if a previous manifest may exist', async (t) => {
  const manifestPath = tempManifest(t);
  let processed = 0;
  let inspection = 0;

  const result = await runMopsBackfillTask({
    startMonth: '202401',
    endMonth: '202401',
    manifestPath,
    logger: false,
    rebuildMetadata: false,
    inspectMonth() {
      inspection += 1;
      if (inspection === 1) {
        return { valid: false, resumable_complete: false, reason: 'missing_output' };
      }
      return complete('likely_complete');
    },
    async processMonth() {
      processed += 1;
    },
  });

  assert.equal(processed, 1);
  assert.equal(result.summary.done, 1);
});

test('force mode processes an otherwise resumable complete month', async (t) => {
  const manifestPath = tempManifest(t);
  let processed = 0;

  const result = await runMopsBackfillTask({
    startMonth: '202401',
    endMonth: '202401',
    manifestPath,
    logger: false,
    rebuildMetadata: false,
    force: true,
    inspectMonth() {
      return complete('likely_complete');
    },
    async processMonth() {
      processed += 1;
    },
  });

  assert.equal(processed, 1);
  assert.equal(result.summary.done, 1);
  assert.equal(result.summary.skipped, 0);
});

test('MOPS adapter forwards checkpoint boundaries without owning Git', async (t) => {
  const manifestPath = tempManifest(t);
  const checkpoints = [];
  const processed = [];
  const completed = new Set();

  const result = await runMopsBackfillTask({
    startMonth: '202401',
    endMonth: '202403',
    manifestPath,
    logger: false,
    rebuildMetadata: false,
    checkpointEveryItems: 2,
    hooks: {
      async onCheckpoint(event) {
        checkpoints.push([event.reason, event.validatedSinceCheckpoint]);
      },
    },
    inspectMonth(month) {
      return completed.has(month)
        ? complete('likely_complete')
        : { valid: false, resumable_complete: false, reason: 'missing_output' };
    },
    async processMonth(month) {
      processed.push(month);
      completed.add(month);
    },
  });

  assert.deepEqual(processed, ['202401', '202402', '202403']);
  assert.deepEqual(checkpoints, [
    ['count', 2],
    ['final', 1],
  ]);
  assert.equal(result.summary.done, 3);
});
