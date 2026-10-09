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
const actual=sub.cues;
const grouped=new Map();
let previousEnd=0;
for(const cue of actual){
 assert.ok(Number.isInteger(cue.scene_id),'invalid scene id');
 assert.ok(Number.isFinite(cue.start_seconds)&&Number.isFinite(cue.end_seconds));
 assert.ok(cue.start_seconds>=previousEnd-0.005,'subtitle cues overlap');
 assert.ok(cue.end_seconds>cue.start_seconds,'subtitle cue has no duration');
 assert.ok([...cue.text].length<=30,'subtitle exceeds 30 characters');
 assert.ok(!/[\r\n]/.test(cue.text),'subtitle must remain single-line');
 grouped.set(cue.scene_id,(grouped.get(cue.scene_id)||'')+cue.text);
 previousEnd=cue.end_seconds;
}
for(const scene of plan.scenes){
 assert.equal(grouped.get(scene.id),scene.caption_text,'caption text drift in scene '+scene.id);
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
assert.equal(blocks.length,actual.length,'SRT block count mismatch');
blocks.forEach((block,i)=>{
 const lines=block.split(/\r?\n/);
 assert.equal(lines.length,3,'SRT caption must be one line');
 assert.equal(lines[2],actual[i].text,'SRT content drift at '+(i+1));
});
assert.ok(fs.statSync(path.join(dir,'daily-gainers-'+date+'.mp4')).size>1024);
console.log(JSON.stringify({status:'PASS',target_date:date,scenes:plan.scenes.length,cues:actual.length,media_artifact:true,lexical_zero:false}));
