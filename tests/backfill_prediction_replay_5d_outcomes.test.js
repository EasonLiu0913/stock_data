'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  backfillFiveDayOutcomes,
  outcomeForStock,
} = require('../scripts/backfill_prediction_replay_5d_outcomes');

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
}

function pricePayload(date, highs) {
  const slash = `${date.slice(0, 4)}/${date.slice(4, 6)}/${date.slice(6, 8)}`;
  return Object.fromEntries(Object.entries(highs).map(([code, high]) => [code, {
    [slash]: { Price: high - 1, High: high, Low: high - 2, Open: high - 1.5, Volume: 1000 },
  }]));
}

function prepareReplay(root, date = '20260701') {
  const predictionDir = path.join(root, 'data_predictions', date);
  writeJson(path.join(predictionDir, 'replay.json'), {
    rows: [
      { stock_code: '2330', actual: { official_or_adjusted_reference_price: 100 } },
      { stock_code: '2317', actual: { official_or_adjusted_reference_price: 50 } },
    ],
  });
  writeJson(path.join(predictionDir, 'replay-dashboard.json'), {
    rows: [
      { stock_code: '2330', actual: { close_return: 1 } },
      { stock_code: '2317', actual: { close_return: 2 } },
    ],
  });
  writeJson(path.join(predictionDir, 'replay-summary.json'), { prediction_date: '2026-07-01' });
}

test('pending result does not require replay files before five trading dates exist', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-5d-pending-'));
  for (const date of ['20260701', '20260702', '20260703', '20260706']) {
    writeJson(path.join(root, 'data_fubon', `fubon_${date}_sma.json`), {});
  }
  const result = backfillFiveDayOutcomes('20260701', { workspaceRoot: root });
  assert.equal(result.status, 'pending_five_trading_days');
  assert.equal(result.changed, false);
  assert.equal(result.available_window_dates.length, 4);
});

test('five-day backfill writes exact peak return, protects corporate actions, and is idempotent', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-5d-complete-'));
  const dates = ['20260701', '20260702', '20260703', '20260706', '20260707'];
  const highs = [100, 105, 111, 108, 109];
  dates.forEach((date, index) => writeJson(
    path.join(root, 'data_fubon', `fubon_${date}_sma.json`),
    pricePayload(date, { '2330': highs[index], '2317': 55 + index }),
  ));
  writeJson(path.join(root, 'data_twse_twt48u', 'result.json'), {
    fields: ['除權除息日期', '股票代號'],
    data: [['115年07月03日', '2317']],
  });
  prepareReplay(root);

  const first = backfillFiveDayOutcomes('20260701', { workspaceRoot: root });
  assert.equal(first.status, 'completed');
  assert.equal(first.changed, true);
  assert.equal(first.completed_count, 1);
  assert.equal(first.hit_10pct_count, 1);

  const dashboard = JSON.parse(fs.readFileSync(
    path.join(root, 'data_predictions', '20260701', 'replay-dashboard.json'),
    'utf8',
  ));
  assert.equal(dashboard.rows[0].actual.max_return_5d, 11);
  assert.equal(dashboard.rows[0].actual.max_return_5d_date, '20260703');
  assert.equal(dashboard.rows[0].actual.max_return_5d_status, 'completed');
  assert.equal(dashboard.rows[1].actual.max_return_5d, null);
  assert.equal(dashboard.rows[1].actual.max_return_5d_status, 'corporate_action_in_window');

  const second = backfillFiveDayOutcomes('20260701', { workspaceRoot: root });
  assert.equal(second.changed, false);
});

test('outcome remains unavailable when the stock price window is incomplete', () => {
  const snapshots = new Map([
    ['20260701', { '2330': { '2026/07/01': { High: 100 } } }],
    ['20260702', { '2330': { '2026/07/02': { High: 101 } } }],
    ['20260703', {}],
    ['20260706', { '2330': { '2026/07/06': { High: 103 } } }],
    ['20260707', { '2330': { '2026/07/07': { High: 104 } } }],
  ]);
  const result = outcomeForStock({
    code: '2330',
    referencePrice: 100,
    dates: [...snapshots.keys()],
    snapshots,
    actions: { status: 'completed', byCode: new Map() },
  });
  assert.equal(result.status, 'incomplete_stock_price_window');
  assert.equal(result.max_return_5d, null);
});
