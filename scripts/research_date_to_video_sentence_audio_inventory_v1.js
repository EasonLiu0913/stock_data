'use strict';
// Deterministic research-only sentence inventory; never invokes Edge TTS or authorizes rendering.
const {inspect}=require('./research_date_to_video_narration_candidate_review_v1');
function prepare(worksheet,datedInput,candidate){
 const review=inspect(worksheet,datedInput,candidate),ready=review.status==='STRUCTURAL_CANDIDATE_INDEPENDENT_EDITORIAL_REVIEW_REQUIRED';
 return {contract:'DATE_TO_VIDEO_V1_RESEARCH_SENTENCE_AUDIO_INPUT_INVENTORY',target_date:datedInput?.target_date||null,source_master_sha256:datedInput?.source_master_sha256||null,worksheet_sha256:review.worksheet_sha256,candidate_sha256:review.candidate_sha256,review_status:review.status,issues:review.issues,voice:'zh-TW-YunJheNeural',rate:'+15%',sentences:ready?candidate.sentences.map((s,i)=>({id:s.id,order:i+1,insight_id:s.insight_id||null,spoken_text:s.narration,caption_text:s.subtitle,spoken_subtitle_mappings:s.spoken_subtitle_mappings||[],audio_file:null,duration_seconds:null,audio_sha256:null})):[],status:ready?'CANDIDATE_INVENTORY_PENDING_INDEPENDENT_EDITORIAL_REVIEW':'BLOCKED',audio_generated:false,editorial_certified:false,narration_authorized:false,render_authorized:false,publication_authorized:false};
}
module.exports={prepare};
