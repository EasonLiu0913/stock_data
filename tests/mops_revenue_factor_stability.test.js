'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mean, stddev, summarizeRow } = require('../scripts/summarize_mops_revenue_factor_stability');

test('mean and stddev summarize monthly uplift values', () => {
  assert.equal(mean([1,2,3]), 2);
  assert.equal(Number(stddev([1,2,3]).toFixed(4)), 0.8165);
});

test('stable positive factor scores above volatile mixed factor', () => {
  const stable = summarizeRow({
    factor_id:'stable', factor_name:'Stable', horizon:'d5', samples:900,
    relative_win_rate_uplift_pp:3, avg_excess_uplift_pct:0.3,
    monthly:[1,2,3,4,5,6].map((_,i)=>({month:`20260${i+1}`,samples:150,relative_win_rate_uplift_pp:3+i*0.1,avg_excess_uplift_pct:0.3+i*0.01}))
  });
  const volatile = summarizeRow({
    factor_id:'volatile', factor_name:'Volatile', horizon:'d5', samples:900,
    relative_win_rate_uplift_pp:3, avg_excess_uplift_pct:0.3,
    monthly:[
      {month:'202601',samples:150,relative_win_rate_uplift_pp:14,avg_excess_uplift_pct:1.8},
      {month:'202602',samples:150,relative_win_rate_uplift_pp:-8,avg_excess_uplift_pct:-1.2},
      {month:'202603',samples:150,relative_win_rate_uplift_pp:12,avg_excess_uplift_pct:1.5},
      {month:'202604',samples:150,relative_win_rate_uplift_pp:-7,avg_excess_uplift_pct:-1.0},
      {month:'202605',samples:150,relative_win_rate_uplift_pp:10,avg_excess_uplift_pct:1.2},
      {month:'202606',samples:150,relative_win_rate_uplift_pp:-6,avg_excess_uplift_pct:-0.8},
    ]
  });
  assert.ok(stable.stability_score > volatile.stability_score);
  assert.ok(stable.win_uplift_stddev_pp < volatile.win_uplift_stddev_pp);
});
