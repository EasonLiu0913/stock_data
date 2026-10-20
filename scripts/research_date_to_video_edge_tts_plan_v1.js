'use strict';
// Date-parameterized Edge TTS command plan only; never executes commands or grants permission.
const {FIXED_OPENING_LINES}=require('./research_date_to_video_fixed_opening_v1');
function plan(inventory){
 const issues=[];const check=(code,ok)=>{if(!ok)issues.push(code)};
 check('INVENTORY_CONTRACT',inventory?.contract==='DATE_TO_VIDEO_V1_RESEARCH_SENTENCE_AUDIO_INPUT_INVENTORY');
 check('INVENTORY_STATUS',inventory?.status==='CANDIDATE_INVENTORY_PENDING_INDEPENDENT_EDITORIAL_REVIEW');
 check('DATE_REQUIRED',typeof inventory?.target_date==='string'&&/^20\d{6}$/.test(inventory.target_date));
 check('VOICE_RATE',inventory?.voice==='zh-TW-YunJheNeural'&&inventory?.rate==='+15%');
 check('NO_UPSTREAM_AUTHORIZATION',inventory?.editorial_certified===false&&inventory?.narration_authorized===false&&inventory?.render_authorized===false&&inventory?.publication_authorized===false);
 const sentences=Array.isArray(inventory?.sentences)?inventory.sentences:[];
 check('SENTENCES_REQUIRED',sentences.length>FIXED_OPENING_LINES.length);
 for(const [i,s] of sentences.entries()){check('SENTENCE_'+i,typeof s?.id==='string'&&s.id.length>0&&s.order===i+1&&typeof s.spoken_text==='string'&&s.spoken_text.trim().length>0&&typeof s.caption_text==='string'&&s.caption_text.trim().length>0);if(i<4)check('OPENING_'+i,s?.spoken_text===FIXED_OPENING_LINES[i]&&s?.caption_text===FIXED_OPENING_LINES[i]);}
 return {contract:'DATE_TO_VIDEO_V1_RESEARCH_EDGE_TTS_COMMAND_PLAN',target_date:inventory?.target_date||null,candidate_sha256:inventory?.candidate_sha256||null,status:issues.length?'REJECTED':'PLAN_ONLY_INDEPENDENT_EDITORIAL_APPROVAL_REQUIRED',issues,voice:'zh-TW-YunJheNeural',rate:'+15%',commands:issues.length?[]:sentences.map((s,i)=>({sentence_id:s.id,order:i+1,output_file:String(i+1).padStart(3,'0')+'.mp3',argv:['edge-tts','--voice','zh-TW-YunJheNeural','--rate','+15%','--text',s.spoken_text,'--write-media',String(i+1).padStart(3,'0')+'.mp3']})),commands_executed:false,editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};
}
module.exports={plan};
