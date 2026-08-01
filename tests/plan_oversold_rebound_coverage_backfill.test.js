'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  buildBatches,
  buildPlan,
  requiredDatesForEvents,
} = require('../scripts/plan_oversold_rebound_coverage_backfill');

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
}

test('requiredDatesForEvents includes trading-day lookback and event impact', () => {
  const dates = ['20260102', '20260105', '20260106', '20260107'];
  const impacts = requiredDatesForEvents(dates, new Map([['20260107', 3]]), 3, null, null);
  assert.deepEqual([...impacts.entries()], [
    ['20260105', 3],
    ['20260106', 3],
    ['20260107', 3],
  ]);
});

test('buildBatches splits every missing date into sequential batches without loss', () => {
  const batches = buildBatches(
    'institutional',
    ['20260107', '20260106', '20260105', '20260102', '20251231'],
    2,
  );

  assert.deepEqual(batches, [
    {
      source: 'institutional',
      batch_index: 1,
      batch_count: 3,
      dates: '20260107,20260106',
      date_count: 2,
      first_date: '20260107',
      last_date: '20260106',
      has_next: true,
    },
    {
      source: 'institutional',
      batch_index: 2,
      batch_count: 3,
      dates: '20260105,20260102',
      date_count: 2,
      first_date: '20260105',
      last_date: '20260102',
      has_next: true,
    },
    {
      source: 'institutional',
      batch_index: 3,
      batch_count: 3,
      dates: '20251231',
      date_count: 1,
      first_date: '20251231',
      last_date: '20251231',
      has_next: false,
    },
  ]);
});

test('buildPlan prioritizes missing dates and exposes all automatic batches', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-plan-'));
  const researchRoot = path.join(root, 'data_research', 'oversold-rebound');
  writeJson(path.join(researchRoot, 'summary.json'), {
    data_quality: { price: { dates: ['20260102', '20260105', '20260106', '20260107'] } },
  });
  writeJson(path.join(researchRoot, 'event-index.json'), {
    events: [
      { signal_date: '20260105' },
      { signal_date: '20260106' },
      { signal_date: '20260107' },
      { signal_date: '20260107' },
    ],
  });

  const plan = buildPlan({
    root,
    researchRoot,
    sources: ['institutional'],
    maxDates: 2,
    lookbackDays: 1,
  });
  const institutional = plan.sources.institutional;

  assert.deepEqual(institutional.selected_dates, ['20260107', '20260105']);
  assert.equal(institutional.missing_date_count, 3);
  assert.equal(institutional.batch_size, 2);
  assert.equal(institutional.batch_count, 2);
  assert.deepEqual(institutional.all_missing_dates, ['20260107', '20260105', '20260106']);
  assert.deepEqual(institutional.matrix.include.map(batch => batch.dates), [
    '20260107,20260105',
    '20260106',
  ]);
  assert.equal(institutional.matrix.include[0].has_next, true);
  assert.equal(institutional.matrix.include[1].has_next, false);
});

test('workflow executes every planned batch sequentially and refreshes once at the end', () => {
  const workflow = fs.readFileSync(
    path.join(__dirname, '..', '.github', 'workflows', 'backfill-oversold-rebound-coverage.yml'),
    'utf8',
  );
  assert.match(workflow, /matrix:\s+\$\{\{\s*fromJSON\(needs\.plan\.outputs\.matrix\)\s*\}\}/);
  assert.match(workflow, /max-parallel:\s*1/);
  assert.match(workflow, /Backfill batch and commit every completed date/);
  assert.match(workflow, /needs:\s*\[plan, backfill\]/);
  assert.match(workflow, /Rebuild research and Dashboard once/);
});
