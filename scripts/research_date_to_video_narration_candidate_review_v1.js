'use strict';
// Candidate review packet: validates provenance and sentence linkage, never grants editorial approval or TTS.
const crypto=require('node:crypto');const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const {validate:validateParity}=require('./research_date_to_video_sentence_parity_v1');
function inspect(worksheet,datedInput,candidate){
 const issues=[];const check=(code,ok)=>{if(!ok)issues.push(code)};
 check('WORKSHEET_CONTRACT',worksheet?.contract==='DATE_TO_VIDEO_V1_RESEARCH_EDITORIAL_NARRATION_WORKSHEET');
 check('WORKSHEET_READY',Array.isArray(worksheet?.sections)&&worksheet.sections.length>0&&Array.isArray(worksheet.issues)&&!worksheet.issues.includes('DRAFT_STRUCTURAL_EVIDENCE_REQUIRED')&&!worksheet.issues.includes('DATED_MASTER_TASK_REQUIRED'));
 check('DATE_MATCH',typeof candidate?.target_date==='string'&&candidate.target_date===worksheet?.target_date&&candidate.target_date===datedInput?.target_date);
 check('MASTER_SHA_MATCH',typeof candidate?.source_master_sha256==='string'&&candidate.source_master_sha256===worksheet?.source_master_sha256&&candidate.source_master_sha256===datedInput?.source_master_sha256);
 check('WORKSHEET_SHA_MATCH',typeof candidate?.worksheet_sha256==='string'&&/^[a-f0-9]{64}$/.test(candidate.worksheet_sha256)&&candidate.worksheet_sha256===sha(worksheet));
 check('DRAFT_SHA_MATCH',typeof candidate?.draft_sha256==='string'&&/^[a-f0-9]{64}$/.test(candidate.draft_sha256)&&candidate.draft_sha256===worksheet?.draft_sha256);
 const parity=validateParity(candidate,datedInput);check('SENTENCE_PARITY',parity.status==='STRUCTURAL_PARITY_ONLY_EDITORIAL_REVIEW_REQUIRED');
 const sections=worksheet?.sections||[],covered=new Set();for(const [i,s] of (Array.isArray(candidate?.sentences)?candidate.sentences:[]).entries()){
  if(i<4)continue;
  check('INSIGHT_LINK_'+i,typeof s.insight_id==='string'&&sections.some(x=>x.insight_id===s.insight_id));if(typeof s.insight_id==='string')covered.add(s.insight_id);
 }
 for(const s of sections)check('INSIGHT_COVERAGE_'+s.insight_id,covered.has(s.insight_id));
 return {contract:'DATE_TO_VIDEO_V1_RESEARCH_NARRATION_CANDIDATE_REVIEW',target_date:datedInput?.target_date||null,worksheet_sha256:worksheet?sha(worksheet):null,candidate_sha256:candidate?sha(candidate):null,status:issues.length?'REJECTED':'STRUCTURAL_CANDIDATE_INDEPENDENT_EDITORIAL_REVIEW_REQUIRED',issues,sentence_parity:parity,editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};
}
module.exports={inspect};
