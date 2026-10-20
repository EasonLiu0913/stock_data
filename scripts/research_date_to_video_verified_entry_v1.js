'use strict';
// Research-only date entry: D4 orchestration followed by independent recovery status verification.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {run}=require('./research_date_to_video_d4_orchestrator');
const {verify}=require('./research_date_to_video_recovery_status_verify_v1');
const {inspect:inspectMedia}=require('./research_date_to_video_media_preflight_v1');
const {advise}=require('./research_date_to_video_next_action_v1');
const {verify:verifyEntry}=require('./research_date_to_video_verified_entry_verify_v1');
const {inspectDirectory:inspectNarrationCandidate}=require('./research_date_to_video_narration_candidate_review_v1');
const {matches:matchesCandidateSentences}=require('./research_date_to_video_candidate_sentence_link_v1');
const {build:buildDatedMediaInput,inspectSentencePacket}=require('./research_date_to_video_dated_media_input_v1');
function execute(root,date,out){
 if(!/^20\d{6}$/.test(date||''))throw Error('INVALID_TARGET_DATE');
 // Invalidate the previous handoff before any new run can fail or change date.
 const previous=path.join(out,'verified-research-entry.json');
 if(fs.existsSync(previous))fs.unlinkSync(previous);
 const d4=run(root,date,out),verification=verify(out),media=inspectMedia(out),datedMedia=buildDatedMediaInput(out);
 if(datedMedia.target_date!==null&&datedMedia.target_date!==date)throw Error('DATED_MEDIA_INPUT_DATE_MISMATCH');
 const packetPath=path.join(out,'sentence-packet-input.json');
 let sentenceHandoff=null,sentencePacketSha256=null;
 if(fs.existsSync(packetPath)){
  const packetBytes=fs.readFileSync(packetPath);
  sentencePacketSha256=crypto.createHash('sha256').update(packetBytes).digest('hex');
  let parsed;
  try{parsed=JSON.parse(packetBytes.toString('utf8'));}
  catch(e){sentenceHandoff={contract:'DATE_TO_VIDEO_V1_RESEARCH_SENTENCE_MEDIA_HANDOFF',target_date:date,status:'REJECTED',issues:['SENTENCE_PACKET_INVALID_JSON'],editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};}
  if(sentenceHandoff===null)sentenceHandoff=inspectSentencePacket(out,parsed);
 }
 const candidatePath=path.join(out,'narration-candidate-input.json');
 let narrationCandidateReview=null,narrationCandidateSha256=null;
 if(fs.existsSync(candidatePath)){
  const bytes=fs.readFileSync(candidatePath);narrationCandidateSha256=crypto.createHash('sha256').update(bytes).digest('hex');
  try{narrationCandidateReview=inspectNarrationCandidate(out,JSON.parse(bytes.toString('utf8')));}
  catch(e){narrationCandidateReview={status:'REJECTED',issues:['NARRATION_CANDIDATE_INPUT_INVALID_OR_WORKSHEET_UNAVAILABLE'],editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};}
 }
 if(sentenceHandoff?.candidate_sentences&&narrationCandidateReview?.status==='STRUCTURAL_CANDIDATE_INDEPENDENT_EDITORIAL_REVIEW_REQUIRED'){
  const packet=JSON.parse(fs.readFileSync(packetPath,'utf8')),candidate=JSON.parse(fs.readFileSync(candidatePath,'utf8'));
  if(!matchesCandidateSentences(packet,candidate)){
   narrationCandidateReview={...narrationCandidateReview,status:'REJECTED',issues:[...narrationCandidateReview.issues,'SENTENCE_CANDIDATE_CONTENT_MISMATCH']};
  }
 }
 const source_files=['status.json','official-data-recovery-plan.json','official-data-manifest.json'];
 const source_artifacts=source_files.map(name=>({name,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(out,name))).digest('hex')}));
 const result={contract:'DATE_TO_VIDEO_V1_VERIFIED_RESEARCH_ENTRY',target_date:date,research_only:true,d4_status:d4.stages?.[0]?.status||'UNKNOWN',verification_status:verification.status,verification_issues:verification.issues,blockers:d4.blockers,source_artifacts,media_preflight:{status:media.status,issues:media.issues,target_date:media.target_date},sentence_handoff:sentenceHandoff,sentence_packet_source:sentencePacketSha256?{name:'sentence-packet-input.json',sha256:sentencePacketSha256}:null,narration_candidate_review:narrationCandidateReview,narration_candidate_source:narrationCandidateSha256?{name:'narration-candidate-input.json',sha256:narrationCandidateSha256}:null,dated_media_input:{target_date:datedMedia.target_date,media_bridge_status:datedMedia.media_bridge_status,preflight_status:datedMedia.preflight_status,source_master_sha256:datedMedia.source_master_sha256,analysis_task_sha256:datedMedia.analysis_task_sha256,blockers:datedMedia.blockers},next_action:advise(d4,verification,media,sentenceHandoff,narrationCandidateReview),automatic_dispatch_authorized:false,tts_authorized:false,render_authorized:false,publication_authorized:false};
 fs.writeFileSync(path.join(out,'verified-research-entry.json'),JSON.stringify(result,null,2)+'\n');
 const integrity=verifyEntry(out);
 if(integrity.status!=='VERIFIED_RESEARCH_ONLY'){
  fs.unlinkSync(path.join(out,'verified-research-entry.json'));
  throw Error('VERIFIED_ENTRY_INTEGRITY_REJECTED:'+integrity.issues.join(','));
 }
 return result;
}
if(require.main===module){const [date,root='.',out]=process.argv.slice(2);if(!date||!out){console.error('Usage: node scripts/research_date_to_video_verified_entry_v1.js YYYYMMDD repo-root output-dir');process.exit(2)}try{const result=execute(root,date,out);console.log(JSON.stringify(result,null,2));if(result.verification_status!=='VERIFIED_RESEARCH_ONLY')process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={execute};
