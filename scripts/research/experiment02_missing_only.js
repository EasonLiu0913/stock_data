'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ROOT='data_daily_gain_over_5/';
const DATA={
 list:{path:d=>ROOT+d+'.json',workflow:'.github/workflows/daily-gainers-over-5.yml',safe:false},
 facts:{path:d=>ROOT+'analysis-facts/'+d+'.json',workflow:'.github/workflows/publish-daily-gainers-ai-analysis.yml',safe:false},
 news:{path:d=>ROOT+'analysis-news/'+d+'.json',workflow:'.github/workflows/publish-daily-gainers-news-summary.yml',safe:false},
 ai:{path:d=>ROOT+'analysis-ai/'+d+'.json',workflow:'.github/workflows/publish-daily-gainers-ai-analysis.yml',safe:false},
 unified:{path:d=>ROOT+'analysis/'+d+'.json',workflow:'.github/workflows/publish-daily-gainers-unified-analysis.yml',safe:false},
 summary:{path:d=>ROOT+'market-summary/'+d+'.json',workflow:'.github/workflows/publish-daily-gainers-unified-analysis.yml',safe:false}
};
function plan(input){
 assert(input && /^20\d{6}$/.test(input.date||''),'invalid logical date');
 assert(input.trading_day===true || input.trading_day===false,'trading_day must be verified');
 if (!input.trading_day) return {date:input.date,status:'NON_TRADING_DAY',missing:[],requests:[]};
 assert(input.source_dates && typeof input.source_dates==='object','verified source dates required');
 assert(input.datasets && typeof input.datasets==='object','datasets required');
 assert(Array.isArray(input.running),'running runs required');
 const missing=[],requests=[];
 for(const [key,meta] of Object.entries(DATA)){
   const x=input.datasets[key],expected=input.source_dates[key];
   assert(/^20\d{6}$/.test(expected||''),'missing expected as-of date: '+key);
   assert(x && typeof x==='object','missing observation: '+key);
   let status='COMPLETE';
   if(x.exists!==true)status='MISSING';
   else if(x.valid!==true || x.as_of!==expected)status='STALE_DATA_FAILED';
   if(status==='COMPLETE')continue;
   const running=input.running.filter(r=>r.dataset===key && r.date===input.date && ['queued','in_progress'].includes(r.status));
   missing.push({dataset:key,path:meta.path(input.date),expected_date:expected,status});
   if(running.length){requests.push({dataset:key,decision:'RUNNING',run_ids:running.map(r=>r.run_id)});continue;}
   requests.push({dataset:key,decision:'BLOCKED_SIDE_EFFECT_REVIEW',workflow:meta.workflow,reason:'Experiment 02 is dry-run only; existing workflow can publish or has unresolved upstream dependency'});
 }
 return {date:input.date,status:missing.length?'MISSING_ONLY_PLAN':'COMPLETE',missing,requests,execution_authorized:false};
}
if(require.main===module){
 const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 process.stdout.write(JSON.stringify(plan(input),null,2)+'\n');
}
module.exports={plan,DATA};
