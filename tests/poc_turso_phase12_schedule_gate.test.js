'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {evaluate}=require('../scripts/poc_turso_phase12_schedule_gate');

const trading=(date)=>({date,isTradingDay:date!=='20261009',calendarCovered:true,reason:date==='20261009'?'MARKET_HOLIDAY':'TRADING_DAY'});
const fake=(has=true)=>({canonicalRoot:'/isolated/main',tradingDay:trading,exists:()=>has});
test('first scheduled slot resolves 20261007 and uses exact current canonical date',()=>{
 const result=evaluate({...fake(),eventName:'schedule',schedule:'47 11 * * 1-5',now:new Date('2026-10-07T11:55:00Z')});
 assert.equal(result.target_date,'20261007');
 assert.equal(result.classification,'READY');
 assert.equal(result.ready,true);
 assert.equal(result.scheduled_at_utc,'2026-10-07T11:47:00.000Z');
});
test('second scheduled retry same date is eligible but collector ledger is idempotent',()=>{
 const result=evaluate({...fake(),eventName:'schedule',schedule:'17 13 * * 1-5',now:new Date('2026-10-07T13:20:00Z')});
 assert.equal(result.target_date,'20261007');assert.equal(result.ready,true);
});
test('delayed scheduled invocation crossing Taipei midnight uses occurrence date',()=>{
 const result=evaluate({...fake(),eventName:'schedule',schedule:'17 13 * * 1-5',now:new Date('2026-10-07T17:50:00Z')});
 assert.equal(result.target_date,'20261007'); assert.equal(result.ready,true);assert.equal(result.delay_minutes,273);
});
test('excessive GitHub schedule delay fails closed',()=>{
 const result=evaluate({...fake(),eventName:'schedule',schedule:'17 13 * * 1-5',now:new Date('2026-10-08T00:18:00Z')});
 assert.equal(result.target_date,'20261007');assert.equal(result.classification,'SCHEDULE_DELAY_EXCEEDED');assert.equal(result.ready,false);
});
test('official TWSE holiday not counted',()=>{
 const result=evaluate({...fake(),eventName:'schedule',schedule:'47 11 * * 1-5',now:new Date('2026-10-09T11:48:00Z')});
 assert.equal(result.classification,'NON_TRADING_DAY');assert.equal(result.ready,false);
});
test('missing canonical current-date file is waiting, not prior-date fallback',()=>{
 const result=evaluate({...fake(false),eventName:'schedule',schedule:'47 11 * * 1-5',now:new Date('2026-10-07T11:50:00Z')});
 assert.equal(result.target_date,'20261007');assert.equal(result.classification,'WAITING_CANONICAL');
});
test('manual explicit date can collect today',()=>{
 const result=evaluate({...fake(),eventName:'workflow_dispatch',inputDate:'20261007',now:new Date('2026-10-07T11:00:00Z')});
 assert.equal(result.target_date,'20261007');assert.equal(result.ready,true);
});
test('manual historical date cannot manufacture live evidence',()=>{
 const result=evaluate({...fake(),eventName:'workflow_dispatch',inputDate:'20261006',now:new Date('2026-10-07T11:00:00Z')});
 assert.equal(result.classification,'MANUAL_DATE_NOT_CURRENT');assert.equal(result.ready,false);
});
test('manual future date cannot count',()=>{
 const result=evaluate({...fake(),eventName:'workflow_dispatch',inputDate:'20261008',now:new Date('2026-10-07T11:00:00Z')});
 assert.equal(result.classification,'MANUAL_DATE_NOT_CURRENT');
});
test('calendar not covered fails closed',()=>{
 const result=evaluate({...fake(),tradingDay:()=>({isTradingDay:true,calendarCovered:false}),eventName:'workflow_dispatch',inputDate:'',now:new Date('2027-10-07T11:00:00Z')});
 assert.equal(result.classification,'CALENDAR_UNCOVERED'); assert.equal(result.ready,false);
});
test('invalid manual target and unknown cron rejected',()=>{
 assert.throws(()=>evaluate({...fake(),eventName:'workflow_dispatch',inputDate:'2026/10/07',now:new Date('2026-10-07T11:00:00Z')}),/INVALID_MANUAL_DATE/);
 assert.throws(()=>evaluate({...fake(),eventName:'schedule',schedule:'0 * * * *',now:new Date('2026-10-07T11:00:00Z')}),/UNKNOWN_SCHEDULE/);
});
test('preauthorization target never counts',()=>{
 const result=evaluate({...fake(),eventName:'workflow_dispatch',inputDate:'20261005',now:new Date('2026-10-05T11:00:00Z')});
 assert.equal(result.classification,'PRE_AUTHORIZATION_DATE');assert.equal(result.ready,false);
});
