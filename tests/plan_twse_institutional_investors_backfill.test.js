'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  isCompletePayload,
  resolveRange,
  buildBatches,
  buildPlan,
} = require('../scripts/plan_twse_institutional_investors_backfill');

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'institutional-plan-'));
  fs.mkdirSync(path.join(root, 'data_twse_institutional_investors'), { recursive: true });
  return root;
}

function writePayload(root, date, payload) {
  fs.writeFileSync(
    path.join(root, 'data_twse_institutional_investors', `${date}_twse_institutional_investors.json`),
    JSON.stringify(payload),
  );
}

function validPayload(date) {
  return {
    date,
    fields: ['證券代號', '證券名稱', '三大法人買賣超股數'],
    data: [['2330', '台積電', '1000']],
  };
}

test('complete payload requires matching date, fields, and rows', () => {
  assert.equal(isCompletePayload(validPayload('20260102'), '20260102'), true);
  assert.equal(isCompletePayload(validPayload('20260103'), '20260102'), false);
  assert.equal(isCompletePayload({ date: '20260102', fields: [], data: [] }, '20260102'), false);
});

test('range uses trading dates only and rejects calendar overflow', () => {
  const dates = ['20260102', '20260105', '20260106'];
  assert.deepEqual(resolveRange(dates, '20260102', '20260105').dates, ['20260102', '20260105']);
  assert.throws(() => resolveRange(dates, '20251231', '20260105'), /exceeds trading calendar coverage/);
});

test('planner selects missing and invalid files, then batches sequentially', () => {
  const root = makeRoot();
  const dates = ['20260102', '20260105', '20260106', '20260107', '20260108'];
  writePayload(root, '20260102', validPayload('20260102'));
  writePayload(root, '20260105', { date: '20260105', fields: [], data: [] });
  fs.writeFileSync(
    path.join(root, 'data_twse_institutional_investors', '20260106_twse_institutional_investors.json'),
    '{broken',
  );

  const plan = buildPlan({
    root,
    tradingDates: dates,
    from: '20260102',
    to: '20260108',
    maxDates: 2,
  });

  assert.equal(plan.required_date_count, 5);
  assert.equal(plan.complete_date_count, 1);
  assert.deepEqual(plan.missing_dates, ['20260105', '20260106', '20260107', '20260108']);
  assert.equal(plan.batch_count, 2);
  assert.deepEqual(plan.matrix.include.map(batch => batch.dates), [
    '20260105,20260106',
    '20260107,20260108',
  ]);
});

test('force mode plans every trading date', () => {
  const root = makeRoot();
  const dates = ['20260102', '20260105'];
  for (const date of dates) writePayload(root, date, validPayload(date));

  const plan = buildPlan({ root, tradingDates: dates, force: true, maxDates: 10 });
  assert.deepEqual(plan.missing_dates, dates);
  assert.equal(plan.complete_date_count, 2);
  assert.equal(plan.batch_count, 1);
});

test('buildBatches preserves ascending date order', () => {
  const batches = buildBatches(['20260102', '20260105', '20260106'], 2);
  assert.equal(batches.length, 2);
  assert.equal(batches[0].first_date, '20260102');
  assert.equal(batches[1].last_date, '20260106');
  assert.equal(batches[1].has_next, false);
});
