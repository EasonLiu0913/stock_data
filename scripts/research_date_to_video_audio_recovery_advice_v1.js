'use strict';
// Research-only, deterministic advice. Never dispatches workflows, TTS, rendering or publication.
const fs=require('node:fs'),path=require('node:path');
function advise(review){
 const issues=[...new Set(Array.isArray(review?.issues)?review.issues:[])];
 const actions=issues.map(issue=>{
  if(issue.startsWith('D4_AUDIO_INPUT_MISSING:'))return {issue,action:'SUPPLY_MISSING_RESEARCH_ARTIFACT',artifact:issue.slice('D4_AUDIO_INPUT_MISSING:'.length)};
  if(issue==='D4_AUDIO_INPUT_INVALID_JSON')return {issue,action:'REGENERATE_VALID_JSON_INPUT'};
  if(issue==='D4_AUDIO_REVIEW_ERROR')return {issue,action:'INSPECT_RESEARCH_REVIEW_ERROR'};
  if(issue.includes('SHA_MISMATCH')||issue.includes('INVENTORY_DRIFT')||issue.includes('DATE_MISMATCH'))return {issue,action:'REGENERATE_FROM_SAME_DATE_VERIFIED_INPUTS'};
  if(issue.includes('CANDIDATE_REJECTED'))return {issue,action:'REVIEW_NARRATION_CANDIDATE_INDEPENDENTLY'};
  return {issue,action:'REVIEW_RESEARCH_EVIDENCE_MANUALLY'};
 });
 return {contract:'DATE_TO_VIDEO_V1_AUDIO_RECOVERY_ADVICE',target_date:review?.target_date||null,research_only:true,source_status:review?.status||'UNKNOWN',actions,automatic_dispatch_authorized:false,tts_authorized:false,render_authorized:false,publication_authorized:false};
}
function adviseDirectory(dir){return advise(JSON.parse(fs.readFileSync(path.join(dir,'sentence-audio-review.json'),'utf8')));}
if(require.main===module){const dir=process.argv[2];if(!dir){console.error('Usage: node scripts/research_date_to_video_audio_recovery_advice_v1.js d4-output-dir');process.exit(2)}try{console.log(JSON.stringify(adviseDirectory(dir),null,2));}catch(e){console.error(e.message);process.exit(1)}}
module.exports={advise,adviseDirectory};
