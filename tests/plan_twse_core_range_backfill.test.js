'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  buildPlan,
  sourceDateComplete,
} = require('../scripts/plan_twse_core_range_backfill');
const { CSV_HEADERS } = require('../scripts/crawl_twse_margin_balance');

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'twse-core-backfill-'));
  fs.mkdirSync(path.join(root, 'data_twse_market_chart'), { recursive: true });
  fs.mkdirSync(path.join(root, 'data_twse_mi_index'), { recursive: true });
  fs.mkdirSync(path.join(root, 'data_twse_margin_balance'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data_twse_market_chart', 'market_chart.json'), JSON.stringify({
    data: ['20260102', '20260105', '20260106', '20260107', '20260108'].map(date => ({ date })),
  }));
  return root;
}

function writeMiIndex(root, date, valid = true) {
  fs.writeFileSync(path.join(root, 'data_twse_mi_index', `${date}_twse_mi_index.json`), JSON.stringify(valid ? {
    stat: 'OK',
    date,
    tables: [{ fields: ['證券代號'], data: [['2330']] }],
  } : { stat: 'OK', date, tables: [] }));
}

function writeMargin(root, date, valid = true) {
  const file = path.join(root, 'data_twse_margin_balance', `${date}_twse_margin_balance.csv`);
  fs.writeFileSync(file, valid
    ? `${CSV_HEADERS.join(',')}\n2330,台積電,1,2,0,10,9,100,1,0,0,5,4,100,0,\n`
    : 'bad,data\n');
}

test('plans only missing trading dates and splits chronological batches', () => {
  const root = makeRoot();
  try {
    writeMiIndex(root, '20260102');
    writeMiIndex(root, '20260106');
    const plan = buildPlan({
      root,
      calendarFile: path.join(root, 'data_twse_market_chart', 'market_chart.json'),
      sources: ['mi_index'],
      from: '20260102',
      to: '20260108',
      maxDates: 2,
    });
    const detail = plan.sources.mi_index;
    assert.deepEqual(detail.missing_dates, ['20260105', '20260107', '20260108']);
    assert.equal(detail.batch_count, 2);
    assert.equal(detail.batches[0].dates, '20260105,20260107');
    assert.equal(detail.batches[1].dates, '20260108');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('force plans every trading date even when files are complete', () => {
  const root = makeRoot();
  try {
    for (const date of ['20260102', '20260105', '20260106']) writeMargin(root, date);
    const plan = buildPlan({
      root,
      calendarFile: path.join(root, 'data_twse_market_chart', 'market_chart.json'),
      sources: ['margin'],
      from: '20260102',
      to: '20260106',
      maxDates: 10,
      force: true,
    });
    assert.deepEqual(plan.sources.margin.missing_dates, ['20260102', '20260105', '20260106']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('invalid existing files are treated as missing', () => {
  const root = makeRoot();
  try {
    writeMiIndex(root, '20260102', false);
    writeMargin(root, '20260102', false);
    assert.equal(sourceDateComplete(root, 'mi_index', '20260102'), false);
    assert.equal(sourceDateComplete(root, 'margin', '20260102'), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rejects a range wider than the trading calendar', () => {
  const root = makeRoot();
  try {
    assert.throws(() => buildPlan({
      root,
      calendarFile: path.join(root, 'data_twse_market_chart', 'market_chart.json'),
      sources: ['mi_index'],
      from: '20251231',
      to: '20260108',
    }), /exceeds trading calendar coverage/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
