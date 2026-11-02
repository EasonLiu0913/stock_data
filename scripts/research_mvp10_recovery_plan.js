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
function plan({root='.',date,previous=null,sourceCommit=null}){
 assert(/^20\d{6}$/.test(date||''),'INVALID_DATE');
 const d=new Date(date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8)+'T00:00:00Z');
 assert(!isNaN(+d)&&d.toISOString().slice(0,10).replace(/-/g,'')===date,'IMPOSSIBLE_DATE');
 const prev=previousRuns(previous,date),states={},records={},items=[];
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
  else {status='VERIFIED';reason='exact_date_schema_and_dependencies_pass';}
  states[st.id]=status;
  const run=prev[st.id]||null;
  const item={id:st.id,source_path:rel,status,reason,dependencies:st.deps,
   sha256:obj?.sha256||null,run_id:run?.run_id||null,run_url:run?.run_url||null,
   dedup_key:date+':'+st.id,dispatch_authorized:false,dispatch_requested:false,
   next_action:status==='VERIFIED'?'continue':status==='BLOCKED'?'wait_for_dependencies':'needs_approved_producer'};
  items.push(item);
  if(item.sha256)records[st.id]=item.sha256;
 }
 const first=items.find(x=>x.status!=='VERIFIED');
 return {schema_version:1,project_id:'daily-gainers-market-opening-end-to-end',
  goal:'goal-v3/MVP-10DAY-v1',target_date:date,source_commit:sourceCommit,
  dashboard_version:'TAIWAN_STOCK_TABLE_LIST_20261102_V1',
  read_only:true,publication_authorized:false,youtube_upload_authorized:false,
  main_write_authorized:false,pages_deploy_authorized:false,
  auto_dispatch_allowlist:APPROVED_AUTO_DISPATCH,blocked_publish_workflows:BLOCKED_PUBLISH_WORKFLOWS,
  stages:items,source_sha256:records,phase_status:'MVP10-A INCOMPLETE',
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
 const result=plan({root,date,previous,sourceCommit:get('--source-commit')});
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({date,first_blocked_stage:result.first_blocked_stage,dispatches:0,output:out}));
}
if(require.main===module){try{main();}catch(e){console.error(e.message);process.exit(1);}}
module.exports={plan,validate,previousRuns,STAGES,APPROVED_AUTO_DISPATCH,BLOCKED_PUBLISH_WORKFLOWS};
