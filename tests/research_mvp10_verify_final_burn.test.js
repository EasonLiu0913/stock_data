'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {seconds,verify}=require('../scripts/research_mvp10_verify_final_burn');
test('strict SRT timestamps are converted to nonnegative seconds',()=>{
 assert.equal(seconds('00:05:02,125'),302.125);
 assert.equal(seconds('00:00:00,000'),0);
 assert.throws(()=>seconds('00:05:02.125'),/INVALID_SRT_TIMESTAMP/);
});
test('cannot verify missing final media as a release-ready MP4',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mvp10-finalburn-'));
 try{
  const file=(name,v)=>fs.writeFileSync(path.join(dir,name),JSON.stringify(v));
  file('plan.json',{target_date:'20261013',scene_count:7,research_only:true,
   source_final_approved:false,publication_authorized:false});
  file('research-preview-boundary.json',{video_release_approved:false,publication_authorized:false,
   youtube_upload_authorized:false,not_a_substitute_for_original_AB:true});
  file('qa.json',{scene_count:7,vtuber_enabled:true,duration_pass:true});
  file('subtitle-burn-evidence.json',{target_date:'20261013',source_final_approved:false,
   publication_authorized:false,youtube_upload_authorized:false});
  file('research-caption-display-evidence.json',{speech_text_modified:false,tts_audio_modified:false,
   timings_preserved:true,percent_cues_changed:1,publication_authorized:false});
  file('subtitle-manifest.json',{display_format:'arabic_number_with_percent_sign_research_preview_only'});
  file('tts-manifest.json',{voice:'zh-TW-YunJheNeural',rate:'+15%',engine:'edge-tts',
   scenes:Array.from({length:7},(_,i)=>({id:i+1,engine:'edge-tts',word_boundaries:[{text:'好',offset:0,duration:10000}]}))});
  assert.throws(()=>verify(dir),/MISSING_FINAL_MEDIA|ENOENT/);
  const plan=JSON.parse(fs.readFileSync(path.join(dir,'plan.json')));
  plan.publication_authorized=true;
  file('plan.json',plan);
  assert.throws(()=>verify(dir),/UNAPPROVED_SOURCE_OR_MEDIA_NOT_VERIFIABLE/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
