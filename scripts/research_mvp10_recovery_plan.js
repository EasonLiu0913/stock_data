#!/usr/bin/env node
'use strict';
// Research-only. No workflow dispatch, git push, Pages, YouTube or credentials.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dir='data_daily_gain_over_5/';
const STAGES=[
 {id:'raw',file:d=>dir+d+'.json',deps:[]},
 {id:'facts',file:d=>dir+'analysis-facts/'+d+'.json',deps:['raw']},
 {id:'news',file:d=>dir+'analysis-news/'+d+'.json',deps:['raw']},
 {id:'ai_pending',file:d=>'research_pending/daily-gainers-ai/'+d+'.json',deps:['facts','news']},
 {id:'ai',file:d=>dir+'analysis-ai/'+d+'.json',deps:['ai_pending']},
 {id:'summary',file:d=>dir+'market-summary/'+d+'.json',deps:['facts','news','ai']},
 {id:'script',file:d=>'video_scripts/daily-gainers/'+d+'.json',deps:['summary']},
 {id:'render',file:null,deps:['script']}
];
const BLOCKED_PUBLISH_WORKFLOWS=[
 'publish-daily-gainers-news-summary.yml','publish-daily-gainers-ai-analysis.yml',
 'publish-daily-gainers-unified-analysis.yml','daily-gainers-video-upload-orchestrator.yml',
 'generate-upload-daily-gainers-video.yml'];
const APPROVED_AUTO_DISPATCH=[]; // An independently authorized safe producer is not yet proven.
function assert(ok,msg){if(!ok)throw Error(msg);}
function read(root,relative){
 const p=path.resolve(root,relative);
 assert(p.startsWith(path.resolve(root)+path.sep),'SOURCE_OUTSIDE_ROOT');
 if(!fs.existsSync(p))return {exists:false,error:'missing'};
 const raw=fs.readFileSync(p);
 if(!raw.length)return {exists:true,error:'empty'};
 try{return {exists:true,body:JSON.parse(raw.toString('utf8')),
   sha256:crypto.createHash('sha256').update(raw).digest('hex')};}
 catch{return {exists:true,error:'invalid_json'};}
}
function codes(b){const x=b?.stocks||b?.analyses;return Array.isArray(x)?x.map(z=>String(z?.code||'')):[];}
function validate(id,b,date,rawCodes){
 if(!b||b.target_date!==date)return 'wrong_source_date';
 if(id==='raw'){
  if(b.stock_count!==b.stocks?.length||b.threshold_pct!==5)return 'raw_schema_mismatch';
  const cc=codes(b);
  if(!cc.length||cc.some(c=>!/^[0-9]{4}$/.test(c))||new Set(cc).size!==cc.length)return 'invalid_raw_codes';
  if(b.stocks.some(s=>!Number.isFinite(s.previous_close)||s.previous_close<=0||
    !Number.isFinite(s.close)||!Number.isFinite(s.change_pct)||
    100*(s.close/s.previous_close-1)<4.995||
    Math.abs(s.change_pct-100*(s.close/s.previous_close-1))>0.026))
    return 'invalid_price_or_threshold';
  return null;
 }
 if(id==='facts'){
  if(b.stock_count!==rawCodes.length||codes(b).join(',')!==rawCodes.join(','))
   return 'facts_codes_mismatch';
  for(const s of ['margin','broker_details','mi_index','foreign','investment_trust','dealer'])
   if(b.source_status?.[s]!=='available')return 'facts_source_not_available_'+s;
  return null;
 }
 if(['news','ai_pending','ai'].includes(id)){
  if(b.stock_count!==rawCodes.length||codes(b).join(',')!==rawCodes.join(','))
   return 'analysis_stock_identity_mismatch';
  if(id==='news' && b.analyses.some(a=>!Array.isArray(a.sources)))
   return 'news_source_shape_invalid';
  return null;
 }
 if(id==='summary'){
  if(b.status!=='final'||b.summary_stage!=='full_synthesis'||
    b.coverage?.overall!=='complete'||b.coverage?.raw_stock_count!==rawCodes.length)
   return 'summary_not_final_complete';
  return null;
 }
 if(id==='script')return Array.isArray(b.scenes)&&b.scenes.length?null:'script_missing_scenes';
 return 'unsupported_stage';
}
function previousRuns(old,date){
 if(!old)return {};
 assert(old.target_date===date,'PREVIOUS_DATE_MISMATCH');
 const map={};
 for(const row of old.stages||[]){
  if(!STAGES.some(x=>x.id===row.id))continue;
  if(row.run_id!==null&&row.run_id!==undefined){
   assert(Number.isSafeInteger(row.run_id)&&row.run_id>0,'INVALID_PREVIOUS_RUN_ID');
   map[row.id]={run_id:row.run_id,run_url:row.run_url||null};
  }
 }
 return map;
}
function validatorProofs(document,date,sourceCommit){
 if(!document)return {};
 assert(document.target_date===date,'VALIDATION_DATE_MISMATCH');
 assert(typeof sourceCommit==='string' && sourceCommit.length===40 &&
   document.main_sha===sourceCommit,'VALIDATION_MAIN_SHA_MISMATCH');
 const result={};
 for(const x of document.checks||[]){
  if(!STAGES.some(s=>s.id===x.stage))continue;
  if(x.status==='ORIGINAL_VALIDATOR_PASS'){
   assert(typeof x.source_sha256==='string' && /^[a-f0-9]{64}$/.test(x.source_sha256),
    'VALIDATION_INVALID_SOURCE_HASH');
   result[x.stage]={sha256:x.source_sha256,input:x.input};
  }
 }
 return result;
}
function plan({root='.',date,previous=null,sourceCommit=null,validatorEvidence=null}){
 assert(/^20\d{6}$/.test(date||''),'INVALID_DATE');
 const d=new Date(date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8)+'T00:00:00Z');
 assert(!isNaN(+d)&&d.toISOString().slice(0,10).replace(/-/g,'')===date,'IMPOSSIBLE_DATE');
 const prev=previousRuns(previous,date),validated=validatorProofs(validatorEvidence,date,sourceCommit),
   states={},records={},items=[];
 const raw=read(root,STAGES[0].file(date));
 const rawBad=raw.body?validate('raw',raw.body,date,[]):raw.error;
 const rawCodes=rawBad?[]:codes(raw.body);
 for(const st of STAGES){
  const rel=st.file?st.file(date):null,obj=rel?read(root,rel):null;
  const deps=st.deps.filter(x=>states[x]!=='VERIFIED');
  const bad=obj?.body?validate(st.id,obj.body,date,rawCodes):obj?.error;
  let status,reason;
  if(st.id==='render'){status='BLOCKED';reason='research_only_no_render_dispatch';}
  else if(deps.length){status='BLOCKED';reason='dependencies_not_verified:'+deps.join(',');}
  else if(bad){status=obj?.exists?'INVALID':'MISSING';reason=bad;}
  else if(['facts','news','ai_pending','ai','summary','script'].includes(st.id)){
   // Original validation proof must match date, main SHA, stage file and exact raw bytes.
   const proof=validated[st.id];
   if(proof && proof.input===rel && proof.sha256===obj.sha256){
    status='VERIFIED';reason='date_and_exact_source_original_validator_pass';
   }else{
    status='VALIDATION_REQUIRED';
    reason='original_contract_validator_and_editorial_evidence_required';
   }
  }
  else {status='VERIFIED';reason='date_arithmetic_or_facts_source_status_pass_structure_only';}
  states[st.id]=status;
  const run=prev[st.id]||null;
  const item={id:st.id,source_path:rel,status,reason,dependencies:st.deps,
   sha256:obj?.sha256||null,run_id:run?.run_id||null,run_url:run?.run_url||null,
   dedup_key:date+':'+st.id,dispatch_authorized:false,dispatch_requested:false,
   next_action:status==='VERIFIED'?'continue':status==='BLOCKED'?'wait_for_dependencies':
     status==='VALIDATION_REQUIRED'?'run_original_validator':'needs_approved_producer'};
  items.push(item);
  if(item.sha256)records[st.id]=item.sha256;
 }
 // Agent task descriptors are non-executable proposals; the runner has NO credentials or dispatch rights.
 const taskCatalog={
  news:{output:STAGES.find(x=>x.id==='news').file(date),
    required:['raw'],validator:'node scripts/validate_daily_gainers_news_analysis.js '+date,
    work:'Investigate news, listed-company announcements and credible dated catalysts for every raw-listed stock. Distinguish no credible source from unfinished search; preserve source publication dates, uncertainty and 29-stock order.'},
  ai_pending:{output:STAGES.find(x=>x.id==='ai_pending').file(date),
    required:['raw','facts','news'],validator:'node scripts/validate_daily_gainers_ai_analysis.js '+date+' research_pending/daily-gainers-ai/'+date+'.json',
    work:'Produce non-template stock-specific financial interpretations and risk notes from exact-date independently validated news and facts; never invent source URLs, claims or amounts.'},
  script:{output:STAGES.find(x=>x.id==='script').file(date),
    required:['summary','ai'],validator:'node scripts/validate_daily_gainers_video_script.js '+date,
    work:'Produce one semantic source for natural Traditional Chinese TTS and numeric display captions; YunJhe +15%, approved table-led Dashboard, no stale-date fallback.'}
 };
 const agent_tasks=[];
 for(const id of ['news','ai_pending','script']){
  const st=items.find(x=>x.id===id),cat=taskCatalog[id];
  if(st.status==='VERIFIED')continue;
  const ready=cat.required.every(dep=>states[dep]==='VERIFIED');
  const input_receipts=cat.required.map(dep=>{
   const x=items.find(x=>x.id===dep);
   return {id:dep,path:x.source_path,sha256:x.sha256,verified:x.status==='VERIFIED'};
  });
  agent_tasks.push({
   id:date+':'+id,stage:id,output_path:cat.output,
   status:ready?'READY_FOR_APPROVED_AGENT':'BLOCKED_DEPENDENCIES',
   required_inputs:input_receipts,
   source_main_sha:sourceCommit,validator:cat.validator,
   task_instructions:cat.work,
   agent_runtime_connected:false,auto_invoke_authorized:false,
   writing_to_main_authorized:false,pages_deploy_authorized:false,
   youtube_upload_authorized:false
  });
 }
 const first=items.find(x=>x.status!=='VERIFIED');
 return {schema_version:1,project_id:'daily-gainers-market-opening-end-to-end',
  goal:'goal-v3/MVP-10DAY-v1',target_date:date,source_commit:sourceCommit,
  dashboard_version:'TAIWAN_STOCK_TABLE_LIST_20261102_V1',
  read_only:true,publication_authorized:false,youtube_upload_authorized:false,
  main_write_authorized:false,pages_deploy_authorized:false,
  auto_dispatch_allowlist:APPROVED_AUTO_DISPATCH,blocked_publish_workflows:BLOCKED_PUBLISH_WORKFLOWS,
  stages:items,agent_tasks,source_sha256:records,phase_status:'MVP10-A INCOMPLETE',
  b_status:'NOT_ELIGIBLE',first_blocked_stage:first?.id||null,
  orchestration_status:first?'NOT_READY':'SOURCES_READY_RENDER_STILL_LOCKED',
  next_action:'RECHECK_ON_NEXT_SCHEDULE_OR_APPROVED_AGENT_ACTION',
  run_ids_not_inferred_from_workflow_success:true};
}
function main(){
 const argv=process.argv.slice(2),get=name=>{const n=argv.indexOf(name);return n<0?null:argv[n+1];};
 const date=get('--date'),root=get('--root')||'.',out=get('--output');
 assert(date&&out,'Usage: --date YYYYMMDD --root DIRECTORY --output RECEIPT [--previous OLD_RECEIPT]');
 const previous=get('--previous')?JSON.parse(fs.readFileSync(get('--previous'),'utf8')):null;
 const validatorEvidence=get('--validators')?JSON.parse(fs.readFileSync(get('--validators'),'utf8')):null;
 const result=plan({root,date,previous,sourceCommit:get('--source-commit'),validatorEvidence});
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({date,first_blocked_stage:result.first_blocked_stage,dispatches:0,output:out}));
}
if(require.main===module){try{main();}catch(e){console.error(e.message);process.exit(1);}}
module.exports={plan,validate,previousRuns,validatorProofs,STAGES,APPROVED_AUTO_DISPATCH,BLOCKED_PUBLISH_WORKFLOWS};
