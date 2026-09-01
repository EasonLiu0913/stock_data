#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const arg = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};

const coverageFile = arg('coverage', path.join('data_research','institutional-flow','validation','batch-2-coverage-state-v1.json'));
const batchSize = Number(arg('batch-size-requests','5'));
const maxBatches = Number(arg('max-batches-per-run','8'));
const output = arg('output','');
const githubOutput = arg('github-output','');

if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5) throw new Error('batch-size-requests must be 1..5');
if (!Number.isInteger(maxBatches) || maxBatches < 1 || maxBatches > 20) throw new Error('max-batches-per-run must be 1..20');
if (!fs.existsSync(coverageFile)) throw new Error(`Coverage state missing: ${coverageFile}`);

const coverage = JSON.parse(fs.readFileSync(coverageFile,'utf8'));
if (coverage.methodology !== 'institutional-withdrawal-untouched-expansion-protocol-v1' || coverage.generated_without_outcomes !== true) throw new Error('Invalid Batch 2 coverage contract');
const blocking = coverage.selection?.blocking_candidate;
let tasks=[];
if (blocking?.state === 'coverage_pending_broker') {
  const row=(coverage.rows||[]).find((r)=>r.stock===blocking.stock);
  if (!row) throw new Error(`Blocking stock missing: ${blocking.stock}`);
  const needed=Math.max(0,40-Number(row.normalized_broker_days||0));
  tasks=(row.broker_retryable_dates||[]).map((x)=>({stock:row.stock,date:x.date,classification:x.classification||null})).slice(0,needed);
}
const cap=batchSize*maxBatches;
const scheduled=tasks.slice(0,cap);
const batches=[];
for(let i=0;i<scheduled.length;i+=batchSize){
  const slice=scheduled.slice(i,i+batchSize);
  batches.push({batch:batches.length,task_count:slice.length,tasks:slice.map((x)=>`${x.stock}@${x.date}`).join(',')});
}
const plan={schema_version:1,methodology:'institutional-withdrawal-validation-broker-batch-plan-v2',source_methodology:coverage.methodology,generated_without_outcomes:true,blocking_candidate:blocking||null,batch_size_requests:batchSize,max_batches_per_run:maxBatches,counts:{candidate_tasks:tasks.length,scheduled_tasks:scheduled.length,deferred_tasks:tasks.length-scheduled.length,planned_batches:batches.length},batches,generated_at:new Date().toISOString()};
if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(plan,null,2)+'\n');}
if(githubOutput){
  const include=batches.length?batches.map((b)=>({...b,skip:false})):[{batch:0,task_count:0,tasks:'',skip:true}];
  fs.appendFileSync(githubOutput,`matrix=${JSON.stringify({include})}\n`);
  fs.appendFileSync(githubOutput,`scheduled_count=${scheduled.length}\n`);
}
console.log(JSON.stringify(plan,null,2));
