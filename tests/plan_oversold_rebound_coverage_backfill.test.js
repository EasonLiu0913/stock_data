'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildPlan, requiredDatesForEvents } = require('../scripts/plan_oversold_rebound_coverage_backfill');

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

test('buildPlan prioritizes missing dates that affect more events', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-plan-'));
  const researchRoot = path.join(root, 'data_research', 'oversold-rebound');
  writeJson(path.join(researchRoot, 'summary.json'), {
    data_quality: { price: { dates: ['20260102', '20260105', '20260106', '20260107'] } },
  });
  writeJson(path.join(researchRoot, 'event-index.json'), {
    events: [
      { signal_date: '20260106' },
      { signal_date: '20260107' },
      { signal_date: '20260107' },
    ],
  });
  for (const directory of ['data_twse_investment_trust', 'data_twse_dealers']) {
    writeJson(path.join(root, directory, `20260102_${directory.replace('data_', '')}.json`), { data: [['x']] });
  }
  const plan = buildPlan({
    root,
    researchRoot,
    sources: ['institutional'],
    maxDates: 2,
    lookbackDays: 1,
  });
  assert.deepEqual(plan.sources.institutional.selected_dates, ['20260107', '20260106']);
  assert.equal(plan.sources.institutional.missing_date_count, 2);
});
