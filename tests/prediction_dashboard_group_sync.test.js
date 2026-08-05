'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  ensureFormalStrategyGroup,
  reconcileVersionedStrategyGroups,
  syncSummaryPayload,
} = require('../scripts/sync_prediction_dashboard_groups');

const FORMAL_TAG = '熊市時防禦抗跌股';

 test('dashboard summary receives the same strategy groups as group-summary.json', () => {
  const summary = {
    group_summary: [{ group: '舊分類', count: 1 }],
  };
  const groupSummary = {
    groups: [
      { group: '優先觀察', count: 10 },
      {
        group: FORMAL_TAG,
        count: 3,
        formal_strategy: true,
        members: ['2207', '2540', '5880'],
      },
    ],
  };

  const result = syncSummaryPayload(summary, groupSummary);
  assert.equal(result.group_summary, groupSummary.groups);
  assert.equal(result.group_summary_source, 'group-summary.json');
  assert.deepEqual(
    result.group_summary.find((group) => group.formal_strategy).members,
    ['2207', '2540', '5880'],
  );
});

test('formal strategy group remains visible when no stocks qualify', () => {
  const summary = {
    formal_strategy_classifications: {
      bear_market_defensive_resilience_v1: {
        environment_code: 'post_shock_day_1',
        active: true,
        count: 0,
        members: [],
      },
    },
  };
  const groupSummary = {
    groups: [{ group: '優先觀察', count: 10 }],
  };

  const group = ensureFormalStrategyGroup(summary, groupSummary);
  assert.equal(group.group, FORMAL_TAG);
  assert.equal(group.count, 0);
  assert.equal(group.average_direction_score, null);
  assert.equal(group.bullish_ratio, 0);
  assert.equal(group.active, true);
  assert.deepEqual(group.members, []);
  assert.ok(groupSummary.groups.some((item) => item.group === FORMAL_TAG));
});

test('legacy formal strategy group is renamed without creating a duplicate', () => {
  const summary = {};
  const groupSummary = {
    groups: [{
      group: '衝擊後高信心核心',
      count: 2,
      formal_strategy: true,
      strategy_id: 'post_shock_high_confidence_core_v1',
      members: ['2207', '2540'],
    }],
  };

  const group = ensureFormalStrategyGroup(summary, groupSummary);
  assert.equal(group.group, FORMAL_TAG);
  assert.equal(groupSummary.groups.length, 1);
});

test('versioned strategy result overrides a stale legacy group count and members', () => {
  const strategyId = 'oversold_margin_exit_rebound_v1';
  const summary = {
    strategy_registry_v2: [{
      strategy_id: strategyId,
      family_id: 'oversold_margin_exit_rebound',
      version: 1,
      label: '融資退場型跌深反彈',
      fixed_display: true,
      enabled: true,
      expression: {
        all: ['technical_3d_sharp_drop_v1', 'technical_below_sma20_v1'],
      },
    }],
    strategy_classifications_v2: {
      [strategyId]: {
        strategy_id: strategyId,
        family_id: 'oversold_margin_exit_rebound',
        version: 1,
        label: '融資退場型跌深反彈',
        fixed_display: true,
        enabled: true,
        calculation_status: 'partial',
        calculation_message: '部分股票資料不足；可計算 1050／1052 檔。',
        count: 2,
        members: ['1225', '6743'],
      },
    },
    stocks: [
      {
        stock_code: '1225',
        direction_score: -11,
        data_completeness: 100,
        final_direction_label: '中性偏空',
        features: { r1: -4, r3: -10, gap_sma20: -12, rsi14: 24 },
      },
      {
        stock_code: '6743',
        direction_score: -8,
        data_completeness: 90,
        final_direction_label: '偏空',
        features: { r1: -3, r3: -9, gap_sma20: -11, rsi14: 27 },
      },
    ],
  };
  const groupSummary = {
    groups: [{
      group: '融資退場型跌深反彈',
      strategy_id: strategyId,
      formal_strategy: true,
      fixed_display: true,
      count: 0,
      members: [],
    }],
  };

  const reconciled = reconcileVersionedStrategyGroups(summary, groupSummary);
  assert.equal(reconciled.length, 1);
  assert.equal(groupSummary.groups.length, 1);
  assert.equal(groupSummary.groups[0].count, 2);
  assert.deepEqual(groupSummary.groups[0].members, ['1225', '6743']);
  assert.equal(groupSummary.groups[0].versioned_strategy, true);
  assert.equal(groupSummary.groups[0].versioned_strategy_source, 'summary.strategy_classifications_v2');
  assert.equal(groupSummary.groups[0].calculation_status, 'partial');
});

test('versioned zero-count strategy stays visible and replaces stale members', () => {
  const strategyId = 'zero_strategy_v1';
  const summary = {
    strategy_registry_v2: [{ strategy_id: strategyId, label: '零筆策略', fixed_display: true }],
    strategy_classifications_v2: {
      [strategyId]: {
        strategy_id: strategyId,
        label: '零筆策略',
        fixed_display: true,
        calculation_status: 'completed',
        count: 0,
        members: [],
      },
    },
    stocks: [],
  };
  const groupSummary = {
    groups: [{ group: '零筆策略', strategy_id: strategyId, count: 1, members: ['2330'] }],
  };

  reconcileVersionedStrategyGroups(summary, groupSummary);
  assert.equal(groupSummary.groups[0].count, 0);
  assert.deepEqual(groupSummary.groups[0].members, []);
  assert.equal(groupSummary.groups[0].status_label, '已完成計算，當日 0 筆');
});

test('versioned strategy sync rejects inconsistent count and member data', () => {
  const strategyId = 'bad_strategy_v1';
  const summary = {
    strategy_classifications_v2: {
      [strategyId]: {
        strategy_id: strategyId,
        label: '錯誤策略',
        count: 2,
        members: ['2330'],
      },
    },
    stocks: [{ stock_code: '2330' }],
  };
  assert.throws(
    () => reconcileVersionedStrategyGroups(summary, { groups: [] }),
    /count\/member mismatch/,
  );
});

test('dashboard group sync rejects missing group collections', () => {
  assert.throws(
    () => syncSummaryPayload({}, {}),
    /group-summary groups are required/,
  );
});

test('replay view loads formal strategy enhancement directly', () => {
  const html = fs.readFileSync(
    path.resolve(__dirname, '../public/prediction-replay-dashboard-view.html'),
    'utf8',
  );
  assert.match(
    html,
    /<script src="prediction-replay-formal-strategy-enhancement\.js\?v=3"><\/script>/,
  );
});
