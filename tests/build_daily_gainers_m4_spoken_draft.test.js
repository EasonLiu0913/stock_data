'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createDraft,validate}=require('../scripts/build_daily_gainers_m4_spoken_draft');
const {OPENING_LINES}=require('../scripts/daily_gainers_brand_opening');
test('exact three brand lines and seven semantic single source scenes',()=>{const d=createDraft();assert.deepEqual(d.scenes.slice(0,3).map(s=>s.spoken),OPENING_LINES);assert.equal(validate(d).scenes,7);assert.equal(d.publication_authorized,false);assert.equal(d.actual_tts_duration_seconds,null);});
test('reject truncated SRT or display, scene reordering and unverified publication',()=>{for(const change of [d=>d.scenes[4].srt_text='',d=>d.scenes[3].display_text='不同',d=>d.scenes.reverse(),d=>d.publication_authorized=true]){const d=createDraft();change(d);assert.throws(()=>validate(d),/M4_/);}});
test('reject brand and source tampering',()=>{for(const change of [d=>d.scenes[0].spoken='歡迎',d=>d.scenes[3].source_refs=['fabricated'],d=>d.scenes[5].spoken+='確認反轉']){const d=createDraft();change(d);assert.throws(()=>validate(d),/M4_/);}});
