'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {VERSION,BRAND,rejectObsoleteCC,verifySceneContent,verifyPresentationDocument} = require('../scripts/daily_gainers_presentation_contract');
const valid=()=>({title:'今日市場',subtitle:'上市普通股',narration:'今天有三十五檔強勢股。',bullets:['觀察成交量'],footer:BRAND});
test('versioned prospective V4 and no CC in brand',()=>{assert.equal(VERSION,'TAIWAN-STOCK-MVP10-V4-20261031');assert.ok(!BRAND.includes('CC'));});
test('rejects obsolete spoken or visual CC variants',()=>{
 for(const s of ['歡迎打開 CC 中文字幕觀賞','請開啟CC字幕','歡迎打開ＣＣ中文字幕觀賞','打開字幕觀賞','中文字幕觀賞'])assert.throws(()=>rejectObsoleteCC(s),/Obsolete CC/);
});
test('rejects every scene field including footer',()=>{
 for(const field of ['title','subtitle','narration','footer','speech_text','caption_text','display_text']){
  const s=valid();s[field]='歡迎打開 CC 中文字幕觀賞';assert.throws(()=>verifySceneContent(s,1),/Obsolete CC/);
 }
});
test('rejects CC in bullets and cue pairs',()=>{
 const candidates=[{...valid(),bullets:['請開啟 CC']},{...valid(),caption_cues:[{caption:'歡迎打開 CC',speech:'不應出現'}]},{...valid(),caption_cues:[{caption:'不應出現',speech:'請開啟 CC 字幕'}]}];
 candidates.forEach(s=>assert.throws(()=>verifySceneContent(s,1),/Obsolete CC/));
});
test('SRT remains optional external feature',()=>{const r=verifyPresentationDocument({scenes:[valid()]});assert.equal(r.scene_count,1);assert.equal(r.obsolete_cc_prompt_allowed,false);});
test('rejects missing scene data',()=>assert.throws(()=>verifyPresentationDocument({scenes:[]}),/Missing presentation/));
test('rejects late-scene old CC',()=>assert.throws(()=>verifyPresentationDocument({scenes:[valid(),valid(),{...valid(),footer:'歡迎打開 CC 中文字幕觀賞'}]}),/scene 3.footer/));
test('allows branding and harmless words',()=>{verifySceneContent(valid(),1);assert.equal(rejectObsoleteCC('ECC 是公司縮寫'),'ECC 是公司縮寫');});
