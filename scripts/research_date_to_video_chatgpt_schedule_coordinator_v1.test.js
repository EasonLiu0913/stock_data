'use strict';
// Research-only regression coverage for the scheduled decision contract. No workflow dispatch.
const assert=require('node:assert/strict');
const {decide,fromD4}=require('./research_date_to_video_chatgpt_schedule_coordinator_v1');
const date='20261013';
const base={date,verification:{target_date:date,status:'VERIFIED_RESEARCH_ONLY'},recovery:{date,mode:'PLAN_ONLY_NO_DISPATCH',status:'NO_GAPS_REQUIRES_EDITORIAL_GATE',actions:[]},analysisTask:{target_date:date,status:'READY_FOR_EVIDENCE_GROUNDED_DRAFT',market_master_sha256:'master-sha'}};
function check(input,stage,action){const result=decide(input);assert.equal(result.stage,stage);assert.equal(result.action,action);assert.equal(result.automatic_dispatch_authorized,false);assert.equal(result.publication_authorized,false);}
check({...base,recovery:{...base.recovery,actions:[{decision:'BLOCKED',workflow_path:null,fields:[{id:'FMTQIK'}]}]}},'RECOVERY_REVIEW_REQUIRED','REVIEW_RECOVERY_WORKFLOWS');
check({...base,verification:{target_date:date,status:'MISSING'}},'WAITING_DATA','INSPECT_VERIFICATION');
check(base,'READY_FOR_SCRIPT','GENERATE_ORIGINAL_ANALYSIS');
const candidate={target_date:date,status:'PENDING_INDEPENDENT_CLAIM_REVIEW',candidate_sha256:'candidate-sha'};
check({...base,aiHandoff:candidate},'SCRIPT_REVIEW_PENDING','INDEPENDENT_EDITORIAL_REVIEW');
check({...base,aiHandoff:candidate,editorial:{target_date:date,certified:true,narration_authorized:true,candidate_sha256:'wrong'}},'SCRIPT_REJECTED','REVIEW_CANDIDATE');
check({...base,aiHandoff:candidate,editorial:{target_date:date,certified:true,narration_authorized:true,candidate_sha256:'candidate-sha'}},'READY_FOR_VIDEO','REVIEW_RESEARCH_VIDEO_TRIGGER');
check({...base,video:{target_date:date,status:'ACCEPTED_RESEARCH_MP4',acceptance_verified:true,artifact_sha256:'video-sha',source_master_sha256:'wrong'}},'READY_FOR_SCRIPT','GENERATE_ORIGINAL_ANALYSIS');
check({...base,video:{target_date:date,status:'ACCEPTED_RESEARCH_MP4',acceptance_verified:true,artifact_sha256:'video-sha',source_master_sha256:'master-sha'}},'VIDEO_COMPLETE','NONE');
assert.throws(()=>decide({...base,verification:{target_date:'20261008',status:'VERIFIED_RESEARCH_ONLY'}}),/DATE_MISMATCH_verification/);
const ids=['BFI82U','FMTQIK','BFIAMU','MI_INDEX'];
const d4={target_date:date,official_recovery_advice:{target_date:date,sources:ids.map(id=>({id,status:id==='BFI82U'?'VERIFIED_RESEARCH_ONLY':'UNAPPROVED_OR_RAW_NOT_VALIDATED',action_required:id==='BFI82U'?'REUSE_VERIFIED_ARCHIVE':'SOURCE_CONTRACT_APPROVAL_REQUIRED',automated_retrieval_allowed:false}))}};
const decision=fromD4(date,d4,base.analysisTask);
assert.equal(decision.stage,'RECOVERY_REVIEW_REQUIRED');
assert.equal(decision.blocked_gaps.length,3);
assert.deepEqual(decision.suggested_workflows,[]);
assert.equal(decision.automatic_dispatch_authorized,false);
console.log('CHATGPT_SCHEDULE_COORDINATOR_RESEARCH_TEST_PASS');
