'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {audit}=require('../scripts/audit_daily_gainers_m4_spoken_draft');
const {createDraft}=require('../scripts/build_daily_gainers_m4_spoken_draft');
test('actual bounded draft figures and provenance audit',()=>{const x=audit();assert.equal(x.source_verified,true);assert.equal(x.scene_count,7);assert.equal(x.actual_tts_duration_seconds,null);assert.ok(x.spoken_characters>0);});
test('changed narration, omitted caption or fabricated reference rejected',()=>{
 for(const change of [d=>d.scenes[3].spoken='錯誤的市場數字',d=>d.scenes[4].srt_text='',d=>d.scenes[5].source_refs=['fabricated']]){const d=createDraft();change(d);assert.throws(()=>audit(d));}
});
test('character counts never imply TTS measurement',()=>{const x=audit();assert.match(x.note,/NOT measured TTS/);assert.equal(x.publication_authorized,false);});
