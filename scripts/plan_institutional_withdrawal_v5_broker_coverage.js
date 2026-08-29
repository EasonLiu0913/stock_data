#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { validateDailyPayload, QUALITY_VERSION } = require('./lib/histock_broker_quality');

const args = process.argv.slice(2);
const getArg = (name, fallback = '') => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback; };
const stocks = getArg('stocks', '2330,2317,2454,2382,2303,2449').split(',').map((x)=>x.trim()).filter(Boolean);
const start = getArg('start', '2026-04-01');
const end = getArg('end', '2026-08-21');
const batchSize = Number(getArg('batch-size-requests', '20'));
const maxBatches = Number(getArg('max-batches-per-run', '20'));
const output = getArg('output', '');
const githubOutput = getArg('github-output', '');
const calendarRoot = getArg('calendar-root', 'data_twse_foreign_investors');

if (!stocks.length || stocks.some((s)=>!/^[0-9A-Za-z]{4,6}$/.test(s))) throw new Error('Invalid stocks');
if (!/^20\d{2}-\d{2}-\d{2}$/.test(start) || !/^20\d{2}-\d{2}-\d{2}$/.test(end) || start>end) throw new Error('Invalid range');
if (!Number.isInteger(batchSize) || batchSize<1 || batchSize>20) throw new Error('batch-size-requests must be 1..20');
if (!Number.isInteger(maxBatches) || maxBatches<1 || maxBatches>100) throw new Error('max-batches-per-run must be 1..100');

const iso = (v) => `${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}`;
const ymd = (v) => v.replaceAll('-', '');
function discoverTradingDays(){
  const rejected=[];
  const dates=[];
  for(const name of fs.readdirSync(calendarRoot).filter((n)=>/^\d{8}_twse_foreign_investors\.json$/.test(n)).sort()){
    const raw=name.slice(0,8), date=iso(raw);
    if(date<start || date>end) continue;
    try{
      const p=JSON.parse(fs.readFileSync(path.join(calendarRoot,name),'utf8'));
      if(p.stat==='OK' && String(p.date)===raw && Array.isArray(p.data)) dates.push(date);
      else rejected.push({date,file:name,reason:`invalid_payload:${p.stat}:${p.date}`});
    }catch(error){ rejected.push({date,file:name,reason:`invalid_json:${error.message}`}); }
  }
  return {dates,rejected};
}
function inspect(stock,date){
  const file=path.join('data_research','institutional-flow','histock',stock,'daily',`${ymd(date)}.json`);
  if(!fs.existsSync(file)) return {valid:false,reason:'missing_file'};
  try{
    const p=JSON.parse(fs.readFileSync(file,'utf8'));
    const check=validateDailyPayload(p,{stock,date});
    return check.valid ? {valid:true} : {valid:false,reason:'quality_gate_failed',details:check};
  }catch(error){ return {valid:false,reason:'invalid_json',details:{message:error.message}}; }
}

const calendar=discoverTradingDays();
if(calendar.rejected.length) throw new Error(`Rejected calendar files: ${JSON.stringify(calendar.rejected)}`);
if(calendar.dates[0]!==start || calendar.dates.at(-1)!==end) throw new Error(`Calendar does not span range: ${calendar.dates[0]}..${calendar.dates.at(-1)}`);
const tasks=[]; const qualityRejected=[]; let existing=0;
for(const stock of stocks){
  for(const date of calendar.dates){
    const check=inspect(stock,date);
    if(check.valid) existing+=1;
    else { tasks.push({stock,date}); if(check.reason==='quality_gate_failed') qualityRejected.push({stock,date,details:check.details}); }
  }
}
const maxTasks=batchSize*maxBatches;
const scheduled=tasks.slice(0,maxTasks);
const batches=[];
for(let i=0;i<scheduled.length;i+=batchSize){
  const slice=scheduled.slice(i,i+batchSize);
  batches.push({batch:batches.length,task_count:slice.length,tasks:slice.map((x)=>`${x.stock}@${x.date}`).join(',')});
}
const plan={
  schema_version:1,
  methodology:'institutional-withdrawal-v5-broker-coverage-plan-v1',
  range:{start,end}, universe:stocks,
  calendar:{source:'valid TWSE foreign-investor daily files',root:calendarRoot,trading_days:calendar.dates.length,first:calendar.dates[0],last:calendar.dates.at(-1)},
  data_quality:{version:QUALITY_VERSION,policy:'existing broker daily is reusable only when validateDailyPayload passes'},
  batch_size_requests:batchSize,max_batches_per_run:maxBatches,
  counts:{stocks:stocks.length,trading_days:calendar.dates.length,theoretical_tasks:stocks.length*calendar.dates.length,existing_valid_tasks:existing,quality_rejected_existing_tasks:qualityRejected.length,missing_tasks_total:tasks.length,scheduled_tasks_this_run:scheduled.length,deferred_tasks:tasks.length-scheduled.length,planned_batches:batches.length},
  quality_rejected_existing_tasks:qualityRejected,
  missing_tasks:tasks,
  batches,
  generated_at:new Date().toISOString(),
};
if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,`${JSON.stringify(plan,null,2)}\n`);}
if(githubOutput){
  const matrix=JSON.stringify({include:batches});
  fs.appendFileSync(githubOutput,`matrix=${matrix}\nmissing_count=${tasks.length}\nscheduled_count=${scheduled.length}\ndeferred_count=${tasks.length-scheduled.length}\nbatch_count=${batches.length}\ntrading_day_count=${calendar.dates.length}\nexisting_count=${existing}\n`);
}
console.log(JSON.stringify(plan,null,2));
