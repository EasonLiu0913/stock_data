'use strict';
// ChatGPT scheduled-task decision contract. Pure research planner; never dispatches or approves publication.
const assert=require('node:assert/strict');
const fs=require('node:fs');
function decide({date,verification,recovery,analysisTask,aiHandoff,editorial,video}){
 assert.match(date||'',/^20\d{6}$/,'INVALID_DATE');
 const iso=date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8);
 const parsed=new Date(iso+'T00:00:00Z');
 assert.ok(Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===iso,'INVALID_CALENDAR_DATE');
 for(const [name,item] of Object.entries({verification,recovery,analysisTask,aiHandoff,editorial,video})){
  if(item&&item.target_date!==undefined)assert.equal(item.target_date,date,'DATE_MISMATCH_'+name);
  if(item&&item.date!==undefined)assert.equal(item.date,date,'DATE_MISMATCH_'+name);
 }
 const base={contract:'DATE_TO_VIDEO_V1_CHATGPT_SCHEDULE_COORDINATION_RESEARCH',target_date:date,research_only:true,automatic_dispatch_authorized:false,publication_authorized:false};
 const output=(stage,action,reason,details={})=>({...base,stage,action,reason,...details});
 // Never let a claimed MP4 bypass the current dated source/recovery gate.
 const recoveryReady=recovery?.mode==='PLAN_ONLY_NO_DISPATCH'&&Array.isArray(recovery.actions)&&recovery.actions.length===0&&recovery.status!=='BLOCKED'&&verification?.status==='VERIFIED_RESEARCH_ONLY';
 if(recoveryReady&&analysisTask?.status==='READY_FOR_EVIDENCE_GROUNDED_DRAFT'&&video?.status==='ACCEPTED_RESEARCH_MP4'&&video?.acceptance_verified===true&&video?.artifact_sha256&&video?.source_master_sha256&&analysisTask?.market_master_sha256===video.source_master_sha256)return output('VIDEO_COMPLETE','NONE','ACCEPTED_ARTIFACT_EXISTS');
 if(!recovery||recovery.mode!=='PLAN_ONLY_NO_DISPATCH')return output('WAITING_DATA','PREPARE_RECOVERY_PLAN','SAFE_RECOVERY_PLAN_REQUIRED');
 if(!Array.isArray(recovery.actions))return output('WAITING_DATA','INSPECT_RECOVERY_PLAN','RECOVERY_ACTIONS_REQUIRED');
 if(recovery.status==='BLOCKED'&&recovery.actions.length===0)return output('WAITING_DATA','INSPECT_RECOVERY_PLAN','BLOCKED_RECOVERY_PLAN');
 const gaps=recovery.actions;
 if(gaps.length){
  const safe=gaps.filter(a=>a?.decision==='DRY_RUN_CANDIDATE_ONLY'&&typeof a.workflow_path==='string'&&/^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/.test(a.workflow_path));
  const blocked=gaps.filter(a=>!safe.includes(a));
  return output('RECOVERY_REVIEW_REQUIRED','REVIEW_RECOVERY_WORKFLOWS','GAPS_REQUIRE_SEPARATE_AUTHORIZATION',{suggested_workflows:safe.map(a=>a.workflow_path),blocked_gaps:blocked.map(a=>a?.fields||[])});
 }
 if(verification?.status!=='VERIFIED_RESEARCH_ONLY')return output('WAITING_DATA','INSPECT_VERIFICATION','VERIFIED_DATED_INPUT_REQUIRED');
 if(analysisTask?.status!=='READY_FOR_EVIDENCE_GROUNDED_DRAFT')return output('WAITING_DATA','PREPARE_D4_ANALYSIS_TASK','D4_TASK_NOT_READY');
 if(!aiHandoff)return output('READY_FOR_SCRIPT','GENERATE_ORIGINAL_ANALYSIS','USE_VERIFIED_D4_EVIDENCE');
 if(!['PENDING_INDEPENDENT_CLAIM_REVIEW','STRUCTURAL_PREFLIGHT_ONLY'].includes(aiHandoff.status))return output('SCRIPT_REJECTED','REVIEW_CANDIDATE','INVALID_AI_HANDOFF');
 if(editorial?.certified!==true||editorial?.narration_authorized!==true)return output('SCRIPT_REVIEW_PENDING','INDEPENDENT_EDITORIAL_REVIEW','AI_CANDIDATE_IS_NOT_APPROVAL');
 if(editorial?.candidate_sha256!==aiHandoff.candidate_sha256)return output('SCRIPT_REJECTED','REVIEW_CANDIDATE','EDITORIAL_CANDIDATE_SHA_MISMATCH');
 return output('READY_FOR_VIDEO','REVIEW_RESEARCH_VIDEO_TRIGGER','SEPARATE_MEDIA_PREFLIGHT_AND_DISPATCH_AUTHORIZATION_REQUIRED');
}
// Translate the existing D4 archive-first source advice without inventing dispatch allowlists.
function fromD4(date,d4,analysisTask){
 assert.equal(d4?.target_date,date,'D4_DATE_MISMATCH');
 const advice=d4.official_recovery_advice;
 assert.equal(advice?.target_date,date,'D4_RECOVERY_DATE_MISMATCH');
 assert.ok(Array.isArray(advice.sources),'D4_RECOVERY_SOURCES_REQUIRED');
 assert.deepEqual([...advice.sources.map(s=>s.id)].sort(),['BFI82U','BFIAMU','FMTQIK','MI_INDEX'].sort(),'D4_REQUIRED_SOURCE_SET_MISMATCH');
 const ready=s=>(s.id==='BFI82U'&&s.status==='VERIFIED_RESEARCH_ONLY'&&s.action_required==='REUSE_VERIFIED_ARCHIVE')||(['FMTQIK','MI_INDEX'].includes(s.id)&&s.status==='WORKFLOW_OUTPUT_VALIDATED_FOR_RESEARCH_USE'&&s.action_required==='REUSE_DATED_WORKFLOW_OUTPUT');
 const missing=advice.sources.filter(s=>s.id!=='BFIAMU'&&!ready(s));
 const recovery={date,mode:'PLAN_ONLY_NO_DISPATCH',status:missing.length?'BLOCKED':'NO_GAPS_REQUIRES_EDITORIAL_GATE',actions:missing.map(s=>({decision:'BLOCKED',workflow_path:null,fields:[{id:s.id,status:s.status}],reason:s.action_required,automated_retrieval_allowed:s.automated_retrieval_allowed===true}))};
 return decide({date,verification:{target_date:date,status:missing.length?'MISSING':'VERIFIED_RESEARCH_ONLY'},recovery,analysisTask});
}
// Consume the real D4 output directory. No inferred completeness from missing files.
function fromD4Directory(date,dir){
 const path=require('node:path');
 const read=name=>{const p=path.join(dir,name);return fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):null;};
 const d4=read('status.json');
 assert.equal(d4?.contract,'DATE_TO_VIDEO_V1_D4_ORCHESTRATOR','D4_STATUS_REQUIRED');
 assert.equal(d4.target_date,date,'D4_DATE_MISMATCH');
 const task=read('original-analysis-task.json');
 if(task)assert.equal(task.target_date,date,'D4_TASK_DATE_MISMATCH');
 const decision=fromD4(date,d4,task);
 // D4 source verification alone is insufficient; require a ready task and its evidence files.
 if(decision.stage==='READY_FOR_SCRIPT'){
  const master=read('market-master.json'),claims=read('claims.json');
  if(!task||!master||!claims)return {...decision,stage:'WAITING_DATA',action:'INSPECT_D4_ARTIFACTS',reason:'D4_EVIDENCE_FILES_REQUIRED'};
  if(master.target_date!==date||claims.target_date!==date)return {...decision,stage:'WAITING_DATA',action:'INSPECT_D4_ARTIFACTS',reason:'D4_EVIDENCE_DATE_MISMATCH'};
  if(!task.market_master_sha256||!task.claim_inventory_sha256)return {...decision,stage:'WAITING_DATA',action:'INSPECT_D4_ARTIFACTS',reason:'D4_EVIDENCE_SHA_REQUIRED'};
  const digest=value=>require('node:crypto').createHash('sha256').update(JSON.stringify(value)).digest('hex');
  if(task.market_master_sha256!==digest(master)||task.claim_inventory_sha256!==digest(claims))return {...decision,stage:'WAITING_DATA',action:'INSPECT_D4_ARTIFACTS',reason:'D4_EVIDENCE_SHA_MISMATCH'};
 }
 return decision;
}
// Date-scoped JSON handoff for a ChatGPT scheduled task; input is an existing, local evidence bundle.
if(require.main===module){
 const [date,inputPath,outputPath,...extra]=process.argv.slice(2);
 if(extra.length||!date||!inputPath||!outputPath){console.error('Usage: node scripts/research_date_to_video_chatgpt_schedule_coordinator_v1.js YYYYMMDD evidence-bundle.json decision.json');process.exitCode=2;}
 else try{
  const bundle=JSON.parse(fs.readFileSync(inputPath,'utf8'));
  assert.equal(bundle.date,date,'BUNDLE_DATE_MISMATCH');
  const decision=decide(bundle);
  fs.writeFileSync(outputPath,JSON.stringify(decision,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({target_date:date,stage:decision.stage,action:decision.action,automatic_dispatch_authorized:false}));
 }catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={decide,fromD4,fromD4Directory};
