'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  syncSummaryPayload,
} = require('../scripts/sync_prediction_dashboard_groups');

test('dashboard summary receives the same strategy groups as group-summary.json', () => {
  const summary = {
    group_summary: [{ group: '舊分類', count: 1 }],
  };
  const groupSummary = {
    groups: [
      { group: '優先觀察', count: 10 },
      {
        group: '衝擊後高信心核心',
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

test('dashboard group sync rejects missing group collections', () => {
  assert.throws(
    () => syncSummaryPayload({}, {}),
    /group-summary groups are required/,
  );
});
