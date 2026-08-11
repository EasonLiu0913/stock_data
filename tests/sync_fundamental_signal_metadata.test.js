'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  STRATEGY_ID,
  DISPLAY_LABEL,
  signalMetadata,
  syncFundamentalSignalMetadata,
} = require('../scripts/sync_fundamental_signal_metadata');

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
}

test('signalMetadata preserves signal and next-session execution dates', () => {
  const stock = {
    stock_code: '2330',
    registered_strategy_matches: [STRATEGY_ID],
    strategy_tag_features: {
      two_stage_fundamental_signal_date: '20260811',
      two_stage_fundamental_fas_total: 9,
      two_stage_fundamental_fq_score: 12,
      two_stage_fundamental_financial_period: '2026Q2',
    },
  };
  const metadata = signalMetadata(stock, { base_trade_date: '2026-08-11', forecast_date: '2026-08-12' });
  assert.deepEqual(metadata, {
    strategy_id: STRATEGY_ID,
    label: DISPLAY_LABEL,
    signal_date: '2026-08-11',
    execution_date: '2026-08-12',
    fas_score: 9,
    fq_score: 12,
    financial_period: '2026Q2',
    source: 'summary.strategy_tag_features',
  });
});

test('sync writes individual metadata, clears non-matches, and shortens display label', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fundamental-signal-sync-'));
  const predictionDir = path.join(root, 'data_predictions', '20260812');
  const matchingStock = {
    stock_code: '2330',
    registered_strategy_matches: [STRATEGY_ID],
    strategy_tag_features: {
      two_stage_fundamental_signal_date: '20260811',
      two_stage_fundamental_fas_total: 8,
      two_stage_fundamental_fq_score: 10,
      two_stage_fundamental_financial_period: '2026Q2',
    },
  };
  const nonMatchingStock = {
    stock_code: '2317',
    registered_strategy_matches: [],
    strategy_tag_features: {},
    fundamental_signal: { stale: true },
  };
  writeJson(path.join(predictionDir, 'summary.json'), {
    base_trade_date: '2026-08-11',
    forecast_date: '2026-08-12',
    strategy_registry_v2: [{ strategy_id: STRATEGY_ID, label: '基本面雙確認－訊號日直接進場' }],
    strategy_classifications_v2: {
      [STRATEGY_ID]: { label: '基本面雙確認－訊號日直接進場', count: 1, members: ['2330'] },
    },
    group_summary: [{ strategy_id: STRATEGY_ID, group: '基本面雙確認－訊號日直接進場', count: 1 }],
    stocks: [matchingStock, nonMatchingStock],
  });
  writeJson(path.join(predictionDir, 'group-summary.json'), {
    groups: [{ strategy_id: STRATEGY_ID, group: '基本面雙確認－訊號日直接進場', count: 1 }],
  });
  writeJson(path.join(predictionDir, '2330.json'), { stock_code: '2330' });
  writeJson(path.join(predictionDir, '2317.json'), { stock_code: '2317', fundamental_signal: { stale: true } });

  const result = syncFundamentalSignalMetadata({ date: '20260812', workspaceRoot: root });
  assert.equal(result.matched_stocks, 1);

  const summary = JSON.parse(fs.readFileSync(path.join(predictionDir, 'summary.json'), 'utf8'));
  assert.equal(summary.strategy_registry_v2[0].label, DISPLAY_LABEL);
  assert.equal(summary.strategy_classifications_v2[STRATEGY_ID].label, DISPLAY_LABEL);
  assert.equal(summary.group_summary[0].group, DISPLAY_LABEL);
  assert.equal(summary.stocks[0].fundamental_signal.signal_date, '2026-08-11');
  assert.equal(summary.stocks[0].fundamental_signal.execution_date, '2026-08-12');
  assert.equal(summary.stocks[1].fundamental_signal, null);

  const groupSummary = JSON.parse(fs.readFileSync(path.join(predictionDir, 'group-summary.json'), 'utf8'));
  assert.equal(groupSummary.groups[0].group, DISPLAY_LABEL);

  const stock2330 = JSON.parse(fs.readFileSync(path.join(predictionDir, '2330.json'), 'utf8'));
  assert.equal(stock2330.fundamental_signal.signal_date, '2026-08-11');
  assert.equal(stock2330.fundamental_signal.execution_date, '2026-08-12');

  const stock2317 = JSON.parse(fs.readFileSync(path.join(predictionDir, '2317.json'), 'utf8'));
  assert.equal(stock2317.fundamental_signal, null);
});
