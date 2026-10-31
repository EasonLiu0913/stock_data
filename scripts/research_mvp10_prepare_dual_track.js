#!/usr/bin/env node
'use strict';
// Isolated MVP10 v2 semantic source -> paired speech and caption scene plan.
// PREPARE ONLY: no TTS, render, scheduler, upload, production write or YouTube.
const fs=require('node:fs');
const path=require('node:path');
const {preview}=require('./build_daily_gainers_v2_preview');
const {OPENING_TEXT}=require('./daily_gainers_brand_opening');
const {VERSION,verifySceneContent}=require('./daily_gainers_presentation_contract');

function prepare(date,root=process.cwd()){
 if(!/^20\d{6}$/.test(date||'')) throw Error('Expected valid YYYYMMDD');
 const expectedMaster=path.join(root,'video_scripts/daily-gainers/v2',date,'master.json');
 if(!fs.existsSync(expectedMaster)) throw Error('MVP10_V2_MASTER_MISSING_FOR_DATE_'+date+'; no legacy narration-to-caption fallback allowed');
 const out=preview(date,root); // already uses one typed semantic Master for both versions
 const plan=out.plan;
 if(plan.schema_version!==2 || plan.target_date!==date || !Array.isArray(plan.scenes)||!plan.scenes.length)
  throw Error('Invalid v2 source-to-plan binding');
 if(!plan.text_variant_manifest?.source_sha256)throw Error('Missing v2 source SHA');
 if(!plan.scenes[0].speech_text.startsWith(OPENING_TEXT)||
    !plan.scenes[0].caption_text.startsWith(OPENING_TEXT))throw Error('V4 four-line opening differs across paired tracks');
 const evidence=[];
 for(const scene of plan.scenes){
  verifySceneContent(scene,scene.id);
  if(!scene.speech_text || !scene.caption_text || !Array.isArray(scene.caption_cues)||!scene.caption_cues.length)
    throw Error('Missing paired scene text: '+scene.id);
  if(scene.caption_cues.map(x=>x.speech).join('')!==scene.speech_text||
     scene.caption_cues.map(x=>x.caption).join('')!==scene.caption_text)
    throw Error('Paired cue text mismatch: '+scene.id);
  evidence.push({id:scene.id,cues:scene.caption_cues.length,speech_chars:[...scene.speech_text].length,caption_chars:[...scene.caption_text].length,distinct_representations:scene.speech_text!==scene.caption_text});
 }
 const receipt={contract:VERSION,target_date:date,schema_version:2,
  source_sha256:plan.text_variant_manifest.source_sha256,
  speech_sha256:plan.text_variant_manifest.speech_sha256,
  captions_sha256:plan.text_variant_manifest.captions_sha256,
  cue_pairs_sha256:plan.text_variant_manifest.cue_pairs_sha256,
  scene_count:evidence.length,scenes:evidence,
  tts_text_source:'scene.speech_text',srt_display_source:'scene.caption_cues[].caption',
  srt_alignment_source:'scene.caption_cues[].speech',
  burned_in_zh_tw_captions_primary:true,optional_external_srt:true,
  no_cc_prompt:true,render_only:true,publication_authorized:false,
  youtube_upload:false,full_video_render_verified:false};
 const destination=path.join(out.output,'mvp10-dual-track-contract.json');
 fs.writeFileSync(destination,JSON.stringify(receipt,null,2)+'\n');
 return {plan_path:path.join(out.output,'plan.json'),receipt_path:destination,receipt};
}
if(require.main===module){
 const [date,root]=process.argv.slice(2);
 const result=prepare(date,root||process.cwd());
 console.log(JSON.stringify({plan_path:result.plan_path,receipt_path:result.receipt_path,scenes:result.receipt.scene_count,render:false,upload:false}));
}
module.exports={prepare};
