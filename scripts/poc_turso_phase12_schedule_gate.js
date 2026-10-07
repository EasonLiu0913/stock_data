#!/usr/bin/env node
'use strict';
// Isolated schedule gate. Does not connect to Turso, fetch TWSE, or mutate canonical files.
const fs = require('node:fs');
const path = require('node:path');
const {
  resolveScheduledOccurrence, zonedDateParts
} = require('./resolve_scheduled_collection_date');
const {getTradingDayStatus} = require('./lib/twse_trading_day');

const AUTH_DATE = '20261006';
const SCHEDULES = new Set(['47 11 * * 1-5', '17 13 * * 1-5']);
const MAX_SCHEDULE_LAG_MINUTES = 480;
const YYYYMMDD = /^20\d{6}$/;
const compact = date => zonedDateParts(date, 'Asia/Taipei').compact;

function evaluate({eventName, schedule='', inputDate='', now=new Date(), canonicalRoot=path.resolve(__dirname,'..'), exists=fs.existsSync, tradingDay=getTradingDayStatus}) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error('INVALID_NOW');
  if (!['schedule','workflow_dispatch'].includes(eventName)) throw new Error('UNSUPPORTED_EVENT');
  const today = compact(now);
  let date, occurrence=null, delay=null;
  if (eventName==='schedule') {
    if(!SCHEDULES.has(schedule)) throw new Error('UNKNOWN_SCHEDULE');
    const resolved=resolveScheduledOccurrence(schedule,now);
    occurrence=resolved.scheduled_at_utc;
    delay=resolved.delay_minutes;
    date=compact(new Date(occurrence));
  } else {
    date=inputDate.trim()||today;
    if(!YYYYMMDD.test(date)) throw new Error('INVALID_MANUAL_DATE');
  }
  const base={schema:'turso_phase12_gate_v1',event:eventName,target_date:date,authorization_date:AUTH_DATE,scheduled_at_utc:occurrence,delay_minutes:delay,canonical_source_of_truth:true,independent_twse_refetch:false};
  const skipped=(classification,more={})=>({...base,ready:false,classification,...more});
  if(date<AUTH_DATE)return skipped('PRE_AUTHORIZATION_DATE');
  if(eventName==='schedule'&&delay>MAX_SCHEDULE_LAG_MINUTES)return skipped('SCHEDULE_DELAY_EXCEEDED');
  // Manual workflow_dispatch may replay the current date, but must not turn
  // older post-authorization historical dates into new "live" evidence.
  if(eventName==='workflow_dispatch'&&date!==today)return skipped('MANUAL_DATE_NOT_CURRENT');
  const status=tradingDay(date,{calendarPath:path.join(canonicalRoot,'config/twse_non_trading_days.json')});
  if(!status.calendarCovered)return skipped('CALENDAR_UNCOVERED',{trading_day:status});
  if(!status.isTradingDay)return skipped('NON_TRADING_DAY',{trading_day:status});
  const relative='data_twse_institutional_investors/'+date+'_twse_institutional_investors.json';
  if(!exists(path.join(canonicalRoot,relative)))return skipped('WAITING_CANONICAL',{trading_day:status,canonical_file:relative});
  return {...base,ready:true,classification:'READY',trading_day:status,canonical_file:relative};
}
function main(){
  const report=evaluate({
    eventName:process.env.GITHUB_EVENT_NAME||'',
    schedule:process.env.GITHUB_EVENT_SCHEDULE||'',
    inputDate:process.env.PHASE12_INPUT_DATE||'',
    canonicalRoot:path.resolve(process.env.CANONICAL_ROOT||path.resolve(__dirname,'..'))
  });
  fs.writeFileSync('/tmp/turso-phase12-schedule-gate.json',JSON.stringify(report,null,2)+'\n');
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'ready='+(report.ready?'true':'false')+'\ntarget_date='+report.target_date+'\n');
  console.log('[TURSO-PHASE12] SCHEDULE_GATE '+JSON.stringify({date:report.target_date,classification:report.classification,ready:report.ready,delay_minutes:report.delay_minutes}));
}
if(require.main===module){try{main()}catch(e){console.error('[TURSO-PHASE12] GATE_FAILED '+e.message);process.exitCode=1}}
module.exports={evaluate,AUTH_DATE,SCHEDULES,MAX_SCHEDULE_LAG_MINUTES};
