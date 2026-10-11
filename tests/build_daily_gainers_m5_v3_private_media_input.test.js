'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../scripts/build_daily_gainers_m5_v3_private_media_input');
const {build}=require('../scripts/build_daily_gainers_m5_v3_real_archive_review');
const {OPENING_LINES}=require('../scripts/daily_gainers_brand_opening');
test('V3 source semantic bridge is exact and never asserts generated media or release',()=>{
 const r=build(),p=create();
 assert.equal(p.target_date,r.date);assert.equal(p.source_contract,r.contract);
 assert.deepEqual(p.source_sha256,r.source_sha256);assert.deepEqual(p.claim_evidence,r.claim_evidence);
 assert.deepEqual(p.scenes.map(s=>s.speech_text),r.scenes.map(s=>s.speech));
 assert.deepEqual(p.scenes.slice(0,3).map(s=>s.speech_text),OPENING_LINES);
 for(const s of p.scenes){assert.equal(s.speech_text,s.caption_text);assert.equal(s.speech_text,s.display_text)}
 for(const flag of ['publication_authorized','tts_authorized','video_authorized','real_tts_generated','timed_srt_generated','mp4_generated','private_media_proof_complete'])assert.equal(p[flag],false);
 assert.equal(p.actual_duration_seconds,null);
});
