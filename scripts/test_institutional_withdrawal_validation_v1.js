#!/usr/bin/env node
'use strict';
const assert=require('assert');
const {maxDrawdownPct,windowMetric,bootstrapDifference,summarizeGroup}=require('./compute_institutional_withdrawal_validation_outcomes_v1');

assert.strictEqual(maxDrawdownPct([100,110,99,105]),-10);
assert.strictEqual(maxDrawdownPct([100,101,102]),0);

const dates=[];for(let i=1;i<=40;i++)dates.push(`2026-01-${String(i).padStart(2,'0')}`);
const pvMap=new Map();for(let i=0;i<dates.length;i++)pvMap.set(`1598|${dates[i]}`,{close:100+i});
let m=windowMetric('1598',dates[0],20,dates,pvMap);
assert.strictEqual(m.status,'resolved');
assert.strictEqual(m.window_start,dates[1]);
assert.strictEqual(m.window_end,dates[20]);
assert.strictEqual(m.session_dates.length,20);
pvMap.delete(`1598|${dates[7]}`);
m=windowMetric('1598',dates[0],20,dates,pvMap);
assert.strictEqual(m.status,'unresolved_for_metric');
assert.strictEqual(m.reason,'missing_ohlcv_inside_exact_session_window');
assert.deepStrictEqual(m.missing_ohlcv_dates,[dates[7]]);

const small=bootstrapDifference([1,2,3],[4,5,6]);
assert.strictEqual(small.status,'not_emitted');
const enough=bootstrapDifference(Array(8).fill(1),Array(8).fill(2),100,123);
assert.strictEqual(enough.status,'emitted');
assert.strictEqual(enough.point_estimate,-1);
assert.deepStrictEqual(enough.ci_95,[-1,-1]);

const events=[{metrics:{return_20d:{status:'resolved',total_return_pct:-2,max_drawdown_pct:-5,negative_return:true},return_30d:{status:'unresolved_for_metric'},structural_repair_30d:{status:'resolved',structural_repair:false}}}];
const s=summarizeGroup(events);
assert.strictEqual(s.event_n,1);assert.strictEqual(s.return_20d_pct.n,1);assert.strictEqual(s.return_30d_pct.unresolved,1);assert.strictEqual(s.negative_return_20d.rate,1);assert.strictEqual(s.structural_repair_30d.rate,0);
console.log('Institutional Withdrawal validation outcome-pipeline unit tests passed');
