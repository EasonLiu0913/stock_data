'use strict';
// ChatGPT scheduled-task decision contract. Pure research planner; never dispatches or approves publication.
const assert=require('node:assert/strict');
function decide({date,verification,recovery,analysisTask,aiHandoff,editorial,video}){
 assert.match(date||'',/^20\d{6}$/,'INVALID_DATE');
 for(const [name,item] of Object.entries({verification,recovery,analysisTask,aiHandoff,editorial,video})){
  if(item&&item.target_date!==undefined)assert.equal(item.target_date,date,'DATE_MISMATCH_'+name);
  if(item&&item.date!==undefined)assert.equal(item.date,date,'DATE_MISMATCH_'+name);
 }
 const base={contract:'DATE_TO_VIDEO_V1_CHATGPT_SCHEDULE_COORDINATION_RESEARCH',target_date:date,research_only:true,automatic_dispatch_authorized:false,publication_authorized:false};
 const output=(stage,action,reason,details={})=>({...base,stage,action,reason,...details});
 if(video?.status==='ACCEPTED_RESEARCH_MP4'&&video?.acceptance_verified===true)return output('VIDEO_COMPLETE','NONE','ACCEPTED_ARTIFACT_EXISTS');
 if(verification?.status!=='VERIFIED_RESEARCH_ONLY')return output('WAITING_DATA','INSPECT_VERIFICATION','VERIFIED_DATED_INPUT_REQUIRED');
 if(!recovery||recovery.mode!=='PLAN_ONLY_NO_DISPATCH')return output('WAITING_DATA','PREPARE_RECOVERY_PLAN','SAFE_RECOVERY_PLAN_REQUIRED');
 const gaps=recovery.actions||[];
 if(gaps.length){
  const safe=gaps.filter(a=>a.decision==='DRY_RUN_CANDIDATE_ONLY'&&typeof a.workflow_path==='string');
  return output('RECOVERY_REVIEW_REQUIRED','REVIEW_RECOVERY_WORKFLOWS','GAPS_REQUIRE_SEPARATE_AUTHORIZATION',{suggested_workflows:safe.map(a=>a.workflow_path),blocked_gaps:gaps.filter(a=>a.decision!=='DRY_RUN_CANDIDATE_ONLY').map(a=>a.fields)});
 }
 if(analysisTask?.status!=='READY_FOR_EVIDENCE_GROUNDED_DRAFT')return output('WAITING_DATA','PREPARE_D4_ANALYSIS_TASK','D4_TASK_NOT_READY');
 if(!aiHandoff)return output('READY_FOR_SCRIPT','GENERATE_ORIGINAL_ANALYSIS','USE_VERIFIED_D4_EVIDENCE');
 if(!['PENDING_INDEPENDENT_CLAIM_REVIEW','STRUCTURAL_PREFLIGHT_ONLY'].includes(aiHandoff.status))return output('SCRIPT_REJECTED','REVIEW_CANDIDATE','INVALID_AI_HANDOFF');
 if(editorial?.certified!==true||editorial?.narration_authorized!==true)return output('SCRIPT_REVIEW_PENDING','INDEPENDENT_EDITORIAL_REVIEW','AI_CANDIDATE_IS_NOT_APPROVAL');
 if(editorial?.candidate_sha256!==aiHandoff.candidate_sha256)return output('SCRIPT_REJECTED','REVIEW_CANDIDATE','EDITORIAL_CANDIDATE_SHA_MISMATCH');
 return output('READY_FOR_VIDEO','REVIEW_RESEARCH_VIDEO_TRIGGER','SEPARATE_MEDIA_PREFLIGHT_AND_DISPATCH_AUTHORIZATION_REQUIRED');
}
module.exports={decide};
