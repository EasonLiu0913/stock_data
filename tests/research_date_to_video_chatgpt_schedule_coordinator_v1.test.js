'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {decide,fromD4,fromD4Directory}=require('../scripts/research_date_to_video_chatgpt_schedule_coordinator_v1');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const date='20261013';
const completeSources=sources=>[...sources,...['BFI82U','BFIAMU','FMTQIK','MI_INDEX'].filter(id=>!sources.some(s=>s.id===id)).map(id=>id==='BFIAMU'?{id,status:'UNAPPROVED_OR_RAW_NOT_VALIDATED',action_required:'OPTIONAL_CONTEXT_NOT_REQUIRED'}:id==='BFI82U'?{id,status:'VERIFIED_RESEARCH_ONLY',action_required:'REUSE_VERIFIED_ARCHIVE'}:{id,status:'WORKFLOW_OUTPUT_VALIDATED_FOR_RESEARCH_USE',action_required:'REUSE_DATED_WORKFLOW_OUTPUT'})];

const base=()=>({date,verification:{target_date:date,status:'VERIFIED_RESEARCH_ONLY'},recovery:{date,mode:'PLAN_ONLY_NO_DISPATCH',actions:[]},analysisTask:{target_date:date,status:'READY_FOR_EVIDENCE_GROUNDED_DRAFT'}});
test('missing data suggests bounded recovery but never dispatches',()=>{const f=base();f.verification.status='MISSING';f.recovery.actions=[{decision:'DRY_RUN_CANDIDATE_ONLY',workflow_path:'.github/workflows/research.yml',fields:[{id:'BFI82U'}]}];const r=decide(f);assert.equal(r.stage,'RECOVERY_REVIEW_REQUIRED');assert.equal(r.automatic_dispatch_authorized,false);assert.equal(r.suggested_workflows.length,1)});
test('verified sources yield ChatGPT analysis task',()=>{const r=decide(base());assert.equal(r.stage,'READY_FOR_SCRIPT');assert.equal(r.action,'GENERATE_ORIGINAL_ANALYSIS')});
test('AI draft cannot self approve',()=>{const f=base();f.aiHandoff={target_date:date,status:'STRUCTURAL_PREFLIGHT_ONLY',candidate_sha256:'abc'};assert.equal(decide(f).stage,'SCRIPT_REVIEW_PENDING')});
test('editorial mismatch rejects',()=>{const f=base();f.aiHandoff={target_date:date,status:'STRUCTURAL_PREFLIGHT_ONLY',candidate_sha256:'abc'};f.editorial={target_date:date,certified:true,narration_authorized:true,candidate_sha256:'other'};assert.equal(decide(f).stage,'SCRIPT_REJECTED')});
test('editorial approval still requires separate video trigger review',()=>{const f=base();f.aiHandoff={target_date:date,status:'STRUCTURAL_PREFLIGHT_ONLY',candidate_sha256:'abc'};f.editorial={target_date:date,certified:true,narration_authorized:true,candidate_sha256:'abc'};const r=decide(f);assert.equal(r.stage,'READY_FOR_VIDEO');assert.equal(r.automatic_dispatch_authorized,false)});
test('impossible calendar date fails closed before scheduling',()=>{for(const bad of ['20260230','20261301','20261032']){const f=base();f.date=bad;assert.throws(()=>decide(f),/INVALID_CALENDAR_DATE/);}});
test('wrong date fails closed',()=>{const f=base();f.recovery.date='20261014';assert.throws(()=>decide(f),/DATE_MISMATCH_recovery/)});
test('accepted video avoids duplicate work',()=>{const f=base();f.analysisTask.market_master_sha256='master-sha';f.video={target_date:date,status:'ACCEPTED_RESEARCH_MP4',acceptance_verified:true,artifact_sha256:'mp4-sha',source_master_sha256:'master-sha'};assert.equal(decide(f).stage,'VIDEO_COMPLETE')});
test('claimed accepted video cannot bypass missing current-date source evidence',()=>{const f=base();f.analysisTask.market_master_sha256='master-sha';f.video={target_date:date,status:'ACCEPTED_RESEARCH_MP4',acceptance_verified:true,artifact_sha256:'mp4-sha',source_master_sha256:'master-sha'};f.verification.status='MISSING';f.recovery.actions=[{decision:'BLOCKED',workflow_path:null,fields:[{id:'MI_INDEX'}]}];assert.equal(decide(f).stage,'RECOVERY_REVIEW_REQUIRED');});
test('video acceptance without artifact proof cannot short circuit',()=>{const f=base();f.video={target_date:date,status:'ACCEPTED_RESEARCH_MP4',acceptance_verified:true};assert.equal(decide(f).stage,'READY_FOR_SCRIPT')});
test('missing recovery actions cannot be treated as data complete',()=>{const f=base();delete f.recovery.actions;assert.equal(decide(f).stage,'WAITING_DATA')});
test('blocked recovery with no actions cannot advance to script',()=>{const f=base();f.recovery.status='BLOCKED';assert.equal(decide(f).stage,'WAITING_DATA')});
test('untrusted workflow path is not suggested',()=>{const f=base();f.recovery.actions=[{decision:'DRY_RUN_CANDIDATE_ONLY',workflow_path:'../../unsafe.yml',fields:[{id:'X'}]}];const r=decide(f);assert.equal(r.suggested_workflows.length,0);assert.equal(r.blocked_gaps.length,1)});
test('CLI emits date-scoped research decision without dispatch',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'schedule-decision-'));try{const input=path.join(dir,'bundle.json'),output=path.join(dir,'decision.json');fs.writeFileSync(input,JSON.stringify(base()));const p=spawnSync(process.execPath,[path.resolve(__dirname,'../scripts/research_date_to_video_chatgpt_schedule_coordinator_v1.js'),date,input,output],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);const r=JSON.parse(fs.readFileSync(output,'utf8'));assert.equal(r.stage,'READY_FOR_SCRIPT');assert.equal(r.automatic_dispatch_authorized,false);assert.equal(r.publication_authorized,false)}finally{fs.rmSync(dir,{recursive:true,force:true})}});
test('CLI rejects mismatched date and does not write output',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'schedule-date-'));try{const input=path.join(dir,'bundle.json'),output=path.join(dir,'decision.json');fs.writeFileSync(input,JSON.stringify(base()));const p=spawnSync(process.execPath,[path.resolve(__dirname,'../scripts/research_date_to_video_chatgpt_schedule_coordinator_v1.js'),'20261014',input,output],{encoding:'utf8'});assert.notEqual(p.status,0);assert.equal(fs.existsSync(output),false)}finally{fs.rmSync(dir,{recursive:true,force:true})}});
test('D4 source gap maps to blocked recovery, not invented dispatch',()=>{const d4={target_date:date,official_recovery_advice:{target_date:date,sources:completeSources([{id:'BFI82U',status:'WAITING_SOURCE',action_required:'APPROVED_BOUNDED_RECOVERY_OR_WAIT',automated_retrieval_allowed:true}])}};const r=fromD4(date,d4,base().analysisTask);assert.equal(r.stage,'RECOVERY_REVIEW_REQUIRED');assert.deepEqual(r.suggested_workflows,[]);assert.equal(r.blocked_gaps[0][0].id,'BFI82U')});
test('D4 verified sources permit original analysis but not dispatch',()=>{const d4={target_date:date,official_recovery_advice:{target_date:date,sources:completeSources([{id:'BFI82U',status:'VERIFIED_RESEARCH_ONLY',action_required:'REUSE_VERIFIED_ARCHIVE'}])}};const r=fromD4(date,d4,base().analysisTask);assert.equal(r.stage,'READY_FOR_SCRIPT');assert.equal(r.automatic_dispatch_authorized,false)});
test('D4 recovery date mismatch rejects',()=>{const d4={target_date:date,official_recovery_advice:{target_date:'20261014',sources:[]}};assert.throws(()=>fromD4(date,d4,base().analysisTask),/D4_RECOVERY_DATE_MISMATCH/)});

test('D4 directory rejects absent status',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'d4-missing-'));try{assert.throws(()=>fromD4Directory(date,dir),/D4_STATUS_REQUIRED/)}finally{fs.rmSync(dir,{recursive:true,force:true})}});

test('D4 directory blocks script without evidence files',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'d4-evidence-'));try{fs.writeFileSync(path.join(dir,'status.json'),JSON.stringify({contract:'DATE_TO_VIDEO_V1_D4_ORCHESTRATOR',target_date:date,official_recovery_advice:{target_date:date,sources:completeSources([{id:'BFI82U',status:'VERIFIED_RESEARCH_ONLY',action_required:'REUSE_VERIFIED_ARCHIVE'}])}}));fs.writeFileSync(path.join(dir,'original-analysis-task.json'),JSON.stringify(base().analysisTask));assert.equal(fromD4Directory(date,dir).reason,'D4_SOURCE_MANIFEST_BINDING_REQUIRED')}finally{fs.rmSync(dir,{recursive:true,force:true})}});

test('D4 directory refuses evidence hash mismatch',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'d4-hash-'));try{const put=(name,data)=>fs.writeFileSync(path.join(dir,name),JSON.stringify(data));put('status.json',{contract:'DATE_TO_VIDEO_V1_D4_ORCHESTRATOR',target_date:date,official_recovery_advice:{target_date:date,sources:completeSources([{id:'BFI82U',status:'VERIFIED_RESEARCH_ONLY',action_required:'REUSE_VERIFIED_ARCHIVE'}])}});put('original-analysis-task.json',{...base().analysisTask,market_master_sha256:'bad',claim_inventory_sha256:'bad'});put('market-master.json',{target_date:date});put('claims.json',{target_date:date});assert.equal(fromD4Directory(date,dir).reason,'D4_SOURCE_MANIFEST_BINDING_REQUIRED')}finally{fs.rmSync(dir,{recursive:true,force:true})}});

test('D4 incomplete source inventory fails closed',()=>{const d4={target_date:date,official_recovery_advice:{target_date:date,sources:[]}};assert.throws(()=>fromD4(date,d4,base().analysisTask),/D4_REQUIRED_SOURCE_SET_MISMATCH/)});

test('workflow path traversal is never suggested',()=>{const f=base();f.recovery.actions=[{decision:'DRY_RUN_CANDIDATE_ONLY',workflow_path:'.github/workflows/../unsafe.yml',fields:[{id:'X'}]}];const r=decide(f);assert.deepEqual(r.suggested_workflows,[]);assert.equal(r.blocked_gaps.length,1)});

test('accepted MP4 with stale master hash cannot suppress current-date script work',()=>{const f=base();f.analysisTask.market_master_sha256='current-master';f.video={target_date:date,status:'ACCEPTED_RESEARCH_MP4',acceptance_verified:true,artifact_sha256:'mp4-sha',source_master_sha256:'previous-master'};const r=decide(f);assert.equal(r.stage,'READY_FOR_SCRIPT');assert.equal(r.action,'GENERATE_ORIGINAL_ANALYSIS');assert.equal(r.automatic_dispatch_authorized,false);assert.equal(r.publication_authorized,false)});
test('unapproved source cannot be promoted by a claimed accepted MP4',()=>{const f=base();f.analysisTask.market_master_sha256='master-sha';f.video={target_date:date,status:'ACCEPTED_RESEARCH_MP4',acceptance_verified:true,artifact_sha256:'mp4-sha',source_master_sha256:'master-sha'};f.verification.status='MISSING';f.recovery.actions=[{decision:'BLOCKED',workflow_path:null,fields:[{id:'FMTQIK',status:'CANDIDATE_UNAPPROVED'}]}];const r=decide(f);assert.equal(r.stage,'RECOVERY_REVIEW_REQUIRED');assert.deepEqual(r.suggested_workflows,[]);assert.equal(r.automatic_dispatch_authorized,false);assert.equal(r.publication_authorized,false)});

test('existing decision artifact is never overwritten by a repeated scheduled invocation',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'schedule-idempotent-'));try{const input=path.join(dir,'bundle.json'),output=path.join(dir,'decision.json');fs.writeFileSync(input,JSON.stringify(base()));fs.writeFileSync(output,'KEEP_EXISTING_DECISION');const p=spawnSync(process.execPath,[path.resolve(__dirname,'../scripts/research_date_to_video_chatgpt_schedule_coordinator_v1.js'),date,input,output],{encoding:'utf8'});assert.notEqual(p.status,0);assert.equal(fs.readFileSync(output,'utf8'),'KEEP_EXISTING_DECISION')}finally{fs.rmSync(dir,{recursive:true,force:true})}});
test('accepted video without current master digest cannot bypass script and evidence gates',()=>{const f=base();f.video={target_date:date,status:'ACCEPTED_RESEARCH_MP4',acceptance_verified:true,artifact_sha256:'mp4-sha',source_master_sha256:'master-sha'};const r=decide(f);assert.equal(r.stage,'READY_FOR_SCRIPT');assert.equal(r.automatic_dispatch_authorized,false);assert.equal(r.publication_authorized,false)});

test('dated D4 scheduler reuses verified BFI82U while blocking three unapproved sources',()=>{for(const target of ['20261008','20261013']){const sources=['BFI82U','FMTQIK','BFIAMU','MI_INDEX'].map(id=>({id,status:id==='BFI82U'?'VERIFIED_RESEARCH_ONLY':'WAITING_SOURCE',action_required:id==='BFI82U'?'REUSE_VERIFIED_ARCHIVE':'SOURCE_CONTRACT_REVIEW_REQUIRED',automated_retrieval_allowed:false}));const d4={target_date:target,official_recovery_advice:{target_date:target,sources}};const r=fromD4(target,d4,{target_date:target,status:'READY_FOR_EVIDENCE_GROUNDED_DRAFT'});assert.equal(r.stage,'RECOVERY_REVIEW_REQUIRED');assert.deepEqual(r.suggested_workflows,[]);assert.deepEqual(r.blocked_gaps.map(g=>g[0].id),['FMTQIK','MI_INDEX']);assert.equal(r.blocked_gaps.some(g=>g[0].id==='BFI82U'),false);assert.equal(r.automatic_dispatch_authorized,false);assert.equal(r.publication_authorized,false);}});

test('D4 schedule refuses duplicated source IDs even when inventory length is four',()=>{const sources=['BFI82U','BFI82U','FMTQIK','MI_INDEX'].map(id=>({id,status:'VERIFIED_RESEARCH_ONLY',action_required:'REUSE_VERIFIED_ARCHIVE'}));assert.throws(()=>fromD4(date,{target_date:date,official_recovery_advice:{target_date:date,sources}},base().analysisTask),/D4_REQUIRED_SOURCE_SET_MISMATCH/);});
test('D4 schedule rejects an unapproved source masquerading as reusable verified archive',()=>{const sources=['BFI82U','BFIAMU','FMTQIK','MI_INDEX'].map(id=>({id,status:'WAITING_SOURCE',action_required:'REUSE_VERIFIED_ARCHIVE',automated_retrieval_allowed:false}));const r=fromD4(date,{target_date:date,official_recovery_advice:{target_date:date,sources}},base().analysisTask);assert.equal(r.stage,'RECOVERY_REVIEW_REQUIRED');assert.deepEqual(r.suggested_workflows,[]);assert.deepEqual(r.blocked_gaps.map(g=>g[0].id),['BFI82U','FMTQIK','MI_INDEX']);assert.equal(r.automatic_dispatch_authorized,false);});

test('D4 schedule never treats a verified label without reuse decision as complete',()=>{const sources=['BFI82U','BFIAMU','FMTQIK','MI_INDEX'].map(id=>({id,status:id==='BFIAMU'?'WAITING_SOURCE':id==='BFI82U'?'VERIFIED_RESEARCH_ONLY':'WORKFLOW_OUTPUT_VALIDATED_FOR_RESEARCH_USE',action_required:id==='BFIAMU'?'OPTIONAL_CONTEXT_NOT_REQUIRED':id==='BFI82U'?'REUSE_VERIFIED_ARCHIVE':id==='FMTQIK'?'SOURCE_CONTRACT_REVIEW_REQUIRED':'REUSE_DATED_WORKFLOW_OUTPUT',automated_retrieval_allowed:false}));const r=fromD4(date,{target_date:date,official_recovery_advice:{target_date:date,sources}},{target_date:date,status:'READY_FOR_EVIDENCE_GROUNDED_DRAFT'});assert.equal(r.stage,'RECOVERY_REVIEW_REQUIRED');assert.deepEqual(r.blocked_gaps.map(g=>g[0].id),['FMTQIK']);assert.deepEqual(r.suggested_workflows,[]);assert.equal(r.automatic_dispatch_authorized,false);assert.equal(r.publication_authorized,false);});

test('research next-action agrees with scheduler when either source readiness condition fails',()=>{
 const {advise}=require('../scripts/research_date_to_video_next_action_v1');
 for(const [status,action_required] of [['VERIFIED_RESEARCH_ONLY','SOURCE_CONTRACT_REVIEW_REQUIRED'],['WAITING_SOURCE','REUSE_VERIFIED_ARCHIVE']]){
  const sources=completeSources([{id:'FMTQIK',status,action_required,automated_retrieval_allowed:false}]);
  const d4={target_date:date,official_recovery_advice:{target_date:date,sources}};
  const scheduled=fromD4(date,d4,base().analysisTask);
  const next=advise(d4,{status:'VERIFIED_RESEARCH_ONLY'},{status:'BLOCKED',issues:['EDITORIAL_CERTIFICATION_REQUIRED']});
  assert.equal(scheduled.stage,'RECOVERY_REVIEW_REQUIRED');
  assert.deepEqual(scheduled.blocked_gaps.map(g=>g[0].id),['FMTQIK']);
  assert.equal(next.stage,'WAITING_OFFICIAL_SOURCES');
  assert.deepEqual(next.actions.map(a=>a.source),['FMTQIK']);
  assert.equal(next.automatic_dispatch_authorized,false);
  assert.equal(next.render_authorized,false);
  assert.equal(next.publication_authorized,false);
 }
});

test('next-action never treats missing, duplicate or incomplete source inventory as complete',()=>{
 const {advise}=require('../scripts/research_date_to_video_next_action_v1');
 const ready=completeSources([]);
 for(const sources of [undefined,[],ready.slice(0,3),[ready[0],ready[0],ready[2],ready[3]]]){
  const d4={target_date:date,official_recovery_advice:sources===undefined?undefined:{target_date:date,sources}};
  const r=advise(d4,{status:'VERIFIED_RESEARCH_ONLY'},{status:'READY_FOR_SEPARATE_MEDIA_REVIEW',issues:[]});
  assert.equal(r.stage,'WAITING_OFFICIAL_SOURCE_INVENTORY');
  assert.deepEqual(r.actions,['REBUILD_DATE_SCOPED_SOURCE_INVENTORY']);
  assert.equal(r.automatic_dispatch_authorized,false);
  assert.equal(r.tts_authorized,false);
  assert.equal(r.render_authorized,false);
  assert.equal(r.publication_authorized,false);
 }
 const d4={target_date:date,official_recovery_advice:{target_date:date,sources:ready}};
 assert.equal(advise(d4,{status:'VERIFIED_RESEARCH_ONLY'},{status:'READY_FOR_SEPARATE_MEDIA_REVIEW',issues:[]}).stage,'READY_FOR_SEPARATE_MEDIA_REVIEW');
});

test('dated workflow source readiness does not require duplicate HTTP capture or optional industry context',()=>{const d4={target_date:date,official_recovery_advice:{target_date:date,sources:completeSources([])}};const r=fromD4(date,d4,base().analysisTask);assert.equal(r.stage,'READY_FOR_SCRIPT');assert.equal(r.automatic_dispatch_authorized,false);assert.equal(r.publication_authorized,false);});
test('unvalidated mandatory dated workflow source still blocks research script',()=>{const sources=completeSources([]);const source=sources.find(x=>x.id==='MI_INDEX');source.status='REJECTED';source.action_required='REVIEW_INVALID_WORKFLOW_OUTPUT';const r=fromD4(date,{target_date:date,official_recovery_advice:{target_date:date,sources}},base().analysisTask);assert.equal(r.stage,'RECOVERY_REVIEW_REQUIRED');assert.equal(r.blocked_gaps[0][0].id,'MI_INDEX');assert.equal(r.automatic_dispatch_authorized,false);});

test('real persisted dated D4 evidence reaches schedule without repeated original HTTP capture',()=>{
 const {run}=require('../scripts/research_date_to_video_d4_orchestrator');
 for(const target of ['20261008','20261013']){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'schedule-real-d4-'));
  try{
   const d4=run('.',target,dir);
   const result=fromD4Directory(target,dir);
   assert.equal(result.target_date,target);
   const task=JSON.parse(fs.readFileSync(path.join(dir,'original-analysis-task.json'),'utf8'));
   if(task.status==='READY_FOR_EVIDENCE_GROUNDED_DRAFT'){
    assert.equal(result.stage,'READY_FOR_SCRIPT',JSON.stringify({stage:result.stage,reason:result.reason,blockers:d4.blockers}));
    assert.equal(result.action,'GENERATE_ORIGINAL_ANALYSIS');
   }else{
    assert.equal(result.stage,'WAITING_DATA');
    assert.equal(result.reason,'D4_TASK_NOT_READY');
    assert.equal(result.action,'PREPARE_D4_ANALYSIS_TASK');
   }
   assert.notEqual(result.stage,'RECOVERY_REVIEW_REQUIRED');
   assert.equal(result.automatic_dispatch_authorized,false);
   assert.equal(result.publication_authorized,false);
   const sources=d4.official_recovery_advice.sources;
   assert.deepEqual(sources.filter(s=>['FMTQIK','MI_INDEX'].includes(s.id)).map(s=>s.action_required),['REUSE_DATED_WORKFLOW_OUTPUT','REUSE_DATED_WORKFLOW_OUTPUT']);
   assert.equal(sources.find(s=>s.id==='BFIAMU').action_required,'OPTIONAL_CONTEXT_NOT_REQUIRED');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
 }
});

test('ready status labels alone cannot bypass missing dated source manifest',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'schedule-manifest-binding-'));
 try{
  const sources=completeSources([]);
  fs.writeFileSync(path.join(dir,'status.json'),JSON.stringify({contract:'DATE_TO_VIDEO_V1_D4_ORCHESTRATOR',target_date:date,official_recovery_advice:{target_date:date,manifest_sha256:'claimed',sources}}));
  fs.writeFileSync(path.join(dir,'original-analysis-task.json'),JSON.stringify(base().analysisTask));
  const result=fromD4Directory(date,dir);
  assert.equal(result.stage,'WAITING_DATA');
  assert.equal(result.reason,'D4_SOURCE_MANIFEST_BINDING_REQUIRED');
  assert.equal(result.automatic_dispatch_authorized,false);
  assert.equal(result.publication_authorized,false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
