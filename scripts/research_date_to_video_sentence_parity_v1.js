'use strict';
// Structural sentence parity only. Never infers editorial approval or permits TTS.
const {FIXED_OPENING_LINES}=require('./research_date_to_video_fixed_opening_v1');
function validate(packet,datedInput){
 const issues=[];const check=(code,ok)=>{if(!ok)issues.push(code)};
 check('DATED_INPUT_REQUIRED',!!datedInput&&datedInput.contract==='DATE_TO_VIDEO_V1_RESEARCH_DATED_MEDIA_INPUT_V1');
 check('PACKET_REQUIRED',!!packet&&typeof packet==='object');
 check('DATE_MATCH',!!packet&&!!datedInput&&packet.target_date===datedInput.target_date);
 check('MASTER_SHA_MATCH',!!packet&&!!datedInput&&packet.source_master_sha256===datedInput.source_master_sha256);
 check('SENTENCES_REQUIRED',Array.isArray(packet?.sentences)&&packet.sentences.length>=FIXED_OPENING_LINES.length);
 if(Array.isArray(packet?.sentences)){
  const ids=new Set();for(const [i,s] of packet.sentences.entries()){
   check('SENTENCE_ID_'+i,typeof s?.id==='string'&&s.id.length>0&&!ids.has(s.id));if(typeof s?.id==='string')ids.add(s.id);
   check('NARRATION_'+i,typeof s?.narration==='string'&&s.narration.trim().length>0);
   check('SUBTITLE_'+i,typeof s?.subtitle==='string'&&s.subtitle.trim().length>0);
   check('PARITY_'+i,typeof s?.narration==='string'&&s.narration===s.subtitle);
   if(i<FIXED_OPENING_LINES.length)check('OPENING_'+i,s?.narration===FIXED_OPENING_LINES[i]);
  }
 }
 // Exact text parity is intentionally conservative until a reviewed spoken-number/subtitle projection exists.
 return {contract:'DATE_TO_VIDEO_V1_RESEARCH_SENTENCE_PARITY_V1',target_date:datedInput?.target_date||null,status:issues.length?'REJECTED':'STRUCTURAL_PARITY_ONLY_EDITORIAL_REVIEW_REQUIRED',issues,editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};
}
module.exports={validate};
