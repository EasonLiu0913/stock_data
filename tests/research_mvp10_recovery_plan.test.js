'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const os=require('node:os'),path=require('node:path');
const {plan,validate,previousRuns,APPROVED_AUTO_DISPATCH,BLOCKED_PUBLISH_WORKFLOWS}=require('../scripts/research_mvp10_recovery_plan');
const DATE='20261102';
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mvp10-recovery-'));
 const write=(name,body)=>{const p=path.join(root,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(body));};
 const stocks=[{code:'2491',previous_close:40.5,close:44.55,change_pct:10},
               {code:'4720',previous_close:27,close:29.7,change_pct:10}];
 const raw={target_date:DATE,threshold_pct:5,stock_count:2,stocks};
 const facts={target_date:DATE,stock_count:2,stocks:stocks.map(x=>({code:x.code})),
  source_status:{margin:'available',broker_details:'available',mi_index:'available',
  foreign:'available',investment_trust:'available',dealer:'available'}};
 const news={target_date:DATE,stock_count:2,analyses:stocks.map(x=>({code:x.code,sources:[]}))};
 const ai={target_date:DATE,stock_count:2,analyses:stocks.map(x=>({code:x.code}))};
 const summary={target_date:DATE,status:'final',summary_stage:'full_synthesis',
  coverage:{overall:'complete',raw_stock_count:2}};
 const script={target_date:DATE,scenes:[{title:'研究'}]};
 const files={raw:'data_daily_gain_over_5/'+DATE+'.json',
  facts:'data_daily_gain_over_5/analysis-facts/'+DATE+'.json',
  news:'data_daily_gain_over_5/analysis-news/'+DATE+'.json',
  ai_pending:'research_pending/daily-gainers-ai/'+DATE+'.json',
  ai:'data_daily_gain_over_5/analysis-ai/'+DATE+'.json',
  summary:'data_daily_gain_over_5/market-summary/'+DATE+'.json',
  script:'video_scripts/daily-gainers/'+DATE+'.json'};
 write(files.raw,raw);write(files.facts,facts);
 return {root,write,files,raw,facts,news,ai,summary,script,cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test('newest date raw and facts ready but missing news blocks dependent AI/render',t=>{
 const f=fixture();t.after(f.cleanup);
 const p=plan({root:f.root,date:DATE,sourceCommit:'a'.repeat(40)});
 assert.equal(p.stages.find(s=>s.id==='raw').status,'VERIFIED');
 assert.equal(p.stages.find(s=>s.id==='facts').status,'VERIFIED');
 assert.equal(p.stages.find(s=>s.id==='news').status,'MISSING');
 assert.equal(p.stages.find(s=>s.id==='ai_pending').status,'BLOCKED');
 assert.equal(p.stages.find(s=>s.id==='render').status,'BLOCKED');
 assert.equal(p.first_blocked_stage,'news');
 assert.deepEqual(p.auto_dispatch_allowlist,[]);
 assert.equal(p.publication_authorized,false);
 assert.equal(p.stages.filter(s=>s.dispatch_requested).length,0);
 assert.ok(BLOCKED_PUBLISH_WORKFLOWS.includes('publish-daily-gainers-ai-analysis.yml'));
});
test('next cycle re-reads source and does not confuse old run ID with complete output',t=>{
 const f=fixture();t.after(f.cleanup);
 const first=plan({root:f.root,date:DATE});
 first.stages.find(s=>s.id==='news').run_id=12345;
 first.stages.find(s=>s.id==='news').run_url='https://github.com/example/actions/runs/12345';
 const still=plan({root:f.root,date:DATE,previous:first});
 assert.equal(still.stages.find(s=>s.id==='news').status,'MISSING');
 assert.equal(still.stages.find(s=>s.id==='news').run_id,12345);
 f.write(f.files.news,f.news);
 const next=plan({root:f.root,date:DATE,previous:still});
 assert.equal(next.stages.find(s=>s.id==='news').status,'VALIDATION_REQUIRED');
 assert.equal(next.stages.find(s=>s.id==='ai_pending').status,'BLOCKED');
 assert.equal(next.stages.find(s=>s.id==='news').dedup_key,DATE+':news');
});
test('all required files never trigger YouTube and still require separate render gate',t=>{
 const f=fixture();t.after(f.cleanup);
 f.write(f.files.news,f.news);f.write(f.files.ai_pending,f.ai);f.write(f.files.ai,f.ai);
 f.write(f.files.summary,f.summary);f.write(f.files.script,f.script);
 const p=plan({root:f.root,date:DATE});
 assert.equal(p.stages.find(s=>s.id==='news').status,'VALIDATION_REQUIRED');
 assert.equal(p.stages.find(s=>s.id==='ai_pending').status,'BLOCKED');
 assert.equal(p.stages.find(s=>s.id==='script').status,'BLOCKED');
 assert.equal(p.stages.find(s=>s.id==='render').status,'BLOCKED');
 assert.equal(p.first_blocked_stage,'news');
 assert.equal(p.youtube_upload_authorized,false);
 assert.equal(p.pages_deploy_authorized,false);
});
test('wrong dates, incomplete facts and preliminary summaries fail closed',t=>{
 const f=fixture();t.after(f.cleanup);
 f.write(f.files.news,{...f.news,target_date:'20261030'});
 let p=plan({root:f.root,date:DATE});
 assert.equal(p.stages.find(s=>s.id==='news').status,'INVALID');
 f.write(f.files.news,f.news);
 f.write(f.files.facts,{...f.facts,source_status:{...f.facts.source_status,margin:'missing'}});
 p=plan({root:f.root,date:DATE});
 assert.equal(p.stages.find(s=>s.id==='facts').status,'INVALID');
 f.write(f.files.facts,f.facts);f.write(f.files.ai_pending,f.ai);f.write(f.files.ai,f.ai);
 f.write(f.files.summary,{...f.summary,status:'preliminary'});
 p=plan({root:f.root,date:DATE});
 assert.equal(validate('summary',{...f.summary,status:'preliminary'},DATE,['2491','4720']), 'summary_not_final_complete');
});
test('strict date and run receipts, no fallback from wrong-day previous',t=>{
 const f=fixture();t.after(f.cleanup);
 assert.throws(()=>plan({root:f.root,date:'20260230'}),/IMPOSSIBLE_DATE/);
 assert.throws(()=>plan({root:f.root,date:DATE,previous:{target_date:'20261030'}}),/PREVIOUS_DATE_MISMATCH/);
 assert.throws(()=>previousRuns({target_date:DATE,stages:[{id:'news',run_id:'invented'}]},DATE),/INVALID_PREVIOUS_RUN_ID/);
});
test('false stock arithmetic and duplicated codes are not accepted',t=>{
 const f=fixture();t.after(f.cleanup);
 const bad={...f.raw,stocks:f.raw.stocks.map((s,i)=>i===0?{...s,close:38}:s)};
 f.write(f.files.raw,bad);assert.equal(plan({root:f.root,date:DATE}).stages[0].status,'INVALID');
 f.write(f.files.raw,{...f.raw,stocks:f.raw.stocks.map((s,i)=>i===1?{...s,code:'2491'}:s)});
 assert.equal(plan({root:f.root,date:DATE}).stages[0].status,'INVALID');
});

test('structurally matching news or AI may not bypass original evidence validator',t=>{
 const f=fixture();t.after(f.cleanup);
 f.write(f.files.news,f.news);
 f.write(f.files.ai_pending,f.ai);
 f.write(f.files.ai,f.ai);
 f.write(f.files.summary,f.summary);
 f.write(f.files.script,f.script);
 const p=plan({root:f.root,date:DATE});
 assert.equal(p.stages.find(x=>x.id==='news').status,'VALIDATION_REQUIRED');
 assert.equal(p.stages.find(x=>x.id==='news').next_action,'run_original_validator');
 assert.equal(p.stages.find(x=>x.id==='ai_pending').status,'BLOCKED');
 assert.equal(p.stages.find(x=>x.id==='summary').status,'BLOCKED');
 assert.equal(p.stages.find(x=>x.id==='script').status,'BLOCKED');
 assert.equal(p.stages.find(x=>x.id==='render').status,'BLOCKED');
 assert.equal(p.stages.some(x=>x.dispatch_requested),false);
});
