'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {replay}=require('../scripts/replay_daily_gainers_m1_breadth_for_m3');
const raw=fs.readFileSync(path.resolve(__dirname,'../data_twse_mi_index/20261008_twse_mi_index.json'));
const ref=require('../data_research/twse-market-opening/20261008-m1v2-prompt-a-official-market-breadth-evidence.json');
test('replay actual dated full raw source SHA and five official stock-column buckets',()=>{
 const x=replay();assert.deepEqual(x.counts,{advancers:425,decliners:540,unchanged:109,no_trade_count:3,no_comparison_count:5});assert.equal(x.total,1082);assert.equal(x.individual_gainers_certified,false);
});
test('tampered full raw bytes fail SHA before reading figures',()=>{
 const b=Buffer.from(raw);b[b.length-2]^=1;assert.throws(()=>replay(b,ref),/M1_ORIGINAL_SHA_MISMATCH/);
});
test('wrong accepted count fails independent replay',()=>{
 const x=structuredClone(ref);x.source.stock_counts.advancers=426;assert.throws(()=>replay(raw,x),/M1_ACCEPTED_BREADTH_DRIFT/);
});
test('invalid date and swapped aggregate category rejected',()=>{
 const x=structuredClone(ref);x.target_date='20261007';assert.throws(()=>replay(raw,x),/M1_SOURCE_DATE_STATUS/);
});
