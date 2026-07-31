'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  ensureFormalStrategyGroup,
  syncSummaryPayload,
} = require('../scripts/sync_prediction_dashboard_groups');

const FORMAL_TAG = '衝擊後高信心核心';

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
      post_shock_high_confidence_core_v1: {
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
    /<script src="prediction-replay-formal-strategy-enhancement\.js\?v=2"><\/script>/,
  );
});
