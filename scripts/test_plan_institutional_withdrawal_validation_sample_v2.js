#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const planner = require('./plan_institutional_withdrawal_validation_sample_v2');
const { assessPersistedStatus } = require('./lib/histock_broker_status_policy');

assert.strictEqual(planner.METHODOLOGY,'institutional-withdrawal-untouched-expansion-protocol-v1');
assert.strictEqual(planner.hashKey('1101'),planner.hashKey('1101'));
assert.notStrictEqual(planner.hashKey('1101'),planner.hashKey('1102'));
assert.deepStrictEqual(planner.DEVELOPMENT,['2330','2317','2454','2382','2303','2449']);
assert.deepStrictEqual(planner.PRIOR_HOLDOUT,['1598','1616','1809','6257','7791']);
assert.deepStrictEqual(planner.VALID_STATES,[
  'coverage_ready','coverage_pending_tdcc','coverage_pending_broker',
  'coverage_terminal_ineligible_common_source','coverage_terminal_ineligible_tdcc','coverage_terminal_ineligible_broker',
]);

const r=(stock,state)=>({stock,coverage_state:state});
let s=planner.selectSample([r('1001','coverage_terminal_ineligible_common_source'),r('1002','coverage_ready'),r('1003','coverage_pending_tdcc'),r('1004','coverage_ready')],10);
assert.deepStrictEqual(s.selected.map(x=>x.stock),['1002']);
assert.strictEqual(s.blocking.stock,'1003');
assert.strictEqual(s.sample_determined,false);

s=planner.selectSample([r('1001','coverage_terminal_ineligible_tdcc'),r('1002','coverage_ready'),r('1003','coverage_terminal_ineligible_broker'),r('1004','coverage_ready')],10);
assert.deepStrictEqual(s.selected.map(x=>x.stock),['1002','1004']);
assert.strictEqual(s.blocking,null);
assert.strictEqual(s.sample_determined,true);
assert.strictEqual(s.terminal_smaller_batch,true);

const ten=Array.from({length:10},(_,i)=>r(String(1100+i),'coverage_ready'));
s=planner.selectSample([...ten,r('9999','coverage_pending_broker')],10);
assert.strictEqual(s.sample_determined,true);
assert.strictEqual(s.selected.length,10);
assert.strictEqual(s.blocking,null);

const degraded=assessPersistedStatus({outcome:'source_empty',diagnostics:{http_status:200,date_visible:true,broker_keywords_visible:true,table_rows:1,response_bytes:10000}},{referenceResponseBytes:30000});
assert.strictEqual(degraded.retryable,true);
assert.strictEqual(degraded.terminal,false);
assert.strictEqual(degraded.classification,'ambiguous_degraded_source_empty');

const source=fs.readFileSync(path.join(__dirname,'plan_institutional_withdrawal_validation_sample_v2.js'),'utf8');
for(const forbidden of ['validation-outcomes-v1.json','validation-metrics-v1.json','v6-1-event-diagnosis','v61_outcome','future_return','max_drawdown']) {
  assert.strictEqual(source.includes(forbidden),false,`sample planner must not depend on ${forbidden}`);
}
assert.strictEqual(source.includes('data_history_sma/trading_days.json'),true,'forbidden calendar must be explicitly documented');

console.log('Batch 2 sample planner contract tests passed');
