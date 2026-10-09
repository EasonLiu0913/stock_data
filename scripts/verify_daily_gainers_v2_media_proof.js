#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const date=process.argv[2];
if(!/^20\d{6}$/.test(date||''))throw Error('Usage: node scripts/verify_daily_gainers_v2_media_proof.js YYYYMMDD');
const dir=path.resolve('output/daily-gainers-video',date);
const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
const plan=read('plan.json'),sub=read('subtitle-manifest.json'),tts=read('tts-manifest.json'),render=read('render-timings.json');
assert.equal(plan.schema_version,2);
assert.equal(plan.target_date,date);
assert.equal(plan.scenes.length,9);
assert.equal(sub.scenes.length,9);
assert.equal(tts.scenes.length,9);
assert.equal(render.scenes.length,9);
const expected=plan.scenes.flatMap(scene=>scene.caption_cues.map(p=>({scene_id:scene.id,text:p.caption})));
assert.equal(expected.length,sub.cues.length,'subtitle cue count must match all source cues');
const actual=sub.cues;
let previousEnd=0;
for(let i=0;i<expected.length;i++){
 assert.equal(actual[i].scene_id,expected[i].scene_id,'scene identifier mismatch at cue '+(i+1));
 assert.equal(actual[i].text,expected[i].text,'omitted or changed subtitle at cue '+(i+1));
 assert.ok(Number.isFinite(actual[i].start_seconds)&&Number.isFinite(actual[i].end_seconds));
 assert.ok(actual[i].start_seconds>=previousEnd-0.005,'subtitle cues overlap');
 assert.ok(actual[i].end_seconds>actual[i].start_seconds,'subtitle cue has no duration');
 previousEnd=actual[i].end_seconds;
}
const bad=actual.filter(c=>/0星個股|0散|0碎/.test(c.text));
assert.equal(bad.length,0,'lexical zero corruption detected');
for(const scene of plan.scenes){
 const joined=scene.caption_cues.map(c=>c.caption).join('');
 const spoken=scene.caption_cues.map(c=>c.speech).join('');
 assert.equal(joined,scene.caption_text);
 assert.equal(spoken,scene.speech_text);
 const audio=tts.scenes.find(x=>Number(x.id)===Number(scene.id));
 assert.ok(audio,'TTS scene missing');
 assert.equal(audio.engine,'edge-tts');
 assert.ok(Array.isArray(audio.word_boundaries)&&audio.word_boundaries.length>0);
 assert.equal(audio.spoken_text,scene.speech_text,'TTS actual submitted text diverges from v2 speech');
}
const srt=fs.readFileSync(path.join(dir,'daily-gainers-'+date+'.zh-TW.srt'),'utf8');
const blocks=srt.trim().split(/\r?\n\s*\r?\n/);
assert.equal(blocks.length,expected.length,'SRT block count mismatch');
blocks.forEach((block,i)=>assert.equal(block.split(/\r?\n/).slice(2).join(''),expected[i].text,'SRT content drift at '+(i+1)));
assert.ok(fs.statSync(path.join(dir,'daily-gainers-'+date+'.mp4')).size>1024);
console.log(JSON.stringify({status:'PASS',target_date:date,scenes:plan.scenes.length,cues:expected.length,media_artifact:true,lexical_zero:false}));
