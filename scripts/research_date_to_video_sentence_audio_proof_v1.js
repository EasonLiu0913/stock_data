'use strict';
// Verify externally supplied sentence audio evidence; never synthesizes audio or grants approval.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function verify(inventory,proof,audioDir){
 const issues=[];const check=(code,ok)=>{if(!ok)issues.push(code)};
 check('INVENTORY_CONTRACT',inventory?.contract==='DATE_TO_VIDEO_V1_RESEARCH_SENTENCE_AUDIO_INPUT_INVENTORY');
 check('INVENTORY_READY',inventory?.status==='CANDIDATE_INVENTORY_PENDING_INDEPENDENT_EDITORIAL_REVIEW'&&inventory?.audio_generated===false&&inventory?.narration_authorized===false);
 check('PROOF_CONTRACT',proof?.contract==='DATE_TO_VIDEO_V1_RESEARCH_SENTENCE_AUDIO_PROOF');
 check('DATE_MATCH',typeof proof?.target_date==='string'&&proof.target_date===inventory?.target_date);
 check('CANDIDATE_SHA_MATCH',typeof proof?.candidate_sha256==='string'&&proof.candidate_sha256===inventory?.candidate_sha256);
 check('VOICE_RATE_MATCH',proof?.voice===inventory?.voice&&proof?.rate===inventory?.rate);
 const expected=Array.isArray(inventory?.sentences)?inventory.sentences:[],actual=Array.isArray(proof?.sentences)?proof.sentences:[];
 check('SENTENCE_COUNT',expected.length>0&&expected.length===actual.length);
 const seen=new Set();for(const [i,s] of expected.entries()){
  const a=actual[i],prefix='SENTENCE_'+i+'_';check(prefix+'IDENTITY',a?.id===s.id&&a?.order===s.order&&a?.spoken_text===s.spoken_text&&a?.caption_text===s.caption_text);
  check(prefix+'DURATION',typeof a?.duration_seconds==='number'&&Number.isFinite(a.duration_seconds)&&a.duration_seconds>0.1&&a.duration_seconds<120);
  const name=a?.audio_file,valid=typeof name==='string'&&/^[a-zA-Z0-9_-]+\.mp3$/.test(name)&&!seen.has(name);check(prefix+'FILENAME',valid);if(valid){seen.add(name);const file=path.join(audioDir,name);check(prefix+'FILE_SHA',typeof a.audio_sha256==='string'&&/^[a-f0-9]{64}$/.test(a.audio_sha256)&&fs.existsSync(file)&&hash(fs.readFileSync(file))===a.audio_sha256);}
 }
 return {contract:'DATE_TO_VIDEO_V1_RESEARCH_SENTENCE_AUDIO_PROOF_CHECK',target_date:inventory?.target_date||null,status:issues.length?'REJECTED':'STRUCTURAL_AUDIO_EVIDENCE_ONLY_EDITORIAL_REVIEW_REQUIRED',issues,audio_verified:issues.length===0,editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};
}
module.exports={verify};
