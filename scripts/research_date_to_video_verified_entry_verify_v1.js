'use strict';
// Independent research handoff integrity check. Never grants downstream authorization.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {inspectSentencePacket}=require('./research_date_to_video_dated_media_input_v1');
const {inspectDirectory:inspectNarrationCandidate}=require('./research_date_to_video_narration_candidate_review_v1');
const {matches:matchesCandidateSentences}=require('./research_date_to_video_candidate_sentence_link_v1');
const {build:buildEditorialMediaPreview}=require('./research_date_to_video_editorial_media_preview_v1');
const {build:buildDatedMediaInput}=require('./research_date_to_video_dated_media_input_v1');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function verify(dir){
 const entry=JSON.parse(fs.readFileSync(path.join(dir,'verified-research-entry.json'),'utf8'));
 const issues=[],date=entry.target_date;
 if(entry.contract!=='DATE_TO_VIDEO_V1_VERIFIED_RESEARCH_ENTRY'||!/^20\d{6}$/.test(date||''))issues.push('INVALID_ENTRY_CONTRACT_OR_DATE');
 for(const source of entry.source_artifacts||[]){
  if(!['status.json','official-data-recovery-plan.json','official-data-manifest.json'].includes(source.name)){issues.push('UNEXPECTED_SOURCE:'+source.name);continue;}
  const file=path.join(dir,source.name);
  if(!fs.existsSync(file))issues.push('SOURCE_MISSING:'+source.name);
  else if(sha(fs.readFileSync(file))!==source.sha256)issues.push('SOURCE_CHANGED:'+source.name);
 }
 if(JSON.stringify((entry.source_artifacts||[]).map(x=>x.name))!==JSON.stringify(['status.json','official-data-recovery-plan.json','official-data-manifest.json']))issues.push('SOURCE_SET_INCOMPLETE');
 const packet=path.join(dir,'sentence-packet-input.json'),record=entry.sentence_packet_source;
 if(fs.existsSync(packet)!==!!record)issues.push('SENTENCE_PACKET_PRESENCE_CHANGED');
 else if(record&&(record.name!=='sentence-packet-input.json'||sha(fs.readFileSync(packet))!==record.sha256))issues.push('SENTENCE_PACKET_CHANGED');
 if(fs.existsSync(packet)){
  let expected;
  let parsed;
  try{parsed=JSON.parse(fs.readFileSync(packet,'utf8'));}
  catch(e){expected={contract:'DATE_TO_VIDEO_V1_RESEARCH_SENTENCE_MEDIA_HANDOFF',target_date:date,status:'REJECTED',issues:['SENTENCE_PACKET_INVALID_JSON'],editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};}
  if(expected===undefined)expected=inspectSentencePacket(dir,parsed);
  if(JSON.stringify(expected)!==JSON.stringify(entry.sentence_handoff))issues.push('SENTENCE_HANDOFF_REVALIDATION_MISMATCH');
 }else if(entry.sentence_handoff!==null)issues.push('UNEXPECTED_SENTENCE_HANDOFF');
 const candidatePath=path.join(dir,'narration-candidate-input.json'),candidateRecord=entry.narration_candidate_source;
 if(fs.existsSync(candidatePath)!==!!candidateRecord)issues.push('NARRATION_CANDIDATE_PRESENCE_CHANGED');
 else if(candidateRecord){
  const bytes=fs.readFileSync(candidatePath);
  if(candidateRecord.name!=='narration-candidate-input.json'||sha(bytes)!==candidateRecord.sha256)issues.push('NARRATION_CANDIDATE_CHANGED');
  let expected;
  let parsedCandidate;
  try{parsedCandidate=JSON.parse(bytes.toString('utf8'));}
  catch(e){expected={status:'REJECTED',issues:['NARRATION_CANDIDATE_INVALID_JSON'],editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};}
  if(expected===undefined)expected=inspectNarrationCandidate(dir,parsedCandidate);
  if(expected.status==='STRUCTURAL_CANDIDATE_INDEPENDENT_EDITORIAL_REVIEW_REQUIRED'&&entry.sentence_handoff?.candidate_sentences){
   try{const packetInput=JSON.parse(fs.readFileSync(packet,'utf8')),candidateInput=JSON.parse(bytes.toString('utf8'));
    if(!matchesCandidateSentences(packetInput,candidateInput))expected={...expected,status:'REJECTED',issues:[...expected.issues,'SENTENCE_CANDIDATE_CONTENT_MISMATCH']};
   }catch(e){issues.push('CANDIDATE_SENTENCE_COMPARISON_FAILED');}
  }
  if(JSON.stringify(expected)!==JSON.stringify(entry.narration_candidate_review))issues.push('NARRATION_CANDIDATE_REVALIDATION_MISMATCH');
  if(expected.status==='STRUCTURAL_CANDIDATE_INDEPENDENT_EDITORIAL_REVIEW_REQUIRED'){
   const worksheet=JSON.parse(fs.readFileSync(path.join(dir,'editorial-narration-worksheet.json'),'utf8'));
   const preview=buildEditorialMediaPreview({...entry,narration_candidate_review:expected,dated_media_input:buildDatedMediaInput(dir)},parsedCandidate,worksheet);
   if(JSON.stringify(preview)!==JSON.stringify(entry.editorial_media_preview))issues.push('EDITORIAL_MEDIA_PREVIEW_REVALIDATION_MISMATCH');
  }else if(entry.editorial_media_preview!==null)issues.push('UNEXPECTED_EDITORIAL_MEDIA_PREVIEW');
 }else if(entry.narration_candidate_review!==null||entry.editorial_media_preview!==null)issues.push('UNEXPECTED_NARRATION_CANDIDATE_REVIEW_OR_PREVIEW');
 if(entry.sentence_handoff?.target_date!==undefined&&entry.sentence_handoff.target_date!==date)issues.push('SENTENCE_HANDOFF_DATE_MISMATCH');
 for(const key of ['automatic_dispatch_authorized','tts_authorized','render_authorized','publication_authorized'])if(entry[key]!==false)issues.push('AUTHORIZATION_LOCK_INVALID:'+key);
 return {contract:'DATE_TO_VIDEO_V1_RESEARCH_ENTRY_INTEGRITY',target_date:date,status:issues.length?'REJECTED':'VERIFIED_RESEARCH_ONLY',issues,research_only:true,automatic_dispatch_authorized:false,tts_authorized:false,render_authorized:false,publication_authorized:false};
}
if(require.main===module){try{const result=verify(process.argv[2]);console.log(JSON.stringify(result,null,2));if(result.status==='REJECTED')process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={verify};
