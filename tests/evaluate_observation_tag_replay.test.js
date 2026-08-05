'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  buildFiveDayCloseOutcomes,
  evaluateObservationTag,
} = require('../scripts/evaluate_observation_tag_replay');

const DATES = ['20260805', '20260806', '20260807', '20260810', '20260811'];

function slashDate(date) {
  return `${date.slice(0, 4)}/${date.slice(4, 6)}/${date.slice(6, 8)}`;
}

function createWorkspace(finalCloses) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'observation-tag-replay-'));
  const directory = path.join(root, 'data_fubon');
  fs.mkdirSync(directory, { recursive: true });
  for (const date of DATES) {
    const payload = {};
    for (const [code, finalClose] of Object.entries(finalCloses)) {
      payload[code] = {
        [slashDate(date)]: {
          Price: date === DATES.at(-1) ? finalClose : 100,
          High: date === DATES.at(-1) ? finalClose : 100,
        },
      };
    }
    fs.writeFileSync(
      path.join(directory, `fubon_${date}_sma.json`),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8',
    );
  }
  return root;
}

function replayRows(codes) {
  return codes.map(code => ({
    stock_code: code,
    stock_name: code,
    actual: { official_or_adjusted_reference_price: 100 },
  }));
}

test('five-day observation replay prefers 0050 as the benchmark', t => {
  const root = createWorkspace({ '0050': 102, '2330': 98, '2303': 105 });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const outcomes = buildFiveDayCloseOutcomes(
    replayRows(['0050', '2330', '2303']),
    '20260805',
    root,
  );
  assert.equal(outcomes.status, 'completed');
  assert.equal(outcomes.benchmark_source, '0050');
  assert.equal(outcomes.benchmark_return_5d_pct, 2);
  assert.equal(outcomes.by_code.get('2330').market_excess_return_5d_pct, -4);
  assert.equal(outcomes.by_code.get('2303').market_excess_return_5d_pct, 3);
});

test('five-day observation replay falls back to the cross-section median', t => {
  const root = createWorkspace({ '2330': 98, '2303': 105 });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const outcomes = buildFiveDayCloseOutcomes(
    replayRows(['2330', '2303']),
    '20260805',
    root,
  );
  assert.equal(outcomes.benchmark_source, 'cross_section_median');
  assert.equal(outcomes.benchmark_return_5d_pct, 1.5);
  assert.equal(outcomes.by_code.get('2330').market_excess_return_5d_pct, -3.5);
  assert.equal(outcomes.by_code.get('2303').market_excess_return_5d_pct, 3.5);
});

test('observation replay uses risk-specific labels instead of strategy accuracy labels', t => {
  const root = createWorkspace({ '0050': 102, '2330': 98, '2303': 105 });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const outcomes = buildFiveDayCloseOutcomes(
    replayRows(['0050', '2330', '2303']),
    '20260805',
    root,
  );
  const evaluation = evaluateObservationTag(
    {
      tag_id: 'margin_crowding_capitulation_continuation_risk_v1',
      family_id: 'margin_crowding_capitulation_continuation_risk',
      version: 1,
      label: '融資擁擠恐慌續跌風險',
    },
    {
      count: 2,
      members: ['2330', '2303'],
      calculation_status: 'completed',
    },
    outcomes,
  );
  assert.equal(evaluation.verified_candidates, 2);
  assert.equal(evaluation.hits, 1);
  assert.equal(evaluation.misses, 1);
  assert.equal(evaluation.hit_rate, 50);
  assert.equal(evaluation.stocks.find(item => item.stock_code === '2330').verification_label, '風險印證');
  assert.equal(evaluation.stocks.find(item => item.stock_code === '2303').verification_label, '風險未印證');
  assert.equal(evaluation.affects_strategy_eligibility, false);
  assert.equal(evaluation.affects_prediction_score, false);
});

test('observation replay remains pending before five trading days mature', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'observation-tag-pending-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'data_fubon'), { recursive: true });
  for (const date of DATES.slice(0, 3)) {
    fs.writeFileSync(path.join(root, 'data_fubon', `fubon_${date}_sma.json`), '{}\n', 'utf8');
  }
  const outcomes = buildFiveDayCloseOutcomes(replayRows(['2330']), '20260805', root);
  const evaluation = evaluateObservationTag(
    null,
    { count: 1, members: ['2330'], calculation_status: 'completed' },
    outcomes,
  );
  assert.equal(outcomes.status, 'pending_five_trading_days');
  assert.equal(evaluation.calculation_status, 'pending');
  assert.equal(evaluation.verified_candidates, 0);
  assert.equal(evaluation.stocks[0].verification_label, '尚未驗證');
});
