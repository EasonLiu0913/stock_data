'use strict';
// Research-only bridge from the latest genuine archived V3 review to future private media proof.
// This is a semantic input, NOT TTS, timed SRT, audio or video.
const {build}=require('./build_daily_gainers_m5_v3_real_archive_review');
const {OPENING_LINES}=require('./daily_gainers_brand_opening');
function create(){
 const r=build();
 if(r.date!=='20261008'||r.publication_authorized!==false||r.tts_authorized!==false||r.video_authorized!==false||r.claim_evidence.scope_verified_for_publication!==false||r.claim_evidence.rights_verified_for_publication!==false)throw Error('M5_V3_PRIVATE_INPUT_RELEASE_DRIFT');
 if(r.scenes.length!==7||r.scenes.some((s,i)=>s.scene!==i+1||!s.speech||s.speech!==s.caption||s.speech!==s.display))throw Error('M5_V3_PRIVATE_INPUT_PARITY_DRIFT');
 if(r.scenes.slice(0,3).some((s,i)=>s.speech!==OPENING_LINES[i]))throw Error('M5_V3_PRIVATE_INPUT_BRAND_DRIFT');
 return {contract:'M5-V3-PRIVATE-MEDIA-SEMANTIC-INPUT-v1',target_date:r.date,source_contract:r.contract,source_sha256:r.source_sha256,claim_evidence:r.claim_evidence,scenes:r.scenes.map(s=>({scene:s.scene,speech_text:s.speech,caption_text:s.caption,display_text:s.display})),publication_authorized:false,tts_authorized:false,video_authorized:false,real_tts_generated:false,timed_srt_generated:false,actual_duration_seconds:null,mp4_generated:false,private_media_proof_complete:false};
}
if(require.main===module)console.log(JSON.stringify(create(),null,2));
module.exports={create};
