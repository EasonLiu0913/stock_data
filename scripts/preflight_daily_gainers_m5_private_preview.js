'use strict';
const assert=require('node:assert/strict');
const {createDraft,validate}=require('./build_daily_gainers_m4_spoken_draft');
const {audit}=require('./audit_daily_gainers_m4_spoken_draft');
const {OPENING_LINES}=require('./daily_gainers_brand_opening');
const {isWholeVideoDurationValid}=require('./render_daily_gainers_video');
function preflight(){
 const draft=createDraft();validate(draft);const a=audit(draft);
 assert.equal(draft.date,'20261008');
 assert.equal(draft.scenes.length,7);
 assert.deepEqual(draft.scenes.slice(0,3).map(s=>s.spoken),OPENING_LINES);
 for(const s of draft.scenes)assert.equal(s.spoken,s.srt_text);
 assert.equal(a.source_verified,true);assert.equal(draft.publication_authorized,false);
 assert.equal(isWholeVideoDurationValid(299.999),false);
 assert.equal(isWholeVideoDurationValid(300),true);
 assert.equal(isWholeVideoDurationValid(636.831224),true);
 const result={date:draft.date,contract:'M5-PRIVATE-TTS-VIDEO-PREVIEW-v1',status:'PREFLIGHT_ONLY_NOT_MEDIA_PROOF',
  scene_count:draft.scenes.length,spoken_characters:a.spoken_characters,brand_lines_verified:true,
  whole_video_duration_minimum_seconds:300,whole_video_duration_maximum_seconds:null,market_opening_target_seconds:[60,90],
  requires_isolated_private_segment:true,requires_real_tts:true,requires_timed_srt:true,
  requires_1080p_frame_and_caption_safe_area_inspection:true,
  actual_tts_duration_seconds:null,media_proof_complete:false,publication_authorized:false,
  release_blocker:'FINANCIAL_SOURCE_PUBLICATION_SCOPE_UNVERIFIED'};
 return result;
}
if(require.main===module)console.log(JSON.stringify(preflight(),null,2));
module.exports={preflight};
